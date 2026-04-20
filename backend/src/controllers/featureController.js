// 📁 controllers/featureController.js
import Joi from "joi";
import { Op, QueryTypes } from "sequelize";
import {
  sequelize,
  Organization,
  FeatureModule,
  FeatureAccess,
  Role,
  User,
  Facility,
} from "../models/index.js";
import { upsertRoleAccess } from "../services/roleAccessService.js";
import { success, error } from "../utils/response.js";
import { buildQueryOptions } from "../utils/queryHelper.js";
import {
  FEATURE_MODULE_STATUS,
  FEATURE_ACCESS_STATUS,
} from "../constants/enums.js";
import { authzService } from "../services/authzService.js";
import { auditService } from "../services/auditService.js";
import { makeModuleLogger } from "../utils/debugLogger.js";
import { syncOrgAdminsForModule } from "../services/roleProvisioningService.js";
import { isSuperAdmin } from "../utils/role-utils.js";
import { normalizeDateRangeLocal } from "../utils/date-utils.js";

/* ============================================================
   🧩 MODULE KEYS (SINGLE SOURCE OF TRUTH)
============================================================ */
const MODULE_KEY_FEATURE = "feature_modules";
const MODULE_KEY_FEATURE_ACCESS = "feature_access";

/* ============================================================
   🔧 LOCAL DEBUG OVERRIDE (FEATURE CONTROLLER)
============================================================ */
const DEBUG_OVERRIDE = true; // 👈 turn OFF in prod
const debug = makeModuleLogger("featureController", DEBUG_OVERRIDE);

/* ============================================================
   🔹 ENUM SHORTCUTS
============================================================ */
/* ============================================================
   🔐 ENUM MAPS (ORDER-SAFE)
============================================================ */
const MODULE_STATUS = Object.fromEntries(
  Object.values(FEATURE_MODULE_STATUS).map(v => [v.toUpperCase(), v])
);
const ACCESS_STATUS = Object.fromEntries(
  Object.values(FEATURE_ACCESS_STATUS).map(v => [v.toUpperCase(), v])
);
/* ============================================================
   🔐 ENUM ALIASES (SAFE, EXPLICIT)
============================================================ */
const ACTIVE = MODULE_STATUS.ACTIVE;
const INACTIVE = MODULE_STATUS.INACTIVE;

const ACCESS_ACTIVE = ACCESS_STATUS.ACTIVE;
const ACCESS_INACTIVE = ACCESS_STATUS.INACTIVE;

/* ============================================================
   🔗 SHARED INCLUDES
============================================================ */
const FEATURE_INCLUDES = [
  {
    model: Role,
    as: "roles",
    through: { attributes: [] },
    attributes: ["id", "name"],
    required: false,
  },
  {
    model: FeatureModule,
    as: "parent",
    attributes: ["id", "name"],
    required: false,
  },
  {
    model: FeatureModule,
    as: "children",
    attributes: ["id", "name", "status", "enabled"],
    required: false,
  },
  {
    model: User,
    as: "createdBy",
    attributes: ["id", "first_name", "last_name"],
    required: false,
  },
  {
    model: User,
    as: "updatedBy",
    attributes: ["id", "first_name", "last_name"],
    required: false,
  },
  {
    model: User,
    as: "deletedBy",
    attributes: ["id", "first_name", "last_name"],
    required: false,
  },
];

/* ============================================================
   📋 FEATURE MODULE SCHEMA
============================================================ */
function buildFeatureSchema(mode = "create") {
  const base = {
    name: Joi.string().max(255).required(),
    key: Joi.string().max(120).required(),
    icon: Joi.string().allow("", null),
    category: Joi.string().max(120).allow("", null),
    description: Joi.string().allow("", null),
    tags: Joi.array().items(Joi.string()).default([]),

    visibility: Joi.string()
      .valid("public", "private", "hidden")
      .default("public"),

    tenant_scope: Joi.string()
      .valid("global", "org", "facility")
      .default("org"),

    enabled: Joi.boolean().default(true),

    status: Joi.string()
      .valid(...Object.values(FEATURE_MODULE_STATUS))
      .default(ACTIVE),

    order_index: Joi.number().integer().min(0).default(0),

    route: Joi.string()
      .regex(/^[a-zA-Z0-9_\-/\.]*$/)
      .allow("", null),

    parent_id: Joi.string().uuid().allow(null).default(null),

    show_on_dashboard: Joi.boolean().default(false),

    dashboard_type: Joi.string()
      .valid(
        "kpi",
        "chart",
        "queue",
        "global_kpi",
        "global_chart",
        "none"
      )
      .default("none"),

    dashboard_order: Joi.number().integer().min(0).default(0),
  };

  if (mode === "update") {
    Object.keys(base).forEach(k => {
      base[k] = base[k].optional();
    });
  }

  return Joi.object(base);
}

