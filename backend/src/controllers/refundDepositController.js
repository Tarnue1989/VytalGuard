// 📁 backend/src/controllers/refundDepositController.js
// ============================================================================
// 🔹 ENTERPRISE-GRADE DEPOSIT REFUND CONTROLLER
// Lifecycle:
// pending → review → approved → processed → reversed → restored
//          ↘ rejected → restored
//          ↘ cancelled → restored
//          ↘ voided → restored
// 🔹 Full audit trail, tenant scoping, Joi validation, summary engine
// 🔹 Mirrors refundController.js structure for consistency
// ============================================================================

import Joi from "joi";
import { Op } from "sequelize";

import {
  sequelize,
  RefundDeposit,
  Deposit,
  Patient,
  Organization,
  Facility,
  User
} from "../models/index.js";

import { success, error } from "../utils/response.js";
import { authzService } from "../services/authzService.js";
import { auditService } from "../services/auditService.js";
import { refundDepositService } from "../services/refundDepositService.js";

import { FIELD_VISIBILITY_REFUND_DEPOSIT } from "../constants/fieldVisibility.js";
import { buildQueryOptions } from "../utils/queryHelper.js";
import { buildDynamicSummary } from "../utils/summaryHelper.js";
import {
  DEPOSIT_REFUND_STATUS
} from "../constants/enums.js";

const MODULE_KEY = "refund_deposit";

// 🔖 Local enum map
const RS = DEPOSIT_REFUND_STATUS;


/* ============================================================
   🔧 Helpers
============================================================ */
function isSuperAdmin(user) {
  if (!user) return false;
  const roles = Array.isArray(user.roleNames) ? user.roleNames : [user.role || ""];
  return roles.map((r) => r.toLowerCase()).includes("superadmin");
}

/* ============================================================
   🔗 Includes
============================================================ */
const REFUND_DEPOSIT_INCLUDES = [
  // 🔹 Deposit Info
  {
    model: Deposit,
    as: "deposit",
    attributes: [
      "id",
      "amount",
      "remaining_balance",
      "transaction_ref"
    ]
  },

  // 🔹 Patient Info
  {
    model: Patient,
    as: "patient",
    attributes: [
      "id",
      "pat_no",
      "first_name",
      "last_name"
    ]
  },

  // 🔹 Org & Facility
  { model: Organization, as: "organization", attributes: ["id", "name"] },
  { model: Facility, as: "facility", attributes: ["id", "name"] },

  // 🔹 Audit Trail Users (Full Lifecycle)
  { model: User, as: "createdBy", attributes: ["id", "first_name", "last_name"] },
  { model: User, as: "updatedBy", attributes: ["id", "first_name", "last_name"] },
  { model: User, as: "deletedBy", attributes: ["id", "first_name", "last_name"] },

  { model: User, as: "approvedBy", attributes: ["id", "first_name", "last_name"] },
  { model: User, as: "processedBy", attributes: ["id", "first_name", "last_name"] },
  { model: User, as: "reversedBy", attributes: ["id", "first_name", "last_name"] },

  { model: User, as: "rejectedBy", attributes: ["id", "first_name", "last_name"] },
  { model: User, as: "cancelledBy", attributes: ["id", "first_name", "last_name"] },
  { model: User, as: "voidedBy", attributes: ["id", "first_name", "last_name"] },
  { model: User, as: "restoredBy", attributes: ["id", "first_name", "last_name"] },
];


/* ============================================================
   📋 Joi Schema (Enterprise Grade)
============================================================ */
function buildRefundDepositSchema(mode = "create") {
  const base = {
    deposit_id: Joi.string().uuid().required(),
    refund_amount: Joi.number().positive().required(),
    method: Joi.string()
      .valid("cash", "card", "bank_transfer", "mobile_money", "cheque")
      .required(),
    reason: Joi.string().min(3).required(),

    // forbidden – system controlled
    status: Joi.forbidden(),
    created_by_id: Joi.forbidden(),
    approved_by_id: Joi.forbidden(),
    processed_by_id: Joi.forbidden(),
    reversed_by_id: Joi.forbidden(),
    deleted_by_id: Joi.forbidden(),
  };

  if (mode === "update") {
    Object.keys(base).forEach((k) => (base[k] = base[k].optional()));
    base.reason = Joi.string().min(3).optional();
  }

  return Joi.object(base);
}

