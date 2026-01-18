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
import { PAYMENT_STATUS, PAYMENT_METHODS, REFUND_STATUS } from "../constants/enums.js";
import { authzService } from "../services/authzService.js";
import { auditService } from "../services/auditService.js";
import { financialService } from "../services/financialService.js";
import { FIELD_VISIBILITY_PAYMENT } from "../constants/fieldVisibility.js";
import { buildDynamicSummary } from "../utils/summaryHelper.js"; // 🧠 Summary Helper

const MODULE_KEY = "payment";


/* ============================================================
   🔖 Local enum maps
============================================================ */
const PS = {
  PENDING: PAYMENT_STATUS[0],     // "pending"
  COMPLETED: PAYMENT_STATUS[1],   // "completed"
  FAILED: PAYMENT_STATUS[2],      // "failed"
  CANCELLED: PAYMENT_STATUS[3],   // "cancelled"
  REVERSED: PAYMENT_STATUS[4],    // "reversed"
  VOIDED: PAYMENT_STATUS[5],      // "voided"
  VERIFIED: PAYMENT_STATUS[6],    // "verified"
};

const RS = {
  PENDING: REFUND_STATUS[0],      // "pending"
  APPROVED: REFUND_STATUS[1],     // "approved"
  REJECTED: REFUND_STATUS[2],     // "rejected"
  PROCESSED: REFUND_STATUS[3],    // "processed"
  CANCELLED: REFUND_STATUS[4],    // "cancelled"
  REVERSED: REFUND_STATUS[5],     // "reversed"
};

/* ============================================================
   🔧 HELPERS
============================================================ */
function isSuperAdmin(user) {
  if (!user) return false;
  const roles = Array.isArray(user.roleNames) ? user.roleNames : [user.role || ""];
  return roles.map(r => r.toLowerCase()).includes("superadmin");
}
/* ============================================================
   🔒 Guard: Prevent Overpayment on Status Finalization
   ------------------------------------------------------------
   - Recalculates live invoice balance
   - Locks invoice row to avoid race conditions
   - Blocks pending → completed / completed → verified
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
    lock: t.LOCK.UPDATE, // 🔒 critical: prevents concurrent overpayment
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
   🔗 SHARED INCLUDES
============================================================ */
const PAYMENT_INCLUDES = [
  { model: Invoice, as: "invoice", attributes: ["id", "invoice_number", "status", "total", "balance"] },
  { model: Patient, as: "patient", attributes: ["id", "pat_no", "first_name", "last_name"] },
  { model: Organization, as: "organization", attributes: ["id", "name", "code"] },
  { model: Facility, as: "facility", attributes: ["id", "name", "code", "organization_id"] },
  { model: User, as: "createdBy", attributes: ["id", "first_name", "last_name"] },
  { model: User, as: "updatedBy", attributes: ["id", "first_name", "last_name"] },
  { model: User, as: "deletedBy", attributes: ["id", "first_name", "last_name"] },
];

/* ============================================================
   📋 ROLE-BASED JOI SCHEMA FACTORY
============================================================ */
function buildPaymentSchema(userRole, mode = "create") {
  const base = {
    invoice_id: Joi.string().uuid().required(),
    patient_id: Joi.string().uuid().required(),
    amount: Joi.number().positive().required(),
    method: Joi.string().valid(...PAYMENT_METHODS).required(),
    transaction_ref: Joi.string().allow(null, ""),
    status: Joi.forbidden(), // 🚫 service decides status
    is_deposit: Joi.boolean().default(false),
  };

  if (mode === "update") {
    Object.keys(base).forEach(k => { base[k] = base[k].optional(); });
    base.reason = Joi.string().min(5).required(); // reason required for updates
  }

  switch (userRole) {
    case "superadmin":
      break;
    case "org_owner":
    case "admin":
    case "facility_head":
      base.organization_id = Joi.forbidden();
      base.facility_id = Joi.forbidden();
      break;
    default: // staff
      base.organization_id = Joi.forbidden();
      base.facility_id = Joi.forbidden();
      base.status = Joi.forbidden();
  }

  return Joi.object(base);
}

