// 📁 backend/src/controllers/refundController.js
import Joi from "joi";
import { Op } from "sequelize";
import {
  sequelize,
  Refund,
  Payment,
  Invoice,
  Patient,
  Organization,
  Facility,
  User,
  RefundTransaction,
} from "../models/index.js";

import { success, error } from "../utils/response.js";
import { buildQueryOptions } from "../utils/queryHelper.js";
import { validate } from "../utils/validation.js";
import { validatePaginationStrict } from "../utils/query-utils.js";
import { normalizeDateRangeLocal } from "../utils/date-utils.js";
import { refundService } from "../services/refundService.js";
import {
  isSuperAdmin,
  isOrgLevelUser,
} from "../utils/role-utils.js";

import { makeModuleLogger } from "../utils/debugLogger.js";

import { REFUND_STATUS, PAYMENT_STATUS, CURRENCY } from "../constants/enums.js";
import { authzService } from "../services/authzService.js";
import { auditService } from "../services/auditService.js";
import { financialService } from "../services/financialService.js";
import { FIELD_VISIBILITY_REFUND } from "../constants/fieldVisibility.js";
import { buildDynamicSummary } from "../utils/summaryHelper.js";

/* ============================================================
   🔐 MODULE
============================================================ */
const MODULE_KEY = "refund";

/* ============================================================
   🔧 LOCAL DEBUG
============================================================ */
const DEBUG_OVERRIDE = false;
const debug = makeModuleLogger("refundController", DEBUG_OVERRIDE);

/* ============================================================
   🔖 STATUS MAPS (ENUM-SAFE – MASTER STYLE)
   ❗ DO NOT HARD-CODE STRINGS
============================================================ */
const RS = REFUND_STATUS;

const ALLOWED_TRANSITIONS = {
  [RS.PENDING]: [RS.APPROVED, RS.REJECTED, RS.CANCELLED],
  [RS.APPROVED]: [RS.PROCESSED, RS.CANCELLED],
  [RS.PROCESSED]: [RS.REVERSED],
  [RS.REJECTED]: [],
  [RS.CANCELLED]: [],
  [RS.REVERSED]: [],
  [RS.VOIDED]: [],
};


/* ============================================================
   🔖 PAYMENT STATUS MAP (ENUM-SAFE – MASTER)
============================================================ */
const PS = PAYMENT_STATUS;

