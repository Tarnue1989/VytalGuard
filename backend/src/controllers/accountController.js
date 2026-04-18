// 📁 backend/src/controllers/accountController.js

import Joi from "joi";
import { Op } from "sequelize";
import {
  sequelize,
  Account,
  User,
  Facility,
  Organization,
} from "../models/index.js";

import { success, error } from "../utils/response.js";
import { ACCOUNT_TYPES, CURRENCY } from "../constants/enums.js";

import { authzService } from "../services/authzService.js";
import { auditService } from "../services/auditService.js";

import {
  isSuperAdmin,
  isOrgOwner,
  isFacilityHead,
} from "../utils/role-utils.js";

import { buildQueryOptions } from "../utils/queryHelper.js";
import { normalizeDateRangeLocal } from "../utils/date-utils.js";
import { makeModuleLogger } from "../utils/debugLogger.js";

const MODULE_KEY = "accounts";

/* ============================================================
   🔧 DEBUG
============================================================ */
const DEBUG_OVERRIDE = true;
const debug = makeModuleLogger("accountController", DEBUG_OVERRIDE);

/* ============================================================
   🔗 INCLUDES
============================================================ */
const ACCOUNT_INCLUDES = [
  {
    model: Organization,
    as: "organization",
    attributes: ["id", "name", "code"],
    required: false,
  },
  {
    model: Facility,
    as: "facility",
    attributes: ["id", "name", "code"],
    required: false,
  },
  {
    model: User,
    as: "createdBy",
    attributes: ["id", "first_name", "last_name"],
    required: false,
  },
  {
    model: User,
    as: "updatedBy",
    attributes: ["id", "first_name", "last_name"],
    required: false,
  },
];

/* ============================================================
   📋 JOI SCHEMA
============================================================ */
function buildAccountSchema(isSuper, mode = "create") {
  const base = {
    name: Joi.string().max(120),
    account_number: Joi.string().max(50),
    type: Joi.string().valid(...Object.values(ACCOUNT_TYPES)),
    currency: Joi.string().valid(...Object.values(CURRENCY)),
    is_active: Joi.boolean(),
  };

  if (mode === "create") {
    base.name = base.name.required();
    base.account_number = base.account_number.required();
    base.type = base.type.required();
    base.currency = base.currency.required();
    base.is_active = base.is_active.default(true);
  } else {
    Object.keys(base).forEach(k => (base[k] = base[k].optional()));
  }

  if (isSuper) {
    base.organization_id = Joi.string().uuid().required();
    base.facility_id = Joi.string().uuid().allow(null).optional();
  } else {
    base.facility_id = Joi.string().uuid().allow(null).optional();
  }

  return Joi.object(base);
}


/* ============================================================
   📌 CREATE ACCOUNT
============================================================ */
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

    const schema = buildAccountSchema(isSuperAdmin(req.user), "create");
    const { error: validationError, value } = schema.validate(req.body);

    if (validationError) {
      await t.rollback();
      return error(res, "Validation failed", validationError, 400);
    }

    let orgId = req.user.organization_id;
    let facilityId = req.user.facility_id ?? null;

    if (isSuperAdmin(req.user)) {
      orgId = value.organization_id;
      facilityId = value.facility_id ?? null;
    }

    const exists = await Account.findOne({
      where: {
        account_number: value.account_number,
        organization_id: orgId,
      },
      transaction: t,
    });

    if (exists) {
      await t.rollback();
      return error(res, "Account number already exists", null, 400);
    }

    const created = await Account.create(
      {
        ...value,
        organization_id: orgId,
        facility_id: facilityId,
        created_by_id: req.user.id,
      },
      { transaction: t }
    );

    await t.commit();

    const full = await Account.findByPk(created.id, {
      include: ACCOUNT_INCLUDES,
    });

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "create",
      entityId: created.id,
      entity: full,
    });

    return success(res, "✅ Account created", full);
  } catch (err) {
    await t.rollback();
    return error(res, "❌ Failed to create account", err);
  }
};

