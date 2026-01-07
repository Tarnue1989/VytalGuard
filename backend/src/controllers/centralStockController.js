// 📁 controllers/centralStockController.js
// ============================================================================
// 🧠 VytalGuard HMS – Central Stock Controller (Enterprise Master Pattern)
// ----------------------------------------------------------------------------
// ✅ Includes:
//    - Full CRUD + Bulk operations
//    - Role-safe scoping (superadmin/org_owner/facility_head/etc.)
//    - Dynamic summary via buildDynamicSummary()
//    - Ledger-first calls through inventoryService
//    - Audit-safe, permission-driven architecture
// ============================================================================

import Joi from "joi";
import { Op, fn, col } from "sequelize";
import {
  sequelize,
  CentralStock,
  User,
  Facility,
  Organization,
  MasterItem,
  Supplier,
} from "../models/index.js";
import { success, error } from "../utils/response.js";
import { buildQueryOptions } from "../utils/queryHelper.js";
import { CENTRAL_STOCK_STATUS } from "../constants/enums.js";
import { authzService } from "../services/authzService.js";
import { auditService } from "../services/auditService.js";
import { inventoryService } from "../services/inventoryService.js";
import { buildDynamicSummary } from "../utils/summaryHelper.js";

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
const CENTRAL_STOCK_INCLUDES = [
  { model: Organization, as: "organization", attributes: ["id", "name", "code"] },
  { model: Facility, as: "facility", attributes: ["id", "name", "code", "organization_id"] },
  { model: MasterItem, as: "masterItem", attributes: ["id", "name", "code", "description"] },
  { model: Supplier, as: "supplier", attributes: ["id", "name", "contact_name", "contact_phone"] },
  { model: User, as: "createdBy", attributes: ["id", "first_name", "last_name"] },
  { model: User, as: "updatedBy", attributes: ["id", "first_name", "last_name"] },
  { model: User, as: "deletedBy", attributes: ["id", "first_name", "last_name"] },
];

/* ============================================================
   📋 JOI SCHEMA FACTORY
============================================================ */
function buildCentralStockSchema(userRole, mode = "create") {
  const base = {
    master_item_id: Joi.string().uuid().required(),
    supplier_id: Joi.string().uuid().allow(null, ""),
    batch_number: Joi.string().max(100).required(),
    received_date: Joi.date().required(),
    expiry_date: Joi.date().allow("", null),
    quantity: Joi.number().integer().min(0).strict().default(0),
    unit_cost: Joi.number().precision(2).min(0).allow(null).strict(),
    is_locked: Joi.boolean().default(false),

    status:
      mode === "create"
        ? Joi.forbidden()
        : Joi.forbidden(),

  };

  if (userRole === "superadmin") {
    base.organization_id = Joi.string().uuid().optional();
    base.facility_id = Joi.string().uuid().optional();
  }

  if (mode === "update") {
    Object.keys(base).forEach(k => {
      if (k !== "status") base[k] = base[k].optional();
    });
  }

  return Joi.object(base);
}

/* ============================================================
   📌 CREATE STOCK
============================================================ */
export const createStock = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const roleName = (req.user?.roleNames?.[0] || "").toLowerCase().replace(/\s+/g, "");
    const schema = buildCentralStockSchema(roleName, "create");

    const payloads = Array.isArray(req.body) ? req.body : [req.body];
    if (payloads.length === 0) {
      await t.rollback();
      return error(res, "Payload must be a non-empty array or object", null, 400);
    }

    const created = [];
    const skipped = [];

    for (const [idx, payload] of payloads.entries()) {
      delete payload.status;

      const { error: validationError, value } = schema.validate(payload, {
        stripUnknown: true,
      });
      if (validationError) {
        skipped.push({ index: idx, reason: "Validation failed", details: validationError.details });
        continue;
      }

      let orgId = req.user.organization_id || null;
      let facilityId = req.user.facility_id || null;

      if (isSuperAdmin(req.user)) {
        orgId = value.organization_id || payload.organization_id || null;
        facilityId = value.facility_id || payload.facility_id || null;
      }

      if (!orgId) {
        skipped.push({ index: idx, reason: "Missing organization assignment" });
        continue;
      }

      const exists = await CentralStock.findOne({
        where: {
          organization_id: orgId,
          facility_id: facilityId,
          master_item_id: value.master_item_id,
          batch_number: value.batch_number,
          received_date: value.received_date,
        },
        paranoid: false,
        transaction: t,
      });
      if (exists) {
        skipped.push({ index: idx, reason: `Duplicate batch: ${value.batch_number}` });
        continue;
      }

      const stockData = { ...value, organization_id: orgId, facility_id: facilityId };
      const newStock = await inventoryService.addStockFromSupplier(stockData, req.user?.id, t);
      created.push(newStock);
    }

    await t.commit();

    const full = created.length
      ? await CentralStock.findAll({
          where: { id: { [Op.in]: created.map(c => c.id) } },
          include: CENTRAL_STOCK_INCLUDES,
        })
      : [];

    await auditService.logAction({
      user: req.user,
      module: "central_stock",
      action: payloads.length > 1 ? "bulk_create" : "create",
      details: { ids: created.map(c => c.id), saved: created.length, skipped: skipped.length },
    });

    return success(res, {
      message: `✅ ${created.length} created, ⚠️ ${skipped.length} skipped`,
      records: full,
      skipped,
    });
  } catch (err) {
    await t.rollback();
    return error(res, "❌ Failed to create stock", err);
  }
};

