// 📁 backend/src/controllers/payrollController.js
// ============================================================================
// 💰 Payroll Controller – MASTER-ALIGNED (Expense Parity + HR Flow)
// ============================================================================

import Joi from "joi";
import { Op } from "sequelize";
import {
  sequelize,
  Payroll,
  Employee,
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
  isFacilityHead,
} from "../utils/role-utils.js";
import { makeModuleLogger } from "../utils/debugLogger.js";

import {
  PAYROLL_STATUS,
  EXPENSE_STATUS,
  EXPENSE_CATEGORIES,
  PAYMENT_METHODS,
  CURRENCY,
} from "../constants/enums.js";

import { FIELD_VISIBILITY_PAYROLL } from "../constants/fieldVisibility.js";

import { authzService } from "../services/authzService.js";
import { auditService } from "../services/auditService.js";

/* ============================================================ */
const MODULE_KEY = "payrolls";

/* ============================================================ */
const DEBUG_OVERRIDE = false;
const debug = makeModuleLogger("payrollController", DEBUG_OVERRIDE);

/* ============================================================ */
const PS = {
  DRAFT: PAYROLL_STATUS.DRAFT,
  APPROVED: PAYROLL_STATUS.APPROVED,
  PAID: PAYROLL_STATUS.PAID,
  VOIDED: PAYROLL_STATUS.VOIDED,
};

/* ============================================================ */
const PAYROLL_INCLUDES = [
  { model: Employee, as: "employee", attributes: ["id", "first_name", "last_name"] },
  { model: Expense, as: "expense", attributes: ["id", "expense_number"] },
  { model: Organization, as: "organization", attributes: ["id", "name"] },
  { model: Facility, as: "facility", attributes: ["id", "name"] },
  { model: User, as: "createdBy", attributes: ["id", "first_name", "last_name"] },
];

/* ============================================================ */
function buildSchema(mode = "create") {
  const base = {
    payroll_number: Joi.string().required(),
    employee_id: Joi.string().required(),
    period: Joi.string().required(),
    currency: Joi.string().valid(...Object.values(CURRENCY)).required(),
    basic_salary: Joi.number().required(),
    allowances: Joi.number().optional().default(0),
    deductions: Joi.number().optional().default(0),
    net_salary: Joi.number().required(),
    description: Joi.string().allow("", null),
  };

  if (mode === "update") {
    Object.keys(base).forEach((k) => (base[k] = base[k].optional()));
  }

  return Joi.object(base);
}

/* ============================================================ */
/* CREATE */
export const createPayroll = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module: MODULE_KEY,
      action: "create",
      res,
    });
    if (!allowed) return;

    const { value, errors } = validate(buildSchema("create"), req.body);
    if (errors) {
      await t.rollback();
      return error(res, "Validation failed", errors, 400);
    }

    const { orgId, facilityId } = await resolveOrgFacility({
      user: req.user,
      value,
      body: req.body,
    });

    const record = await Payroll.create(
      {
        ...value,
        status: PS.DRAFT,
        organization_id: orgId,
        facility_id: facilityId,
        created_by_id: req.user?.id || null,
      },
      { transaction: t }
    );

    await t.commit();

    const full = await Payroll.findByPk(record.id, {
      include: PAYROLL_INCLUDES,
    });

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "create",
      entityId: record.id,
      entity: full,
    });

    return success(res, "✅ Payroll created", full);
  } catch (err) {
    await t.rollback();
    return error(res, "❌ Failed", err);
  }
};

/* ============================================================ */
/* GET ALL */
export const getAllPayrolls = async (req, res) => {
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
      FIELD_VISIBILITY_PAYROLL[role] || FIELD_VISIBILITY_PAYROLL.staff;

    const { dateRange, ...safeQuery } = req.query;
    safeQuery.limit = limit;
    safeQuery.page = page;
    req.query = safeQuery;

    const options = buildQueryOptions(req, "created_at", "DESC", visibleFields);
    options.where = { [Op.and]: [] };

    if (dateRange) {
      const { start, end } = normalizeDateRangeLocal(dateRange);
      if (start && end) {
        options.where[Op.and].push({
          created_at: { [Op.between]: [start, end] },
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

    const { count, rows } = await Payroll.findAndCountAll({
      where: options.where,
      include: PAYROLL_INCLUDES,
      order: options.order,
      offset,
      limit,
      distinct: true,
    });

    return success(res, "✅ Payrolls loaded", {
      records: rows,
      pagination: {
        total: count,
        page,
        limit,
        pageCount: Math.ceil(count / limit),
      },
    });
  } catch (err) {
    return error(res, "❌ Failed", err);
  }
};

/* ============================================================ */
/* PAY (CREATE EXPENSE) */
export const payPayroll = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module: MODULE_KEY,
      action: "pay",
      res,
    });
    if (!allowed) return;

    const { account_id, payment_method } = req.body;

    // 🔥 VALIDATE ACCOUNT (FIX)
    await validatePayrollPayment(account_id);

    const record = await Payroll.findByPk(req.params.id, { transaction: t });

    if (!record || record.status !== PS.APPROVED) {
      await t.rollback();
      return error(res, "❌ Only approved payroll can be paid", null, 400);
    }

    const expense = await Expense.create(
      {
        expense_number: `PAY-${record.payroll_number}`,
        date: new Date(),
        amount: record.net_salary,
        currency: record.currency,
        category: EXPENSE_CATEGORIES.SALARY,
        payment_method: payment_method || PAYMENT_METHODS.BANK,
        account_id,
        description: `Salary payment (${record.period})`,
        status: EXPENSE_STATUS.POSTED,
        employee_id: record.employee_id,
        organization_id: record.organization_id,
        facility_id: record.facility_id,
      },
      { transaction: t }
    );

    await record.update(
      {
        status: PS.PAID,
        expense_id: expense.id,
        paid_at: new Date(),
      },
      { transaction: t }
    );

    await t.commit();

    const full = await Payroll.findByPk(record.id, {
      include: PAYROLL_INCLUDES,
    });

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "pay",
      entityId: record.id,
      entity: full,
    });

    return success(res, "✅ Payroll paid", full);
  } catch (err) {
    await t.rollback();
    return error(res, "❌ Failed", err);
  }
};
/* =============
=============================================== */
/* UPDATE */
export const updatePayroll = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module: MODULE_KEY,
      action: "update",
      res,
    });
    if (!allowed) return;

    const record = await Payroll.findByPk(req.params.id, { transaction: t });

    if (!record) {
      await t.rollback();
      return error(res, "❌ Not found", null, 404);
    }

    if ([PS.PAID, PS.VOIDED].includes(record.status)) {
      await t.rollback();
      return error(res, "❌ Cannot modify paid/voided payroll", null, 400);
    }

    const { value, errors } = validate(buildSchema("update"), req.body);
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

    const full = await Payroll.findByPk(record.id, {
      include: PAYROLL_INCLUDES,
    });

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "update",
      entityId: record.id,
      entity: full,
    });

    return success(res, "✅ Payroll updated", full);
  } catch (err) {
    await t.rollback();
    return error(res, "❌ Failed", err);
  }
};

