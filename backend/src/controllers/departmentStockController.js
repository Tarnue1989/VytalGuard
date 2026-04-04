// 📁 controllers/departmentStockController.js
import Joi from "joi";
import { Op } from "sequelize";
import {
  sequelize,
  DepartmentStock,
  Organization,
  Facility,
  Department,
  MasterItem,
  CentralStock,
  User,
} from "../models/index.js";
import { success, error } from "../utils/response.js";
import { buildQueryOptions } from "../utils/queryHelper.js";
import { DEPARTMENT_STOCK_STATUS } from "../constants/enums.js";
import { authzService } from "../services/authzService.js";
import { auditService } from "../services/auditService.js";
import { departmentStockService } from "../services/departmentStockService.js";

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
const DEPARTMENT_STOCK_INCLUDES = [
  { model: Organization, as: "organization", attributes: ["id", "name", "code"] },
  { model: Facility, as: "facility", attributes: ["id", "name", "code", "organization_id"] },
  { model: Department, as: "department", attributes: ["id", "name"] },
  { model: MasterItem, as: "masterItem", attributes: ["id", "name", "code", "description"] },
  { model: CentralStock, as: "centralStock", attributes: ["id", "batch_no", "expiry_date"] }, // ✅ corrected
  { model: User, as: "createdBy", attributes: ["id", "first_name", "last_name"] },
  { model: User, as: "updatedBy", attributes: ["id", "first_name", "last_name"] },
  { model: User, as: "deletedBy", attributes: ["id", "first_name", "last_name"] },
];

/* ============================================================
   📋 JOI SCHEMA FACTORY
============================================================ */
function buildDepartmentStockSchema(userRole, mode = "create") {
  const base = {
    organization_id: Joi.string().uuid().allow("", null),
    facility_id: Joi.string().uuid().allow("", null),
    department_id: Joi.string().uuid().required(),
    master_item_id: Joi.string().uuid().required(),
    central_stock_id: Joi.string().uuid().allow("", null),
    quantity: Joi.number().integer().min(0).default(0),
    min_threshold: Joi.number().integer().min(0).allow(null),
    max_threshold: Joi.number().integer().min(0).allow(null),
    status: Joi.string().valid(...Object.values(DEPARTMENT_STOCK_STATUS)).default(DEPARTMENT_STOCK_STATUS.ACTIVE),
  };

  if (mode === "update") {
    Object.keys(base).forEach(k => { base[k] = base[k].optional(); });
  }

  switch (userRole) {
    case "superadmin": break;
    case "orgowner":
      base.organization_id = Joi.forbidden();
      break;
    case "admin":
      base.organization_id = Joi.forbidden();
      base.facility_id = Joi.string().uuid().required();
      break;
    default: // facilityhead/staff
      base.organization_id = Joi.forbidden();
      base.facility_id = Joi.forbidden();
  }
  return Joi.object(base);
}

/* ============================================================
   📌 GET ALL STOCKS
============================================================ */
export const getAllDepartmentStocks = async (req, res) => {
  try {
    const allowed = await authzService.checkPermission({ user: req.user, module: "department_stock", action: "read", res });
    if (!allowed) return;

    const role = (req.user?.roleNames?.[0] || "staff").toLowerCase();
    const options = buildQueryOptions(req, "created_at", "DESC");
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
        { "$masterItem.name$": { [Op.iLike]: `%${options.search}%` } },
        { "$department.name$": { [Op.iLike]: `%${options.search}%` } },
      ];
    }

    const { count, rows } = await DepartmentStock.findAndCountAll({
      where: options.where,
      include: DEPARTMENT_STOCK_INCLUDES,
      order: options.order,
      offset: options.offset,
      limit: options.limit,
    });

    await auditService.logAction({
      user: req.user, module: "department_stock", action: "list",
      details: { query: req.query, returned: count },
    });

    return success(res, "✅ Department Stocks loaded", {
      records: rows,
      pagination: { total: count, page: options.pagination.page, pageCount: Math.ceil(count / options.pagination.limit) },
    });
  } catch (err) {
    return error(res, "❌ Failed to load department stocks", err);
  }
};

