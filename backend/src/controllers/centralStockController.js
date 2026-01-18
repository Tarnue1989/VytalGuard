// 📁 controllers/centralStockController.js
// ============================================================================
// 🧠 VytalGuard HMS – Central Stock Controller (Enterprise Master Pattern)
// ----------------------------------------------------------------------------
// ✅ Full CRUD + Bulk operations
// ✅ Role-safe scoping (SuperAdmin / Org / Facility)
// ✅ Date-range filtering
// ✅ Dynamic summary via buildDynamicSummary()
// ✅ Ledger-first inventoryService
// ✅ Audit-safe, permission-driven architecture
// ============================================================================

import Joi from "joi";
import { Op } from "sequelize";

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
import { normalizeDateRangeLocal } from "../utils/date-utils.js";
import { resolveOrgFacility } from "../utils/resolveOrgFacility.js";
import { validate } from "../utils/validation.js";
import {
  isSuperAdmin,
  isOrgLevelUser,
  isFacilityHead,
} from "../utils/role-utils.js";
import { makeModuleLogger } from "../utils/debugLogger.js";
import { buildDynamicSummary } from "../utils/summaryHelper.js";

import { CENTRAL_STOCK_STATUS } from "../constants/enums.js";
import { authzService } from "../services/authzService.js";
import { auditService } from "../services/auditService.js";
import { inventoryService } from "../services/inventoryService.js";

/* ============================================================
   🔐 MODULE
============================================================ */
const MODULE_KEY = "central_stock";

/* ============================================================
   🔧 LOCAL DEBUG OVERRIDE
============================================================ */
const DEBUG_OVERRIDE = true; // 👈 turn OFF in prod
const debug = makeModuleLogger("centralStockController", DEBUG_OVERRIDE);

/* ============================================================
   🔗 SHARED INCLUDES
============================================================ */
const CENTRAL_STOCK_INCLUDES = [
  {
    model: Organization,
    as: "organization",
    attributes: ["id", "name", "code"],
    required: true,
  },
  {
    model: Facility,
    as: "facility",
    attributes: ["id", "name", "code", "organization_id"],
    required: false,
  },
  {
    model: MasterItem,
    as: "masterItem",
    attributes: ["id", "name", "code", "description"],
    required: true,
  },
  {
    model: Supplier,
    as: "supplier",
    attributes: ["id", "name", "contact_name", "contact_phone"],
    required: false,
  },
  {
    model: User,
    as: "createdBy",
    attributes: ["id", "first_name", "last_name"],
  },
  {
    model: User,
    as: "updatedBy",
    attributes: ["id", "first_name", "last_name"],
  },
  {
    model: User,
    as: "deletedBy",
    attributes: ["id", "first_name", "last_name"],
  },
];