/* ============================================================
   📌 GET ALL FEATURE MODULES
   (WITH SUMMARY + SORTING + FIXED FILTERS)
============================================================ */
export const getAllFeatureModules = async (req, res) => {
  try {
    /* ========================================================
       🔐 AUTHORIZATION
    ======================================================== */
    const allowed = await authzService.checkPermission({
      user: req.user,
      module: MODULE_KEY_FEATURE,
      action: "read",
      res,
    });
    if (!allowed) return;

    debug.log("list → query", req.query);

    /* ========================================================
       ⚙️ BASE QUERY OPTIONS (SAFE FIELDS ONLY)
    ======================================================== */
    const options = buildQueryOptions(req, {
      defaultSort: ["order_index", "ASC"],
      fields: [
        "order_index",
        "name",
        "key",
        "category",
        "status",
        "enabled",
        "tenant_scope",
        "visibility",
        "created_at",
        "updated_at",
        "dashboard_order",
      ],
    });

    /* ========================================================
       🧹 STRIP UI-ONLY FILTERS
       ❌ Sequelize must NEVER see these as columns
    ======================================================== */
    const { dateRange, visibility } = req.query;

    if (options.where?.dateRange) {
      delete options.where.dateRange;
    }

    /* ========================================================
       🔎 GLOBAL SEARCH (TEXT ONLY)
    ======================================================== */
    if (options.search) {
      options.where = {
        ...(options.where || {}),
        [Op.or]: [
          { name: { [Op.iLike]: `%${options.search}%` } },
          { key: { [Op.iLike]: `%${options.search}%` } },
          { category: { [Op.iLike]: `%${options.search}%` } },
        ],
      };
    }

    /* ========================================================
      📅 DATE RANGE FILTER (LOCAL – FIXED)
    ======================================================== */
    if (dateRange) {
      const range = normalizeDateRangeLocal(dateRange);

      if (range) {
        options.where.created_at = {
          [Op.between]: [range.start, range.end],
        };
      }
    }

    /* ========================================================
       🏢 TENANT SCOPE (NON-SYSTEM USERS)
    ======================================================== */
    if (!isSuperAdmin(req.user)) {
      options.where = {
        ...(options.where || {}),
        tenant_scope: { [Op.in]: ["org", "facility"] },
      };
    }

    /* ========================================================
       👁️ VISIBILITY FILTER (USER-FIRST)
    ======================================================== */
    if (visibility) {
      options.where = {
        ...(options.where || {}),
        visibility,
      };
    } else {
      options.where = {
        ...(options.where || {}),
        visibility: { [Op.ne]: "hidden" },
      };
    }

    /* ========================================================
       📦 MAIN QUERY (LIST + PAGINATION)
    ======================================================== */
    const { count, rows } = await FeatureModule.findAndCountAll({
      where: options.where,
      include: FEATURE_INCLUDES,
      order: options.order,
      offset: options.offset,
      limit: options.limit,
      distinct: true,
    });

    /* ============================================================
      📊 SUMMARY (FILTER-AWARE, BASE-TABLE SAFE)
    ============================================================ */

    /**
     * IMPORTANT:
     * - Mirrors LIST filters
     * - NO search aliases
     * - NO pagination
     */
    const summaryWhere = {};

    /* ---------- TENANT SCOPE ---------- */
    if (!isSuperAdmin(req.user)) {
      summaryWhere.tenant_scope = { [Op.in]: ["org", "facility"] };
    }

    /* ---------- VISIBILITY ---------- */
    if (visibility) {
      summaryWhere.visibility = visibility;
    } else {
      summaryWhere.visibility = { [Op.ne]: "hidden" };
    }

    /* ---------- DATE RANGE ---------- */
    if (dateRange) {
      const range = normalizeDateRangeLocal(dateRange);
      if (range) {
        summaryWhere.created_at = {
          [Op.between]: [range.start, range.end],
        };
      }
    }

    /* ---------- TOTAL ---------- */
    const total = await FeatureModule.count({
      where: summaryWhere,
    });

    /* ---------- STATUS SUMMARY ---------- */
    const statusRows = await FeatureModule.findAll({
      attributes: [
        "status",
        [sequelize.fn("COUNT", sequelize.col("id")), "count"],
      ],
      where: summaryWhere,
      group: ["status"],
      raw: true,
    });

    const statusMap = Object.fromEntries(
      statusRows.map(r => [r.status, Number(r.count)])
    );

    /* ---------- TENANT SCOPE SUMMARY ---------- */
    const scopeRows = await FeatureModule.findAll({
      attributes: [
        "tenant_scope",
        [sequelize.fn("COUNT", sequelize.col("id")), "count"],
      ],
      where: summaryWhere,
      group: ["tenant_scope"],
      raw: true,
    });

    const scopeMap = Object.fromEntries(
      scopeRows.map(r => [r.tenant_scope, Number(r.count)])
    );

    /* ---------- FINAL SUMMARY ---------- */
    const summary = {
      total,
      status: {
        active: statusMap[MODULE_STATUS.ACTIVE] || 0,
        inactive: statusMap[MODULE_STATUS.INACTIVE] || 0,
      },
      tenant_scope: {
        global: scopeMap.global || 0,
        org: scopeMap.org || 0,
        facility: scopeMap.facility || 0,
      },
    };

    /* ========================================================
       🧾 AUDIT
    ======================================================== */
    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY_FEATURE,
      action: "list",
      details: {
        query: req.query,
        returned: count,
      },
    });

    /* ========================================================
       ✅ RESPONSE
    ======================================================== */
    return success(res, "✅ Feature modules loaded", {
      records: rows,
      pagination: {
        total: count,
        page: options.pagination.page,
        pageCount: Math.ceil(count / options.pagination.limit),
      },
      summary,
    });
  } catch (err) {
    debug.error("list → FAILED", err);
    return error(res, "❌ Failed to load feature modules", err);
  }
};


/* ============================================================
   📌 GET FEATURE MODULE BY ID
============================================================ */
export const getFeatureModuleById = async (req, res) => {
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module: MODULE_KEY_FEATURE,
      action: "read",
      res,
    });
    if (!allowed) return;

    const { id } = req.params;
    const where = { id };

    if (!isSuperAdmin(req.user)) {
      where.tenant_scope = { [Op.in]: ["org", "facility"] };
      where.visibility = { [Op.ne]: "hidden" };
    }

    const module = await FeatureModule.findOne({
      where,
      include: FEATURE_INCLUDES,
    });

    if (!module) {
      return error(res, "❌ Feature module not found", null, 404);
    }

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY_FEATURE,
      action: "view",
      entityId: id,
      entity: module,
    });

    return success(res, "✅ Feature module loaded", {
      record: module,
    });
  } catch (err) {
    debug.error("getById → FAILED", err);
    return error(res, "❌ Failed to load feature module", err);
  }
};

