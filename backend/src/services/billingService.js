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
  /* ================= 1️⃣ FROM REGISTRATION ================= */
  let registration = null;

  if (entity?.registration_log_id) {
    registration = await sequelize.models.RegistrationLog.findByPk(
      entity.registration_log_id,
      { transaction }
    );
  }

  // 🔥 fallback: latest registration
  if (!registration && entity?.patient_id) {
    registration = await sequelize.models.RegistrationLog.findOne({
      where: { patient_id: entity.patient_id },
      order: [["created_at", "DESC"]],
      transaction,
    });
  }

  if (registration?.patient_insurance_id) {
    const pi = await sequelize.models.PatientInsurance.findByPk(
      registration.patient_insurance_id,
      { transaction }
    );

    if (pi) {
      return {
        payer_type: "insurance",
        insurance_provider_id: pi.provider_id,
        coverage_amount: parseFloat(pi.coverage_limit || 0),
        coverage_currency: pi.currency || "LRD",
      };
    }
  }

  /* ================= CASH FALLBACK ================= */
  return {
    payer_type: entity?.payer_type || "cash",
    insurance_provider_id: null,
    coverage_amount: 0,
    coverage_currency: entity?.currency || "LRD",
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
    1️⃣ TRIGGER AUTO BILLING (FINAL — ENTERPRISE SAFE)
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

    debug.log("STEP 2: BILLING TRIGGER", {
      allowed,
      status: entity.log_status || entity.status,
      entity_id: entity.id,
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

    debug.log("STEP 1: INSURANCE DATA", insuranceData);

    const { price } = await getBillableItemPrice({
      billable_item_id: rule.billableItem.id,
      payer_type: insuranceData.payer_type,
      currency: entity.currency || "LRD",
      organization_id: orgId,
      facility_id: facilityId,
      transaction,
    });

    /* ============================================================
      🔍 FIND SAFE INVOICE (FIXED)
    ============================================================ */
    let invoice = await Invoice.findOne({
      where: {
        patient_id: entity.patient_id,
        organization_id: orgId,
        facility_id: facilityId,
        is_locked: false,
        payer_type: insuranceData.payer_type,
        insurance_provider_id: insuranceData.insurance_provider_id,
      },
      order: [["created_at", "DESC"]],
      transaction,
    });

    if (invoice && invoice.currency !== (entity.currency || "LRD")) {
      invoice = null;
    }

    debug.log("STEP 3: INVOICE FOUND", {
      invoice_id: invoice?.id,
    });

    /* ============================================================
      🧾 CREATE INVOICE
    ============================================================ */
    if (!invoice) {
      const today = new Date();
      today.setDate(today.getDate() + 30);

      let providerName = null;
      if (insuranceData.insurance_provider_id) {
        const provider = await sequelize.models.InsuranceProvider.findByPk(
          insuranceData.insurance_provider_id,
          { transaction }
        );
        providerName = provider?.name || null;
      }

      invoice = await Invoice.create(
        {
          patient_id: entity.patient_id,
          organization_id: orgId,
          facility_id: facilityId,

          status: INVOICE_STATUS.DRAFT,
          currency: entity.currency || "LRD",

          payer_type: insuranceData.payer_type,
          insurance_provider_id: insuranceData.insurance_provider_id,
          coverage_amount: insuranceData.coverage_amount,

          insurance_provider_name: providerName,
          coverage_amount_initial: insuranceData.coverage_amount,
          coverage_currency: insuranceData.coverage_currency,

          insurance_amount: 0,
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

    /* ============================================================
      🔄 FX CONVERSION (FIXED PARAMS)
    ============================================================ */
    if (
      invoice.insurance_provider_id &&
      insuranceData.coverage_currency &&
      invoice.currency &&
      insuranceData.coverage_currency !== invoice.currency
    ) {
      const originalAmount = Number(invoice.coverage_amount || 0);

      const convertedAmount = await fxService.convert({
        amount: originalAmount,
        from_currency: insuranceData.coverage_currency,
        to_currency: invoice.currency,
        organization_id: orgId,
        facility_id: facilityId,
        transaction,
      });

      invoice.coverage_amount = Number(convertedAmount || 0);
      await invoice.save({ transaction });
    }

    /* ============================================================
      💰 CALCULATIONS (FIXED)
    ============================================================ */
    const round = (v) => Number(parseFloat(v).toFixed(2));

    const quantity = 1;
    const total = round(price * quantity);

    const taxRate = rule.billableItem.taxable ? getTaxRate("GST") : 0;
    const taxAmount = round(total * (taxRate / 100));
    const net = round(total + taxAmount);

    let insuranceAmount = 0;
    let patientAmount = net;

    if (invoice.insurance_provider_id && invoice.coverage_amount > 0) {
      const remaining = round(invoice.coverage_amount);

      insuranceAmount = round(Math.min(net, remaining));
      patientAmount = round(net - insuranceAmount);

      /* 🔥 CRITICAL FIX: REDUCE COVERAGE */
      invoice.coverage_amount = round(Math.max(0, remaining - insuranceAmount));
      await invoice.save({ transaction });
    }

    /* ============================================================
      🧾 CREATE ITEM (FIXED TOTALS)
    ============================================================ */
    const item = await InvoiceItem.create(
      {
        invoice_id: invoice.id,
        billable_item_id: rule.billableItem.id,
        organization_id: orgId,
        facility_id: facilityId,

        description: rule.billableItem.name,
        unit_price: price,
        quantity,

        tax_amount: taxAmount,
        total_price: total,
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
    2️⃣ BILL ORDER ITEMS (FINAL — ENTERPRISE SAFE)
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

    const insuranceData = await resolveInsuranceFromEntity(
      order,
      transaction
    );

    /* ============================================================
      🔍 SAFE INVOICE FIND (FIXED)
    ============================================================ */
    let invoice = await Invoice.findOne({
      where: {
        patient_id: order.patient_id,
        organization_id: orgId,
        ...(facilityId
          ? { facility_id: facilityId }
          : { facility_id: { [Op.in]: user.facility_ids || [] } }),
        is_locked: false,
        payer_type: insuranceData.payer_type,
        insurance_provider_id: insuranceData.insurance_provider_id,
      },
      order: [["created_at", "DESC"]],
      transaction,
    });

    if (invoice && invoice.currency !== (order.currency || "LRD")) {
      invoice = null;
    }

    /* ============================================================
      🧾 CREATE INVOICE
    ============================================================ */
    if (!invoice) {
      const today = new Date();
      today.setDate(today.getDate() + 30);

      invoice = await Invoice.create(
        {
          patient_id: order.patient_id,
          organization_id: orgId,
          facility_id: facilityId,

          status: INVOICE_STATUS.DRAFT,
          currency: order.currency || "LRD",

          payer_type: insuranceData.payer_type,
          insurance_provider_id: insuranceData.insurance_provider_id,
          coverage_amount: insuranceData.coverage_amount,

          insurance_amount: 0,
          total: 0,
          total_paid: 0,
          balance: 0,
          due_date: today.toISOString().slice(0, 10),
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

    /* ============================================================
      🔄 APPLY INSURANCE IF MISSING
    ============================================================ */
    if (
      invoice &&
      !invoice.insurance_provider_id &&
      insuranceData.insurance_provider_id
    ) {
      invoice.insurance_provider_id = insuranceData.insurance_provider_id;
      invoice.payer_type = "insurance";
      invoice.coverage_amount = insuranceData.coverage_amount;

      await invoice.save({ transaction });

      await insuranceService.createClaimFromInvoice({
        invoice_id: invoice.id,
        user,
        transaction,
      });
    }

    const round = (v) => Number(parseFloat(v).toFixed(2));

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

      /* ============================================================
        💰 CALCULATION (FIXED)
      ============================================================ */
      const quantity = item.quantity || 1;
      const total = round(price * quantity);

      const taxRate = item.billableItem.taxable ? getTaxRate("GST") : 0;
      const taxAmount = round(total * (taxRate / 100));
      const net = round(total + taxAmount);

      let insuranceAmount = 0;
      let patientAmount = net;

      if (invoice.insurance_provider_id && invoice.coverage_amount > 0) {
        const remaining = round(invoice.coverage_amount);

        insuranceAmount = round(Math.min(net, remaining));
        patientAmount = round(net - insuranceAmount);

        /* 🔥 CRITICAL FIX */
        invoice.coverage_amount = round(Math.max(0, remaining - insuranceAmount));
        await invoice.save({ transaction });
      }

      const invItem = await InvoiceItem.create(
        {
          invoice_id: invoice.id,
          billable_item_id: item.billableItem.id,
          organization_id: orgId,
          facility_id: facilityId,

          description: item.billableItem.name,
          unit_price: price,
          quantity,

          tax_amount: taxAmount,
          total_price: total,
          net_amount: net,

          insurance_amount: insuranceAmount,
          patient_amount: patientAmount,

          feature_module_id,
          entity_id: item.id,
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

    /* ============================================================
      🔥 FINALIZE
    ============================================================ */
    await order.update(
      {
        billed: true,
        invoice_id: invoice.id,
      },
      { transaction }
    );

    await recalcInvoice(invoice.id, transaction);
    await updateInvoiceStatus(invoice.id, transaction);

    return { invoice, billedCount };
  },

  /* ============================================================
    3️⃣ BILL LAB REQUEST ITEMS (FINAL — ENTERPRISE SAFE)
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

    const insuranceData = await resolveInsuranceFromEntity(
      labRequest,
      transaction
    );

    /* ============================================================
      🔍 SAFE INVOICE FIND (FIXED)
    ============================================================ */
    let invoice = await Invoice.findOne({
      where: {
        patient_id: labRequest.patient_id,
        organization_id: orgId,
        ...(facilityId
          ? { facility_id: facilityId }
          : { facility_id: { [Op.in]: user.facility_ids || [] } }),
        is_locked: false,
        payer_type: insuranceData.payer_type,
        insurance_provider_id: insuranceData.insurance_provider_id,
      },
      order: [["created_at", "DESC"]],
      transaction,
    });

    if (invoice && invoice.currency !== (labRequest.currency || "LRD")) {
      invoice = null;
    }

    /* ============================================================
      🧾 CREATE INVOICE
    ============================================================ */
    if (!invoice) {
      invoice = await Invoice.create(
        {
          patient_id: labRequest.patient_id,
          organization_id: orgId,
          facility_id: facilityId,

          status: INVOICE_STATUS.DRAFT,
          currency: labRequest.currency || "LRD",

          payer_type: insuranceData.payer_type,
          insurance_provider_id: insuranceData.insurance_provider_id,
          coverage_amount: insuranceData.coverage_amount,

          insurance_amount: 0,
          total: 0,
          total_paid: 0,
          balance: 0,
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

    /* ============================================================
      🔄 APPLY INSURANCE IF MISSING
    ============================================================ */
    if (
      invoice &&
      !invoice.insurance_provider_id &&
      insuranceData.insurance_provider_id
    ) {
      invoice.insurance_provider_id = insuranceData.insurance_provider_id;
      invoice.payer_type = "insurance";
      invoice.coverage_amount = insuranceData.coverage_amount;

      await invoice.save({ transaction });

      await insuranceService.createClaimFromInvoice({
        invoice_id: invoice.id,
        user,
        transaction,
      });
    }

    const round = (v) => Number(parseFloat(v).toFixed(2));

    let billedCount = 0;

    for (const li of items) {
      if (li.billed || !li.labTest) continue;

      const { price } = await getBillableItemPrice({
        billable_item_id: li.labTest.id,
        payer_type: invoice.payer_type,
        currency: invoice.currency,
        organization_id: orgId,
        facility_id: facilityId,
        transaction,
      });

      /* ============================================================
        💰 CALCULATION (FIXED)
      ============================================================ */
      const quantity = li.quantity || 1;
      const total = round(price * quantity);

      const taxRate = li.labTest.taxable ? getTaxRate("GST") : 0;
      const taxAmount = round(total * (taxRate / 100));
      const net = round(total + taxAmount);

      let insuranceAmount = 0;
      let patientAmount = net;

      if (invoice.insurance_provider_id && invoice.coverage_amount > 0) {
        const remaining = round(invoice.coverage_amount);

        insuranceAmount = round(Math.min(net, remaining));
        patientAmount = round(net - insuranceAmount);

        /* 🔥 CRITICAL FIX */
        invoice.coverage_amount = round(Math.max(0, remaining - insuranceAmount));
        await invoice.save({ transaction });
      }

      const invItem = await InvoiceItem.create(
        {
          invoice_id: invoice.id,
          billable_item_id: li.labTest.id,

          quantity,
          unit_price: price,

          tax_amount: taxAmount,
          total_price: total,
          net_amount: net,

          insurance_amount: insuranceAmount,
          patient_amount: patientAmount,

          feature_module_id,
          entity_id: li.id,
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

    /* ============================================================
      🔥 FINALIZE
    ============================================================ */
    await labRequest.update(
      {
        billed: true,
        invoice_id: invoice.id,
      },
      { transaction }
    );

    await recalcInvoice(invoice.id, transaction);
    await updateInvoiceStatus(invoice.id, transaction);

    return { invoice, billedCount };
  },

  /* ============================================================
    4️⃣ BILL PRESCRIPTION ITEMS (FINAL — ENTERPRISE SAFE)
  ============================================================ */
  async billPrescriptionItems({
    prescription,
    user,
    transaction,
  }) {
    debug.log("billPrescriptionItems → START", {
      prescription_id: prescription?.id,
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

    const insuranceData = await resolveInsuranceFromEntity(
      prescription,
      transaction
    );

    /* ============================================================
      🔍 SAFE INVOICE FIND (FIXED)
    ============================================================ */
    let invoice = await Invoice.findOne({
      where: {
        patient_id: prescription.patient_id,
        organization_id: orgId,
        ...(facilityId
          ? { facility_id: facilityId }
          : { facility_id: { [Op.in]: user.facility_ids || [] } }),
        is_locked: false,
        payer_type: insuranceData.payer_type,
        insurance_provider_id: insuranceData.insurance_provider_id,
      },
      order: [["created_at", "DESC"]],
      transaction,
    });

    if (invoice && invoice.currency !== (prescription.currency || "LRD")) {
      invoice = null;
    }

    /* ============================================================
      🧾 CREATE INVOICE
    ============================================================ */
    if (!invoice) {
      invoice = await Invoice.create(
        {
          patient_id: prescription.patient_id,
          organization_id: orgId,
          facility_id: facilityId,

          status: INVOICE_STATUS.DRAFT,
          currency: prescription.currency || "LRD",

          payer_type: insuranceData.payer_type,
          insurance_provider_id: insuranceData.insurance_provider_id,
          coverage_amount: insuranceData.coverage_amount,

          insurance_amount: 0,
          total: 0,
          total_paid: 0,
          balance: 0,
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

    /* ============================================================
      🔄 APPLY INSURANCE IF MISSING
    ============================================================ */
    if (
      invoice &&
      !invoice.insurance_provider_id &&
      insuranceData.insurance_provider_id
    ) {
      invoice.insurance_provider_id = insuranceData.insurance_provider_id;
      invoice.payer_type = "insurance";
      invoice.coverage_amount = insuranceData.coverage_amount;

      await invoice.save({ transaction });

      await insuranceService.createClaimFromInvoice({
        invoice_id: invoice.id,
        user,
        transaction,
      });
    }

    const round = (v) => Number(parseFloat(v).toFixed(2));

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

      /* ============================================================
        💰 CALCULATION (FIXED)
      ============================================================ */
      const quantity = item.quantity || 1;
      const total = round(price * quantity);

      const taxRate = item.billableItem.taxable ? getTaxRate("GST") : 0;
      const taxAmount = round(total * (taxRate / 100));
      const net = round(total + taxAmount);

      let insuranceAmount = 0;
      let patientAmount = net;

      if (invoice.insurance_provider_id && invoice.coverage_amount > 0) {
        const remaining = round(invoice.coverage_amount);

        insuranceAmount = round(Math.min(net, remaining));
        patientAmount = round(net - insuranceAmount);

        /* 🔥 CRITICAL FIX */
        invoice.coverage_amount = round(Math.max(0, remaining - insuranceAmount));
        await invoice.save({ transaction });
      }

      const invItem = await InvoiceItem.create(
        {
          invoice_id: invoice.id,
          billable_item_id: item.billableItem.id,

          quantity,
          unit_price: price,

          tax_amount: taxAmount,
          total_price: total,
          net_amount: net,

          insurance_amount: insuranceAmount,
          patient_amount: patientAmount,

          feature_module_id,
          entity_id: item.id,
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

    /* ============================================================
      🔥 FINALIZE
    ============================================================ */
    await prescription.update(
      {
        billed: true,
        invoice_id: invoice.id,
      },
      { transaction }
    );

    await recalcInvoice(invoice.id, transaction);
    await updateInvoiceStatus(invoice.id, transaction);

    return { invoice, billedCount };
  },

  /* ============================================================
   5️⃣  VOID CHARGES (DEBUG ENABLED — MASTER)
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

    /* ================= DEBUG: STEP 1 — ITEMS FOUND ================= */
    debug.log("VOID STEP 1: ITEMS FOUND", {
      count: items.length,
      entityId,
    });

    if (!items.length) return [];

    /* ================= DEBUG: STEP 2 — PAYMENT CHECK ================= */
    for (const item of items) {
      const invoice = item.invoice;

      debug.log("VOID STEP 2: CHECK INVOICE PAYMENT", {
        invoice_id: invoice?.id,
        total_paid: invoice?.total_paid,
        status: invoice?.status,
      });

      if (!invoice) continue;

      if (Number(invoice.total_paid || 0) > 0) {
        throw new Error(
          `Cannot void billing: invoice ${invoice.id} has payment(s)`
        );
      }
    }

    /* ================= VOID ITEMS ================= */
    for (const item of items) {
      debug.log("VOID STEP 3: VOIDING ITEM", {
        item_id: item.id,
        invoice_id: item.invoice_id,
      });

      await item.update(
        {
          status: "voided",

          // 🔥 CLEAR INSURANCE SPLIT
          insurance_amount: 0,
          patient_amount: 0,

          updated_by_id: user?.id || null,
        },
        { transaction }
      );
    }

    /* ================= DEBUG: STEP 4 — RECALCULATE INVOICES ================= */
    const invoiceIds = [...new Set(items.map((i) => i.invoice_id))];

    debug.log("VOID STEP 4: RECALCULATE INVOICES", {
      invoiceIds,
    });

    for (const id of invoiceIds) {
      await recalcInvoice(id, transaction);
      await updateInvoiceStatus(id, transaction);
    }

    /* ================= DEBUG: STEP 5 — COMPLETE ================= */
    debug.log("VOID STEP 5: COMPLETE", {
      total_voided: items.length,
    });

    return items;
  },

  /* ============================================================
    6️⃣ GET INVOICES BY PATIENT (READ — DEBUG ENABLED)
  ============================================================ */
  async getInvoicesByPatient(patientId, user) {
    debug.log("getInvoicesByPatient → START", {
      patientId,
      user_id: user?.id,
    });

    const { orgId, facilityId } = await resolveOrgFacility({ user });

    /* ================= DEBUG: STEP 1 — ORG / FACILITY ================= */
    debug.log("READ STEP 1: ORG CONTEXT", {
      orgId,
      facilityId,
      user_facilities: user?.facility_ids,
    });

    const invoices = await Invoice.findAll({
      where: {
        patient_id: patientId,
        organization_id: orgId,
        ...(facilityId
          ? { facility_id: facilityId }
          : { facility_id: { [Op.in]: user.facility_ids || [] } }),
      },
      include: [
        {
          model: InvoiceItem,
          as: "items",
        },

        // 🔥 INSURANCE PROVIDER
        {
          model: InsuranceProvider,
          as: "insuranceProvider",
          attributes: ["id", "name"],
        },

        // 🔥 INSURANCE CLAIM
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

    /* ================= DEBUG: STEP 2 — RESULT SUMMARY ================= */
    debug.log("READ STEP 2: RESULT COUNT", {
      count: invoices.length,
      patientId,
    });

    /* ================= DEBUG: STEP 3 — INVOICE DETAILS ================= */
    for (const inv of invoices) {
      debug.log("READ STEP 3: INVOICE", {
        invoice_id: inv.id,
        payer_type: inv.payer_type,
        insurance_provider_id: inv.insurance_provider_id,
        total: inv.total,
        balance: inv.balance,
      });

      debug.log("READ STEP 3B: CLAIM INFO", {
        invoice_id: inv.id,
        claim_id: inv.insuranceClaim?.id,
        claim_status: inv.insuranceClaim?.status,
        claim_amount: inv.insuranceClaim?.claim_amount,
      });
    }

    /* ================= DEBUG: STEP 4 — COMPLETE ================= */
    debug.log("READ STEP 4: COMPLETE", {
      patientId,
      invoices_returned: invoices.length,
    });

    return invoices;
  },

};