/* ============================================================
   📋 ROLE-AWARE JOI SCHEMA (MASTER PATTERN)
============================================================ */
function buildCentralStockSchema(userRole, mode = "create") {
  const base = {
    master_item_id: Joi.string().uuid().required(),
    supplier_id: Joi.string().uuid().allow("", null),

    batch_number: Joi.string().max(100).required(),
    received_date: Joi.date().required(),
    expiry_date: Joi.date().allow("", null),

    quantity: Joi.number().integer().min(0).strict().default(0),
    unit_cost: Joi.number().precision(2).min(0).allow(null),

    is_locked: Joi.boolean().default(false),

    // 🔒 backend-controlled
    status: Joi.forbidden(),
    organization_id: Joi.forbidden(),
    facility_id: Joi.forbidden(),
  };

  if (userRole === "superadmin") {
    base.organization_id = Joi.string().uuid().optional();
    base.facility_id = Joi.string().uuid().optional();
  }

  if (mode === "update") {
    Object.keys(base).forEach((k) => {
      base[k] = base[k].optional();
    });
  }

  return Joi.object(base);
}
/* ============================================================
   📌 CREATE STOCK (MASTER PARITY + BULK SAFE)
============================================================ */
export const createStock = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module: MODULE_KEY,
      action: "create",
      res,
    });
    if (!allowed) return;

    debug.log("create → incoming body", req.body);

    const role =
      (req.user?.roleNames?.[0] || "staff").toLowerCase();

    const schema = buildCentralStockSchema(role, "create");
    const payloads = Array.isArray(req.body) ? req.body : [req.body];

    if (!payloads.length) {
      await t.rollback();
      return error(res, "Payload must not be empty", null, 400);
    }

    const createdIds = [];
    const skipped = [];

    for (const [index, payload] of payloads.entries()) {
      delete payload.status;

      const { value, errors } = validate(schema, payload);
      if (errors) {
        skipped.push({ index, reason: "Validation failed", errors });
        continue;
      }

      /* ========================================================
         🧭 TENANT SCOPE (MASTER)
      ======================================================== */
      const { orgId, facilityId } = resolveOrgFacility({
        user: req.user,
        value,
        body: payload,
      });

      if (!orgId) {
        skipped.push({ index, reason: "Missing organization assignment" });
        continue;
      }

      /* ========================================================
         🚫 DUPLICATE CHECK (BATCH-LEVEL)
      ======================================================== */
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
        skipped.push({
          index,
          reason: `Duplicate batch ${value.batch_number}`,
        });
        continue;
      }

      const created = await inventoryService.addStockFromSupplier(
        {
          ...value,
          organization_id: orgId,
          facility_id: facilityId,
        },
        req.user?.id || null,
        t
      );

      createdIds.push(created.id);
    }

    await t.commit();

    const records = createdIds.length
      ? await CentralStock.findAll({
          where: { id: { [Op.in]: createdIds } },
          include: CENTRAL_STOCK_INCLUDES,
        })
      : [];

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: payloads.length > 1 ? "bulk_create" : "create",
      details: {
        created: createdIds.length,
        skipped: skipped.length,
        ids: createdIds,
      },
    });

    return success(res, "✅ Central stock created", {
      records,
      skipped,
    });
  } catch (err) {
    await t.rollback();
    debug.error("createStock → FAILED", err);
    return error(res, "❌ Failed to create stock", err);
  }
};

/* ============================================================
   📌 UPDATE STOCK (MASTER PARITY)
============================================================ */
export const updateStock = async (req, res) => {
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module: MODULE_KEY,
      action: "update",
      res,
    });
    if (!allowed) return;

    const { id } = req.params;
    debug.log("update → id", id);

    const role =
      (req.user?.roleNames?.[0] || "staff").toLowerCase();

    const { value, errors } = validate(
      buildCentralStockSchema(role, "update"),
      req.body
    );

    if (errors) {
      return error(res, "Validation failed", errors, 400);
    }

    const updated = await inventoryService.updateStock(
      id,
      value,
      req.user
    );

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "update",
      entityId: id,
      entity: updated,
      details: value,
    });

    return success(res, "✅ Central stock updated", updated);
  } catch (err) {
    debug.error("updateStock → FAILED", err);
    return error(res, "❌ Failed to update stock", err);
  }
};

