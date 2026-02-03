// 📁 backend/src/controllers/depositController.js
// ============================================================================
// 💰 Deposit Controller – MASTER-ALIGNED (Consultation Parity)
// ----------------------------------------------------------------------------
// 🔹 Strict pagination (MASTER)
// 🔹 UI-only dateRange stripping
// 🔹 Global search + status handling parity
// 🔹 Audit-safe query handling
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

import { DEPOSIT_STATUS, PAYMENT_METHODS } from "../constants/enums.js";
import { FIELD_VISIBILITY_DEPOSIT } from "../constants/fieldVisibility.js";

import { authzService } from "../services/authzService.js";
import { auditService } from "../services/auditService.js";
import { financialService } from "../services/financialService.js";

/* ============================================================
   🔐 MODULE
============================================================ */
const MODULE_KEY = "deposits";

/* ============================================================
   🔧 LOCAL DEBUG OVERRIDE
============================================================ */
const DEBUG_OVERRIDE = false;
const debug = makeModuleLogger("depositController", DEBUG_OVERRIDE);

/* ============================================================
   🔖 STATUS MAP (ENUM-SAFE, MASTER STYLE)
============================================================ */
const DS = {
  PENDING: DEPOSIT_STATUS[0],
  CLEARED: DEPOSIT_STATUS[1],
  APPLIED: DEPOSIT_STATUS[2],
  CANCELLED: DEPOSIT_STATUS[3],
  REVERSED: DEPOSIT_STATUS[4],
  VOIDED: DEPOSIT_STATUS[5],
  VERIFIED: DEPOSIT_STATUS[6],
};