/* ============================================================
   🔗 SHARED INCLUDES (MASTER PARITY)
============================================================ */
const REFUND_INCLUDES = [
  {
    model: Payment,
    as: "payment",
    attributes: ["id", "amount", "method", "transaction_ref", "status"],
  },
  {
    model: Invoice,
    as: "invoice",
    attributes: ["id", "invoice_number", "status", "total", "balance"],
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
  {
    model: RefundTransaction,
    as: "transactions",
    attributes: ["id", "amount", "method", "status", "created_at"],
  },

  // 🔹 audit users
  { model: User, as: "createdBy", attributes: ["id", "first_name", "last_name"] },
  { model: User, as: "updatedBy", attributes: ["id", "first_name", "last_name"] },
  { model: User, as: "deletedBy", attributes: ["id", "first_name", "last_name"] },

  // 🔹 lifecycle users
  { model: User, as: "approvedBy", attributes: ["id", "first_name", "last_name"] },
  { model: User, as: "rejectedBy", attributes: ["id", "first_name", "last_name"] },
  { model: User, as: "processedBy", attributes: ["id", "first_name", "last_name"] },
  { model: User, as: "cancelledBy", attributes: ["id", "first_name", "last_name"] },
];

function buildRefundSchema(userRole, mode = "create") {
  const base = {
    payment_id: Joi.string().uuid().required(),
    amount: Joi.number().positive().required(),

    // 🔥 SERVER CONTROLLED (DO NOT ALLOW CLIENT)
    currency: Joi.forbidden(),

    reason: Joi.string().min(3).required(),

    // ❌ NEVER client-controlled
    invoice_id: Joi.forbidden(),
    patient_id: Joi.forbidden(),
    method: Joi.forbidden(),

    // 🔒 lifecycle controlled
    status: Joi.forbidden(),
    approved_by_id: Joi.forbidden(),
    rejected_by_id: Joi.forbidden(),
    processed_by_id: Joi.forbidden(),
    cancelled_by_id: Joi.forbidden(),
  };

  if (mode === "update") {
    Object.keys(base).forEach((k) => (base[k] = base[k].optional()));
    base.reason = Joi.string().min(5).required();
  }

  if (userRole === "superadmin") {
    base.organization_id = Joi.string().uuid().optional();
    base.facility_id = Joi.string().uuid().allow(null).optional();
  } else {
    base.organization_id = Joi.forbidden();
    base.facility_id = Joi.forbidden();
  }

  return Joi.object(base);
}
/* ============================================================
   📌 CREATE Refund (MASTER PARITY – TENANT INHERITED)
============================================================ */
export const createRefund = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module: MODULE_KEY,
      action: "create",
      res,
    });
    if (!allowed) return;

    const role = (req.user?.roleNames?.[0] || "staff").toLowerCase();

    const { value, errors } = validate(
      buildRefundSchema(role, "create"),
      req.body
    );
    if (errors) {
      await t.rollback();
      return error(res, "Validation failed", errors, 400);
    }

    const payment = await Payment.findByPk(value.payment_id, {
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    if (!payment) {
      await t.rollback();
      return error(res, "❌ Payment not found", null, 404);
    }

    if (payment.status !== PS.COMPLETED) {
      await t.rollback();
      return error(res, "❌ Only completed payments can be refunded", null, 400);
    }

    if (payment.is_deposit) {
      await t.rollback();
      return error(res, "❌ Deposits cannot be refunded here", null, 400);
    }

    /* ================= 🔒 LOCK EXISTING REFUNDS ================= */
    const refunds = await Refund.findAll({
      where: {
        payment_id: payment.id,
        status: RS.PROCESSED,
      },
      attributes: ["amount"],
      transaction: t,
      lock: t.LOCK.UPDATE, // 🔥 CRITICAL FIX
    });

    const processedRefunds = refunds.reduce(
      (sum, r) => sum + Number(r.amount || 0),
      0
    );

    const refundableBalance =
      Number(payment.amount || 0) - processedRefunds;

    if (Number(value.amount) > refundableBalance) {
      await t.rollback();
      return error(
        res,
        `❌ Refund amount exceeds refundable balance (${refundableBalance})`,
        null,
        400
      );
    }

    /* ================= CREATE ================= */
    const refund = await refundService.createRefund({
      ...value,
      method: payment.method,
      organization_id: payment.organization_id,
      facility_id: payment.facility_id,
      created_by_id: req.user.id,
      user: req.user,
      t,
    });

    await t.commit();

    const full = await Refund.findOne({
      where: { id: refund.id },
      include: REFUND_INCLUDES,
    });

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "create",
      entityId: refund.id,
      entity: full,
    });

    return success(res, "✅ Refund created", full);
  } catch (err) {
    if (t && !t.finished) await t.rollback();
    return error(res, "❌ Failed to create refund", err);
  }
};

