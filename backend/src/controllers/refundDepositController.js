// 📁 backend/src/controllers/refundDepositController.js
// ============================================================================
// 🔹 ENTERPRISE-GRADE DEPOSIT REFUND CONTROLLER (MASTER-ALIGNED CORE)
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
  User,
} from "../models/index.js";

import { success, error } from "../utils/response.js";
import { buildQueryOptions } from "../utils/queryHelper.js";
import { validatePaginationStrict } from "../utils/query-utils.js";
import { normalizeDateRangeLocal } from "../utils/date-utils.js";
import { resolveOrgFacility } from "../utils/resolveOrgFacility.js";
import {
  isSuperAdmin,
  isFacilityHead,
} from "../utils/role-utils.js";
import { makeModuleLogger } from "../utils/debugLogger.js";

import { authzService } from "../services/authzService.js";
import { auditService } from "../services/auditService.js";
import { refundDepositService } from "../services/refundDepositService.js";

import { FIELD_VISIBILITY_REFUND_DEPOSIT } from "../constants/fieldVisibility.js";
import { DEPOSIT_REFUND_STATUS } from "../constants/enums.js";

/* ============================================================
   🔐 MODULE
============================================================ */
const MODULE_KEY = "refund_deposit";

/* ============================================================
   🔧 LOCAL DEBUG OVERRIDE
============================================================ */
const DEBUG_OVERRIDE = false;
const debug = makeModuleLogger("refundDepositController", DEBUG_OVERRIDE);

/* ============================================================
   🔖 STATUS MAP (ENUM-SAFE, MASTER STYLE)
============================================================ */
const RS = DEPOSIT_REFUND_STATUS;

/* ============================================================
   🔗 SHARED INCLUDES (MASTER PARITY)
============================================================ */
const REFUND_DEPOSIT_INCLUDES = [
  {
    model: Deposit,
    as: "deposit",
    attributes: [
      "id",
      "amount",
      "remaining_balance",
      "transaction_ref",
      "status",
    ],
  },
  {
    model: Patient,
    as: "patient",
    attributes: ["id", "pat_no", "first_name", "last_name"],
  },
  {
    model: Organization,
    as: "organization",
    attributes: ["id", "name", "code"],
  },
  {
    model: Facility,
    as: "facility",
    attributes: ["id", "name", "code", "organization_id"],
  },
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
   📋 Joi Schema (MASTER-ALIGNED, ROLE-AWARE, SERVICE-CONTROLLED)
============================================================ */
function buildRefundDepositSchema(userRole, mode = "create") {
  const base = {
    deposit_id: Joi.string().uuid().required(),
    refund_amount: Joi.number().positive().required(),
    method: Joi.string()
      .valid("cash", "card", "bank_transfer", "mobile_money", "cheque")
      .required(),
    reason: Joi.string().min(3).required(),

    // 🔒 lifecycle / audit fields (service controlled)
    status: Joi.forbidden(),
    created_by_id: Joi.forbidden(),
    approved_by_id: Joi.forbidden(),
    processed_by_id: Joi.forbidden(),
    reversed_by_id: Joi.forbidden(),
    deleted_by_id: Joi.forbidden(),
  };

  if (mode === "update") {
    Object.keys(base).forEach((k) => (base[k] = base[k].optional()));
    base.reason = Joi.string().min(3).required();
  }

  // ✅ SUPER ADMIN → org + facility allowed
  if (userRole === "superadmin") {
    base.organization_id = Joi.string().uuid().optional();
    base.facility_id = Joi.string().uuid().allow(null).optional();
  }

  // ✅ ORG ADMIN / OWNER → facility allowed
  if (["organization_admin", "org_admin", "org_owner"].includes(userRole)) {
    base.facility_id = Joi.string().uuid().allow(null).optional();
  }

  return Joi.object(base);
}

/* ============================================================
   📌 CREATE Deposit Refund (status → PENDING)
============================================================ */
export const createRefundDeposit = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    debug.error("createRefundDeposit → REQUEST", {
      userId: req.user?.id,
      depositId: req.body?.deposit_id,
    });

    const allowed = await authzService.checkPermission({
      user: req.user,
      module: MODULE_KEY,
      action: "create",
      res,
    });
    if (!allowed) return;

    const role = (req.user?.roleNames?.[0] || "").toLowerCase();

    const { value, error: validationError } =
      buildRefundDepositSchema(role, "create").validate(req.body, {
        stripUnknown: true,
      });

    if (validationError) {
      debug.error("createRefundDeposit → VALIDATION FAILED", {
        userId: req.user?.id,
      });
      await t.rollback();
      return error(res, "Validation failed", validationError, 400);
    }

    /* ========================================================
       🧭 TENANT RESOLUTION (MASTER PARITY)
    ======================================================== */
    const { orgId, facilityId } = resolveOrgFacility({
      user: req.user,
      value,
      body: req.body,
    });

    if (!orgId) {
      await t.rollback();
      return error(res, "Missing organization assignment", null, 400);
    }

    const result = await refundDepositService.createRefund({
      deposit_id: value.deposit_id,
      amount: value.refund_amount,
      method: value.method,
      reason: value.reason,
      organization_id: orgId,
      facility_id: facilityId,
      user: req.user,
      t,
    });

    await t.commit();

    debug.error("createRefundDeposit → SUCCESS", {
      refundId: result.refund.id,
    });

    const full = await RefundDeposit.findOne({
      where: { id: result.refund.id },
      include: REFUND_DEPOSIT_INCLUDES,
    });

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "create",
      entityId: full.id,
      entity: full,
    });

    return success(res, "✅ Deposit refund created (pending)", full);
  } catch (err) {
    if (t && !t.finished) await t.rollback();
    debug.error("createRefundDeposit → FAILED", err);
    return error(res, "❌ Failed to create deposit refund", err);
  }
};

