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
import { makeModuleLogger } from "../utils/debugLogger.js";
import { validate } from "../utils/validation.js";
import { normalizeDateRangeLocal } from "../utils/date-utils.js";
import { buildDynamicSummary } from "../utils/summaryHelper.js";
import { resolveOrgFacility } from "../utils/resolveOrgFacility.js";
import {
  isSuperAdmin,
  isOrgLevelUser,
  isFacilityHead,
} from "../utils/role-utils.js";
import { ORDER_TYPE } from "../constants/enums.js";

/* ============================================================
   🧭 CONSTANTS & DEBUG
============================================================ */
const MODULE_KEY = "master_item_categories";

/* ============================================================
   🔧 LOCAL DEBUG OVERRIDE
============================================================ */
const DEBUG_OVERRIDE = true; // 👈 turn OFF in production
const debug = makeModuleLogger("masterItemCategoryController", DEBUG_OVERRIDE);

/* ============================================================
   🔤 AUTO CODE GENERATOR (BACKEND SOURCE OF TRUTH)
============================================================ */
const generateCategoryCode = (name) => {
  return name
    .trim()
    .toUpperCase()
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 5);
};

/* ============================================================
   🔗 SHARED INCLUDES
============================================================ */
const CATEGORY_INCLUDES = [
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
   📋 CATEGORY SCHEMA (FINAL — GLOBAL ONLY)
============================================================ */
function buildCategorySchema(userRole, mode = "create") {
  const base = {
    name: Joi.string().max(100).required(),
    code: Joi.string().max(50).allow("", null),
    description: Joi.string().allow("", null),

    // 🔥 ENUM-ALIGNED (BEST PRACTICE)
    order_type: Joi.string()
      .valid(
        ORDER_TYPE.SERVICE,
        ORDER_TYPE.PROCEDURE,
        ORDER_TYPE.LAB,
        ORDER_TYPE.MEDICATION
      )
      .required(),
  };

  if (mode === "update") {
    base.status = Joi.string()
      .valid(...Object.values(MASTER_ITEM_CATEGORY_STATUS))
      .optional();

    Object.keys(base).forEach((k) => {
      if (k !== "status") base[k] = base[k].optional();
    });
  }

  // ❌ DO NOT ALLOW facility_id
  base.facility_id = Joi.forbidden();

  // ❌ DO NOT ALLOW organization_id override (except superadmin optional)
  if (userRole === "superadmin") {
    base.organization_id = Joi.string().uuid().optional();
  } else {
    base.organization_id = Joi.forbidden();
  }

  return Joi.object(base);
}
/* ============================================================
   📌 CREATE CATEGORY (FINAL — GLOBAL ONLY)
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

    const { value, errors } = validate(
      buildCategorySchema(
        (req.user?.roleNames?.[0] || "").toLowerCase(),
        "create"
      ),
      req.body
    );

    if (errors) {
      await t.rollback();
      return res.status(400).json({ success: false, errors });
    }

    /* ========================================================
       🔥 GLOBAL CATEGORY (FIXED)
    ======================================================== */
    const orgId = req.user.organization_id;

    /* ========================================================
       🚫 UNIQUENESS CHECK (ORG LEVEL ONLY)
    ======================================================== */
    const exists = await MasterItemCategory.findOne({
      where: {
        organization_id: orgId,
        facility_id: null, // 🔥 ALWAYS NULL
        name: value.name,
      },
      paranoid: false,
      transaction: t,
    });

    if (exists) {
      await t.rollback();
      return error(
        res,
        "Category with this name already exists",
        null,
        400
      );
    }

    /* ========================================================
      🔤 AUTO-GENERATE CODE
    ======================================================== */
    const baseCode = generateCategoryCode(value.name);

    const count = await MasterItemCategory.count({
      where: {
        organization_id: orgId,
        code: { [Op.iLike]: `${baseCode}%` },
      },
      transaction: t,
    });

    const finalCode = count ? `${baseCode}${count + 1}` : baseCode;

    /* ========================================================
      💾 CREATE
    ======================================================== */
    const created = await MasterItemCategory.create(
      {
        ...value,
        code: finalCode, // 🔥 FORCE GENERATED CODE
        organization_id: orgId,
        facility_id: null,
        status: value.status || MASTER_ITEM_CATEGORY_STATUS.ACTIVE,
        created_by_id: req.user?.id || null,
      },
      { transaction: t }
    );
    await t.commit();

    const full = await MasterItemCategory.findOne({
      where: { id: created.id },
      include: CATEGORY_INCLUDES,
    });

    return success(res, "✅ Category created", full);

  } catch (err) {
    await t.rollback();
    return error(res, "❌ Failed to create category", err);
  }
};

