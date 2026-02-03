// 📁 backend/src/controllers/paymentController.js
import Joi from "joi";
import { Op } from "sequelize";
import {
  sequelize,
  Payment,
  Invoice,
  Patient,
  Organization,
  Facility,
  User,
  Refund,
} from "../models/index.js";

import { success, error } from "../utils/response.js";
import { buildQueryOptions } from "../utils/queryHelper.js";
import { validatePaginationStrict } from "../utils/query-utils.js";
import { normalizeDateRangeLocal } from "../utils/date-utils.js";
import { resolveOrgFacility } from "../utils/resolveOrgFacility.js";
import { validate } from "../utils/validation.js";

import {
  isSuperAdmin,
  isOrgLevelUser,
  isFacilityHead,
} from "../utils/role-utils.js";
import { makeModuleLogger } from "../utils/debugLogger.js";

import {
  PAYMENT_STATUS,
  PAYMENT_METHODS,
  REFUND_STATUS,
} from "../constants/enums.js";

import { authzService } from "../services/authzService.js";
import { auditService } from "../services/auditService.js";
import { financialService } from "../services/financialService.js";
import { FIELD_VISIBILITY_PAYMENT } from "../constants/fieldVisibility.js";

/* ============================================================
   🔐 MODULE
============================================================ */
const MODULE_KEY = "payment";

/* ============================================================
   🔧 LOCAL DEBUG OVERRIDE
============================================================ */
const DEBUG_OVERRIDE = false;
const debug = makeModuleLogger("paymentController", DEBUG_OVERRIDE);

/* ============================================================
   🔖 STATUS MAPS (ENUM-SAFE, MASTER STYLE)
============================================================ */
const PS = {
  PENDING: PAYMENT_STATUS[0],
  COMPLETED: PAYMENT_STATUS[1],
  FAILED: PAYMENT_STATUS[2],
  CANCELLED: PAYMENT_STATUS[3],
  REVERSED: PAYMENT_STATUS[4],
  VOIDED: PAYMENT_STATUS[5],
  VERIFIED: PAYMENT_STATUS[6],
};

const RS = {
  PENDING: REFUND_STATUS[0],
  APPROVED: REFUND_STATUS[1],
  REJECTED: REFUND_STATUS[2],
  PROCESSED: REFUND_STATUS[3],
  CANCELLED: REFUND_STATUS[4],
  REVERSED: REFUND_STATUS[5],
};

/* ============================================================
   🔒 Guard: Prevent Overpayment on Status Finalization
============================================================ */
async function assertInvoiceBalanceBeforeFinalize(payment, t) {
  const invoice = await Invoice.findByPk(payment.invoice_id, {
    attributes: [
      "id",
      "total",
      "total_paid",
      "refunded_amount",
      "applied_deposits",
    ],
    transaction: t,
    lock: t.LOCK.UPDATE,
  });

  if (!invoice) {
    throw new Error("❌ Invoice not found");
  }

  const total = Number(invoice.total || 0);
  const paid =
    Number(invoice.total_paid || 0) +
    Number(invoice.applied_deposits || 0);
  const refunded = Number(invoice.refunded_amount || 0);

  const remaining = Number((total - paid - refunded).toFixed(2));

  if (Number(payment.amount) > remaining) {
    throw new Error(
      `❌ Payment (${payment.amount}) exceeds remaining invoice balance (${remaining})`
    );
  }
}

/* ============================================================
   🔗 SHARED INCLUDES (MASTER PARITY)
============================================================ */
const PAYMENT_INCLUDES = [
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
  { model: Organization, as: "organization", attributes: ["id", "name", "code"] },
  {
    model: Facility,
    as: "facility",
    attributes: ["id", "name", "code", "organization_id"],
  },
  { model: User, as: "createdBy", attributes: ["id", "first_name", "last_name"] },
  { model: User, as: "updatedBy", attributes: ["id", "first_name", "last_name"] },
  { model: User, as: "deletedBy", attributes: ["id", "first_name", "last_name"] },
];

