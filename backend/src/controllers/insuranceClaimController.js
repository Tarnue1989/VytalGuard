// 📁 controllers/insuranceClaimController.js
import Joi from "joi";
import { Op } from "sequelize";
import {
  sequelize,
  InsuranceClaim,
  Patient,
  InsuranceProvider,
  Invoice,
  User,
  Facility,
  Organization,
} from "../models/index.js";

import { success, error } from "../utils/response.js";
import {
  INSURANCE_CLAIM_STATUS,
  INSURANCE_CLAIM_TRANSITIONS,
} from "../constants/enums.js";

import { authzService } from "../services/authzService.js";
import { auditService } from "../services/auditService.js";
import {
  isSuperAdmin,
  isOrgOwner,
  isFacilityHead,
} from "../utils/role-utils.js";

import { buildQueryOptions } from "../utils/queryHelper.js";
import { normalizeDateRangeLocal } from "../utils/date-utils.js";
import { makeModuleLogger } from "../utils/debugLogger.js";

const MODULE_KEY = "insurance_claims";

/* ============================================================
   🔧 DEBUG
============================================================ */
const DEBUG_OVERRIDE = true;
const debug = makeModuleLogger("insuranceClaimController", DEBUG_OVERRIDE);

/* ============================================================
   🔗 INCLUDES
============================================================ */
const INSURANCE_CLAIM_INCLUDES = [
  { model: Patient, as: "patient", attributes: ["id","first_name","last_name"], required: false },
  { model: InsuranceProvider, as: "provider", attributes: ["id","name"], required: false },
  { model: Invoice, as: "invoice", attributes: ["id"], required: false },
  { model: Organization, as: "organization", attributes: ["id","name","code"], required: false },
  { model: Facility, as: "facility", attributes: ["id","name","code","organization_id"], required: false },
  { model: User, as: "createdBy", attributes: ["id","first_name","last_name"], required: false },
  { model: User, as: "updatedBy", attributes: ["id","first_name","last_name"], required: false },
  { model: User, as: "deletedBy", attributes: ["id","first_name","last_name"], required: false }
];

/* ============================================================
   🔐 STATUS HELPER
============================================================ */
function isValidTransition(from, to) {
  if (from === to) return true;
  return INSURANCE_CLAIM_TRANSITIONS[from]?.[to] === true;
}

/* ============================================================
   📋 JOI SCHEMA
============================================================ */
function buildSchema(isSuper, mode = "create") {
  const base = {
    invoice_id: Joi.string().uuid(),
    patient_id: Joi.string().uuid(),
    provider_id: Joi.string().uuid(),
    claim_number: Joi.string().max(120),
    currency: Joi.string().valid("USD","LRD"),
    amount_claimed: Joi.number().min(0),
    amount_approved: Joi.number().min(0).allow(null),
    amount_paid: Joi.number().min(0).allow(null),
    payment_reference: Joi.string().max(120).allow("",null),
    claim_date: Joi.date().allow(null),
    response_date: Joi.date().allow(null),
    rejection_reason: Joi.string().allow("",null),
    notes: Joi.string().allow("",null)
  };

  if (mode === "create") {
    base.invoice_id = base.invoice_id.required();
    base.patient_id = base.patient_id.required();
    base.provider_id = base.provider_id.required();
    base.claim_number = base.claim_number.required();
    base.amount_claimed = base.amount_claimed.required();
  } else {
    base.status = Joi.string()
      .valid(...Object.values(INSURANCE_CLAIM_STATUS))
      .optional();
    Object.keys(base).forEach(k => (base[k] = base[k].optional()));
  }

  if (isSuper) {
    base.organization_id = Joi.string().uuid().allow(null).optional();
    base.facility_id = Joi.string().uuid().allow(null).optional();
  } else {
    base.facility_id = Joi.string().uuid().allow(null).optional();
  }

  return Joi.object(base);
}

