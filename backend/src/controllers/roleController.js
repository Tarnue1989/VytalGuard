// 📁 controllers/roleController.js
import Joi from "joi";
import { Op } from "sequelize";
import {
  sequelize,
  Role,
  User,
  Facility,
  Organization,
} from "../models/index.js";

import { success, error } from "../utils/response.js";
import { ROLE_STATUS } from "../constants/enums.js";

import { authzService } from "../services/authzService.js";
import { auditService } from "../services/auditService.js";
import {
  isSuperAdmin,
  isOrgOwner,
  isFacilityHead,
} from "../utils/role-utils.js";

import { buildQueryOptions } from "../utils/queryHelper.js";
import { normalizeDateRangeLocal } from "../utils/date-utils.js";
import { makeModuleLogger } from "../utils/debugLogger.js";

import {
  syncOrgAdminForRole,
} from "../services/roleProvisioningService.js";

const MODULE_KEY = "roles";

/* ============================================================
   🔧 LOCAL DEBUG OVERRIDE (ROLE CONTROLLER)
============================================================ */
const DEBUG_OVERRIDE = true; // 👈 turn OFF in prod
const debug = makeModuleLogger("roleController", DEBUG_OVERRIDE);

/* ============================================================
   🔗 SHARED INCLUDES (LEFT JOIN SAFE)
============================================================ */
const ROLE_INCLUDES = [
  {
    model: Organization,
    as: "organization",
    attributes: ["id", "name", "code"],
    required: false,
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
   📋 ROLE JOI SCHEMA (ORG + FACILITY SAFE)
============================================================ */
function buildRoleSchema(isSuper, mode = "create") {
  const base = {
    name: Joi.string().max(80),
    code: Joi.string().max(50).allow("", null),
    description: Joi.string().allow("", null),
    is_system: Joi.boolean(),
    requires_facility: Joi.boolean(),
  };

  if (mode === "create") {
    base.name = base.name.required();
    base.is_system = base.is_system.default(false);
    base.requires_facility = base.requires_facility.default(false);
  } else {
    base.status = Joi.string().valid(...Object.values(ROLE_STATUS)).optional();
    Object.keys(base).forEach(k => (base[k] = base[k].optional()));
  }

  if (isSuper) {
    base.organization_id = Joi.string().uuid().allow(null).optional();
    base.facility_id = Joi.string().uuid().allow(null).optional();
  } else {
    base.facility_id = Joi.string().uuid().allow(null).optional();
  }

  return Joi.object(base);
}

/* ============================================================
   📌 CREATE ROLE
============================================================ */
export const createRole = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    debug.log("create → incoming", req.body);

    const allowed = await authzService.checkPermission({
      user: req.user,
      module: MODULE_KEY,
      action: "create",
      res,
    });
    if (!allowed) return;

    const schema = buildRoleSchema(isSuperAdmin(req.user), "create");
    const { error: validationError, value } = schema.validate(req.body, {
      stripUnknown: true,
    });

    if (validationError) {
      debug.warn("create → validation failed", validationError);
      await t.rollback();
      return error(res, "Validation failed", validationError, 400);
    }

    if (value.is_system && !isSuperAdmin(req.user)) {
      await t.rollback();
      return error(
        res,
        "❌ Only superadmin can create system roles",
        null,
        403
      );
    }

    /* ========================================================
       🧭 SCOPE RESOLUTION
    ======================================================== */
    let orgId = null;
    let facilityId = null;

    if (isSuperAdmin(req.user)) {
      if (!value.is_system) {
        orgId =
          "organization_id" in value ? value.organization_id : null;
        facilityId =
          "facility_id" in value ? value.facility_id : null;
      }
    } else if (isOrgOwner(req.user)) {
      orgId = req.user.organization_id;
      facilityId =
        "facility_id" in value ? value.facility_id : null;
    } else if (isFacilityHead(req.user)) {
      orgId = req.user.organization_id;
      facilityId = req.user.facility_id;
    } else {
      orgId = req.user.organization_id;
      facilityId = req.user.facility_id ?? null;
    }

    if (!value.is_system && !orgId) {
      await t.rollback();
      return error(res, "Missing organization assignment", null, 400);
    }

    /* ========================================================
       🚫 UNIQUENESS CHECK
    ======================================================== */
    const exists = await Role.findOne({
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
        "Role already exists in this scope",
        null,
        400
      );
    }

    /* ========================================================
       ✅ CREATE
    ======================================================== */
    const created = await Role.create(
      {
        ...value,
        organization_id: orgId,
        facility_id: facilityId,
        role_type: value.is_system ? "system" : "custom",
        created_by_id: req.user?.id || null,
      },
      { transaction: t }
    );

    await t.commit();

    /* ========================================================
       🔐 AUTO-PROVISION (NON-BLOCKING)
    ======================================================== */
    try {
      await syncOrgAdminForRole(created.id);
      debug.log("auto-provision → success", created.id);
    } catch (provErr) {
      debug.warn("auto-provision → warning", provErr);
    }

    const full = await Role.findByPk(created.id, {
      include: ROLE_INCLUDES,
    });

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "create",
      entityId: created.id,
      entity: full,
    });

    return success(res, "✅ Role created", full);
  } catch (err) {
    await t.rollback();
    debug.error("create → FAILED", err);
    return error(res, "❌ Failed to create role", err);
  }
};

