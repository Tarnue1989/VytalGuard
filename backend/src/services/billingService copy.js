// 📁 backend/src/services/billingService.js

import {
  sequelize,
  AutoBillingRule,
  BillableItem,
  BillableItemPriceHistory,
  Invoice,
  InvoiceItem,
  LabRequestItem,
} from "../models/index.js";

import { logger } from "../utils/logger.js";
import { recalcInvoice } from "../utils/invoiceUtil.js";
import { getTaxRate } from "../constants/tax.js";
import { shouldTriggerBillingDB } from "./billingTriggerService.js";
import { resolveOrgFacility } from "../utils/resolveOrgFacility.js";
import { resolveFeatureModuleId } from "../utils/resolveFeatureModule.js";

/**
 * billingService – Enterprise-grade auto billing engine
 * 🔒 WRITE-SCOPE ONLY
 * 🔒 Ledger-safe
 * 🔒 FK-driven (feature_module_id ONLY)
 */
export const billingService = {
  /* ============================================================
     1️⃣ TRIGGER AUTO BILLING (FK-DRIVEN)
  ============================================================ */
    async triggerAutoBilling({
      feature_module_id,
      module_key,
      entity,
      user,
      transaction,
    }) {

    feature_module_id = await resolveFeatureModuleId({
      feature_module_id,
      module_key,
    });

    logger.info(
      `[billingService] ▶️ triggerAutoBilling | feature_module_id=${feature_module_id}, entity=${entity?.id}`
    );


    if (!entity?.patient_id) {
      logger.warn("[billingService] ❌ No patient_id, billing skipped");
      return null;
    }

    const { orgId, facilityId } = await resolveOrgFacility({
      user,
      body: entity,
    });

    // 🔐 Trigger gate (DB governed)
    const allowed = await shouldTriggerBillingDB({
      feature_module_id,
      status: entity.log_status || entity.status,
      organization_id: orgId,
      facility_id: facilityId,
    });

    if (!allowed) return null;
    // 🎯 Explicit billable item override (enterprise-safe)
    let explicitBillableItemId = entity?.billable_item_id || null;

    // 🔒 Prevent duplicate billing
    const existing = await InvoiceItem.findOne({
      where: {
        feature_module_id,
        entity_id: entity.id,
        status: "applied",
      },
      transaction,
    });

    if (existing) {
      logger.warn("[billingService] ⚠️ Duplicate billing prevented");
      return null;
    }

    // 🔎 Rule lookup (FK ONLY)
    const rule = await AutoBillingRule.findOne({
      where: {
        trigger_feature_module_id: feature_module_id,
        organization_id: orgId,
        facility_id: facilityId,
        status: "active",
        ...(explicitBillableItemId && {
          billable_item_id: explicitBillableItemId,
        }),
      },
      include: [{ model: BillableItem, as: "billableItem" }],
      transaction,
    });

    if (!rule || !rule.billableItem) return null;

    // 🛑 Enterprise safety: prevent ambiguous billing
    if (!explicitBillableItemId) {
      const count = await AutoBillingRule.count({
        where: {
          trigger_feature_module_id: feature_module_id,
          organization_id: orgId,
          facility_id: facilityId,
          status: "active",
        },
        transaction,
      });

      if (count > 1) {
        logger.warn(
          `[billingService] ❌ Ambiguous billing rules (${count}) for module ${feature_module_id}`
        );
        return null;
      }
    }

    // 💲 Price resolution (DECIMAL SAFE)
    let price = rule.default_price ?? rule.billableItem.price;

    if (!price) {
      const latest = await BillableItemPriceHistory.findOne({
        where: { billable_item_id: rule.billableItem.id },
        order: [["effective_date", "DESC"]],
        transaction,
      });
      if (latest) price = latest.new_price;
    }

    price = Number(price);
    if (Number.isNaN(price)) {
      throw new Error("Billing price is not numeric");
    }

    // 🧾 Invoice (reuse allowed)
    const allowedReuseStatuses = ["draft", "issued", "unpaid", "partial"];

    let invoice = await Invoice.findOne({
      where: {
        patient_id: entity.patient_id,
        organization_id: orgId,
        facility_id: facilityId,
        status: allowedReuseStatuses,
        is_locked: false,
      },
      transaction,
    });

    if (!invoice) {
      invoice = await Invoice.create(
        {
          patient_id: entity.patient_id,
          organization_id: orgId,
          facility_id: facilityId,
          status: "draft",
          currency: rule.billableItem.currency || "USD",
          total: 0,
          total_paid: 0,
          balance: 0,
          created_by_id: user.id,
        },
        { transaction }
      );
    }

    // 🧾 Invoice item
    const taxRate = rule.billableItem.taxable ? getTaxRate("GST") : 0;
    const taxAmount = price * (taxRate / 100);

    const item = await InvoiceItem.create(
      {
        invoice_id: invoice.id,
        billable_item_id: rule.billableItem.id,
        organization_id: orgId,
        facility_id: facilityId,
        description: rule.billableItem.name,
        unit_price: price,
        quantity: 1,
        tax_amount: taxAmount,
        total_price: price,
        net_amount: price + taxAmount,
        feature_module_id,
        entity_id: entity.id,
        created_by_id: user.id,
        status: "applied",
      },
      { transaction }
    );

    await recalcInvoice(invoice.id, transaction);
    return { invoice, item };
  },

  /* ============================================================
    2️⃣ BILL LAB REQUEST ITEMS (ENTERPRISE FIXED)
  ============================================================ */
  async billLabRequestItems({
    feature_module_id,
    labRequest,
    user,
    transaction,
  }) {
    feature_module_id = await resolveFeatureModuleId({
      feature_module_id,
      module_key: "lab_requests",
    });
    const { orgId, facilityId } = await resolveOrgFacility({
      user,
      body: labRequest,
    });

    /* ============================================================
      🔐 TRIGGER GATE (DB-DRIVEN)
    ============================================================ */
    const allowed = await shouldTriggerBillingDB({
      feature_module_id,
      status: labRequest.status,
      organization_id: orgId,
      facility_id: facilityId,
    });

    if (!allowed) {
      logger.warn("[billingService] 🚫 Lab billing blocked by trigger");
      return null;
    }


    /* ============================================================
      📦 LOAD ITEMS
    ============================================================ */
    const items = await LabRequestItem.findAll({
      where: { lab_request_id: labRequest.id },
      include: [{ model: BillableItem, as: "labTest" }],
      transaction,
    });

    if (!items.length) return null;

    /* ============================================================
      🧾 INVOICE (SAFE REUSE)
    ============================================================ */
    const allowedStatuses = ["draft", "issued", "unpaid", "partial"];

    let invoice = await Invoice.findOne({
      where: {
        patient_id: labRequest.patient_id,
        organization_id: orgId,
        facility_id: facilityId,
        status: allowedStatuses,
        is_locked: false,
      },
      transaction,
    });

    if (!invoice) {
      invoice = await Invoice.create(
        {
          patient_id: labRequest.patient_id,
          organization_id: orgId,
          facility_id: facilityId,
          status: "draft",
          currency: "USD",
          total: 0,
          total_paid: 0,
          balance: 0,
          created_by_id: user.id,
        },
        { transaction }
      );
    }

    /* ============================================================
      💲 PROCESS ITEMS
    ============================================================ */
    let billedCount = 0;
    logger.info(
      `[billingService] 🧪 Processing ${items.length} lab items for request=${labRequest.id}`
    );
    for (const li of items) {
      // 🔒 Skip already billed (CRITICAL FIX)
      if (li.billed) {
        logger.warn(`[billingService] ⚠️ Already billed, skipped item=${li.id}`);
        continue;
      }

      if (!li.labTest) continue;

      logger.info(
        `[billingService] ➕ Billing lab item ${li.id} (${li.labTest.name})`
      );

      const price = Number(li.labTest.price || 0);

      if (Number.isNaN(price)) {
        logger.error(
          `[billingService] ❌ Invalid price for lab item ${li.id}`
        );
        continue;
      }
      if (Number.isNaN(price)) continue;

      const taxRate = li.labTest.taxable ? getTaxRate("GST") : 0;
      const taxAmount = price * (taxRate / 100);

      /* 🔒 ITEM-LEVEL DUPLICATE */
      const existingItem = await InvoiceItem.findOne({
        where: {
          feature_module_id,
          entity_id: li.id,
          status: "applied",
        },
        transaction,
      });

      if (existingItem) {
        logger.warn("[billingService] ⚠️ Duplicate lab item skipped");
        continue;
      }

      const invItem = await InvoiceItem.create(
        {
          invoice_id: invoice.id,
          billable_item_id: li.labTest.id,
          organization_id: orgId,
          facility_id: facilityId,
          description: li.labTest.name,
          unit_price: price,
          quantity: 1,
          tax_amount: taxAmount,
          total_price: price,
          net_amount: price + taxAmount,
          feature_module_id,
          entity_id: li.id,
          created_by_id: user.id,
          status: "applied",
        },
        { transaction }
      );

      /* 🔗 LINK BACK */
      await li.update(
        {
          invoice_item_id: invItem.id,
          billed: true,
        },
        { transaction }
      );

      billedCount++;
    }

    /* ============================================================
      🧾 FINALIZE
    ============================================================ */
    if (billedCount > 0) {
      await labRequest.update(
        {
          billed: true,
          invoice_id: invoice.id,
        },
        { transaction }
      );

      await recalcInvoice(invoice.id, transaction);
    }

    logger.info(
      `[billingService] ✅ Lab billing complete | request=${labRequest.id} items=${billedCount}`
    );

    return { invoice, billedCount };
  },

  /* ============================================================
    3️⃣ VOID CHARGES (FK SAFE + module_key SUPPORT)
  ============================================================ */
  async voidCharges({
    feature_module_id,
    module_key,
    entityId,
    user,
    transaction,
  }) {
    // 🔁 Resolve module_key → feature_module_id
    feature_module_id = await resolveFeatureModuleId({
      feature_module_id,
      module_key,
    });

    const items = await InvoiceItem.findAll({
      where: {
        feature_module_id,
        entity_id: entityId,
        status: "applied",
      },
      transaction,
    });

    if (!items.length) return [];

    for (const item of items) {
      await item.update(
        {
          status: "voided",
          updated_by_id: user?.id || null,
        },
        { transaction }
      );
    }

    const invoiceIds = [...new Set(items.map(i => i.invoice_id))];
    for (const id of invoiceIds) {
      await recalcInvoice(id, transaction);
    }

    return items;
  },


  /* ============================================================
     4️⃣ GET INVOICES BY PATIENT (READ)
  ============================================================ */
  async getInvoicesByPatient(patientId, user) {
    const { orgId, facilityId } = await resolveOrgFacility({ user });

    return Invoice.findAll({
      where: {
        patient_id: patientId,
        organization_id: orgId,
        facility_id: facilityId,
      },
      include: [{ model: InvoiceItem, as: "items" }],
      order: [["created_at", "DESC"]],
    });
  },

  /* ============================================================
     5️⃣ BILL PHARMACY TRANSACTION (FK SAFE)
  ============================================================ */
  async billPharmacyTransaction({
    pharmacyTransaction,
    user,
    sequelizeTransaction,
  }) {
    if (!pharmacyTransaction.feature_module_id) {
      throw new Error(
        "billPharmacyTransaction requires feature_module_id"
      );
    }

    const { orgId, facilityId } = await resolveOrgFacility({
      user,
      body: pharmacyTransaction,
    });

    const allowed = await shouldTriggerBillingDB({
      feature_module_id: pharmacyTransaction.feature_module_id,
      status: pharmacyTransaction.status,
      organization_id: orgId,
      facility_id: facilityId,
    });

    if (!allowed || !pharmacyTransaction.patient_id) return null;

    const presItem = await sequelize.models.PrescriptionItem.findByPk(
      pharmacyTransaction.prescription_item_id,
      {
        include: [{ model: BillableItem, as: "billableItem" }],
        transaction: sequelizeTransaction,
      }
    );

    if (!presItem?.billableItem || presItem.dispensed_qty <= 0) return null;

    const qty = Number(presItem.dispensed_qty);
    const price = Number(presItem.billableItem.price || 0);
    if (Number.isNaN(price)) return null;

    const taxRate = presItem.billableItem.taxable ? getTaxRate("GST") : 0;

    let invoice = await Invoice.findOne({
      where: {
        patient_id: pharmacyTransaction.patient_id,
        organization_id: orgId,
        facility_id: facilityId,
        is_locked: false,
      },
      transaction: sequelizeTransaction,
    });

    if (!invoice) {
      invoice = await Invoice.create(
        {
          patient_id: pharmacyTransaction.patient_id,
          organization_id: orgId,
          facility_id: facilityId,
          status: "draft",
          currency: "USD",
          created_by_id: user.id,
        },
        { transaction: sequelizeTransaction }
      );
    }

    await InvoiceItem.create(
      {
        invoice_id: invoice.id,
        billable_item_id: presItem.billableItem.id,
        organization_id: orgId,
        facility_id: facilityId,
        description: presItem.billableItem.name,
        unit_price: price,
        quantity: qty,
        tax_amount: price * qty * (taxRate / 100),
        total_price: price * qty,
        net_amount: price * qty * (1 + taxRate / 100),
        feature_module_id: pharmacyTransaction.feature_module_id,
        entity_id: pharmacyTransaction.id,
        created_by_id: user.id,
        status: "applied",
      },
      { transaction: sequelizeTransaction }
    );

    await recalcInvoice(invoice.id, sequelizeTransaction);
    return { invoice };
  },
  /* ============================================================
    6️⃣ BILL PRESCRIPTION ITEMS (REQUIRED)
  ============================================================ */
  async billPrescriptionItems({
    prescription,
    user,
    transaction,
  }) {
    const feature_module_id = await resolveFeatureModuleId({
      module_key: "prescriptions",
    });

    const { orgId, facilityId } = await resolveOrgFacility({
      user,
      body: prescription,
    });

    /* 🔐 TRIGGER GATE */
    const allowed = await shouldTriggerBillingDB({
      feature_module_id,
      status: prescription.status,
      organization_id: orgId,
      facility_id: facilityId,
    });

    if (!allowed) return null;

    const items = await sequelize.models.PrescriptionItem.findAll({
      where: { prescription_id: prescription.id },
      include: [{ model: BillableItem, as: "billableItem" }],
      transaction,
    });

    if (!items.length) return null;

    /* 🧾 INVOICE */
    let invoice = await Invoice.findOne({
      where: {
        patient_id: prescription.patient_id,
        organization_id: orgId,
        facility_id: facilityId,
        status: ["draft", "issued", "unpaid", "partial"],
        is_locked: false,
      },
      transaction,
    });

    if (!invoice) {
      invoice = await Invoice.create(
        {
          patient_id: prescription.patient_id,
          organization_id: orgId,
          facility_id: facilityId,
          status: "draft",
          currency: "USD",
          created_by_id: user.id,
        },
        { transaction }
      );
    }

    let billedCount = 0;

    for (const item of items) {
      if (!item.billableItem) continue;

      /* 🔒 DUPLICATE CHECK */
      const existing = await InvoiceItem.findOne({
        where: {
          feature_module_id,
          entity_id: item.id,
          status: "applied",
        },
        transaction,
      });

      if (existing) continue;

      const price = Number(item.billableItem.price || 0);
      if (Number.isNaN(price)) continue;

      const taxRate = item.billableItem.taxable ? getTaxRate("GST") : 0;

      const invItem = await InvoiceItem.create(
        {
          invoice_id: invoice.id,
          billable_item_id: item.billableItem.id,
          organization_id: orgId,
          facility_id: facilityId,
          description: item.billableItem.name,
          unit_price: price,
          quantity: item.quantity || 1,
          tax_amount: price * (taxRate / 100),
          total_price: price,
          net_amount: price * (1 + taxRate / 100),
          feature_module_id,
          entity_id: item.id,
          created_by_id: user.id,
          status: "applied",
        },
        { transaction }
      );

      await item.update(
        {
          invoice_item_id: invItem.id,
          billed: true,
        },
        { transaction }
      );

      billedCount++;
    }

    if (billedCount > 0) {
      await prescription.update(
        {
          billed: true,
          invoice_id: invoice.id,
        },
        { transaction }
      );

      await recalcInvoice(invoice.id, transaction);
    }

    return { invoice, billedCount };
  },
};
