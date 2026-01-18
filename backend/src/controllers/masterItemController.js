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
  FeatureModule,
} from "../models/index.js";
import { success, error } from "../utils/response.js";
import { buildQueryOptions } from "../utils/queryHelper.js";
import { MASTER_ITEM_TYPES, MASTER_ITEM_STATUS } from "../constants/enums.js";
import { authzService } from "../services/authzService.js";
import { auditService } from "../services/auditService.js";

/* ============================================================
   🔒 ENTERPRISE SHARED UTILITIES (MASTER PARITY)
============================================================ */
import { validate } from "../utils/validation.js";
import { resolveOrgFacility } from "../utils/resolveOrgFacility.js";
import {
  isSuperAdmin,
  isFacilityHead,
} from "../utils/role-utils.js";
import { normalizeDateRangeLocal } from "../utils/date-utils.js";
import { buildDynamicSummary } from "../utils/summaryHelper.js";
import { makeModuleLogger } from "../utils/debugLogger.js";

/* ============================================================
   🧭 CONSTANTS
============================================================ */
const MODULE_KEY = "masterItem";
const debug = makeModuleLogger("masterItem");

/* ============================================================
   🔗 SHARED INCLUDES
============================================================ */
const MASTER_ITEM_INCLUDES = [
  { model: Organization, as: "organization", attributes: ["id", "name", "code"] },
  {
    model: Facility,
    as: "facility",
    attributes: ["id", "name", "code", "organization_id"],
  },
  { model: Department, as: "department", attributes: ["id", "name", "code"] },
  { model: MasterItemCategory, as: "category", attributes: ["id", "name", "code"] },
  { model: FeatureModule, as: "featureModule", attributes: ["id", "name", "key"] },
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
    feature_module_id: Joi.string().uuid().allow("", null),
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
   📌 CREATE ITEM (TRUE MASTER PARITY)
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

    debug.log("create → incoming body", req.body);

    const { value, errors } = validate(buildItemSchema("create"), req.body);
    if (errors) {
      debug.warn("create → validation error", errors);
      await t.rollback();
      return res.status(400).json({ success: false, errors });
    }

    ["organization_id", "facility_id", "feature_module_id"].forEach((f) => {
      if (value[f] === "") value[f] = null;
    });

    /* ========================================================
       🧭 SCOPE (SINGLE SOURCE OF TRUTH)
    ======================================================== */
    const { orgId, facilityId } = resolveOrgFacility({
      user: req.user,
      value,
      body: req.body,
    });

    if (isSuperAdmin(req.user) && !orgId) {
      await t.rollback();
      return error(res, "Organization is required", null, 400);
    }

    /* ========================================================
       🔍 DUPLICATION CHECK (SCOPE-SAFE)
    ======================================================== */
    const exists = await MasterItem.findOne({
      where: {
        organization_id: orgId,
        facility_id: facilityId,
        name: value.name,
      },
      paranoid: false,
      transaction: t,
    });

    if (exists) {
      await t.rollback();
      return error(
        res,
        "Item with this name already exists in this scope",
        null,
        400
      );
    }

    /* ========================================================
       🧾 CODE GENERATION
    ======================================================== */
    if (!value.code) {
      const datePart = new Date()
        .toISOString()
        .slice(0, 10)
        .replace(/-/g, "");
      const rand = Math.floor(Math.random() * 9000) + 1000;
      value.code = `MIT-${datePart}-${rand}`;
    }

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
   📌 UPDATE ITEM (TRUE MASTER PARITY)
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

    const { value, errors } = validate(buildItemSchema("update"), req.body);
    if (errors) {
      await t.rollback();
      return res.status(400).json({ success: false, errors });
    }

    ["organization_id", "facility_id", "feature_module_id"].forEach((f) => {
      if (value[f] === "") value[f] = null;
    });

    const record = await MasterItem.findOne({
      where: { id },
      transaction: t,
    });
    if (!record) {
      await t.rollback();
      return error(res, "Item not found", null, 404);
    }

    /* ========================================================
       🧭 SCOPE (SINGLE SOURCE OF TRUTH)
    ======================================================== */
    const { orgId, facilityId } = resolveOrgFacility({
      user: req.user,
      value,
      body: req.body,
    });

    if (value.name) {
      const exists = await MasterItem.findOne({
        where: {
          organization_id: orgId,
          facility_id: facilityId,
          name: value.name,
          id: { [Op.ne]: id },
        },
        paranoid: false,
        transaction: t,
      });

      if (exists) {
        await t.rollback();
        return error(
          res,
          "Item with this name already exists in this scope",
          null,
          400
        );
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

    const full = await MasterItem.findOne({
      where: { id },
      include: MASTER_ITEM_INCLUDES,
    });

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
   📌 GET ALL ITEMS (TRUE MASTER PARITY + STATUS FIXED)
============================================================ */
export const getAllItems = async (req, res) => {
  try {
    /* ========================================================
       🔐 AUTHORIZATION
    ======================================================== */
    const allowed = await authzService.checkPermission({
      user: req.user,
      module: MODULE_KEY,
      action: "read",
      res,
    });
    if (!allowed) return;

    /* ========================================================
       ⚙️ BASE QUERY OPTIONS (MASTER PARITY)
    ======================================================== */
    const options = buildQueryOptions(req, "name", "ASC");

    /* ========================================================
       🧹 STRIP UI-ONLY FILTERS (NEVER DB COLUMNS)
    ======================================================== */
    delete options.filters?.dateRange;
    delete options.filters?.light;

    /* ========================================================
       🧱 WHERE ROOT (ALWAYS NORMALIZED)
    ======================================================== */
    options.where = { [Op.and]: [] };

    /* ========================================================
       📅 DATE RANGE (MASTER – SINGLE FIELD)
    ======================================================== */
    const dateRange = normalizeDateRangeLocal(req.query.dateRange);
    if (dateRange) {
      options.where[Op.and].push({
        created_at: {
          [Op.between]: [dateRange.start, dateRange.end],
        },
      });
    }

    /* ========================================================
       🔐 TENANT SCOPE (MASTER)
    ======================================================== */
    if (!isSuperAdmin(req.user)) {
      options.where[Op.and].push({
        organization_id: req.user.organization_id,
      });

      if (isFacilityHead(req.user)) {
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
       🔍 GLOBAL SEARCH (SAFE, ADDITIVE)
    ======================================================== */
    if (options.search) {
      options.where[Op.and].push({
        [Op.or]: [
          { name: { [Op.iLike]: `%${options.search}%` } },
          { code: { [Op.iLike]: `%${options.search}%` } },
          { description: { [Op.iLike]: `%${options.search}%` } },
        ],
      });
    }

    /* ========================================================
       📌 STATUS FILTER (DB FILTER → ENUM SAFE) ✅ FIX
    ======================================================== */
    if (
      req.query.status &&
      Object.values(MASTER_ITEM_STATUS).includes(req.query.status)
    ) {
      options.where[Op.and].push({
        status: req.query.status,
      });
    }

    /* ========================================================
       🗂️ QUERY EXECUTION
    ======================================================== */
    const { count, rows } = await MasterItem.findAndCountAll({
      where: options.where,
      include: MASTER_ITEM_INCLUDES,
      order: options.order,
      offset: options.offset,
      limit: options.limit,
    });

    /* ========================================================
       🔢 SUMMARY (FILTER-AWARE)
    ======================================================== */
    const summary = await buildDynamicSummary({
      model: MasterItem,
      options,
    });

    /* ========================================================
       🧾 AUDIT LOG
    ======================================================== */
    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "list",
      details: {
        returned: count,
        query: req.query,
        dateRange: dateRange || null,
      },
    });

    /* ========================================================
       ✅ RESPONSE
    ======================================================== */
    return success(res, "✅ Master Items loaded", {
      records: rows,
      summary: summary || null,
      pagination: {
        total: count,
        page: options.pagination.page,
        pageCount: options.pagination.pageCount,
      },
    });
  } catch (err) {
    return error(res, "❌ Failed to load items", err);
  }
};

/* ============================================================
   📌 GET ITEM BY ID (TRUE MASTER PARITY)
============================================================ */
export const getItemById = async (req, res) => {
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
    }

    const found = await MasterItem.findOne({
      where,
      include: MASTER_ITEM_INCLUDES,
    });

    if (!found) {
      return error(res, "❌ Master Item not found", null, 404);
    }

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "view",
      entityId: id,
      entity: found,
    });

    return success(res, "✅ Master Item loaded", {
      records: [found],
      summary: null,
      pagination: {
        total: 1,
        page: 1,
        pageCount: 1,
      },
    });
  } catch (err) {
    return error(res, "❌ Failed to load item", err);
  }
};


