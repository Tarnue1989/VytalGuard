// 📁 controllers/masterItemCategoryController.js
import Joi from "joi";
import { Op } from "sequelize";
import {
  sequelize,
  MasterItemCategory,
  User,
  Facility,
  Organization,
} from "../models/index.js";
import { success, error } from "../utils/response.js";
import { buildQueryOptions } from "../utils/queryHelper.js";
import { MASTER_ITEM_CATEGORY_STATUS } from "../constants/enums.js";
import { authzService } from "../services/authzService.js";
import { auditService } from "../services/auditService.js";

/* ============================================================
   🧭 CONSTANTS & HELPERS
============================================================ */
const MODULE_KEY = "master-item-categories";


function normalizeRoles(user) {
  const roles = Array.isArray(user?.roleNames)
    ? user.roleNames
    : [user?.role || ""];
  return roles.map((r) => r.toLowerCase().replace(/\s+/g, ""));
}
function isSuperAdmin(user) {
  return normalizeRoles(user).includes("superadmin");
}
function isOrgOwner(user) {
  return normalizeRoles(user).includes("orgowner");
}
function isFacilityHead(user) {
  return normalizeRoles(user).includes("facilityhead");
}

/* ============================================================
   🔗 SHARED INCLUDES
============================================================ */
const CATEGORY_INCLUDES = [
  { model: Organization, as: "organization", attributes: ["id", "name", "code"] },
  { model: Facility, as: "facility", attributes: ["id", "name", "code", "organization_id"] },
  { model: User, as: "createdBy", attributes: ["id", "first_name", "last_name"] },
  { model: User, as: "updatedBy", attributes: ["id", "first_name", "last_name"] },
  { model: User, as: "deletedBy", attributes: ["id", "first_name", "last_name"] },
];

/* ============================================================
   📋 JOI SCHEMA
============================================================ */
function buildCategorySchema(mode = "create") {
  const base = {
    name: Joi.string().max(100).required(),
    code: Joi.string().max(50).allow("", null),
    description: Joi.string().allow("", null),
    organization_id: Joi.string().uuid().allow("", null),
    facility_id: Joi.string().uuid().allow("", null),
    status: Joi.string()
      .valid(...Object.values(MASTER_ITEM_CATEGORY_STATUS))
      .default(MASTER_ITEM_CATEGORY_STATUS.ACTIVE),
  };
  if (mode === "update") {
    Object.keys(base).forEach((k) => (base[k] = base[k].optional()));
  }
  return Joi.object(base);
}


/* ============================================================
   📌 CREATE CATEGORY
============================================================ */
export const createCategory = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module: MODULE_KEY,
      action: "create",
      res,
    });
    if (!allowed) return;

    const schema = buildCategorySchema("create");
    const { error: validationError, value } = schema.validate(req.body, {
      stripUnknown: true,
    });
    if (validationError || typeof value !== "object") {
      await t.rollback();
      return error(res, "Validation failed", validationError || "Invalid data", 400);
    }

    // Normalize
    ["organization_id", "facility_id"].forEach((f) => {
      if (value[f] === "") value[f] = null;
    });

    // Org/facility logic
    let orgId, facilityId;
    if (isSuperAdmin(req.user)) {
      orgId = value.organization_id;
      facilityId = value.facility_id;
      if (!orgId) {
        await t.rollback();
        return error(res, "Organization is required for superadmin", null, 400);
      }
    } else if (isOrgOwner(req.user)) {
      orgId = req.user.organization_id;
      facilityId = value.facility_id || null;
    } else if (isFacilityHead(req.user)) {
      orgId = req.user.organization_id;
      facilityId = req.user.facility_id;
    } else {
      orgId = req.user.organization_id;
      facilityId = req.user.facility_id || null;
    }

    // Duplicate check
    const exists = await MasterItemCategory.findOne({
      where: { organization_id: orgId, facility_id: facilityId, name: value.name },
      paranoid: false,
      transaction: t,
    });
    if (exists) {
      await t.rollback();
      return error(res, "Category with this name already exists in this scope", null, 400);
    }

    const created = await MasterItemCategory.create(
      {
        ...(value || {}),
        organization_id: orgId,
        facility_id: facilityId,
        created_by_id: req.user?.id || null,
      },
      { transaction: t }
    );

    await t.commit();

    const full = await MasterItemCategory.findOne({
      where: { id: created.id },
      include: CATEGORY_INCLUDES,
    });

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "create",
      entityId: created.id,
      entity: full,
      details: value,
    });

    return success(res, "✅ Category created successfully", full);
  } catch (err) {
    if (t.finished !== "commit") await t.rollback();
    return error(res, "❌ Failed to create category", err);
  }
};