/* ============================================================
   📋 ROLE-AWARE JOI SCHEMA (MASTER PARITY)
============================================================ */
function buildPaymentSchema(userRole, mode = "create") {
  const base = {
    invoice_id: Joi.string().uuid().required(),
    patient_id: Joi.string().uuid().required(),
    amount: Joi.number().positive().required(),
    method: Joi.string().valid(...PAYMENT_METHODS).required(),
    transaction_ref: Joi.string().allow(null, ""),
    is_deposit: Joi.boolean().forbidden(), // 🔒 payments ≠ deposits
    status: Joi.forbidden(),               // lifecycle is service-controlled
  };

  if (mode === "update") {
    Object.keys(base).forEach((k) => (base[k] = base[k].optional()));
    base.reason = Joi.string().min(5).required();
  }

  // ✅ SUPER ADMIN MAY PASS TENANT (resolved server-side)
  if (userRole === "superadmin") {
    base.organization_id = Joi.string().uuid().optional();
    base.facility_id = Joi.string().uuid().allow(null).optional();
  } else {
    // 🔒 everyone else forbidden
    base.organization_id = Joi.forbidden();
    base.facility_id = Joi.forbidden();
  }

  return Joi.object(base);
}
/* ============================================================
   📌 CREATE PAYMENT (MASTER PARITY – TENANT RESOLVED)
============================================================ */
export const createPayment = async (req, res) => {
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

    const { value, error: validationError } = validate(
      buildPaymentSchema(role, "create"),
      req.body
    );

    if (validationError) {
      await t.rollback();
      return error(res, "Validation failed", validationError, 400);
    }

    /* ========================================================
       🧭 TENANT RESOLUTION (MASTER)
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

    /* ========================================================
       🔒 INVOICE BALANCE GUARD (LOCKED)
    ======================================================== */
    const invoiceRecord = await Invoice.findByPk(value.invoice_id, {
      attributes: [
        "id",
        "total",
        "total_paid",
        "refunded_amount",
        "applied_deposits",
      ],
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    if (!invoiceRecord) {
      await t.rollback();
      return error(res, "❌ Invoice not found", null, 404);
    }

    const total = Number(invoiceRecord.total || 0);
    const paid =
      Number(invoiceRecord.total_paid || 0) +
      Number(invoiceRecord.applied_deposits || 0);
    const refunded = Number(invoiceRecord.refunded_amount || 0);
    const remaining = Number((total - paid - refunded).toFixed(2));

    if (Number(value.amount) > remaining) {
      await t.rollback();
      return error(
        res,
        `❌ Payment cannot exceed invoice balance (${remaining})`,
        null,
        400
      );
    }

    /* ========================================================
       💰 APPLY PAYMENT (SERVICE)
    ======================================================== */
    const { payment, invoice } = await financialService.applyPayment({
      ...value,
      organization_id: orgId,
      facility_id: facilityId,
      user: req.user,
      t,
    });

    await t.commit();

    const full = await Payment.findOne({
      where: { id: payment.id },
      include: PAYMENT_INCLUDES,
    });

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "create",
      entityId: payment.id,
      entity: full,
    });

    return success(res, "✅ Payment created", { payment: full, invoice });
  } catch (err) {
    if (t && !t.finished) await t.rollback();
    return error(res, "❌ Failed to create payment", err);
  }
};
/* ============================================================
   📌 UPDATE PAYMENT (MASTER PARITY – TENANT SAFE)
============================================================ */
export const updatePayment = async (req, res) => {
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

    const { value, error: validationError } = validate(
      buildPaymentSchema(role, "update"),
      req.body
    );

    if (validationError) {
      await t.rollback();
      return error(res, "Validation failed", validationError, 400);
    }

    /* ========================================================
       🔒 LOCK ONLY PAYMENT TABLE (CRITICAL FIX)
    ======================================================== */
    const record = await Payment.findByPk(req.params.id, {
      transaction: t,
      lock: {
        level: t.LOCK.UPDATE,
        of: Payment, // ✅ THIS FIXES THE ERROR
      },
    });

    if (!record) {
      await t.rollback();
      return error(res, "❌ Payment not found", null, 404);
    }

    // 🔒 Deposits are not editable here
    if (record.is_deposit) {
      await t.rollback();
      return error(
        res,
        "❌ Deposits must be managed via the Deposit module",
        null,
        400
      );
    }

    // 🔒 Only pending payments are editable
    if (record.status !== PS.PENDING) {
      await t.rollback();
      return error(
        res,
        "❌ Only pending payments can be updated",
        null,
        400
      );
    }

    /* ========================================================
       🔎 LOAD REFUNDS (NO LOCK, NO JOIN)
    ======================================================== */
    const refunds = await Refund.findAll({
      where: { payment_id: record.id },
      attributes: ["id", "amount", "status"],
      transaction: t,
    });

    /* ========================================================
       🛑 AMOUNT CHANGE GUARDS
    ======================================================== */
    if (
      value.amount &&
      Number(value.amount) !== Number(record.amount)
    ) {
      if (!value.reason) {
        await t.rollback();
        return error(
          res,
          "❌ Reason required when changing payment amount",
          null,
          400
        );
      }

      const processedRefunds = refunds
        .filter((r) => r.status === RS.PROCESSED)
        .reduce((sum, r) => sum + Number(r.amount || 0), 0);

      if (Number(value.amount) < processedRefunds) {
        await t.rollback();
        return error(
          res,
          `❌ Payment amount cannot be below processed refunds (${processedRefunds})`,
          null,
          400
        );
      }

      /* ====================================================
         🔒 LOCK INVOICE (SCOPED)
      ==================================================== */
      const invoiceRecord = await Invoice.findByPk(record.invoice_id, {
        attributes: [
          "id",
          "total",
          "total_paid",
          "refunded_amount",
          "applied_deposits",
        ],
        transaction: t,
        lock: {
          level: t.LOCK.UPDATE,
          of: Invoice,
        },
      });

      if (!invoiceRecord) {
        await t.rollback();
        return error(res, "❌ Invoice not found", null, 404);
      }

      const total = Number(invoiceRecord.total || 0);
      const paid =
        Number(invoiceRecord.total_paid || 0) +
        Number(invoiceRecord.applied_deposits || 0);
      const refunded = Number(invoiceRecord.refunded_amount || 0);

      const remaining = Number(
        (total - paid - refunded + Number(record.amount)).toFixed(2)
      );

      if (Number(value.amount) > remaining) {
        await t.rollback();
        return error(
          res,
          `❌ Edited amount exceeds invoice balance (${remaining})`,
          null,
          400
        );
      }
    }

    /* ========================================================
       💾 APPLY UPDATE
    ======================================================== */
    await record.update(
      { ...value, updated_by_id: req.user?.id || null },
      { transaction: t }
    );

    await t.commit();

    const full = await Payment.findOne({
      where: { id: record.id },
      include: PAYMENT_INCLUDES,
    });

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "update",
      entityId: record.id,
      entity: full,
    });

    return success(res, "✅ Payment updated", full);
  } catch (err) {
    if (t && !t.finished) await t.rollback();
    return error(res, "❌ Failed to update payment", err);
  }
};

