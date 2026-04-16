// 📁 backend/src/controllers/expenseController.js
// ============================================================================
// 💸 Expense Controller – MASTER-ALIGNED (Deposit Parity FULL)
// ============================================================================

import Joi from "joi";
import { Op } from "sequelize";
import {
  sequelize,
  Expense,
  Organization,
  Facility,
  User,
  Account,
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
  EXPENSE_STATUS,
  EXPENSE_CATEGORIES,
  PAYMENT_METHODS,
  CURRENCY,
} from "../constants/enums.js";

import { FIELD_VISIBILITY_EXPENSE } from "../constants/fieldVisibility.js";

import { authzService } from "../services/authzService.js";
import { auditService } from "../services/auditService.js";
import { EXPENSE_TRANSITIONS } from "../constants/enums.js";

function validateTransition(current, next) {
  if (!EXPENSE_TRANSITIONS[current]?.[next]) {
    throw new Error(`Invalid transition: ${current} → ${next}`);
  }
}
/* ============================================================ */
const MODULE_KEY = "expenses";

/* ============================================================ */
const DEBUG_OVERRIDE = false;
const debug = makeModuleLogger("expenseController", DEBUG_OVERRIDE);

/* ============================================================ */
const ES = {
  DRAFT: EXPENSE_STATUS.DRAFT,
  PENDING: EXPENSE_STATUS.PENDING,
  APPROVED: EXPENSE_STATUS.APPROVED,
  REJECTED: EXPENSE_STATUS.REJECTED,
  POSTED: EXPENSE_STATUS.POSTED,
  CANCELLED: EXPENSE_STATUS.CANCELLED,
  VOIDED: EXPENSE_STATUS.VOIDED,
  REVERSED: EXPENSE_STATUS.REVERSED,
};

/* ============================================================ */
const EXPENSE_INCLUDES = [
  { model: Account, as: "account", attributes: ["id", "name"] },
  { model: Organization, as: "organization", attributes: ["id", "name"] },
  { model: Facility, as: "facility", attributes: ["id", "name"] },

  { model: User, as: "createdBy", attributes: ["id", "first_name", "last_name"] },
  { model: User, as: "updatedBy", attributes: ["id", "first_name", "last_name"] },
  { model: User, as: "deletedBy", attributes: ["id", "first_name", "last_name"] },

  { model: User, as: "approvedBy", attributes: ["id", "first_name", "last_name"] },
  { model: User, as: "postedBy", attributes: ["id", "first_name", "last_name"] },
  { model: User, as: "reversedBy", attributes: ["id", "first_name", "last_name"] },
  { model: User, as: "voidedBy", attributes: ["id", "first_name", "last_name"] }, // 🔥 THIS WAS MISSING
];

/* ============================================================
   🔐 SCHEMA (FINAL – AUTO-GENERATED EXPENSE NUMBER)
   ✔ expense_number REMOVED from input
   ✔ Backend generates it
   ✔ Controller-aligned
============================================================ */
function buildSchema(role, mode = "create") {
  const base = {
    expense_number: Joi.forbidden(), // 🔥 MUST NOT be sent from frontend

    date: Joi.date().required(),
    amount: Joi.number().positive().required(),

    currency: Joi.string()
      .valid(...Object.values(CURRENCY))
      .required(),

    category: Joi.string()
      .valid(...Object.values(EXPENSE_CATEGORIES))
      .required(),

    payment_method: Joi.string()
      .valid(...Object.values(PAYMENT_METHODS))
      .required(),

    account_id: Joi.string().required(),

    description: Joi.string().allow("", null),

    status: Joi.forbidden(),
  };

  if (mode === "update") {
    Object.keys(base).forEach((k) => (base[k] = base[k].optional()));
  }

  if (role === "superadmin") {
    base.organization_id = Joi.string().optional();
    base.facility_id = Joi.string().allow(null).optional();
  }

  return Joi.object(base);
}

