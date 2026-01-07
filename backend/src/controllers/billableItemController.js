// 📁 controllers/billableItemController.js
import Joi from "joi";
import { Op } from "sequelize";
import {
  sequelize,
  BillableItem,
  BillableItemPriceHistory,
  User,
  Facility,
  Organization,
  Department,
  MasterItem,
  MasterItemCategory,
} from "../models/index.js";

import { success, error } from "../utils/response.js";
import { buildQueryOptions } from "../utils/queryHelper.js";
import { BILLABLE_ITEM_STATUS } from "../constants/enums.js";
import { authzService } from "../services/authzService.js";
import { auditService } from "../services/auditService.js";

/* ============================================================
   🔧 HELPERS
============================================================ */
function isSuperAdmin(user) {
  if (!user) return false;
  const roles = Array.isArray(user.roleNames) ? user.roleNames : [user.role || ""];
  return roles.map(r => r.toLowerCase().replace(/\s+/g, "")).includes("superadmin");
}

function isOrgOwner(user) {
  if (!user) return false;
  const roles = Array.isArray(user.roleNames) ? user.roleNames : [user.role || ""];
  return roles.map(r => r.toLowerCase().replace(/\s+/g, "")).includes("orgowner");
}

/* ============================================================
   🔗 SHARED INCLUDES
============================================================ */
const BILLABLE_ITEM_INCLUDES = [
  { model: Organization, as: "organization", attributes: ["id", "name", "code"] },
  { model: Facility, as: "facility", attributes: ["id", "name", "code", "organization_id"] },
  { model: Department, as: "department", attributes: ["id", "name", "code"] },
  { model: MasterItem, as: "masterItem", attributes: ["id", "name", "code", "description"] },
  { model: MasterItemCategory, as: "category", attributes: ["id", "name", "code"] }, 
  { model: User, as: "createdBy", attributes: ["id", "first_name", "last_name"] },
  { model: User, as: "updatedBy", attributes: ["id", "first_name", "last_name"] },
  { model: User, as: "deletedBy", attributes: ["id", "first_name", "last_name"] },
];

/* ============================================================
   📋 JOI SCHEMA FACTORY (Unified + Role-safe)
   Fully aligned with CentralStock / Vital / LabRequest patterns
============================================================ */
function buildBillableItemSchema(userRole, mode = "create") {
  const base = {
    master_item_id: Joi.string().uuid().required(),
    department_id: Joi.string().uuid().allow("", null),
    category_id: Joi.string().uuid().allow("", null),
    name: Joi.string().max(150).required(),
    code: Joi.string().max(100).allow("", null),
    description: Joi.string().allow("", null),

    price: Joi.number().precision(2).min(0).required(),
    currency: Joi.string().max(10).default("USD"),

    taxable: Joi.boolean().default(false),
    discountable: Joi.boolean().default(true),
    override_allowed: Joi.boolean().default(true),

    // 🔒 Prevent manual status override — backend handles defaults
    status:
      mode === "create"
        ? Joi.forbidden().default(BILLABLE_ITEM_STATUS[0]) // ✅ 'active'
        : Joi.forbidden(),
  };

  // ✅ Allow org/fac selection for superadmin only
  if (userRole === "superadmin") {
    base.organization_id = Joi.string().uuid().optional();
    base.facility_id = Joi.string().uuid().optional();
  }

  // ✅ In update mode, make all optional except forbidden fields
  if (mode === "update") {
    Object.keys(base).forEach((k) => {
      if (k !== "status") base[k] = base[k].optional();
    });
  }

  return Joi.object(base);
}