/* ============================================================
   📌 CREATE (UNCHANGED)
============================================================ */
export const createInsuranceClaim = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    debug.log("create → incoming", req.body);

    const allowed = await authzService.checkPermission({
      user: req.user,
      module: MODULE_KEY,
      action: "create",
      res,
    });
    if (!allowed) return;

    const schema = buildSchema(isSuperAdmin(req.user), "create");
    const { error: validationError, value } = schema.validate(req.body, { stripUnknown: true });

    if (validationError) {
      await t.rollback();
      return error(res, "Validation failed", validationError, 400);
    }

    let orgId = null;
    let facilityId = null;

    if (isSuperAdmin(req.user)) {
      orgId = value.organization_id ?? null;
      facilityId = value.facility_id ?? null;
    } else if (isOrgOwner(req.user)) {
      orgId = req.user.organization_id;
      facilityId = value.facility_id ?? null;
    } else if (isFacilityHead(req.user)) {
      orgId = req.user.organization_id;
      facilityId = req.user.facility_id;
    } else {
      orgId = req.user.organization_id;
      facilityId = req.user.facility_id ?? null;
    }

    if (!orgId) {
      await t.rollback();
      return error(res, "Missing organization assignment", null, 400);
    }

    const exists = await InsuranceClaim.findOne({
      where: {
        organization_id: orgId,
        facility_id: facilityId ?? null,
        claim_number: value.claim_number,
      },
      paranoid: false,
      transaction: t,
    });

    if (exists) {
      await t.rollback();
      return error(res, "Claim already exists", null, 400);
    }

    const created = await InsuranceClaim.create(
      {
        ...value,
        organization_id: orgId,
        facility_id: facilityId,
        created_by_id: req.user?.id || null,
      },
      { transaction: t }
    );

    await t.commit();

    const full = await InsuranceClaim.findByPk(created.id, {
      include: INSURANCE_CLAIM_INCLUDES,
    });

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "create",
      entityId: created.id,
      entity: full,
    });

    return success(res, "✅ Insurance claim created", full);
  } catch (err) {
    await t.rollback();
    debug.error("create → FAILED", err);
    return error(res, "❌ Failed to create insurance claim", err);
  }
};