/* ============================================================
   📌 GET AVAILABLE MODULES (role / facility scoped tree)
============================================================ */
export const getAvailableModules = async (req, res) => {
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module: MODULE_KEY_FEATURE,
      action: "read",
      res,
    });
    if (!allowed) return;

    debug.log("available-modules → user", {
      userId: req.user.id,
      roles: (req.user.roles || []).map(r => r.name),
      org: req.user.organization_id,
      facilities: req.user.facility_ids,
    });

    const roleIds = (req.user.roles || []).map(r => r.id);
    let orgId = req.user.organization_id;
    const facilityIds = Array.isArray(req.user.facility_ids)
      ? req.user.facility_ids
      : [];

    let modules = [];

    /* ================= SUPER ADMIN ================= */
    if (isSuperAdmin(req.user)) {
      const rawModules = await FeatureModule.findAll({
        where: {
          enabled: true,
          status: ACTIVE,
          visibility: { [Op.ne]: "hidden" },
        },
        order: [
          ["order_index", "ASC"],
          ["name", "ASC"],
        ],
        include: [
          { model: Role, as: "roles", through: { attributes: [] } },
        ],
      });

      modules = rawModules.map(m => m.get({ plain: true }));
    } 
    /* ================= NON-SUPER ADMIN ================= */
    else {
      /* -------- Resolve org from facility if needed -------- */
      if (!orgId && facilityIds.length) {
        const f = await Facility.findOne({
          where: { id: { [Op.in]: facilityIds } },
          attributes: ["organization_id"],
        });
        if (f) orgId = f.organization_id;
      }

      const accesses = await FeatureAccess.findAll({
        where: {
          role_id: { [Op.in]: roleIds },
          organization_id: orgId,
          status: ACCESS_ACTIVE,
          [Op.or]: [
            ...(facilityIds.length
              ? [{ facility_id: { [Op.in]: facilityIds } }]
              : []),
            { facility_id: null },
          ],
        },
        include: [
          {
            model: FeatureModule,
            as: "module",
            required: true,
            where: {
              enabled: true,
              status: ACTIVE,
              visibility: { [Op.ne]: "hidden" },
              tenant_scope: { [Op.in]: ["org", "facility"] },
            },
          },
        ],
      });

      const map = new Map();
      for (const a of accesses) {
        if (!map.has(a.module.id)) {
          map.set(a.module.id, {
            ...a.module.toJSON(),
            children: [],
          });
        }
      }
      modules = Array.from(map.values());
    }

    /* ================= TREE BUILD ================= */
    const byId = {};
    const roots = [];

    modules.forEach(m => {
      byId[m.id] = { ...m, children: [] };
    });

    modules.forEach(m => {
      if (m.parent_id && byId[m.parent_id]) {
        byId[m.parent_id].children.push(byId[m.id]);
      } else {
        roots.push(byId[m.id]);
      }
    });

    roots.sort((a, b) => (a.order_index || 0) - (b.order_index || 0));

    /* ================= ROUTE NORMALIZER ================= */
    const normalizeRoute = key =>
      "/" + key.replace(/[A-Z]/g, m => "-" + m.toLowerCase());

    /* ================= COLLECT ================= */
    const collect = (list, keys = [], routes = []) => {
      for (const m of list) {
        keys.push(m.key);
        routes.push(m.route || normalizeRoute(m.key));
        if (m.children?.length) {
          collect(m.children, keys, routes);
        }
      }
      return { keys, routes };
    };

    const { keys: moduleKeys, routes } = collect(roots);

    /* ================= AUDIT ================= */
    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY_FEATURE,
      action: "available-modules",
      details: { returned: moduleKeys.length },
    });

    /* ================= RESPONSE ================= */
    return success(res, "✅ Available modules loaded", {
      moduleKeys,
      routes,
      records: roots,
    });
  } catch (err) {
    debug.error("available-modules → FAILED", err);
    return error(res, "❌ Failed to load available modules", err);
  }
};

/* ============================================================
   📌 GET LITE FEATURE MODULES
============================================================ */
export const getLiteFeatureModules = async (req, res) => {
  try {
    const { q } = req.query;

    const where = {
      visibility: { [Op.ne]: "hidden" },
    };

    if (q) {
      where[Op.or] = [
        { name: { [Op.iLike]: `%${q}%` } },
        { key: { [Op.iLike]: `%${q}%` } },
        { category: { [Op.iLike]: `%${q}%` } },
      ];
    }

    if (!isSuperAdmin(req.user)) {
      where.tenant_scope = { [Op.in]: ["org", "facility"] };
    }

    const modules = await FeatureModule.findAll({
      where,
      attributes: ["id", "name", "key", "category"],
      order: [
        ["order_index", "ASC"],
        ["name", "ASC"],
      ],
      limit: 100,
    });

    return success(res, "✅ Lite module list loaded", {
      records: modules,
    });
  } catch (err) {
    debug.error("lite-modules → FAILED", err);
    return error(res, "❌ Failed to load lite modules", err);
  }
};


/* ============================================================
   📌 GET LITE FEATURE MODULE CATEGORIES
============================================================ */
export const getLiteFeatureModuleCategories = async (req, res) => {
  try {
    const { q } = req.query;

    let sql = `
      SELECT DISTINCT category
      FROM feature_modules
      WHERE
        category IS NOT NULL
        AND category <> ''
        AND visibility <> 'hidden'
    `;

    const replacements = {};

    if (!isSuperAdmin(req.user)) {
      sql += ` AND tenant_scope IN ('org','facility')`;
    }

    if (q) {
      sql += ` AND category ILIKE :q`;
      replacements.q = `%${q}%`;
    }

    sql += ` ORDER BY category ASC LIMIT 20`;

    const rows = await sequelize.query(sql, {
      replacements,
      type: QueryTypes.SELECT,
    });

    return success(res, "✅ Lite categories loaded", {
      records: rows.map(r => ({ category: r.category })),
    });
  } catch (err) {
    debug.error("lite-categories → FAILED", err);
    return error(res, "❌ Failed to load lite categories", err);
  }
};


/* ============================================================
   📌 GET LITE PARENT MODULES
============================================================ */
export const getLiteParentModules = async (req, res) => {
  try {
    const { q } = req.query;

    const where = {
      parent_id: null,
      visibility: { [Op.ne]: "hidden" },
    };

    if (!isSuperAdmin(req.user)) {
      where.tenant_scope = { [Op.in]: ["org", "facility"] };
    }

    if (q) {
      where[Op.or] = [
        { name: { [Op.iLike]: `%${q}%` } },
        { key: { [Op.iLike]: `%${q}%` } },
      ];
    }

    const parents = await FeatureModule.findAll({
      where,
      attributes: ["id", "name", "key"],
      order: [
        ["order_index", "ASC"],
        ["name", "ASC"],
      ],
      limit: 20,
    });

    return success(res, "✅ Lite parent modules loaded", {
      records: parents,
    });
  } catch (err) {
    debug.error("lite-parents → FAILED", err);
    return error(res, "❌ Failed to load lite parent modules", err);
  }
};