/* ============================================================
   📌 CREATE PAYMENT
============================================================ */
export const createPayment = async (req, res) => {
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module: MODULE_KEY,
      action: "create",
      res,
    });
    if (!allowed) return;

    const role = (req.user?.roleNames?.[0] || "").toLowerCase();
    const schema = buildPaymentSchema(role, "create");
    const { error: validationError, value } = schema.validate(req.body, {
      stripUnknown: true,
    });
    if (validationError)
      return error(res, "Validation failed", validationError, 400);

    // 🔒 Prevent deposits from being created via payment module
    if (value.is_deposit) {
      return error(
        res,
        "❌ Deposits cannot be created through Payment. Use Deposit module instead.",
        null,
        400
      );
    }

    // ============================================================
    // 🛑 INVOICE BALANCE VALIDATION (NEW)
    // Prevent paying above remaining balance
    // ============================================================
    const invoiceRecord = await Invoice.findByPk(value.invoice_id, {
      attributes: [
        "id",
        "total",
        "total_paid",
        "refunded_amount",
        "applied_deposits",
        "balance",
      ],
    });

    if (!invoiceRecord) {
      return error(res, "❌ Invoice not found", null, 404);
    }

    const total = parseFloat(invoiceRecord.total || 0);
    const alreadyPaid =
      parseFloat(invoiceRecord.total_paid || 0) +
      parseFloat(invoiceRecord.applied_deposits || 0);
    const refunded = parseFloat(invoiceRecord.refunded_amount || 0);

    // Effective balance BEFORE new payment
    const remaining = parseFloat(
      (total - alreadyPaid - refunded).toFixed(2)
    );

    const incoming = parseFloat(value.amount || 0);

    if (incoming > remaining) {
      return error(
        res,
        `❌ Payment cannot exceed invoice balance. Remaining balance = $${remaining}`,
        null,
        400
      );
    }

    // ============================================================

    const { payment, invoice } = await financialService.applyPayment({
      ...value,
      user: req.user,
    });

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
      details: value,
    });

    return success(res, "✅ Payment created", { payment: full, invoice });
  } catch (err) {
    return error(res, "❌ Failed to create payment", err);
  }
};