/* ============================================================
   ➕ CREATE (FINAL)
============================================================ */
export const createExpense = async (req, res) => {
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
      buildSchema(role, "create"),
      req.body
    );

    if (errors) {
      await t.rollback();
      return error(res, "Validation failed", errors, 400);
    }

    const acc = await Account.findByPk(value.account_id);
    if (!acc) {
      await t.rollback();
      return error(res, "Invalid account", null, 400);
    }

    const { orgId, facilityId } = await resolveOrgFacility({
      user: req.user,
      value,
      body: req.body,
    });

    const record = await Expense.create(
      {
        ...value,
        status: ES.DRAFT,
        organization_id: orgId,
        facility_id: facilityId,
        created_by_id: req.user?.id || null,
      },
      { transaction: t }
    );

    await t.commit();

    const full = await Expense.findOne({
      where: { id: record.id },
      include: EXPENSE_INCLUDES,
    });

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "create",
      entityId: record.id,
      entity: full,
    });

    return success(res, "✅ Expense created", full);
  } catch (err) {
    await t.rollback();
    debug.error("createExpense → FAILED", err);
    return error(res, "❌ Failed to create expense", err);
  }
};

/* ============================================================
   ✏️ UPDATE (FINAL)
============================================================ */
export const updateExpense = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module: MODULE_KEY,
      action: "update",
      res,
    });
    if (!allowed) return;

    const record = await Expense.findByPk(req.params.id, {
      transaction: t,
    });

    if (!record) {
      await t.rollback();
      return error(res, "❌ Not found", null, 404);
    }

    if ([ES.POSTED, ES.VOIDED].includes(record.status)) {
      await t.rollback();
      return error(
        res,
        "❌ Cannot modify posted/voided expense",
        null,
        400
      );
    }

    const role = (req.user?.roleNames?.[0] || "staff").toLowerCase();

    const { value, errors } = validate(
      buildSchema(role, "update"),
      req.body
    );

    if (errors) {
      await t.rollback();
      return error(res, "Validation failed", errors, 400);
    }

    const { orgId, facilityId } = await resolveOrgFacility({
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

    const full = await Expense.findOne({
      where: { id: record.id },
      include: EXPENSE_INCLUDES,
    });

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "update",
      entityId: record.id,
      entity: full,
    });

    return success(res, "✅ Expense updated", full);
  } catch (err) {
    await t.rollback();
    debug.error("updateExpense → FAILED", err);
    return error(res, "❌ Failed", err);
  }
};
/* ============================================================ */
/* GET ALL */
export const getAllExpenses = async (req, res) => {
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
      FIELD_VISIBILITY_EXPENSE[role] || FIELD_VISIBILITY_EXPENSE.staff;

    const { dateRange, ...safeQuery } = req.query;
    safeQuery.limit = limit;
    safeQuery.page = page;
    req.query = safeQuery;

    const options = buildQueryOptions(req, "date", "DESC", visibleFields);
    options.where = { [Op.and]: [] };

    if (dateRange) {
      const { start, end } = normalizeDateRangeLocal(dateRange);
      if (start && end) {
        options.where[Op.and].push({
          date: { [Op.between]: [start, end] },
        });
      }
    }

    if (!isSuperAdmin(req.user)) {
      options.where[Op.and].push({
        organization_id: req.user.organization_id,
      });

      if (isFacilityHead(req.user)) {
        options.where[Op.and].push({
          facility_id: req.user.facility_id,
        });
      }
    }

    if (req.query.account_id) {
      options.where[Op.and].push({ account_id: req.query.account_id });
    }

    if (req.query.category) {
      options.where[Op.and].push({ category: req.query.category });
    }

    if (req.query.status) {
      options.where[Op.and].push({ status: req.query.status });
    }

    if (options.search) {
      options.where[Op.and].push({
        [Op.or]: [
          { expense_number: { [Op.iLike]: `%${options.search}%` } },
          { description: { [Op.iLike]: `%${options.search}%` } },
        ],
      });
    }

    const { count, rows } = await Expense.findAndCountAll({
      where: options.where,
      include: EXPENSE_INCLUDES,
      order: options.order,
      offset,
      limit,
      distinct: true,
    });

    const summary = { total: count };

    const statusCounts = await Expense.findAll({
      where: options.where,
      attributes: [
        "status",
        [sequelize.fn("COUNT", sequelize.col("id")), "count"],
      ],
      group: ["status"],
    });

    Object.values(ES).forEach((status) => {
      const found = statusCounts.find((s) => s.status === status);
      summary[status] = found ? Number(found.get("count")) : 0;
    });

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "list",
      details: {
        query: safeQuery,
        returned: count,
      },
    });

    return success(res, "✅ Expenses loaded", {
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
    debug.error("getAllExpenses → FAILED", err);
    return error(res, "❌ Failed to load expenses", err);
  }
};