/* ============================================================
   📌 REVERSE PAYMENT (MASTER PARITY)
============================================================ */
export const reversePayment = async (req, res) => {
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module: MODULE_KEY,
      action: "reverse",
      res,
    });
    if (!allowed) return;

    const { id } = req.params;

    const record = await Payment.findByPk(id);
    if (!record) {
      return error(res, "❌ Payment not found", null, 404);
    }

    await financialService.reverseTransaction({
      type: "payment",
      id,
      user: req.user,
      reason: req.body?.reason || "manual reversal",
    });

    const full = await Payment.findOne({
      where: { id },
      include: PAYMENT_INCLUDES,
      paranoid: false,
    });

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "reverse",
      entityId: id,
      entity: full,
      details: { reason: req.body?.reason || "manual reversal" },
    });

    return success(res, "✅ Payment reversed", full);
  } catch (err) {
    return error(res, "❌ Failed to reverse payment", err);
  }
};

/* ============================================================
   📌 DELETE PAYMENT (MASTER PARITY – TENANT SAFE)
============================================================ */
export const deletePayment = async (req, res) => {
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
      if (!isOrgLevelUser(req.user)) {
        where.facility_id = req.user.facility_id;
      }
    }

    const record = await Payment.findOne({
      where,
      transaction: t,
    });

    if (!record) {
      await t.rollback();
      return error(res, "❌ Payment not found", null, 404);
    }

    if (record.status !== PS.PENDING) {
      await t.rollback();
      return error(
        res,
        "❌ Only pending payments can be deleted",
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

    const full = await Payment.findOne({
      where: { id: record.id },
      include: PAYMENT_INCLUDES,
      paranoid: false,
    });

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "delete",
      entityId: record.id,
      entity: full,
    });

    return success(res, "✅ Payment deleted", full);
  } catch (err) {
    if (t && !t.finished) await t.rollback();
    return error(res, "❌ Failed to delete payment", err);
  }
};