/* ============================================================
   📌 CREATE FEATURE MODULE
============================================================ */
export const createFeatureModule = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module: MODULE_KEY_FEATURE,
      action: "create",
      res,
    });
    if (!allowed) return;

    debug.log("create → incoming", req.body);

    const schema = buildFeatureSchema("create");
    const { error: validationError, value } = schema.validate(req.body, {
      stripUnknown: true,
    });

    if (validationError) {
      debug.warn("create → validation failed", validationError);
      await t.rollback();
      return error(res, "Validation failed", validationError, 400);
    }

    /* ================= TENANT SCOPE GUARD ================= */
    if (!isSuperAdmin(req.user) && value.tenant_scope === "global") {
      await t.rollback();
      return error(
        res,
        "❌ Only super admins can create global modules",
        null,
        403
      );
    }

    /* ================= UNIQUE KEY CHECK ================= */
    const exists = await FeatureModule.findOne({
      where: { key: value.key },
      paranoid: false,
      transaction: t,
    });

    if (exists) {
      await t.rollback();
      return error(res, "❌ Feature module key already exists", null, 400);
    }

    /* ================= PARENT VALIDATION ================= */
    if (value.parent_id) {
      const parent = await FeatureModule.findOne({
        where: {
          id: value.parent_id,
          visibility: { [Op.ne]: "hidden" },
        },
        transaction: t,
      });

      if (!parent) {
        await t.rollback();
        return error(res, "❌ Parent module not found or hidden", null, 400);
      }

      if (!isSuperAdmin(req.user) && parent.tenant_scope === "global") {
        await t.rollback();
        return error(
          res,
          "❌ Cannot attach to a global parent module",
          null,
          403
        );
      }
    }

    /* ================= CREATE ================= */
    const created = await FeatureModule.create(
      {
        ...value,
        created_by_id: req.user?.id || null,
      },
      { transaction: t }
    );

    await t.commit();

    /* ================= AUTO-PROVISION (NON-BLOCKING) ================= */
    try {
      await syncOrgAdminsForModule(created.key);
      debug.log("auto-provision → success", created.key);
    } catch (provErr) {
      debug.warn("auto-provision → warning", provErr);
    }

    const full = await FeatureModule.findOne({
      where: { id: created.id },
      include: FEATURE_INCLUDES,
    });

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY_FEATURE,
      action: "create",
      entityId: created.id,
      entity: full,
      details: value,
    });

    return success(res, "✅ Feature module created", {
      record: full,
    });
  } catch (err) {
    debug.error("create → FAILED", err);
    await t.rollback();
    return error(res, "❌ Failed to create feature module", err);
  }
};

/* ============================================================
   📌 UPDATE FEATURE MODULE
============================================================ */
export const updateFeatureModule = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module: MODULE_KEY_FEATURE,
      action: "update",
      res,
    });
    if (!allowed) return;

    const { id } = req.params;

    debug.log("update → incoming", { id, body: req.body });

    const schema = buildFeatureSchema("update");
    const { error: validationError, value } = schema.validate(req.body, {
      stripUnknown: true,
    });

    if (validationError) {
      await t.rollback();
      return error(res, "Validation failed", validationError, 400);
    }

    const module = await FeatureModule.findOne({
      where: { id },
      transaction: t,
    });

    if (!module) {
      await t.rollback();
      return error(res, "❌ Feature module not found", null, 404);
    }

    /* ================= TENANT SCOPE CHANGE GUARD ================= */
    if (value.tenant_scope === "global" && !isSuperAdmin(req.user)) {
      await t.rollback();
      return error(
        res,
        "❌ Only super admins can assign global tenant scope",
        null,
        403
      );
    }

    /* ================= UNIQUE KEY CHECK ================= */
    if (value.key) {
      const exists = await FeatureModule.findOne({
        where: { key: value.key, id: { [Op.ne]: id } },
        paranoid: false,
        transaction: t,
      });

      if (exists) {
        await t.rollback();
        return error(res, "❌ Feature module key already in use", null, 400);
      }
    }

    /* ================= PARENT VALIDATION ================= */
    if (value.parent_id) {
      if (value.parent_id === id) {
        await t.rollback();
        return error(res, "❌ Module cannot be its own parent", null, 400);
      }

      const parent = await FeatureModule.findOne({
        where: {
          id: value.parent_id,
          visibility: { [Op.ne]: "hidden" },
        },
        transaction: t,
      });

      if (!parent) {
        await t.rollback();
        return error(res, "❌ Parent module not found or hidden", null, 400);
      }

      if (!isSuperAdmin(req.user) && parent.tenant_scope === "global") {
        await t.rollback();
        return error(
          res,
          "❌ Cannot attach to a global parent module",
          null,
          403
        );
      }
    }

    /* ================= UPDATE ================= */
    await module.update(
      {
        ...value,
        updated_by_id: req.user?.id || null,
      },
      { transaction: t }
    );

    await t.commit();

    const full = await FeatureModule.findOne({
      where: { id },
      include: FEATURE_INCLUDES,
    });

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY_FEATURE,
      action: "update",
      entityId: id,
      entity: full,
      details: value,
    });

    return success(res, "✅ Feature module updated", { record: full });
  } catch (err) {
    await t.rollback();
    debug.error("update → FAILED", err);
    return error(res, "❌ Failed to update feature module", err);
  }
};


/* ============================================================
   📌 TOGGLE FEATURE MODULE STATUS
============================================================ */
export const toggleFeatureModuleStatus = async (req, res) => {
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module: MODULE_KEY_FEATURE,
      action: "update",
      res,
    });
    if (!allowed) return;

    const { id } = req.params;

    const module = await FeatureModule.findOne({
      where: { id },
      include: [
        { model: FeatureModule, as: "children", attributes: ["id", "status"] },
      ],
    });

    if (!module) {
      return error(res, "❌ Feature module not found", null, 404);
    }

    /* ================= TENANT GUARD ================= */
    if (!isSuperAdmin(req.user) && module.tenant_scope === "global") {
      return error(res, "❌ Cannot modify global module", null, 403);
    }

    /* ================= CHILD SAFETY ================= */
    const hasActiveChildren = (module.children || []).some(
      c => c.status === MODULE_STATUS.ACTIVE
    );


    if (hasActiveChildren && module.status === ACTIVE) {
      return error(
        res,
        "❌ Disable child modules first before disabling this module",
        null,
        400
      );
    }

    const newStatus =
      module.status === MODULE_STATUS.ACTIVE
        ? MODULE_STATUS.INACTIVE
        : MODULE_STATUS.ACTIVE;
    await module.update({
      status: newStatus,
      updated_by_id: req.user?.id || null,
    });

    const full = await FeatureModule.findOne({
      where: { id },
      include: FEATURE_INCLUDES,
    });

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY_FEATURE,
      action: "toggle-status",
      entityId: id,
      entity: full,
      details: { from: module.status, to: newStatus },
    });

    return success(
      res,
      `✅ Feature module status toggled to ${newStatus}`,
      { record: full }
    );
  } catch (err) {
    debug.error("toggle-status → FAILED", err);
    return error(res, "❌ Failed to toggle feature module status", err);
  }
};


