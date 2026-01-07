// 📁 backend/src/controllers/depositController.js
// ============================================================================
// 💰 Deposit Controller – Enterprise Master Pattern (Aligned with Appointments)
// ----------------------------------------------------------------------------
// 🔹 Unified pagination, filtering, summary, and audit behavior
// 🔹 Includes lifecycle + aggregates via buildDynamicSummary()
// 🔹 Fully tenant-safe (organization/facility scoped)
// ============================================================================

import Joi from "joi";
import { Op } from "sequelize";
import {
  sequelize,
  Deposit,
  Invoice,
  Patient,
  Organization,
  Facility,
  User,
} from "../models/index.js";
import { success, error } from "../utils/response.js";
import { buildQueryOptions } from "../utils/queryHelper.js";
import { DEPOSIT_STATUS, PAYMENT_METHODS } from "../constants/enums.js";
import { authzService } from "../services/authzService.js";
import { auditService } from "../services/auditService.js";
import { financialService } from "../services/financialService.js";
import { FIELD_VISIBILITY_DEPOSIT } from "../constants/fieldVisibility.js";
import { buildDynamicSummary } from "../utils/summaryHelper.js"; // 🧠 Summary Helper

const MODULE_KEY = "deposits";

// 🔖 Local enum map (extended for full financial lifecycle)
const DS = {
  PENDING: DEPOSIT_STATUS[0],                      // "pending"
  CLEARED: DEPOSIT_STATUS[1],                      // "cleared"
  APPLIED: DEPOSIT_STATUS[2],                      // "applied"
  CANCELLED: DEPOSIT_STATUS[3],                    // "cancelled"
  REVERSED: DEPOSIT_STATUS[4] || "reversed",       // "reversed"
  VOIDED: DEPOSIT_STATUS[5] || "voided",           // 🆕 administrative nullify
  VERIFIED: DEPOSIT_STATUS[6] || "verified",       // 🆕 audited & locked
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
const DEPOSIT_INCLUDES = [
  { model: Patient, as: "patient", attributes: ["id", "pat_no", "first_name", "last_name"] },
  { model: Invoice, as: "appliedInvoice", attributes: ["id", "invoice_number", "status", "total", "balance"] },
  { model: Organization, as: "organization", attributes: ["id", "name", "code"] },
  { model: Facility, as: "facility", attributes: ["id", "name", "code", "organization_id"] },
  { model: User, as: "createdBy", attributes: ["id", "first_name", "last_name"] },
  { model: User, as: "updatedBy", attributes: ["id", "first_name", "last_name"] },
  { model: User, as: "deletedBy", attributes: ["id", "first_name", "last_name"] },
];

/* ============================================================
   📋 Joi schema factory (Payment-aligned)
============================================================ */
function buildDepositSchema(userRole, mode = "create") {
  const base = {
    patient_id: Joi.string().uuid().required(),
    applied_invoice_id: Joi.string().uuid().allow(null),
    amount: Joi.number().positive().required(),
    method: Joi.string().valid(...PAYMENT_METHODS).required(),
    transaction_ref: Joi.string().allow(null, ""),
    notes: Joi.string().allow(null, ""),
    reason: Joi.string().allow(null, ""),

    // 🔒 status is always service-controlled
    status: Joi.forbidden(),

    // 🔑 ALLOW tenant fields (controller decides authority)
    organization_id: Joi.string().uuid().optional(),
    facility_id: Joi.string().uuid().optional(),
  };

  if (mode === "update") {
    Object.keys(base).forEach((k) => (base[k] = base[k].optional()));
    base.reason = Joi.string().min(5).required();
  }

  return Joi.object(base);
}

/* ============================================================
   📌 GET ALL DEPOSITS (with Dynamic Summary)
   ============================================================ */
export const getAllDeposits = async (req, res) => {
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
      FIELD_VISIBILITY_DEPOSIT[role] || FIELD_VISIBILITY_DEPOSIT.staff;

    // 🔎 Build Query Options
    const options = buildQueryOptions(req, "created_at", "DESC", visibleFields);
    options.where = options.where || {};

    /* ============================================================
       📅 Manual Bridge for Frontend Date Filters
       (created_from / created_to → created_at[gte]/[lt])
    ============================================================ */
    if (req.query.created_from || req.query.created_to) {
      const range = {};
      if (req.query.created_from) {
        range[Op.gte] = new Date(req.query.created_from);
      }
      if (req.query.created_to) {
        const end = new Date(req.query.created_to);
        if (!isNaN(end)) end.setDate(end.getDate() + 1); // inclusive end date
        range[Op.lt] = end;
      }
      options.where.created_at = range;
    }

    /* ============================================================
       🏢 Scope Enforcement (Multi-Tenant Safe)
    ============================================================ */
    if (!isSuperAdmin(req.user)) {
      options.where.organization_id = req.user.organization_id;
      if (role === "facility_head") {
        options.where.facility_id = req.user.facility_id;
      }
    } else {
      if (req.query.organization_id) {
        options.where.organization_id = req.query.organization_id;
      }
      if (req.query.facility_id) {
        options.where.facility_id = req.query.facility_id;
      }
    }

    /* ============================================================
       🎯 Additional Filters
    ============================================================ */
    if (req.query.patient_id) options.where.patient_id = req.query.patient_id;
    if (req.query.applied_invoice_id)
      options.where.applied_invoice_id = req.query.applied_invoice_id;
    if (req.query.method) options.where.method = req.query.method;
    if (req.query.status) options.where.status = req.query.status;

    // 🔍 Search (Transaction Ref / Notes / Status)
    if (options.search) {
      const term = `%${options.search}%`;
      options.where[Op.or] = [
        { transaction_ref: { [Op.iLike]: term } },
        { notes: { [Op.iLike]: term } },
        { status: { [Op.iLike]: term } },
      ];
    }

    /* ============================================================
       📦 Fetch Paginated Results
    ============================================================ */
    const { count, rows } = await Deposit.findAndCountAll({
      where: options.where,
      include: DEPOSIT_INCLUDES,
      order: options.order,
      offset: options.offset,
      limit: options.limit,
      distinct: true,
    });

    /* ============================================================
       🧠 Lifecycle + Aggregate Summary
    ============================================================ */
    const summary = await buildDynamicSummary({
      model: Deposit,
      options,
      statusEnums: Object.values(DEPOSIT_STATUS),
      includeGender: true,
      genderJoin: { model: Patient, as: "patient" },
    });

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
    return success(res, "✅ Deposits loaded", {
      records: rows,
      pagination: {
        total: count,
        page: options.pagination.page,
        pageCount: Math.ceil(count / options.pagination.limit),
      },
      summary, // ← lifecycle + totals + gender breakdown
    });
  } catch (err) {
    return error(res, "❌ Failed to load deposits", err);
  }
};

