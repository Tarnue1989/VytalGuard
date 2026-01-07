// 📁 controllers/featureController.js
import Joi from "joi";
import { Op } from "sequelize";
import { sequelize, Organization, FeatureModule, FeatureAccess, Role, User, Facility } from "../models/index.js";
import { success, error } from "../utils/response.js";
import { buildQueryOptions } from "../utils/queryHelper.js";
import { FEATURE_MODULE_STATUS } from "../constants/enums.js";
import { authzService } from "../services/authzService.js";
import { auditService } from "../services/auditService.js";
import { QueryTypes } from "sequelize";
import {
  syncOrgAdminsForModule,
} from "../services/roleProvisioningService.js";

/* ============================================================
   🔧 HELPERS
   ============================================================ */
const FEATURE_INCLUDES = [
  { model: Role, as: "roles", through: { attributes: [] }, attributes: ["id", "name"], required: false },
  { model: FeatureModule, as: "parent", attributes: ["id", "name"], required: false },
  { model: FeatureModule, as: "children", attributes: ["id", "name"], required: false },
  { model: User, as: "createdBy", attributes: ["id", "first_name", "last_name"], required: false },
  { model: User, as: "updatedBy", attributes: ["id", "first_name", "last_name"], required: false },
  { model: User, as: "deletedBy", attributes: ["id", "first_name", "last_name"], required: false },
];

/* ============================================================
   📋 ROLE-BASED JOI SCHEMA FACTORY
   ============================================================ */
function buildFeatureSchema(mode = "create") {
  const base = {
    name: Joi.string().max(255).required(),

    key: Joi.string().max(120).required(),

    icon: Joi.string().allow(null, ""),

    category: Joi.string().max(120).allow(null, ""),

    description: Joi.string().allow(null, ""),

    tags: Joi.array().items(Joi.string()).default([]),

    visibility: Joi.string()
      .valid("public", "private", "hidden")
      .default("public"),

    tenant_scope: Joi.string()
      .valid("global", "org", "facility")
      .default("org"),

    enabled: Joi.boolean().default(true),

    status: Joi.string()
      .valid(...FEATURE_MODULE_STATUS)
      .default(FEATURE_MODULE_STATUS[0]),

    order_index: Joi.number()
      .integer()
      .min(0)
      .default(0),

    route: Joi.string()
      .regex(/^[a-zA-Z0-9_\-/\.]*$/)
      .allow(null, ""),

    parent_id: Joi.string()
      .uuid()
      .allow(null)
      .default(null),

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

    dashboard_order: Joi.number()
      .integer()
      .min(0)
      .default(0),
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
   ============================================================ */
export const getAllFeatureModules = async (req, res) => {
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module: "featureModule",
      action: "read",
      res,
    });
    if (!allowed) return;

    const options = buildQueryOptions(req, "order_index", "ASC");

    /* ========================================================
       🔍 SEARCH
       ======================================================== */
    if (options.search) {
      options.where = {
        ...options.where,
        [Op.or]: [
          { name: { [Op.iLike]: `%${options.search}%` } },
          { key: { [Op.iLike]: `%${options.search}%` } },
          { category: { [Op.iLike]: `%${options.search}%` } },
        ],
      };
    }

    /* ========================================================
       🔐 TENANT SCOPE ENFORCEMENT
       ======================================================== */
    if (!isSuperAdmin(req.user)) {
      options.where = {
        ...options.where,
        tenant_scope: { [Op.in]: ["org", "facility"] },
      };
    }

    /* ========================================================
       👁️ VISIBILITY FILTER
       ======================================================== */
    options.where = {
      ...options.where,
      visibility: { [Op.ne]: "hidden" },
    };

    /* ========================================================
       📊 QUERY
       ======================================================== */
    const { count, rows } = await FeatureModule.findAndCountAll({
      where: options.where,
      include: FEATURE_INCLUDES,
      order: [["order_index", "ASC"], ["name", "ASC"]],
      offset: options.offset,
      limit: options.limit,
    });

    await auditService.logAction({
      user: req.user,
      module: "featureModule",
      action: "list",
      details: { query: req.query, returned: count },
    });

    return success(res, "✅ Feature modules loaded", {
      records: rows,
      pagination: {
        total: count,
        page: options.pagination.page,
        pageCount: Math.ceil(count / options.pagination.limit),
      },
    });
  } catch (err) {
    return error(res, "❌ Failed to load feature modules", err);
  }
};