/* ============================================================
   📌 UPDATE Refund (MASTER PARITY – TENANT LOCKED)
============================================================ */
export const updateRefund = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module: MODULE_KEY,
      action: "update",
      res,
    });
    if (!allowed) return;

    const role = (req.user?.roleNames?.[0] || "staff").toLowerCase();

    const { value, errors } = validate(
      buildRefundSchema(role, "update"),
      req.body
    );
    if (errors) {
      await t.rollback();
      return error(res, "Validation failed", errors, 400);
    }

    const record = await Refund.findByPk(req.params.id, {
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    if (!record) {
      await t.rollback();
      return error(res, "❌ Refund not found", null, 404);
    }

    if (record.status === RS.PROCESSED) {
      await t.rollback();
      return error(res, "❌ Processed refunds cannot be updated", null, 400);
    }

    const payment = await Payment.findByPk(record.payment_id, {
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    if (!payment) {
      await t.rollback();
      return error(res, "❌ Payment not found", null, 404);
    }

    if (payment.status !== PS.COMPLETED || payment.is_deposit) {
      await t.rollback();
      return error(res, "❌ Invalid payment for refund", null, 400);
    }

    /* ================= 🔒 STATUS TRANSITION GUARD ================= */
    if (value.status && value.status !== record.status) {
      const allowed = ALLOWED_TRANSITIONS[record.status] || [];

      if (!allowed.includes(value.status)) {
        await t.rollback();
        return error(
          res,
          `❌ Invalid status transition from ${record.status} → ${value.status}`,
          null,
          400
        );
      }
    }

    /* ================= 💰 REFUNDABLE BALANCE (LOCKED) ================= */
    const refunds = await Refund.findAll({
      where: {
        payment_id: payment.id,
        status: RS.PROCESSED,
        id: { [Op.ne]: record.id },
      },
      attributes: ["amount"],
      transaction: t,
      lock: t.LOCK.UPDATE, // 🔥 FINAL FIX (prevents race condition)
    });

    const processedRefunds = refunds.reduce(
      (sum, r) => sum + Number(r.amount || 0),
      0
    );

    const refundableBalance =
      Number(payment.amount || 0) - processedRefunds;

    if (
      value.amount &&
      Number(value.amount) > refundableBalance
    ) {
      await t.rollback();
      return error(
        res,
        `❌ Refund amount exceeds refundable balance (${refundableBalance})`,
        null,
        400
      );
    }

    /* ================= UPDATE ================= */
    await record.update(
      {
        ...value,
        organization_id: payment.organization_id,
        facility_id: payment.facility_id,
        updated_by_id: req.user?.id || null,
      },
      { transaction: t }
    );

    await t.commit();

    const full = await Refund.findOne({
      where: { id: record.id },
      include: REFUND_INCLUDES,
    });

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "update",
      entityId: record.id,
      entity: full,
    });

    return success(res, "✅ Refund updated", full);
  } catch (err) {
    if (t && !t.finished) await t.rollback();
    return error(res, "❌ Failed to update refund", err);
  }
};
/* ============================================================
   📌 GET ALL Refunds (MASTER PARITY – FIXED)
============================================================ */
export const getAllRefunds = async (req, res) => {
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module: MODULE_KEY,
      action: "read",
      res,
    });
    if (!allowed) return;

    const { limit, page, offset } = validatePaginationStrict(req, {
      limit: 25,
      maxLimit: 200,
    });

    const role = (req.user?.roleNames?.[0] || "staff").toLowerCase();
    const visibleFields =
      FIELD_VISIBILITY_REFUND[role] || FIELD_VISIBILITY_REFUND.staff;

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

    /* 🔥 FIX */
    options.where = options.where || {};
    options.where[Op.and] = options.where[Op.and] || [];

    /* ================= DATE RANGE ================= */
    if (dateRange) {
      const { start, end } = normalizeDateRangeLocal(dateRange);
      if (start && end) {
        options.where[Op.and].push({
          created_at: { [Op.between]: [start, end] },
        });
      }
    }

    /* ================= TENANCY ================= */
    if (!isSuperAdmin(req.user)) {
      options.where[Op.and].push({
        organization_id: req.user.organization_id,
      });

      if (!isOrgLevelUser(req.user)) {
        options.where[Op.and].push({
          facility_id: req.user.facility_id,
        });
      } else if (req.query.facility_id) {
        options.where[Op.and].push({
          facility_id: req.query.facility_id,
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

    /* ================= FILTERS ================= */
    if (req.query.payment_id)
      options.where[Op.and].push({ payment_id: req.query.payment_id });

    if (req.query.invoice_id)
      options.where[Op.and].push({ invoice_id: req.query.invoice_id });

    if (req.query.patient_id)
      options.where[Op.and].push({ patient_id: req.query.patient_id });

    if (req.query.status)
      options.where[Op.and].push({ status: req.query.status });

    if (req.query.method)
      options.where[Op.and].push({ method: req.query.method });

    if (req.query.currency)
      options.where[Op.and].push({ currency: req.query.currency });

    /* ================= GLOBAL SEARCH ================= */
    if (options.search) {
      const term = `%${options.search}%`;
      options.where[Op.and].push({
        [Op.or]: [
          { refund_number: { [Op.iLike]: term } },
          { reason: { [Op.iLike]: term } },
          sequelize.where(
            sequelize.cast(sequelize.col("Refund.status"), "text"),
            { [Op.iLike]: term }
          ),
          sequelize.where(
            sequelize.cast(sequelize.col("Refund.method"), "text"),
            { [Op.iLike]: term }
          ),
        ],
      });
    }

    const { count, rows } = await Refund.findAndCountAll({
      where: options.where,
      include: REFUND_INCLUDES,
      order: options.order,
      offset,
      limit,
      distinct: true,
    });

    const summaryOptions = {
      ...options,
      where: { ...options.where },
    };

    if (!isSuperAdmin(req.user)) {
      summaryOptions.where.organization_id = req.user.organization_id;
    } else if (req.query.organization_id) {
      summaryOptions.where.organization_id = req.query.organization_id;
    } else {
      return success(res, "✅ Refunds loaded", {
        records: rows,
        pagination: {
          total: count,
          page,
          limit,
          pageCount: Math.ceil(count / limit),
        },
        summary: null,
      });
    }

    const summary = await buildDynamicSummary({
      model: Refund,
      options: summaryOptions,
      statusEnums: Object.values(REFUND_STATUS),
      includeGender: true,
      genderJoin: { model: Patient, as: "patient" },
    });

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

    return success(res, "✅ Refunds loaded", {
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
    return error(res, "❌ Failed to load refunds", err);
  }
};

/* ============================================================
   📌 GET Refunds Lite (MASTER AUTOCOMPLETE)
============================================================ */
export const getAllRefundsLite = async (req, res) => {
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module: MODULE_KEY,
      action: "read",
      res,
    });
    if (!allowed) return;

    const { q } = req.query;
    const where = { [Op.and]: [] };

    if (!isSuperAdmin(req.user)) {
      where[Op.and].push({
        organization_id: req.user.organization_id,
      });

      if (req.user?.facility_id) {
        where[Op.and].push({
          facility_id: req.user.facility_id,
        });
      }
    }

    if (q) {
      where[Op.and].push({
        [Op.or]: [
          { refund_number: { [Op.iLike]: `%${q}%` } },
          { reason: { [Op.iLike]: `%${q}%` } },
          sequelize.where(
            sequelize.cast(sequelize.col("Refund.status"), "text"),
            { [Op.iLike]: `%${q}%` }
          ),
        ],
      });
    }

    const refunds = await Refund.findAll({
      where,
      attributes: [
        "id",
        "refund_number",
        "amount",
        "currency", // 🔥 ONLY ADD THIS
        "reason",
        "status",
        "created_at",
      ],
      include: [
        {
          model: Payment,
          as: "payment",
          attributes: ["id", "transaction_ref", "method"],
        },
        {
          model: Patient,
          as: "patient",
          attributes: ["id", "pat_no", "first_name", "last_name"],
        },
      ],
      order: [["created_at", "DESC"]],
      limit: 20,
    });

    const records = refunds.map((r) => ({
      id: r.id,
      amount: r.amount,
      currency: r.currency, // 🔥 ONLY ADD THIS
      status: r.status,
      reason: r.reason,
      method: r.payment?.method || "",
      payment: r.payment?.transaction_ref || "",
      label: r.refund_number || r.payment?.transaction_ref || r.id,
      patient: r.patient
        ? `${r.patient.pat_no} - ${r.patient.first_name} ${r.patient.last_name}`
        : "",
      created_at: r.created_at,
    }));

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "list_lite",
      details: { count: records.length, query: q || null },
    });

    return success(res, "✅ Refunds loaded (lite)", { records });
  } catch (err) {
    return error(res, "❌ Failed to load refunds (lite)", err);
  }
};