/* ============================================================
   📌 UPDATE CATEGORY
============================================================ */
export const updateCategory = async (req, res) => {
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
    const schema = buildCategorySchema("update");
    const { error: validationError, value } = schema.validate(req.body, {
      stripUnknown: true,
    });
    if (validationError || typeof value !== "object") {
      await t.rollback();
      return error(res, "Validation failed", validationError || "Invalid data", 400);
    }

    ["organization_id", "facility_id"].forEach((f) => {
      if (value[f] === "") value[f] = null;
    });

    const record = await MasterItemCategory.findOne({ where: { id }, transaction: t });
    if (!record) {
      await t.rollback();
      return error(res, "Category not found", null, 404);
    }

    // Org/facility logic
    let orgId, facilityId;
    if (isSuperAdmin(req.user)) {
      orgId = value.organization_id || record.organization_id;
      facilityId = value.facility_id || record.facility_id;
    } else if (isOrgOwner(req.user)) {
      orgId = req.user.organization_id;
      facilityId = value.facility_id || record.facility_id;
    } else if (isFacilityHead(req.user)) {
      orgId = req.user.organization_id;
      facilityId = req.user.facility_id;
    } else {
      orgId = req.user.organization_id;
      facilityId = req.user.facility_id || record.facility_id;
    }

    // Duplicate check
    if (value.name) {
      const exists = await MasterItemCategory.findOne({
        where: {
          organization_id: orgId,
          facility_id: facilityId,
          name: value.name,
          id: { [Op.ne]: id },
        },
        paranoid: false,
      });
      if (exists) {
        await t.rollback();
        return error(res, "Category with this name already exists in this scope", null, 400);
      }
    }

    await record.update(
      {
        ...(value || {}),
        organization_id: orgId,
        facility_id: facilityId,
        updated_by_id: req.user?.id || null,
      },
      { transaction: t }
    );

    await t.commit();

    const full = await MasterItemCategory.findOne({
      where: { id },
      include: CATEGORY_INCLUDES,
    });

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "update",
      entityId: id,
      entity: full,
      details: value,
    });

    return success(res, "✅ Category updated successfully", full);
  } catch (err) {
    if (t.finished !== "commit") await t.rollback();
    return error(res, "❌ Failed to update category", err);
  }
};

/* ============================================================
   📌 GET ALL CATEGORIES
   ============================================================ */
export const getAllCategories = async (req, res) => {
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module: "master_item_categories",
      action: "read",
      res,
    });
    if (!allowed) return;

    const role = (req.user?.roleNames?.[0] || "staff").toLowerCase().replace(/\s+/g, "");
    const options = buildQueryOptions(req, "name", "ASC");
    options.where = options.where || {};

    if (!isSuperAdmin(req.user)) {
      options.where.organization_id = req.user.organization_id;
      if (role === "facilityhead") {
        options.where.facility_id = req.user.facility_id;
      }
    } else {
      if (req.query.organization_id) options.where.organization_id = req.query.organization_id;
      if (req.query.facility_id) options.where.facility_id = req.query.facility_id;
    }

    if (options.search) {
      options.where[Op.or] = [
        { name: { [Op.iLike]: `%${options.search}%` } },
        { code: { [Op.iLike]: `%${options.search}%` } },
        { description: { [Op.iLike]: `%${options.search}%` } },
      ];
    }

    const { count, rows } = await MasterItemCategory.findAndCountAll({
      where: options.where,
      include: CATEGORY_INCLUDES,
      order: options.order,
      offset: options.offset,
      limit: options.limit,
    });

    await auditService.logAction({
      user: req.user,
      module: "master_item_categories",
      action: "list",
      details: { query: req.query, returned: count },
    });

    return success(res, "✅ Master Item Categories loaded", {
      records: rows,
      pagination: {
        total: count,
        page: options.pagination.page,
        pageCount: Math.ceil(count / options.pagination.limit),
      },
    });
  } catch (err) {
    return error(res, "❌ Failed to load categories", err);
  }
};

/* ============================================================
   📌 GET CATEGORY BY ID
   ============================================================ */
export const getCategoryById = async (req, res) => {
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module: "master_item_categories",
      action: "read",
      res,
    });
    if (!allowed) return;

    const { id } = req.params;
    const role = (req.user?.roleNames?.[0] || "staff").toLowerCase().replace(/\s+/g, "");

    const where = { id };
    if (!isSuperAdmin(req.user)) {
      where.organization_id = req.user.organization_id;
      if (role === "facilityhead") {
        where.facility_id = req.user.facility_id;
      }
    } else {
      if (req.query.organization_id) where.organization_id = req.query.organization_id;
      if (req.query.facility_id) where.facility_id = req.query.facility_id;
    }

    const found = await MasterItemCategory.findOne({ where, include: CATEGORY_INCLUDES });
    if (!found) return error(res, "❌ Category not found", null, 404);

    await auditService.logAction({
      user: req.user,
      module: "master_item_categories",
      action: "view",
      entityId: id,
      entity: found,
    });

    return success(res, "✅ Category loaded", found);
  } catch (err) {
    return error(res, "❌ Failed to load category", err);
  }
};

