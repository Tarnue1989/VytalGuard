// 📁 backend/src/controllers/permissionController.js
// ============================================================================
// 🔐 Permission Controller – Enterprise Master Pattern (LOCKED)
// ----------------------------------------------------------------------------
// 🔹 Unified permission, validation, lifecycle, audit
// 🔹 Master-aligned filtering + pagination
// 🔹 Lite + grouping APIs preserved
// 🔹 Safe soft-delete + restore-ready
// ============================================================================

import Joi from "joi";
import { Op } from "sequelize";
import { sequelize, Permission, Role, User } from "../models/index.js";

import { success, error } from "../utils/response.js";
import { buildQueryOptions } from "../utils/queryHelper.js";
import { normalizeDateRangeLocal } from "../utils/date-utils.js";
import { validate } from "../utils/validation.js";
import { makeModuleLogger } from "../utils/debugLogger.js";

import { authzService } from "../services/authzService.js";
import { auditService } from "../services/auditService.js";

/* ============================================================
   🔐 MODULE
============================================================ */
const MODULE_KEY = "permissions";

/* ============================================================
   🔧 DEBUG
============================================================ */
const DEBUG_OVERRIDE = false;
const debug = makeModuleLogger("permissionController", DEBUG_OVERRIDE);

/* ============================================================
   🔗 SHARED INCLUDES
============================================================ */
const PERMISSION_INCLUDES = [
  {
    model: Role,
    as: "roles",
    through: { attributes: [] },
    attributes: ["id", "name"],
    required: false,
  },
  { model: User, as: "createdBy", attributes: ["id", "first_name", "last_name"] },
  { model: User, as: "updatedBy", attributes: ["id", "first_name", "last_name"] },
  { model: User, as: "deletedBy", attributes: ["id", "first_name", "last_name"] },
];

/* ============================================================
   📋 VALIDATION SCHEMA (MASTER)
============================================================ */
function buildPermissionSchema(mode = "create") {
  const base = {
    key: Joi.string().max(120).required(),
    name: Joi.string().max(120).allow(null, ""),
    description: Joi.string().max(255).allow(null, ""),
    module: Joi.string().max(60).allow(null, ""),
    category: Joi.string().max(60).allow(null, ""),
    is_global: Joi.boolean().default(true),
  };

  if (mode === "update") {
    Object.keys(base).forEach((k) => (base[k] = base[k].optional()));
  }

  return Joi.object(base);
}

/* ============================================================
   📌 GET ALL PERMISSIONS (MASTER + FILTERS)
============================================================ */
export const getAllPermissions = async (req, res) => {
  try {
    /* 🔐 PERMISSION */
    const allowed = await authzService.checkPermission({
      user: req.user,
      module: MODULE_KEY,
      action: "read",
      res,
    });
    if (!allowed) return;

    /* 🧠 BASE QUERY */
    const options = buildQueryOptions(req, "key", "ASC");

    delete options.filters?.dateRange;

    options.where = { [Op.and]: [] };

    /* 📅 DATE RANGE */
    const dateRange = normalizeDateRangeLocal(req.query.dateRange);
    if (dateRange?.start && dateRange?.end) {
      options.where[Op.and].push({
        created_at: {
          [Op.between]: [dateRange.start, dateRange.end],
        },
      });
    }

    /* 🔎 SEARCH */
    if (options.search) {
      options.where[Op.and].push({
        [Op.or]: [
          { key: { [Op.iLike]: `%${options.search}%` } },
          { name: { [Op.iLike]: `%${options.search}%` } },
          { description: { [Op.iLike]: `%${options.search}%` } },
          { module: { [Op.iLike]: `%${options.search}%` } },
          { category: { [Op.iLike]: `%${options.search}%` } },
        ],
      });
    }

    /* 🎯 FILTERS (MASTER PARITY) */

    // 🔹 module (exact match)
    if (req.query.module) {
      options.where[Op.and].push({
        module: req.query.module,
      });
    }

    // 🔹 category
    if (req.query.category) {
      options.where[Op.and].push({
        category: req.query.category,
      });
    }

    // 🔹 is_global
    if (req.query.is_global !== undefined) {
      options.where[Op.and].push({
        is_global: req.query.is_global === "true",
      });
    }

    /* 📦 QUERY */
    const { count, rows } = await Permission.findAndCountAll({
      where: options.where,
      include: PERMISSION_INCLUDES,
      order: options.order,
      offset: options.offset,
      limit: options.limit,
      distinct: true,
    });

    /* 🧾 AUDIT */
    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "list",
      details: {
        query: req.query,
        returned: count,
        pagination: options.pagination,
      },
    });

    /* ✅ RESPONSE */
    return success(res, "✅ Permissions loaded", {
      records: rows,
      pagination: {
        total: count,
        page: options.pagination.page,
        limit: options.pagination.limit,
        pageCount: Math.ceil(count / options.pagination.limit),
      },
    });
  } catch (err) {
    debug.error("getAllPermissions FAILED", err);
    return error(res, "❌ Failed to load permissions", err);
  }
};
/* ============================================================
   📌 GET PERMISSION BY ID
============================================================ */
export const getPermissionById = async (req, res) => {
  try {
    const record = await Permission.findOne({
      where: { id: req.params.id },
      include: PERMISSION_INCLUDES,
    });

    if (!record) return error(res, "❌ Permission not found", null, 404);

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "view",
      entityId: record.id,
      entity: record,
    });

    return success(res, "✅ Permission loaded", record);
  } catch (err) {
    return error(res, "❌ Failed to load permission", err);
  }
};

