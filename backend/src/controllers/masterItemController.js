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
  isOrgLevelUser,
  isFacilityHead,
} from "../utils/role-utils.js";
import { normalizeDateRangeLocal } from "../utils/date-utils.js";
import { buildDynamicSummary } from "../utils/summaryHelper.js";
import { makeModuleLogger } from "../utils/debugLogger.js";

/* ============================================================
   🧭 CONSTANTS
============================================================ */
const MODULE_KEY = "master_item";

const debug = makeModuleLogger("masterItem");
/* ============================================================
   🧩 ENUM NORMALIZATION (MASTER SAFE)
============================================================ */
const MASTER_ITEM_STATUS_VALUES = Object.values(MASTER_ITEM_STATUS);

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
   📌 CREATE ITEM (MASTER PARITY — FINAL FIXED)
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

    const { value, errors } = validate(buildItemSchema("create"), req.body);
    if (errors) {
      await t.rollback();
      return res.status(400).json({ success: false, errors });
    }

    ["organization_id", "facility_id", "feature_module_id"].forEach((f) => {
      if (value[f] === "") value[f] = null;
    });

    let orgId = null;
    let facilityId = null;

    /* ================= ROLE LOGIC ================= */
    if (isSuperAdmin(req.user)) {
      // ✅ allow GLOBAL
      orgId = value.organization_id ?? null;
      facilityId = value.facility_id ?? null;

    } else if (isOrgLevelUser(req.user)) {
      orgId = req.user.organization_id;
      facilityId = value.facility_id ?? req.user.facility_id ?? null;

    } else if (isFacilityHead(req.user)) {
      orgId = req.user.organization_id;
      facilityId = req.user.facility_id;

    } else {
      orgId = req.user.organization_id;
      facilityId = req.user.facility_id ?? null;
    }

    /* 🔥 FIX: allow global ONLY for superadmin */
    if (!orgId && !isSuperAdmin(req.user)) {
      await t.rollback();
      return error(res, "Organization is required", null, 400);
    }

    /* ================= DUPLICATE CHECK ================= */
    const exists = await MasterItem.findOne({
      where: {
        name: value.name,
        feature_module_id: value.feature_module_id ?? null,
        [Op.or]: [
          { organization_id: orgId, facility_id: facilityId },
          { organization_id: null, facility_id: null }, // include global
        ],
      },
      paranoid: false,
      transaction: t,
    });

    if (exists) {
      await t.rollback();
      return error(res, "Item already exists in this scope", null, 400);
    }

    if (!value.code) {
      const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, "");
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

    return success(res, "✅ Master Item created", created);
  } catch (err) {
    if (t.finished !== "commit") await t.rollback();
    return error(res, "❌ Failed to create item", err);
  }
};
/* ============================================================
   📌 UPDATE ITEM (MASTER PARITY — FINAL FIXED)
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

    /* ================= ROLE LOGIC ================= */
    let orgId = record.organization_id;
    let facilityId = record.facility_id;

    if (isSuperAdmin(req.user)) {
      // ✅ allow GLOBAL updates
      if ("organization_id" in value) orgId = value.organization_id ?? null;
      if ("facility_id" in value) facilityId = value.facility_id ?? null;

    } else if (isOrgLevelUser(req.user)) {
      orgId = req.user.organization_id;

      if (value.facility_id) {
        facilityId = value.facility_id;
      } else if (record.facility_id) {
        facilityId = record.facility_id;
      } else if (req.user.facility_id) {
        facilityId = req.user.facility_id;
      } else {
        facilityId = null;
      }

    } else if (isFacilityHead(req.user)) {
      orgId = req.user.organization_id;
      facilityId = req.user.facility_id;

    } else {
      orgId = req.user.organization_id;
      facilityId = req.user.facility_id ?? record.facility_id;
    }

    /* 🔥 FIX: allow global only for superadmin */
    if (!orgId && !isSuperAdmin(req.user)) {
      await t.rollback();
      return error(res, "Organization is required", null, 400);
    }

    /* ================= DUPLICATE CHECK ================= */
    if (value.name) {
      const finalModuleId =
        value.feature_module_id ?? record.feature_module_id;

      const exists = await MasterItem.findOne({
        where: {
          name: value.name,
          feature_module_id: finalModuleId,
          id: { [Op.ne]: id },
          [Op.or]: [
            { organization_id: orgId, facility_id: facilityId },
            { organization_id: null, facility_id: null }, // include global
          ],
        },
        paranoid: false,
        transaction: t,
      });

      if (exists) {
        await t.rollback();
        return error(
          res,
          "Item already exists in this scope",
          null,
          400
        );
      }
    }

    /* ================= UPDATE ================= */
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

    const full = await MasterItem.findByPk(record.id, {
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

    return success(res, "✅ Master Item updated", full);
  } catch (err) {
    if (t.finished !== "commit") await t.rollback();
    return error(res, "❌ Failed to update item", err);
  }
};