/* ============================================================
   📌 UPDATE (UPGRADED — ENFORCED + FINAL SAFE)
============================================================ */
export const updateInsuranceClaim = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    debug.log("update → incoming", { id: req.params.id, body: req.body });

    const allowed = await authzService.checkPermission({
      user: req.user,
      module: MODULE_KEY,
      action: "update",
      res,
    });
    if (!allowed) return;

    const schema = buildSchema(isSuperAdmin(req.user), "update");
    const { error: validationError, value } = schema.validate(req.body, {
      stripUnknown: true,
    });

    if (validationError) {
      await t.rollback();
      return error(res, "Validation failed", validationError, 400);
    }

    /* ============================================================
       🔒 TENANT-SAFE FETCH (FIXED)
    ============================================================ */
    const where = { id: req.params.id };

    if (!isSuperAdmin(req.user)) {
      where.organization_id = req.user.organization_id;
    }

    const record = await InsuranceClaim.findOne({
      where,
      transaction: t,
    });

    if (!record) {
      await t.rollback();
      return error(res, "❌ Record not found", null, 404);
    }

    let orgId = record.organization_id;
    let facilityId = record.facility_id;

    if (isSuperAdmin(req.user)) {
      if ("organization_id" in value) orgId = value.organization_id;
      if ("facility_id" in value) facilityId = value.facility_id;
    } else if (isOrgOwner(req.user)) {
      orgId = req.user.organization_id;
      if ("facility_id" in value) facilityId = value.facility_id;
    } else if (isFacilityHead(req.user)) {
      orgId = req.user.organization_id;
      facilityId = req.user.facility_id;
    } else {
      orgId = req.user.organization_id;
      facilityId = req.user.facility_id ?? record.facility_id;
    }

    const previousStatus = record.status;

    /* ============================================================
       🔥 STATUS VALIDATION
    ============================================================ */
    if (value.status) {
      const nextStatus = value.status;

      if (!isValidTransition(previousStatus, nextStatus)) {
        await t.rollback();
        return error(
          res,
          `❌ Invalid status transition from ${previousStatus} → ${nextStatus}`,
          null,
          400
        );
      }

      const terminalStates = [
        INSURANCE_CLAIM_STATUS.REJECTED,
        INSURANCE_CLAIM_STATUS.CANCELLED,
        INSURANCE_CLAIM_STATUS.VOIDED,
        INSURANCE_CLAIM_STATUS.REVERSED,
      ];

      if (terminalStates.includes(previousStatus)) {
        await t.rollback();
        return error(
          res,
          `❌ Cannot modify a ${previousStatus} claim`,
          null,
          400
        );
      }
    }

    /* ============================================================
       💰 FINANCIAL VALIDATION (NEW)
    ============================================================ */
    const amountClaimed =
      value.amount_claimed ?? record.amount_claimed;
    const amountApproved =
      value.amount_approved ?? record.amount_approved;
    const amountPaid =
      value.amount_paid ?? record.amount_paid;

    if (
      amountApproved !== null &&
      amountClaimed !== null &&
      amountApproved > amountClaimed
    ) {
      await t.rollback();
      return error(
        res,
        "❌ Approved amount cannot exceed claimed amount",
        null,
        400
      );
    }

    if (
      amountPaid !== null &&
      amountApproved !== null &&
      amountPaid > amountApproved
    ) {
      await t.rollback();
      return error(
        res,
        "❌ Paid amount cannot exceed approved amount",
        null,
        400
      );
    }

    /* ============================================================
       ⏱️ STATUS TIMESTAMPS
    ============================================================ */
    const statusTimestamps = {
      ...(value.status === INSURANCE_CLAIM_STATUS.IN_REVIEW && {
        reviewed_at: new Date(),
      }),
      ...(value.status === INSURANCE_CLAIM_STATUS.APPROVED && {
        approved_at: new Date(),
      }),
      ...(value.status === INSURANCE_CLAIM_STATUS.PAID && {
        paid_at: new Date(),
      }),
    };

    /* ============================================================
       💾 UPDATE
    ============================================================ */
    await record.update(
      {
        ...value,
        ...statusTimestamps,
        organization_id: orgId,
        facility_id: facilityId,
        updated_by_id: req.user?.id || null,
      },
      { transaction: t }
    );

    await t.commit();

    const full = await InsuranceClaim.findByPk(record.id, {
      include: INSURANCE_CLAIM_INCLUDES,
    });

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "update",
      entityId: record.id,
      entity: full,
    });

    return success(res, "✅ Insurance claim updated", full);
  } catch (err) {
    await t.rollback();
    debug.error("update → FAILED", err);
    return error(res, "❌ Failed to update insurance claim", err);
  }
};
/* ============================================================
   📌 GET ALL INSURANCE CLAIMS (MASTER PARITY + SUMMARY)
============================================================ */
export const getAllInsuranceClaims = async (req, res) => {
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module: MODULE_KEY,
      action: "read",
      res,
    });
    if (!allowed) return;

    debug.log("list → raw query", req.query);

    const options = buildQueryOptions(req, "created_at", "DESC");

    delete options.filters?.dateRange;
    delete options.filters?.light;

    options.where = { [Op.and]: [] };

    const dateRange = normalizeDateRangeLocal(req.query.dateRange);
    if (dateRange) {
      options.where[Op.and].push({
        created_at: {
          [Op.between]: [dateRange.start, dateRange.end],
        },
      });
    }

    if (!isSuperAdmin(req.user)) {
      options.where[Op.and].push({
        organization_id: req.user.organization_id,
      });

      if (!isOrgOwner(req.user)) {
        options.where[Op.and].push({
          [Op.or]: [
            { facility_id: null },
            { facility_id: req.user.facility_id },
          ],
        });
      }
    } else {
      if (req.query.organization_id) {
        options.where[Op.and].push({
          organization_id: req.query.organization_id,
        });
      }
      if (req.query.facility_id) {
        options.where[Op.and].push({
          facility_id: req.query.facility_id,
        });
      }
    }

    if (options.search) {
      options.where[Op.and].push({
        [Op.or]: [
          { claim_number: { [Op.iLike]: `%${options.search}%` } },
        ],
      });
    }

    if (req.query.patient_id) {
      options.where[Op.and].push({
        patient_id: req.query.patient_id,
      });
    }

    if (req.query.provider_id) {
      options.where[Op.and].push({
        provider_id: req.query.provider_id,
      });
    }

    if (req.query.invoice_id) {
      options.where[Op.and].push({
        invoice_id: req.query.invoice_id,
      });
    }

    if (
      req.query.status &&
      Object.values(INSURANCE_CLAIM_STATUS).includes(req.query.status)
    ) {
      options.where[Op.and].push({
        status: req.query.status,
      });
    }

    /* ================= CURRENCY (FIX ADDED) ================= */
    if (req.query.currency) {
      options.where[Op.and].push({
        currency: req.query.currency,
      });
    }

    const { count, rows } = await InsuranceClaim.findAndCountAll({
      where: options.where,
      include: INSURANCE_CLAIM_INCLUDES,
      order: options.order,
      offset: options.offset,
      limit: options.limit,
    });

    /* ============================================================
       🔥 ENUM-DRIVEN SUMMARY (NO HARDCODE)
    ============================================================ */
    const summary = Object.values(INSURANCE_CLAIM_STATUS).reduce(
      (acc, status) => {
        acc[status] = rows.filter(r => r.status === status).length;
        return acc;
      },
      { total: count }
    );

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "list",
      details: {
        returned: count,
        query: req.query,
        dateRange: dateRange || null,
      },
    });

    return success(res, "✅ Insurance claims loaded", {
      records: rows,
      summary,
      pagination: {
        total: count,
        page: options.pagination.page,
        pageCount: Math.ceil(count / options.pagination.limit),
      },
    });
  } catch (err) {
    debug.error("list → FAILED", err);
    return error(res, "❌ Failed to load insurance claims", err);
  }
};