/* ============================================================ */
/* LITE (FINAL FIXED) */
export const getAllExpensesLite = async (req, res) => {
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module: MODULE_KEY,
      action: "read",
      res,
    });
    if (!allowed) return;

    const where = {
      organization_id: req.user.organization_id,
    };

    if (isFacilityHead(req.user)) {
      where.facility_id = req.user.facility_id;
    }

    const records = await Expense.findAll({
      attributes: ["id", "expense_number", "amount", "date"],
      where,
      order: [["date", "DESC"]],
      limit: 50,
    });

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "list_lite",
      details: { count: records.length },
    });

    return success(res, "Expenses lite", { records });
  } catch (err) {
    return error(res, "Failed", err);
  }
};

/* ============================================================ */
/* GET BY ID */
export const getExpenseById = async (req, res) => {
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
    }

    const record = await Expense.findOne({
      where,
      include: EXPENSE_INCLUDES,
    });

    if (!record) {
      return error(res, "❌ Expense not found", null, 404);
    }

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "view",
      entityId: record.id,
      entity: record,
    });

    return success(res, "✅ Expense loaded", record);
  } catch (err) {
    return error(res, "❌ Failed to load expense", err);
  }
};

/* ============================================================ */
/* SUBMIT */
export const submitExpense = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module: MODULE_KEY,
      action: "submit",
      res,
    });
    if (!allowed) return;

    const record = await Expense.findByPk(req.params.id, { transaction: t });

    if (!record || record.status !== ES.DRAFT) {
      await t.rollback();
      return error(res, "❌ Only draft can be submitted", null, 400);
    }

    validateTransition(record.status, ES.PENDING);

    await record.update(
      { status: ES.PENDING },
      { transaction: t, user: req.user }
    );

    await t.commit();

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "submit",
      entityId: record.id,
      entity: record,
    });

    return success(res, "✅ Expense submitted", record);
  } catch (err) {
    await t.rollback();
    return error(res, "❌ Failed to submit expense", err);
  }
};

/* ============================================================ */
/* APPROVE */
export const approveExpense = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module: MODULE_KEY,
      action: "approve",
      res,
    });
    if (!allowed) return;

    const record = await Expense.findByPk(req.params.id, { transaction: t });

    if (!record || record.status !== ES.PENDING) {
      await t.rollback();
      return error(res, "❌ Only pending can be approved", null, 400);
    }

    validateTransition(record.status, ES.APPROVED);

    await record.update(
      {
        status: ES.APPROVED,
        approved_by_id: req.user?.id || null,
        approved_at: new Date(),
      },
      { transaction: t, user: req.user }
    );

    await t.commit();

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "approve",
      entityId: record.id,
      entity: record,
    });

    return success(res, "✅ Expense approved", record);
  } catch (err) {
    await t.rollback();
    return error(res, "❌ Failed", err);
  }
};

/* ============================================================ */
/* POST */
export const postExpense = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module: MODULE_KEY,
      action: "post",
      res,
    });
    if (!allowed) return;

    const record = await Expense.findByPk(req.params.id, { transaction: t });

    if (!record || record.status !== ES.APPROVED) {
      await t.rollback();
      return error(res, "❌ Only approved can be posted", null, 400);
    }

    validateTransition(record.status, ES.POSTED);

    const acc = await Account.findByPk(record.account_id, {
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    if (!acc) {
      await t.rollback();
      return error(res, "❌ Account not found", null, 400);
    }

    const currentBalance = Number(acc.balance || 0);
    const expenseAmount = Number(record.amount || 0);

    if (expenseAmount <= 0) {
      await t.rollback();
      return error(res, "❌ Invalid expense amount", null, 400);
    }

    if (currentBalance < expenseAmount) {
      await t.rollback();
      return error(res, "❌ Insufficient account balance", null, 400);
    }

    acc.balance = currentBalance - expenseAmount;
    await acc.save({ transaction: t });

    await record.update(
      { status: ES.POSTED },
      { transaction: t, user: req.user }
    );

    await t.commit();

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "post",
      entityId: record.id,
      entity: record,
    });

    return success(res, "✅ Expense posted", record);
  } catch (err) {
    await t.rollback();
    return error(res, "❌ Failed to post expense", err);
  }
};