/* ============================================================
   📌 UPDATE Deposit Refund (PENDING only)
============================================================ */
export const updateRefundDeposit = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    debug.error("updateRefundDeposit → REQUEST", {
      userId: req.user?.id,
      refundId: req.params.id,
    });

    const allowed = await authzService.checkPermission({
      user: req.user,
      module: MODULE_KEY,
      action: "update",
      res,
    });
    if (!allowed) return;

    const record = await RefundDeposit.findByPk(req.params.id, {
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

    const role = (req.user?.roleNames?.[0] || "").toLowerCase();

    const { value, error: validationError } =
      buildRefundDepositSchema(role, "update").validate(req.body, {
        stripUnknown: true,
      });

    if (validationError) {
      await t.rollback();
      return error(res, "Validation failed", validationError, 400);
    }

    await record.update(
      {
        refund_amount: value.refund_amount,
        method: value.method,
        reason: value.reason,
        updated_by_id: req.user?.id || null,
      },
      { transaction: t }
    );

    await t.commit();

    debug.error("updateRefundDeposit → SUCCESS", {
      refundId: record.id,
    });

    const full = await RefundDeposit.findOne({
      where: { id: record.id },
      include: REFUND_DEPOSIT_INCLUDES,
    });

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "update",
      entityId: full.id,
      entity: full,
    });

    return success(res, "✅ Deposit refund updated", full);
  } catch (err) {
    if (t && !t.finished) await t.rollback();
    debug.error("updateRefundDeposit → FAILED", err);
    return error(res, "❌ Failed to update deposit refund", err);
  }
};

/* ============================================================
   📌 APPROVE Deposit Refund (PENDING → APPROVED)
============================================================ */
export const approveRefundDeposit = async (req, res) => {
  try {
    const { refund } = await refundDepositService.approveRefund({
      refund_id: req.params.id,
      user: req.user,
    });

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "approve",
      entityId: refund.id,
      entity: refund,
    });

    return success(res, "✅ Deposit refund approved", refund);
  } catch (err) {
    return error(res, "❌ Failed to approve deposit refund", err);
  }
};

