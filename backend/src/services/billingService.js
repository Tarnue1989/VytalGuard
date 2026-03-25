// 📁 backend/src/services/billingService.js
import { Op } from "sequelize";
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

import { makeModuleLogger } from "../utils/debugLogger.js";

/* ============================================================
   🔧 LOCAL DEBUG OVERRIDE
============================================================ */
const DEBUG_OVERRIDE = true;
const debug = makeModuleLogger("billingService", DEBUG_OVERRIDE);

/**
 * billingService – Enterprise-grade auto billing engine
 * 🔒 WRITE-SCOPE ONLY
 * 🔒 Ledger-safe
 * 🔒 FK-driven (feature_module_id ONLY)
 */
export const billingService = {
  /* ============================================================
    1️⃣ TRIGGER AUTO BILLING (FK-DRIVEN — DEBUG ENABLED)
  ============================================================ */
  async triggerAutoBilling({
    feature_module_id,
    module_key,
    entity,
    user,
    transaction,
  }) {

    debug.log("triggerAutoBilling → START", {
      entity_id: entity?.id,
      status: entity?.log_status || entity?.status,
      patient_id: entity?.patient_id,
      billable_item_id: entity?.billable_item_id,
    });

    feature_module_id = await resolveFeatureModuleId({
      feature_module_id,
      module_key,
    });

    /* ================= PATIENT CHECK ================= */
    if (!entity?.patient_id) {
      debug.warn("triggerAutoBilling → NO PATIENT_ID", entity);
      return null;
    }

    const { orgId, facilityId } = await resolveOrgFacility({
      user,
      body: entity,
    });

    /* ================= TRIGGER CHECK ================= */
    debug.log("triggerAutoBilling → CHECK TRIGGER", {
      feature_module_id,
      status: entity.log_status || entity.status,
      orgId,
      facilityId,
    });

    const allowed = await shouldTriggerBillingDB({
      feature_module_id,
      status: entity.log_status || entity.status,
      organization_id: orgId,
      facility_id: facilityId,
    });

    if (!allowed) {
      debug.warn("triggerAutoBilling → TRIGGER BLOCKED", {
        feature_module_id,
        status: entity.log_status || entity.status,
        orgId,
        facilityId,
      });
      return null;
    }

    debug.log("triggerAutoBilling → TRIGGER PASSED");

    /* ================= BILLABLE ITEM ================= */
    let explicitBillableItemId = entity?.billable_item_id || null;

    /* ================= DUPLICATE CHECK ================= */
    const existing = await InvoiceItem.findOne({
      where: {
        feature_module_id,
        entity_id: entity.id,
        status: "applied",
      },
      transaction,
    });

    if (existing) {
      debug.warn("triggerAutoBilling → DUPLICATE BLOCKED", {
        entity_id: entity.id,
      });
      return null;
    }

    /* ================= RULE LOOKUP ================= */
    debug.log("triggerAutoBilling → LOOKING FOR RULE", {
      feature_module_id,
      orgId,
      facilityId,
      billable_item_id: explicitBillableItemId,
    });

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

    if (!rule || !rule.billableItem) {
      debug.error("triggerAutoBilling → NO RULE FOUND", {
        feature_module_id,
        orgId,
        facilityId,
        billable_item_id: explicitBillableItemId,
      });
      return null;
    }

    debug.log("triggerAutoBilling → RULE FOUND", {
      rule_id: rule.id,
      billable_item_id: rule.billable_item_id,
    });

    /* ================= AMBIGUITY CHECK ================= */
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
        debug.error("triggerAutoBilling → AMBIGUOUS RULES", {
          count,
          feature_module_id,
          orgId,
          facilityId,
        });
        return null;
      }
    }

    /* ================= PRICE ================= */
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
      debug.error("triggerAutoBilling → INVALID PRICE", { price });
      throw new Error("Billing price is not numeric");
    }

    debug.log("triggerAutoBilling → PRICE RESOLVED", { price });

    /* ================= INVOICE ================= */
    const allowedReuseStatuses = ["draft", "issued", "unpaid", "partial"];

    let invoice = await Invoice.findOne({
      where: {
        patient_id: entity.patient_id,
        organization_id: orgId,
        ...(facilityId
          ? { facility_id: facilityId }
          : { facility_id: { [Op.in]: user.facility_ids || [] } }),
        is_locked: false,
      },
      order: [["created_at", "DESC"]],
      transaction,
    });

    if (!invoice) {
      debug.log("triggerAutoBilling → CREATING NEW INVOICE");

      const today = new Date();
      today.setDate(today.getDate() + 30);

      invoice = await Invoice.create(
        {
          patient_id: entity.patient_id,
          organization_id: orgId,
          facility_id: facilityId,
          status: "draft",
          currency: rule.billableItem.currency || "LRD", // ✅ keep your system default fallback
          total: 0,
          total_paid: 0,
          balance: 0,
          due_date: today.toISOString().slice(0, 10), // ✅ REQUIRED FIX
          created_by_id: user?.id || null, // ✅ SAFE FIX
        },
        { transaction }
      );
    }

    /* ================= CREATE ITEM ================= */
    const taxRate = rule.billableItem.taxable ? getTaxRate("GST") : 0;
    const taxAmount = price * (taxRate / 100);

    debug.log("triggerAutoBilling → CREATING INVOICE ITEM", {
      billable_item_id: rule.billableItem.id,
      price,
    });

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
        created_by_id: user?.id || null,
        status: "applied",
      },
      { transaction }
    );

    await recalcInvoice(invoice.id, transaction);

    debug.log("triggerAutoBilling → SUCCESS", {
      invoice_id: invoice.id,
      item_id: item.id,
    });

    return { invoice, item };
  },

  /* ============================================================
    2️⃣ BILL LAB REQUEST ITEMS (DEBUG ENABLED — MASTER)
  ============================================================ */
  async billLabRequestItems({
    feature_module_id,
    labRequest,
    user,
    transaction,
  }) {

    debug.log("billLabRequestItems → START", {
      request_id: labRequest?.id,
      status: labRequest?.status,
      patient_id: labRequest?.patient_id,
    });

    feature_module_id = await resolveFeatureModuleId({
      feature_module_id,
      module_key: "lab_requests",
    });

    const { orgId, facilityId } = await resolveOrgFacility({
      user,
      body: labRequest,
    });

    /* ================= TRIGGER CHECK ================= */
    debug.log("billLabRequestItems → CHECK TRIGGER", {
      feature_module_id,
      status: labRequest.status,
      orgId,
      facilityId,
    });

    const allowed = await shouldTriggerBillingDB({
      feature_module_id,
      status: labRequest.status,
      organization_id: orgId,
      facility_id: facilityId,
    });

    if (!allowed) {
      debug.warn("billLabRequestItems → TRIGGER BLOCKED", {
        feature_module_id,
        status: labRequest.status,
        orgId,
        facilityId,
      });
      return null;
    }

    debug.log("billLabRequestItems → TRIGGER PASSED");

    /* ================= LOAD ITEMS ================= */
    const items = await LabRequestItem.findAll({
      where: { lab_request_id: labRequest.id },
      include: [{ model: BillableItem, as: "labTest" }],
      transaction,
    });

    if (!items.length) {
      debug.warn("billLabRequestItems → NO ITEMS FOUND", {
        request_id: labRequest.id,
      });
      return null;
    }

    debug.log("billLabRequestItems → ITEMS LOADED", {
      count: items.length,
    });

    /* ================= INVOICE ================= */
    const allowedStatuses = ["draft", "issued", "unpaid", "partial"];

    let invoice = await Invoice.findOne({
      where: {
        patient_id: labRequest.patient_id,
        organization_id: orgId,
        ...(facilityId
          ? { facility_id: facilityId }
          : { facility_id: { [Op.in]: user.facility_ids || [] } }),
        is_locked: false,
      },
      order: [["created_at", "DESC"]],
      transaction,
    });

    if (!invoice) {
      debug.log("billLabRequestItems → CREATING INVOICE");

      const today = new Date();
      today.setDate(today.getDate() + 30);

      invoice = await Invoice.create(
        {
          patient_id: labRequest.patient_id,
          organization_id: orgId,
          facility_id: facilityId,
          status: "draft",
          currency: "LRD",
          total: 0,
          total_paid: 0,
          balance: 0,
          due_date: today.toISOString().slice(0, 10),
          created_by_id: user?.id || null,
        },
        { transaction }
      );
    }

    /* ================= PROCESS ITEMS ================= */
    let billedCount = 0;

    for (const li of items) {

      if (li.billed) {
        debug.warn("billLabRequestItems → ALREADY BILLED", {
          item_id: li.id,
        });
        continue;
      }

      if (!li.labTest) {
        debug.warn("billLabRequestItems → NO BILLABLE ITEM", {
          item_id: li.id,
        });
        continue;
      }

      const price = Number(li.labTest.price || 0);

      if (Number.isNaN(price)) {
        debug.error("billLabRequestItems → INVALID PRICE", {
          item_id: li.id,
        });
        continue;
      }

      const taxRate = li.labTest.taxable ? getTaxRate("GST") : 0;
      const taxAmount = price * (taxRate / 100);

      const existingItem = await InvoiceItem.findOne({
        where: {
          feature_module_id,
          entity_id: li.id,
          status: "applied",
        },
        transaction,
      });

      if (existingItem) {
        debug.warn("billLabRequestItems → DUPLICATE ITEM", {
          item_id: li.id,
        });
        continue;
      }

      debug.log("billLabRequestItems → BILLING ITEM", {
        item_id: li.id,
        name: li.labTest.name,
        price,
      });

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
          created_by_id: user?.id || null,
          status: "applied",
        },
        { transaction }
      );

      await li.update(
        {
          invoice_item_id: invItem.id,
          billed: true,
        },
        { transaction }
      );

      billedCount++;
    }

    /* ================= FINALIZE ================= */
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

    debug.log("billLabRequestItems → COMPLETE", {
      request_id: labRequest.id,
      billedCount,
    });

    return { invoice, billedCount };
  },

  /* ============================================================
    3️⃣ VOID CHARGES (DEBUG ENABLED — MASTER)
  ============================================================ */
  async voidCharges({
    feature_module_id,
    module_key,
    entityId,
    user,
    transaction,
  }) {

    debug.log("voidCharges → START", {
      entityId,
      module_key,
    });

    feature_module_id = await resolveFeatureModuleId({
      feature_module_id,
      module_key,
    });

    /* ================= FETCH ITEMS ================= */
    const items = await InvoiceItem.findAll({
      where: {
        entity_id: entityId,
        status: { [Op.notIn]: ["voided"] },
      },
      include: [
        {
          model: Invoice,
          as: "invoice",
          attributes: ["id", "total_paid", "status"],
        },
      ],
      transaction,
    });

    debug.log("voidCharges → ITEMS FOUND", {
      count: items.length,
    });

    if (!items.length) {
      debug.warn("voidCharges → NO ITEMS TO VOID", {
        entityId,
      });
      return [];
    }

    /* ================= PAYMENT CHECK ================= */
    for (const item of items) {
      const invoice = item.invoice;

      if (!invoice) continue;

      if ((invoice.total_paid || 0) > 0) {
        debug.error("voidCharges → PAYMENT EXISTS", {
          invoice_id: invoice.id,
        });

        throw new Error(
          `Cannot void billing: invoice ${invoice.id} has payment(s)`
        );
      }
    }

    /* ================= VOID ITEMS ================= */
    for (const item of items) {
      await item.update(
        {
          status: "voided",
          updated_by_id: user?.id || null,
        },
        { transaction }
      );

      debug.log("voidCharges → VOIDED ITEM", {
        item_id: item.id,
      });
    }

    /* ================= RECALCULATE ================= */
    const invoiceIds = [...new Set(items.map((i) => i.invoice_id))];

    for (const id of invoiceIds) {
      await recalcInvoice(id, transaction);

      debug.log("voidCharges → RECALCULATED INVOICE", {
        invoice_id: id,
      });
    }

    debug.log("voidCharges → COMPLETE", {
      entityId,
      count: items.length,
    });

    return items;
  },