/* ============================================================
   📌 CREATE BILLABLE ITEM(S)
============================================================ */
export const createBillableItems = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const roleName = (req.user?.roleNames?.[0] || "").toLowerCase().replace(/\s+/g, "");
    const schema = buildBillableItemSchema(roleName, "create");

    const payloads = Array.isArray(req.body) ? req.body : [req.body];
    if (payloads.length === 0) {
      await t.rollback();
      return error(res, "Payload must be an object or non-empty array", null, 400);
    }

    const created = [];
    const skipped = [];

    for (const [idx, payload] of payloads.entries()) {
      delete payload.status; // 🧹 Clean user input

      const { error: validationError, value } = schema.validate(payload, { stripUnknown: true });
      if (validationError) {
        skipped.push({ index: idx, reason: "Validation failed", details: validationError.details });
        continue;
      }

      // 🏢 Resolve tenant scope
      let orgId = req.user.organization_id || null;
      let facilityId = req.user.facility_id || null;

      if (isSuperAdmin(req.user)) {
        orgId = value.organization_id || payload.organization_id || orgId;
        facilityId = value.facility_id || payload.facility_id || facilityId;
      }

      if (!orgId) {
        skipped.push({ index: idx, reason: "Missing organization assignment" });
        continue;
      }

      // 🔍 Prevent duplicate record for same master_item_id
      const exists = await BillableItem.findOne({
        where: {
          organization_id: orgId,
          facility_id: facilityId,
          master_item_id: value.master_item_id,
        },
        paranoid: false,
        transaction: t,
      });
      if (exists) {
        skipped.push({ index: idx, reason: `Duplicate master_item_id=${value.master_item_id}` });
        continue;
      }

      // ✅ Create item
      const newItem = await BillableItem.create(
        {
          ...value,
          organization_id: orgId,
          facility_id: facilityId,
          created_by_id: req.user?.id || null,
        },
        { transaction: t }
      );
      created.push(newItem);

      // 🔹 Add initial price history
      await BillableItemPriceHistory.create(
        {
          billable_item_id: newItem.id,
          organization_id: orgId,
          facility_id: facilityId,
          old_price: null,
          new_price: newItem.price,
          old_currency: null,
          new_currency: newItem.currency,
          effective_date: new Date(),
          created_by_id: req.user?.id || null,
        },
        { transaction: t }
      );
    }

    await t.commit();

    const full = created.length
      ? await BillableItem.findAll({
          where: { id: { [Op.in]: created.map((c) => c.id) } },
          include: BILLABLE_ITEM_INCLUDES,
        })
      : [];

    await auditService.logAction({
      user: req.user,
      module: "billable_item",
      action: payloads.length > 1 ? "bulk_create" : "create",
      details: { ids: created.map((c) => c.id), saved: created.length, skipped: skipped.length },
    });

    return success(res, {
      message: `✅ ${created.length} created, ⚠️ ${skipped.length} skipped`,
      records: full,
      skipped,
    });
  } catch (err) {
    await t.rollback();
    return error(res, "❌ Failed to create billable item(s)", err);
  }
};

/* ============================================================
   📌 UPDATE BILLABLE ITEM
============================================================ */
export const updateBillableItem = async (req, res) => {
  try {
    const { id } = req.params;
    const roleName = (req.user?.roleNames?.[0] || "").toLowerCase().replace(/\s+/g, "");
    const schema = buildBillableItemSchema(roleName, "update");

    delete req.body.status;

    const { error: validationError, value } = schema.validate(req.body, { stripUnknown: true });
    if (validationError) {
      return error(res, "Validation failed", validationError, 400);
    }

    // 🏢 Tenant enforcement (mirrors CentralStock)
    let orgId = req.user.organization_id || null;
    let facilityId = req.user.facility_id || null;

    if (isSuperAdmin(req.user)) {
      orgId = value.organization_id || req.query.organization_id || orgId;
      facilityId = value.facility_id || req.query.facility_id || facilityId;
    }

    if (!orgId) {
      return error(res, "Missing organization assignment", null, 400);
    }

    const item = await BillableItem.findOne({
      where: { id, organization_id: orgId, facility_id: facilityId },
    });
    if (!item) {
      return error(res, "❌ Billable Item not found", null, 404);
    }

    // 🔹 Update (price history handled by model hooks)
    await item.update(
      { ...value, organization_id: orgId, facility_id: facilityId, updated_by_id: req.user?.id || null }
    );

    await auditService.logAction({
      user: req.user,
      module: "billable_item",
      action: "update",
      entityId: id,
      entity: item,
      details: value,
    });

    return success(res, "✅ Billable Item updated", item);
  } catch (err) {
    if (err.message?.includes("not found")) {
      return error(res, "❌ Billable Item not found", err, 404);
    }
    if (err.name === "SequelizeValidationError") {
      return error(res, "❌ Invalid data provided", err, 400);
    }
    return error(res, "❌ Failed to update billable item", err, 500);
  }
};