/* ============================================================
   📌 GET BY ID (UNCHANGED — ALREADY PERFECT)
============================================================ */
export const getInsuranceClaimById = async (req, res) => {
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module: MODULE_KEY,
      action: "read",
      res,
    });
    if (!allowed) return;

    const { id } = req.params;
    const where = { id };

    if (!isSuperAdmin(req.user)) {
      where.organization_id = req.user.organization_id;

      if (isFacilityHead(req.user)) {
        where.facility_id = req.user.facility_id;
      }
    } else {
      if (req.query.organization_id)
        where.organization_id = req.query.organization_id;
      if (req.query.facility_id)
        where.facility_id = req.query.facility_id;
    }

    const found = await InsuranceClaim.findOne({
      where,
      include: INSURANCE_CLAIM_INCLUDES,
    });

    if (!found) return error(res, "❌ Record not found", null, 404);

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "view",
      entityId: id,
      entity: found,
    });

    return success(res, "✅ Insurance claim loaded", found);
  } catch (err) {
    debug.error("view → FAILED", err);
    return error(res, "❌ Failed to load insurance claim", err);
  }
};


/* ============================================================
   📌 GET LITE (UNCHANGED — GOOD)
============================================================ */
export const getAllInsuranceClaimsLite = async (req, res) => {
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module: MODULE_KEY,
      action: "read",
      res,
    });
    if (!allowed) return;

    const { q, patient_id, provider_id } = req.query;

    const where = { [Op.and]: [] };

    /* ================= TENANT ================= */
    if (!isSuperAdmin(req.user)) {
      where.organization_id = req.user.organization_id;
    }

    /* ================= FILTERS ================= */
    if (patient_id) where.patient_id = patient_id;
    if (provider_id) where.provider_id = provider_id;

    /* ================= SEARCH ================= */
    if (q) {
      where[Op.and].push({
        claim_number: { [Op.iLike]: `%${q}%` },
      });
    }

    /* ================= QUERY ================= */
    const records = await InsuranceClaim.findAll({
      where,
      attributes: ["id", "claim_number"],
      order: [["created_at", "DESC"]],
      limit: 50,
    });

    /* ================= FORMAT (FIXED) ================= */
    const result = records.map((r) => ({
      id: r.id,
      label: r.claim_number, // ✅ CRITICAL FIX (for suggestion input)
      claim_number: r.claim_number,
    }));

    /* ================= AUDIT ================= */
    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "list_lite",
      details: {
        count: result.length,
        q: q || null,
        patient_id: patient_id || null,
        provider_id: provider_id || null,
      },
    });

    return success(res, "✅ Insurance claims loaded (lite)", {
      records: result,
    });
  } catch (err) {
    debug.error("list_lite → FAILED", err);
    return error(res, "❌ Failed to load insurance claims (lite)", err);
  }
};
/* ============================================================
   📌 DELETE INSURANCE CLAIM
   (MASTER-PARITY, SAFE SOFT DELETE + AUDIT + STATUS PROTECTION)
============================================================ */
export const deleteInsuranceClaim = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    debug.log("delete → incoming", {
      id: req.params.id,
      query: req.query,
    });

    const allowed = await authzService.checkPermission({
      user: req.user,
      module: MODULE_KEY,
      action: "delete",
      res,
    });
    if (!allowed) return;

    const { id } = req.params;
    const where = { id };

    if (!isSuperAdmin(req.user)) {
      where.organization_id = req.user.organization_id;

      if (isFacilityHead(req.user)) {
        where.facility_id = req.user.facility_id;
      }
    } else {
      if (req.query.organization_id) {
        where.organization_id = req.query.organization_id;
      }
      if (req.query.facility_id) {
        where.facility_id = req.query.facility_id;
      }
    }

    const record = await InsuranceClaim.findOne({
      where,
      transaction: t,
    });

    if (!record) {
      await t.rollback();
      return error(res, "❌ Record not found", null, 404);
    }

    /* ============================================================
       🔒 STATUS PROTECTION (ENTERPRISE RULE)
    ============================================================ */
    const protectedStates = [
      INSURANCE_CLAIM_STATUS.APPROVED,
      INSURANCE_CLAIM_STATUS.PARTIALLY_APPROVED,
      INSURANCE_CLAIM_STATUS.PROCESSING_PAYMENT,
      INSURANCE_CLAIM_STATUS.PAID,
    ];

    if (protectedStates.includes(record.status)) {
      await t.rollback();
      return error(
        res,
        `❌ Cannot delete a ${record.status} claim`,
        null,
        400
      );
    }

    /* ============================================================
       🧾 SOFT DELETE (AUDIT SAFE)
    ============================================================ */
    await record.update(
      {
        deleted_by_id: req.user?.id || null,
        status: INSURANCE_CLAIM_STATUS.CANCELLED, // optional but recommended
      },
      { transaction: t }
    );

    await record.destroy({ transaction: t });

    await t.commit();

    const full = await InsuranceClaim.findOne({
      where: { id },
      include: INSURANCE_CLAIM_INCLUDES,
      paranoid: false,
    });

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "delete",
      entityId: id,
      entity: full,
    });

    return success(res, "✅ Insurance claim deleted", full);
  } catch (err) {
    await t.rollback();
    debug.error("delete → FAILED", err);
    return error(res, "❌ Failed to delete insurance claim", err);
  }
};