/* ============================================================ */
/* 📌 UPDATE ACCOUNT */
export const updateAccount = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module: MODULE_KEY,
      action: "update",
      res,
    });
    if (!allowed) return;

    const where = { id: req.params.id };

    if (!isSuperAdmin(req.user)) {
      where.organization_id = req.user.organization_id;
    }

    const record = await Account.findOne({ where, transaction: t });

    if (!record) {
      await t.rollback();
      return error(res, "❌ Account not found", null, 404);
    }

    const schema = buildAccountSchema(isSuperAdmin(req.user), "update");
    const { error: validationError, value } = schema.validate(req.body);

    if (validationError) {
      await t.rollback();
      return error(res, "Validation failed", validationError, 400);
    }

    await record.update(
      {
        ...value,
        updated_by_id: req.user.id,
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
      action: "update",
      entityId: record.id,
      entity: full,
    });

    return success(res, "✅ Account updated", full);
  } catch (err) {
    await t.rollback();
    return error(res, "❌ Failed to update account", err);
  }
};
/* ============================================================
   📌 GET ALL ACCOUNTS
============================================================ */
export const getAllAccounts = async (req, res) => {
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module: MODULE_KEY,
      action: "read",
      res,
    });
    if (!allowed) return;

    const options = buildQueryOptions(req, "created_at", "DESC");
    options.where = { [Op.and]: [] };

    const dateRange = normalizeDateRangeLocal(req.query.dateRange);
    if (dateRange) {
      options.where[Op.and].push({
        created_at: { [Op.between]: [dateRange.start, dateRange.end] },
      });
    }

    if (!isSuperAdmin(req.user)) {
      options.where[Op.and].push({
        organization_id: req.user.organization_id,
      });

      if (!isOrgOwner(req.user)) {
        options.where[Op.and].push({
          [Op.or]: [
            { facility_id: null },
            { facility_id: req.user.facility_id },
          ],
        });
      }
    }

    if (options.search) {
      options.where[Op.and].push({
        [Op.or]: [
          { name: { [Op.iLike]: `%${options.search}%` } },
          { account_number: { [Op.iLike]: `%${options.search}%` } },
        ],
      });
    }

    const { count, rows } = await Account.findAndCountAll({
      where: options.where,
      include: ACCOUNT_INCLUDES,
      order: options.order,
      limit: options.limit,
      offset: options.offset,
    });

    const summary = {
      total: count,
      active: rows.filter(r => r.is_active).length,
      inactive: rows.filter(r => !r.is_active).length,
    };

    return success(res, "✅ Accounts loaded", {
      records: rows,
      summary,
      pagination: {
        total: count,
        page: options.pagination.page,
        pageCount: Math.ceil(count / options.pagination.limit),
      },
    });
  } catch (err) {
    return error(res, "❌ Failed to load accounts", err);
  }
};
/* ============================================================ */
/* 📌 GET ACCOUNT BY ID */
export const getAccountById = async (req, res) => {
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

    const record = await Account.findOne({
      where,
      include: ACCOUNT_INCLUDES,
    });

    if (!record) {
      return error(res, "❌ Account not found", null, 404);
    }

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "view",
      entityId: record.id,
      entity: record,
    });

    return success(res, "✅ Account loaded", record);
  } catch (err) {
    return error(res, "❌ Failed to load account", err);
  }
};

/* ============================================================ */
/* 📌 GET ALL ACCOUNTS (LITE) */
export const getAllAccountsLite = async (req, res) => {
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module: MODULE_KEY,
      action: "read",
      res,
    });
    if (!allowed) return;

    const where = {};

    /* ================= TENANT SCOPING ================= */
    if (!isSuperAdmin(req.user)) {
      where.organization_id = req.user.organization_id;

      if (!isOrgOwner(req.user)) {
        where[Op.or] = [
          { facility_id: null },
          { facility_id: req.user.facility_id },
        ];
      }
    }

    /* ================= FETCH ================= */
    const records = await Account.findAll({
      where,
      attributes: ["id", "name", "account_number", "type", "currency"],
      order: [["name", "ASC"]],
    });

    /* ================= FORMAT ================= */
    const lite = records.map((r) => ({
      id: r.id,
      name: r.name,
      label: `${r.name} (${r.account_number})`,
      account_number: r.account_number,
      type: r.type,
      currency: r.currency,
    }));

    /* ================= RESPONSE (FIXED) ================= */
    return success(res, "✅ Accounts (lite) loaded", {
      records: lite,
    });

  } catch (err) {
    return error(res, "❌ Failed to load accounts (lite)", err);
  }
};
/* ============================================================
   📌 TOGGLE ACCOUNT STATUS (🔥 FINAL FIXED)
============================================================ */
export const toggleAccountStatus = async (req, res) => {
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module: MODULE_KEY,
      action: "update",
      res,
    });
    if (!allowed) return;

    const { id } = req.params;

    const where = { id };

    if (!isSuperAdmin(req.user)) {
      where.organization_id = req.user.organization_id;

      if (isFacilityHead(req.user)) {
        where.facility_id = req.user.facility_id;
      }
    }

    const account = await Account.findOne({ where });

    if (!account) return error(res, "❌ Account not found", null, 404);

    const newStatus = !account.is_active;

    await account.update({
      is_active: newStatus,
      updated_by_id: req.user.id,
    });

    const full = await Account.findByPk(id, {
      include: ACCOUNT_INCLUDES,
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
      `✅ Account ${newStatus ? "activated" : "deactivated"}`,
      full
    );
  } catch (err) {
    return error(res, "❌ Failed to toggle account", err);
  }
};

/* ============================================================
   📌 DELETE ACCOUNT
============================================================ */
export const deleteAccount = async (req, res) => {
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
    }

    const account = await Account.findOne({ where, transaction: t });

    if (!account) {
      await t.rollback();
      return error(res, "❌ Account not found", null, 404);
    }

    await account.update(
      { deleted_by_id: req.user.id },
      { transaction: t }
    );

    await account.destroy({ transaction: t });
    await t.commit();

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "delete",
      entityId: account.id,
    });

    return success(res, "✅ Account deleted");
  } catch (err) {
    await t.rollback();
    return error(res, "❌ Failed to delete account", err);
  }
};