/* ============================================================
   📌 GET FEATURE MODULE BY ID
   ============================================================ */
export const getFeatureModuleById = async (req, res) => {
  try {
    const { id } = req.params;

    const where = { id };

    /* ========================================================
       🔐 TENANT SCOPE ENFORCEMENT
       ======================================================== */
    if (!isSuperAdmin(req.user)) {
      where.tenant_scope = { [Op.in]: ["org", "facility"] };
      where.visibility = { [Op.ne]: "hidden" };
    }

    const module = await FeatureModule.findOne({
      where,
      include: FEATURE_INCLUDES,
    });

    if (!module) return error(res, "❌ Feature module not found", null, 404);

    await auditService.logAction({
      user: req.user,
      module: "featureModule",
      action: "view",
      entityId: id,
      entity: module,
    });

    return success(res, "✅ Feature module loaded", { record: module });
  } catch (err) {
    return error(res, "❌ Failed to load feature module", err);
  }
};

/* ============================================================
   📌 GET AVAILABLE MODULES (role/facility scoped tree)
   ============================================================ */
export const getAvailableModules = async (req, res) => {
  try {
    if (!req.user) return error(res, "Unauthorized", null, 401);

    const roleNames   = (req.user.roles || []).map(r => (r.name || "").toLowerCase());
    const roleIds     = (req.user.roles || []).map(r => r.id);
    let orgId         = req.user.organization_id;
    const facilityIds = Array.isArray(req.user.facility_ids) ? req.user.facility_ids : [];

    let modules = [];

    /* ========================================================
       🔑 SUPER ADMIN — SEE EVERYTHING (EXCEPT HIDDEN)
       ======================================================== */
    if (roleNames.includes("super admin") || roleNames.includes("superadmin")) {
      modules = await FeatureModule.findAll({
        where: {
          enabled: true,
          status: "active",
          visibility: { [Op.ne]: "hidden" },
        },
        order: [["order_index", "ASC"], ["name", "ASC"]],
        include: [
          { model: Role, as: "roles", through: { attributes: [] } },
          {
            model: FeatureAccess,
            as: "access",
            where: { status: "active" },
            required: false,
            include: [{ model: Facility, as: "facility", attributes: ["id", "name"] }],
          },
        ],
      });
    } else {
      /* ======================================================
         🔹 NON-SUPERADMIN (ORG + FACILITY AWARE)
         ====================================================== */

      // 🔹 Infer orgId from facilities if missing
      if (!orgId && facilityIds.length > 0) {
        const facilities = await Facility.findAll({
          where: { id: { [Op.in]: facilityIds } },
          attributes: ["organization_id"],
        });
        if (facilities.length > 0) orgId = facilities[0].organization_id;
      }

      /* ======================================================
         🔑 ACCESS FILTER (ORG + FACILITY + ORG-WIDE)
         ====================================================== */
      const whereAccess = {
        role_id: { [Op.in]: roleIds },
        status: "active",
      };

      if (orgId) {
        whereAccess.organization_id = orgId;
      }

      whereAccess[Op.or] = [
        ...(facilityIds.length > 0
          ? [{ facility_id: { [Op.in]: facilityIds } }]
          : []),
        { facility_id: null }, // org-wide access
      ];

      const accesses = await FeatureAccess.findAll({
        where: whereAccess,
        include: [
          {
            model: FeatureModule,
            as: "module",
            required: true,
            paranoid: false,
            where: {
              enabled: true,
              status: "active",
              visibility: { [Op.ne]: "hidden" },
              tenant_scope: { [Op.in]: ["org", "facility"] },
            },
            include: [{ model: Role, as: "roles" }],
          },
          {
            model: Facility,
            as: "facility",
            attributes: ["id", "name"],
            required: false,
          },
        ],
      });

      /* ======================================================
         🔄 DEDUPE MODULES
         ====================================================== */
      const byId = new Map();

      for (const a of accesses) {
        const m = a.module;
        if (!m) continue;

        if (!byId.has(m.id)) {
          byId.set(m.id, {
            ...m.toJSON(),
            children: [],
            facilities: [],
            roles: [],
          });
        }

        if (a.facility) {
          byId.get(m.id).facilities.push(a.facility);
        }
      }

      modules = Array.from(byId.values());
    }

    /* ========================================================
       🌳 BUILD TREE
       ======================================================== */
    const map = {};
    const roots = [];

    modules.forEach(m => {
      map[m.id] = m;
      m.children = m.children || [];
    });

    modules.forEach(m => {
      if (m.parent_id && map[m.parent_id]) {
        map[m.parent_id].children.push(m);
      } else {
        roots.push(m);
      }
    });

    /* ========================================================
       🔑 SORT TREE BY order_index
       ======================================================== */
    const sortTree = list => {
      list.sort((a, b) => (a.order_index || 0) - (b.order_index || 0));
      list.forEach(m => m.children && sortTree(m.children));
    };
    sortTree(roots);

    /* ========================================================
       🔑 COLLECT KEYS + ROUTES
       ======================================================== */
    const collect = (list, accKeys = [], accRoutes = []) => {
      for (const m of list) {
        accKeys.push(m.key);
        accRoutes.push(m.route || `/${m.key}`);
        if (m.children?.length) {
          collect(m.children, accKeys, accRoutes);
        }
      }
      return { accKeys, accRoutes };
    };

    const { accKeys: moduleKeys, accRoutes: routes } = collect(roots);

    await auditService.logAction({
      user: req.user,
      module: "featureModule",
      action: "available-modules",
      details: { returned: moduleKeys.length },
    });

    return success(res, "✅ Available modules loaded", {
      moduleKeys,
      routes,
      records: roots,
    });
  } catch (err) {
    console.error("❌ getAvailableModules error:", err);
    return error(res, "❌ Failed to load available modules", err);
  }
};