/* ============================================================
   📌 CREATE Deposit Refund → (status: pending)
============================================================ */
export const createRefundDeposit = async (req, res) => {
  const t = await sequelize.transaction();

  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module: MODULE_KEY,
      action: "create",
      res,
    });
    if (!allowed) return;

    const schema = buildRefundDepositSchema("create");
    const { error: validationError, value } = schema.validate(req.body, {
      stripUnknown: true,
    });

    if (validationError) {
      await t.rollback();
      return error(res, "Validation failed", validationError, 400);
    }

    // ⭐ FIXED: Correct service function name + correct argument names
    const result = await refundDepositService.createRefund({
      deposit_id: value.deposit_id,
      amount: value.refund_amount,
      method: value.method,
      reason: value.reason,
      user: req.user
    });

    await t.commit();

    const full = await RefundDeposit.findOne({
      where: { id: result.refund.id },
      include: REFUND_DEPOSIT_INCLUDES,
    });

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "create",
      entityId: result.refund.id,
      entity: full,
      details: value,
    });

    return success(res, "✅ Deposit refund created (pending)", full);

  } catch (err) {
    if (!t.finished) await t.rollback();
    return error(res, "❌ Failed to create deposit refund", err);
  }
};

/* ============================================================
   📌 UPDATE Deposit Refund (only pending allowed)
============================================================ */
export const updateRefundDeposit = async (req, res) => {
  const t = await sequelize.transaction();

  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module: MODULE_KEY,
      action: "update",
      res,
    });
    if (!allowed) return;

    const record = await RefundDeposit.findByPk(req.params.id, {
      include: REFUND_DEPOSIT_INCLUDES,
      transaction: t,
    });

    if (!record) {
      await t.rollback();
      return error(res, "❌ Deposit refund not found", null, 404);
    }

    if (record.status !== RS.PENDING) {
      await t.rollback();
      return error(res, "❌ Only pending refunds can be updated", null, 400);
    }

    const schema = buildRefundDepositSchema("update");
    const { error: validationError, value } = schema.validate(req.body, {
      stripUnknown: true,
    });

    if (validationError) {
      await t.rollback();
      return error(res, "Validation failed", validationError, 400);
    }

    await record.update(
      {
        refund_amount: value.refund_amount ?? record.refund_amount,
        method: value.method?.toLowerCase() ?? record.method,
        reason: value.reason ?? record.reason,
        updated_by_id: req.user.id,
      },
      { transaction: t }
    );

    await t.commit();

    const full = await RefundDeposit.findOne({
      where: { id: record.id },
      include: REFUND_DEPOSIT_INCLUDES,
    });

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "update",
      entityId: record.id,
      entity: full,
      details: value,
    });

    return success(res, "✅ Deposit refund updated", full);

  } catch (err) {
    if (!t.finished) await t.rollback();
    return error(res, "❌ Failed to update deposit refund", err);
  }
};

/* ============================================================
   📌 APPROVE Deposit Refund (pending → approved)
============================================================ */
export const approveRefundDeposit = async (req, res) => {
  try {
    const result = await refundDepositService.approveRefund({
      refund_id: req.params.id,
      user: req.user,
    });

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "approve",
      entityId: req.params.id,
      entity: result.refund,
    });

    return success(res, "✅ Deposit refund approved", result);
  } catch (err) {
    return error(res, "❌ Failed to approve deposit refund", err);
  }
};

/* ============================================================
   📌 PROCESS Deposit Refund (approved → processed)
============================================================ */
export const processRefundDeposit = async (req, res) => {
  try {
    const result = await refundDepositService.processRefund({
      refund_id: req.params.id,
      user: req.user,
    });

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "process",
      entityId: req.params.id,
      entity: result.refund,
      details: result.deposit,
    });

    return success(res, "✅ Deposit refund processed", result);
  } catch (err) {
    return error(res, "❌ Failed to process deposit refund", err);
  }
};

/* ============================================================
   📌 VOID Deposit Refund (pending/approved → voided)
============================================================ */
export const voidRefundDeposit = async (req, res) => {
  try {
    const result = await refundDepositService.voidRefund({
      refund_id: req.params.id,
      user: req.user,
      reason: req.body?.reason || "manual void"
    });

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "void",
      entityId: req.params.id,
      entity: result.refund,
    });

    return success(res, "✅ Deposit refund voided", result.refund);

  } catch (err) {
    return error(res, "❌ Failed to void deposit refund", err);
  }
};


/* ============================================================
   📌 REVERSE Deposit Refund (processed → reversed)
============================================================ */
export const reverseRefundDeposit = async (req, res) => {
  try {
    const result = await refundDepositService.reverseRefund({
      refund_id: req.params.id,
      user: req.user,
      reason: req.body?.reason || "manual reversal",
    });

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "reverse",
      entityId: req.params.id,
      entity: result.refund,
    });

    return success(res, "✅ Deposit refund reversed", result);
  } catch (err) {
    return error(res, "❌ Failed to reverse deposit refund", err);
  }
};