/* ============================================================
   📌 GET DEPOSIT BY ID
============================================================ */
export const getDepositById = async (req, res) => {
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module: MODULE_KEY,
      action: "read",
      res,
    });
    if (!allowed) return;

    const where = { id: req.params.id };
    const role = (req.user?.roleNames?.[0] || "staff").toLowerCase();

    if (!isSuperAdmin(req.user)) {
      where.organization_id = req.user.organization_id;
      if (role === "facility_head") where.facility_id = req.user.facility_id;
    }

    const record = await Deposit.findOne({ where, include: DEPOSIT_INCLUDES });
    if (!record) return error(res, "❌ Deposit not found", null, 404);

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "view",
      entityId: req.params.id,
      entity: record,
    });

    return success(res, "✅ Deposit loaded", record);
  } catch (err) {
    return error(res, "❌ Failed to load deposit", err);
  }
};

/* ============================================================
   📌 CREATE DEPOSIT  (Payment-Aligned)
============================================================ */
export const createDeposit = async (req, res) => {
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
    const schema = buildDepositSchema(role, "create");
    const { error: validationError, value } = schema.validate(req.body, {
      stripUnknown: true,
    });
    if (validationError) {
      await t.rollback();
      return error(res, "Validation failed", validationError, 400);
    }

    // 🔐 Tenant scope (AUTHORITATIVE – same as Payment)
    if (!isSuperAdmin(req.user)) {
      value.organization_id = req.user.organization_id;
      value.facility_id = req.user.facility_id;
    }

    const { deposit, invoice } = await financialService.applyDeposit({
      ...value,
      user: req.user,
      t,
    });

    await t.commit();

    const full = await Deposit.findOne({
      where: { id: deposit.id },
      include: DEPOSIT_INCLUDES,
    });

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "create",
      entityId: deposit.id,
      entity: full,
    });

    return success(res, "✅ Deposit created", { deposit: full, invoice });
  } catch (err) {
    if (t && !t.finished) await t.rollback();
    return error(res, "❌ Failed to create deposit", err);
  }
};