/* ============================================================
   📌 UPDATE ROLE
============================================================ */
export const updateRole = async (req, res) => {
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

    const schema = buildRoleSchema(isSuperAdmin(req.user), "update");
    const { error: validationError, value } = schema.validate(req.body, {
      stripUnknown: true,
    });

    if (validationError) {
      await t.rollback();
      return error(res, "Validation failed", validationError, 400);
    }

    const record = await Role.findByPk(req.params.id, { transaction: t });
    if (!record) {
      await t.rollback();
      return error(res, "❌ Role not found", null, 404);
    }

    let orgId = record.organization_id;
    let facilityId = record.facility_id;

    if (isSuperAdmin(req.user)) {
      if ("organization_id" in value) orgId = value.organization_id;
      if ("facility_id" in value) facilityId = value.facility_id;
    } else if (isOrgOwner(req.user)) {
      orgId = req.user.organization_id;
      if ("facility_id" in value) facilityId = value.facility_id;
    } else if (isFacilityHead(req.user)) {
      orgId = req.user.organization_id;
      facilityId = req.user.facility_id;
    } else {
      orgId = req.user.organization_id;
      facilityId = req.user.facility_id ?? record.facility_id;
    }

    await record.update(
      {
        ...value,
        organization_id: orgId,
        facility_id: facilityId,
        updated_by_id: req.user?.id || null,
        ...(value.is_system !== undefined
          ? { role_type: value.is_system ? "system" : "custom" }
          : {}),
      },
      { transaction: t }
    );

    await t.commit();

    const full = await Role.findByPk(record.id, {
      include: ROLE_INCLUDES,
    });

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "update",
      entityId: record.id,
      entity: full,
    });

    return success(res, "✅ Role updated", full);
  } catch (err) {
    await t.rollback();
    debug.error("update → FAILED", err);
    return error(res, "❌ Failed to update role", err);
  }
};

/* ============================================================
   📌 GET ALL ROLES (MASTER PARITY + SUMMARY)
============================================================ */
export const getAllRoles = async (req, res) => {
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

    debug.log("list → raw query", req.query);

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
       🔐 TENANT / BASE SCOPE
    ======================================================== */
    if (!isSuperAdmin(req.user)) {
      // Organization lock
      options.where[Op.and].push({
        organization_id: req.user.organization_id,
      });

      // Non-super users never see system roles
      options.where[Op.and].push({
        role_type: { [Op.ne]: "system" },
      });

      // Facility scope
      if (!isOrgOwner(req.user)) {
        options.where[Op.and].push({
          [Op.or]: [
            { facility_id: null },
            { facility_id: req.user.facility_id },
          ],
        });
      }
    } else {
      // Super admin optional scope
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
       🔍 GLOBAL SEARCH (SAFE)
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
       📌 ROLE TYPE FILTER (DB FILTER → req.query)
    ======================================================== */
    if (req.query.role_type) {
      options.where[Op.and].push({
        role_type: req.query.role_type,
      });
    }

    /* ========================================================
       📌 STATUS FILTER (DB FILTER → req.query, ENUM SAFE)
    ======================================================== */
    if (req.query.status && Object.values(ROLE_STATUS).includes(req.query.status)) {
      options.where[Op.and].push({
        status: req.query.status,
      });
    }

    /* ========================================================
       📦 QUERY EXECUTION
    ======================================================== */
    const { count, rows } = await Role.findAndCountAll({
      where: options.where,
      include: ROLE_INCLUDES,
      order: options.order,
      offset: options.offset,
      limit: options.limit,
    });

    /* ========================================================
       📊 SUMMARY (FILTER-AWARE, PAGE-BASED)
    ======================================================== */
    const summary = {
      total: count,
      active: rows.filter(r => r.status === "active").length,
      inactive: rows.filter(r => r.status === "inactive").length,
    };

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
    return success(res, "✅ Roles loaded", {
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
    return error(res, "❌ Failed to load roles", err);
  }
};


/* ============================================================
   📌 GET ROLE BY ID
============================================================ */
export const getRoleById = async (req, res) => {
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

      where.role_type = { [Op.ne]: "system" };
    } else {
      if (req.query.organization_id)
        where.organization_id = req.query.organization_id;
      if (req.query.facility_id)
        where.facility_id = req.query.facility_id;
    }

    const found = await Role.findOne({
      where,
      include: ROLE_INCLUDES,
    });

    if (!found) return error(res, "❌ Role not found", null, 404);

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "view",
      entityId: id,
      entity: found,
    });

    return success(res, "✅ Role loaded", found);
  } catch (err) {
    debug.error("view → FAILED", err);
    return error(res, "❌ Failed to load role", err);
  }
};

