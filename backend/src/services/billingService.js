// 📁 backend/src/services/billingService.js
import { Op } from "sequelize";
import {
  sequelize,
  AutoBillingRule,
  BillableItem,
  BillableItemPriceHistory,
  InsuranceProvider,
  InsuranceClaim,
  Invoice,
  InvoiceItem,
  LabRequestItem,
} from "../models/index.js";
import { INVOICE_STATUS } from "../constants/enums.js";
import { logger } from "../utils/logger.js";
import { recalcInvoice } from "../utils/invoiceUtil.js";
import { getTaxRate } from "../constants/tax.js";
import { shouldTriggerBillingDB } from "./billingTriggerService.js";
import { resolveOrgFacility } from "../utils/resolveOrgFacility.js";
import { resolveFeatureModuleId } from "../utils/resolveFeatureModule.js";
import { getBillableItemPrice } from "../utils/getBillableItemPrice.js";
import { makeModuleLogger } from "../utils/debugLogger.js";
import { insuranceService } from "./insuranceService.js";
import { fxService } from "./fxService.js";
/* ============================================================
   🔧 LOCAL DEBUG OVERRIDE
============================================================ */
const DEBUG_OVERRIDE = true;
const debug = makeModuleLogger("billingService", DEBUG_OVERRIDE);