/* ============================================================
   📌 GET ALL BILLABLE ITEMS
============================================================ */
export const getAllBillableItems = async (req, res) => {
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module: "billable_item",
      action: "read",
      res,
    });
    if (!allowed) return;

    const role = (req.user?.roleNames?.[0] || "staff").toLowerCase().replace(/\s+/g, "");
    const options = buildQueryOptions(req, "created_at", "DESC");
    options.where = options.where || {};

    // 🔹 Tenant scope
    if (!isSuperAdmin(req.user)) {
      options.where.organization_id = req.user.organization_id;
      if (role === "facilityhead") {
        options.where.facility_id = req.user.facility_id;
      }
    } else {
      if (req.query.organization_id) options.where.organization_id = req.query.organization_id;
      if (req.query.facility_id) options.where.facility_id = req.query.facility_id;
    }

    // 🔍 Search
    if (options.search) {
      options.where[Op.or] = [
        { name: { [Op.iLike]: `%${options.search}%` } },
        { code: { [Op.iLike]: `%${options.search}%` } },
        { description: { [Op.iLike]: `%${options.search}%` } },
        { "$category.name$": { [Op.iLike]: `%${options.search}%` } }, // ✅ search by category name
      ];
    }

    const { count, rows } = await BillableItem.findAndCountAll({
      where: options.where,
      include: BILLABLE_ITEM_INCLUDES,
      order: options.order,
      offset: options.offset,
      limit: options.limit,
    });

    await auditService.logAction({
      user: req.user,
      module: "billable_item",
      action: "list",
      details: { query: req.query, returned: count },
    });

    return success(res, "✅ Billable Items loaded", {
      records: rows,
      pagination: {
        total: count,
        page: options.pagination.page,
        pageCount: Math.ceil(count / options.pagination.limit),
      },
    });
  } catch (err) {
    return error(res, "❌ Failed to load billable items", err);
  }
};

/* ============================================================
   📌 GET BILLABLE ITEM BY ID
============================================================ */
export const getBillableItemById = async (req, res) => {
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module: "billable_item",
      action: "read",
      res,
    });
    if (!allowed) return;

    const { id } = req.params;
    const role = (req.user?.roleNames?.[0] || "staff").toLowerCase().replace(/\s+/g, "");

    const where = { id };
    if (!isSuperAdmin(req.user)) {
      where.organization_id = req.user.organization_id;
      if (role === "facilityhead") where.facility_id = req.user.facility_id;
    } else {
      if (req.query.organization_id) where.organization_id = req.query.organization_id;
      if (req.query.facility_id) where.facility_id = req.query.facility_id;
    }

    const found = await BillableItem.findOne({ where, include: BILLABLE_ITEM_INCLUDES });
    if (!found) return error(res, "❌ Billable Item not found", null, 404);

    const history = await BillableItemPriceHistory.findAll({
      where: { billable_item_id: id },
      include: [{ model: User, as: "createdBy", attributes: ["id", "first_name", "last_name"] }],
      order: [["effective_date", "DESC"]],
    });

    await auditService.logAction({
      user: req.user,
      module: "billable_item",
      action: "view",
      entityId: id,
      entity: found,
    });

    return success(res, "✅ Billable Item loaded", { ...found.toJSON(), priceHistory: history });
  } catch (err) {
    return error(res, "❌ Failed to load billable item", err);
  }
};