/* ============================================================
   📌 GET LITE FEATURE MODULES (with ?q= support + category)
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
      order: [["order_index", "ASC"], ["name", "ASC"]],
      limit: 100,
    });

    return success(res, "✅ Lite module list loaded", { records: modules });
  } catch (err) {
    return error(res, "❌ Failed to load lite modules", err);
  }
};

/* ============================================================
   📌 GET LITE FEATURE MODULE CATEGORIES (distinct list)
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

    const records = rows.map(r => ({ category: r.category }));

    return success(res, "✅ Lite categories loaded", { records });
  } catch (err) {
    return error(res, "❌ Failed to load lite categories", err);
  }
};


/* ============================================================
   📌 GET LITE PARENT MODULES (top-levels only)
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
      order: [["order_index", "ASC"], ["name", "ASC"]],
      limit: 20,
    });

    return success(res, "✅ Lite parent modules loaded", { records: parents });
  } catch (err) {
    return error(res, "❌ Failed to load lite parent modules", err);
  }
};


/* ============================================================
   📌 CREATE FEATURE MODULE
   ============================================================ */
export const createFeatureModule = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const schema = buildFeatureSchema("create");
    const { error: validationError, value } = schema.validate(req.body, {
      stripUnknown: true,
    });

    if (validationError) {
      await t.rollback();
      return error(res, "Validation failed", validationError, 400);
    }

    /* ========================================================
       🔐 TENANT SCOPE GUARD
       ======================================================== */
    if (!isSuperAdmin(req.user) && value.tenant_scope === "global") {
      await t.rollback();
      return error(res, "❌ Only super admins can create global modules", null, 403);
    }

    /* ========================================================
       🔁 UNIQUE KEY CHECK
       ======================================================== */
    const exists = await FeatureModule.findOne({
      where: { key: value.key },
      paranoid: false,
      transaction: t,
    });

    if (exists) {
      await t.rollback();
      return error(res, "❌ Feature module key already exists", null, 400);
    }

    /* ========================================================
       🌳 PARENT VALIDATION
       ======================================================== */
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
        return error(res, "❌ Cannot attach to a global parent module", null, 403);
      }
    }

    /* ========================================================
       🧩 CREATE
       ======================================================== */
    const created = await FeatureModule.create(
      {
        ...value,
        created_by_id: req.user?.id || null,
      },
      { transaction: t }
    );

    await t.commit();

    /* ========================================================
       🔐 AUTO-PROVISION (NON-BLOCKING)
       ======================================================== */
    try {
      await syncOrgAdminsForModule(created.key);
      console.log("🔐 [RBAC] Admin roles auto-granted module:", created.key);
    } catch (provErr) {
      console.error("⚠️ [RBAC] Auto-provision warning:", provErr);
    }

    const full = await FeatureModule.findOne({
      where: { id: created.id },
      include: FEATURE_INCLUDES,
    });

    await auditService.logAction({
      user: req.user,
      module: "featureModule",
      action: "create",
      entityId: created.id,
      entity: full,
      details: value,
    });

    return success(res, "✅ Feature module created", { record: full });
  } catch (err) {
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
    const { id } = req.params;

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

    /* ========================================================
       🔐 TENANT SCOPE CHANGE GUARD
       ======================================================== */
    if (
      value.tenant_scope &&
      value.tenant_scope === "global" &&
      !isSuperAdmin(req.user)
    ) {
      await t.rollback();
      return error(res, "❌ Only super admins can assign global tenant scope", null, 403);
    }

    /* ========================================================
       🔁 UNIQUE KEY CHECK
       ======================================================== */
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

    /* ========================================================
       🌳 PARENT VALIDATION
       ======================================================== */
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
        return error(res, "❌ Cannot attach to a global parent module", null, 403);
      }
    }

    /* ========================================================
       🧩 UPDATE
       ======================================================== */
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
      module: "featureModule",
      action: "update",
      entityId: id,
      entity: full,
      details: value,
    });

    return success(res, "✅ Feature module updated", { record: full });
  } catch (err) {
    await t.rollback();
    return error(res, "❌ Failed to update feature module", err);
  }
};

