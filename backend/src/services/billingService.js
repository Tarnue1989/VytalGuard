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

    /* ================= 2️⃣ INSURANCE ================= */
    if (registration?.patient_insurance_id) {
      const pi = await sequelize.models.PatientInsurance.findByPk(
        registration.patient_insurance_id,
        { transaction }
      );

      if (pi) {
        return {
          payer_type: "insurance",

          // 🔥 CRITICAL FIX (THIS WAS MISSING)
          patient_insurance_id: pi.id,

          insurance_provider_id: pi.provider_id,

          coverage_amount: parseFloat(pi.coverage_limit || 0),
          coverage_currency: pi.currency || "LRD",
        };
      }
    }

    /* ================= 3️⃣ CASH FALLBACK ================= */
    return {
      payer_type: entity?.payer_type || "cash",

      // 🔥 keep structure consistent
      patient_insurance_id: null,

      insurance_provider_id: null,
      coverage_amount: 0,
      coverage_currency: entity?.currency || "LRD",
    };
  }


/* ============================================================
   🔥 FINALIZE VISIT BILLING (VISIT-BASED CLAIM) — FINAL FIX
============================================================ */
async function finalizeVisitBilling({
  registration_log_id,
  user,
  transaction,
}) {
  const t = transaction;

  console.log("🔥 [FINALIZE START]", {
    registration_log_id,
    rawUser: user,
  });

  /* ================= SAFE ORG ================= */
  const orgId =
    user.organization_id || user.organizationId || null;

  /* ================= 🔥 FIX: SAFE FACILITY ================= */
  const facilityId =
    user.facility_id ||
    user.facilityId ||
    (Array.isArray(user.facility_ids)
      ? user.facility_ids[0]
      : null);

  console.log("🔥 [ORG RESOLUTION]", {
    resolvedOrgId: orgId,
    resolvedFacilityId: facilityId,
  });

  if (!orgId) {
    throw new Error("finalizeVisitBilling: organization_id missing");
  }

  /* ================= LOAD INVOICE ================= */
  const invoice = await Invoice.findOne({
    where: {
      registration_log_id,
      organization_id: orgId,
      ...(facilityId && { facility_id: facilityId }),
      is_locked: false,
    },
    transaction: t,
    lock: t.LOCK.UPDATE,
  });

  console.log("📄 [INVOICE RESULT]", {
    found: !!invoice,
    invoice_id: invoice?.id,
  });

  if (!invoice) return null;

  /* ================= STATUS UPDATE ================= */
  console.log("🔄 [STATUS UPDATE START]", {
    invoice_id: invoice.id,
  });

  await updateInvoiceStatus(invoice.id, t);

  /* ================= CLAIM ================= */
  if (
    invoice.payer_type === "insurance" &&
    invoice.patient_insurance_id &&
    invoice.insurance_provider_id
  ) {
    console.log("🧾 [CLAIM CHECK]", {
      invoice_id: invoice.id,
    });

    const existing = await InsuranceClaim.findOne({
      where: { invoice_id: invoice.id },
      transaction: t,
    });

    if (!existing) {
      console.log("🚀 [CREATING CLAIM]", {
        invoice_id: invoice.id,
      });

      const claim = await insuranceService.createClaimFromInvoice({
        invoice_id: invoice.id,
        user,
        transaction: t,
      });

      console.log("✅ [CLAIM CREATED]", {
        claim_id: claim?.id,
      });

      invoice.insurance_claim_id = claim.id;
    }
  }

  /* ================= SAVE ================= */
  console.log("💾 [SAVE BEFORE LOCK]", {
    invoice_id: invoice.id,
  });

  await invoice.save({ transaction: t });

  /* ================= LOCK ================= */
  console.log("🔒 [LOCKING INVOICE]", {
    invoice_id: invoice.id,
  });

  await Invoice.update(
    { is_locked: true },
    {
      where: { id: invoice.id },
      transaction: t,
    }
  );

  console.log("✅ [FINALIZE COMPLETE]", {
    invoice_id: invoice.id,
  });

  return invoice;
}
/**
 * billingService – Enterprise-grade auto billing engine
 * 🔒 WRITE-SCOPE ONLY
 * 🔒 Ledger-safe
 * 🔒 FK-driven (feature_module_id ONLY)
 */