/* ============================================================
   📌 UPDATE PAYMENT
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

    const { id } = req.params;
    const role = (req.user?.roleNames?.[0] || "").toLowerCase();

    const schema = buildPaymentSchema(role, "update");
    const { error: validationError, value } = schema.validate(req.body, {
      stripUnknown: true,
    });
    if (validationError) {
      await t.rollback();
      return error(res, "Validation failed", validationError, 400);
    }

    const record = await Payment.findByPk(id, {
      include: [{ model: Refund, as: "refunds", attributes: ["id", "amount", "status"] }],
      transaction: t,
    });
    if (!record) {
      await t.rollback();
      return error(res, "❌ Payment not found", null, 404);
    }

    // 🔒 Block edits on deposits
    if (record.is_deposit) {
      await t.rollback();
      return error(
        res,
        "❌ Deposits must be managed via the Deposit module, not Payment.",
        null,
        400
      );
    }

    // ------------------------------------------------------------
    // 🛑 If user is changing the amount → VALIDATE AGAINST INVOICE
    // ------------------------------------------------------------
    if (
      value.amount &&
      parseFloat(value.amount) !== parseFloat(record.amount)
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

      // 1️⃣ Prevent reducing below processed refunds
      const processedRefunds = record.refunds
        .filter((r) => r.status === "processed")
        .reduce((sum, r) => sum + parseFloat(r.amount || 0), 0);

      if (parseFloat(value.amount) < processedRefunds) {
        await t.rollback();
        return error(
          res,
          `❌ Payment amount cannot be set below total processed refunds (${processedRefunds})`,
          null,
          400
        );
      }

      // 2️⃣ Prevent editing to exceed invoice balance
      const invoiceRecord = await Invoice.findByPk(record.invoice_id, {
        attributes: [
          "id",
          "total",
          "total_paid",
          "refunded_amount",
          "applied_deposits",
          "balance",
        ],
      });

      if (!invoiceRecord) {
        await t.rollback();
        return error(res, "❌ Invoice not found", null, 404);
      }

      const total = parseFloat(invoiceRecord.total || 0);
      const alreadyPaid =
        parseFloat(invoiceRecord.total_paid || 0) +
        parseFloat(invoiceRecord.applied_deposits || 0);
      const refunded = parseFloat(invoiceRecord.refunded_amount || 0);

      const remaining = parseFloat(
        (total - alreadyPaid - refunded + parseFloat(record.amount || 0)).toFixed(2)
      );

      const incoming = parseFloat(value.amount || 0);

      if (incoming > remaining) {
        await t.rollback();
        return error(
          res,
          `❌ Edited amount cannot exceed invoice remaining balance (${remaining})`,
          null,
          400
        );
      }
    }

    // ------------------------------------------------------------

    await record.update(
      { ...value, updated_by_id: req.user?.id || null },
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
      action: "update",
      entityId: id,
      entity: full,
      details: value,
    });

    return success(res, "✅ Payment updated", full);
  } catch (err) {
    if (t && !t.finished) await t.rollback();
    return error(res, "❌ Failed to update payment", err);
  }
};

/* ============================================================
   📌 REVERSE PAYMENT
============================================================ */
export const reversePayment = async (req, res) => {
  try {
    const role = (req.user?.roleNames?.[0] || "").toLowerCase();
    if (!["admin", "superadmin"].includes(role)) {
      return error(
        res,
        "❌ Only admin/superadmin can reverse payments",
        null,
        403
      );
    }

    const { id } = req.params;
    const record = await Payment.findByPk(id);
    if (!record) return error(res, "❌ Payment not found", null, 404);

    // ✅ Reverse via service (handles status update to PS.CANCELLED)
    await financialService.reverseTransaction({
      type: "payment",
      id,
      user: req.user,
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
   📌 DELETE PAYMENT
============================================================ */
export const deletePayment = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const allowed = await authzService.checkPermission({ user: req.user, module: MODULE_KEY, action: "delete", res });
    if (!allowed) return;

    const { id } = req.params;
    const role = (req.user?.roleNames?.[0] || "").toLowerCase();

    const where = { id };
    if (!isSuperAdmin(req.user)) {
      where.organization_id = req.user.organization_id;
      if (role === "facility_head") where.facility_id = req.user.facility_id;
    }

    const record = await Payment.findOne({ where, transaction: t });
    if (!record) { await t.rollback(); return error(res, "❌ Payment not found", null, 404); }

    await record.update({ deleted_by_id: req.user?.id || null }, { transaction: t });
    await record.destroy({ transaction: t });

    await t.commit();

    const full = await Payment.findOne({ where: { id }, include: PAYMENT_INCLUDES, paranoid: false });

    await auditService.logAction({
      user: req.user, module: MODULE_KEY, action: "delete", entityId: id, entity: full,
    });

    return success(res, "✅ Payment deleted", full);
  } catch (err) {
    if (t && !t.finished) await t.rollback();
    return error(res, "❌ Failed to delete payment", err);
  }
};

/* ============================================================
   📌 GET ALL PAYMENTS (Enterprise Pattern + FLAT Summary)
============================================================ */
export const getAllPayments = async (req, res) => {
  try {
    /* ================= PERMISSION ================= */
    const allowed = await authzService.checkPermission({
      user: req.user,
      module: MODULE_KEY,
      action: "read",
      res,
    });
    if (!allowed) return;

    const role = (req.user?.roleNames?.[0] || "staff").toLowerCase();
    const visibleFields =
      FIELD_VISIBILITY_PAYMENT[role] || FIELD_VISIBILITY_PAYMENT.staff;

    /* ================= QUERY OPTIONS ================= */
    const options = buildQueryOptions(req, "created_at", "DESC", visibleFields);
    options.where = options.where || {};

    /* ================= MULTI-TENANT SCOPE ================= */
    if (!isSuperAdmin(req.user)) {
      options.where.organization_id = req.user.organization_id;
      if (role === "facility_head") {
        options.where.facility_id = req.user.facility_id;
      }
    } else {
      if (req.query.organization_id)
        options.where.organization_id = req.query.organization_id;
      if (req.query.facility_id)
        options.where.facility_id = req.query.facility_id;
    }

    /* ================= FILTERS ================= */
    if (req.query.invoice_id) options.where.invoice_id = req.query.invoice_id;
    if (req.query.patient_id) options.where.patient_id = req.query.patient_id;
    if (req.query.method) options.where.method = req.query.method;
    if (req.query.status) options.where.status = req.query.status;

    /* ================= DATE FILTERS ================= */
    if (req.query["created_at[gte]"]) {
      options.where.created_at = {
        ...(options.where.created_at || {}),
        [Op.gte]: req.query["created_at[gte]"],
      };
    }
    if (req.query["created_at[lte]"]) {
      options.where.created_at = {
        ...(options.where.created_at || {}),
        [Op.lte]: req.query["created_at[lte]"],
      };
    }

    /* ================= SMART SEARCH ================= */
    if (options.search) {
      const term = `%${options.search}%`;
      options.where[Op.or] = [
        { transaction_ref: { [Op.iLike]: term } },
        { method: { [Op.iLike]: term } },
        { status: { [Op.iLike]: term } },
        { "$patient.first_name$": { [Op.iLike]: term } },
        { "$patient.last_name$": { [Op.iLike]: term } },
        { "$invoice.invoice_number$": { [Op.iLike]: term } },
      ];

      options.include = options.include || [];
      if (!options.include.find((i) => i.as === "patient")) {
        options.include.push({
          model: Patient,
          as: "patient",
          attributes: [],
        });
      }
      if (!options.include.find((i) => i.as === "invoice")) {
        options.include.push({
          model: Invoice,
          as: "invoice",
          attributes: [],
        });
      }
    }

    /* ================= FETCH RECORDS ================= */
    const { count, rows } = await Payment.findAndCountAll({
      where: options.where,
      include: [...PAYMENT_INCLUDES, ...(options.include || [])],
      order: options.order,
      offset: options.offset,
      limit: options.limit,
      distinct: true,
    });

    /* ================= RAW SUMMARY ================= */
    const rawSummary = await buildDynamicSummary({
      model: Payment,
      options,
      statusEnums: Object.values(PAYMENT_STATUS),
      includeGender: true,
      genderJoin: { model: Patient, as: "patient" },
    });

    /* ============================================================
       🔄 FLATTEN SUMMARY (API CONTRACT – CRITICAL)
       ✔ No nested objects
       ✔ Clear meaning
       ✔ Frontend-agnostic
    ============================================================ */
    const summary = {
      /* ---- totals ---- */
      total_payments: rawSummary?.total_payments ?? 0,
      total_amount: rawSummary?.total_amount ?? 0,

      /* ---- status counts ---- */
      pending: rawSummary?.by_status?.pending ?? 0,
      completed: rawSummary?.by_status?.completed ?? 0,
      verified: rawSummary?.by_status?.verified ?? 0,
      cancelled: rawSummary?.by_status?.cancelled ?? 0,
      failed: rawSummary?.by_status?.failed ?? 0,
      reversed: rawSummary?.by_status?.reversed ?? 0,
      voided: rawSummary?.by_status?.voided ?? 0,

      /* ---- payment methods ---- */
      cash: rawSummary?.by_method?.cash ?? 0,
      card: rawSummary?.by_method?.card ?? 0,
      transfer: rawSummary?.by_method?.transfer ?? 0,
      mobile_money: rawSummary?.by_method?.mobile_money ?? 0,
      cheque: rawSummary?.by_method?.cheque ?? 0,

      /* ---- shared breakdowns ---- */
      gender_breakdown: rawSummary?.gender_breakdown || {},
    };

    /* ================= TRANSFORM RECORDS ================= */
    const records = rows.map((r) => {
      const plain = r.get({ plain: true });

      const patientLabel = plain.patient
        ? `${plain.patient.pat_no} - ${plain.patient.first_name} ${plain.patient.last_name}`
        : "Unknown Patient";

      const invoiceLabel = plain.invoice
        ? `${plain.invoice.invoice_number} (Bal: ${plain.invoice.balance})`
        : "No Invoice";

      const dateLabel = plain.created_at
        ? new Date(plain.created_at).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          })
        : "Unknown Date";

      return {
        ...plain,
        label: `${dateLabel} · ${patientLabel} · ${invoiceLabel} · ${plain.amount} ${plain.method}`,
        patient_label: patientLabel,
        invoice_label: invoiceLabel,
      };
    });

    /* ================= AUDIT ================= */
    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "list",
      details: { query: req.query, returned: count },
    });

    /* ================= RESPONSE ================= */
    return success(res, "✅ Payments loaded", {
      records,
      pagination: {
        total: count,
        page: options.pagination.page,
        pageCount: Math.ceil(count / options.pagination.limit),
      },
      summary, // ✅ FLAT, CLEAR, SCALABLE
    });
  } catch (err) {
    return error(res, "❌ Failed to load payments", err);
  }
};