/* ============================================================
   📌 TOGGLE STATUS
   ============================================================ */
export const toggleFeatureModuleStatus = async (req, res) => {
  try {
    const { id } = req.params;

    const module = await FeatureModule.findOne({
      where: { id },
      include: [{ model: FeatureModule, as: "children", attributes: ["id", "status"] }],
    });

    if (!module) return error(res, "❌ Feature module not found", null, 404);

    /* ========================================================
       🔐 TENANT GUARD
       ======================================================== */
    if (!isSuperAdmin(req.user) && module.tenant_scope === "global") {
      return error(res, "❌ Cannot modify global module", null, 403);
    }

    /* ========================================================
       🌳 CHILD SAFETY
       ======================================================== */
    const hasActiveChildren = (module.children || []).some(
      c => c.status === "active"
    );

    if (hasActiveChildren && module.status === "active") {
      return error(
        res,
        "❌ Disable child modules first before disabling this module",
        null,
        400
      );
    }

    const [ACTIVE, INACTIVE] = FEATURE_MODULE_STATUS;
    const newStatus = module.status === ACTIVE ? INACTIVE : ACTIVE;

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
      module: "featureModule",
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
    return error(res, "❌ Failed to toggle feature module status", err);
  }
};

/* ============================================================
   📌 TOGGLE ENABLED
   ============================================================ */
export const toggleFeatureModuleEnabled = async (req, res) => {
  try {
    const { id } = req.params;

    const module = await FeatureModule.findOne({
      where: { id },
      include: [{ model: FeatureModule, as: "children", attributes: ["id", "enabled"] }],
    });

    if (!module) return error(res, "❌ Feature module not found", null, 404);

    /* ========================================================
       🔐 TENANT GUARD
       ======================================================== */
    if (!isSuperAdmin(req.user) && module.tenant_scope === "global") {
      return error(res, "❌ Cannot modify global module", null, 403);
    }

    /* ========================================================
       🌳 CHILD SAFETY
       ======================================================== */
    const hasEnabledChildren = (module.children || []).some(c => c.enabled);

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
      module: "featureModule",
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
    return error(res, "❌ Failed to toggle feature module enabled", err);
  }
};

/* ============================================================
   📌 DELETE FEATURE MODULE (Soft Delete with Audit)
   ============================================================ */