/* ============================================================ */
/* REVERSE */
export const reverseExpense = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module: MODULE_KEY,
      action: "reverse",
      res,
    });
    if (!allowed) return;

    const record = await Expense.findByPk(req.params.id, { transaction: t });

    if (!record || record.status !== ES.POSTED) {
      await t.rollback();
      return error(res, "❌ Only posted expense can be reversed", null, 400);
    }

    validateTransition(record.status, ES.REVERSED);

    const acc = await Account.findByPk(record.account_id, {
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    if (acc) {
      acc.balance = Number(acc.balance || 0) + Number(record.amount || 0);
      await acc.save({ transaction: t });
    }

    await record.update(
      { status: ES.REVERSED },
      { transaction: t, user: req.user }
    );

    await t.commit();

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "reverse",
      entityId: record.id,
      entity: record,
    });

    return success(res, "✅ Expense reversed", record);
  } catch (err) {
    await t.rollback();
    return error(res, "❌ Failed to reverse expense", err);
  }
};

/* ============================================================ */
/* VOID */
export const voidExpense = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module: MODULE_KEY,
      action: "void",
      res,
    });
    if (!allowed) return;

    const record = await Expense.findByPk(req.params.id, { transaction: t });

    if (!record) {
      await t.rollback();
      return error(res, "❌ Not found", null, 404);
    }

    validateTransition(record.status, ES.VOIDED);

    await record.update(
      { status: ES.VOIDED },
      { transaction: t, user: req.user }
    );

    await t.commit();

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "void",
      entityId: record.id,
      entity: record,
    });

    return success(res, "✅ Expense voided", record);
  } catch (err) {
    await t.rollback();
    return error(res, "❌ Failed", err);
  }
};

/* ============================================================ */
/* CANCEL */
export const cancelExpense = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module: MODULE_KEY,
      action: "cancel",
      res,
    });
    if (!allowed) return;

    const record = await Expense.findByPk(req.params.id, { transaction: t });

    if (!record || record.status !== ES.DRAFT) {
      await t.rollback();
      return error(res, "❌ Only draft expense can be cancelled", null, 400);
    }

    validateTransition(record.status, ES.CANCELLED);

    await record.update(
      { status: ES.CANCELLED },
      { transaction: t, user: req.user }
    );

    await t.commit();

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "cancel",
      entityId: record.id,
      entity: record,
    });

    return success(res, "✅ Expense cancelled", record);
  } catch (err) {
    await t.rollback();
    return error(res, "❌ Failed to cancel expense", err);
  }
};
/* ============================================================ */
/* DELETE */
export const deleteExpense = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module: MODULE_KEY,
      action: "delete",
      res,
    });
    if (!allowed) return;

    const record = await Expense.findByPk(req.params.id, { transaction: t });

    if (!record) {
      await t.rollback();
      return error(res, "❌ Not found", null, 404);
    }

    if (record.status !== ES.DRAFT) {
      await t.rollback();
      return error(res, "❌ Only draft can be deleted", null, 400);
    }

    await record.update(
      { deleted_by_id: req.user?.id || null },
      { transaction: t }
    );

    await record.destroy({ transaction: t });

    await t.commit();

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "delete",
      entityId: record.id,
      entity: record,
    });

    return success(res, "✅ Expense deleted");
  } catch (err) {
    await t.rollback();
    return error(res, "❌ Failed", err);
  }
};

/* ============================================================ */
/* RESTORE */
export const restoreExpense = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module: MODULE_KEY,
      action: "restore",
      res,
    });
    if (!allowed) return;

    const record = await Expense.findByPk(req.params.id, {
      paranoid: false,
      transaction: t,
    });

    if (!record) {
      await t.rollback();
      return error(res, "❌ Not found", null, 404);
    }

    await record.restore({ transaction: t });

    await record.update(
      {
        deleted_by_id: null,
      },
      { transaction: t }
    );

    await t.commit();

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "restore",
      entityId: record.id,
      entity: record,
    });

    return success(res, "✅ Expense restored", record);
  } catch (err) {
    await t.rollback();
    return error(res, "❌ Failed to restore expense", err);
  }
};