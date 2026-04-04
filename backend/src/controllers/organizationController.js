// 📁 controllers/organizationController.js
import Joi from "joi";
import { Op } from "sequelize";
import { sequelize, Organization, Facility, User } from "../models/index.js";
import { success, error } from "../utils/response.js";
import { buildQueryOptions } from "../utils/queryHelper.js";
import { ORG_STATUS } from "../constants/enums.js";
import { authzService } from "../services/authzService.js";
import { auditService } from "../services/auditService.js";
import { isSuperAdmin } from "../utils/role-utils.js";
import { makeModuleLogger } from "../utils/debugLogger.js";
import { validate } from "../utils/validation.js";
import { normalizeDateRangeLocal } from "../utils/date-utils.js";
import { resolveTenantScopeLite } from "../utils/resolveTenantScopeLite.js";

/* ============================================================
   🔧 LOCAL DEBUG OVERRIDE (ORGANIZATION CONTROLLER)
============================================================ */
const DEBUG_OVERRIDE = true;
const debug = makeModuleLogger("organizationController", DEBUG_OVERRIDE);

const MODULE_KEY = "organizations";

/* ============================================================
   🔗 SHARED INCLUDES
============================================================ */
const ORG_INCLUDES = [
  {
    model: Facility,
    as: "facilities",
    attributes: ["id", "name", "code", "status"],
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
   📋 ROLE-AWARE JOI SCHEMA (MASTER)
============================================================ */
function buildOrganizationSchema(userRole, mode = "create") {
  const base = {
    name: Joi.string().max(255).required(),
    code: Joi.string().max(50).required(),
    status: Joi.string().valid(...Object.values(ORG_STATUS)).default(Object.values(ORG_STATUS)[0]),
  };

  if (mode === "update") {
    Object.keys(base).forEach((k) => (base[k] = base[k].optional()));
  }

  if (userRole !== "superadmin") {
    base.code = Joi.forbidden();
  }

  return Joi.object(base);
}

/* ============================================================
   📌 GET ALL ORGANIZATIONS (ROLE-MASTER PARITY)
============================================================ */
export const getAllOrganizations = async (req, res) => {
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module: MODULE_KEY,
      action: "read",
      res,
    });
    if (!allowed) return;

    /* ========================================================
       ⚙️ BASE QUERY OPTIONS
    ======================================================== */
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
       📅 DATE RANGE (UI ONLY)
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
        id: req.user.organization_id,
      });
    }

    /* ========================================================
       🔍 GLOBAL SEARCH
    ======================================================== */
    if (options.search) {
      options.where[Op.and].push({
        [Op.or]: [
          { name: { [Op.iLike]: `%${options.search}%` } },
          { code: { [Op.iLike]: `%${options.search}%` } },
        ],
      });
    }

    /* ========================================================
       📌 STATUS FILTER (MASTER – SAME AS ROLE)
    ======================================================== */
    if (req.query.status && Object.values(ORG_STATUS).includes(req.query.status)) {
      options.where[Op.and].push({
        status: req.query.status,
      });
    }

    /* ========================================================
       📦 QUERY
    ======================================================== */
    const { count, rows } = await Organization.findAndCountAll({
      where: options.where,
      include: ORG_INCLUDES,
      order: options.order,
      offset: options.offset,
      limit: options.limit,
      distinct: true,
    });

    /* ========================================================
       📊 SUMMARY (PAGE-AWARE, SAME AS ROLE)
    ======================================================== */
    const summary = {
      total: count,
      active: rows.filter(r => r.status === "active").length,
      inactive: rows.filter(r => r.status === "inactive").length,
    };

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

    return success(res, "✅ Organizations loaded", {
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
    return error(res, "❌ Failed to load organizations", err);
  }
};

