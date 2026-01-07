// 📁 controllers/masterItemController.js
import Joi from "joi";
import { Op } from "sequelize";
import {
  sequelize,
  MasterItem,
  User,
  Facility,
  Organization,
  Department,
  MasterItemCategory,
  FeatureModule, // ✅ added
} from "../models/index.js";
import { success, error } from "../utils/response.js";
import { buildQueryOptions } from "../utils/queryHelper.js";
import { MASTER_ITEM_TYPES, MASTER_ITEM_STATUS } from "../constants/enums.js";
import { authzService } from "../services/authzService.js";
import { auditService } from "../services/auditService.js";

/* ============================================================
   🧭 CONSTANTS & HELPERS
============================================================ */
const MODULE_KEY = "master-item";

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
const MASTER_ITEM_INCLUDES = [
  { model: Organization, as: "organization", attributes: ["id", "name", "code"] },
  { model: Facility, as: "facility", attributes: ["id", "name", "code", "organization_id"] },
  { model: Department, as: "department", attributes: ["id", "name", "code"] },
  { model: MasterItemCategory, as: "category", attributes: ["id", "name", "code"] },
  { model: FeatureModule, as: "featureModule", attributes: ["id", "name", "key"] }, // ✅ NEW include
  { model: User, as: "createdBy", attributes: ["id", "first_name", "last_name"] },
  { model: User, as: "updatedBy", attributes: ["id", "first_name", "last_name"] },
  { model: User, as: "deletedBy", attributes: ["id", "first_name", "last_name"] },
];

/* ============================================================
   📋 JOI SCHEMA
============================================================ */
function buildItemSchema(mode = "create") {
  const base = {
    name: Joi.string().max(150).required(),
    code: Joi.string().max(50).allow("", null),
    description: Joi.string().allow("", null),
    item_type: Joi.string().valid(...Object.values(MASTER_ITEM_TYPES)).required(),
    category_id: Joi.string().uuid().allow("", null),
    department_id: Joi.string().uuid().allow("", null),
    feature_module_id: Joi.string().uuid().allow("", null), // ✅ added
    generic_group: Joi.string().allow("", null),
    strength: Joi.string().allow("", null),
    dosage_form: Joi.string().allow("", null),
    unit: Joi.string().default("pcs"),
    reorder_level: Joi.number().integer().min(0).default(0),
    is_controlled: Joi.boolean().default(false),
    sample_required: Joi.boolean().default(false),
    test_method: Joi.string().allow("", null),
    reference_price: Joi.number().precision(2).min(0).default(0),
    currency: Joi.string().default("USD"),
    status: Joi.string()
      .valid(...Object.values(MASTER_ITEM_STATUS))
      .default(MASTER_ITEM_STATUS.ACTIVE),
    organization_id: Joi.string().uuid().allow("", null),
    facility_id: Joi.string().uuid().allow("", null),
  };
  if (mode === "update") {
    Object.keys(base).forEach((k) => (base[k] = base[k].optional()));
  }
  return Joi.object(base);
}

/* ============================================================
   📌 CREATE ITEM
============================================================ */
export const createItem = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module: MODULE_KEY,
      action: "create",
      res,
    });
    if (!allowed) return;

    const schema = buildItemSchema("create");
    const { error: validationError, value } = schema.validate(req.body, { stripUnknown: true });
    if (validationError) {
      await t.rollback();
      return error(res, "Validation failed", validationError.details || "Invalid data", 400);
    }

    ["organization_id", "facility_id", "feature_module_id"].forEach((f) => {
      if (value[f] === "") value[f] = null;
    });

    // 🔒 Role-based org/facility assignment
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

    // 🔍 Duplication check
    const exists = await MasterItem.findOne({
      where: { organization_id: orgId, facility_id: facilityId, name: value.name },
      paranoid: false,
      transaction: t,
    });
    if (exists) {
      await t.rollback();
      return error(res, "Item with this name already exists in this scope", null, 400);
    }

    // 🧾 Auto-generate code
    const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const rand = Math.floor(Math.random() * 9000) + 1000;
    if (!value.code) value.code = `MIT-${datePart}-${rand}`;

    const created = await MasterItem.create(
      {
        ...value,
        organization_id: orgId,
        facility_id: facilityId,
        created_by_id: req.user?.id || null,
      },
      { transaction: t }
    );

    await t.commit();

    const full = await MasterItem.findOne({
      where: { id: created.id },
      include: MASTER_ITEM_INCLUDES,
    });

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "create",
      entityId: created.id,
      entity: full,
      details: value,
    });

    return success(res, "✅ Master Item created successfully", full);
  } catch (err) {
    if (t.finished !== "commit") await t.rollback();
    return error(res, "❌ Failed to create item", err);
  }
};

/* ============================================================
   📌 UPDATE ITEM
============================================================ */
export const updateItem = async (req, res) => {
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
    const schema = buildItemSchema("update");
    const { error: validationError, value } = schema.validate(req.body, { stripUnknown: true });
    if (validationError) {
      await t.rollback();
      return error(res, "Validation failed", validationError.details || "Invalid data", 400);
    }

    ["organization_id", "facility_id", "feature_module_id"].forEach((f) => {
      if (value[f] === "") value[f] = null;
    });

    const record = await MasterItem.findOne({ where: { id }, transaction: t });
    if (!record) {
      await t.rollback();
      return error(res, "Item not found", null, 404);
    }

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

    if (value.name) {
      const exists = await MasterItem.findOne({
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
        return error(res, "Item with this name already exists in this scope", null, 400);
      }
    }

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

    const full = await MasterItem.findOne({ where: { id }, include: MASTER_ITEM_INCLUDES });

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "update",
      entityId: id,
      entity: full,
      details: value,
    });

    return success(res, "✅ Master Item updated successfully", full);
  } catch (err) {
    if (t.finished !== "commit") await t.rollback();
    return error(res, "❌ Failed to update item", err);
  }
};