/* ============================================================
/* ============================================================
   📌 GET CATEGORIES LITE (autocomplete / dropdowns)
   – Fully aligned with enums + data-loader params
============================================================ */
export const getAllCategoriesLite = async (req, res) => {
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module: "master_item_categories",
      action: "read",
      res,
    });
    if (!allowed) return;

    const role = (req.user?.roleNames?.[0] || "staff")
      .toLowerCase()
      .replace(/\s+/g, "");
    const { q, organization_id, facility_id, status } = req.query;

    // ✅ Use your enum object (not array)
    const where = {
      status: status || MASTER_ITEM_CATEGORY_STATUS.ACTIVE,
    };

    // 🔒 Apply org/facility scoping
    if (!isSuperAdmin(req.user)) {
      where.organization_id = req.user.organization_id;
      if (role === "facilityhead") where.facility_id = req.user.facility_id;
    } else {
      if (organization_id) where.organization_id = organization_id;
      if (facility_id) where.facility_id = facility_id;
    }

    // 🔍 Apply search
    if (q) {
      where[Op.or] = [
        { name: { [Op.iLike]: `%${q}%` } },
        { code: { [Op.iLike]: `%${q}%` } },
        { description: { [Op.iLike]: `%${q}%` } },
      ];
    }

    // 🚀 Query
    const categories = await MasterItemCategory.findAll({
      where,
      attributes: ["id", "name", "code", "description"],
      order: [["name", "ASC"]],
      limit: 20,
    });

    // 🧠 Format response
    const result = categories.map((c) => ({
      id: c.id,
      name: c.name,
      code: c.code || "",
      description: c.description || "",
    }));

    await auditService.logAction({
      user: req.user,
      module: "master_item_categories",
      action: "list_lite",
      details: { count: result.length, q },
    });

    return success(res, "✅ Categories loaded (lite)", { records: result });
  } catch (err) {
    return error(res, "❌ Failed to load categories (lite)", err);
  }
};
/* ============================================================
   📌 TOGGLE CATEGORY STATUS
   ============================================================ */
export const toggleCategoryStatus = async (req, res) => {
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module: "master_item_categories",
      action: "update",
      res,
    });
    if (!allowed) return;

    const { id } = req.params;
    const roleName = (req.user?.roleNames?.[0] || "").toLowerCase().replace(/\s+/g, "");

    const where = { id };
    if (!isSuperAdmin(req.user)) {
      where.organization_id = req.user.organization_id;
      if (roleName === "facilityhead") where.facility_id = req.user.facility_id;
    } else {
      if (req.query.organization_id) where.organization_id = req.query.organization_id;
      if (req.query.facility_id) where.facility_id = req.query.facility_id;
    }

    const category = await MasterItemCategory.findOne({ where });
    if (!category) return error(res, "❌ Category not found", null, 404);

    const [ACTIVE, INACTIVE] = MASTER_ITEM_CATEGORY_STATUS;
    const newStatus = category.status === ACTIVE ? INACTIVE : ACTIVE;

    await category.update({ status: newStatus, updated_by_id: req.user?.id || null });
    const full = await MasterItemCategory.findOne({ where: { id }, include: CATEGORY_INCLUDES });

    await auditService.logAction({
      user: req.user,
      module: "master_item_categories",
      action: "toggle_status",
      entityId: id,
      entity: full,
      details: { from: category.status, to: newStatus },
    });

    return success(res, `✅ Category status set to ${newStatus}`, full);
  } catch (err) {
    return error(res, "❌ Failed to toggle category status", err);
  }
};

/* ============================================================
   📌 DELETE CATEGORY (Soft Delete with Audit)
   ============================================================ */
export const deleteCategory = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module: "master_item_categories",
      action: "delete",
      res,
    });
    if (!allowed) return;

    const { id } = req.params;
    const roleName = (req.user?.roleNames?.[0] || "").toLowerCase().replace(/\s+/g, "");

    const where = { id };
    if (!isSuperAdmin(req.user)) {
      where.organization_id = req.user.organization_id;
      if (roleName === "facilityhead") where.facility_id = req.user.facility_id;
    } else {
      if (req.query.organization_id) where.organization_id = req.query.organization_id;
      if (req.query.facility_id) where.facility_id = req.query.facility_id;
    }

    const category = await MasterItemCategory.findOne({ where, transaction: t });
    if (!category) {
      await t.rollback();
      return error(res, "❌ Category not found", null, 404);
    }

    await category.update({ deleted_by_id: req.user?.id || null }, { transaction: t });
    await category.destroy({ transaction: t });
    await t.commit();

    const full = await MasterItemCategory.findOne({ where: { id }, include: CATEGORY_INCLUDES, paranoid: false });

    await auditService.logAction({
      user: req.user,
      module: "master_item_categories",
      action: "delete",
      entityId: id,
      entity: full,
    });

    return success(res, "✅ Category deleted", full);
  } catch (err) {
    await t.rollback();
    return error(res, "❌ Failed to delete category", err);
  }
};