/* ============================================================
   📌 GET ALL PAYMENTS (MASTER-ALIGNED – CONSULTATION PARITY)
============================================================ */
export const getAllPayments = async (req, res) => {
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module: MODULE_KEY,
      action: "read",
      res,
    });
    if (!allowed) return;

    /* ================= STRICT PAGINATION (MASTER) ================= */
    const { limit, page, offset } = validatePaginationStrict(req, {
      limit: 25,
      maxLimit: 200,
    });

    const role = (req.user?.roleNames?.[0] || "staff").toLowerCase();
    const visibleFields =
      FIELD_VISIBILITY_PAYMENT[role] || FIELD_VISIBILITY_PAYMENT.staff;

    /* ================= STRIP UI-ONLY PARAMS ================= */
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

    /* ================= DATE RANGE (created_at) ================= */
    if (dateRange) {
      const { start, end } = normalizeDateRangeLocal(dateRange);
      if (start && end) {
        options.where[Op.and].push({
          created_at: { [Op.between]: [start, end] },
        });
      }
    }

    /* ================= TENANT SCOPE (MASTER) ================= */
    if (!isSuperAdmin(req.user)) {
      options.where[Op.and].push({
        organization_id: req.user.organization_id,
      });

      if (!isOrgLevelUser(req.user)) {
        // staff / facility users → locked
        options.where[Op.and].push({
          facility_id: req.user.facility_id,
        });
      } else if (req.query.facility_id) {
        // org admin → filter allowed
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

    /* ================= FILTERS (EXACT MATCH) ================= */
    if (req.query.invoice_id) {
      options.where[Op.and].push({ invoice_id: req.query.invoice_id });
    }
    if (req.query.patient_id) {
      options.where[Op.and].push({ patient_id: req.query.patient_id });
    }
    if (req.query.method) {
      options.where[Op.and].push({ method: req.query.method });
    }
    if (req.query.status) {
      options.where[Op.and].push({ status: req.query.status });
    }

    /* ================= GLOBAL SEARCH (MASTER SAFE) ================= */
    if (options.search) {
      options.where[Op.and].push({
        [Op.or]: [
          { transaction_ref: { [Op.iLike]: `%${options.search}%` } },
        ],
      });
    }

    /* ================= MAIN QUERY ================= */
    const { count, rows } = await Payment.findAndCountAll({
      where: options.where,
      include: PAYMENT_INCLUDES,
      order: options.order,
      offset,
      limit,
      distinct: true,
    });

    /* ================= SUMMARY (FULL DATASET) ================= */
    const summary = { total: count };

    const statusCounts = await Payment.findAll({
      where: options.where,
      attributes: [
        "status",
        [sequelize.fn("COUNT", sequelize.col("id")), "count"],
      ],
      group: ["status"],
    });

    Object.values(PS).forEach((status) => {
      const found = statusCounts.find((s) => s.status === status);
      summary[status] = found ? Number(found.get("count")) : 0;
    });

    /* ================= AUDIT ================= */
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

    /* ================= RESPONSE ================= */
    return success(res, "✅ Payments loaded", {
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
    return error(res, "❌ Failed to load payments", err);
  }
};

/* ============================================================
   📌 GET PAYMENT BY ID (MASTER PARITY)
============================================================ */
export const getPaymentById = async (req, res) => {
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
      if (isFacilityHead(req.user)) {
        where.facility_id = req.user.facility_id;
      }
    } else {
      if (req.query.organization_id)
        where.organization_id = req.query.organization_id;
      if (req.query.facility_id)
        where.facility_id = req.query.facility_id;
    }

    const record = await Payment.findOne({
      where,
      include: PAYMENT_INCLUDES,
    });

    if (!record) {
      return error(res, "❌ Payment not found", null, 404);
    }

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "view",
      entityId: record.id,
      entity: record,
    });

    return success(res, "✅ Payment loaded", record);
  } catch (err) {
    return error(res, "❌ Failed to load payment", err);
  }
};