/* ============================================================
   📌 UPDATE STOCK
============================================================ */
export const updateStock = async (req, res) => {
  try {
    const { id } = req.params;
    const roleName = (req.user?.roleNames?.[0] || "").toLowerCase().replace(/\s+/g, "");
    const schema = buildCentralStockSchema(roleName, "update");

    delete req.body.status;
    const { error: validationError, value } = schema.validate(req.body, { stripUnknown: true });
    if (validationError) return error(res, "Validation failed", validationError, 400);

    const updated = await inventoryService.updateStock(id, value, req.user);

    await auditService.logAction({
      user: req.user,
      module: "central_stock",
      action: "update",
      entityId: id,
      entity: updated,
      details: { ids: [id], ...value },
    });

    return success(res, "✅ Central Stock updated", updated);
  } catch (err) {
    return error(res, "❌ Failed to update stock", err);
  }
};

/* ============================================================
   📌 GET ALL CENTRAL STOCKS (with Summary)
============================================================ */
export const getAllStocks = async (req, res) => {
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module: "central_stock",
      action: "read",
      res,
    });
    if (!allowed) return;

    const role = (req.user?.roleNames?.[0] || "staff").toLowerCase().replace(/\s+/g, "");
    const options = buildQueryOptions(req, "received_date", "DESC");
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
        { batch_number: { [Op.iLike]: `%${options.search}%` } },
        { item_name: { [Op.iLike]: `%${options.search}%` } },
      ];
    }

    const { count, rows } = await CentralStock.findAndCountAll({
      where: options.where,
      include: CENTRAL_STOCK_INCLUDES,
      order: options.order,
      offset: options.offset,
      limit: options.limit,
    });

    // 🧠 Enterprise dynamic summary
    const summary = await buildDynamicSummary({
      model: CentralStock,
      options,
      statusEnums: Object.values(CENTRAL_STOCK_STATUS),
    });

    await auditService.logAction({
      user: req.user,
      module: "central_stock",
      action: "list",
      details: { query: req.query, returned: count },
    });

    return success(res, "✅ Central Stocks loaded", {
      records: rows,
      summary,
      pagination: {
        total: count,
        page: options.pagination.page,
        pageCount: Math.ceil(count / options.pagination.limit),
      },
    });
  } catch (err) {
    return error(res, "❌ Failed to load stocks", err);
  }
};

/* ============================================================
   📌 GET STOCK BY ID
============================================================ */
export const getStockById = async (req, res) => {
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module: "central_stock",
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

    const found = await CentralStock.findOne({ where, include: CENTRAL_STOCK_INCLUDES });
    if (!found) return error(res, "❌ Central Stock not found", null, 404);

    await auditService.logAction({
      user: req.user,
      module: "central_stock",
      action: "view",
      entityId: id,
      entity: found,
      details: {
        ids: [id],
      },
    });

    return success(res, "✅ Central Stock loaded", found);
  } catch (err) {
    return error(res, "❌ Failed to load stock", err);
  }
};