/* ============================================================
   📌 GET ALL CENTRAL STOCK (MASTER + DATE + SUMMARY)
============================================================ */
export const getAllStocks = async (req, res) => {
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module: MODULE_KEY,
      action: "read",
      res,
    });
    if (!allowed) return;

    const options = buildQueryOptions(req, "received_date", "DESC");

    /* ========================================================
       🧹 STRIP UI-ONLY FILTERS
    ======================================================== */
    delete options.filters?.dateRange;

    options.where = { [Op.and]: [] };

    /* ========================================================
       📅 DATE RANGE FILTER
    ======================================================== */
    const dateRange = normalizeDateRangeLocal(req.query.dateRange);
    if (dateRange) {
      options.where[Op.and].push({
        received_date: {
          [Op.between]: [dateRange.start, dateRange.end],
        },
      });
    }

    /* ========================================================
       🔐 TENANT SCOPE
    ======================================================== */
    if (!isSuperAdmin(req.user)) {
      options.where[Op.and].push({
        organization_id: req.user.organization_id,
      });

      if (!isOrgLevelUser(req.user)) {
        options.where[Op.and].push({
          facility_id: req.user.facility_id,
        });
      }
    } else {
      if (req.query.organization_id) {
        options.where[Op.and].push({
          organization_id: req.query.organization_id,
        });
      }
      if (req.query.facility_id) {
        options.where[Op.and].push({
          facility_id: req.query.facility_id,
        });
      }
    }

    /* ========================================================
       🔍 SEARCH (MASTER + JOIN AWARE)
    ======================================================== */
    if (options.search) {
      options.where[Op.and].push({
        [Op.or]: [
          { batch_number: { [Op.iLike]: `%${options.search}%` } },
          { "$masterItem.name$": { [Op.iLike]: `%${options.search}%` } },
          { "$masterItem.code$": { [Op.iLike]: `%${options.search}%` } },
        ],
      });
    }

    /* ========================================================
       🗂️ QUERY
    ======================================================== */
    const { count, rows } = await CentralStock.findAndCountAll({
      where: options.where,
      include: CENTRAL_STOCK_INCLUDES,
      order: options.order,
      offset: options.offset,
      limit: options.limit,
    });

    /* ========================================================
       🔢 SUMMARY (SECURITY-SAFE)
    ======================================================== */
    let summary = null;
    if (!isSuperAdmin(req.user) || req.query.organization_id) {
      summary = await buildDynamicSummary({
        model: CentralStock,
        baseWhere: options.where,
        statusEnums: Object.values(CENTRAL_STOCK_STATUS),
      });
    }

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "list",
      details: { query: req.query, returned: count },
    });

    return success(res, "✅ Central stocks loaded", {
      records: rows,
      summary,
      pagination: {
        total: count,
        page: options.pagination.page,
        pageCount: Math.ceil(count / options.pagination.limit),
      },
    });
  } catch (err) {
    debug.error("getAllStocks → FAILED", err);
    return error(res, "❌ Failed to load stocks", err);
  }
};

/* ============================================================
   📌 GET STOCK BY ID (MASTER PARITY)
============================================================ */
export const getStockById = async (req, res) => {
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module: MODULE_KEY,
      action: "read",
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
    } else {
      if (req.query.organization_id)
        where.organization_id = req.query.organization_id;
      if (req.query.facility_id)
        where.facility_id = req.query.facility_id;
    }

    const record = await CentralStock.findOne({
      where,
      include: CENTRAL_STOCK_INCLUDES,
    });

    if (!record) {
      return error(res, "Central stock not found", null, 404);
    }

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "view",
      entityId: id,
      entity: record,
    });

    return success(res, "✅ Central stock loaded", record);
  } catch (err) {
    debug.error("getStockById → FAILED", err);
    return error(res, "❌ Failed to load stock", err);
  }
};

/* ============================================================
   📌 GET STOCKS LITE (MASTER PARITY – AUTOCOMPLETE)
============================================================ */
export const getAllStocksLite = async (req, res) => {
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module: MODULE_KEY,
      action: "read",
      res,
    });
    if (!allowed) return;

    const { q } = req.query;

    const where = { [Op.and]: [] };

    /* ========================================================
       📌 STATUS FILTER (ENUM-SAFE – NO UNDEFINED)
    ======================================================== */
    if (
      CENTRAL_STOCK_STATUS &&
      typeof CENTRAL_STOCK_STATUS === "object" &&
      CENTRAL_STOCK_STATUS.ACTIVE
    ) {
      where[Op.and].push({
        status: CENTRAL_STOCK_STATUS.ACTIVE,
      });
    }

    /* ========================================================
       🔐 TENANT SCOPE (MASTER)
    ======================================================== */
    if (!isSuperAdmin(req.user)) {
      where[Op.and].push({
        organization_id: req.user.organization_id,
      });

      if (!isOrgLevelUser(req.user)) {
        where[Op.and].push({
          facility_id: req.user.facility_id,
        });
      }
    } else {
      if (req.query.organization_id) {
        where[Op.and].push({
          organization_id: req.query.organization_id,
        });
      }
      if (req.query.facility_id) {
        where[Op.and].push({
          facility_id: req.query.facility_id,
        });
      }
    }

    /* ========================================================
       🔍 SEARCH (MASTER + JOIN AWARE)
    ======================================================== */
    if (q) {
      where[Op.and].push({
        [Op.or]: [
          { batch_number: { [Op.iLike]: `%${q}%` } },
          { "$masterItem.name$": { [Op.iLike]: `%${q}%` } },
          { "$masterItem.code$": { [Op.iLike]: `%${q}%` } },
        ],
      });
    }

    /* ========================================================
       🗂️ QUERY
    ======================================================== */
    const items = await CentralStock.findAll({
      where,
      include: [
        {
          model: MasterItem,
          as: "masterItem",
          attributes: [],
          required: true,
        },
      ],
      attributes: [
        "id",
        "batch_number",
        "quantity",
        "received_date",
        "expiry_date",
      ],
      order: [["received_date", "DESC"]],
      limit: 20,
    });

    const records = items.map((i) => ({
      id: i.id,
      batch_number: i.batch_number,
      quantity: i.quantity,
      received_date: i.received_date,
      expiry_date: i.expiry_date,
    }));

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "list_lite",
      details: {
        count: records.length,
        q: q || null,
      },
    });

    return success(res, "✅ Central stocks loaded (lite)", { records });
  } catch (err) {
    debug.error("list_lite → FAILED", err);
    return error(res, "❌ Failed to load stocks (lite)", err);
  }
};