/* ============================================================
   📌 PROCESS Deposit Refund (APPROVED → PROCESSED)
============================================================ */
export const processRefundDeposit = async (req, res) => {
  try {
    const { refund, deposit } =
      await refundDepositService.processRefund({
        refund_id: req.params.id,
        user: req.user,
      });

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "process",
      entityId: refund.id,
      entity: refund,
      details: { deposit_id: deposit?.id || null },
    });

    return success(res, "✅ Deposit refund processed", {
      refund,
      deposit,
    });
  } catch (err) {
    return error(res, "❌ Failed to process deposit refund", err);
  }
};

/* ============================================================
   📌 VOID Deposit Refund (PENDING / APPROVED → VOIDED)
============================================================ */
export const voidRefundDeposit = async (req, res) => {
  try {
    const { refund } = await refundDepositService.voidRefund({
      refund_id: req.params.id,
      user: req.user,
      reason: req.body?.reason || "manual void",
    });

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "void",
      entityId: refund.id,
      entity: refund,
      details: { reason: req.body?.reason || "manual void" },
    });

    return success(res, "✅ Deposit refund voided", refund);
  } catch (err) {
    return error(res, "❌ Failed to void deposit refund", err);
  }
};

/* ============================================================
   📌 REVERSE Deposit Refund (PROCESSED → REVERSED)
============================================================ */
export const reverseRefundDeposit = async (req, res) => {
  try {
    const { refund } = await refundDepositService.reverseRefund({
      refund_id: req.params.id,
      user: req.user,
      reason: req.body?.reason || "manual reversal",
    });

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "reverse",
      entityId: refund.id,
      entity: refund,
      details: { reason: req.body?.reason || "manual reversal" },
    });

    return success(res, "✅ Deposit refund reversed", refund);
  } catch (err) {
    return error(res, "❌ Failed to reverse deposit refund", err);
  }
};

/* ============================================================
   📌 RESTORE Deposit Refund (VOIDED / CANCELLED / REJECTED → PENDING)
============================================================ */
export const restoreRefundDeposit = async (req, res) => {
  try {
    const { refund } = await refundDepositService.restoreRefund({
      refund_id: req.params.id,
      user: req.user,
    });

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "restore",
      entityId: refund.id,
      entity: refund,
    });

    return success(res, "✅ Deposit refund restored", refund);
  } catch (err) {
    return error(res, "❌ Failed to restore deposit refund", err);
  }
};