/* ============================================================
   📌 GET ALL ITEMS
============================================================ */
export const getAllItems = async (req, res) => {
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module: MODULE_KEY,
      action: "read",
      res,
    });
    if (!allowed) return;

    const role = (req.user?.roleNames?.[0] || "staff").toLowerCase().replace(/\s+/g, "");
    const options = buildQueryOptions(req, "name", "ASC");
    options.where = options.where || {};

    if (!isSuperAdmin(req.user)) {
      options.where.organization_id = req.user.organization_id;
      if (role === "facilityhead") options.where.facility_id = req.user.facility_id;
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

    const { count, rows } = await MasterItem.findAndCountAll({
      where: options.where,
      include: MASTER_ITEM_INCLUDES,
      order: options.order,
      offset: options.offset,
      limit: options.limit,
    });

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "list",
      details: { query: req.query, returned: count },
    });

    return success(res, "✅ Master Items loaded", {
      records: rows,
      pagination: {
        total: count,
        page: options.pagination.page,
        pageCount: Math.ceil(count / options.pagination.limit),
      },
    });
  } catch (err) {
    return error(res, "❌ Failed to load items", err);
  }
};

/* ============================================================
   📌 GET ITEM BY ID
   ============================================================ */
export const getItemById = async (req, res) => {
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module: "master_item",
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

    const found = await MasterItem.findOne({ where, include: MASTER_ITEM_INCLUDES });
    if (!found) return error(res, "❌ Master Item not found", null, 404);

    await auditService.logAction({
      user: req.user,
      module: "master_item",
      action: "view",
      entityId: id,
      entity: found,
    });

    return success(res, "✅ Master Item loaded", found);
  } catch (err) {
    return error(res, "❌ Failed to load item", err);
  }
};

/* ============================================================
   📌 GET ITEMS LITE
   ============================================================ */
export const getAllItemsLite = async (req, res) => {
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module: "master_item",
      action: "read",
      res,
    });
    if (!allowed) return;

    const role = (req.user?.roleNames?.[0] || "staff").toLowerCase().replace(/\s+/g, "");
    const { q } = req.query;

    const where = { status: MASTER_ITEM_STATUS.ACTIVE };

    if (!isSuperAdmin(req.user)) {
      where.organization_id = req.user.organization_id;
      if (role === "facilityhead") where.facility_id = req.user.facility_id;
    } else {
      if (req.query.organization_id) where.organization_id = req.query.organization_id;
      if (req.query.facility_id) where.facility_id = req.query.facility_id;
    }

    if (q) {
      where[Op.or] = [
        { name: { [Op.iLike]: `%${q}%` } },
        { code: { [Op.iLike]: `%${q}%` } },
        { description: { [Op.iLike]: `%${q}%` } },
      ];
    }

    const items = await MasterItem.findAll({
      where,
      include: [{ model: MasterItemCategory, as: "category", attributes: ["id", "name"] }],
      attributes: ["id", "name", "code", "description", "category_id"],
      order: [["name", "ASC"]],
      limit: 20,
    });

    const result = items.map((i) => ({
      id: i.id,
      name: i.name,
      code: i.code || "",
      description: i.description || "",
      category_id: i.category_id || null,
      category: i.category ? { id: i.category.id, name: i.category.name } : null,
    }));

    await auditService.logAction({
      user: req.user,
      module: "master_item",
      action: "list_lite",
      details: { count: result.length, q },
    });

    return success(res, "✅ Master Items loaded (lite)", { records: result });
  } catch (err) {
    return error(res, "❌ Failed to load items (lite)", err);
  }
};

/* ============================================================
   📌 TOGGLE ITEM STATUS
   ============================================================ */
export const toggleItemStatus = async (req, res) => {
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module: "master_item",
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

    const item = await MasterItem.findOne({ where });
    if (!item) return error(res, "❌ Master Item not found", null, 404);

    const newStatus =
      item.status === MASTER_ITEM_STATUS.ACTIVE
        ? MASTER_ITEM_STATUS.INACTIVE
        : MASTER_ITEM_STATUS.ACTIVE;

    await item.update({ status: newStatus, updated_by_id: req.user?.id || null });
    const full = await MasterItem.findOne({ where: { id }, include: MASTER_ITEM_INCLUDES });

    await auditService.logAction({
      user: req.user,
      module: "master_item",
      action: "toggle_status",
      entityId: id,
      entity: full,
      details: { from: item.status, to: newStatus },
    });

    return success(res, `✅ Master Item status set to ${newStatus}`, full);
  } catch (err) {
    return error(res, "❌ Failed to toggle item status", err);
  }
};


/* ============================================================
   📌 DELETE ITEM (Soft Delete with Audit)
   ============================================================ */
export const deleteItem = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module: "master_item",
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

    const item = await MasterItem.findOne({ where, transaction: t });
    if (!item) {
      await t.rollback();
      return error(res, "❌ Master Item not found", null, 404);
    }

    await item.update({ deleted_by_id: req.user?.id || null }, { transaction: t });
    await item.destroy({ transaction: t });
    await t.commit();

    const full = await MasterItem.findOne({ where: { id }, include: MASTER_ITEM_INCLUDES, paranoid: false });

    await auditService.logAction({
      user: req.user,
      module: "master_item",
      action: "delete",
      entityId: id,
      entity: full,
    });

    return success(res, "✅ Master Item deleted", full);
  } catch (err) {
    await t.rollback();
    return error(res, "❌ Failed to delete item", err);
  }
};