/* ============================================================
   📌 GET ALL PAYMENTS (LITE – AUTOCOMPLETE PARITY)
============================================================ */
export const getAllPaymentsLite = async (req, res) => {
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module: MODULE_KEY,
      action: "read",
      res,
    });
    if (!allowed) return;

    const { q, patient_id } = req.query;
    const where = { [Op.and]: [] };

    /* ================= TENANT SCOPE (MASTER) ================= */
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

    if (patient_id) {
      where[Op.and].push({ patient_id });
    }

    /* ================= SEARCH (SAFE – ENUM PROTECTED) ================= */
    if (q) {
      where[Op.and].push({
        [Op.or]: [
          { transaction_ref: { [Op.iLike]: `%${q}%` } },
          // ❌ DO NOT ilike enum method (caused your error)
        ],
      });
    }

    const payments = await Payment.findAll({
      where,
      attributes: [
        "id",
        "invoice_id",     // ✅ REQUIRED FOR REFUNDS
        "patient_id",     // ✅ REQUIRED FOR REFUNDS
        "amount",
        "method",
        "transaction_ref",
        "status",
        "created_at",
      ],
      include: [
        {
          model: Patient,
          as: "patient",
          attributes: ["id", "pat_no", "first_name", "last_name"],
        },
        {
          model: Invoice,
          as: "invoice",
          attributes: ["id", "invoice_number"],
        },
      ],
      order: [["created_at", "DESC"]],
      limit: 20,
    });

    const records = payments.map((p) => ({
      id: p.id,
      invoice_id: p.invoice_id,     // ✅ UI NEEDS THIS
      patient_id: p.patient_id,     // ✅ UI NEEDS THIS
      label: `${p.transaction_ref || p.id} - ${p.amount}`,
      amount: p.amount,
      method: p.method,
      patient: p.patient
        ? `${p.patient.pat_no} - ${p.patient.first_name} ${p.patient.last_name}`
        : "",
      invoice: p.invoice ? p.invoice.invoice_number : "",
      created_at: p.created_at,
    }));

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "list_lite",
      details: {
        count: records.length,
        patient_id: patient_id || null,
        query: q || null,
      },
    });

    return success(res, "Payments loaded (lite)", {
      records,
    });
  } catch (err) {
    return error(res, "❌ Failed to load payments (lite)", err);
  }
};

/* ============================================================
   📌 TOGGLE PAYMENT STATUS (LEDGER SAFE – MASTER PARITY)
============================================================ */
export const togglePaymentStatus = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module: MODULE_KEY,
      action: "update",
      res,
    });
    if (!allowed) return;

    const { id } = req.params;

    const record = await Payment.findByPk(id, {
      transaction: t,
      lock: t.LOCK.UPDATE,
    });
    if (!record) {
      await t.rollback();
      return error(res, "❌ Payment not found", null, 404);
    }

    const oldStatus = record.status;
    let newStatus = oldStatus;

    if (oldStatus === PS.PENDING) newStatus = PS.COMPLETED;
    else if (oldStatus === PS.COMPLETED) newStatus = PS.PENDING;

    if (oldStatus === PS.PENDING && newStatus === PS.COMPLETED) {
      await assertInvoiceBalanceBeforeFinalize(record, t);
    }

    if (newStatus !== oldStatus) {
      await record.update(
        {
          status: newStatus,
          updated_by_id: req.user?.id || null,
        },
        { transaction: t }
      );
    }

    await t.commit();

    const full = await Payment.findOne({
      where: { id },
      include: PAYMENT_INCLUDES,
    });

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "toggle_status",
      entityId: id,
      entity: full,
      details: { from: oldStatus, to: newStatus },
    });

    return success(
      res,
      newStatus !== oldStatus
        ? `✅ Payment status changed → ${newStatus}`
        : `ℹ️ Payment status unchanged (${oldStatus})`,
      full
    );
  } catch (err) {
    if (t && !t.finished) await t.rollback();
    return error(res, "❌ Failed to toggle payment status", err);
  }
};