/* ============================================================
   📌 GET ITEMS LITE (TRUE MASTER PARITY)
============================================================ */
export const getAllItemsLite = async (req, res) => {
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module: MODULE_KEY,
      action: "read",
      res,
    });
    if (!allowed) return;

    /* ========================================================
       🧭 SCOPE (SINGLE SOURCE OF TRUTH)
    ======================================================== */
    const { orgId, facilityId } = resolveOrgFacility({
      user: req.user,
      value: {},
      body: req.query,
    });

    const where = {
      status: MASTER_ITEM_STATUS.ACTIVE,
    };

    if (orgId) where.organization_id = orgId;
    if (facilityId) where.facility_id = facilityId;

    /* ========================================================
       🔍 GLOBAL SEARCH ONLY (LOCKED CONTRACT)
    ======================================================== */
    const search = req.query.search;
    if (search) {
      where[Op.or] = [
        { name: { [Op.iLike]: `%${search}%` } },
        { code: { [Op.iLike]: `%${search}%` } },
        { description: { [Op.iLike]: `%${search}%` } },
      ];
    }

    const items = await MasterItem.findAll({
      where,
      include: [
        {
          model: MasterItemCategory,
          as: "category",
          attributes: ["id", "name"],
        },
      ],
      attributes: ["id", "name", "code", "description", "category_id"],
      order: [["name", "ASC"]],
      limit: 20,
    });

    const records = items.map((i) => ({
      id: i.id,
      name: i.name,
      code: i.code || "",
      description: i.description || "",
      category_id: i.category_id || null,
      category: i.category
        ? { id: i.category.id, name: i.category.name }
        : null,
    }));

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "list_lite",
      details: { count: records.length, search: search || null },
    });

    return success(res, "✅ Master Items loaded (lite)", {
      records,
      summary: null,
      pagination: {
        total: records.length,
        page: 1,
        pageCount: 1,
      },
    });
  } catch (err) {
    return error(res, "❌ Failed to load items (lite)", err);
  }
};