/* ============================================================
   📌 GET LITE PERMISSIONS
============================================================ */
export const getLitePermissions = async (req, res) => {
  try {
    const where = {};

    // ✅ MODULE FILTER (FIXED)
    if (req.query.module) {
      where[Op.and] = where[Op.and] || [];

      where[Op.and].push({
        [Op.or]: [
          { module: req.query.module },

          // 🔥 FIX: allow plural + mismatches
          {
            key: {
              [Op.iLike]: `${req.query.module}%`
            }
          }
        ]
      });
    }

    // ✅ SEARCH FILTER
    if (req.query.q) {
      where[Op.and] = where[Op.and] || [];

      where[Op.and].push({
        [Op.or]: [
          { key: { [Op.iLike]: `%${req.query.q}%` } },
          { name: { [Op.iLike]: `%${req.query.q}%` } },
        ]
      });
    }

    const records = await Permission.findAll({
      where,
      attributes: ["id", "key", "name", "module"],
      order: [["key", "ASC"]],
      limit: 500,
    });

    return success(res, "✅ Lite permissions loaded", { records });
  } catch (err) {
    return error(res, "❌ Failed to load lite permissions", err);
  }
};
/* ============================================================
   📌 CREATE PERMISSION
============================================================ */
export const createPermission = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { value, errors } = validate(
      buildPermissionSchema("create"),
      req.body
    );

    if (errors) {
      await t.rollback();
      return error(res, "Validation failed", errors, 400);
    }

    const exists = await Permission.findOne({
      where: { key: value.key },
      paranoid: false,
      transaction: t,
    });

    if (exists) {
      await t.rollback();
      return error(res, "❌ Permission key already exists", null, 400);
    }

    const created = await Permission.create(
      { ...value, created_by_id: req.user?.id || null },
      { transaction: t }
    );

    await t.commit();

    const full = await Permission.findOne({
      where: { id: created.id },
      include: PERMISSION_INCLUDES,
    });

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "create",
      entityId: full.id,
      entity: full,
    });

    return success(res, "✅ Permission created", full);
  } catch (err) {
    if (t && !t.finished) await t.rollback();
    return error(res, "❌ Failed to create permission", err);
  }
};

/* ============================================================
   📌 UPDATE PERMISSION
============================================================ */
export const updatePermission = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { value, errors } = validate(
      buildPermissionSchema("update"),
      req.body
    );

    if (errors) {
      await t.rollback();
      return error(res, "Validation failed", errors, 400);
    }

    const record = await Permission.findByPk(req.params.id, { transaction: t });
    if (!record) {
      await t.rollback();
      return error(res, "❌ Permission not found", null, 404);
    }

    if (value.key) {
      const exists = await Permission.findOne({
        where: { key: value.key, id: { [Op.ne]: record.id } },
        paranoid: false,
        transaction: t,
      });
      if (exists) {
        await t.rollback();
        return error(res, "❌ Permission key already in use", null, 400);
      }
    }

    await record.update(
      { ...value, updated_by_id: req.user?.id || null },
      { transaction: t }
    );

    await t.commit();

    const full = await Permission.findOne({
      where: { id: record.id },
      include: PERMISSION_INCLUDES,
    });

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "update",
      entityId: full.id,
      entity: full,
    });

    return success(res, "✅ Permission updated", full);
  } catch (err) {
    if (t && !t.finished) await t.rollback();
    return error(res, "❌ Failed to update permission", err);
  }
};

/* ============================================================
   📌 DELETE PERMISSION (SOFT)
============================================================ */
export const deletePermission = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const record = await Permission.findByPk(req.params.id, { transaction: t });
    if (!record) {
      await t.rollback();
      return error(res, "❌ Permission not found", null, 404);
    }

    await record.update({ deleted_by_id: req.user?.id || null }, { transaction: t });
    await record.destroy({ transaction: t });
    await t.commit();

    const full = await Permission.findOne({
      where: { id: record.id },
      include: PERMISSION_INCLUDES,
      paranoid: false,
    });

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "delete",
      entityId: record.id,
      entity: full,
    });

    return success(res, "✅ Permission deleted", full);
  } catch (err) {
    if (t && !t.finished) await t.rollback();
    return error(res, "❌ Failed to delete permission", err);
  }
};

/* ============================================================
   📌 GROUP BY MODULE
============================================================ */
export const getPermissionsByModule = async (req, res) => {
  try {
    const where = {};
    if (req.query.module) where.module = req.query.module;

    const records = await Permission.findAll({
      where,
      attributes: ["id", "key", "name", "module", "category"],
      order: [["module", "ASC"], ["key", "ASC"]],
    });

    return success(res, "✅ Permissions grouped by module", { records });
  } catch (err) {
    return error(res, "❌ Failed to load permissions by module", err);
  }
};