async function updateInvoiceStatus(invoiceId, transaction) {
  const invoice = await Invoice.findByPk(invoiceId, { transaction });
  if (!invoice) return;

  if (Number(invoice.balance) === 0) {
    invoice.status = INVOICE_STATUS.PAID;
  } else if (Number(invoice.total_paid) > 0) {
    invoice.status = INVOICE_STATUS.PARTIAL;
  } else {
    invoice.status = INVOICE_STATUS.UNPAID;
  }

  await invoice.save({ transaction });
}
async function resolveInsuranceFromEntity(entity, transaction) {
  if (!entity?.patient_insurance_id) {
    return {
      payer_type: entity?.payer_type || "cash",
      insurance_provider_id: null,
      coverage_amount: 0,
    };
  }

  const patientInsurance = await sequelize.models.PatientInsurance.findByPk(
    entity.patient_insurance_id,
    { transaction }
  );

  if (!patientInsurance) {
    return {
      payer_type: entity?.payer_type || "cash",
      insurance_provider_id: null,
      coverage_amount: 0,
    };
  }

  return {
    payer_type: "insurance",
    insurance_provider_id: patientInsurance.provider_id,
    coverage_amount: parseFloat(patientInsurance.coverage_limit || 0),

    // 🔥 ADD THIS (CRITICAL)
    coverage_currency: patientInsurance.currency || "LRD",
  };
}
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
    feature_module_id = await resolveFeatureModuleId({
      feature_module_id,
      module_key,
    });

    if (!entity?.patient_id) return null;

    const { orgId, facilityId } = await resolveOrgFacility({
      user,
      body: entity,
    });

    const allowed = await shouldTriggerBillingDB({
      feature_module_id,
      status: entity.log_status || entity.status,
      organization_id: orgId,
      facility_id: facilityId,
    });

    if (!allowed) return null;

    const existing = await InvoiceItem.findOne({
      where: {
        feature_module_id,
        entity_id: entity.id,
        status: "applied",
      },
      transaction,
    });

    if (existing) return null;

    const rule = await AutoBillingRule.findOne({
      where: {
        trigger_feature_module_id: feature_module_id,
        organization_id: orgId,
        facility_id: facilityId,
        status: "active",
      },
      include: [{ model: BillableItem, as: "billableItem" }],
      transaction,
    });

    if (!rule || !rule.billableItem) return null;

    const insuranceData = await resolveInsuranceFromEntity(
      entity,
      transaction
    );

    const { price } = await getBillableItemPrice({
      billable_item_id: rule.billableItem.id,
      payer_type: insuranceData.payer_type,
      currency: entity.currency || "LRD",
      organization_id: orgId,
      facility_id: facilityId,
      transaction,
    });

    let invoice = await Invoice.findOne({
      where: {
        patient_id: entity.patient_id,
        organization_id: orgId,
        facility_id: facilityId,
        is_locked: false,
      },
      order: [["created_at", "DESC"]],
      transaction,
    });

    if (invoice && invoice.currency !== (entity.currency || "LRD")) {
      invoice = null;
    }

    /* ================= 🔥 FIX START ================= */
    if (!invoice) {
      const today = new Date();
      today.setDate(today.getDate() + 30);

      const insuranceData = await resolveInsuranceFromEntity(
        entity,
        transaction
      );

      invoice = await Invoice.create(
        {
          patient_id: entity.patient_id,
          organization_id: orgId,
          facility_id: facilityId,

          status: INVOICE_STATUS.DRAFT,
          currency: entity.currency || "LRD",

          // 🔥 FIXED
          payer_type: insuranceData.payer_type,
          insurance_provider_id: insuranceData.insurance_provider_id,
          coverage_amount: insuranceData.coverage_amount,

          total: 0,
          total_paid: 0,
          balance: 0,

          due_date: today.toISOString().slice(0, 10),
          created_by_id: user?.id || null,
        },
        { transaction }
      );

      if (invoice.insurance_provider_id) {
        await insuranceService.createClaimFromInvoice({
          invoice_id: invoice.id,
          user,
          transaction,
        });
      }
    }
    /* ================= 🔥 FIX END ================= */

    const taxRate = rule.billableItem.taxable ? getTaxRate("GST") : 0;
    const taxAmount = price * (taxRate / 100);
    /* ================= 🔥 FX CONVERSION ================= */
    if (invoice.insurance_provider_id) {
      // reuse existing insuranceData (already defined above)
    if (insuranceData.coverage_currency !== invoice.currency) {
      invoice.coverage_amount = await fxService.convert({
        amount: invoice.coverage_amount,
        from_currency: insuranceData.coverage_currency,
        to_currency: invoice.currency,
        orgId,
        facilityId,
        transaction,
      });
      await invoice.save({ transaction }); 
    }
}   
    const net = price + taxAmount;

    let insuranceAmount = 0;
    let patientAmount = net;

    if (invoice.insurance_provider_id && invoice.coverage_amount > 0) {
      let remainingCoverage = parseFloat(invoice.coverage_amount || 0);

      insuranceAmount = Math.min(net, remainingCoverage);
      patientAmount = net - insuranceAmount;

      invoice.coverage_amount = Math.max(
        0,
        remainingCoverage - insuranceAmount
      );
    }

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
        net_amount: net,

        insurance_amount: insuranceAmount,
        patient_amount: patientAmount,

        feature_module_id,
        entity_id: entity.id,
        created_by_id: user?.id || null,
        status: "applied",
      },
      { transaction }
    );

    await recalcInvoice(invoice.id, transaction);
    await updateInvoiceStatus(invoice.id, transaction);

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

    const allowed = await shouldTriggerBillingDB({
      feature_module_id,
      status: labRequest.status,
      organization_id: orgId,
      facility_id: facilityId,
    });

    if (!allowed) return null;

    const items = await LabRequestItem.findAll({
      where: { lab_request_id: labRequest.id },
      include: [{ model: BillableItem, as: "labTest" }],
      transaction,
    });

    if (!items.length) return null;

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

    // 🔥 enforce same currency
    if (invoice && invoice.currency !== (labRequest.currency || "LRD")) {
      invoice = null;
    }

    /* ================= 🔥 CLEAN FIX START ================= */
    if (!invoice) {
      const today = new Date();
      today.setDate(today.getDate() + 30);

      // 🔥 USE HELPER (NO DUPLICATION)
      const insuranceData = await resolveInsuranceFromEntity(
        labRequest,
        transaction
      );

      invoice = await Invoice.create(
        {
          patient_id: labRequest.patient_id,
          organization_id: orgId,
          facility_id: facilityId,

          status: INVOICE_STATUS.DRAFT,
          currency: labRequest.currency || "LRD",

          // 🔥 CLEAN + CONSISTENT
          payer_type: insuranceData.payer_type,
          insurance_provider_id: insuranceData.insurance_provider_id,
          coverage_amount: insuranceData.coverage_amount,

          total: 0,
          total_paid: 0,
          balance: 0,

          due_date: today.toISOString().slice(0, 10),
          created_by_id: user?.id || null,
        },
        { transaction }
      );

      // 🔥 CREATE CLAIM IF INSURANCE EXISTS
      if (invoice.insurance_provider_id) {
        await insuranceService.createClaimFromInvoice({
          invoice_id: invoice.id,
          user,
          transaction,
        });
      }
    }
    /* ================= 🔥 CLEAN FIX END ================= */
    /* ================= 🔥 FX CONVERSION ================= */
    if (invoice.insurance_provider_id) {
      const insuranceData = await resolveInsuranceFromEntity(labRequest, transaction);

      if (insuranceData.coverage_currency !== invoice.currency) {
        invoice.coverage_amount = await fxService.convert({
          amount: invoice.coverage_amount,
          from_currency: insuranceData.coverage_currency,
          to_currency: invoice.currency,
          orgId,
          facilityId,
          transaction,
        });
        await invoice.save({ transaction });
      }
    }
    let billedCount = 0;

    for (const li of items) {
      if (li.billed) continue;
      if (!li.labTest) continue;

      const { price } = await getBillableItemPrice({
        billable_item_id: li.labTest.id,
        payer_type: invoice.payer_type,
        currency: invoice.currency,
        organization_id: orgId,
        facility_id: facilityId,
        transaction,
      });

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

      if (existingItem) continue;

      /* ================= 🔥 INSURANCE SPLIT ================= */
      const net = price + taxAmount;

      let insuranceAmount = 0;
      let patientAmount = net;

      if (invoice.insurance_provider_id && invoice.coverage_amount > 0) {
        let remainingCoverage = parseFloat(invoice.coverage_amount || 0);

        insuranceAmount = Math.min(net, remainingCoverage);
        patientAmount = net - insuranceAmount;

        invoice.coverage_amount = Math.max(
          0,
          remainingCoverage - insuranceAmount
        );
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
          net_amount: net,

          insurance_amount: insuranceAmount,
          patient_amount: patientAmount,

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

    if (billedCount > 0) {
      await labRequest.update(
        {
          billed: true,
          invoice_id: invoice.id,
        },
        { transaction }
      );

      await recalcInvoice(invoice.id, transaction);
      await updateInvoiceStatus(invoice.id, transaction);
    }

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

    if (!items.length) return [];

    /* ================= PAYMENT CHECK ================= */
    for (const item of items) {
      const invoice = item.invoice;

      if (!invoice) continue;

      if ((invoice.total_paid || 0) > 0) {
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

          // 🔥 CLEAR INSURANCE SPLIT (IMPORTANT)
          insurance_amount: 0,
          patient_amount: 0,

          updated_by_id: user?.id || null,
        },
        { transaction }
      );
    }

    /* ================= RECALCULATE ================= */
    const invoiceIds = [...new Set(items.map((i) => i.invoice_id))];

    for (const id of invoiceIds) {
      await recalcInvoice(id, transaction);
      await updateInvoiceStatus(id, transaction);
    }

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

    const invoices = await Invoice.findAll({
      where: {
        patient_id: patientId,
        organization_id: orgId,
        facility_id: facilityId,
      },
      include: [
        {
          model: InvoiceItem,
          as: "items",
        },

        // 🔥 NEW — SHOW INSURANCE PROVIDER
        {
          model: InsuranceProvider,
          as: "insuranceProvider",
          attributes: ["id", "name"],
        },

        // 🔥 NEW — SHOW CLAIM INFO
        {
          model: InsuranceClaim,
          as: "insuranceClaim",
          attributes: [
            "id",
            "claim_amount",
            "approved_amount",
            "status",
          ],
        },
      ],
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

    // 🔥 enforce same currency
    if (invoice && invoice.currency !== (prescription.currency || "LRD")) {
      invoice = null;
    }

    /* ================= 🔥 CLEAN FIX START ================= */
    if (!invoice) {
      const today = new Date();
      today.setDate(today.getDate() + 30);

      // 🔥 USE HELPER (NO DUPLICATION)
      const insuranceData = await resolveInsuranceFromEntity(
        prescription,
        transaction
      );

      invoice = await Invoice.create(
        {
          patient_id: prescription.patient_id,
          organization_id: orgId,
          facility_id: facilityId,

          status: INVOICE_STATUS.DRAFT,
          currency: prescription.currency || "LRD",

          // 🔥 CLEAN + CONSISTENT
          payer_type: insuranceData.payer_type,
          insurance_provider_id: insuranceData.insurance_provider_id,
          coverage_amount: insuranceData.coverage_amount,

          total: 0,
          total_paid: 0,
          balance: 0,

          due_date: today.toISOString().slice(0, 10),
          created_by_id: user?.id || null,
        },
        { transaction }
      );

      // 🔥 CREATE CLAIM IF INSURANCE EXISTS
      if (invoice.insurance_provider_id) {
        await insuranceService.createClaimFromInvoice({
          invoice_id: invoice.id,
          user,
          transaction,
        });
      }
    }
    /* ================= 🔥 CLEAN FIX END ================= */
    /* ================= 🔥 FX CONVERSION ================= */
    if (invoice.insurance_provider_id) {
      const insuranceData = await resolveInsuranceFromEntity(prescription, transaction);

      if (insuranceData.coverage_currency !== invoice.currency) {
        invoice.coverage_amount = await fxService.convert({
          amount: invoice.coverage_amount,
          from_currency: insuranceData.coverage_currency,
          to_currency: invoice.currency,
          orgId,
          facilityId,
          transaction,
        });
        await invoice.save({ transaction }); 
      }
    }
    let billedCount = 0;

    for (const item of items) {
      if (!item.billableItem) continue;

      const existing = await InvoiceItem.findOne({
        where: {
          feature_module_id,
          entity_id: item.id,
          status: "applied",
        },
        transaction,
      });

      if (existing) continue;

      const { price } = await getBillableItemPrice({
        billable_item_id: item.billableItem.id,
        payer_type: invoice.payer_type,
        currency: invoice.currency,
        organization_id: orgId,
        facility_id: facilityId,
        transaction,
      });

      const taxRate = item.billableItem.taxable ? getTaxRate("GST") : 0;
      const taxAmount = price * (taxRate / 100);

      /* ================= 🔥 INSURANCE SPLIT ================= */
      const net = price * (1 + taxRate / 100);

      let insuranceAmount = 0;
      let patientAmount = net;

      if (invoice.insurance_provider_id && invoice.coverage_amount > 0) {
        let remainingCoverage = parseFloat(invoice.coverage_amount || 0);

        insuranceAmount = Math.min(net, remainingCoverage);
        patientAmount = net - insuranceAmount;

        invoice.coverage_amount = Math.max(
          0,
          remainingCoverage - insuranceAmount
        );
      }

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
          net_amount: net,

          insurance_amount: insuranceAmount,
          patient_amount: patientAmount,

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

    if (billedCount > 0) {
      await prescription.update(
        {
          billed: true,
          invoice_id: invoice.id,
        },
        { transaction }
      );

      await recalcInvoice(invoice.id, transaction);
      await updateInvoiceStatus(invoice.id, transaction);
    }

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

    const allowed = await shouldTriggerBillingDB({
      feature_module_id,
      status: order.status,
      organization_id: orgId,
      facility_id: facilityId || user.facility_ids?.[0],
    });

    if (!allowed) return null;

    const items = await sequelize.models.OrderItem.findAll({
      where: { order_id: order.id },
      include: [{ model: BillableItem, as: "billableItem" }],
      transaction,
    });

    if (!items.length) return null;

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

    // 🔥 enforce same currency
    if (invoice && invoice.currency !== (order.currency || "LRD")) {
      invoice = null;
    }

    /* ================= 🔥 CLEAN FIX START ================= */
    if (!invoice) {
      const today = new Date();
      today.setDate(today.getDate() + 30);

      // 🔥 USE HELPER (NO DUPLICATION)
      const insuranceData = await resolveInsuranceFromEntity(
        order,
        transaction
      );

      invoice = await Invoice.create(
        {
          patient_id: order.patient_id,
          organization_id: orgId,
          facility_id: facilityId,

          status: INVOICE_STATUS.DRAFT,
          currency: order.currency || "LRD",

          // 🔥 CLEAN + CONSISTENT
          payer_type: insuranceData.payer_type,
          insurance_provider_id: insuranceData.insurance_provider_id,
          coverage_amount: insuranceData.coverage_amount,

          total: 0,
          total_paid: 0,
          balance: 0,

          due_date: today.toISOString().slice(0, 10),
          created_by_id: user?.id || null,
        },
        { transaction }
      );

      // 🔥 CREATE CLAIM IF INSURANCE EXISTS
      if (invoice.insurance_provider_id) {
        await insuranceService.createClaimFromInvoice({
          invoice_id: invoice.id,
          user,
          transaction,
        });
      }
    }
    /* ================= 🔥 CLEAN FIX END ================= */
    /* ================= 🔥 FX CONVERSION ================= */
    if (invoice.insurance_provider_id) {
      const insuranceData = await resolveInsuranceFromEntity(order, transaction);

      if (insuranceData.coverage_currency !== invoice.currency) {
        invoice.coverage_amount = await fxService.convert({
          amount: invoice.coverage_amount,
          from_currency: insuranceData.coverage_currency,
          to_currency: invoice.currency,
          orgId,
          facilityId,
          transaction,
        });
        await invoice.save({ transaction }); 
      }
    }
    let billedCount = 0;

    for (const item of items) {
      if (!item.billableItem) continue;

      const existing = await InvoiceItem.findOne({
        where: {
          feature_module_id,
          entity_id: item.id,
          status: "applied",
        },
        transaction,
      });

      if (existing) continue;

      const { price } = await getBillableItemPrice({
        billable_item_id: item.billableItem.id,
        payer_type: invoice.payer_type,
        currency: invoice.currency,
        organization_id: orgId,
        facility_id: facilityId,
        transaction,
      });

      const taxRate = item.billableItem.taxable ? getTaxRate("GST") : 0;
      const taxAmount = price * (taxRate / 100);

      /* ================= 🔥 INSURANCE SPLIT ================= */
      const net = price + taxAmount;

      let insuranceAmount = 0;
      let patientAmount = net;

      if (invoice.insurance_provider_id && invoice.coverage_amount > 0) {
        let remainingCoverage = parseFloat(invoice.coverage_amount || 0);

        insuranceAmount = Math.min(net, remainingCoverage);
        patientAmount = net - insuranceAmount;

        invoice.coverage_amount = Math.max(
          0,
          remainingCoverage - insuranceAmount
        );
      }

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
          net_amount: net,

          insurance_amount: insuranceAmount,
          patient_amount: patientAmount,

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

    if (billedCount > 0) {
      await order.update(
        {
          billed: true,
          invoice_id: invoice.id,
        },
        { transaction }
      );

      await recalcInvoice(invoice.id, transaction);
      await updateInvoiceStatus(invoice.id, transaction);
    }

    return { invoice, billedCount };
  },
};