/* ============================================================
   📌 GET PAYMENT BY ID
============================================================ */
export const getPaymentById = async (req, res) => {
  try {
    const allowed = await authzService.checkPermission({ user: req.user, module: MODULE_KEY, action: "read", res });
    if (!allowed) return;

    const { id } = req.params;
    const role = (req.user?.roleNames?.[0] || "staff").toLowerCase();

    const where = { id };
    if (!isSuperAdmin(req.user)) {
      where.organization_id = req.user.organization_id;
      if (role === "facility_head") where.facility_id = req.user.facility_id;
    } else {
      if (req.query.organization_id) where.organization_id = req.query.organization_id;
      if (req.query.facility_id) where.facility_id = req.query.facility_id;
    }

    const record = await Payment.findOne({ where, include: PAYMENT_INCLUDES });
    if (!record) return error(res, "❌ Payment not found", null, 404);

    const plain = record.get({ plain: true });
    const patientLabel = plain.patient ? `${plain.patient.pat_no} - ${plain.patient.first_name} ${plain.patient.last_name}` : "Unknown Patient";
    const invoiceLabel = plain.invoice ? `${plain.invoice.invoice_number} (Bal: ${plain.invoice.balance})` : "No Invoice";

    plain.label = `${patientLabel} · ${invoiceLabel} · ${plain.amount} ${plain.method}`;
    plain.patient_label = patientLabel;
    plain.invoice_label = invoiceLabel;

    await auditService.logAction({
      user: req.user, module: MODULE_KEY, action: "view",
      entityId: id, entity: plain,
    });

    return success(res, "✅ Payment loaded", plain);
  } catch (err) {
    return error(res, "❌ Failed to load payment", err);
  }
};