/* ============================================================
   📌 GET ROLES LITE (AUTOCOMPLETE)
============================================================ */
export const getAllRolesLite = async (req, res) => {
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module: MODULE_KEY,
      action: "read",
      res,
    });
    if (!allowed) return;

    const { q, organization_id, facility_id } = req.query;

    const where = {
      status: ROLE_STATUS.ACTIVE,
      [Op.and]: [],
    };

    if (organization_id && /^[0-9a-f-]{36}$/i.test(organization_id)) {
      where.organization_id = organization_id;
    } else if (!isSuperAdmin(req.user)) {
      where.organization_id = req.user.organization_id;
    }

    if (!isSuperAdmin(req.user)) {
      where[Op.and].push({
        [Op.or]: [
          { facility_id: null },
          ...(facility_id && /^[0-9a-f-]{36}$/i.test(facility_id)
            ? [{ facility_id }]
            : []),
        ],
      });
    }

    if (!isSuperAdmin(req.user)) {
      where.role_type = { [Op.ne]: "system" };
    }

    if (q) {
      where[Op.and].push({
        [Op.or]: [
          { name: { [Op.iLike]: `%${q}%` } },
          { code: { [Op.iLike]: `%${q}%` } },
          { description: { [Op.iLike]: `%${q}%` } },
        ],
      });
    }

    const roles = await Role.findAll({
      where,
      attributes: ["id", "name", "code", "description", "role_type"],
      order: [["name", "ASC"]],
      limit: 50,
    });

    const result = roles.map(r => ({
      id: r.id,
      name: r.name,
      code: r.code || "",
      description: r.description || "",
      is_system: r.role_type === "system",
    }));

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "list_lite",
      details: {
        count: result.length,
        q: q || null,
        organization_id: where.organization_id || null,
        facility_id: facility_id || null,
      },
    });

    return success(res, "✅ Roles loaded (lite)", { records: result });
  } catch (err) {
    debug.error("list_lite → FAILED", err);
    return error(res, "❌ Failed to load roles (lite)", err);
  }
};

/* ============================================================
   📌 TOGGLE ROLE STATUS
============================================================ */
export const toggleRoleStatus = async (req, res) => {
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

      where.role_type = { [Op.ne]: "system" };
    } else {
      if (req.query.organization_id)
        where.organization_id = req.query.organization_id;
      if (req.query.facility_id)
        where.facility_id = req.query.facility_id;
    }

    const role = await Role.findOne({ where });
    if (!role) return error(res, "❌ Role not found", null, 404);

    if (role.role_type === "system" && !isSuperAdmin(req.user)) {
      return error(res, "❌ Cannot toggle a system role", null, 403);
    }

    const { ACTIVE, INACTIVE } = ROLE_STATUS;
    const newStatus = role.status === ACTIVE ? INACTIVE : ACTIVE;

    await role.update({
      status: newStatus,
      updated_by_id: req.user.id,
    });

    const full = await Role.findOne({
      where: { id },
      include: ROLE_INCLUDES,
    });

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "toggle_status",
      entityId: id,
      entity: full,
      details: { from: role.status, to: newStatus },
    });

    return success(res, `✅ Role status set to ${newStatus}`, full);
  } catch (err) {
    debug.error("toggle_status → FAILED", err);
    return error(res, "❌ Failed to toggle role status", err);
  }
};

/* ============================================================
   📌 DELETE ROLE
   (MASTER-PARITY, SAFE SOFT DELETE + AUDIT)
============================================================ */
export const deleteRole = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    debug.log("delete → incoming", {
      id: req.params.id,
      query: req.query,
    });

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
       🔐 SCOPE ENFORCEMENT
    ======================================================== */
    if (!isSuperAdmin(req.user)) {
      where.organization_id = req.user.organization_id;

      if (isFacilityHead(req.user)) {
        where.facility_id = req.user.facility_id;
      }

      where.role_type = { [Op.ne]: "system" };
    } else {
      if (req.query.organization_id) {
        where.organization_id = req.query.organization_id;
      }
      if (req.query.facility_id) {
        where.facility_id = req.query.facility_id;
      }
    }

    const role = await Role.findOne({
      where,
      transaction: t,
    });

    if (!role) {
      await t.rollback();
      return error(res, "❌ Role not found", null, 404);
    }

    if (role.role_type === "system" && !isSuperAdmin(req.user)) {
      await t.rollback();
      return error(res, "❌ Cannot delete a system role", null, 403);
    }

    /* ========================================================
       🗑️ SOFT DELETE (AUDIT SAFE)
    ======================================================== */
    await role.update(
      { deleted_by_id: req.user?.id || null },
      { transaction: t }
    );

    await role.destroy({ transaction: t });
    await t.commit();

    const full = await Role.findOne({
      where: { id },
      include: ROLE_INCLUDES,
      paranoid: false,
    });

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "delete",
      entityId: id,
      entity: full,
    });

    return success(res, "✅ Role deleted", full);
  } catch (err) {
    await t.rollback();
    debug.error("delete → FAILED", err);
    return error(res, "❌ Failed to delete role", err);
  }
};