/* ============================================================
   📌 BULK UPDATE STOCKS (MASTER PARITY – LEDGER FIRST)
============================================================ */
export const bulkUpdateStocks = async (req, res) => {
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module: MODULE_KEY,
      action: "update",
      res,
    });
    if (!allowed) return;

    if (!Array.isArray(req.body) || req.body.length === 0) {
      return error(res, "Payload must be a non-empty array", null, 400);
    }

    const role =
      (req.user?.roleNames?.[0] || "staff").toLowerCase();

    const schema = buildCentralStockSchema(role, "update");

    const updated = [];
    const skipped = [];

    for (const payload of req.body) {
      if (!payload?.id) {
        skipped.push({ reason: "Missing id" });
        continue;
      }

      delete payload.status;

      const { value, errors } = validate(schema, payload);
      if (errors) {
        skipped.push({ id: payload.id, reason: "Validation failed", errors });
        continue;
      }

      try {
        const record = await inventoryService.updateStock(
          payload.id,
          value,
          req.user
        );
        updated.push(record);
      } catch (err) {
        skipped.push({ id: payload.id, reason: err.message });
      }
    }

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "bulk_update",
      details: {
        updated: updated.length,
        skipped: skipped.length,
        ids: updated.map((r) => r.id),
      },
    });

    return success(res, "✅ Central stocks updated", {
      records: updated,
      skipped,
    });
  } catch (err) {
    debug.error("bulk_update → FAILED", err);
    return error(res, "❌ Failed to bulk update stocks", err);
  }
};

/* ============================================================
   📌 TOGGLE STOCK STATUS (MASTER PARITY – LEDGER FIRST)
============================================================ */
export const toggleStockStatus = async (req, res) => {
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module: MODULE_KEY,
      action: "update",
      res,
    });
    if (!allowed) return;

    const { id } = req.params;

    const updated = await inventoryService.toggleStockStatus(
      id,
      req.user,
      req.body?.status
    );

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "toggle_status",
      entityId: id,
      entity: updated,
      details: { to: updated.status },
    });

    return success(
      res,
      `✅ Central stock status set to ${updated.status}`,
      updated
    );
  } catch (err) {
    debug.error("toggle_status → FAILED", err);
    return error(res, "❌ Failed to toggle stock status", err);
  }
};

/* ============================================================
   📌 RESTORE STOCK (MASTER PARITY)
============================================================ */
export const restoreStock = async (req, res) => {
  try {
    const { id } = req.params;

    const restored = await inventoryService.restoreStock(id, req.user);

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "restore",
      entityId: id,
      entity: restored,
    });

    return success(res, "✅ Central stock restored", restored);
  } catch (err) {
    debug.error("restore → FAILED", err);
    return error(res, "❌ Failed to restore stock", err);
  }
};

/* ============================================================
   📌 DELETE STOCK (MASTER PARITY – LEDGER FIRST)
============================================================ */
export const deleteStock = async (req, res) => {
  try {
    const { id } = req.params;

    const deleted = await inventoryService.deleteStock(id, req.user);

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "delete",
      entityId: id,
      entity: deleted,
    });

    return success(res, "✅ Central stock deleted", deleted);
  } catch (err) {
    debug.error("delete → FAILED", err);
    return error(res, "❌ Failed to delete stock", err);
  }
};