/* ============================================================
   📌 TOGGLE FEATURE MODULE ENABLED
============================================================ */
export const toggleFeatureModuleEnabled = async (req, res) => {
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module: MODULE_KEY_FEATURE,
      action: "update",
      res,
    });
    if (!allowed) return;

    const { id } = req.params;

    const module = await FeatureModule.findOne({
      where: { id },
      include: [
        { model: FeatureModule, as: "children", attributes: ["id", "enabled"] },
      ],
    });

    if (!module) {
      return error(res, "❌ Feature module not found", null, 404);
    }

    /* ================= TENANT GUARD ================= */
    if (!isSuperAdmin(req.user) && module.tenant_scope === "global") {
      return error(res, "❌ Cannot modify global module", null, 403);
    }

    /* ================= CHILD SAFETY ================= */
    const hasEnabledChildren = (module.children || []).some(
      c => c.enabled
    );

    if (hasEnabledChildren && module.enabled) {
      return error(
        res,
        "❌ Disable child modules first before disabling this module",
        null,
        400
      );
    }

    const newEnabled = !module.enabled;

    await module.update({
      enabled: newEnabled,
      updated_by_id: req.user?.id || null,
    });

    const full = await FeatureModule.findOne({
      where: { id },
      include: FEATURE_INCLUDES,
    });

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY_FEATURE,
      action: "toggle-enabled",
      entityId: id,
      entity: full,
      details: { from: module.enabled, to: newEnabled },
    });

    return success(
      res,
      `✅ Feature module ${newEnabled ? "enabled" : "disabled"}`,
      { record: full }
    );
  } catch (err) {
    debug.error("toggle-enabled → FAILED", err);
    return error(res, "❌ Failed to toggle feature module enabled", err);
  }
};
/* ============================================================
   📌 DELETE FEATURE MODULE (Soft Delete + Audit)
============================================================ */
export const deleteFeatureModule = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module: MODULE_KEY_FEATURE,
      action: "delete",
      res,
    });
    if (!allowed) return;

    const { id } = req.params;

    debug.log("delete → attempt", { id });

    const module = await FeatureModule.findOne({
      where: { id },
      include: [
        { model: FeatureModule, as: "children", attributes: ["id"] },
      ],
      transaction: t,
    });

    if (!module) {
      await t.rollback();
      return error(res, "❌ Feature module not found", null, 404);
    }

    /* ================= TENANT GUARD ================= */
    if (!isSuperAdmin(req.user) && module.tenant_scope === "global") {
      await t.rollback();
      return error(res, "❌ Cannot delete global module", null, 403);
    }

    /* ================= CHILD SAFETY ================= */
    if ((module.children || []).length > 0) {
      await t.rollback();
      return error(
        res,
        "❌ Delete or reassign child modules first",
        null,
        400
      );
    }

    /* ================= SOFT DELETE ================= */
    await module.update(
      { deleted_by_id: req.user?.id || null },
      { transaction: t }
    );
    await module.destroy({ transaction: t });

    await t.commit();

    const full = await FeatureModule.findOne({
      where: { id },
      include: FEATURE_INCLUDES,
      paranoid: false,
    });

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY_FEATURE,
      action: "delete",
      entityId: id,
      entity: full,
    });

    return success(res, "✅ Feature module deleted", { record: full });
  } catch (err) {
    await t.rollback();
    debug.error("delete → FAILED", err);
    return error(res, "❌ Failed to delete feature module", err);
  }
};


/* ============================================================
   📌 FEATURE ACCESS – SHARED INCLUDES
============================================================ */
const FEATURE_ACCESS_INCLUDES = [
  {
    model: Organization,
    as: "organization",
    attributes: ["id", "name", "code"],
    required: false,
  },
  {
    model: Role,
    as: "role",
    attributes: ["id", "name"],
    required: false,
  },
  {
    model: FeatureModule,
    as: "module",
    attributes: ["id", "name", "key", "category", "visibility", "enabled"],
    required: false,
  },
  {
    model: Facility,
    as: "facility",
    attributes: ["id", "name", "code"],
    required: false,
  },
  {
    model: User,
    as: "createdBy",
    attributes: ["id", "first_name", "last_name"],
    required: false,
  },
  {
    model: User,
    as: "updatedBy",
    attributes: ["id", "first_name", "last_name"],
    required: false,
  },
  {
    model: User,
    as: "deletedBy",
    attributes: ["id", "first_name", "last_name"],
    required: false,
  },
];


/* ============================================================
   📋 FEATURE ACCESS SCHEMA (CONSULTATION-STYLE)
============================================================ */
function buildFeatureAccessSchema(mode = "create") {
  const base = {
    role_id: Joi.string().uuid().required().label("Role"),
    module_id: Joi.string().uuid().required().label("Module"),
    facility_id: Joi.string().uuid().allow(null).label("Facility"),
    status: Joi.string()
      .valid(...Object.values(FEATURE_ACCESS_STATUS))
      .default(ACCESS_ACTIVE),

    // ❌ NEVER required from UI
    organization_id: Joi.string().uuid().optional(),
  };

  if (mode === "update") {
    Object.keys(base).forEach(k => {
      base[k] = base[k].optional();
    });
  }

  return Joi.object(base);
}


/* ============================================================
   📌 CREATE FEATURE ACCESS
============================================================ */
export const createFeatureAccess = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module: MODULE_KEY_FEATURE_ACCESS,
      action: "create",
      res,
    });
    if (!allowed) return;

    const schema = buildFeatureAccessSchema("create");
    const { error: validationError, value } = schema.validate(req.body, {
      stripUnknown: true,
    });

    if (validationError) {
      await t.rollback();
      return error(res, "Validation failed", validationError, 400);
    }

    /* ================= TENANT RESOLUTION (LIKE CONSULTATION) ================= */

    let organization_id;
    let facility_id = value.facility_id ?? null;

    if (isSuperAdmin(req.user)) {
      // superadmin MAY pass org, but not required
      organization_id = value.organization_id;
      if (!organization_id) {
        await t.rollback();
        return error(res, "Organization is required for superadmin", null, 400);
      }
    } else {
      // 🔒 locked to session
      organization_id = req.user.organization_id;
    }

    if (!organization_id) {
      await t.rollback();
      return error(res, "Invalid organization context", null, 400);
    }

    /* ================= FACILITY CHECK ================= */
    if (facility_id) {
      const facility = await Facility.findOne({
        where: { id: facility_id, organization_id },
        transaction: t,
      });

      if (!facility) {
        await t.rollback();
        return error(res, "❌ Facility does not belong to organization", null, 400);
      }
    }

    /* ================= MODULE GUARDS ================= */
    const module = await FeatureModule.findByPk(value.module_id, { transaction: t });
    if (!module) {
      await t.rollback();
      return error(res, "❌ Module not found", null, 404);
    }

    if (module.visibility === "hidden") {
      await t.rollback();
      return error(res, "❌ Cannot assign hidden module", null, 400);
    }

    if (module.tenant_scope === "global" && !isSuperAdmin(req.user)) {
      await t.rollback();
      return error(res, "❌ Global modules are superadmin-only", null, 403);
    }

    /* ================= DUPLICATE GUARD ================= */
    const exists = await FeatureAccess.findOne({
      where: {
        organization_id,
        role_id: value.role_id,
        module_id: value.module_id,
        facility_id,
      },
      paranoid: false,
      transaction: t,
    });

    if (exists) {
      await t.rollback();
      return error(res, "❌ Access already exists", null, 409);
    }

    /* ================= CREATE ================= */
    const created = await FeatureAccess.create(
      {
        role_id: value.role_id,
        module_id: value.module_id,
        organization_id,
        facility_id,
        status: value.status,
        created_by_id: req.user?.id || null,
      },
      { transaction: t }
    );

    await t.commit();

    return success(res, "✅ Feature access granted", created);
  } catch (err) {
    await t.rollback();
    return error(res, "❌ Failed to create feature access", err);
  }
};