/* ============================================================
   4️⃣ GET INVOICES BY PATIENT (READ — DEBUG ENABLED)
============================================================ */
async getInvoicesByPatient(patientId, user) {

  debug.log("getInvoicesByPatient → START", {
    patientId,
    user_id: user?.id,
  });

  const { orgId, facilityId } = await resolveOrgFacility({ user });

  debug.log("getInvoicesByPatient → TENANT RESOLVED", {
    orgId,
    facilityId,
  });

  const invoices = await Invoice.findAll({
    where: {
      patient_id: patientId,
      organization_id: orgId,
      facility_id: facilityId,
    },
    include: [{ model: InvoiceItem, as: "items" }],
    order: [["created_at", "DESC"]],
  });

  debug.log("getInvoicesByPatient → RESULT", {
    count: invoices.length,
    patientId,
  });

  return invoices;
},

  /* ============================================================
    5️⃣ BILL PRESCRIPTION ITEMS (DEBUG ENABLED — MASTER)
  ============================================================ */
  async billPrescriptionItems({
    prescription,
    user,
    transaction,
  }) {

    debug.log("billPrescriptionItems → START", {
      prescription_id: prescription?.id,
      status: prescription?.status,
      patient_id: prescription?.patient_id,
    });

    const feature_module_id = await resolveFeatureModuleId({
      module_key: "prescriptions",
    });

    const { orgId, facilityId } = await resolveOrgFacility({
      user,
      body: prescription,
    });

    /* ================= TRIGGER CHECK ================= */
    debug.log("billPrescriptionItems → CHECK TRIGGER", {
      feature_module_id,
      status: prescription.status,
      orgId,
      facilityId,
    });

    const allowed = await shouldTriggerBillingDB({
      feature_module_id,
      status: prescription.status,
      organization_id: orgId,
      facility_id: facilityId,
    });

    if (!allowed) {
      debug.warn("billPrescriptionItems → TRIGGER BLOCKED", {
        feature_module_id,
        status: prescription.status,
        orgId,
        facilityId,
      });
      return null;
    }

    debug.log("billPrescriptionItems → TRIGGER PASSED");

    /* ================= LOAD ITEMS ================= */
    const items = await sequelize.models.PrescriptionItem.findAll({
      where: { prescription_id: prescription.id },
      include: [{ model: BillableItem, as: "billableItem" }],
      transaction,
    });

    if (!items.length) {
      debug.warn("billPrescriptionItems → NO ITEMS FOUND", {
        prescription_id: prescription.id,
      });
      return null;
    }

    debug.log("billPrescriptionItems → ITEMS LOADED", {
      count: items.length,
    });

    /* ================= INVOICE ================= */
    let invoice = await Invoice.findOne({
      where: {
        patient_id: prescription.patient_id,
        organization_id: orgId,
        ...(facilityId
          ? { facility_id: facilityId }
          : { facility_id: { [Op.in]: user.facility_ids || [] } }),
        is_locked: false,
      },
      order: [["created_at", "DESC"]],
      transaction,
    });

    if (!invoice) {
      debug.log("billPrescriptionItems → CREATING INVOICE");

      const today = new Date();
      today.setDate(today.getDate() + 30);

      invoice = await Invoice.create(
        {
          patient_id: prescription.patient_id,
          organization_id: orgId,
          facility_id: facilityId,
          status: "draft",
          currency: "LRD", // ✅ your system default
          total: 0,
          total_paid: 0,
          balance: 0,
          due_date: today.toISOString().slice(0, 10), // ✅ REQUIRED FIX
          created_by_id: user?.id || null, // ✅ SAFE FIX
        },
        { transaction }
      );
    }

    /* ================= PROCESS ITEMS ================= */
    let billedCount = 0;

    for (const item of items) {

      if (!item.billableItem) {
        debug.warn("billPrescriptionItems → NO BILLABLE ITEM", {
          item_id: item.id,
        });
        continue;
      }

      const existing = await InvoiceItem.findOne({
        where: {
          feature_module_id,
          entity_id: item.id,
          status: "applied",
        },
        transaction,
      });

      if (existing) {
        debug.warn("billPrescriptionItems → DUPLICATE ITEM", {
          item_id: item.id,
        });
        continue;
      }

      const price = Number(item.billableItem.price || 0);

      if (Number.isNaN(price)) {
        debug.error("billPrescriptionItems → INVALID PRICE", {
          item_id: item.id,
        });
        continue;
      }

      const taxRate = item.billableItem.taxable ? getTaxRate("GST") : 0;

      debug.log("billPrescriptionItems → BILLING ITEM", {
        item_id: item.id,
        name: item.billableItem.name,
        price,
      });

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
          created_by_id: user?.id || null,
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

    /* ================= FINALIZE ================= */
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

    debug.log("billPrescriptionItems → COMPLETE", {
      prescription_id: prescription.id,
      billedCount,
    });

    return { invoice, billedCount };
  },
  /* ============================================================
    6️⃣ BILL ORDER ITEMS (DEBUG ENABLED — MASTER)
  ============================================================ */
  async billOrderItems({
    order,
    user,
    transaction,
  }) {

    debug.log("billOrderItems → START", {
      order_id: order?.id,
      status: order?.status,
      patient_id: order?.patient_id,
    });

    const feature_module_id = await resolveFeatureModuleId({
      module_key: "orders",
    });

    const { orgId, facilityId } = await resolveOrgFacility({
      user,
      body: order,
    });

    /* ================= TRIGGER CHECK ================= */
    debug.log("billOrderItems → CHECK TRIGGER", {
      feature_module_id,
      status: order.status,
      orgId,
      facilityId,
    });

    const allowed = await shouldTriggerBillingDB({
      feature_module_id,
      status: order.status,
      organization_id: orgId,
      facility_id: facilityId || user.facility_ids?.[0], // ✅ FIX
    });

    if (!allowed) {
      debug.warn("billOrderItems → TRIGGER BLOCKED", {
        feature_module_id,
        status: order.status,
        orgId,
        facilityId,
      });
      return null;
    }

    debug.log("billOrderItems → TRIGGER PASSED");

    /* ================= LOAD ITEMS ================= */
    const items = await sequelize.models.OrderItem.findAll({
      where: { order_id: order.id },
      include: [{ model: BillableItem, as: "billableItem" }],
      transaction,
    });

    if (!items.length) {
      debug.warn("billOrderItems → NO ITEMS FOUND", {
        order_id: order.id,
      });
      return null;
    }

    debug.log("billOrderItems → ITEMS LOADED", {
      count: items.length,
    });

    /* ================= INVOICE ================= */
    const allowedStatuses = ["draft", "issued", "unpaid", "partial"];

    let invoice = await Invoice.findOne({
      where: {
        patient_id: order.patient_id,
        organization_id: orgId,
        ...(facilityId
          ? { facility_id: facilityId }
          : { facility_id: { [Op.in]: user.facility_ids || [] } }),
        is_locked: false,
      },
      order: [["created_at", "DESC"]],
      transaction,
    });

    if (!invoice) {
      debug.log("billOrderItems → CREATING INVOICE");

      const today = new Date();
      today.setDate(today.getDate() + 30);

      invoice = await Invoice.create(
        {
          patient_id: order.patient_id,
          organization_id: orgId,
          facility_id: facilityId,
          status: "draft",
          currency: "LRD", // ✅ keep your system default
          total: 0,
          total_paid: 0,
          balance: 0,
          due_date: today.toISOString().slice(0, 10), // ✅ REQUIRED
          created_by_id: user?.id || null, // ✅ SAFE
        },
        { transaction }
      );
    }
    /* ================= PROCESS ITEMS ================= */
    let billedCount = 0;

    for (const item of items) {

      if (!item.billableItem) {
        debug.warn("billOrderItems → NO BILLABLE ITEM", {
          item_id: item.id,
        });
        continue;
      }

      const existing = await InvoiceItem.findOne({
        where: {
          feature_module_id,
          entity_id: item.id,
          status: "applied",
        },
        transaction,
      });

      if (existing) {
        debug.warn("billOrderItems → DUPLICATE ITEM", {
          item_id: item.id,
        });
        continue;
      }

      const price = Number(item.billableItem.price || 0);

      if (Number.isNaN(price)) {
        debug.error("billOrderItems → INVALID PRICE", {
          item_id: item.id,
        });
        continue;
      }

      const taxRate = item.billableItem.taxable ? getTaxRate("GST") : 0;
      const taxAmount = price * (taxRate / 100);

      debug.log("billOrderItems → BILLING ITEM", {
        item_id: item.id,
        name: item.billableItem.name,
        price,
      });

      const invItem = await InvoiceItem.create(
        {
          invoice_id: invoice.id,
          billable_item_id: item.billableItem.id,
          organization_id: orgId,
          facility_id: facilityId,
          description: item.billableItem.name,
          unit_price: price,
          quantity: item.quantity || 1,
          tax_amount: taxAmount,
          total_price: price,
          net_amount: price + taxAmount,
          feature_module_id,
          entity_id: item.id,
          created_by_id: user?.id || null,
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

    /* ================= FINALIZE ================= */
    if (billedCount > 0) {
      await order.update(
        {
          billed: true,
          invoice_id: invoice.id,
        },
        { transaction }
      );

      await recalcInvoice(invoice.id, transaction);
    }

    debug.log("billOrderItems → COMPLETE", {
      order_id: order.id,
      billedCount,
    });

    return { invoice, billedCount };
  },
};