/* ============================================================
   📌 GET Refund by ID (MASTER PARITY – TENANT LOCKED)
============================================================ */
export const getRefundById = async (req, res) => {
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module: MODULE_KEY,
      action: "read",
      res,
    });
    if (!allowed) return;

    const where = { id: req.params.id };

    if (!isSuperAdmin(req.user)) {
      where.organization_id = req.user.organization_id;
      if (!isOrgLevelUser(req.user)) {
        where.facility_id = req.user.facility_id;
      }
    } else {
      if (req.query.organization_id)
        where.organization_id = req.query.organization_id;
      if (req.query.facility_id)
        where.facility_id = req.query.facility_id;
    }

    const record = await Refund.findOne({
      where,
      include: REFUND_INCLUDES,
    });

    if (!record) {
      return error(res, "❌ Refund not found", null, 404);
    }

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "view",
      entityId: record.id,
      entity: record,
    });

    return success(res, "✅ Refund loaded", record);
  } catch (err) {
    return error(res, "❌ Failed to load refund", err);
  }
};


/* ============================================================
   📌 DELETE Refund (MASTER PARITY – TENANT SAFE)
============================================================ */
export const deleteRefund = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module: MODULE_KEY,
      action: "delete",
      res,
    });
    if (!allowed) return;

    const where = { id: req.params.id };

    if (!isSuperAdmin(req.user)) {
      where.organization_id = req.user.organization_id;
      if (req.user?.facility_id) {
        where.facility_id = req.user.facility_id;
      }
    }

    const record = await Refund.findOne({
      where,
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    if (!record) {
      await t.rollback();
      return error(res, "❌ Refund not found", null, 404);
    }

    if (record.status === RS.PROCESSED) {
      await t.rollback();
      return error(
        res,
        "❌ Processed refunds cannot be deleted",
        null,
        400
      );
    }

    await record.update(
      { deleted_by_id: req.user?.id || null },
      { transaction: t }
    );
    await record.destroy({ transaction: t });

    await t.commit();

    const full = await Refund.findOne({
      where: { id: record.id },
      include: REFUND_INCLUDES,
      paranoid: false,
    });

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "delete",
      entityId: record.id,
      entity: full,
    });

    return success(res, "✅ Refund deleted", full);
  } catch (err) {
    if (t && !t.finished) await t.rollback();
    return error(res, "❌ Failed to delete refund", err);
  }
};