/* ============================================================
   📌 GET ALL PAYMENTS LITE (with refundable balance)
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

    const { q, status, is_deposit } = req.query;
    const role = (req.user?.roleNames?.[0] || "").toLowerCase();

    const where = {};
    if (!isSuperAdmin(req.user)) {
      where.organization_id = req.user.organization_id;
      if (role === "facility_head") where.facility_id = req.user.facility_id;
    } else {
      if (req.query.organization_id) where.organization_id = req.query.organization_id;
      if (req.query.facility_id) where.facility_id = req.query.facility_id;
    }

    // Filters
    if (req.query.invoice_id || req.query.invoiceId)
      where.invoice_id = req.query.invoice_id || req.query.invoiceId;

    if (req.query.patient_id || req.query.patientId)
      where.patient_id = req.query.patient_id || req.query.patientId;

    if (status) {
      where.status = { [Op.in]: status.split(",").map((s) => s.trim().toLowerCase()) };
    }

    if (typeof is_deposit !== "undefined") {
      where.is_deposit = is_deposit === "true";
    }

    if (q) {
      where[Op.or] = [
        { transaction_ref: { [Op.iLike]: `%${q}%` } },
        { method: { [Op.iLike]: `%${q}%` } },
      ];
    }

    const payments = await Payment.findAll({
      where,
      attributes: [
        "id",
        "amount",
        "method",
        "transaction_ref",
        "status",
        "is_deposit",
        "created_at",
      ],
      include: [
        { model: Invoice, as: "invoice", attributes: ["id", "invoice_number"] },
        { model: Patient, as: "patient", attributes: ["id", "pat_no", "first_name", "last_name"] },
        { model: Refund, as: "refunds", attributes: ["id", "amount", "status"] },
      ],
      order: [["created_at", "DESC"]],
      limit: 20,
    });

    /* ============================================================
       🧮 Compute total refunded + refundable_balance
    ============================================================ */
    const result = payments
      .map((p) => {
        const paid = Number(p.amount || 0);

        const processedRefunds = (p.refunds || [])
          .filter((r) => r.status === "processed")
          .reduce((sum, r) => sum + Number(r.amount || 0), 0);

        const refundableBalance = paid - processedRefunds;

        if (refundableBalance <= 0) return null;

        return {
          id: p.id,
          amount: paid.toFixed(2),
          refunded_amount: processedRefunds.toFixed(2),
          refundable_balance: refundableBalance.toFixed(2),
          method: p.method,
          transaction_ref: p.transaction_ref,
          is_deposit: p.is_deposit,
          status: p.status,
          invoice_id: p.invoice?.id || null,
          invoice: p.invoice?.invoice_number || "No Invoice",
          patient: p.patient
            ? `${p.patient.pat_no} - ${p.patient.first_name} ${p.patient.last_name}`
            : "Unknown",
          created_at: p.created_at,

          // 🔥 This is what the frontend dropdown uses
          label: `${p.invoice?.invoice_number || "No Invoice"} · Paid $${paid.toFixed(
            2
          )} (${p.method}) | Refunded $${processedRefunds.toFixed(
            2
          )} | Balance $${refundableBalance.toFixed(2)}`
        };
      })
      .filter(Boolean);

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "list_lite",
      details: { count: result.length, query: q || null },
    });

    return success(res, "✅ Payments loaded (lite)", { records: result });
  } catch (err) {
    return error(res, "❌ Failed to load payments (lite)", err);
  }
};