export const billingService = {
  finalizeVisitBilling,
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
    console.log("🔥 [TRIGGER START]", {
      module_key,
      entity,
      rawUser: user,
    });

    feature_module_id = await resolveFeatureModuleId({
      feature_module_id,
      module_key,
    });

    if (!entity?.patient_id) {
      console.warn("⚠️ [NO PATIENT ID] Skipping billing");
      return null;
    }

    /* ============================================================
      🔥 FIX: SAFE ORG/FAC (NO RESOLVER)
    ============================================================ */
    const orgId =
      user.organization_id || user.organizationId || null;

    const facilityId =
      user.facility_id || user.facilityId || null;

    console.log("🔥 [ORG RESOLUTION - TRIGGER]", {
      organization_id: user.organization_id,
      organizationId: user.organizationId,
      resolvedOrgId: orgId,
      facility_id: user.facility_id,
      facilityId: user.facilityId,
      resolvedFacilityId: facilityId,
    });

    if (!orgId) {
      console.error("❌ [ORG ERROR - TRIGGER]", {
        user,
      });
      throw new Error("triggerAutoBilling: organization_id missing");
    }

    /* ================= BILLING RULE CHECK ================= */
    const allowed = await shouldTriggerBillingDB({
      feature_module_id,
      status: entity.log_status || entity.status,
      organization_id: orgId,
      facility_id: facilityId,
    });

    console.log("🧭 [TRIGGER CHECK]", {
      allowed,
      status: entity.log_status || entity.status,
      entity_id: entity.id,
    });

    if (!allowed) return null;

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
      console.warn("⚠️ [DUPLICATE BILLING BLOCKED]", {
        entity_id: entity.id,
      });
      return null;
    }

    /* ================= LOAD RULE ================= */
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

    if (!rule || !rule.billableItem) {
      console.warn("⚠️ [NO BILLING RULE]");
      return null;
    }

    /* ================= INSURANCE ================= */
    const insuranceData = await resolveInsuranceFromEntity(
      entity,
      transaction
    );

    console.log("🧾 [INSURANCE DATA]", insuranceData);

    let registrationId = entity?.registration_log_id;

    if (!registrationId && entity?.patient_id) {
      const latestReg = await sequelize.models.RegistrationLog.findOne({
        where: { patient_id: entity.patient_id },
        order: [["created_at", "DESC"]],
        transaction,
      });

      registrationId = latestReg?.id;
    }

    console.log("🔗 [REGISTRATION LINK]", {
      registrationId,
    });

    /* ================= PRICE ================= */
    const { price } = await getBillableItemPrice({
      billable_item_id: rule.billableItem.id,
      payer_type: insuranceData.payer_type,
      currency: entity.currency || "LRD",
      organization_id: orgId,
      facility_id: facilityId,
      transaction,
    });

    console.log("💰 [PRICE RESOLVED]", { price });

    /* ================= FIND INVOICE ================= */
    console.log("🔍 [QUERY INVOICE - TRIGGER]", {
      registrationId,
      orgId,
      facilityId,
    });

    let invoice = await Invoice.findOne({
      where: {
        registration_log_id: registrationId,
        organization_id: orgId,
        facility_id: facilityId,
        is_locked: false,
        payer_type: insuranceData.payer_type,
        insurance_provider_id: insuranceData.insurance_provider_id,
      },
      order: [["created_at", "DESC"]],
      transaction,
    });

    console.log("📄 [INVOICE FOUND - TRIGGER]", {
      found: !!invoice,
      invoice_id: invoice?.id,
    });

    if (invoice && invoice.currency !== (entity.currency || "LRD")) {
      console.warn("⚠️ [CURRENCY MISMATCH → NEW INVOICE]");
      invoice = null;
    }

    /* ================= CREATE INVOICE ================= */
    if (!invoice) {
      console.log("🧾 [CREATING NEW INVOICE]");

      const today = new Date();
      today.setDate(today.getDate() + 30);

      invoice = await Invoice.create(
        {
          patient_id: entity.patient_id,
          registration_log_id: registrationId,
          organization_id: orgId,
          facility_id: facilityId,

          status: INVOICE_STATUS.DRAFT,
          currency: entity.currency || "LRD",

          payer_type: insuranceData.payer_type,
          patient_insurance_id: insuranceData.patient_insurance_id,

          insurance_provider_id: insuranceData.insurance_provider_id,
          coverage_amount: insuranceData.coverage_amount,

          insurance_amount: 0,
          total: 0,
          total_paid: 0,
          balance: 0,

          due_date: today.toISOString().slice(0, 10),
          created_by_id: user?.id || null,
        },
        { transaction }
      );

      console.log("✅ [INVOICE CREATED]", {
        invoice_id: invoice.id,
      });
    }

    /* ================= ITEM CREATION ================= */
    console.log("🧾 [CREATING INVOICE ITEM]");

    const item = await InvoiceItem.create(
      {
        invoice_id: invoice.id,
        billable_item_id: rule.billableItem.id,
        organization_id: orgId,
        facility_id: facilityId,

        description: rule.billableItem.name,
        unit_price: price,
        quantity: 1,

        feature_module_id,
        entity_id: entity.id,
        created_by_id: user?.id || null,
        status: "applied",
      },
      { transaction }
    );

    console.log("✅ [ITEM CREATED]", {
      item_id: item.id,
    });

    await recalcInvoice(invoice.id, transaction);
    await updateInvoiceStatus(invoice.id, transaction);

    console.log("🏁 [TRIGGER COMPLETE]", {
      invoice_id: invoice.id,
    });

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
    let registrationId = order?.registration_log_id;

    if (!registrationId && order?.patient_id) {
      const latestReg = await sequelize.models.RegistrationLog.findOne({
        where: { patient_id: order.patient_id },
        order: [["created_at", "DESC"]],
        transaction,
      });

      registrationId = latestReg?.id;
    }
    /* ============================================================
      🔍 SAFE INVOICE FIND (FIXED)
    ============================================================ */
    let invoice = await Invoice.findOne({
      where: {
        registration_log_id: registrationId,
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
          registration_log_id: registrationId,
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
    let registrationId = labRequest?.registration_log_id;

    if (!registrationId && labRequest?.patient_id) {
      const latestReg = await sequelize.models.RegistrationLog.findOne({
        where: { patient_id: labRequest.patient_id },
        order: [["created_at", "DESC"]],
        transaction,
      });

      registrationId = latestReg?.id;
    }
    /* ============================================================
      🔍 SAFE INVOICE FIND (FIXED)
    ============================================================ */
    let invoice = await Invoice.findOne({
      where: {
        registration_log_id: registrationId,
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
          registration_log_id: registrationId,
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
    let registrationId = prescription?.registration_log_id;

    if (!registrationId && prescription?.patient_id) {
      const latestReg = await sequelize.models.RegistrationLog.findOne({
        where: { patient_id: prescription.patient_id },
        order: [["created_at", "DESC"]],
        transaction,
      });

      registrationId = latestReg?.id;
    }
    /* ============================================================
      🔍 SAFE INVOICE FIND (FIXED)
    ============================================================ */
    let invoice = await Invoice.findOne({
      where: {
        registration_log_id: registrationId,
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
          registration_log_id: registrationId,
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