/* ============================================================
   📌 APPROVE Refund (pending → approved)
============================================================ */
export const approveRefund = async (req, res) => {
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module: MODULE_KEY,
      action: "approve",
      res,
    });
    if (!allowed) return;

    const { refund } = await financialService.approveRefund(
      req.params.id,
      req.user
    );

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "approve",
      entityId: refund.id,
      entity: refund,
    });

    return success(res, "✅ Refund approved", refund);
  } catch (err) {
    return error(res, "❌ Failed to approve refund", err);
  }
};


/* ============================================================
   📌 PROCESS Refund (approved → processed)
============================================================ */
export const processRefund = async (req, res) => {
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module: MODULE_KEY,
      action: "process",
      res,
    });
    if (!allowed) return;

    const { refund, invoice } =
      await financialService.processRefund(req.params.id, req.user);

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "process",
      entityId: refund.id,
      entity: refund,
      details: { invoice },
    });

    return success(res, "✅ Refund processed", { refund, invoice });
  } catch (err) {
    return error(res, "❌ Failed to process refund", err);
  }
};


/* ============================================================
   📌 REVERSE Refund (processed → reversed)
============================================================ */
export const reverseRefund = async (req, res) => {
  try {
    const role = (req.user?.roleNames?.[0] || "").toLowerCase();
    if (!["admin", "superadmin"].includes(role)) {
      return error(
        res,
        "❌ Only admin/superadmin can reverse refunds",
        null,
        403
      );
    }

    const result = await financialService.reverseRefund(
      req.params.id,
      req.user
    );

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "reverse",
      entityId: req.params.id,
      entity: result.refund,
      details: { reason: req.body?.reason || "manual reversal" },
    });

    return success(
      res,
      result.message || "✅ Refund reversed",
      result
    );
  } catch (err) {
    return error(res, "❌ Failed to reverse refund", err);
  }
};


/* ============================================================
   📌 REJECT Refund (pending → rejected)
============================================================ */
export const rejectRefund = async (req, res) => {
  try {
    const reason = req.body?.reason;
    if (!reason) {
      return error(res, "❌ Reason required to reject refund", null, 400);
    }

    const { refund } = await financialService.rejectRefund(
      req.params.id,
      reason,
      req.user
    );

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "reject",
      entityId: refund.id,
      entity: refund,
    });

    return success(res, "✅ Refund rejected", refund);
  } catch (err) {
    return error(res, "❌ Failed to reject refund", err);
  }
};


/* ============================================================
   📌 CANCEL Refund (pending/approved → cancelled)
============================================================ */
export const cancelRefund = async (req, res) => {
  try {
    const reason = req.body?.reason;
    if (!reason) {
      return error(res, "❌ Reason required to cancel refund", null, 400);
    }

    const { refund } = await financialService.cancelRefund(
      req.params.id,
      reason,
      req.user
    );

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "cancel",
      entityId: refund.id,
      entity: refund,
    });

    return success(res, "✅ Refund cancelled", refund);
  } catch (err) {
    return error(res, "❌ Failed to cancel refund", err);
  }
};


/* ============================================================
   📌 VOID Refund (any → voided)
============================================================ */
export const voidRefund = async (req, res) => {
  try {
    const reason = req.body?.reason || "manual void";

    const result = await financialService.voidRefund(
      req.params.id,
      reason,
      req.user
    );

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "void",
      entityId: result.refund.id,
      entity: result.refund,
      details: { reason },
    });

    return success(res, "✅ Refund voided", result.refund);
  } catch (err) {
    return error(res, "❌ Failed to void refund", err);
  }
};


/* ============================================================
   📌 RESTORE Refund (voided/reversed → pending)
============================================================ */
export const restoreRefund = async (req, res) => {
  try {
    const result = await financialService.restoreRefund(
      req.params.id,
      req.user
    );

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "restore",
      entityId: result.refund.id,
      entity: result.refund,
    });

    return success(res, "✅ Refund restored", result.refund);
  } catch (err) {
    return error(res, "❌ Failed to restore refund", err);
  }
};