/* ============================================================
   📌 TOGGLE PAYMENT STATUS
   ------------------------------------------------------------
   🔒 Guards against overpayment when moving into COMPLETED
   🔒 Uses transaction + row lock to avoid race conditions
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

    /* ------------------------------------------------------------
       🔎 Load payment inside transaction
    ------------------------------------------------------------ */
    const record = await Payment.findByPk(id, { transaction: t });
    if (!record) {
      await t.rollback();
      return error(res, "❌ Payment not found", null, 404);
    }

    const oldStatus = record.status;
    let newStatus = oldStatus;

    /* ------------------------------------------------------------
       🔁 Toggle rules (explicit, no magic strings)
    ------------------------------------------------------------ */
    if (oldStatus === PS.PENDING) newStatus = PS.COMPLETED;
    else if (oldStatus === PS.COMPLETED) newStatus = PS.PENDING;

    /* ------------------------------------------------------------
       🔒 CRITICAL GUARD
       Prevent overpayment when FINALIZING payment
       (pending → completed)
    ------------------------------------------------------------ */
    if (oldStatus === PS.PENDING && newStatus === PS.COMPLETED) {
      await assertInvoiceBalanceBeforeFinalize(record, t);
    }

    /* ------------------------------------------------------------
       💾 Apply status update
    ------------------------------------------------------------ */
    if (newStatus !== oldStatus) {
      await record.update(
        { status: newStatus, updated_by_id: req.user?.id || null },
        { transaction: t }
      );
    }

    await t.commit();

    /* ------------------------------------------------------------
       📦 Reload full record for response
    ------------------------------------------------------------ */
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
        ? `✅ Payment status changed from ${oldStatus} → ${newStatus}`
        : `ℹ️ Payment status unchanged (${oldStatus})`,
      full
    );
  } catch (err) {
    if (t && !t.finished) await t.rollback();
    return error(res, "❌ Failed to toggle payment status", err);
  }
};