/* ============================================================
   📌 GET ORGANIZATION BY ID
============================================================ */
export const getOrganizationById = async (req, res) => {
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module: MODULE_KEY,
      action: "read",
      res,
    });
    if (!allowed) return;

    const where = { id: req.params.id };

    if (!isSuperAdmin(req.user)) {
      where.id = req.user.organization_id;
    }

    const org = await Organization.findOne({
      where,
      include: ORG_INCLUDES,
    });

    if (!org) return error(res, "❌ Organization not found", null, 404);

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "view",
      entityId: org.id,
      entity: org,
    });

    return success(res, "✅ Organization loaded", org);
  } catch (err) {
    debug.error("view → FAILED", err);
    return error(res, "❌ Failed to load organization", err);
  }
};

/* ============================================================
   📌 GET ALL ORGANIZATIONS LITE (FINAL SAFE)
============================================================ */
export const getAllOrganizationsLite = async (req, res) => {
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module: MODULE_KEY,
      action: "read",
      res,
    });
    if (!allowed) return;

    const { q } = req.query;

    const where = {
      status: Object.values(ORG_STATUS)[0],
      [Op.and]: [],
    };

    /* ========================================================
       🔐 TENANT SCOPE
    ======================================================== */
    const { orgId } = resolveTenantScopeLite({
      user: req.user,
      query: req.query,
    });

    /* ========================================================
       🔒 ORG RESTRICTION (FAIL-SAFE)
    ======================================================== */
    if (!isSuperAdmin(req.user)) {

      if (orgId) {
        where[Op.and].push({ id: orgId });
      } else {
        // 🚨 FAIL CLOSED (VERY IMPORTANT)
        where[Op.and].push({ id: "__NO_MATCH__" });
      }

    } else {
      if (orgId) {
        where.id = orgId;
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
    const organizations = await Organization.findAll({
      where,
      attributes: ["id", "name", "code"],
      order: [["name", "ASC"]],
      limit: 100,
    });

    /* ========================================================
       🧠 OUTPUT
    ======================================================== */
    const records = organizations.map((o) => ({
      id: o.id,
      name: o.name,
      code: o.code || "",
    }));

    /* ========================================================
       🧾 AUDIT
    ======================================================== */
    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "list_lite",
      details: {
        q: q || null,
        count: records.length,
        orgId: orgId || null,
      },
    });

    return success(res, "✅ Organizations loaded (lite)", {
      records,
    });

  } catch (err) {
    debug.error("list_lite → FAILED", err);
    return error(res, "❌ Failed to load organizations (lite)", err);
  }
};
/* ============================================================
   📌 CREATE ORGANIZATION
============================================================ */
export const createOrganization = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module: MODULE_KEY,
      action: "create",
      res,
    });
    if (!allowed) return;

    if (!isSuperAdmin(req.user)) {
      await t.rollback();
      return error(res, "❌ Only Super Admin can create organizations", null, 403);
    }

    const { value, errors } = validate(
      buildOrganizationSchema("superadmin", "create"),
      req.body
    );

    if (errors) {
      await t.rollback();
      return res.status(400).json({ success: false, errors });
    }

    const exists = await Organization.findOne({
      where: { code: value.code },
      paranoid: false,
      transaction: t,
    });

    if (exists) {
      await t.rollback();
      return error(res, "Organization code already exists", null, 400);
    }

    const created = await Organization.create(
      { ...value, created_by_id: req.user?.id || null },
      { transaction: t }
    );

    await t.commit();

    const full = await Organization.findOne({
      where: { id: created.id },
      include: ORG_INCLUDES,
    });

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "create",
      entityId: created.id,
      entity: full,
      details: value,
    });

    return success(res, "✅ Organization created", full);
  } catch (err) {
    await t.rollback();
    debug.error("create → FAILED", err);
    return error(res, "❌ Failed to create organization", err);
  }
};