/* ============================================================
   🔗 SHARED INCLUDES (MASTER PARITY)
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
   📋 ROLE-AWARE JOI SCHEMA (MASTER-SAFE, TENANT-RESOLVED)
============================================================ */
function buildDepositSchema(userRole, mode = "create") {
  const base = {
    patient_id: Joi.string().uuid().required(),
    applied_invoice_id: Joi.string().uuid().allow(null, ""),
    amount: Joi.number().positive().required(),
    method: Joi.string().valid(...PAYMENT_METHODS).required(),
    transaction_ref: Joi.string().allow(null, ""),
    notes: Joi.string().allow(null, ""),
    reason: Joi.string().allow(null, ""),

    // lifecycle controlled by service
    status: Joi.forbidden(),
  };

  if (mode === "update") {
    Object.keys(base).forEach((k) => (base[k] = base[k].optional()));
    base.reason = Joi.string().min(5).required();
  }

  // ✅ SUPER ADMIN MAY PASS TENANT
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
   📌 CREATE DEPOSIT (LEDGER-FIRST – MASTER PARITY)
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

    const role =
      (req.user?.roleNames?.[0] || "staff").toLowerCase();

    const { value, errors } = validate(
      buildDepositSchema(role, "create"),
      req.body
    );

    if (errors) {
      await t.rollback();
      return error(res, "Validation failed", errors, 400);
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
       💰 LEDGER-FIRST APPLY
    ======================================================== */
    const { deposit, invoice } = await financialService.applyDeposit({
      ...value,
      organization_id: orgId,
      facility_id: facilityId,
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

    return success(res, "✅ Deposit created", {
      deposit: full,
      invoice,
    });
  } catch (err) {
    await t.rollback();
    debug.error("createDeposit → FAILED", err);
    return error(res, "❌ Failed to create deposit", err);
  }
};

/* ============================================================
   📌 UPDATE DEPOSIT (LEDGER-SAFE – MASTER PARITY)
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

    const role =
      (req.user?.roleNames?.[0] || "staff").toLowerCase();

    const { value, errors } = validate(
      buildDepositSchema(role, "update"),
      req.body
    );

    if (errors) {
      await t.rollback();
      return error(res, "Validation failed", errors, 400);
    }

    const record = await Deposit.findByPk(req.params.id, {
      transaction: t,
    });

    if (!record) {
      await t.rollback();
      return error(res, "❌ Deposit not found", null, 404);
    }

    // 🔒 Only pending deposits are editable
    if (record.status !== DS.PENDING) {
      await t.rollback();
      return error(res, "❌ Only pending deposits can be updated", null, 400);
    }

    // 🔒 Reason required if amount changes
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

    /* ========================================================
       🧭 TENANT RESOLUTION (MASTER)
    ======================================================== */
    const { orgId, facilityId } = resolveOrgFacility({
      user: req.user,
      value,
      body: req.body,
    });

    await record.update(
      {
        ...value,
        organization_id: orgId,
        facility_id: facilityId,
        updated_by_id: req.user?.id || null,
      },
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
    await t.rollback();
    debug.error("updateDeposit → FAILED", err);
    return error(res, "❌ Failed to update deposit", err);
  }
};


/* ============================================================
   📌 GET ALL DEPOSITS (MASTER-ALIGNED – CONSULTATION PARITY)
============================================================ */
export const getAllDeposits = async (req, res) => {
  try {
    /* ========================================================
       🔐 AUTHORIZATION
    ======================================================== */
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
      FIELD_VISIBILITY_DEPOSIT[role] || FIELD_VISIBILITY_DEPOSIT.staff;

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
       🔐 TENANT SCOPE (MASTER)
    ======================================================== */
    if (!isSuperAdmin(req.user)) {
      options.where[Op.and].push({
        organization_id: req.user.organization_id,
      });

      if (!isOrgLevelUser(req.user)) {
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
    if (req.query.patient_id) {
      options.where[Op.and].push({
        patient_id: req.query.patient_id,
      });
    }

    if (req.query.applied_invoice_id) {
      options.where[Op.and].push({
        applied_invoice_id: req.query.applied_invoice_id,
      });
    }

    if (req.query.method) {
      options.where[Op.and].push({
        method: req.query.method,
      });
    }

    if (req.query.status) {
      options.where[Op.and].push({
        status: req.query.status,
      });
    }

    /* ========================================================
       🔍 GLOBAL SEARCH (SAFE)
    ======================================================== */
    if (options.search) {
      options.where[Op.and].push({
        [Op.or]: [
          { transaction_ref: { [Op.iLike]: `%${options.search}%` } },
          { notes: { [Op.iLike]: `%${options.search}%` } },
        ],
      });
    }

    /* ========================================================
       🗂️ MAIN QUERY
    ======================================================== */
    const { count, rows } = await Deposit.findAndCountAll({
      where: options.where,
      include: DEPOSIT_INCLUDES,
      order: options.order,
      offset,
      limit,
      distinct: true,
    });

    /* ========================================================
       🔢 SUMMARY (FULL DATASET – PAGINATION SAFE)
    ======================================================== */
    const summary = { total: count };

    const statusCounts = await Deposit.findAll({
      where: options.where,
      attributes: [
        "status",
        [sequelize.fn("COUNT", sequelize.col("id")), "count"],
      ],
      group: ["status"],
    });

    Object.values(DS).forEach((status) => {
      const found = statusCounts.find((s) => s.status === status);
      summary[status] = found ? Number(found.get("count")) : 0;
    });

    /* ========================================================
       🧾 AUDIT LOG
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
       ✅ RESPONSE (MASTER CONTRACT)
    ======================================================== */
    return success(res, "✅ Deposits loaded", {
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
    debug.error("getAllDeposits → FAILED", err);
    if (err.statusCode === 400) {
      return error(res, err.message, null, 400);
    }
    return error(res, "❌ Failed to load deposits", err);
  }
};
/* ============================================================
   📌 GET ALL DEPOSITS (LITE – AUTOCOMPLETE PARITY, REFUND-SAFE)
============================================================ */
export const getAllDepositsLite = async (req, res) => {
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

    /* ========================================================
       🔐 TENANT SCOPE (MASTER)
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
       🎯 REFUND SAFETY FILTERS (NEW)
    ======================================================== */
    where[Op.and].push({
      remaining_balance: { [Op.gt]: 0 },
    });

    where[Op.and].push({
      status: {
        [Op.in]: [
          DEPOSIT_STATUS[1], // CLEARED
          DEPOSIT_STATUS[2], // APPLIED
          DEPOSIT_STATUS[6], // VERIFIED (if used)
        ],
      },
    });

    if (patient_id) {
      where[Op.and].push({ patient_id });
    }

    if (q) {
      where[Op.and].push({
        [Op.or]: [
          { transaction_ref: { [Op.iLike]: `%${q}%` } },
          { method: { [Op.iLike]: `%${q}%` } },
        ],
      });
    }

    /* ========================================================
       🗂️ QUERY
    ======================================================== */
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

    /* ========================================================
      📦 LITE RECORDS (DATA ONLY – MASTER SAFE)
    ======================================================== */
    const records = deposits.map((d) => ({
      id: d.id,
      label: d.transaction_ref || d.id, // ✅ IDENTIFIER ONLY
      amount: d.amount,
      remaining_balance: d.remaining_balance,
      method: d.method,
      status: d.status,
      patient: d.patient
        ? `${d.patient.pat_no} - ${d.patient.first_name} ${d.patient.last_name}`
        : "",
      invoice: d.appliedInvoice
        ? d.appliedInvoice.invoice_number
        : "",
      created_at: d.created_at,
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

    return success(res, "Deposits loaded (lite)", {
      records,
    });
  } catch (err) {
    return error(res, "❌ Failed to load deposits (lite)", err);
  }
};

/* ============================================================
   📌 GET DEPOSIT BY ID (MASTER PARITY)
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

    const record = await Deposit.findOne({
      where,
      include: DEPOSIT_INCLUDES,
    });

    if (!record) {
      return error(res, "❌ Deposit not found", null, 404);
    }

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "view",
      entityId: record.id,
      entity: record,
    });

    return success(res, "✅ Deposit loaded", record);
  } catch (err) {
    debug.error("getDepositById → FAILED", err);
    return error(res, "❌ Failed to load deposit", err);
  }
};

/* ============================================================
   📌 TOGGLE DEPOSIT STATUS (LEDGER FIRST – MASTER PARITY)
============================================================ */
export const toggleDepositStatus = async (req, res) => {
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

    const { deposit, newStatus } =
      await financialService.toggleDepositStatus({
        deposit_id: id,
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
      action: "toggle_status",
      entityId: id,
      entity: full,
      details: { to: newStatus },
    });

    return success(
      res,
      `✅ Deposit status changed → ${newStatus}`,
      full
    );
  } catch (err) {
    if (t && !t.finished) await t.rollback();
    return error(res, "❌ Failed to toggle deposit status", err);
  }
};

/* ============================================================
   📌 APPLY DEPOSIT TO INVOICE (LEDGER FIRST – PARITY)
============================================================ */
export const applyDepositToInvoice = async (req, res) => {
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module: MODULE_KEY,
      action: "update",
      res,
    });
    if (!allowed) return;

    const { id } = req.params;
    const { invoice_id, amount } = req.body;

    if (!invoice_id) {
      return error(res, "❌ invoice_id is required", null, 400);
    }
    if (!amount || parseFloat(amount) <= 0) {
      return error(res, "❌ Valid amount is required", null, 400);
    }

    const deposit = await Deposit.findByPk(id);
    if (!deposit) {
      return error(res, "❌ Deposit not found", null, 404);
    }

    if (![DS.CLEARED, DS.APPLIED].includes(deposit.status)) {
      return error(
        res,
        "❌ Only cleared or applied deposits can be used",
        null,
        400
      );
    }

    const { application, invoice } =
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

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "apply_to_invoice",
      entityId: id,
      entity: full,
      details: { invoice_id, amount },
    });

    return success(
      res,
      `✅ Applied ${amount} from deposit → invoice`,
      {
        application,
        deposit: full,
        invoice,
      }
    );
  } catch (err) {
    return error(res, "❌ Failed to apply deposit to invoice", err);
  }
};

/* ============================================================
   📌 REVERSE DEPOSIT (ADMIN / SUPERADMIN – PARITY)
============================================================ */
export const reverseDeposit = async (req, res) => {
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module: MODULE_KEY,
      action: "reverse",
      res,
    });
    if (!allowed) return;

    const { id } = req.params;

    const record = await Deposit.findByPk(id);
    if (!record) {
      return error(res, "❌ Deposit not found", null, 404);
    }

    if (![DS.CLEARED, DS.APPLIED].includes(record.status)) {
      return error(
        res,
        "❌ Only cleared or applied deposits can be reversed",
        null,
        400
      );
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
      details: {
        reason: req.body?.reason || "manual reversal",
      },
    });

    return success(res, "✅ Deposit reversed", full);
  } catch (err) {
    return error(res, "❌ Failed to reverse deposit", err);
  }
};