/* ============================================================
   📌 GET STOCK BY ID
============================================================ */
export const getDepartmentStockById = async (req, res) => {
  try {
    const allowed = await authzService.checkPermission({ user: req.user, module: "department_stock", action: "read", res });
    if (!allowed) return;

    const { id } = req.params;
    const where = { id };
    if (!isSuperAdmin(req.user)) {
      where.organization_id = req.user.organization_id;
      if (req.user.roleNames?.includes("facilityhead")) where.facility_id = req.user.facility_id;
    }

    const found = await DepartmentStock.findOne({ where, include: DEPARTMENT_STOCK_INCLUDES });
    if (!found) return error(res, "❌ Department Stock not found", null, 404);

    await auditService.logAction({
      user: req.user, module: "department_stock", action: "view", entityId: id, entity: found,
    });

    return success(res, "✅ Department Stock loaded", found);
  } catch (err) {
    return error(res, "❌ Failed to load department stock", err);
  }
};

/* ============================================================
   📌 CREATE STOCK
============================================================ */
export const createDepartmentStock = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const role = (req.user?.roleNames?.[0] || "staff").toLowerCase();
    const schema = buildDepartmentStockSchema(role, "create");
    const payloads = Array.isArray(req.body) ? req.body : [req.body];
    if (!payloads.length) { await t.rollback(); return error(res, "Payload required", null, 400); }

    const created = [], skipped = [];
    for (const [idx, payload] of payloads.entries()) {
      const { error: vError, value } = schema.validate(payload, { stripUnknown: true });
      if (vError) { skipped.push({ index: idx, reason: "Validation failed", details: vError.details }); continue; }

      let orgId = req.user.organization_id || null;
      let facilityId = null;
      if (isSuperAdmin(req.user)) {
        orgId = value.organization_id || payload.organization_id;
        facilityId = value.facility_id || payload.facility_id;
      } else if (isOrgOwner(req.user)) {
        orgId = req.user.organization_id; facilityId = value.facility_id || null;
      } else if (role === "admin") {
        orgId = req.user.organization_id; facilityId = value.facility_id;
      } else if (role === "facilityhead") {
        orgId = req.user.organization_id; facilityId = req.user.facility_id;
      }

      if (!orgId) { skipped.push({ index: idx, reason: "Missing organization assignment" }); continue; }

      const stockData = { ...value, organization_id: orgId, facility_id: facilityId };
      const newStock = await departmentStockService.createStock(stockData, req.user?.id, t);
      created.push(newStock);
    }

    await t.commit();
    const full = created.length
      ? await DepartmentStock.findAll({ where: { id: { [Op.in]: created.map(c => c.id) } }, include: DEPARTMENT_STOCK_INCLUDES })
      : [];

    await auditService.logAction({
      user: req.user, module: "department_stock", action: payloads.length > 1 ? "bulk_create" : "create",
      details: { saved: created.length, skipped: skipped.length },
    });

    return success(res, { message: `✅ ${created.length} created, ⚠️ ${skipped.length} skipped`, records: full, skipped });
  } catch (err) {
    if (t) await t.rollback();
    return error(res, "❌ Failed to create department stock", err);
  }
};

/* ============================================================
   📌 UPDATE STOCK
============================================================ */
export const updateDepartmentStock = async (req, res) => {
  try {
    const { id } = req.params;
    const role = (req.user?.roleNames?.[0] || "staff").toLowerCase();
    const schema = buildDepartmentStockSchema(role, "update");
    const { error: vError, value } = schema.validate(req.body, { stripUnknown: true });
    if (vError) return error(res, "Validation failed", vError, 400);

    const updated = await departmentStockService.updateStock(id, value, req.user);
    await auditService.logAction({ user: req.user, module: "department_stock", action: "update", entityId: id, entity: updated, details: value });
    return success(res, "✅ Department Stock updated", updated);
  } catch (err) {
    return error(res, "❌ Failed to update department stock", err);
  }
};

/* ============================================================
   📌 TOGGLE STATUS
============================================================ */
export const toggleDepartmentStockStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const updated = await departmentStockService.toggleStatus(id, req.user, req.body?.status);
    await auditService.logAction({ user: req.user, module: "department_stock", action: "toggle_status", entityId: id, entity: updated });
    return success(res, `✅ Department Stock status set to ${updated.status}`, updated);
  } catch (err) {
    return error(res, "❌ Failed to toggle department stock status", err);
  }
};