export const deleteFeatureModule = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { id } = req.params;

    const module = await FeatureModule.findOne({
      where: { id },
      include: [{ model: FeatureModule, as: "children", attributes: ["id"] }],
      transaction: t,
    });

    if (!module) {
      await t.rollback();
      return error(res, "❌ Feature module not found", null, 404);
    }

    /* ========================================================
       🔐 TENANT GUARD
       ======================================================== */
    if (!isSuperAdmin(req.user) && module.tenant_scope === "global") {
      await t.rollback();
      return error(res, "❌ Cannot delete global module", null, 403);
    }

    /* ========================================================
       🌳 CHILD SAFETY
       ======================================================== */
    if ((module.children || []).length > 0) {
      await t.rollback();
      return error(
        res,
        "❌ Delete or reassign child modules first",
        null,
        400
      );
    }

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
      module: "featureModule",
      action: "delete",
      entityId: id,
      entity: full,
    });

    return success(res, "✅ Feature module deleted", { record: full });
  } catch (err) {
    await t.rollback();
    return error(res, "❌ Failed to delete feature module", err);
  }
};




/* ============================================================
   📌 FEATURE ACCESS LOGIC (Org/Facility Scoped, with Super Admin bypass)
   ============================================================ */

function isSuperAdmin(user) {
  if (!user) return false;
  const roles = (user.roles || []).map(r => (r.name || "").toLowerCase());
  return (
    roles.includes("super admin") ||
    roles.includes("superadmin") ||
    (user.email || "").toLowerCase() === "superadmin@vytalguard.com"
  );
}

function isOrgOwner(user) {
  if (!user) return false;
  const roles = (user.roles || []).map(r => (r.name || "").toLowerCase());
  return roles.includes("org owner") || roles.includes("organization owner");
}

function resolveOrganizationId(req, bodyOrgId) {
  if (isSuperAdmin(req.user)) return bodyOrgId;
  return req.user?.organization_id || null;
}


function resolveFacilityId(req, bodyFacilityId) {
  // Super admin: trust frontend (may be null)
  if (isSuperAdmin(req.user)) {
    return bodyFacilityId ?? null;
  }

  // Org Owner: facility is OPTIONAL
  if (isOrgOwner(req.user)) {
    return bodyFacilityId ?? null;
  }

  // Facility-level roles: enforce session facility
  return req.facility_id ?? null;
}


const FEATURE_ACCESS_INCLUDES = [
  {
    model: Organization,
    as: "organization",
    attributes: ["id", "name", "code"],
    required: false, // ✅ org-wide rows still load
  },
  { model: Role, as: "role", attributes: ["id", "name"], required: false },
  { model: FeatureModule, as: "module", attributes: ["id", "name", "key", "category", "visibility", "enabled", "icon"], required: false },
  { model: Facility, as: "facility", attributes: ["id", "name", "code"], required: false },
  { model: User, as: "createdBy", attributes: ["id", "first_name", "last_name"], required: false },
  { model: User, as: "updatedBy", attributes: ["id", "first_name", "last_name"], required: false },
  { model: User, as: "deletedBy", attributes: ["id", "first_name", "last_name"], required: false },
];


/* ============================================================
   📋 ROLE-BASED JOI SCHEMA FACTORY
   ============================================================ */
function buildFeatureAccessSchema(mode = "create") {
  const base = {
    organization_id: Joi.string().uuid().required().label("Organization"),
    role_id: Joi.string().uuid().required().label("Role"),
    module_id: Joi.string().uuid().required().label("Module"),
    facility_id: Joi.string().uuid().allow(null).optional().label("Facility"),
    status: Joi.string().valid("active", "inactive").default("active"),
  };
  if (mode === "update") {
    Object.keys(base).forEach(k => { base[k] = base[k].optional(); });
  }
  return Joi.object(base);
}

/* ============================================================
   📌 CREATE FEATURE ACCESS
   ============================================================ */