/* ============================================================
   📌 BULK UPDATE BILLABLE ITEMS
============================================================ */
export const bulkUpdateBillableItems = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const roleName = (req.user?.roleNames?.[0] || "").toLowerCase().replace(/\s+/g, "");
    const schema = buildBillableItemSchema(roleName, "update");

    if (!Array.isArray(req.body) || req.body.length === 0) {
      await t.rollback();
      return error(res, "Payload must be a non-empty array", null, 400);
    }

    const updatedRecords = [];
    const skipped = [];

    for (const payload of req.body) {
      if (!payload.id) {
        skipped.push({ reason: "Missing id in payload", payload });
        continue;
      }

      const { error: validationError, value } = schema.validate(payload, { stripUnknown: true });
      if (validationError) {
        skipped.push({ id: payload.id, reason: "Validation failed", details: validationError.details });
        continue;
      }

      // 🔹 Resolve tenant scope
      let orgId = req.user.organization_id || null;
      let facilityId = null;
      if (isSuperAdmin(req.user)) {
        orgId = value.organization_id || payload.organization_id || null;
        facilityId = value.facility_id || payload.facility_id || null;
      } else if (isOrgOwner(req.user)) {
        orgId = req.user.organization_id;
        facilityId = value.facility_id || null;
      } else if (roleName === "admin") {
        orgId = req.user.organization_id;
        facilityId = value.facility_id;
      } else if (roleName === "facilityhead") {
        orgId = req.user.organization_id;
        facilityId = req.user.facility_id;
      }

      if (!orgId || !facilityId) {
        skipped.push({ id: payload.id, reason: "Missing organization/facility assignment" });
        continue;
      }

      const item = await BillableItem.findOne({
        where: { id: payload.id, organization_id: orgId, facility_id: facilityId },
        transaction: t,
      });
      if (!item) {
        skipped.push({ id: payload.id, reason: "Not found" });
        continue;
      }

      // 🔹 Update (price/currency history is logged by model hook)
      await item.update(
        { ...value, organization_id: orgId, facility_id: facilityId, updated_by_id: req.user?.id || null },
        { transaction: t }
      );

      updatedRecords.push(item.id);
    }

    await t.commit();
    const full = await BillableItem.findAll({
      where: { id: { [Op.in]: updatedRecords } },
      include: BILLABLE_ITEM_INCLUDES,
    });

    await auditService.logAction({
      user: req.user,
      module: "billable_item",
      action: "bulk_update",
      details: { updated: updatedRecords.length, skipped: skipped.length },
    });

    return success(res, {
      message: `✅ ${updatedRecords.length} updated, ⚠️ ${skipped.length} skipped`,
      records: full,
      skipped,
    });
  } catch (err) {
    await t.rollback();
    return error(res, "❌ Failed to bulk update billable items", err);
  }
};

/* ============================================================
   📌 TOGGLE BILLABLE ITEM STATUS
============================================================ */
export const toggleBillableItemStatus = async (req, res) => {
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module: "billable_item",
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

    const item = await BillableItem.findOne({ where });
    if (!item) return error(res, "❌ Billable Item not found", null, 404);

    // ✅ safer explicit status toggle
    const ACTIVE = "active";
    const INACTIVE = "inactive";
    const newStatus = item.status === ACTIVE ? INACTIVE : ACTIVE;

    await item.update({ status: newStatus, updated_by_id: req.user?.id || null });
    const full = await BillableItem.findOne({ where: { id }, include: BILLABLE_ITEM_INCLUDES });

    await auditService.logAction({
      user: req.user,
      module: "billable_item",
      action: "toggle_status",
      entityId: id,
      entity: full,
      details: { from: item.status, to: newStatus },
    });

    return success(res, `✅ Billable Item status set to ${newStatus}`, full);
  } catch (err) {
    return error(res, "❌ Failed to toggle billable item status", err);
  }
};