/* ============================================================
   📌 RESTORE Deposit Refund (voided → pending)
============================================================ */
export const restoreRefundDeposit = async (req, res) => {
  try {
    const result = await refundDepositService.restoreRefund({
      refund_id: req.params.id,
      user: req.user,
    });

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "restore",
      entityId: req.params.id,
      entity: result.refund,
    });

    return success(res, "✅ Deposit refund restored", result.refund);
  } catch (err) {
    return error(res, "❌ Failed to restore deposit refund", err);
  }
};

/* ============================================================
   📌 GET ALL Deposit Refunds (Paginated + Summary)
   — Enterprise Master Pattern
============================================================ */
export const getAllRefundDeposits = async (req, res) => {
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module: MODULE_KEY,
      action: "read",
      res,
    });
    if (!allowed) return;

    // role context & visible fields
    const role = (req.user?.roleNames?.[0] || "staff").toLowerCase();
    const visibleFields =
      FIELD_VISIBILITY_REFUND_DEPOSIT[role] ||
      FIELD_VISIBILITY_REFUND_DEPOSIT.staff;

    const options = buildQueryOptions(
      req,
      "created_at",
      "DESC",
      visibleFields
    );

    options.where = options.where || {};

    /* ============================================================
       📅 Date Range Filtering
    ============================================================ */
    if (req.query.created_from || req.query.created_to) {
      const range = {};
      if (req.query.created_from)
        range[Op.gte] = new Date(req.query.created_from);

      if (req.query.created_to) {
        const end = new Date(req.query.created_to);
        end.setDate(end.getDate() + 1); // inclusive end date
        range[Op.lt] = end;
      }
      options.where.created_at = range;
    }

    /* ============================================================
       🏢 Tenant Scoping
    ============================================================ */
    if (!isSuperAdmin(req.user)) {
      options.where.organization_id = req.user.organization_id;

      if (role === "facility_head") {
        options.where.facility_id = req.user.facility_id;
      }
    } else {
      // allow superadmin filtering
      if (req.query.organization_id)
        options.where.organization_id = req.query.organization_id;
      if (req.query.facility_id)
        options.where.facility_id = req.query.facility_id;
    }

    /* ============================================================
       🎯 Additional Filters
    ============================================================ */
    if (req.query.deposit_id) options.where.deposit_id = req.query.deposit_id;
    if (req.query.patient_id) options.where.patient_id = req.query.patient_id;
    if (req.query.status) options.where.status = req.query.status;
    if (req.query.method) options.where.method = req.query.method;

    /* ============================================================
       🔍 Search (Reason / Status / Patient / Method)
    ============================================================ */
    if (options.search) {
      const term = `%${options.search}%`;

      options.where[Op.or] = [
        { reason: { [Op.iLike]: term } },
        { status: { [Op.iLike]: term } },
        { method: { [Op.iLike]: term } },
        { "$patient.first_name$": { [Op.iLike]: term } },
        { "$patient.last_name$": { [Op.iLike]: term } },
        { "$patient.pat_no$": { [Op.iLike]: term } },
      ];
    }

    /* ============================================================
       📦 Execute Paginated Query
    ============================================================ */
    const { count, rows } = await RefundDeposit.findAndCountAll({
      where: options.where,
      include: REFUND_DEPOSIT_INCLUDES,
      order: options.order,
      offset: options.offset,
      limit: options.limit,
      distinct: true,
    });

    /* ============================================================
       🧠 Build Summary Report (Lifecycle + Totals + Gender)
    ============================================================ */
    let summary = {};
    try {
      summary = await buildDynamicSummary({
        model: RefundDeposit,
        options,
        statusEnums: DEPOSIT_REFUND_STATUS,
        includeGender: true,
        genderJoin: { model: Patient, as: "patient" },
      });
    } catch (err) {
      console.warn("⚠️ Deposit refund summary failed:", err.message);
      summary = {};
    }

    /* ============================================================
       🧾 Audit
    ============================================================ */
    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "list",
      details: { query: req.query, returned: count },
    });

    /* ============================================================
       ✅ Final Response
    ============================================================ */
    return success(res, "✅ Deposit refunds loaded", {
      records: rows,
      pagination: {
        total: count,
        page: options.pagination.page,
        pageCount: Math.ceil(count / options.pagination.limit),
      },
      summary,
    });
  } catch (err) {
    return error(res, "❌ Failed to load deposit refunds", err);
  }
};

/* ============================================================
   📌 GET Deposit Refund by ID
============================================================ */
export const getRefundDepositById = async (req, res) => {
  try {
    const where = { id: req.params.id };
    const role = (req.user?.roleNames?.[0] || "staff").toLowerCase();

    // tenant scoping
    if (!isSuperAdmin(req.user)) {
      where.organization_id = req.user.organization_id;
      if (role === "facility_head") where.facility_id = req.user.facility_id;
    }

    const record = await RefundDeposit.findOne({
      where,
      include: REFUND_DEPOSIT_INCLUDES,
    });

    if (!record) return error(res, "❌ Deposit refund not found", null, 404);

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "view",
      entityId: record.id,
      entity: record,
    });

    return success(res, "✅ Deposit refund loaded", record);
  } catch (err) {
    return error(res, "❌ Failed to load deposit refund", err);
  }
};