/* ============================================================
   📌 GET ALL Deposit Refunds (MASTER-ALIGNED)
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

    /* ========================================================
       🔎 STRICT PAGINATION (MASTER)
    ======================================================== */
    const { limit, page, offset } = validatePaginationStrict(req, {
      limit: 25,
      maxLimit: 200,
    });

    const role = (req.user?.roleNames?.[0] || "staff").toLowerCase();
    const visibleFields =
      FIELD_VISIBILITY_REFUND_DEPOSIT[role] ||
      FIELD_VISIBILITY_REFUND_DEPOSIT.staff;

    /* ========================================================
       🧹 STRIP UI-ONLY PARAMS (MASTER)
    ======================================================== */
    const { dateRange, ...safeQuery } = req.query;
    safeQuery.limit = limit;
    safeQuery.page = page;
    req.query = safeQuery;

    const options = buildQueryOptions(
      req,
      "created_at",
      "DESC",
      visibleFields
    );

    options.where = { [Op.and]: [] };

    /* ========================================================
       📅 DATE RANGE (created_at)
    ======================================================== */
    if (dateRange) {
      const { start, end } = normalizeDateRangeLocal(dateRange);
      if (start && end) {
        options.where[Op.and].push({
          created_at: { [Op.between]: [start, end] },
        });
      }
    }

    /* ========================================================
       🏢 TENANT SCOPE (MASTER)
    ======================================================== */
    if (!isSuperAdmin(req.user)) {
      options.where[Op.and].push({
        organization_id: req.user.organization_id,
      });

      if (isFacilityHead(req.user)) {
        options.where[Op.and].push({
          facility_id: req.user.facility_id,
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

    /* ========================================================
       🎯 FILTERS (EXACT MATCH)
    ======================================================== */
    if (req.query.deposit_id) {
      options.where[Op.and].push({ deposit_id: req.query.deposit_id });
    }
    if (req.query.patient_id) {
      options.where[Op.and].push({ patient_id: req.query.patient_id });
    }
    if (req.query.status) {
      options.where[Op.and].push({ status: req.query.status });
    }
    if (req.query.method) {
      options.where[Op.and].push({ method: req.query.method });
    }

    /* ========================================================
       🔍 GLOBAL SEARCH (MASTER SAFE)
    ======================================================== */
    if (options.search) {
      options.where[Op.and].push({
        [Op.or]: [
          { reason: { [Op.iLike]: `%${options.search}%` } },
          { method: { [Op.iLike]: `%${options.search}%` } },
          { "$patient.first_name$": { [Op.iLike]: `%${options.search}%` } },
          { "$patient.last_name$": { [Op.iLike]: `%${options.search}%` } },
          { "$patient.pat_no$": { [Op.iLike]: `%${options.search}%` } },
        ],
      });
    }

    /* ========================================================
       📦 MAIN QUERY
    ======================================================== */
    const { count, rows } = await RefundDeposit.findAndCountAll({
      where: options.where,
      include: REFUND_DEPOSIT_INCLUDES,
      order: options.order,
      offset,
      limit,
      distinct: true,
    });

    /* ========================================================
       🔢 SUMMARY (MASTER STYLE)
    ======================================================== */
    const summary = { total: count };

    const statusCounts = await RefundDeposit.findAll({
      where: options.where,
      attributes: [
        "status",
        [sequelize.fn("COUNT", sequelize.col("id")), "count"],
      ],
      group: ["status"],
    });

    Object.values(RS).forEach((status) => {
      const found = statusCounts.find((s) => s.status === status);
      summary[status] = found ? Number(found.get("count")) : 0;
    });

    /* ========================================================
       🧾 AUDIT
    ======================================================== */
    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "list",
      details: {
        query: safeQuery,
        returned: count,
        pagination: { page, limit },
      },
    });

    /* ========================================================
       ✅ RESPONSE
    ======================================================== */
    return success(res, "✅ Deposit refunds loaded", {
      records: rows,
      summary,
      pagination: {
        total: count,
        page,
        limit,
        pageCount: Math.ceil(count / limit),
      },
    });
  } catch (err) {
    if (err.statusCode === 400) {
      return error(res, err.message, null, 400);
    }
    return error(res, "❌ Failed to load deposit refunds", err);
  }
};