export const createFeatureAccess = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const schema = buildFeatureAccessSchema("create");
    const { error: validationError, value } = schema.validate(req.body, { stripUnknown: true });
    if (validationError) {
      await t.rollback();
      return error(res, "Validation failed", validationError, 400);
    }

    // 🔹 Resolve enforced org & facility IDs
    const finalOrgId = resolveOrganizationId(req, value.organization_id);
    if (!finalOrgId) {
      await t.rollback();
      return error(res, "❌ Organization ID is invalid or not allowed for your role", null, 400);
    }

    const finalFacilityId = resolveFacilityId(req, value.facility_id);
    // ✅ facility_id MAY be null (org-wide access)

    // 🔹 Validate facility ONLY if facility-scoped
    if (finalFacilityId) {
      const facilityCheck = await Facility.findOne({
        where: { id: finalFacilityId, organization_id: finalOrgId },
      });

      if (!facilityCheck) {
        await t.rollback();
        return error(res, "❌ Facility does not belong to your organization", null, 400);
      }
    }

    // 🔹 Prevent duplicates (org-wide or facility-scoped)
    const exists = await FeatureAccess.findOne({
      where: {
        organization_id: finalOrgId,
        role_id: value.role_id,
        module_id: value.module_id,
        facility_id: finalFacilityId ?? null,
      },
      paranoid: false,
      transaction: t,
    });

    if (exists) {
      await t.rollback();
      return error(
        res,
        "❌ Access already exists for this organization/role/module/facility",
        null,
        409
      );
    }

    // 🔹 Create access
    const created = await FeatureAccess.create(
      {
        ...value,
        organization_id: finalOrgId,
        facility_id: finalFacilityId ?? null,
        created_by_id: req.user?.id || null,
      },
      { transaction: t }
    );

    await t.commit();

    const full = await FeatureAccess.findOne({
      where: { id: created.id },
      include: FEATURE_ACCESS_INCLUDES,
    });

    await auditService.logAction({
      user: req.user,
      module: "featureAccess",
      action: "create",
      entityId: created.id,
      entity: full,
      details: value,
    });

    return success(res, "✅ Feature access granted", { record: full });
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
    const { id } = req.params;

    const schema = buildFeatureAccessSchema("update");
    const { error: validationError, value } = schema.validate(req.body, { stripUnknown: true });
    if (validationError) {
      await t.rollback();
      return error(res, "Validation failed", validationError, 400);
    }

    // 🔹 Resolve enforced org & facility IDs
    const finalOrgId = resolveOrganizationId(req, value.organization_id);
    if (!finalOrgId) {
      await t.rollback();
      return error(res, "❌ Organization ID is invalid or not allowed for your role", null, 400);
    }

    const finalFacilityId = resolveFacilityId(req, value.facility_id);
    // ✅ facility_id MAY be null (org-wide)

    // 🔹 Validate facility ONLY if facility-scoped
    if (finalFacilityId) {
      const facilityCheck = await Facility.findOne({
        where: { id: finalFacilityId, organization_id: finalOrgId },
      });

      if (!facilityCheck) {
        await t.rollback();
        return error(res, "❌ Facility does not belong to your organization", null, 400);
      }
    }

    // 🔹 Find existing access
    const access = await FeatureAccess.findOne({
      where: {
        id,
        organization_id: finalOrgId,
        facility_id: finalFacilityId ?? null,
      },
      transaction: t,
    });

    if (!access) {
      await t.rollback();
      return error(res, "❌ Feature access not found", null, 404);
    }

    // 🔹 Prevent duplicates
    const duplicate = await FeatureAccess.findOne({
      where: {
        organization_id: finalOrgId,
        role_id: value.role_id,
        module_id: value.module_id,
        facility_id: finalFacilityId ?? null,
        id: { [Op.ne]: id },
      },
      paranoid: false,
      transaction: t,
    });

    if (duplicate) {
      await t.rollback();
      return error(res, "❌ Duplicate access exists", null, 409);
    }

    // 🔹 Update access
    await access.update(
      {
        ...value,
        organization_id: finalOrgId,
        facility_id: finalFacilityId ?? null,
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
      module: "featureAccess",
      action: "update",
      entityId: id,
      entity: full,
      details: value,
    });

    return success(res, "✅ Feature access updated", { record: full });
  } catch (err) {
    await t.rollback();
    return error(res, "❌ Failed to update feature access", err);
  }
};


/* ============================================================
   📌 REPLACE FEATURE ACCESS BY ROLE
   ============================================================ */