/* ============================================================
   📌 LOCK STOCK (MASTER PARITY)
============================================================ */
export const lockStock = async (req, res) => {
  try {
    const { id } = req.params;

    const locked = await inventoryService.lockStock(id, req.user);

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "lock",
      entityId: id,
      entity: locked,
    });

    return success(res, "✅ Central stock locked", locked);
  } catch (err) {
    debug.error("lock → FAILED", err);
    return error(res, "❌ Failed to lock stock", err);
  }
};

/* ============================================================
   📌 UNLOCK STOCK (SUPERADMIN ONLY – MASTER)
============================================================ */
export const unlockStock = async (req, res) => {
  try {
    if (!isSuperAdmin(req.user)) {
      return error(res, "❌ Only Super Admin can unlock stock", null, 403);
    }

    const { id } = req.params;

    const unlocked = await inventoryService.unlockStock(id, req.user);

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "unlock",
      entityId: id,
      entity: unlocked,
    });

    return success(res, "✅ Central stock unlocked", unlocked);
  } catch (err) {
    debug.error("unlock → FAILED", err);
    return error(res, "❌ Failed to unlock stock", err);
  }
};

/* ============================================================
   📌 BULK TOGGLE STOCK STATUS (MASTER PARITY)
============================================================ */
export const bulkToggleStockStatus = async (req, res) => {
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module: MODULE_KEY,
      action: "update",
      res,
    });
    if (!allowed) return;

    if (!Array.isArray(req.body) || req.body.length === 0) {
      return error(res, "Payload must be a non-empty array of IDs", null, 400);
    }

    const { toggled, skipped } =
      await inventoryService.bulkToggleStockStatus(req.body, req.user);

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "bulk_toggle_status",
      details: {
        toggled: toggled.length,
        skipped: skipped.length,
        ids: req.body,
      },
    });

    return success(
      res,
      `✅ ${toggled.length} toggled, ⚠️ ${skipped.length} skipped`,
      { toggled, skipped }
    );
  } catch (err) {
    debug.error("bulk_toggle_status → FAILED", err);
    return error(res, "❌ Failed to bulk toggle stock status", err);
  }
};
/* ============================================================
   📌 BULK RESTORE STOCKS (MASTER PARITY – LEDGER FIRST)
============================================================ */
export const bulkRestoreStocks = async (req, res) => {
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module: MODULE_KEY,
      action: "update",
      res,
    });
    if (!allowed) return;

    if (!Array.isArray(req.body) || req.body.length === 0) {
      return error(res, "Payload must be a non-empty array of IDs", null, 400);
    }

    const { restored, skipped } =
      await inventoryService.bulkRestoreStocks(req.body, req.user);

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "bulk_restore",
      details: {
        restored: restored.length,
        skipped: skipped.length,
        ids: req.body,
      },
    });

    return success(
      res,
      `✅ ${restored.length} restored, ⚠️ ${skipped.length} skipped`,
      { restored, skipped }
    );
  } catch (err) {
    debug.error("bulk_restore → FAILED", err);
    return error(res, "❌ Failed to bulk restore stocks", err);
  }
};

/* ============================================================
   📌 BULK DELETE STOCKS (MASTER PARITY – LEDGER FIRST)
============================================================ */
export const bulkDeleteStocks = async (req, res) => {
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module: MODULE_KEY,
      action: "delete",
      res,
    });
    if (!allowed) return;

    if (!Array.isArray(req.body) || req.body.length === 0) {
      return error(res, "Payload must be a non-empty array of IDs", null, 400);
    }

    const { deleted, skipped } =
      await inventoryService.bulkDeleteStocks(req.body, req.user);

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "bulk_delete",
      details: {
        deleted: deleted.length,
        skipped: skipped.length,
        ids: req.body,
      },
    });

    return success(
      res,
      `✅ ${deleted.length} deleted, ⚠️ ${skipped.length} skipped`,
      { deleted, skipped }
    );
  } catch (err) {
    debug.error("bulk_delete → FAILED", err);
    return error(res, "❌ Failed to bulk delete stocks", err);
  }
};