/* ============================================================
   📌 DELETE DEPOSIT (LEDGER SAFE – PARITY)
============================================================ */
export const deleteDeposit = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module: MODULE_KEY,
      action: "delete",
      res,
    });
    if (!allowed) return;

    const { id } = req.params;

    const record = await Deposit.findByPk(id, { transaction: t });
    if (!record) {
      await t.rollback();
      return error(res, "❌ Deposit not found", null, 404);
    }

    if (record.status !== DS.PENDING) {
      await t.rollback();
      return error(
        res,
        "❌ Only pending deposits can be deleted",
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

    const full = await Deposit.findOne({
      where: { id },
      include: DEPOSIT_INCLUDES,
      paranoid: false,
    });

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "delete",
      entityId: id,
      entity: full,
    });

    return success(res, "✅ Deposit deleted", full);
  } catch (err) {
    if (t && !t.finished) await t.rollback();
    return error(res, "❌ Failed to delete deposit", err);
  }
};


/* ============================================================
   📌 CANCEL DEPOSIT (PENDING ONLY – PARITY)
============================================================ */
export const cancelDeposit = async (req, res) => {
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module: MODULE_KEY,
      action: "cancel",
      res,
    });
    if (!allowed) return;

    const { id } = req.params;

    const record = await Deposit.findByPk(id);
    if (!record) {
      return error(res, "❌ Deposit not found", null, 404);
    }

    if (record.status !== DS.PENDING) {
      return error(
        res,
        "❌ Only pending deposits can be cancelled",
        null,
        400
      );
    }

    await record.update({
      status: DS.CANCELLED,
      updated_by_id: req.user?.id || null,
    });

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
   📌 VERIFY DEPOSIT (SERVICE CONTROLLED)