export const replaceFeatureAccessByRole = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const schema = Joi.object({
      role_id: Joi.string().uuid().required(),
      module_ids: Joi.array().items(Joi.string().uuid()).min(1).required(),
      organization_id: Joi.string().uuid().required(),
      facility_id: Joi.string().uuid().allow(null).optional(),
      status: Joi.string().valid("active", "inactive").default("active"),
    });

    const { error: validationError, value } = schema.validate({
      ...req.body,
      role_id: req.params.role_id,
    });

    if (validationError) {
      await t.rollback();
      return error(res, "Validation failed", validationError, 400);
    }

    // 🔹 Resolve enforced org ID
    const finalOrgId = resolveOrganizationId(req, value.organization_id);
    if (!finalOrgId) {
      await t.rollback();
      return error(
        res,
        "❌ Organization ID is invalid or not allowed for your role",
        null,
        400
      );
    }

    // 🔹 Resolve facility (OPTIONAL)
    const finalFacilityId = resolveFacilityId(req, value.facility_id) ?? null;

    // ✅ Validate facility ONLY if facility-scoped
    if (finalFacilityId) {
      const facilityCheck = await Facility.findOne({
        where: {
          id: finalFacilityId,
          organization_id: finalOrgId,
        },
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

    // 🔹 Remove old accesses for this scope
    await FeatureAccess.destroy({
      where: {
        role_id: value.role_id,
        organization_id: finalOrgId,
        facility_id: finalFacilityId,
      },
      transaction: t,
    });

    // 🔹 Insert new accesses
    const newAccesses = value.module_ids.map(moduleId => ({
      organization_id: finalOrgId,
      role_id: value.role_id,
      module_id: moduleId,
      facility_id: finalFacilityId,
      status: value.status,
      created_by_id: req.user?.id || null,
    }));

    const created = await FeatureAccess.bulkCreate(newAccesses, {
      returning: true,
      transaction: t,
    });

    await t.commit();

    await auditService.logAction({
      user: req.user,
      module: "featureAccess",
      action: "replace",
      details: {
        role_id: value.role_id,
        organization_id: finalOrgId,
        facility_id: finalFacilityId,
        modules: value.module_ids,
      },
    });

    return success(
      res,
      `✅ Replaced with ${created.length} module(s)`,
      { records: created }
    );
  } catch (err) {
    await t.rollback();
    return error(res, "❌ Failed to replace feature accesses", err);
  }
};

/* ============================================================
   📌 DELETE FEATURE ACCESS (Org-wide or Facility-scoped)
   ============================================================ */
export const deleteFeatureAccess = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { id } = req.params;

    // 🔹 Load entry first
    const entry = await FeatureAccess.findOne({
      where: { id },
      transaction: t,
    });

    if (!entry) {
      await t.rollback();
      return error(res, "❌ Feature access not found", null, 404);
    }

    // 🔹 Enforce org scope for non-superadmins
    if (!isSuperAdmin(req.user)) {
      const finalOrgId = resolveOrganizationId(req, entry.organization_id);
      const finalFacilityId = resolveFacilityId(req, entry.facility_id);

      if (!finalOrgId) {
        await t.rollback();
        return error(res, "❌ Not authorized for this organization", null, 403);
      }

      // ✅ Validate facility ONLY if access is facility-scoped
      if (finalFacilityId) {
        const facilityCheck = await Facility.findOne({
          where: {
            id: finalFacilityId,
            organization_id: finalOrgId,
          },
        });

        if (!facilityCheck) {
          await t.rollback();
          return error(res, "❌ Facility does not belong to your organization", null, 403);
        }
      }
    }

    // 🔹 Soft delete
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
      module: "featureAccess",
      action: "delete",
      entityId: id,
      entity: full,
    });

    return success(res, "✅ Feature access deleted", { record: full });
  } catch (err) {
    await t.rollback();
    return error(res, "❌ Failed to delete feature access", err);
  }
};

/* ============================================================
   📌 TOGGLE FEATURE ACCESS STATUS (Org-wide or Facility-scoped)
   ============================================================ */
export const toggleFeatureAccessStatus = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { id } = req.params;

    const access = await FeatureAccess.findOne({
      where: { id },
      transaction: t,
    });

    if (!access) {
      await t.rollback();
      return error(res, "❌ Feature access not found", null, 404);
    }

    // 🔹 Enforce org scope for non-superadmins
    if (!isSuperAdmin(req.user)) {
      const finalOrgId = resolveOrganizationId(req, access.organization_id);
      const finalFacilityId = resolveFacilityId(req, access.facility_id);

      if (!finalOrgId) {
        await t.rollback();
        return error(res, "❌ Not authorized for this organization", null, 403);
      }

      // ✅ Validate facility ONLY if facility-scoped
      if (finalFacilityId) {
        const facilityCheck = await Facility.findOne({
          where: {
            id: finalFacilityId,
            organization_id: finalOrgId,
          },
        });

        if (!facilityCheck) {
          await t.rollback();
          return error(res, "❌ Facility does not belong to your organization", null, 403);
        }
      }
    }

    // 🔹 Toggle status
    const newStatus = access.status === "active" ? "inactive" : "active";

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
      module: "featureAccess",
      action: "toggle-status",
      entityId: id,
      entity: full,
      details: { from: access.status, to: newStatus },
    });

    return success(res, `✅ Feature access status toggled to ${newStatus}`, {
      record: full,
    });
  } catch (err) {
    await t.rollback();
    return error(res, "❌ Failed to toggle feature access status", err);
  }
};