/* ============================================================
   📌 UPDATE ORGANIZATION (MASTER PARITY)
============================================================ */
export const updateOrganization = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    debug.log("update → incoming", {
      id: req.params.id,
      body: req.body,
    });

    const allowed = await authzService.checkPermission({
      user: req.user,
      module: MODULE_KEY,
      action: "update",
      res,
    });
    if (!allowed) return;

    const { value, errors } = validate(
      buildOrganizationSchema(
        isSuperAdmin(req.user) ? "superadmin" : "org_user",
        "update"
      ),
      req.body
    );

    if (errors) {
      await t.rollback();
      return res.status(400).json({ success: false, errors });
    }

    const where = { id: req.params.id };

    if (!isSuperAdmin(req.user)) {
      where.id = req.user.organization_id;
    }

    const org = await Organization.findOne({ where, transaction: t });
    if (!org) {
      await t.rollback();
      return error(res, "Organization not found", null, 404);
    }

    if (value.code) {
      const exists = await Organization.findOne({
        where: {
          code: value.code,
          id: { [Op.ne]: org.id },
        },
        paranoid: false,
        transaction: t,
      });

      if (exists) {
        await t.rollback();
        return error(res, "Organization code already in use", null, 400);
      }
    }

    await org.update(
      {
        ...value,
        updated_by_id: req.user?.id || null,
      },
      { transaction: t }
    );

    await t.commit();

    const full = await Organization.findOne({
      where: { id: org.id },
      include: ORG_INCLUDES,
    });

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "update",
      entityId: org.id,
      entity: full,
      details: value,
    });

    return success(res, "✅ Organization updated", full);
  } catch (err) {
    await t.rollback();
    debug.error("update → FAILED", err);
    return error(res, "❌ Failed to update organization", err);
  }
};

/* ============================================================
   📌 TOGGLE ORGANIZATION STATUS (MASTER PARITY)
============================================================ */
export const toggleOrganizationStatus = async (req, res) => {
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module: MODULE_KEY,
      action: "update",
      res,
    });
    if (!allowed) return;

    const where = { id: req.params.id };

    if (!isSuperAdmin(req.user)) {
      where.id = req.user.organization_id;
    }

    const org = await Organization.findOne({ where });
    if (!org) {
      return error(res, "❌ Organization not found", null, 404);
    }

    const { ACTIVE, INACTIVE } = ORG_STATUS;
    const newStatus = org.status === ACTIVE ? INACTIVE : ACTIVE;

    await org.update({
      status: newStatus,
      updated_by_id: req.user?.id || null,
    });

    const full = await Organization.findOne({
      where: { id: org.id },
      include: ORG_INCLUDES,
    });

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "toggle_status",
      entityId: org.id,
      entity: full,
      details: { from: org.status, to: newStatus },
    });

    return success(
      res,
      `✅ Organization status toggled to ${newStatus}`,
      full
    );
  } catch (err) {
    debug.error("toggle_status → FAILED", err);
    return error(res, "❌ Failed to toggle organization status", err);
  }
};

/* ============================================================
   📌 DELETE ORGANIZATION (MASTER PARITY)
============================================================ */
export const deleteOrganization = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module: MODULE_KEY,
      action: "delete",
      res,
    });
    if (!allowed) return;

    if (!isSuperAdmin(req.user)) {
      await t.rollback();
      return error(
        res,
        "❌ Only Super Admin can delete organizations",
        null,
        403
      );
    }

    const org = await Organization.findOne({
      where: { id: req.params.id },
      transaction: t,
    });

    if (!org) {
      await t.rollback();
      return error(res, "❌ Organization not found", null, 404);
    }

    await org.update(
      { deleted_by_id: req.user?.id || null },
      { transaction: t }
    );

    await org.destroy({ transaction: t });
    await t.commit();

    const full = await Organization.findOne({
      where: { id: org.id },
      include: ORG_INCLUDES,
      paranoid: false,
    });

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "delete",
      entityId: org.id,
      entity: full,
    });

    return success(res, "✅ Organization deleted", full);
  } catch (err) {
    await t.rollback();
    debug.error("delete → FAILED", err);
    return error(res, "❌ Failed to delete organization", err);
  }
};