/* ============================================================
   📌 UNIVERSAL STATUS ENGINE
============================================================ */
async function updateClaimStatus(req, res, targetStatus) {
  const t = await sequelize.transaction();
  try {
    const { id } = req.params;

    const allowed = await authzService.checkPermission({
      user: req.user,
      module: MODULE_KEY,
      action: "update",
      res,
    });
    if (!allowed) return;

    const where = { id };

    if (!isSuperAdmin(req.user)) {
      where.organization_id = req.user.organization_id;
    }

    const record = await InsuranceClaim.findOne({
      where,
      transaction: t,
    });

    if (!record) {
      await t.rollback();
      return error(res, "❌ Record not found", null, 404);
    }

    const previousStatus = record.status;

    /* ================= TRANSITION CHECK ================= */
    if (!INSURANCE_CLAIM_TRANSITIONS[previousStatus]?.[targetStatus]) {
      await t.rollback();
      return error(
        res,
        `❌ Invalid transition ${previousStatus} → ${targetStatus}`,
        null,
        400
      );
    }

    /* ================= TERMINAL PROTECTION ================= */
    const terminalStates = [
      INSURANCE_CLAIM_STATUS.REJECTED,
      INSURANCE_CLAIM_STATUS.CANCELLED,
      INSURANCE_CLAIM_STATUS.VOIDED,
      INSURANCE_CLAIM_STATUS.REVERSED,
    ];

    if (terminalStates.includes(previousStatus)) {
      await t.rollback();
      return error(
        res,
        `❌ Cannot modify a ${previousStatus} claim`,
        null,
        400
      );
    }

    /* ================= TIMESTAMPS ================= */
    const timestamps = {
      ...(targetStatus === INSURANCE_CLAIM_STATUS.IN_REVIEW && { reviewed_at: new Date() }),
      ...(targetStatus === INSURANCE_CLAIM_STATUS.APPROVED && { approved_at: new Date() }),
      ...(targetStatus === INSURANCE_CLAIM_STATUS.PAID && { paid_at: new Date() }),
    };

    await record.update(
      {
        status: targetStatus,
        ...timestamps,
        updated_by_id: req.user.id,
      },
      { transaction: t }
    );

    await t.commit();

    const full = await InsuranceClaim.findByPk(id, {
      include: INSURANCE_CLAIM_INCLUDES,
    });

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "status_update",
      entityId: id,
      entity: full,
      details: {
        from: previousStatus,
        to: targetStatus,
      },
    });

    return success(res, `✅ Status updated to ${targetStatus}`, full);
  } catch (err) {
    await t.rollback();
    return error(res, "❌ Failed to update status", err);
  }
}