/* ============================================================
   📌 RESTORE BILLABLE ITEM
============================================================ */
export const restoreBillableItem = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module: "billable_item",
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
    }

    const item = await BillableItem.findOne({ where, transaction: t, paranoid: false });
    if (!item) {
      await t.rollback();
      return error(res, "❌ Billable Item not found", null, 404);
    }

    if (!item.deleted_at) {
      await t.rollback();
      return error(res, "Item is not deleted", null, 400);
    }

    await item.restore({ transaction: t });
    await item.update({ updated_by_id: req.user?.id || null, deleted_by_id: null }, { transaction: t });
    await t.commit();

    const full = await BillableItem.findOne({ where: { id }, include: BILLABLE_ITEM_INCLUDES });

    await auditService.logAction({
      user: req.user,
      module: "billable_item",
      action: "restore",
      entityId: id,
      entity: full,
    });

    return success(res, "✅ Billable Item restored", full);
  } catch (err) {
    await t.rollback();
    return error(res, "❌ Failed to restore billable item", err);
  }
};
/* ============================================================
   📌 BULK DELETE BILLABLE ITEMS
============================================================ */
export const bulkDeleteBillableItems = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module: "billable_item",
      action: "delete",
      res,
    });
    if (!allowed) return;

    if (!Array.isArray(req.body) || req.body.length === 0) {
      await t.rollback();
      return error(res, "Payload must be a non-empty array of IDs", null, 400);
    }

    const roleName = (req.user?.roleNames?.[0] || "").toLowerCase().replace(/\s+/g, "");
    const ids = req.body;

    const whereBase = {};
    if (!isSuperAdmin(req.user)) {
      whereBase.organization_id = req.user.organization_id;
      if (roleName === "facilityhead") {
        whereBase.facility_id = req.user.facility_id;
      }
    }

    const deleted = [];
    const skipped = [];

    for (const id of ids) {
      const item = await BillableItem.findOne({
        where: { id, ...whereBase },
        transaction: t,
      });

      if (!item) {
        skipped.push({ id, reason: "Not found or out of scope" });
        continue;
      }

      await item.update({ deleted_by_id: req.user?.id || null }, { transaction: t });
      await item.destroy({ transaction: t });
      deleted.push(id);
    }

    await t.commit();

    const full = deleted.length
      ? await BillableItem.findAll({
          where: { id: { [Op.in]: deleted } },
          include: BILLABLE_ITEM_INCLUDES,
          paranoid: false,
        })
      : [];

    await auditService.logAction({
      user: req.user,
      module: "billable_item",
      action: "bulk_delete",
      details: { deleted: deleted.length, skipped: skipped.length, ids },
    });

    return success(res, {
      message: `✅ ${deleted.length} deleted, ⚠️ ${skipped.length} skipped`,
      records: full,
      skipped,
    });
  } catch (err) {
    await t.rollback();
    return error(res, "❌ Failed to bulk delete billable items", err);
  }
};

/* ============================================================
   📌 DELETE BILLABLE ITEM
============================================================ */
export const deleteBillableItem = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module: "billable_item",
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

    const item = await BillableItem.findOne({ where, transaction: t });
    if (!item) {
      await t.rollback();
      return error(res, "❌ Billable Item not found", null, 404);
    }

    await item.update({ deleted_by_id: req.user?.id || null }, { transaction: t });
    await item.destroy({ transaction: t });
    await t.commit();

    const full = await BillableItem.findOne({
      where: { id },
      include: BILLABLE_ITEM_INCLUDES,
      paranoid: false,
    });

    await auditService.logAction({
      user: req.user,
      module: "billable_item",
      action: "delete",
      entityId: id,
      entity: full,
    });

    return success(res, "✅ Billable Item deleted", full);
  } catch (err) {
    await t.rollback();
    return error(res, "❌ Failed to delete billable item", err);
  }
};