/* ============================================================
   📌 UPDATE DEPOSIT  (Payment-Aligned)
============================================================ */
export const updateDeposit = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module: MODULE_KEY,
      action: "update",
      res,
    });
    if (!allowed) return;

    const role = (req.user?.roleNames?.[0] || "").toLowerCase();
    const schema = buildDepositSchema(role, "update");
    const { error: validationError, value } = schema.validate(req.body, {
      stripUnknown: true,
    });
    if (validationError) {
      await t.rollback();
      return error(res, "Validation failed", validationError, 400);
    }

    const record = await Deposit.findByPk(req.params.id, { transaction: t });
    if (!record) {
      await t.rollback();
      return error(res, "❌ Deposit not found", null, 404);
    }

    // 🔒 Lifecycle guard
    if (record.status !== DS.PENDING) {
      await t.rollback();
      return error(res, "❌ Only pending deposits can be updated", null, 400);
    }

    // 🔒 Amount change requires reason
    if (
      value.amount &&
      parseFloat(value.amount) !== parseFloat(record.amount) &&
      !value.reason
    ) {
      await t.rollback();
      return error(
        res,
        "❌ Reason required when changing deposit amount",
        null,
        400
      );
    }

    // 🔐 Tenant scope (AUTHORITATIVE – same as Payment)
    if (!isSuperAdmin(req.user)) {
      value.organization_id = req.user.organization_id;
      value.facility_id = req.user.facility_id;
    }

    await record.update(
      { ...value, updated_by_id: req.user?.id || null },
      { transaction: t }
    );

    await t.commit();

    const full = await Deposit.findOne({
      where: { id: record.id },
      include: DEPOSIT_INCLUDES,
    });

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "update",
      entityId: record.id,
      entity: full,
    });

    return success(res, "✅ Deposit updated", full);
  } catch (err) {
    if (t && !t.finished) await t.rollback();
    return error(res, "❌ Failed to update deposit", err);
  }
};


// TOGGLE STATUS
export const toggleDepositStatus = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { id } = req.params;

    const { deposit, newStatus } = await financialService.toggleDepositStatus({
      deposit_id: id,
      user: req.user,
      t,
    });

    await t.commit();

    const full = await Deposit.findOne({ where: { id }, include: DEPOSIT_INCLUDES });

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "toggle_status",
      entityId: id,
      entity: full,
      details: { to: newStatus },
    });

    return success(res, `✅ Deposit status changed → ${newStatus}`, full);
  } catch (err) {
    if (t && !t.finished) await t.rollback();
    return error(res, "❌ Failed to toggle deposit status", err);
  }
};

// APPLY TO INVOICE
export const applyDepositToInvoice = async (req, res) => {
  try {
    const { id } = req.params;
    const { invoice_id, amount } = req.body;

    if (!invoice_id) {
      return error(res, "❌ invoice_id is required", null, 400);
    }
    if (!amount || parseFloat(amount) <= 0) {
      return error(res, "❌ Valid amount is required", null, 400);
    }

    // 🧩 Fetch deposit record
    const deposit = await Deposit.findByPk(id);
    if (!deposit) {
      return error(res, "❌ Deposit not found", null, 404);
    }

    // 🚫 Enforce correct financial flow
    if (![DS.CLEARED, DS.APPLIED].includes(deposit.status)) {
      return error(
        res,
        "❌ Only cleared or applied deposits can be used",
        null,
        400
      );
    }

    // ✅ Perform financial application
    const { application, updatedDeposit, invoice } =
      await financialService.applyDepositToInvoice({
        deposit_id: id,
        invoice_id,
        amount,
        user: req.user,
      });

    const full = await Deposit.findOne({
      where: { id },
      include: DEPOSIT_INCLUDES,
    });

    // 🧾 Audit Log
    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "apply_to_invoice",
      entityId: id,
      entity: full,
      details: { invoice_id, amount },
    });

    return success(res, `✅ Applied ${amount} from deposit → invoice`, {
      application,
      deposit: full,
      invoice,
    });
  } catch (err) {
    return error(res, "❌ Failed to apply deposit to invoice", err);
  }
};