/* ============================================================
   📌 UPDATE FEATURE ACCESS
============================================================ */
export const updateFeatureAccess = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module: MODULE_KEY_FEATURE_ACCESS,
      action: "update",
      res,
    });
    if (!allowed) return;

    const { id } = req.params;

    debug.log("access-update → incoming", { id, body: req.body });

    const schema = buildFeatureAccessSchema("update");
    const { error: validationError, value } = schema.validate(req.body, {
      stripUnknown: true,
    });

    if (validationError) {
      await t.rollback();
      return error(res, "Validation failed", validationError, 400);
    }

    /* ================= ORG RESOLUTION ================= */
    const finalOrgId = isSuperAdmin(req.user)
      ? value.organization_id
      : req.user.organization_id;

    if (!finalOrgId) {
      await t.rollback();
      return error(
        res,
        "❌ Organization ID is invalid or not allowed for your role",
        null,
        400
      );
    }

    /* ================= FACILITY RESOLUTION ================= */
    const finalFacilityId = value.facility_id ?? null;

    if (finalFacilityId) {
      const facilityCheck = await Facility.findOne({
        where: { id: finalFacilityId, organization_id: finalOrgId },
      });

      if (!facilityCheck) {
        await t.rollback();
        return error(
          res,
          "❌ Facility does not belong to your organization",
          null,
          400
        );
      }
    }

    /* ================= LOAD ACCESS ================= */
    const access = await FeatureAccess.findOne({
      where: {
        id,
        organization_id: finalOrgId,
        facility_id: finalFacilityId,
      },
      transaction: t,
    });

    if (!access) {
      await t.rollback();
      return error(res, "❌ Feature access not found", null, 404);
    }

    /* ================= MODULE GUARD (ON CHANGE) ================= */
    if (value.module_id) {
      const module = await FeatureModule.findOne({
        where: { id: value.module_id },
        transaction: t,
      });

      if (!module) {
        await t.rollback();
        return error(res, "❌ Module not found", null, 404);
      }

      if (module.visibility === "hidden") {
        await t.rollback();
        return error(
          res,
          "❌ Cannot assign access to hidden modules",
          null,
          400
        );
      }

      if (module.tenant_scope === "global" && !isSuperAdmin(req.user)) {
        await t.rollback();
        return error(
          res,
          "❌ Cannot assign access to global modules",
          null,
          403
        );
      }
    }

    /* ================= DUPLICATE GUARD ================= */
    if (value.role_id || value.module_id) {
      const duplicate = await FeatureAccess.findOne({
        where: {
          organization_id: finalOrgId,
          role_id: value.role_id ?? access.role_id,
          module_id: value.module_id ?? access.module_id,
          facility_id: finalFacilityId,
          id: { [Op.ne]: id },
        },
        paranoid: false,
        transaction: t,
      });

      if (duplicate) {
        await t.rollback();
        return error(res, "❌ Duplicate access exists", null, 409);
      }
    }

    /* ================= UPDATE ================= */
    await access.update(
      {
        ...value,
        organization_id: finalOrgId,
        facility_id: finalFacilityId,
        updated_by_id: req.user?.id || null,
      },
      { transaction: t }
    );

    await t.commit();

    const full = await FeatureAccess.findOne({
      where: { id },
      include: FEATURE_ACCESS_INCLUDES,
    });

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY_FEATURE_ACCESS,
      action: "update",
      entityId: id,
      entity: full,
      details: value,
    });

    return success(res, "✅ Feature access updated", { record: full });
  } catch (err) {
    await t.rollback();
    debug.error("access-update → FAILED", err);
    return error(res, "❌ Failed to update feature access", err);
  }
};


/* ============================================================
   📌 REPLACE FEATURE ACCESS BY ROLE
============================================================ */
/* ============================================================
   📌 REPLACE FEATURE ACCESS BY ROLE (UPGRADED – FULL)
============================================================ */
export const replaceFeatureAccessByRole = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    /* ========================================================
       🔐 AUTHORIZATION
    ======================================================== */
    const allowed = await authzService.checkPermission({
      user: req.user,
      module: MODULE_KEY_FEATURE_ACCESS,
      action: "replace",
      res,
    });
    if (!allowed) return;

    debug.log("access-replace → incoming", req.body);

    /* ========================================================
       📋 VALIDATION
    ======================================================== */
    const schema = Joi.object({
      role_id: Joi.string().uuid().required(),
      module_ids: Joi.array().items(Joi.string().uuid()).min(1).required(),
      permission_keys: Joi.array().items(Joi.string()).default([]), // 🔥 NEW
      organization_id: Joi.string().uuid().optional(),
      facility_id: Joi.string().uuid().allow(null),
      status: Joi.string()
        .valid(...Object.values(FEATURE_ACCESS_STATUS))
        .default(ACCESS_ACTIVE),
    });

    const { error: validationError, value } = schema.validate({
      ...req.body,
      role_id: req.params.role_id,
    });

    if (validationError) {
      await t.rollback();
      return error(res, "Validation failed", validationError, 400);
    }

    /* ========================================================
       🏢 ORG RESOLUTION
    ======================================================== */
    const finalOrgId = isSuperAdmin(req.user)
      ? value.organization_id
      : req.user.organization_id;

    if (!finalOrgId) {
      await t.rollback();
      return error(
        res,
        "❌ Organization ID is invalid or not allowed for your role",
        null,
        400
      );
    }

    /* ========================================================
       🏥 FACILITY RESOLUTION
    ======================================================== */
    const finalFacilityId = value.facility_id ?? null;

    if (finalFacilityId) {
      const facilityCheck = await Facility.findOne({
        where: { id: finalFacilityId, organization_id: finalOrgId },
        transaction: t,
      });

      if (!facilityCheck) {
        await t.rollback();
        return error(
          res,
          "❌ Facility does not belong to your organization",
          null,
          400
        );
      }
    }

    /* ========================================================
       🔒 MODULE SAFETY CHECKS
    ======================================================== */
    const modules = await FeatureModule.findAll({
      where: { id: { [Op.in]: value.module_ids } },
      attributes: ["id", "key", "tenant_scope", "visibility"],
      transaction: t,
    });

    if (modules.length !== value.module_ids.length) {
      await t.rollback();
      return error(
        res,
        "❌ One or more modules do not exist",
        null,
        400
      );
    }

    for (const m of modules) {
      if (m.visibility === "hidden") {
        await t.rollback();
        return error(
          res,
          "❌ Cannot assign access to hidden modules",
          null,
          400
        );
      }

      if (m.tenant_scope === "global" && !isSuperAdmin(req.user)) {
        await t.rollback();
        return error(
          res,
          "❌ Cannot assign access to global modules",
          null,
          403
        );
      }
    }

    /* ========================================================
       🚀 MAIN LOGIC (SERVICE – FEATURE + PERMISSION UPSERT)
    ======================================================== */
    const result = await upsertRoleAccess({
      role_id: value.role_id,
      module_ids: value.module_ids,
      permission_keys: value.permission_keys || [],
      organization_id: finalOrgId,
      facility_id: finalFacilityId,
      user: req.user,
      transaction: t,
    });

    /* ========================================================
       ✅ COMMIT
    ======================================================== */
    await t.commit();

    /* ========================================================
       🧾 AUDIT
    ======================================================== */
    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY_FEATURE_ACCESS,
      action: "replace",
      details: {
        role_id: value.role_id,
        organization_id: finalOrgId,
        facility_id: finalFacilityId,
        modules: value.module_ids,
        ...result, // 🔥 includes permissions_added/removed
      },
    });

    /* ========================================================
       ✅ RESPONSE
    ======================================================== */
    return success(
      res,
      "✅ Role access updated successfully",
      { summary: result }
    );

  } catch (err) {
    await t.rollback();
    debug.error("access-replace → FAILED", err);
    return error(res, "❌ Failed to replace feature accesses", err);
  }
};