/* ============================================================ */
/* APPROVE */
export const approvePayroll = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module: MODULE_KEY,
      action: "approve",
      res,
    });
    if (!allowed) return;

    const record = await Payroll.findByPk(req.params.id, { transaction: t });

    if (!record || record.status !== PS.DRAFT) {
      await t.rollback();
      return error(res, "❌ Only draft can be approved", null, 400);
    }

    await record.update(
      {
        status: PS.APPROVED,
      },
      { transaction: t }
    );

    await t.commit();

    const full = await Payroll.findByPk(record.id, {
      include: PAYROLL_INCLUDES,
    });

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "approve",
      entityId: record.id,
      entity: full,
    });

    return success(res, "✅ Payroll approved", full);
  } catch (err) {
    await t.rollback();
    return error(res, "❌ Failed", err);
  }
};

/* ============================================================ */
/* DELETE */
export const deletePayroll = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const record = await Payroll.findByPk(req.params.id, { transaction: t });

    if (!record) {
      await t.rollback();
      return error(res, "❌ Not found", null, 404);
    }

    if (record.status !== PS.DRAFT) {
      await t.rollback();
      return error(res, "❌ Only draft can be deleted", null, 400);
    }

    await record.destroy({ transaction: t });

    await t.commit();

    return success(res, "✅ Payroll deleted");
  } catch (err) {
    await t.rollback();
    return error(res, "❌ Failed", err);
  }
};

/* ============================================================ */
/* GET BY ID */
export const getPayrollById = async (req, res) => {
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

    const record = await Payroll.findOne({
      where,
      include: PAYROLL_INCLUDES,
    });

    if (!record) {
      return error(res, "❌ Payroll not found", null, 404);
    }

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "view",
      entityId: record.id,
      entity: record,
    });

    return success(res, "✅ Payroll loaded", record);
  } catch (err) {
    return error(res, "❌ Failed", err);
  }
};


/* ============================================================ */
/* VOID */
export const voidPayroll = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module: MODULE_KEY,
      action: "void",
      res,
    });
    if (!allowed) return;

    const record = await Payroll.findByPk(req.params.id, { transaction: t });

    if (!record) {
      await t.rollback();
      return error(res, "❌ Not found", null, 404);
    }

    await record.update(
      {
        status: PS.VOIDED,
      },
      { transaction: t }
    );

    await t.commit();

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "void",
      entityId: record.id,
      entity: record,
    });

    return success(res, "✅ Payroll voided", record);
  } catch (err) {
    await t.rollback();
    return error(res, "❌ Failed", err);
  }
};

/* ============================================================ */
/* LITE */
export const getAllPayrollsLite = async (req, res) => {
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module: MODULE_KEY,
      action: "read",
      res,
    });
    if (!allowed) return;

    const records = await Payroll.findAll({
      attributes: ["id", "payroll_number", "employee_id", "net_salary", "period"],
      where: {
        organization_id: req.user.organization_id,
      },
      order: [["created_at", "DESC"]],
      limit: 50,
    });

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "list_lite",
      details: { count: records.length },
    });

    return success(res, "Payrolls lite", { records });
  } catch (err) {
    return error(res, "❌ Failed", err);
  }
};

/* ============================================================ */
/* ENHANCE GET ALL WITH SUMMARY + FILTERS */
export const enhancePayrollList = async (options, req) => {
  if (req.query.employee_id) {
    options.where[Op.and].push({ employee_id: req.query.employee_id });
  }

  const summary = {};

  const statusCounts = await Payroll.findAll({
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

  return summary;
};

/* ============================================================ */
/* FIX PAY (ADD ACCOUNT VALIDATION) */
export const validatePayrollPayment = async (account_id) => {
  if (!account_id) {
    throw new Error("Account is required for payment");
  }

  const acc = await Account.findByPk(account_id);
  if (!acc) {
    throw new Error("Invalid account");
  }

  return acc;
};