/* ============================================================
   📌 DELETE STOCK
============================================================ */
export const deleteDepartmentStock = async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await departmentStockService.deleteStock(id, req.user);
    await auditService.logAction({ user: req.user, module: "department_stock", action: "delete", entityId: id, entity: deleted });
    return success(res, "✅ Department Stock deleted", deleted);
  } catch (err) {
    return error(res, "❌ Failed to delete department stock", err);
  }
};

/* ============================================================
   📌 GET DEPARTMENT STOCKS LITE
============================================================ */
export const getAllDepartmentStocksLite = async (req, res) => {
  try {
    const allowed = await authzService.checkPermission({ user: req.user, module: "department_stock", action: "read", res });
    if (!allowed) return;

    const { q } = req.query;
    const role = (req.user?.roleNames?.[0] || "staff").toLowerCase();
    const where = { status: DEPARTMENT_STOCK_STATUS.ACTIVE };

    if (!isSuperAdmin(req.user)) {
      where.organization_id = req.user.organization_id;
      if (role === "facilityhead") where.facility_id = req.user.facility_id;
    } else {
      if (req.query.organization_id) where.organization_id = req.query.organization_id;
      if (req.query.facility_id) where.facility_id = req.query.facility_id;
    }

    if (q) {
      where[Op.or] = [
        { "$masterItem.name$": { [Op.iLike]: `%${q}%` } },
        { "$department.name$": { [Op.iLike]: `%${q}%` } },
      ];
    }

    const items = await DepartmentStock.findAll({
      where,
      attributes: ["id", "quantity", "min_threshold", "max_threshold", "status"],
      include: [
        { model: MasterItem, as: "masterItem", attributes: ["id", "name", "code"] },
        { model: Department, as: "department", attributes: ["id", "name"] },
      ],
      order: [["updated_at", "DESC"]],
      limit: 20,
    });

    const result = items.map(ds => ({
      id: ds.id,
      name: `${ds.masterItem?.name || "Unknown Item"} - ${ds.department?.name || "No Dept"} (${ds.quantity})`,
      quantity: ds.quantity,
      status: ds.status,
    }));

    return success(res, "✅ Department Stocks loaded (lite)", { records: result });
  } catch (err) {
    return error(res, "❌ Failed to load department stocks (lite)", err);
  }
};

/* ============================================================
   📌 BULK OPS
============================================================ */
export const bulkUpdateDepartmentStocks = async (req, res) => {
  try {
    if (!Array.isArray(req.body) || req.body.length === 0) return error(res, "Payload must be non-empty array", null, 400);
    const { updated, skipped } = await departmentStockService.bulkUpdateStocks(req.body, req.user);
    await auditService.logAction({ user: req.user, module: "department_stock", action: "bulk_update", details: { updatedCount: updated.length, skippedCount: skipped.length } });
    return success(res, `✅ ${updated.length} updated, ⚠️ ${skipped.length} skipped`, { updated, skipped });
  } catch (err) {
    return error(res, "❌ Failed to bulk update department stocks", err);
  }
};

export const bulkDeleteDepartmentStocks = async (req, res) => {
  try {
    if (!Array.isArray(req.body) || req.body.length === 0) return error(res, "Payload must be non-empty array of IDs", null, 400);
    const { deleted, skipped } = await departmentStockService.bulkDeleteStocks(req.body, req.user);
    await auditService.logAction({ user: req.user, module: "department_stock", action: "bulk_delete", details: { deletedCount: deleted.length, skippedCount: skipped.length } });
    return success(res, `✅ ${deleted.length} deleted, ⚠️ ${skipped.length} skipped`, { deleted, skipped });
  } catch (err) {
    return error(res, "❌ Failed to bulk delete department stocks", err);
  }
};

export const bulkToggleDepartmentStockStatus = async (req, res) => {
  try {
    if (!Array.isArray(req.body) || req.body.length === 0) return error(res, "Payload must be non-empty array of IDs", null, 400);
    const { toggled, skipped } = await departmentStockService.bulkToggleStatus(req.body, req.user);
    await auditService.logAction({ user: req.user, module: "department_stock", action: "bulk_toggle_status", details: { toggledCount: toggled.length, skippedCount: skipped.length } });
    return success(res, `✅ ${toggled.length} toggled, ⚠️ ${skipped.length} skipped`, { toggled, skipped });
  } catch (err) {
    return error(res, "❌ Failed to bulk toggle department stock status", err);
  }
};