/* ============================================================
   📌 DELETE FEATURE ACCESS
============================================================ */
export const deleteFeatureAccess = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module: MODULE_KEY_FEATURE_ACCESS,
      action: "delete",
      res,
    });
    if (!allowed) return;

    const { id } = req.params;

    debug.log("access-delete → attempt", { id });

    const entry = await FeatureAccess.findOne({
      where: { id },
      transaction: t,
    });

    if (!entry) {
      await t.rollback();
      return error(res, "❌ Feature access not found", null, 404);
    }

    /* ================= ORG GUARD ================= */
    if (!isSuperAdmin(req.user)) {
      if (entry.organization_id !== req.user.organization_id) {
        await t.rollback();
        return error(res, "❌ Not authorized for this organization", null, 403);
      }
    }

    /* ================= SOFT DELETE ================= */
    await entry.update(
      { deleted_by_id: req.user?.id || null },
      { transaction: t }
    );
    await entry.destroy({ transaction: t });

    await t.commit();

    const full = await FeatureAccess.findOne({
      where: { id },
      include: FEATURE_ACCESS_INCLUDES,
      paranoid: false,
    });

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY_FEATURE_ACCESS,
      action: "delete",
      entityId: id,
      entity: full,
    });

    return success(res, "✅ Feature access deleted", { record: full });
  } catch (err) {
    await t.rollback();
    debug.error("access-delete → FAILED", err);
    return error(res, "❌ Failed to delete feature access", err);
  }
};
/* ============================================================
   📌 TOGGLE FEATURE ACCESS STATUS
============================================================ */
export const toggleFeatureAccessStatus = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module: MODULE_KEY_FEATURE_ACCESS,
      action: "update",
      res,
    });
    if (!allowed) return;

    const { id } = req.params;

    debug.log("access-toggle → attempt", { id });

    const access = await FeatureAccess.findOne({
      where: { id },
      transaction: t,
    });

    if (!access) {
      await t.rollback();
      return error(res, "❌ Feature access not found", null, 404);
    }

    /* ================= ORG GUARD ================= */
    if (!isSuperAdmin(req.user)) {
      if (access.organization_id !== req.user.organization_id) {
        await t.rollback();
        return error(res, "❌ Not authorized for this organization", null, 403);
      }
    }

    const newStatus =
      access.status === ACCESS_ACTIVE
        ? ACCESS_INACTIVE
        : ACCESS_ACTIVE;

    await access.update(
      {
        status: newStatus,
        updated_by_id: req.user?.id || null,
      },
      { transaction: t }
    );

    await t.commit();

    const full = await FeatureAccess.findOne({
      where: { id },
      include: FEATURE_ACCESS_INCLUDES,
    });

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY_FEATURE_ACCESS,
      action: "toggle-status",
      entityId: id,
      entity: full,
      details: { from: access.status, to: newStatus },
    });

    return success(
      res,
      `✅ Feature access status toggled to ${newStatus}`,
      { record: full }
    );
  } catch (err) {
    await t.rollback();
    debug.error("access-toggle → FAILED", err);
    return error(res, "❌ Failed to toggle feature access status", err);
  }
};


/* ============================================================
   📌 GET LITE FEATURE ACCESSES
============================================================ */
export const getLiteFeatureAccesses = async (req, res) => {
  try {
    const { q } = req.query;
    const where = {};

    if (!isSuperAdmin(req.user)) {
      where.organization_id = req.user.organization_id;
    }

    if (q) {
      where[Op.or] = [
        { "$role.name$": { [Op.iLike]: `%${q}%` } },
        { "$module.name$": { [Op.iLike]: `%${q}%` } },
        { "$facility.name$": { [Op.iLike]: `%${q}%` } },
      ];
    }

    const accesses = await FeatureAccess.findAll({
      where,
      include: [
        { model: Role, as: "role", attributes: ["id", "name"] },
        { model: FeatureModule, as: "module", attributes: ["id", "name", "key"] },
        { model: Facility, as: "facility", attributes: ["id", "name", "code"] },
      ],
      order: [["created_at", "DESC"]],
      limit: 20,
    });

    return success(res, "✅ Lite feature accesses loaded", {
      records: accesses,
    });
  } catch (err) {
    debug.error("lite-accesses → FAILED", err);
    return error(res, "❌ Failed to load lite feature accesses", err);
  }
};