/* ============================================================
   📌 GET Deposit Refund by ID (MASTER PARITY)
============================================================ */
export const getRefundDepositById = async (req, res) => {
  try {
    const where = { id: req.params.id };

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

    const record = await RefundDeposit.findOne({
      where,
      include: REFUND_DEPOSIT_INCLUDES,
    });

    if (!record) {
      return error(res, "❌ Deposit refund not found", null, 404);
    }

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
   📌 DELETE Deposit Refund (MASTER-SAFE)
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
      { deleted_by_id: req.user?.id || null },
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
    if (t && !t.finished) await t.rollback();
    return error(res, "❌ Failed to delete deposit refund", err);
  }
};
/* ============================================================
   📌 GET Deposit Refunds (LITE – MASTER PARITY)
   — Used for dropdowns / autocomplete
============================================================ */
export const getAllRefundDepositsLite = async (req, res) => {
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module: MODULE_KEY,
      action: "read",
      res,
    });
    if (!allowed) return;

    const where = { [Op.and]: [] };

    /* ========================================================
       🏢 TENANT SCOPE (MASTER)
    ======================================================== */
    if (!isSuperAdmin(req.user)) {
      where[Op.and].push({
        organization_id: req.user.organization_id,
      });

      if (isFacilityHead(req.user)) {
        where[Op.and].push({
          facility_id: req.user.facility_id,
        });
      }
    } else {
      if (req.query.organization_id) {
        where[Op.and].push({
          organization_id: req.query.organization_id,
        });
      }
      if (req.query.facility_id) {
        where[Op.and].push({
          facility_id: req.query.facility_id,
        });
      }
    }

    /* ========================================================
       🔍 KEYWORD SEARCH (SAFE)
    ======================================================== */
    if (req.query.q) {
      const term = `%${req.query.q}%`;
      where[Op.and].push({
        [Op.or]: [
          { reason: { [Op.iLike]: term } },
          { status: { [Op.iLike]: term } },
        ],
      });
    }

    const rows = await RefundDeposit.findAll({
      where,
      include: [
        {
          model: Deposit,
          as: "deposit",
          attributes: ["id"],
        },
        {
          model: Patient,
          as: "patient",
          attributes: ["pat_no", "first_name", "last_name"],
        },
      ],
      order: [["created_at", "DESC"]],
      limit: 20,
    });

    const records = rows.map((r) => ({
      id: r.id,
      refund_amount: r.refund_amount,
      method: r.method,
      status: r.status,
      patient: r.patient
        ? `${r.patient.pat_no} - ${r.patient.first_name} ${r.patient.last_name}`
        : "",
      created_at: r.created_at,
    }));

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "list_lite",
      details: {
        count: records.length,
        query: req.query.q || null,
      },
    });

    return success(res, "✅ Deposit refunds loaded (lite)", { records });
  } catch (err) {
    return error(res, "❌ Failed to load deposit refunds (lite)", err);
  }
};

/* ============================================================
   📌 REVIEW Deposit Refund (PENDING → REVIEW)
============================================================ */
export const reviewRefundDeposit = async (req, res) => {
  try {
    const { refund } = await refundDepositService.reviewRefund(
      req.params.id,
      req.user
    );

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "review",
      entityId: refund.id,
      entity: refund,
    });

    return success(res, "✅ Deposit refund moved to review", refund);
  } catch (err) {
    return error(res, "❌ Failed to review deposit refund", err);
  }
};

/* ============================================================
   📌 REJECT Deposit Refund (PENDING / REVIEW → REJECTED)
   — Reason required (MASTER)
============================================================ */
export const rejectRefundDeposit = async (req, res) => {
  try {
    const reason = req.body?.reason;
    if (!reason || reason.trim().length < 3) {
      return error(
        res,
        "❌ Reason is required to reject this refund",
        null,
        400
      );
    }

    const { refund } = await refundDepositService.rejectRefund(
      req.params.id,
      req.user,
      reason
    );

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "reject",
      entityId: refund.id,
      entity: refund,
      details: { reason },
    });

    return success(res, "❌ Deposit refund rejected", refund);
  } catch (err) {
    return error(res, "❌ Failed to reject deposit refund", err);
  }
};

/* ============================================================
   📌 CANCEL Deposit Refund (PENDING / APPROVED → CANCELLED)
   — Reason required (MASTER)
============================================================ */
export const cancelRefundDeposit = async (req, res) => {
  try {
    const reason = req.body?.reason;
    if (!reason || reason.trim().length < 3) {
      return error(
        res,
        "❌ Reason is required to cancel this refund",
        null,
        400
      );
    }

    const { refund } = await refundDepositService.cancelRefund(
      req.params.id,
      req.user,
      reason
    );

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "cancel",
      entityId: refund.id,
      entity: refund,
      details: { reason },
    });

    return success(res, "🚫 Deposit refund cancelled", refund);
  } catch (err) {
    return error(res, "❌ Failed to cancel deposit refund", err);
  }
};
