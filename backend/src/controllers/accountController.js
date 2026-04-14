// 📁 backend/src/controllers/accountController.js
// ============================================================================
// 🏦 Account Controller – MASTER (CLEAN / SERVICE-READY)
// ============================================================================

import Joi from "joi";
import { Op } from "sequelize";
import {
  sequelize,
  Account,
  Organization,
  Facility,
  User,
} from "../models/index.js";

import { success, error } from "../utils/response.js";
import { buildQueryOptions } from "../utils/queryHelper.js";
import { validatePaginationStrict } from "../utils/query-utils.js";
import { resolveOrgFacility } from "../utils/resolveOrgFacility.js";
import { validate } from "../utils/validation.js";
import {
  isSuperAdmin,
  isFacilityHead,
} from "../utils/role-utils.js";

import { ACCOUNT_TYPES } from "../constants/enums.js";
import { FIELD_VISIBILITY_ACCOUNT } from "../constants/fieldVisibility.js";

import { authzService } from "../services/authzService.js";
import { auditService } from "../services/auditService.js";

/* ============================================================ */
const MODULE_KEY = "accounts";

/* ============================================================ */
const ACCOUNT_INCLUDES = [
  { model: Organization, as: "organization", attributes: ["id", "name"] },
  { model: Facility, as: "facility", attributes: ["id", "name"] },
  { model: User, as: "createdBy", attributes: ["id", "first_name", "last_name"] },
];

/* ============================================================ */
function buildSchema(mode = "create") {
  const base = {
    name: Joi.string().required(),

    // 🔥 NEW
    account_number: Joi.string().required(),

    type: Joi.string().valid(...Object.values(ACCOUNT_TYPES)).required(),
    currency: Joi.string().valid("USD", "LRD").required(),
    is_active: Joi.boolean().optional(),
  };

  if (mode === "update") {
    Object.keys(base).forEach((k) => (base[k] = base[k].optional()));
  }

  return Joi.object(base);
}

/* ============================================================ */
/* CREATE */
export const createAccount = async (req, res) => {
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

    const record = await Account.create(
      {
        ...value,
        organization_id: orgId,
        facility_id: facilityId,
        created_by_id: req.user?.id || null,
      },
      { transaction: t }
    );

    await t.commit();

    const full = await Account.findByPk(record.id, {
      include: ACCOUNT_INCLUDES,
    });

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "create",
      entityId: record.id,
      entity: full,
    });

    return success(res, "✅ Account created", full);
  } catch (err) {
    await t.rollback();
    return error(res, "❌ Failed to create account", err);
  }
};

/* ============================================================ */
/* GET ALL */
export const getAllAccounts = async (req, res) => {
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
      FIELD_VISIBILITY_ACCOUNT[role] || FIELD_VISIBILITY_ACCOUNT.staff;

    const options = buildQueryOptions(req, "created_at", "DESC", visibleFields);
    options.where = { [Op.and]: [] };

    /* ============================================================
       🔐 TENANT FILTER
    ============================================================ */
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

    /* ============================================================
    🔎 GLOBAL SEARCH (FIXED FOR ENUM)
    ============================================================ */
    if (req.query.search) {
    const term = `%${req.query.search}%`;

    options.where[Op.and].push({
        [Op.or]: [
        { name: { [Op.iLike]: term } },
        { account_number: { [Op.iLike]: term } },

        // 🔥 FIXED ENUM CAST
        sequelize.where(
            sequelize.cast(sequelize.col("Account.type"), "TEXT"),
            { [Op.iLike]: term }
        ),

        sequelize.where(
            sequelize.cast(sequelize.col("Account.currency"), "TEXT"),
            { [Op.iLike]: term }
        ),

        // 🔥 RELATIONS
        { "$organization.name$": { [Op.iLike]: term } },
        { "$facility.name$": { [Op.iLike]: term } },
        ],
    });
    }

    /* ============================================================
       🎯 FILTERS
    ============================================================ */
    if (req.query.type) {
      options.where[Op.and].push({ type: req.query.type });
    }

    if (req.query.is_active !== undefined) {
      options.where[Op.and].push({ is_active: req.query.is_active });
    }

    /* ============================================================
       📦 QUERY
    ============================================================ */
    const { count, rows } = await Account.findAndCountAll({
      where: options.where,
      include: ACCOUNT_INCLUDES,
      order: options.order,
      offset,
      limit,
      distinct: true, // 🔥 important for joins
    });

    return success(res, "✅ Accounts loaded", {
      records: rows,
      pagination: {
        total: count,
        page,
        limit,
        pageCount: Math.ceil(count / limit),
      },
    });
  } catch (err) {
    return error(res, "❌ Failed to load accounts", err);
  }
};
/* ============================================================ */
/* GET ALL (LITE) */
export const getAllAccountsLite = async (req, res) => {
  try {
    const records = await Account.findAll({
      // 🔥 UPDATED
      attributes: ["id", "account_number", "name", "type"],
      where: {
        ...(req.user?.organization_id && {
          organization_id: req.user.organization_id,
        }),
        ...(req.user?.facility_id && {
          facility_id: req.user.facility_id,
        }),
      },
      order: [["name", "ASC"]],
      limit: 200,
    });

    return res.json({
      success: true,
      data: records,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: "Failed to load accounts",
    });
  }
};

/* ============================================================ */
/* GET BY ID */
export const getAccountById = async (req, res) => {
  try {
    const record = await Account.findByPk(req.params.id, {
      include: ACCOUNT_INCLUDES,
    });

    if (!record) {
      return error(res, "❌ Account not found", null, 404);
    }

    return success(res, "✅ Account loaded", record);
  } catch (err) {
    return error(res, "❌ Failed", err);
  }
};

/* ============================================================ */
/* UPDATE */
export const updateAccount = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const record = await Account.findByPk(req.params.id, { transaction: t });

    if (!record) {
      await t.rollback();
      return error(res, "❌ Not found", null, 404);
    }

    const { value } = validate(buildSchema("update"), req.body);

    await record.update(
      {
        ...value,
        updated_by_id: req.user?.id || null,
      },
      { transaction: t }
    );

    await t.commit();

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "update",
      entityId: record.id,
      entity: record,
    });

    return success(res, "✅ Account updated", record);
  } catch (err) {
    await t.rollback();
    return error(res, "❌ Failed", err);
  }
};

/* ============================================================ */
/* DELETE */
export const deleteAccount = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const record = await Account.findByPk(req.params.id, { transaction: t });

    if (!record) {
      await t.rollback();
      return error(res, "❌ Not found", null, 404);
    }

    await record.destroy({ transaction: t });

    await t.commit();

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "delete",
      entityId: record.id,
    });

    return success(res, "✅ Account deleted");
  } catch (err) {
    await t.rollback();
    return error(res, "❌ Failed", err);
  }
};