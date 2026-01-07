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
  RefundTransaction 
} from "../models/index.js";
import { success, error } from "../utils/response.js";
import { buildQueryOptions } from "../utils/queryHelper.js";
import { REFUND_STATUS, PAYMENT_STATUS } from "../constants/enums.js"; // ⬅️ fixed: use PAYMENT_STATUS, not PAYMENT_METHODS
import { authzService } from "../services/authzService.js";
import { auditService } from "../services/auditService.js";
import { financialService } from "../services/financialService.js";
import { FIELD_VISIBILITY_REFUND } from "../constants/fieldVisibility.js";
import { buildDynamicSummary } from "../utils/summaryHelper.js"; // 🧠 Summary Helper

const MODULE_KEY = "refund";

// 🔖 Local enum map
const RS = {
  PENDING: REFUND_STATUS[0],    // pending
  APPROVED: REFUND_STATUS[1],   // approved
  REJECTED: REFUND_STATUS[2],   // rejected
  PROCESSED: REFUND_STATUS[3],  // processed
  CANCELLED: REFUND_STATUS[4],  // cancelled
  REVERSED: REFUND_STATUS[5],   // reversed (new)
};

/* ============================================================
   🔧 Helpers
============================================================ */
function isSuperAdmin(user) {
  if (!user) return false;
  const roles = Array.isArray(user.roleNames) ? user.roleNames : [user.role || ""];
  return roles.map((r) => r.toLowerCase()).includes("superadmin");
}

/* ============================================================
   🔗 Shared includes
============================================================ */
const REFUND_INCLUDES = [
  { model: Payment, as: "payment", attributes: ["id", "amount", "method", "transaction_ref", "status"] },
  { model: Invoice, as: "invoice", attributes: ["id", "invoice_number", "status", "total", "balance"] },
  { model: Patient, as: "patient", attributes: ["id", "pat_no", "first_name", "last_name"] },
  { model: Organization, as: "organization", attributes: ["id", "name", "code"] },
  { model: Facility, as: "facility", attributes: ["id", "name", "code", "organization_id"] },
  { model: RefundTransaction, as: "transactions", attributes: ["id", "amount", "method", "status", "created_at"] },

  // 🔹 Audit users
  { model: User, as: "createdBy", attributes: ["id", "first_name", "last_name"] },
  { model: User, as: "updatedBy", attributes: ["id", "first_name", "last_name"] },
  { model: User, as: "deletedBy", attributes: ["id", "first_name", "last_name"] },

  // 🔹 Lifecycle audit users
  { model: User, as: "approvedBy", attributes: ["id", "first_name", "last_name"] },
  { model: User, as: "rejectedBy", attributes: ["id", "first_name", "last_name"] },
  { model: User, as: "processedBy", attributes: ["id", "first_name", "last_name"] },
  { model: User, as: "cancelledBy", attributes: ["id", "first_name", "last_name"] },
];
/* ============================================================
   📋 Joi schema factory – now includes refund "method"
============================================================ */
function buildRefundSchema(userRole, mode = "create") {
  const base = {
    payment_id: Joi.string().uuid().required(),
    invoice_id: Joi.string().uuid().required(),
    patient_id: Joi.string().uuid().required(),
    amount: Joi.number().positive().required(),
    method: Joi.string()
      .valid("cash", "card", "bank_transfer", "mobile_money", "cheque")
      .required(), // ✅ added: refund method required for creation
    reason: Joi.string().min(3).required(),
    status: Joi.forbidden(), // system-driven
    approved_by_id: Joi.forbidden(),
    rejected_by_id: Joi.forbidden(),
    processed_by_id: Joi.forbidden(),
    cancelled_by_id: Joi.forbidden(),
  };

  if (mode === "update") {
    Object.keys(base).forEach((k) => (base[k] = base[k].optional()));
    base.reason = Joi.string().min(5).optional();
    base.method = Joi.string()
      .valid("cash", "card", "bank_transfer", "mobile_money", "cheque")
      .optional(); // ✅ allow updating method if editable
  }

  switch (userRole) {
    case "superadmin":
      base.organization_id = Joi.string().uuid().optional();
      base.facility_id = Joi.string().uuid().optional();
      break;
    case "admin":
    case "facility_head":
      base.organization_id = Joi.forbidden();
      base.facility_id = Joi.forbidden();
      break;
    default: // staff
      base.organization_id = Joi.forbidden();
      base.facility_id = Joi.forbidden();
  }

  return Joi.object(base);
}

