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
   📋 ROLE-BASED JOI SCHEMA (MASTER PARITY)
============================================================ */
function buildCategorySchema(userRole, mode = "create") {
  const base = {
    name: Joi.string().max(100).required(),
    code: Joi.string().max(50).allow("", null),
    description: Joi.string().allow("", null),
  };

  if (mode === "update") {
    base.status = Joi.string()
      .valid(...Object.values(MASTER_ITEM_CATEGORY_STATUS))
      .optional();
    Object.keys(base).forEach((k) => (base[k] = base[k].optional()));
  }

  if (userRole === "superadmin") {
    base.organization_id = Joi.string().uuid().optional();
    base.facility_id = Joi.string().uuid().allow(null).optional();
  }

  if (["organization_admin", "org_admin", "org_owner"].includes(userRole)) {
    base.facility_id = Joi.string().uuid().allow(null).optional();
  }

  return Joi.object(base);
}

/* ============================================================
   📌 CREATE CATEGORY (MASTER PARITY — ROLE-BASED FIX)
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
       🧭 ROLE-BASED SCOPE RESOLUTION (FIXED)
    ======================================================== */
    let orgId = null;
    let facilityId = null;

    if (isSuperAdmin(req.user)) {
      orgId = "organization_id" in value ? value.organization_id : null;
      facilityId = "facility_id" in value ? value.facility_id : null;
    } else if (isOrgLevelUser(req.user)) {
      orgId = req.user.organization_id;
      facilityId = "facility_id" in value ? value.facility_id : null;
    } else if (isFacilityHead(req.user)) {
      orgId = req.user.organization_id;
      facilityId = req.user.facility_id;
    } else {
      orgId = req.user.organization_id;
      facilityId = req.user.facility_id ?? null;
    }

    /* ========================================================
       🚫 FACILITY RULE
    ======================================================== */
    if (!facilityId && !isOrgLevelUser(req.user) && !isSuperAdmin(req.user)) {
      await t.rollback();
      return error(
        res,
        "Facility is required when creating a category",
        null,
        400
      );
    }

    /* ========================================================
       🚫 UNIQUENESS CHECK
    ======================================================== */
    const exists = await MasterItemCategory.findOne({
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
        "Category with this name already exists in this scope",
        null,
        400
      );
    }

    /* ========================================================
       💾 CREATE
    ======================================================== */
    const created = await MasterItemCategory.create(
      {
        ...value,
        organization_id: orgId,
        facility_id: facilityId,
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

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "create",
      entityId: created.id,
      entity: full,
      details: value,
    });

    return success(res, "✅ Category created", full);
  } catch (err) {
    await t.rollback();
    return error(res, "❌ Failed to create category", err);
  }
};

/* ============================================================
   📌 UPDATE CATEGORY (MASTER PARITY — ROLE-BASED FIX)
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

    /* ========================================================
       🧭 ROLE-BASED SCOPE RESOLUTION (FIXED)
    ======================================================== */
    let orgId = null;
    let facilityId = null;

    if (isSuperAdmin(req.user)) {
      orgId = "organization_id" in value ? value.organization_id : null;
      facilityId = "facility_id" in value ? value.facility_id : null;
    } else if (isOrgLevelUser(req.user)) {
      orgId = req.user.organization_id;
      facilityId = "facility_id" in value ? value.facility_id : null;
    } else if (isFacilityHead(req.user)) {
      orgId = req.user.organization_id;
      facilityId = req.user.facility_id;
    } else {
      orgId = req.user.organization_id;
      facilityId = req.user.facility_id ?? null;
    }

    const record = await MasterItemCategory.findOne({
      where: { id: req.params.id, organization_id: orgId },
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
          facility_id: facilityId,
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
          "Category with this name already exists in this scope",
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
        facility_id: facilityId,
        updated_by_id: req.user?.id || null,
      },
      { transaction: t }
    );

    await t.commit();

    const full = await MasterItemCategory.findOne({
      where: { id: record.id },
      include: CATEGORY_INCLUDES,
    });

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "update",
      entityId: record.id,
      entity: full,
      details: value,
    });

    return success(res, "✅ Category updated", full);
  } catch (err) {
    await t.rollback();
    return error(res, "❌ Failed to update category", err);
  }
};

/* ============================================================
   📌 GET ALL CATEGORIES (MASTER PARITY)
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

    /* ========================================================
       🧹 STRIP UI-ONLY FILTERS
    ======================================================== */
    delete options.filters?.dateRange;
    delete options.filters?.light;

    /* ========================================================
       🧱 WHERE ROOT
    ======================================================== */
    options.where = { [Op.and]: [] };

    /* ========================================================
       📅 DATE RANGE (MASTER)
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
       🔐 TENANT SCOPE
    ======================================================== */
    if (!isSuperAdmin(req.user)) {
      options.where[Op.and].push({
        organization_id: req.user.organization_id,
      });

      if (!isOrgLevelUser(req.user)) {
        options.where[Op.and].push({
          [Op.or]: [
            { facility_id: null },
            { facility_id: req.user.facility_id },
          ],
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
       🔍 GLOBAL SEARCH
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
       📌 STATUS FILTER
    ======================================================== */
    if (
      req.query.status &&
      Object.values(MASTER_ITEM_CATEGORY_STATUS).includes(
        req.query.status
      )
    ) {
      options.where[Op.and].push({
        status: req.query.status,
      });
    }

    const { count, rows } =
      await MasterItemCategory.findAndCountAll({
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
   📌 GET CATEGORY BY ID (MASTER PARITY)
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
       🔐 TENANT SCOPE (MASTER)
    ======================================================== */
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
   📌 GET CATEGORIES LITE (MASTER PARITY — FIXED)
   - Active only
   - Org + System visibility (for Org Admin)
   - Facility-safe for lower roles
   - No hard limit (dropdown-safe)
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
      [Op.and]: [],
    };

    /* ========================================================
       🔐 TENANT SCOPE (FIXED)
    ======================================================== */
    if (!isSuperAdmin(req.user)) {
      // ✅ Org + System categories
      where[Op.and].push({
        [Op.or]: [
          { organization_id: req.user.organization_id },
          { organization_id: null }, // 🔥 system categories
        ],
      });

      // ✅ Only restrict facility for NON-org-level users
      if (!isOrgLevelUser(req.user)) {
        where[Op.and].push({
          [Op.or]: [
            { facility_id: null },
            { facility_id: req.user.facility_id },
          ],
        });
      }
    } else {
      // Super admin filters (optional)
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
      attributes: ["id", "name", "code"],
      order: [["name", "ASC"]],
      // 🚫 NO LIMIT → dropdown must show all
    });

    const records = categories.map((c) => ({
      id: c.id,
      name: c.name,
      code: c.code || "",
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
   📌 TOGGLE CATEGORY STATUS (MASTER PARITY)
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
   📌 DELETE CATEGORY (MASTER PARITY)
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
