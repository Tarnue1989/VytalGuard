// 📁 controllers/permissionController.js
import Joi from "joi";
import { Op } from "sequelize";
import { sequelize, Permission, Role, User } from "../models/index.js";
import { success, error } from "../utils/response.js";
import { buildQueryOptions } from "../utils/queryHelper.js";
import { authzService } from "../services/authzService.js";
import { auditService } from "../services/auditService.js";

/* ============================================================
   🔧 HELPERS
   ============================================================ */
const PERMISSION_INCLUDES = [
  { model: Role, as: "roles", through: { attributes: [] }, attributes: ["id", "name"], required: false },
  { model: User, as: "createdBy", attributes: ["id", "first_name", "last_name"], required: false },
  { model: User, as: "updatedBy", attributes: ["id", "first_name", "last_name"], required: false },
  { model: User, as: "deletedBy", attributes: ["id", "first_name", "last_name"], required: false },
];

/* ============================================================
   📋 JOI SCHEMA FACTORY
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
    Object.keys(base).forEach(k => { base[k] = base[k].optional(); });
  }

  return Joi.object(base);
}

/* ============================================================
   📌 GET ALL PERMISSIONS
   ============================================================ */
export const getAllPermissions = async (req, res) => {
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module: "permission",
      action: "read",
      res,
    });
    if (!allowed) return;

    const options = buildQueryOptions(req, "key", "ASC");

    if (options.search) {
      options.where = {
        ...options.where,
        [Op.or]: [
          { key: { [Op.iLike]: `%${options.search}%` } },
          { name: { [Op.iLike]: `%${options.search}%` } },
          { description: { [Op.iLike]: `%${options.search}%` } },
          { module: { [Op.iLike]: `%${options.search}%` } },
          { category: { [Op.iLike]: `%${options.search}%` } },
        ],
      };
    }

    const { count, rows } = await Permission.findAndCountAll({
      where: options.where,
      include: PERMISSION_INCLUDES,
      order: options.order,
      offset: options.offset,
      limit: options.limit,
    });

    await auditService.logAction({
      user: req.user,
      module: "permission",
      action: "list",
      details: { query: req.query, returned: count },
    });

    return success(res, "✅ Permissions loaded", {
      records: rows,
      pagination: {
        total: count,
        page: options.pagination.page,
        pageCount: Math.ceil(count / options.pagination.limit),
      },
    });
  } catch (err) {
    return error(res, "❌ Failed to load permissions", err);
  }
};

/* ============================================================
   📌 GET PERMISSION BY ID
   ============================================================ */
export const getPermissionById = async (req, res) => {
  try {
    const { id } = req.params;
    const record = await Permission.findOne({ where: { id }, include: PERMISSION_INCLUDES });
    if (!record) return error(res, "❌ Permission not found", null, 404);

    await auditService.logAction({
      user: req.user,
      module: "permission",
      action: "view",
      entityId: id,
      entity: record,
    });

    return success(res, "✅ Permission loaded", { record });
  } catch (err) {
    return error(res, "❌ Failed to load permission", err);
  }
};

/* ============================================================
   📌 GET LITE PERMISSIONS (for dropdowns)
   ============================================================ */
export const getLitePermissions = async (req, res) => {
  try {
    const { q } = req.query;

    const where = {};
    if (q) {
      where[Op.or] = [
        { key: { [Op.iLike]: `%${q}%` } },
        { name: { [Op.iLike]: `%${q}%` } },
        { module: { [Op.iLike]: `%${q}%` } },
      ];
    }

    const records = await Permission.findAll({
      where,
      attributes: ["id", "key", "name", "module"],
      order: [["key", "ASC"]],
      limit: 500,
    });

    return success(res, "✅ Lite permission list loaded", { records });
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
    const schema = buildPermissionSchema("create");
    const { error: validationError, value } = schema.validate(req.body, { stripUnknown: true });
    if (validationError) {
      await t.rollback();
      return error(res, "Validation failed", validationError, 400);
    }

    const exists = await Permission.findOne({ where: { key: value.key }, paranoid: false, transaction: t });
    if (exists) {
      await t.rollback();
      return error(res, "❌ Permission key already exists", null, 400);
    }

    const created = await Permission.create(
      { ...value, created_by_id: req.user?.id || null },
      { transaction: t }
    );
    await t.commit();

    const full = await Permission.findOne({ where: { id: created.id }, include: PERMISSION_INCLUDES });
    await auditService.logAction({
      user: req.user,
      module: "permission",
      action: "create",
      entityId: created.id,
      entity: full,
      details: value,
    });

    return success(res, "✅ Permission created", { record: full });
  } catch (err) {
    await t.rollback();
    return error(res, "❌ Failed to create permission", err);
  }
};

/* ============================================================
   📌 UPDATE PERMISSION
   ============================================================ */
export const updatePermission = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { id } = req.params;
    const schema = buildPermissionSchema("update");
    const { error: validationError, value } = schema.validate(req.body, { stripUnknown: true });
    if (validationError) {
      await t.rollback();
      return error(res, "Validation failed", validationError, 400);
    }

    const record = await Permission.findOne({ where: { id }, transaction: t });
    if (!record) {
      await t.rollback();
      return error(res, "❌ Permission not found", null, 404);
    }

    if (value.key) {
      const exists = await Permission.findOne({
        where: { key: value.key, id: { [Op.ne]: id } },
        paranoid: false,
        transaction: t,
      });
      if (exists) {
        await t.rollback();
        return error(res, "❌ Permission key already in use", null, 400);
      }
    }

    await record.update({ ...value, updated_by_id: req.user?.id || null }, { transaction: t });
    await t.commit();

    const full = await Permission.findOne({ where: { id }, include: PERMISSION_INCLUDES });
    await auditService.logAction({
      user: req.user,
      module: "permission",
      action: "update",
      entityId: id,
      entity: full,
      details: value,
    });

    return success(res, "✅ Permission updated", { record: full });
  } catch (err) {
    await t.rollback();
    return error(res, "❌ Failed to update permission", err);
  }
};

/* ============================================================
   📌 DELETE PERMISSION (Soft Delete)
   ============================================================ */
export const deletePermission = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { id } = req.params;
    const record = await Permission.findOne({ where: { id }, transaction: t });
    if (!record) {
      await t.rollback();
      return error(res, "❌ Permission not found", null, 404);
    }

    await record.update({ deleted_by_id: req.user?.id || null }, { transaction: t });
    await record.destroy({ transaction: t });
    await t.commit();

    const full = await Permission.findOne({ where: { id }, include: PERMISSION_INCLUDES, paranoid: false });
    await auditService.logAction({
      user: req.user,
      module: "permission",
      action: "delete",
      entityId: id,
      entity: full,
    });

    return success(res, "✅ Permission deleted", { record: full });
  } catch (err) {
    await t.rollback();
    return error(res, "❌ Failed to delete permission", err);
  }
};

/* ============================================================
   📌 GET PERMISSIONS BY MODULE (Grouping API)
   ============================================================ */
export const getPermissionsByModule = async (req, res) => {
  try {
    const { module } = req.query;
    const where = {};
    if (module) where.module = module;

    const records = await Permission.findAll({
      where,
      attributes: ["id", "key", "name", "module", "category"],
      order: [["module", "ASC"], ["key", "ASC"]],
    });

    return success(res, "✅ Permissions grouped by module loaded", { records });
  } catch (err) {
    return error(res, "❌ Failed to load permissions by module", err);
  }
};