/* ============================================================
   📌 CREATE Refund
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

    const role = (req.user?.roleNames?.[0] || "").toLowerCase();
    const schema = buildRefundSchema(role, "create");
    const { error: validationError, value } = schema.validate(req.body, {
      stripUnknown: true,
    });
    if (validationError) {
      await t.rollback();
      return error(res, "Validation failed", validationError, 400);
    }

    const payment = await Payment.findByPk(value.payment_id, {
      include: [
        { model: Refund, as: "refunds", attributes: ["id", "amount", "status"] },
      ],
      transaction: t,
    });
    if (!payment) {
      await t.rollback();
      return error(res, "❌ Payment not found", null, 404);
    }
    if (payment.status !== PAYMENT_STATUS[1]) {
      await t.rollback();
      return error(res, "❌ Only completed payments can be refunded", null, 400);
    }
    if (payment.is_deposit) {
      await t.rollback();
      return error(res, "❌ Deposits cannot be refunded directly", null, 400);
    }

    // 🔒 Validate refundable balance
    const processedRefunds = payment.refunds
      .filter((r) => r.status === "processed")
      .reduce((sum, r) => sum + parseFloat(r.amount || 0), 0);
    const refundableBalance = parseFloat(payment.amount) - processedRefunds;

    if (parseFloat(value.amount) > refundableBalance) {
      await t.rollback();
      return error(
        res,
        `❌ Refund amount exceeds refundable balance (${refundableBalance})`,
        null,
        400
      );
    }

    // ✅ Ensure method, organization, facility, and user auditing are saved
    const refundData = {
      ...value,
      method: value.method?.toLowerCase() || "cash",
      organization_id: value.organization_id || req.user.organization_id,
      facility_id: value.facility_id || req.user.facility_id,
      created_by_id: req.user.id,
    };

    const { refund } = await financialService.applyRefund({
      ...refundData,
      user: req.user,
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
      details: refundData,
    });

    return success(res, "✅ Refund created", full);
  } catch (err) {
    if (t && !t.finished) await t.rollback();
    return error(res, "❌ Failed to create refund", err);
  }
};

/* ============================================================
   📌 UPDATE Refund
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
    const schema = buildRefundSchema(role, "update");
    const { error: validationError, value } = schema.validate(req.body, {
      stripUnknown: true,
    });
    if (validationError) {
      await t.rollback();
      return error(res, "Validation failed", validationError, 400);
    }

    const record = await Refund.findByPk(req.params.id, {
      include: [
        {
          model: Payment,
          as: "payment",
          include: [
            { model: Refund, as: "refunds", attributes: ["id", "amount", "status"] },
          ],
        },
      ],
      transaction: t,
    });
    if (!record) {
      await t.rollback();
      return error(res, "❌ Refund not found", null, 404);
    }

    if (record.status === RS.PROCESSED) {
      await t.rollback();
      return error(res, "❌ Processed refunds cannot be updated", null, 400);
    }

    // 🔑 Validate payment change if any
    let payment = record.payment;
    if (value.payment_id && value.payment_id !== record.payment_id) {
      payment = await Payment.findByPk(value.payment_id, {
        include: [
          { model: Refund, as: "refunds", attributes: ["id", "amount", "status"] },
        ],
        transaction: t,
      });
      if (!payment) {
        await t.rollback();
        return error(res, "❌ Payment not found", null, 404);
      }
      if (payment.status !== PAYMENT_STATUS[1]) {
        await t.rollback();
        return error(res, "❌ Only completed payments can be refunded", null, 400);
      }
      if (payment.is_deposit) {
        await t.rollback();
        return error(res, "❌ Deposits cannot be refunded directly", null, 400);
      }
    }

    // 🔎 Require reason if amount changes
    if (value.amount && parseFloat(value.amount) !== parseFloat(record.amount)) {
      if (!value.reason) {
        await t.rollback();
        return error(res, "❌ Reason required when changing refund amount", null, 400);
      }

      const processedRefunds = payment.refunds
        .filter((r) => r.status === "processed" && r.id !== record.id)
        .reduce((sum, r) => sum + parseFloat(r.amount || 0), 0);
      const refundableBalance = parseFloat(payment.amount) - processedRefunds;

      if (parseFloat(value.amount) > refundableBalance) {
        await t.rollback();
        return error(
          res,
          `❌ Refund amount exceeds refundable balance (${refundableBalance})`,
          null,
          400
        );
      }
    }

    // ✅ Always include method + updated_by_id
    const updateData = {
      ...value,
      method: value.method?.toLowerCase() || record.method,
      updated_by_id: req.user?.id || null,
    };

    await record.update(updateData, { transaction: t });
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
      details: updateData,
    });

    return success(res, "✅ Refund updated", full);
  } catch (err) {
    if (t && !t.finished) await t.rollback();
    return error(res, "❌ Failed to update refund", err);
  }
};


/* ============================================================
   📌 GET ALL Refunds (with Dynamic Summary)
   — Enterprise Master Pattern (Aligned with Deposits)
============================================================ */
export const getAllRefunds = async (req, res) => {
  try {
    // 🔐 Permission Check
    const allowed = await authzService.checkPermission({
      user: req.user,
      module: MODULE_KEY,
      action: "read",
      res,
    });
    if (!allowed) return;

    // 👤 Role Context
    const role = (req.user?.roleNames?.[0] || "staff").toLowerCase();
    const visibleFields =
      FIELD_VISIBILITY_REFUND[role] || FIELD_VISIBILITY_REFUND.staff;

    // 🔎 Build Query Options
    const options = buildQueryOptions(req, "created_at", "DESC", visibleFields);
    options.where = options.where || {};

    /* ============================================================
       📅 Frontend Date Filter Bridge
    ============================================================ */
    if (req.query.created_from || req.query.created_to) {
      const range = {};
      if (req.query.created_from)
        range[Op.gte] = new Date(req.query.created_from);
      if (req.query.created_to) {
        const end = new Date(req.query.created_to);
        if (!isNaN(end)) end.setDate(end.getDate() + 1);
        range[Op.lt] = end;
      }
      options.where.created_at = range;
    }

    /* ============================================================
       🏢 Multi-Tenant Scoping
    ============================================================ */
    if (!isSuperAdmin(req.user)) {
      options.where.organization_id = req.user.organization_id;
      if (role === "facility_head")
        options.where.facility_id = req.user.facility_id;
    } else {
      if (req.query.organization_id)
        options.where.organization_id = req.query.organization_id;
      if (req.query.facility_id)
        options.where.facility_id = req.query.facility_id;
    }

    /* ============================================================
       🎯 Additional Filters (frontend filters)
    ============================================================ */
    if (req.query.payment_id) options.where.payment_id = req.query.payment_id;
    if (req.query.invoice_id) options.where.invoice_id = req.query.invoice_id;
    if (req.query.patient_id) options.where.patient_id = req.query.patient_id;
    if (req.query.status) options.where.status = req.query.status;
    if (req.query.method) options.where.method = req.query.method; // ✅ added

    /* ============================================================
       🔍 Search (Reason / Status / Audit Users)
    ============================================================ */
    if (options.search) {
      const term = `%${options.search}%`;
      options.where[Op.or] = [
        { reason: { [Op.iLike]: term } },
        { status: { [Op.iLike]: term } },
        { method: { [Op.iLike]: term } },
        { "$approvedBy.first_name$": { [Op.iLike]: term } },
        { "$approvedBy.last_name$": { [Op.iLike]: term } },
        { "$processedBy.first_name$": { [Op.iLike]: term } },
        { "$processedBy.last_name$": { [Op.iLike]: term } },
      ];
    }

    /* ============================================================
       📦 Fetch Paginated Results
    ============================================================ */
    const { count, rows } = await Refund.findAndCountAll({
      where: options.where,
      include: REFUND_INCLUDES,
      order: options.order,
      offset: options.offset,
      limit: options.limit,
      distinct: true,
    });

    /* ============================================================
       🧠 Lifecycle + Aggregate Summary
    ============================================================ */
    let summary = {};
    try {
      summary = await buildDynamicSummary({
        model: Refund,
        options,
        statusEnums: Object.values(REFUND_STATUS).filter(Boolean),
        includeGender: true,
        genderJoin: { model: Patient, as: "patient" },
      });
    } catch (sumErr) {
      console.warn("⚠️ Refund summary failed:", sumErr.message);
      summary = {};
    }

    /* ============================================================
       🧾 Audit Trail
    ============================================================ */
    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "list",
      details: { query: req.query, returned: count },
    });

    /* ============================================================
       ✅ Unified Response
    ============================================================ */
    return success(res, "✅ Refunds loaded", {
      records: rows,
      pagination: {
        total: count,
        page: options.pagination.page,
        pageCount: Math.ceil(count / options.pagination.limit),
      },
      summary, // ← lifecycle + totals + gender breakdown
    });
  } catch (err) {
    return error(res, "❌ Failed to load refunds", err);
  }
};