/* ============================================================
   📌 DELETE Deposit Refund (soft delete)
============================================================ */
export const deleteRefundDeposit = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const record = await RefundDeposit.findByPk(req.params.id, {
      transaction: t,
    });

    if (!record) {
      await t.rollback();
      return error(res, "❌ Deposit refund not found", null, 404);
    }

    await record.update(
      { deleted_by_id: req.user.id },
      { transaction: t }
    );

    await record.destroy({ transaction: t });
    await t.commit();

    const full = await RefundDeposit.findOne({
      where: { id: req.params.id },
      include: REFUND_DEPOSIT_INCLUDES,
      paranoid: false,
    });

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "delete",
      entityId: full.id,
      entity: full,
    });

    return success(res, "✅ Deposit refund deleted", full);
  } catch (err) {
    await t.rollback();
    return error(res, "❌ Failed to delete deposit refund", err);
  }
};

/* ============================================================
   📌 GET Deposit Refunds (LITE)
   — Used for dropdowns and autocomplete
============================================================ */
export const getAllRefundDepositsLite = async (req, res) => {
  try {
    const role = (req.user?.roleNames?.[0] || "staff").toLowerCase();
    const where = {};

    // tenant scoping
    if (!isSuperAdmin(req.user)) {
      where.organization_id = req.user.organization_id;
      if (role === "facility_head") where.facility_id = req.user.facility_id;
    }

    // keyword search
    if (req.query.q) {
      const term = `%${req.query.q}%`;
      where[Op.or] = [
        { reason: { [Op.iLike]: term } },
        { status: { [Op.iLike]: term } },
      ];
    }

    const rows = await RefundDeposit.findAll({
      where,
      include: [
        { model: Deposit, as: "deposit", attributes: ["id"] },
        { model: Patient, as: "patient", attributes: ["pat_no", "first_name", "last_name"] },
      ],
      order: [["created_at", "DESC"]],
      limit: 20,
    });

    const mapped = rows.map((r) => ({
      id: r.id,
      refund_amount: r.refund_amount,
      method: r.method,
      status: r.status,
      patient: r.patient
        ? `${r.patient.pat_no} - ${r.patient.first_name} ${r.patient.last_name}`
        : "",
      created_at: r.created_at,
    }));

    return success(res, "✅ Deposit refunds loaded (lite)", { records: mapped });
  } catch (err) {
    return error(res, "❌ Failed to load deposit refunds (lite)", err);
  }
};

/* ============================================================
   📌 REVIEW Deposit Refund (pending → review)
============================================================ */
export const reviewRefundDeposit = async (req, res) => {
  try {
    const result = await refundDepositService.reviewRefund(
      req.params.id,
      req.user
    );

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "review",
      entityId: req.params.id,
      entity: result.refund,
    });

    return success(res, "✅ Deposit refund moved to review", result.refund);
  } catch (err) {
    return error(res, "❌ Failed to review deposit refund", err);
  }
};

/* ============================================================
   📌 REJECT Deposit Refund (pending/review → rejected)
   — Requires reason
============================================================ */
export const rejectRefundDeposit = async (req, res) => {
  try {
    const reason = req.body?.reason;
    if (!reason || reason.trim().length < 2) {
      return error(res, "❌ Reason is required to reject this refund", null, 400);
    }

    const result = await refundDepositService.rejectRefund(
      req.params.id,
      req.user,
      reason
    );

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "reject",
      entityId: req.params.id,
      entity: result.refund,
      details: { reason }
    });

    return success(res, "❌ Deposit refund rejected", result.refund);

  } catch (err) {
    return error(res, "❌ Failed to reject deposit refund", err);
  }
};


/* ============================================================
   📌 CANCEL Deposit Refund (pending/approved → cancelled)
   — Requires reason
============================================================ */
export const cancelRefundDeposit = async (req, res) => {
  try {
    const reason = req.body?.reason;
    if (!reason || reason.trim().length < 2) {
      return error(res, "❌ Reason is required to cancel this refund", null, 400);
    }

    const result = await refundDepositService.cancelRefund(
      req.params.id,
      req.user,
      reason
    );

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "cancel",
      entityId: req.params.id,
      entity: result.refund,
      details: { reason }
    });

    return success(res, "🚫 Deposit refund cancelled", result.refund);

  } catch (err) {
    return error(res, "❌ Failed to cancel deposit refund", err);
  }
};