/* ============================================================
   📌 COMPLETE PAYMENT (SERVICE-CONTROLLED FINALIZATION)
============================================================ */
export const completePayment = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module: MODULE_KEY,
      action: "update",
      res,
    });
    if (!allowed) return;

    const { id } = req.params;

    const record = await Payment.findByPk(id, {
      transaction: t,
      lock: t.LOCK.UPDATE,
    });
    if (!record) {
      await t.rollback();
      return error(res, "❌ Payment not found", null, 404);
    }

    if (record.status !== PS.PENDING) {
      await t.rollback();
      return error(
        res,
        `❌ Only pending payments can be completed (current: ${record.status})`,
        null,
        400
      );
    }

    await assertInvoiceBalanceBeforeFinalize(record, t);

    await record.update(
      {
        status: PS.COMPLETED,
        updated_by_id: req.user?.id || null,
      },
      { transaction: t }
    );

    await t.commit();

    const full = await Payment.findOne({
      where: { id },
      include: PAYMENT_INCLUDES,
    });

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "complete",
      entityId: id,
      entity: full,
      details: { to: PS.COMPLETED },
    });

    return success(res, "✅ Payment completed successfully", full);
  } catch (err) {
    if (t && !t.finished) await t.rollback();
    return error(res, "❌ Failed to complete payment", err);
  }
};

/* ============================================================
   📌 VERIFY PAYMENT (PARITY)
============================================================ */
export const verifyPayment = async (req, res) => {
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module: MODULE_KEY,
      action: "verify",
      res,
    });
    if (!allowed) return;

    const { id } = req.params;

    const record = await Payment.findByPk(id);
    if (!record) {
      return error(res, "❌ Payment not found", null, 404);
    }

    if (record.status !== PS.COMPLETED) {
      return error(
        res,
        "❌ Only completed payments can be verified",
        null,
        400
      );
    }

    await record.update({
      status: PS.VERIFIED,
      updated_by_id: req.user?.id || null,
    });

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "verify",
      entityId: id,
      entity: record,
      details: { to: PS.VERIFIED },
    });

    return success(res, "✅ Payment verified successfully", record);
  } catch (err) {
    return error(res, "❌ Failed to verify payment", err);
  }
};

/* ============================================================
   📌 VOID PAYMENT (SERVICE-CONTROLLED)
============================================================ */
export const voidPayment = async (req, res) => {
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module: MODULE_KEY,
      action: "void",
      res,
    });
    if (!allowed) return;

    const { id } = req.params;

    const record = await Payment.findByPk(id);
    if (!record) {
      return error(res, "❌ Payment not found", null, 404);
    }

    if ([PS.VERIFIED, PS.VOIDED].includes(record.status)) {
      return error(
        res,
        "❌ Cannot void a verified or already voided payment",
        null,
        400
      );
    }

    await record.update({
      status: PS.VOIDED,
      updated_by_id: req.user?.id || null,
    });

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "void",
      entityId: id,
      entity: record,
      details: { to: PS.VOIDED },
    });

    return success(res, "✅ Payment voided successfully", record);
  } catch (err) {
    return error(res, "❌ Failed to void payment", err);
  }
};

/* ============================================================
   ♻️ RESTORE PAYMENT (PARITY)
============================================================ */
export const restorePayment = async (req, res) => {
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module: MODULE_KEY,
      action: "restore",
      res,
    });
    if (!allowed) return;

    const { id } = req.params;

    const record = await Payment.findByPk(id);
    if (!record) {
      return error(res, "❌ Payment not found", null, 404);
    }

    if (![PS.CANCELLED, PS.VOIDED].includes(record.status)) {
      return error(
        res,
        `❌ Only cancelled or voided payments can be restored (current: ${record.status})`,
        null,
        400
      );
    }

    await record.update({
      status: PS.PENDING,
      updated_by_id: req.user?.id || null,
    });

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "restore",
      entityId: id,
      entity: record,
      details: { to: PS.PENDING },
    });

    return success(res, "✅ Payment restored successfully", record);
  } catch (err) {
    return error(res, "❌ Failed to restore payment", err);
  }
};