/* ============================================================
   📌 GET Refund by ID
============================================================ */
export const getRefundById = async (req, res) => {
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module: MODULE_KEY,
      action: "read",
      res
    });
    if (!allowed) return;

    const where = { id: req.params.id };
    const role = (req.user?.roleNames?.[0] || "staff").toLowerCase();

    // 🔹 Tenant scoping
    if (!isSuperAdmin(req.user)) {
      where.organization_id = req.user.organization_id;
      if (role === "facility_head") where.facility_id = req.user.facility_id;
    }

    const record = await Refund.findOne({ where, include: REFUND_INCLUDES });
    if (!record) return error(res, "❌ Refund not found", null, 404);

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "view",
      entityId: req.params.id,
      entity: record,
    });

    return success(res, "✅ Refund loaded", record);
  } catch (err) {
    return error(res, "❌ Failed to load refund", err);
  }
};

/* ============================================================
   📌 DELETE Refund
============================================================ */
export const deleteRefund = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { id } = req.params;
    const record = await Refund.findByPk(id, { transaction: t });
    if (!record) {
      await t.rollback();
      return error(res, "❌ Refund not found", null, 404);
    }

    await record.update({ deleted_by_id: req.user?.id || null }, { transaction: t });
    await record.destroy({ transaction: t });
    await t.commit();

    const full = await Refund.findOne({ where: { id }, include: REFUND_INCLUDES, paranoid: false });

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "delete",
      entityId: id,
      entity: full,
    });

    return success(res, "✅ Refund deleted", full);
  } catch (err) {
    await t.rollback();
    return error(res, "❌ Failed to delete refund", err);
  }
};
/* ============================================================
   📌 GET Refunds Lite
============================================================ */
export const getAllRefundsLite = async (req, res) => {
  try {
    const { q } = req.query;
    const role = (req.user?.roleNames?.[0] || "").toLowerCase();

    const where = {};
    if (!isSuperAdmin(req.user)) {
      where.organization_id = req.user.organization_id;
      if (role === "facility_head") where.facility_id = req.user.facility_id;
    }

    if (q) {
      where[Op.or] = [
        { reason: { [Op.iLike]: `%${q}%` } },
        { status: { [Op.iLike]: `%${q}%` } },
      ];
    }

    const refunds = await Refund.findAll({
      where,
      attributes: ["id", "amount", "reason", "status", "created_at"],
      include: [
        { model: Payment, as: "payment", attributes: ["id", "transaction_ref", "method"] },
        { model: Patient, as: "patient", attributes: ["id", "pat_no", "first_name", "last_name"] },
      ],
      order: [["created_at", "DESC"]],
      limit: 20,
    });

    const result = refunds.map((r) => ({
      id: r.id,
      amount: r.amount,
      status: r.status,
      reason: r.reason,
      method: r.payment ? r.payment.method : "", // ✅ safe pull from Payment
      payment: r.payment ? r.payment.transaction_ref : "",
      patient: r.patient ? `${r.patient.pat_no} - ${r.patient.first_name} ${r.patient.last_name}` : "",
      created_at: r.created_at,
    }));

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "list_lite",
      details: { count: result.length, query: q || null },
    });

    return success(res, "✅ Refunds loaded (lite)", { records: result });
  } catch (err) {
    return error(res, "❌ Failed to load refunds (lite)", err);
  }
};