// REVERSE
export const reverseDeposit = async (req, res) => {
  try {
    const role = (req.user?.roleNames?.[0] || "").toLowerCase();
    if (!["admin", "superadmin"].includes(role)) {
      return error(res, "❌ Only admin/superadmin can reverse deposits", null, 403);
    }

    const { id } = req.params;
    const record = await Deposit.findByPk(id);
    if (!record) return error(res, "❌ Deposit not found", null, 404);

    if (![DS.CLEARED, DS.APPLIED].includes(record.status)) {
      return error(res, "❌ Only cleared or applied deposits can be reversed", null, 400);
    }

    await financialService.reverseTransaction({
      type: "deposit",
      id,
      user: req.user,
      reason: req.body?.reason || "manual reversal",
    });

    const full = await Deposit.findOne({
      where: { id },
      include: DEPOSIT_INCLUDES,
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

    return success(res, "✅ Deposit reversed", full);
  } catch (err) {
    return error(res, "❌ Failed to reverse deposit", err);
  }
};

// DELETE
export const deleteDeposit = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { id } = req.params;
    const record = await Deposit.findByPk(id, { transaction: t });
    if (!record) {
      await t.rollback();
      return error(res, "❌ Deposit not found", null, 404);
    }

    if (record.status !== DS.PENDING) {
      await t.rollback();
      return error(res, "❌ Only pending deposits can be deleted", null, 400);
    }

    await record.update({ deleted_by_id: req.user?.id || null }, { transaction: t });
    await record.destroy({ transaction: t });
    await t.commit();

    const full = await Deposit.findOne({ where: { id }, include: DEPOSIT_INCLUDES, paranoid: false });

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "delete",
      entityId: id,
      entity: full,
    });

    return success(res, "✅ Deposit deleted", full);
  } catch (err) {
    await t.rollback();
    return error(res, "❌ Failed to delete deposit", err);
  }
};

// LITE LIST (FIXED for patient_id filtering)
export const getAllDepositsLite = async (req, res) => {
  try {
    const { q, patient_id } = req.query;
    const role = (req.user?.roleNames?.[0] || "").toLowerCase();

    const where = {};

    // ─────────────────────────────────────────────
    // 🔐 RBAC: Tenant-level filtering
    // ─────────────────────────────────────────────
    if (!isSuperAdmin(req.user)) {
      where.organization_id = req.user.organization_id;
      if (role === "facility_head") where.facility_id = req.user.facility_id;
    } else {
      if (req.query.organization_id)
        where.organization_id = req.query.organization_id;

      if (req.query.facility_id)
        where.facility_id = req.query.facility_id;
    }

    // ─────────────────────────────────────────────
    // 🔥 REQUIRED: Deposit must belong to the patient
    // ─────────────────────────────────────────────
    if (patient_id) {
      where.patient_id = patient_id;
    }

    // ─────────────────────────────────────────────
    // 🔍 Optional search filter
    // ─────────────────────────────────────────────
    if (q) {
      where[Op.or] = [
        { transaction_ref: { [Op.iLike]: `%${q}%` } },
        { method: { [Op.iLike]: `%${q}%` } },
      ];
    }

    // ─────────────────────────────────────────────
    // 📦 Query DB
    // ─────────────────────────────────────────────
    const deposits = await Deposit.findAll({
      where,
      attributes: [
        "id",
        "amount",
        "applied_amount",
        "remaining_balance",
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
          as: "appliedInvoice",
          attributes: ["id", "invoice_number"],
        },
      ],
      order: [["created_at", "DESC"]],
      limit: 20,
    });

    // ─────────────────────────────────────────────
    // 🏷️ Format result for suggestion dropdown
    // ─────────────────────────────────────────────
    const result = deposits.map((d) => ({
      id: d.id,
      label: `${d.transaction_ref || d.id} - ${d.amount}`,
      amount: d.amount,
      remaining_balance: d.remaining_balance,
      method: d.method,
      patient: d.patient
        ? `${d.patient.pat_no} - ${d.patient.first_name} ${d.patient.last_name}`
        : "",
      invoice: d.appliedInvoice ? d.appliedInvoice.invoice_number : "",
      created_at: d.created_at,
    }));

    // Optional audit
    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "list_lite",
      details: { count: result.length, patient_id: patient_id || null, query: q || null },
    });

    return success(res, "Deposits loaded (lite)", { records: result });
  } catch (err) {
    return error(res, "Failed to load deposits (lite)", err);
  }
};