============================================================ */
export const verifyDeposit = async (req, res) => {
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module: MODULE_KEY,
      action: "verify",
      res,
    });
    if (!allowed) return;

    const { id } = req.params;

    const { deposit } = await financialService.verifyDeposit({
      deposit_id: id,
      user: req.user,
    });

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
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
   📌 VOID DEPOSIT (SERVICE CONTROLLED)
============================================================ */
export const voidDeposit = async (req, res) => {
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module: MODULE_KEY,
      action: "voided",
      res,
    });
    if (!allowed) return;

    const { id } = req.params;
    const { reason } = req.body;

    const { deposit } = await financialService.voidDeposit({
      deposit_id: id,
      reason,
      user: req.user,
    });

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "voided",
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
   ♻️ RESTORE DEPOSIT (PARITY)
============================================================ */
export const restoreDeposit = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module: MODULE_KEY,
      action: "restore",
      res,
    });
    if (!allowed) return;

    const { id } = req.params;

    const record = await Deposit.findByPk(id, {
      paranoid: false,
      transaction: t,
    });

    if (!record) {
      await t.rollback();
      return error(res, "❌ Deposit not found", null, 404);
    }

    if (
      ![
        DS.CANCELLED,
        DS.VOIDED,
        DS.REVERSED,
        ].includes(record.status)
    ) {
      await t.rollback();
      return error(
        res,
        "❌ Only deleted/voided/cancelled/reversed deposits can be restored",
        null,
        400
      );
    }

    await record.restore({ transaction: t });
    await record.update(
      {
        status: DS.PENDING,
        updated_by_id: req.user?.id || null,
      },
      { transaction: t }
    );

    await t.commit();

    const full = await Deposit.findOne({
      where: { id },
      include: DEPOSIT_INCLUDES,
    });

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