/* ============================================================
   📌 APPROVE Refund (pending → approved)
============================================================ */
export const approveRefund = async (req, res) => {
  try {
    const { id } = req.params;
    const { refund } = await financialService.approveRefund(id, req.user);

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "approve",
      entityId: id,
      entity: refund,
    });

    return success(res, "✅ Refund approved", refund);
  } catch (err) {
    console.error("approveRefund error:", err);
    return error(res, "❌ Failed to approve refund", err);
  }
};

/* ============================================================
   📌 PROCESS Refund (approved → processed, ledger + invoice)
============================================================ */
export const processRefund = async (req, res) => {
  try {
    const { id } = req.params;
    const { refund, invoice } = await financialService.processRefund(id, req.user);

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "process",
      entityId: id,
      entity: refund,
      details: { invoice },
    });

    return success(res, "✅ Refund processed", { refund, invoice });
  } catch (err) {
    console.error("processRefund error:", err);
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
      return error(res, "❌ Only admin/superadmin can reverse refunds", null, 403);
    }

    const { id } = req.params;
    const result = await financialService.reverseRefund(id, req.user);

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "reverse",
      entityId: id,
      entity: result.refund,
      details: { reason: req.body?.reason || "manual reversal" },
    });

    return success(res, result.message || "✅ Refund reversed", result);
  } catch (err) {
    console.error("reverseRefund error:", err);
    return error(res, "❌ Failed to reverse refund", err);
  }
};