/* ============================================================
   📌 ACTIONS (1–8)
============================================================ */

// 1️⃣ DRAFT → SUBMITTED
export const submitInsuranceClaim = (req, res) =>
  updateClaimStatus(req, res, INSURANCE_CLAIM_STATUS.SUBMITTED);

// 2️⃣ SUBMITTED → IN_REVIEW
export const reviewInsuranceClaim = (req, res) =>
  updateClaimStatus(req, res, INSURANCE_CLAIM_STATUS.IN_REVIEW);

// 3️⃣ IN_REVIEW → APPROVED
export const approveInsuranceClaim = (req, res) =>
  updateClaimStatus(req, res, INSURANCE_CLAIM_STATUS.APPROVED);

// 4️⃣ IN_REVIEW → PARTIAL
export const partialApproveInsuranceClaim = (req, res) =>
  updateClaimStatus(req, res, INSURANCE_CLAIM_STATUS.PARTIALLY_APPROVED);

// 5️⃣ IN_REVIEW → REJECTED
export const rejectInsuranceClaim = (req, res) =>
  updateClaimStatus(req, res, INSURANCE_CLAIM_STATUS.REJECTED);

// 6️⃣ APPROVED → PROCESSING PAYMENT
export const processInsuranceClaimPayment = (req, res) =>
  updateClaimStatus(req, res, INSURANCE_CLAIM_STATUS.PROCESSING_PAYMENT);

// 7️⃣ PROCESSING → PAID
export const markInsuranceClaimPaid = (req, res) =>
  updateClaimStatus(req, res, INSURANCE_CLAIM_STATUS.PAID);

// 8️⃣ PAID → REVERSED
export const reverseInsuranceClaimPayment = (req, res) =>
  updateClaimStatus(req, res, INSURANCE_CLAIM_STATUS.REVERSED);