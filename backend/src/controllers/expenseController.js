// 📁 backend/src/controllers/expenseController.js
// ============================================================================
// 💸 Expense Controller – MASTER (SERVICE-ALIGNED)
// ============================================================================

import Joi from "joi";
import { Op } from "sequelize";
import {
  sequelize,
  Expense,
  Account,
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
  isFacilityHead,
} from "../utils/role-utils.js";

import { EXPENSE_CATEGORIES } from "../constants/enums.js";
import { FIELD_VISIBILITY_EXPENSE } from "../constants/fieldVisibility.js";

import { authzService } from "../services/authzService.js";
import { auditService } from "../services/auditService.js";
import { financialService } from "../services/financialService.js";

/* ============================================================ */
const MODULE_KEY = "expenses";

/* ============================================================ */
const EXPENSE_INCLUDES = [
  { model: Account, as: "account", attributes: ["id", "name", "type"] },
  { model: Organization, as: "organization", attributes: ["id", "name"] },
  { model: Facility, as: "facility", attributes: ["id", "name"] },
  { model: User, as: "createdBy", attributes: ["id", "first_name", "last_name"] },
];

/* ============================================================ */
function buildSchema(mode = "create") {
  const base = {
    date: Joi.date().required(),
    amount: Joi.number().positive().required(),
    currency: Joi.string().valid("USD", "LRD").required(),
    category: Joi.string().valid(...Object.values(EXPENSE_CATEGORIES)).required(),
    account_id: Joi.string().uuid().required(),
    description: Joi.string().allow(null, ""),
  };

  if (mode === "update") {
    Object.keys(base).forEach((k) => (base[k] = base[k].optional()));
  }

  return Joi.object(base);
}

/* ============================================================ */
/* CREATE (SERVICE-DRIVEN) */
export const createExpense = async (req, res) => {
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
      return error(res, "Validation failed", errors, 400);
    }

    const { orgId, facilityId } = await resolveOrgFacility({
      user: req.user,
      value,
      body: req.body,
    });

    const result = await financialService.createExpense({
      ...value,
      organization_id: orgId,
      facility_id: facilityId,
      user: req.user,
    });

    const full = await Expense.findByPk(result.id, {
      include: EXPENSE_INCLUDES,
    });

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "create",
      entityId: result.id,
      entity: full,
    });

    return success(res, "✅ Expense created", full);
  } catch (err) {
    return error(res, "❌ Failed to create expense", err);
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

    const { limit, page, offset } = validatePaginationStrict(req);

    const role = (req.user?.roleNames?.[0] || "staff").toLowerCase();
    const visibleFields =
      FIELD_VISIBILITY_EXPENSE[role] || FIELD_VISIBILITY_EXPENSE.staff;

    const { dateRange, ...safeQuery } = req.query;
    req.query = safeQuery;

    const options = buildQueryOptions(req, "created_at", "DESC", visibleFields);
    options.where = { [Op.and]: [] };

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

    if (dateRange) {
      const { start, end } = normalizeDateRangeLocal(dateRange);
      if (start && end) {
        options.where[Op.and].push({
          created_at: { [Op.between]: [start, end] },
        });
      }
    }

    if (req.query.category) {
      options.where[Op.and].push({ category: req.query.category });
    }

    if (options.search) {
      options.where[Op.and].push({
        description: { [Op.iLike]: `%${options.search}%` },
      });
    }

    const { count, rows } = await Expense.findAndCountAll({
      where: options.where,
      include: EXPENSE_INCLUDES,
      order: options.order,
      offset,
      limit,
    });

    return success(res, "✅ Expenses loaded", {
      records: rows,
      pagination: {
        total: count,
        page,
        limit,
        pageCount: Math.ceil(count / limit),
      },
    });
  } catch (err) {
    return error(res, "❌ Failed to load expenses", err);
  }
};

/* ============================================================ */
/* GET ALL (LITE) */
export const getAllExpensesLite = async (req, res) => {
  try {
    const records = await Expense.findAll({
      attributes: ["id", "category", "amount"],
      where: {
        ...(req.user?.organization_id && {
          organization_id: req.user.organization_id,
        }),
        ...(req.user?.facility_id && {
          facility_id: req.user.facility_id,
        }),
      },
      order: [["created_at", "DESC"]],
      limit: 200,
    });

    return res.json({
      success: true,
      data: records,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: "Failed to load expenses",
    });
  }
};

/* ============================================================ */
/* GET BY ID */
export const getExpenseById = async (req, res) => {
  try {
    const record = await Expense.findByPk(req.params.id, {
      include: EXPENSE_INCLUDES,
    });

    if (!record) {
      return error(res, "❌ Expense not found", null, 404);
    }

    return success(res, "✅ Expense loaded", record);
  } catch (err) {
    return error(res, "❌ Failed", err);
  }
};

/* ============================================================ */
/* DELETE */
export const deleteExpense = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const record = await Expense.findByPk(req.params.id, { transaction: t });

    if (!record) {
      await t.rollback();
      return error(res, "❌ Not found", null, 404);
    }

    await record.destroy({ transaction: t });

    await t.commit();

    return success(res, "✅ Expense deleted");
  } catch (err) {
    await t.rollback();
    return error(res, "❌ Failed", err);
  }
};