/* ============================================================
   📌 UPDATE CATEGORY (FINAL — GLOBAL ONLY)
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

    const { value, errors } = validate(
      buildCategorySchema(
        (req.user?.roleNames?.[0] || "").toLowerCase(),
        "update"
      ),
      req.body
    );

    if (errors) {
      await t.rollback();
      return res.status(400).json({ success: false, errors });
    }

    const orgId = req.user.organization_id;

    const record = await MasterItemCategory.findOne({
      where: {
        id: req.params.id,
        organization_id: orgId,
        facility_id: null, // 🔥 GLOBAL ONLY
      },
      transaction: t,
    });

    if (!record) {
      await t.rollback();
      return error(res, "Category not found", null, 404);
    }

    /* ========================================================
       🚫 UNIQUENESS CHECK
    ======================================================== */
    if (value.name) {
      const exists = await MasterItemCategory.findOne({
        where: {
          organization_id: orgId,
          facility_id: null,
          name: value.name,
          id: { [Op.ne]: record.id },
        },
        paranoid: false,
        transaction: t,
      });

      if (exists) {
        await t.rollback();
        return error(
          res,
          "Category with this name already exists",
          null,
          400
        );
      }
    }

    /* ========================================================
       💾 UPDATE
    ======================================================== */
    await record.update(
      {
        ...value,
        organization_id: orgId,
        facility_id: null, // 🔥 FORCE GLOBAL
        updated_by_id: req.user?.id || null,
      },
      { transaction: t }
    );

    await t.commit();

    const full = await MasterItemCategory.findOne({
      where: { id: record.id },
      include: CATEGORY_INCLUDES,
    });

    return success(res, "✅ Category updated", full);

  } catch (err) {
    await t.rollback();
    return error(res, "❌ Failed to update category", err);
  }
};

/* ============================================================
   📌 GET ALL CATEGORIES (FINAL — GLOBAL SAFE)
============================================================ */
export const getAllCategories = async (req, res) => {
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module: MODULE_KEY,
      action: "read",
      res,
    });
    if (!allowed) return;

    const options = buildQueryOptions(req, "name", "ASC");

    delete options.filters?.dateRange;
    delete options.filters?.light;

    options.where = { [Op.and]: [] };

    /* ========================================================
       📅 DATE RANGE
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
       🔐 TENANT (GLOBAL-FIRST)
    ======================================================== */
    if (!isSuperAdmin(req.user)) {
      options.where[Op.and].push({
        organization_id: req.user.organization_id,
      });

      // 🔥 GLOBAL categories ONLY (clean + future-safe)
      options.where[Op.and].push({
        facility_id: null,
      });

    } else {
      if (req.query.organization_id) {
        options.where[Op.and].push({
          organization_id: req.query.organization_id,
        });
      }

      // 🔥 superadmin sees both global + facility if needed
      if (req.query.facility_id) {
        options.where[Op.and].push({
          facility_id: req.query.facility_id,
        });
      }
    }

    /* ========================================================
       🔍 SEARCH
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
       📌 STATUS
    ======================================================== */
    if (
      req.query.status &&
      Object.values(MASTER_ITEM_CATEGORY_STATUS).includes(req.query.status)
    ) {
      options.where[Op.and].push({
        status: req.query.status,
      });
    }

    /* ========================================================
       📦 QUERY
    ======================================================== */
    const { count, rows } = await MasterItemCategory.findAndCountAll({
      where: options.where,
      include: CATEGORY_INCLUDES,
      order: options.order,
      offset: options.offset,
      limit: options.limit,
    });

    const summary = await buildDynamicSummary({
      model: MasterItemCategory,
      options: {
        where: options.where,
      },
      statusEnums: MASTER_ITEM_CATEGORY_STATUS,
    });

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

    return success(res, "✅ Categories loaded", {
      records: rows,
      summary,
      pagination: {
        total: count,
        page: options.pagination.page,
        pageCount: Math.ceil(count / options.pagination.limit),
      },
    });

  } catch (err) {
    debug.error("list → FAILED", err);
    return error(res, "❌ Failed to load categories", err);
  }
};

/* ============================================================
   📌 GET CATEGORY BY ID (FINAL — GLOBAL SAFE)
============================================================ */
export const getCategoryById = async (req, res) => {
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

    /* ========================================================
       🔐 TENANT SCOPE (GLOBAL CATEGORY FIX)
    ======================================================== */
    if (!isSuperAdmin(req.user)) {
      where.organization_id = req.user.organization_id;

      // 🔥 IMPORTANT: categories are GLOBAL
      where.facility_id = null;
    } else {
      if (req.query.organization_id) {
        where.organization_id = req.query.organization_id;
      }

      if (req.query.facility_id) {
        where.facility_id = req.query.facility_id;
      }
    }

    const category = await MasterItemCategory.findOne({
      where,
      include: CATEGORY_INCLUDES,
    });

    if (!category) {
      return error(res, "❌ Category not found", null, 404);
    }

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "view",
      entityId: id,
      entity: category,
    });

    return success(res, "✅ Category loaded", category);

  } catch (err) {
    debug.error("view → FAILED", err);
    return error(res, "❌ Failed to load category", err);
  }
};