// CANCEL (only pending deposits)
export const cancelDeposit = async (req, res) => {
  try {
    const { id } = req.params;
    const record = await Deposit.findByPk(id);
    if (!record) return error(res, "❌ Deposit not found", null, 404);

    if (record.status !== DS.PENDING) {
      return error(res, "❌ Only pending deposits can be cancelled", null, 400);
    }

    await record.update(
      { status: DS.CANCELLED, updated_by_id: req.user?.id || null }
    );

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "cancel",
      entityId: id,
      entity: record,
    });

    return success(res, "✅ Deposit cancelled", record);
  } catch (err) {
    return error(res, "❌ Failed to cancel deposit", err);
  }
};
/* ============================================================
   📌 VERIFY DEPOSIT
   ============================================================ */
export const verifyDeposit = async (req, res) => {
  try {
    const { id } = req.params;

    const allowed = await authzService.checkPermission({
      user: req.user,
      module: "deposits",
      action: "verify",
      res,
    });
    if (!allowed) return;

    const { deposit } = await financialService.verifyDeposit({
      deposit_id: id,
      user: req.user,
    });

    await auditService.logAction({
      user: req.user,
      module: "deposits",
      action: "verify",
      entityId: id,
      entity: deposit,
    });

    return success(res, "✅ Deposit verified successfully", deposit);
  } catch (err) {
    return error(res, "❌ Failed to verify deposit", err);
  }
};

/* ============================================================
   📌 VOID DEPOSIT
   ============================================================ */
export const voidDeposit = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const allowed = await authzService.checkPermission({
      user: req.user,
      module: "deposits",
      action: "void",
      res,
    });
    if (!allowed) return;

    const { deposit } = await financialService.voidDeposit({
      deposit_id: id,
      reason,
      user: req.user,
    });

    await auditService.logAction({
      user: req.user,
      module: "deposits",
      action: "void",
      entityId: id,
      entity: deposit,
      details: { reason },
    });

    return success(res, "✅ Deposit voided successfully", deposit);
  } catch (err) {
    return error(res, "❌ Failed to void deposit", err);
  }
};

/* ============================================================
   ♻️ RESTORE (for deleted/voided/cancelled/reversed deposits)
============================================================ */
export const restoreDeposit = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { id } = req.params;
    const record = await Deposit.findByPk(id, { paranoid: false, transaction: t });
    if (!record) {
      await t.rollback();
      return error(res, "❌ Deposit not found", null, 404);
    }

    // Only allow restore for deleted/voided/cancelled/reversed
    if (!["deleted", "voided", "cancelled", "reversed"].includes(record.status)) {
      await t.rollback();
      return error(res, "❌ Only deleted/voided/cancelled/reversed deposits can be restored", null, 400);
    }

    await record.restore({ transaction: t });
    await record.update(
      { status: DS.PENDING, updated_by_id: req.user?.id || null },
      { transaction: t }
    );
    await t.commit();

    const full = await Deposit.findOne({ where: { id }, include: DEPOSIT_INCLUDES });
    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "restore",
      entityId: id,
      entity: full,
    });

    return success(res, "✅ Deposit restored successfully", full);
  } catch (err) {
    if (t && !t.finished) await t.rollback();
    return error(res, "❌ Failed to restore deposit", err);
  }
};