/* ============================================================
   📌 GET LITE FEATURE ACCESSES (with ?q= support)
   ============================================================ */
export const getLiteFeatureAccesses = async (req, res) => {
  try {
    const { q } = req.query;
    const where = {};

    if (q) {
      where[Op.or] = [
        { "$role.name$": { [Op.iLike]: `%${q}%` } },
        { "$module.name$": { [Op.iLike]: `%${q}%` } },
        { "$facility.name$": { [Op.iLike]: `%${q}%` } },
      ];
    }

    if (!isSuperAdmin(req.user)) {
      const orgId = req.user.organization_id;
      const facilityIds = Array.isArray(req.user.facility_ids) ? req.user.facility_ids : [];

      where.organization_id = orgId;
      if (facilityIds.length > 0) {
        where[Op.or] = [
          { facility_id: { [Op.in]: facilityIds } },
          { facility_id: null }, // org-wide access
        ];
      }
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

    return success(res, "✅ Lite feature accesses loaded", { records: accesses });
  } catch (err) {
    return error(res, "❌ Failed to load lite feature accesses", err);
  }
};

/* ============================================================
   📌 GET ALL FEATURE ACCESSES
   ============================================================ */
export const getAllFeatureAccesses = async (req, res) => {
  try {
    const options = buildQueryOptions(req, "created_at", "DESC");

    if (!isSuperAdmin(req.user)) {
      const orgId = req.user.organization_id;
      const facilityIds = Array.isArray(req.user.facility_ids) ? req.user.facility_ids : [];

      options.where.organization_id = orgId;
      if (facilityIds.length > 0) {
        options.where[Op.or] = [
          { facility_id: { [Op.in]: facilityIds } },
          { facility_id: null },
        ];
      }
    }

    if (options.search) {
      options.where[Op.or] = [
        { "$role.name$": { [Op.iLike]: `%${options.search}%` } },
        { "$module.name$": { [Op.iLike]: `%${options.search}%` } },
        { "$facility.name$": { [Op.iLike]: `%${options.search}%` } },
      ];
    }

    const { count, rows } = await FeatureAccess.findAndCountAll({
      where: options.where,
      include: FEATURE_ACCESS_INCLUDES,
      order: options.order,
      offset: options.offset,
      limit: options.limit,
    });

    await auditService.logAction({
      user: req.user,
      module: "featureAccess",
      action: "list",
      details: { query: req.query, returned: count },
    });

    return success(res, "✅ Feature accesses loaded", {
      records: rows,
      pagination: {
        total: count,
        page: options.pagination.page,
        pageCount: Math.ceil(count / options.pagination.limit),
      },
    });
  } catch (err) {
    return error(res, "❌ Failed to load feature accesses", err);
  }
};

/* ============================================================
   📌 GET FEATURE ACCESS BY ID
   ============================================================ */
export const getFeatureAccessById = async (req, res) => {
  try {
    const { id } = req.params;
    const where = { id };

    if (!isSuperAdmin(req.user)) {
      const orgId = req.user.organization_id;
      const facilityIds = Array.isArray(req.user.facility_ids) ? req.user.facility_ids : [];

      where.organization_id = orgId;
      if (facilityIds.length > 0) {
        where[Op.or] = [
          { facility_id: { [Op.in]: facilityIds } },
          { facility_id: null },
        ];
      }
    }

    const entry = await FeatureAccess.findOne({ where, include: FEATURE_ACCESS_INCLUDES });
    if (!entry) return error(res, "❌ Feature access not found", null, 404);

    await auditService.logAction({
      user: req.user,
      module: "featureAccess",
      action: "view",
      entityId: id,
      entity: entry,
    });

    return success(res, "✅ Feature access loaded", { record: entry });
  } catch (err) {
    return error(res, "❌ Failed to load feature access", err);
  }
};