/* ============================================================
   📌 GET CATEGORIES LITE (FINAL — GLOBAL ONLY)
   🔹 Active only
   🔹 Org-scoped (no system null org)
   🔹 Global categories ONLY (facility_id = NULL)
   🔹 No limit (dropdown safe)
============================================================ */
export const getAllCategoriesLite = async (req, res) => {
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module: MODULE_KEY,
      action: "read",
      res,
    });
    if (!allowed) return;

    const { q } = req.query;

    /* ========================================================
       🧱 BASE WHERE
    ======================================================== */
    const where = {
      status: MASTER_ITEM_CATEGORY_STATUS.ACTIVE,
      organization_id: req.user.organization_id, // 🔥 required
      facility_id: null, // 🔥 GLOBAL ONLY
      [Op.and]: [],
    };

    /* ========================================================
       🔍 SEARCH
    ======================================================== */
    if (q) {
      where[Op.and].push({
        [Op.or]: [
          { name: { [Op.iLike]: `%${q}%` } },
          { code: { [Op.iLike]: `%${q}%` } },
        ],
      });
    }

    /* ========================================================
       📦 QUERY
    ======================================================== */
    const categories = await MasterItemCategory.findAll({
      where,
      attributes: ["id", "name", "code", "order_type"],
      order: [["name", "ASC"]],
      // 🚫 NO LIMIT → dropdown must show all
    });

    const records = categories.map((c) => ({
      id: c.id,
      name: c.name,
      code: c.code || "",
      order_type: c.order_type, // 🔥 ADD THIS
    }));

    /* ========================================================
       🧾 AUDIT
    ======================================================== */
    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "list_lite",
      details: {
        count: records.length,
        q: q || null,
      },
    });

    return success(res, "✅ Categories loaded (lite)", {
      records,
    });

  } catch (err) {
    debug.error("list_lite → FAILED", err);
    return error(res, "❌ Failed to load categories (lite)", err);
  }
};
/* ============================================================
   📌 TOGGLE CATEGORY STATUS (FINAL — GLOBAL ONLY)
============================================================ */
export const toggleCategoryStatus = async (req, res) => {
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module: MODULE_KEY,
      action: "update",
      res,
    });
    if (!allowed) return;

    const { id } = req.params;
    const where = { id };

    /* ========================================================
       🔐 TENANT (GLOBAL CATEGORY)
    ======================================================== */
    if (!isSuperAdmin(req.user)) {
      where.organization_id = req.user.organization_id;
      where.facility_id = null; // 🔥 GLOBAL ONLY
    } else {
      if (req.query.organization_id)
        where.organization_id = req.query.organization_id;

      if (req.query.facility_id)
        where.facility_id = req.query.facility_id;
    }

    const category = await MasterItemCategory.findOne({ where });
    if (!category) return error(res, "❌ Category not found", null, 404);

    const ACTIVE = MASTER_ITEM_CATEGORY_STATUS.ACTIVE;
    const INACTIVE = MASTER_ITEM_CATEGORY_STATUS.INACTIVE;
    const newStatus = category.status === ACTIVE ? INACTIVE : ACTIVE;

    await category.update({
      status: newStatus,
      updated_by_id: req.user?.id || null,
    });

    const full = await MasterItemCategory.findOne({
      where: { id },
      include: CATEGORY_INCLUDES,
    });

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "toggle_status",
      entityId: id,
      entity: full,
      details: { from: category.status, to: newStatus },
    });

    return success(
      res,
      `✅ Category status set to ${newStatus}`,
      full
    );

  } catch (err) {
    debug.error("toggle_status → FAILED", err);
    return error(res, "❌ Failed to toggle category status", err);
  }
};

/* ============================================================
   📌 DELETE CATEGORY (FINAL — GLOBAL ONLY)
============================================================ */
export const deleteCategory = async (req, res) => {
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
    const where = { id };

    /* ========================================================
       🔐 TENANT (GLOBAL CATEGORY)
    ======================================================== */
    if (!isSuperAdmin(req.user)) {
      where.organization_id = req.user.organization_id;
      where.facility_id = null; // 🔥 GLOBAL ONLY
    } else {
      if (req.query.organization_id)
        where.organization_id = req.query.organization_id;

      if (req.query.facility_id)
        where.facility_id = req.query.facility_id;
    }

    const category = await MasterItemCategory.findOne({
      where,
      transaction: t,
    });

    if (!category) {
      await t.rollback();
      return error(res, "❌ Category not found", null, 404);
    }

    await category.update(
      { deleted_by_id: req.user?.id || null },
      { transaction: t }
    );

    await category.destroy({ transaction: t });
    await t.commit();

    const full = await MasterItemCategory.findOne({
      where: { id },
      include: CATEGORY_INCLUDES,
      paranoid: false,
    });

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "delete",
      entityId: id,
      entity: full,
    });

    return success(res, "✅ Category deleted", full);

  } catch (err) {
    await t.rollback();
    debug.error("delete → FAILED", err);
    return error(res, "❌ Failed to delete category", err);
  }
};