/* ============================================================
   📌 GET ALL ITEMS (MASTER PARITY WITH getAllDepartments)
   🔹 Pagination contract identical
   🔹 Status filter ENUM-safe
   🔹 Feature module filter
   🔹 Date used ONLY for filtering
   🔹 No scope pollution in summary
============================================================ */
export const getAllItems = async (req, res) => {
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module: MODULE_KEY,
      action: "view",
      res,
    });
    if (!allowed) return;

    const { q, category_id, feature_module_id, status } = req.query;

    const where = { [Op.and]: [] };

    /* ================= TENANT SCOPE ================= */
    if (!isSuperAdmin(req.user)) {
      where[Op.and].push({
        [Op.or]: [
          { organization_id: null }, // ✅ GLOBAL
          { organization_id: req.user.organization_id }, // ✅ ORG
        ],
      });

      where[Op.and].push({
        [Op.or]: [
          { facility_id: null }, // global + org level
          { facility_id: req.user.facility_id },
        ],
      });
    }

    /* ================= FILTERS ================= */
    if (status) where[Op.and].push({ status });
    if (category_id) where[Op.and].push({ category_id });
    if (feature_module_id) where[Op.and].push({ feature_module_id });

    if (q) {
      where[Op.and].push({
        [Op.or]: [
          { name: { [Op.iLike]: `%${q}%` } },
          { code: { [Op.iLike]: `%${q}%` } },
        ],
      });
    }

    const records = await MasterItem.findAll({
      where,
      include: MASTER_ITEM_INCLUDES,
      order: [["name", "ASC"]],
    });

    return success(res, "✅ Master Items loaded", { records });
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
   📌 GET ITEMS LITE (TRUE MASTER PARITY — FIXED SEARCH)
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
       🧭 RESOLVE TENANT
    ======================================================== */
    const { orgId, facilityId } = resolveOrgFacility({
      user: req.user,
      value: {},
      body: req.query,
    });

    // 🔥 FIX: never allow undefined
    const safeOrgId = orgId ?? null;
    const safeFacilityId = facilityId ?? null;

    const where = {
      status: MASTER_ITEM_STATUS.ACTIVE,
      [Op.and]: [],
    };

    /* ========================================================
       🌍 GLOBAL + ORG + FACILITY SCOPE
    ======================================================== */
    if (!isSuperAdmin(req.user)) {
      where[Op.and].push({
        [Op.or]: [
          { organization_id: null },       // GLOBAL
          { organization_id: safeOrgId },  // ORG
        ],
      });

      where[Op.and].push({
        [Op.or]: [
          { facility_id: null },           // GLOBAL + ORG
          { facility_id: safeFacilityId }, // FACILITY
        ],
      });
    }

    /* ========================================================
       🔍 SEARCH
    ======================================================== */
    const rawSearch = req.query.search || req.query.q || "";
    const search = rawSearch?.trim();

    if (search) {
      where[Op.and].push({
        [Op.or]: [
          { name: { [Op.iLike]: `%${search}%` } },
          { code: { [Op.iLike]: `%${search}%` } },
          { description: { [Op.iLike]: `%${search}%` } },
        ],
      });
    }

    /* ========================================================
       📦 QUERY
    ======================================================== */
    const items = await MasterItem.findAll({
      where,
      include: [
        {
          model: MasterItemCategory,
          as: "category",
          attributes: ["id", "name"],
        },
      ],
      attributes: [
        "id",
        "name",
        "code",
        "description",
        "category_id",
        "organization_id",
        "facility_id",
      ],
      order: [["name", "ASC"]],
      limit: 50,
    });

    /* ========================================================
       🧠 PRIORITY RESOLVER (NO DUPLICATES)
       Facility > Org > Global
    ======================================================== */
    const map = new Map();

    const getPriority = (i) =>
      i.facility_id ? 3 : i.organization_id ? 2 : 1;

    for (const item of items) {
      const key =
        (item.name || "").toLowerCase() +
        "_" +
        (item.feature_module_id || "");

      if (!map.has(key)) {
        map.set(key, item);
      } else {
        const existing = map.get(key);

        if (getPriority(item) > getPriority(existing)) {
          map.set(key, item);
        }
      }
    }

    const finalItems = Array.from(map.values());

    /* ========================================================
       🔄 MAP RESPONSE
    ======================================================== */
    const records = finalItems.map((i) => ({
      id: i.id,
      name: i.name,
      code: i.code || "",
      description: i.description || "",
      category_id: i.category_id || null,
      category: i.category
        ? { id: i.category.id, name: i.category.name }
        : null,
    }));

    /* ========================================================
       🧾 AUDIT
    ======================================================== */
    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "list_lite",
      details: { count: records.length, search: search || null },
    });

    /* ========================================================
       📤 RESPONSE
    ======================================================== */
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