/* ============================================================
   📌 GET STOCKS LITE (autocomplete)
============================================================ */
export const getAllStocksLite = async (req, res) => {
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module: "central_stock",
      action: "read",
      res,
    });
    if (!allowed) return;

    const role = (req.user?.roleNames?.[0] || "staff").toLowerCase().replace(/\s+/g, "");
    const { q } = req.query;

    const where = { status: CENTRAL_STOCK_STATUS.ACTIVE };

    if (!isSuperAdmin(req.user)) {
      where.organization_id = req.user.organization_id;
      if (role === "facilityhead") where.facility_id = req.user.facility_id;
    } else {
      if (req.query.organization_id) where.organization_id = req.query.organization_id;
      if (req.query.facility_id) where.facility_id = req.query.facility_id;
    }

    if (q) {
      where[Op.or] = [
        { batch_number: { [Op.iLike]: `%${q}%` } },
      ];
    }

    const items = await CentralStock.findAll({
      where,
      attributes: ["id", "batch_number", "quantity", "received_date", "expiry_date"],
      order: [["received_date", "DESC"]],
      limit: 20,
    });

    const result = items.map(i => ({
      id: i.id,
      batch_number: i.batch_number,
      quantity: i.quantity,
      received_date: i.received_date,
      expiry_date: i.expiry_date,
    }));

    await auditService.logAction({
      user: req.user,
      module: "central_stock",
      action: "list_lite",
      details: { count: result.length, q },
    });

    return success(res, "✅ Central Stocks loaded (lite)", { records: result });
  } catch (err) {
    return error(res, "❌ Failed to load stocks (lite)", err);
  }
};

/* ============================================================
   📌 BULK UPDATE STOCKS (ledger-first via service)
============================================================ */
export const bulkUpdateStocks = async (req, res) => {
  try {
    const roleName = (req.user?.roleNames?.[0] || "").toLowerCase().replace(/\s+/g, "");
    const schema = buildCentralStockSchema(roleName, "update");

    if (!Array.isArray(req.body) || req.body.length === 0) {
      return error(res, "Payload must be a non-empty array", null, 400);
    }

    const updatedRecords = [];
    const skipped = [];

    for (const payload of req.body) {
      if (!payload.id) {
        skipped.push({ reason: "Missing id in payload" });
        continue;
      }

      // 🚫 Remove status if frontend sent it
      delete payload.status;

      const { error: validationError, value } = schema.validate(payload, { stripUnknown: true });
      if (validationError) {
        skipped.push({ id: payload.id, reason: "Validation failed" });
        continue;
      }

      try {
        const updated = await inventoryService.updateStock(payload.id, value, req.user);
        updatedRecords.push(updated);
      } catch (err) {
        skipped.push({ id: payload.id, reason: err.message });
      }
    }

    await auditService.logAction({
      user: req.user,
      module: "central_stock",
      action: "bulk_update",
      details: {
        ids: updatedRecords.map((r) => r.id),
        updated: updatedRecords.length,
        skipped: skipped.length,
      },
    });

    return success(res, {
      message: `✅ ${updatedRecords.length} updated, ⚠️ ${skipped.length} skipped`,
      records: updatedRecords,
      skipped,
    });
  } catch (err) {
    return error(res, "❌ Failed to bulk update stocks", err);
  }
};


/* ============================================================
   📌 TOGGLE STOCK STATUS (ledger-first)
============================================================ */
export const toggleStockStatus = async (req, res) => {
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module: "central_stock",
      action: "update",
      res,
    });
    if (!allowed) return;

    const { id } = req.params;
    const newStatus = req.body?.status; // optionally allow explicit status
    const updated = await inventoryService.toggleStockStatus(id, req.user, newStatus);

    await auditService.logAction({
      user: req.user,
      module: "central_stock",
      action: "toggle_status",
      entityId: id,
      entity: updated,
      details: {
        ids: [id],
        to: updated.status,
      },
    });

    return success(res, `✅ Central Stock status set to ${updated.status}`, updated);
  } catch (err) {
    return error(res, "❌ Failed to toggle stock status", err);
  }
};

/* ============================================================
   📌 RESTORE STOCK (ledger-first)
============================================================ */
export const restoreStock = async (req, res) => {
  try {
    const { id } = req.params;
    const restored = await inventoryService.restoreStock(id, req.user);

    await auditService.logAction({
      user: req.user,
      module: "central_stock",
      action: "restore",
      entityId: id,
      entity: restored,
      details: {
        ids: [id],
      },
    });

    return success(res, "✅ Central Stock restored", restored);
  } catch (err) {
    return error(res, "❌ Failed to restore stock", err);
  }
};