/* ============================================================
   📌 REJECT Refund (pending → rejected)
============================================================ */
export const rejectRefund = async (req, res) => {
  try {
    const { id } = req.params;
    const reason = req.body?.reason;
    if (!reason) {
      return error(res, "❌ Reason required to reject refund", null, 400);
    }

    const { refund } = await financialService.rejectRefund(id, reason, req.user);

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "reject",
      entityId: id,
      entity: refund,
    });

    return success(res, "✅ Refund rejected", refund);
  } catch (err) {
    console.error("rejectRefund error:", err);
    return error(res, "❌ Failed to reject refund", err);
  }
};

/* ============================================================
   📌 CANCEL Refund (pending/approved → cancelled)
============================================================ */
export const cancelRefund = async (req, res) => {
  try {
    const { id } = req.params;
    const reason = req.body?.reason;
    if (!reason) {
      return error(res, "❌ Reason required to cancel refund", null, 400);
    }

    const { refund } = await financialService.cancelRefund(id, reason, req.user);

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "cancel",
      entityId: id,
      entity: refund,
    });

    return success(res, "✅ Refund cancelled", refund);
  } catch (err) {
    console.error("cancelRefund error:", err);
    return error(res, "❌ Failed to cancel refund", err);
  }
};
/* ============================================================
   📌 VOID Refund (any → voided)
============================================================ */
export const voidRefund = async (req, res) => {
  try {
    const { id } = req.params;
    const reason = req.body?.reason || "manual void";
    const result = await financialService.voidRefund(id, reason, req.user);

    await auditService.logAction({
      user: req.user,
      module: "refund",
      action: "void",
      entityId: id,
      entity: result.refund,
      details: { reason },
    });

    return success(res, "✅ Refund voided", result.refund);
  } catch (err) {
    console.error("voidRefund error:", err);
    return error(res, "❌ Failed to void refund", err);
  }
};

/* ============================================================
   📌 RESTORE Refund (voided/reversed → pending)
============================================================ */
export const restoreRefund = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await financialService.restoreRefund(id, req.user);

    await auditService.logAction({
      user: req.user,
      module: "refund",
      action: "restore",
      entityId: id,
      entity: result.refund,
    });

    return success(res, "✅ Refund restored", result.refund);
  } catch (err) {
    console.error("restoreRefund error:", err);
    return error(res, "❌ Failed to restore refund", err);
  }
};