/* ============================================================
   📌 COMPLETE PAYMENT
   ------------------------------------------------------------
   🔒 Explicit endpoint to finalize payment
   🔒 Same overpayment protection as toggle
   🔒 Uses transaction + invoice lock
============================================================ */
export const completePayment = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { id } = req.params;

    /* ------------------------------------------------------------
       🔎 Load payment inside transaction
    ------------------------------------------------------------ */
    const record = await Payment.findByPk(id, { transaction: t });
    if (!record) {
      await t.rollback();
      return error(res, "❌ Payment not found", null, 404);
    }

    /* ------------------------------------------------------------
       🚫 Status validation
    ------------------------------------------------------------ */
    if (record.status !== PS.PENDING) {
      await t.rollback();
      return error(
        res,
        `⚠️ Only pending payments can be completed (current: ${record.status})`
      );
    }

    /* ------------------------------------------------------------
       🔒 CRITICAL GUARD
       Prevent completing payment beyond invoice balance
    ------------------------------------------------------------ */
    await assertInvoiceBalanceBeforeFinalize(record, t);

    /* ------------------------------------------------------------
       💾 Finalize payment
    ------------------------------------------------------------ */
    await record.update(
      { status: PS.COMPLETED, updated_by_id: req.user?.id || null },
      { transaction: t }
    );

    await t.commit();

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "complete",
      entityId: id,
      entity: record,
      details: { to: PS.COMPLETED },
    });

    return success(res, "✅ Payment marked as completed", record);
  } catch (err) {
    if (t && !t.finished) await t.rollback();
    return error(res, "❌ Failed to complete payment", err);
  }
};

/* ============================================================
   🧾 VERIFY PAYMENT
============================================================ */
export const verifyPayment = async (req, res) => {
  try {
    const { id } = req.params;
    const record = await Payment.findByPk(id);
    if (!record) return error(res, "❌ Payment not found", null, 404);
    if (record.status !== "completed")
      return error(res, "⚠️ Only completed payments can be verified");

    record.status = "verified";
    await record.save();

    await auditService.logAction({
      user: req.user, module: MODULE_KEY, action: "verify",
      entityId: id, entity: record, details: { to: "verified" },
    });

    return success(res, "✅ Payment verified successfully", record);
  } catch (err) {
    return error(res, "❌ Failed to verify payment", err);
  }
};

/* ============================================================
   ❌ VOID PAYMENT
============================================================ */
export const voidPayment = async (req, res) => {
  try {
    const { id } = req.params;
    const record = await Payment.findByPk(id);
    if (!record) return error(res, "❌ Payment not found", null, 404);
    if (["verified", "voided"].includes(record.status))
      return error(res, "⚠️ Cannot void a verified or already voided payment");

    record.status = "voided";
    await record.save();

    await auditService.logAction({
      user: req.user, module: MODULE_KEY, action: "void",
      entityId: id, entity: record, details: { to: "voided" },
    });

    return success(res, "✅ Payment voided", record);
  } catch (err) {
    return error(res, "❌ Failed to void payment", err);
  }
};

/* ============================================================
   ♻️ RESTORE PAYMENT
============================================================ */
export const restorePayment = async (req, res) => {
  try {
    const { id } = req.params;
    const record = await Payment.findByPk(id);
    if (!record) return error(res, "❌ Payment not found", null, 404);
    if (!["cancelled", "voided"].includes(record.status))
      return error(res, `⚠️ Only cancelled or voided payments can be restored (current: ${record.status})`);

    record.status = "pending";
    await record.save();

    await auditService.logAction({
      user: req.user, module: MODULE_KEY, action: "restore",
      entityId: id, entity: record, details: { to: "pending" },
    });

    return success(res, "✅ Payment restored to pending", record);
  } catch (err) {
    return error(res, "❌ Failed to restore payment", err);
  }
};