/* ============================================================
   📌 DELETE STOCK (ledger-first)
============================================================ */
export const deleteStock = async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await inventoryService.deleteStock(id, req.user);

    await auditService.logAction({
      user: req.user,
      module: "central_stock",
      action: "delete",
      entityId: id,
      entity: deleted,
      details: {
        ids: [id],
      },
    });

    return success(res, "✅ Central Stock deleted", deleted);
  } catch (err) {
    return error(res, "❌ Failed to delete stock", err);
  }
};

/* ============================================================
   📌 LOCK STOCK (ledger-first)
============================================================ */
export const lockStock = async (req, res) => {
  try {
    const { id } = req.params;
    const locked = await inventoryService.lockStock(id, req.user);

    await auditService.logAction({
      user: req.user,
      module: "central_stock",
      action: "lock",
      entityId: id,
      entity: locked,
      details: {
        ids: [id],
      },
    });

    return success(res, "✅ Central Stock locked", locked);
  } catch (err) {
    return error(res, "❌ Failed to lock stock", err);
  }
};

/* ============================================================
   📌 UNLOCK STOCK (Super Admin only, ledger-first)
============================================================ */
export const unlockStock = async (req, res) => {
  try {
    if (!isSuperAdmin(req.user)) {
      return error(res, "❌ Only Super Admin can unlock stocks", null, 409);
    }

    const { id } = req.params;
    const unlocked = await inventoryService.unlockStock(id, req.user);

    await auditService.logAction({
      user: req.user,
      module: "central_stock",
      action: "unlock",
      entityId: id,
      entity: unlocked,
      details: {
        ids: [id],
      },
    });

    return success(res, "✅ Central Stock unlocked", unlocked);
  } catch (err) {
    return error(res, "❌ Failed to unlock stock", err);
  }
};

/* ============================================================
   📌 BULK TOGGLE STOCK STATUS (ledger-first)
============================================================ */
export const bulkToggleStockStatus = async (req, res) => {
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module: "central_stock",
      action: "update",
      res,
    });
    if (!allowed) return;

    if (!Array.isArray(req.body) || req.body.length === 0) {
      return error(res, "Payload must be a non-empty array of IDs", null, 400);
    }

    const { toggled, skipped } = await inventoryService.bulkToggleStockStatus(req.body, req.user);

    await auditService.logAction({
      user: req.user,
      module: "central_stock",
      action: "bulk_toggle_status",
      details: {
        ids: req.body,
        toggledCount: toggled.length,
        skippedCount: skipped.length,
      },
    });

    return success(res, `✅ ${toggled.length} toggled, ⚠️ ${skipped.length} skipped`, {
      toggled,
      skipped,
    });
  } catch (err) {
    return error(res, "❌ Failed to bulk toggle stock status", err);
  }
};

/* ============================================================
   📌 BULK RESTORE STOCKS (ledger-first)
============================================================ */
export const bulkRestoreStocks = async (req, res) => {
  try {
    if (!Array.isArray(req.body) || req.body.length === 0) {
      return error(res, "Payload must be a non-empty array of IDs", null, 400);
    }

    const { restored, skipped } = await inventoryService.bulkRestoreStocks(req.body, req.user);

    await auditService.logAction({
      user: req.user,
      module: "central_stock",
      action: "bulk_restore",
      details: {
        ids: req.body,
        restoredCount: restored.length,
        skippedCount: skipped.length,
      },
    });

    return success(res, `✅ ${restored.length} restored, ⚠️ ${skipped.length} skipped`, {
      restored,
      skipped,
    });
  } catch (err) {
    return error(res, "❌ Failed to bulk restore stocks", err);
  }
};

/* ============================================================
   📌 BULK DELETE STOCKS (ledger-first)
============================================================ */
export const bulkDeleteStocks = async (req, res) => {
  try {
    if (!Array.isArray(req.body) || req.body.length === 0) {
      return error(res, "Payload must be a non-empty array of IDs", null, 400);
    }

    const { deleted, skipped } = await inventoryService.bulkDeleteStocks(req.body, req.user);

    await auditService.logAction({
      user: req.user,
      module: "central_stock",
      action: "bulk_delete",
      details: {
        ids: req.body,
        deletedCount: deleted.length,
        skippedCount: skipped.length,
      },
    });

    return success(res, `✅ ${deleted.length} deleted, ⚠️ ${skipped.length} skipped`, {
      deleted,
      skipped,
    });
  } catch (err) {
    return error(res, "❌ Failed to bulk delete stocks", err);
  }
};