/* ============================================================
   📌 GET ALL FEATURE ACCESSES
   (WITH DYNAMIC FILTERS + SEARCH + SUMMARY) – FINAL / PARITY
============================================================ */
export const getAllFeatureAccesses = async (req, res) => {
  try {
    /* ========================================================
       🔐 AUTHORIZATION
    ======================================================== */
    const allowed = await authzService.checkPermission({
      user: req.user,
      module: MODULE_KEY_FEATURE_ACCESS,
      action: "read",
      res,
    });
    if (!allowed) return;

    /* ========================================================
       ⚙️ BASE QUERY OPTIONS
    ======================================================== */
    const options = buildQueryOptions(req, {
      defaultSort: ["created_at", "DESC"],
      fields: [
        "status",
        "organization_id",
        "role_id",
        "module_id",
        "facility_id",
        "created_at",
        "updated_at",
      ],
    });

    /* ========================================================
       🧹 STRIP UI-ONLY FILTERS
    ======================================================== */
    const {
      dateRange,
      organization_id,
      role_id,
      module_id,
      facility_id,
    } = req.query;

    if (options.where?.dateRange) {
      delete options.where.dateRange;
    }

    /* ========================================================
       🏢 ORG GUARD (NON-SUPER ADMINS)
    ======================================================== */
    if (!isSuperAdmin(req.user)) {
      options.where = {
        ...(options.where || {}),
        organization_id: req.user.organization_id,
      };
    }

    /* ========================================================
       🎯 EXPLICIT FK FILTERS
    ======================================================== */
    if (organization_id) options.where.organization_id = organization_id;
    if (role_id) options.where.role_id = role_id;
    if (module_id) options.where.module_id = module_id;
    if (facility_id) options.where.facility_id = facility_id;

    /* ========================================================
       📅 DATE RANGE FILTER (LOCAL – SINGLE SOURCE)
    ======================================================== */
    if (dateRange) {
      const range = normalizeDateRangeLocal(dateRange);
      if (range) {
        options.where.created_at = {
          [Op.between]: [range.start, range.end],
        };
      }
    }

    /* ========================================================
       🔎 SEARCH (JOIN FIELDS)
    ======================================================== */
    if (options.search) {
      options.where = {
        ...(options.where || {}),
        [Op.or]: [
          { "$role.name$": { [Op.iLike]: `%${options.search}%` } },
          { "$module.name$": { [Op.iLike]: `%${options.search}%` } },
          { "$facility.name$": { [Op.iLike]: `%${options.search}%` } },
        ],
      };
    }

    /* ========================================================
       📦 MAIN QUERY
    ======================================================== */
    const { count, rows } = await FeatureAccess.findAndCountAll({
      where: options.where,
      include: FEATURE_ACCESS_INCLUDES,
      order: options.order,
      offset: options.offset,
      limit: options.limit,
      distinct: true,
      subQuery: false,
    });

    /* ============================================================
      📊 SUMMARY (BASE-TABLE SAFE — NO JOIN ALIASES)
    ============================================================ */

    /**
     * IMPORTANT:
     * - Summary MUST NOT use $role.name$, $module.name$, etc.
     * - Only base FeatureAccess columns allowed
     */
    const summaryWhere = {};

    /* ---------- ORG GUARD ---------- */
    if (!isSuperAdmin(req.user)) {
      summaryWhere.organization_id = req.user.organization_id;
    }

    /* ---------- EXPLICIT FK FILTERS ---------- */
    if (organization_id) summaryWhere.organization_id = organization_id;
    if (role_id) summaryWhere.role_id = role_id;
    if (module_id) summaryWhere.module_id = module_id;
    if (facility_id) summaryWhere.facility_id = facility_id;

    /* ---------- DATE RANGE ---------- */
    if (dateRange) {
      const range = normalizeDateRangeLocal(dateRange);
      if (range) {
        summaryWhere.created_at = {
          [Op.between]: [range.start, range.end],
        };
      }
    }

    /* ---------- TOTAL ---------- */
    const total = await FeatureAccess.count({
      where: summaryWhere,
    });

    /* ---------- STATUS SUMMARY ---------- */
    const statusRows = await FeatureAccess.findAll({
      attributes: [
        "status",
        [sequelize.fn("COUNT", sequelize.col("id")), "count"],
      ],
      where: summaryWhere,
      group: ["status"],
      raw: true,
    });

    const statusMap = Object.fromEntries(
      statusRows.map(r => [r.status, Number(r.count)])
    );

    /* ---------- SCOPE SUMMARY ---------- */
    const scopeRows = await FeatureAccess.findAll({
      attributes: [
        [
          sequelize.literal(
            `CASE WHEN facility_id IS NULL THEN 'org_wide' ELSE 'facility' END`
          ),
          "scope",
        ],
        [sequelize.fn("COUNT", sequelize.col("id")), "count"],
      ],
      where: summaryWhere,
      group: ["scope"],
      raw: true,
    });

    const scopeMap = Object.fromEntries(
      scopeRows.map(r => [r.scope, Number(r.count)])
    );

    /* ---------- FINAL SUMMARY ---------- */
    const summary = {
      total,
      status: {
        active: statusMap[ACCESS_STATUS.ACTIVE] || 0,
        inactive: statusMap[ACCESS_STATUS.INACTIVE] || 0,
      },
      scope: {
        org_wide: scopeMap.org_wide || 0,
        facility: scopeMap.facility || 0,
      },
    };

    /* ========================================================
       🧾 AUDIT
    ======================================================== */
    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY_FEATURE_ACCESS,
      action: "list",
      details: { query: req.query, returned: count },
    });

    /* ========================================================
       ✅ RESPONSE
    ======================================================== */
    return success(res, "✅ Feature accesses loaded", {
      records: rows,
      pagination: {
        total: count,
        page: options.pagination.page,
        pageCount: Math.ceil(count / options.pagination.limit),
      },
      summary,
    });
  } catch (err) {
    debug.error("access-list → FAILED", err);
    return error(res, "❌ Failed to load feature accesses", err);
  }
};

/* ============================================================
   📌 GET FEATURE ACCESS BY ID
============================================================ */
export const getFeatureAccessById = async (req, res) => {
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module: MODULE_KEY_FEATURE_ACCESS,
      action: "read",
      res,
    });
    if (!allowed) return;

    const { id } = req.params;

    const where = { id };

    /* ================= ORG GUARD ================= */
    if (!isSuperAdmin(req.user)) {
      where.organization_id = req.user.organization_id;
    }

    const entry = await FeatureAccess.findOne({
      where,
      include: FEATURE_ACCESS_INCLUDES,
    });

    if (!entry) {
      return error(res, "❌ Feature access not found", null, 404);
    }

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY_FEATURE_ACCESS,
      action: "view",
      entityId: id,
      entity: entry,
    });

    return success(res, "✅ Feature access loaded", {
      record: entry,
    });
  } catch (err) {
    debug.error("access-view → FAILED", err);
    return error(res, "❌ Failed to load feature access", err);
  }
};