/* ============================================================
   📌 TOGGLE ITEM STATUS (TRUE MASTER PARITY)
============================================================ */
export const toggleItemStatus = async (req, res) => {
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module: MODULE_KEY,
      action: "update",
      res,
    });
    if (!allowed) return;

    const { id } = req.params;

    /* ========================================================
       🧭 SCOPE (SINGLE SOURCE OF TRUTH)
    ======================================================== */
    const { orgId, facilityId } = resolveOrgFacility({
      user: req.user,
      value: {},
      body: req.query,
    });

    const where = { id };
    if (orgId) where.organization_id = orgId;
    if (facilityId) where.facility_id = facilityId;

    const item = await MasterItem.findOne({ where });
    if (!item) {
      return error(res, "❌ Master Item not found", null, 404);
    }

    const previousStatus = item.status;
    const newStatus =
      item.status === MASTER_ITEM_STATUS.ACTIVE
        ? MASTER_ITEM_STATUS.INACTIVE
        : MASTER_ITEM_STATUS.ACTIVE;

    await item.update({
      status: newStatus,
      updated_by_id: req.user?.id || null,
    });

    const full = await MasterItem.findOne({
      where: { id },
      include: MASTER_ITEM_INCLUDES,
    });

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "toggle_status",
      entityId: id,
      entity: full,
      details: { from: previousStatus, to: newStatus },
    });

    return success(res, `✅ Master Item status set to ${newStatus}`, {
      records: [full],
      summary: null,
      pagination: {
        total: 1,
        page: 1,
        pageCount: 1,
      },
    });
  } catch (err) {
    return error(res, "❌ Failed to toggle item status", err);
  }
};

/* ============================================================
   📌 DELETE ITEM (TRUE MASTER PARITY)
============================================================ */
export const deleteItem = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module: MODULE_KEY,
      action: "delete",
      res,
    });
    if (!allowed) return;

    const { id } = req.params;

    /* ========================================================
       🧭 SCOPE (SINGLE SOURCE OF TRUTH)
    ======================================================== */
    const { orgId, facilityId } = resolveOrgFacility({
      user: req.user,
      value: {},
      body: req.query,
    });

    const where = { id };
    if (orgId) where.organization_id = orgId;
    if (facilityId) where.facility_id = facilityId;

    const item = await MasterItem.findOne({
      where,
      transaction: t,
    });
    if (!item) {
      await t.rollback();
      return error(res, "❌ Master Item not found", null, 404);
    }

    await item.update(
      { deleted_by_id: req.user?.id || null },
      { transaction: t }
    );

    await item.destroy({ transaction: t });
    await t.commit();

    const full = await MasterItem.findOne({
      where: { id },
      include: MASTER_ITEM_INCLUDES,
      paranoid: false,
    });

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "delete",
      entityId: id,
      entity: full,
    });

    return success(res, "✅ Master Item deleted", {
      records: [full],
      summary: null,
      pagination: {
        total: 1,
        page: 1,
        pageCount: 1,
      },
    });
  } catch (err) {
    await t.rollback();
    return error(res, "❌ Failed to delete item", err);
  }
};