/* ============================================================
   📌 GET BILLABLE ITEMS LITE (autocomplete)
============================================================ */
export const getAllBillableItemsLite = async (req, res) => {
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module: "billable_item",
      action: "read",
      res,
    });
    if (!allowed) return;

    const role = (req.user?.roleNames?.[0] || "staff").toLowerCase().replace(/\s+/g, "");
    const { q } = req.query;

    const where = { status: BILLABLE_ITEM_STATUS[0] }; // active only

    // 🔹 Category filter
    if (req.query.category_id) {
      where.category_id = req.query.category_id;
    }
    if (req.query.category) {
      where["$category.code$"] = req.query.category; // or .name if you use names
    }

    // 🔒 Tenant scope
    if (!isSuperAdmin(req.user)) {
      where.organization_id = req.user.organization_id;
      if (role === "facilityhead") where.facility_id = req.user.facility_id;
    } else {
      if (req.query.organization_id) where.organization_id = req.query.organization_id;
      if (req.query.facility_id) where.facility_id = req.query.facility_id;
    }

    // 🔍 Search
    if (q) {
      where[Op.or] = [
        { name: { [Op.iLike]: `%${q}%` } },
        { code: { [Op.iLike]: `%${q}%` } },
        { description: { [Op.iLike]: `%${q}%` } },
        { "$category.name$": { [Op.iLike]: `%${q}%` } },
      ];
    }

    const items = await BillableItem.findAll({
      where,
      include: [
        { model: MasterItemCategory, as: "category", attributes: ["id", "name", "code"] },
      ],
      attributes: ["id", "name", "code", "price", "currency"],
      order: [["name", "ASC"]],
      limit: 20,
    });

    const result = items.map(i => ({
      id: i.id,
      name: i.name,
      code: i.code,
      price: i.price,
      currency: i.currency,
      category: i.category ? { id: i.category.id, name: i.category.name, code: i.category.code } : null,
    }));

    await auditService.logAction({
      user: req.user,
      module: "billable_item",
      action: "list_lite",
      details: { count: result.length, q, category: req.query.category, category_id: req.query.category_id },
    });

    return success(res, "✅ Billable Items loaded (lite)", { records: result });
  } catch (err) {
    return error(res, "❌ Failed to load billable items (lite)", err);
  }
};

/* ============================================================
   📌 GET PRICE HISTORY BY BILLABLE ITEM ID
============================================================ */
export const getHistoryByBillableItemId = async (req, res) => {
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module: "billable_item",
      action: "read",
      res,
    });
    if (!allowed) return;

    const { id } = req.params;
    const role = (req.user?.roleNames?.[0] || "staff").toLowerCase().replace(/\s+/g, "");

    const where = { billable_item_id: id };
    if (!isSuperAdmin(req.user)) {
      where.organization_id = req.user.organization_id;
      if (role === "facilityhead") where.facility_id = req.user.facility_id;
    } else {
      if (req.query.organization_id) where.organization_id = req.query.organization_id;
      if (req.query.facility_id) where.facility_id = req.query.facility_id;
    }

    const histories = await BillableItemPriceHistory.findAll({
      where,
      include: [{ model: User, as: "createdBy", attributes: ["id", "first_name", "last_name"] }],
      order: [["effective_date", "DESC"]],
    });

    await auditService.logAction({
      user: req.user,
      module: "billable_item",
      action: "list_history",
      entityId: id,
      details: { count: histories.length },
    });

    return success(res, "✅ Billable Item price history loaded", { records: histories });
  } catch (err) {
    return error(res, "❌ Failed to load billable item history", err);
  }
};
