// 📁 controllers/userController.js
// ============================================================================
// 👤 USER CONTROLLER — MASTER UPGRADE (STEP 1: IMPORT → SCHEMA)
// ============================================================================

import Joi from "joi";
import { Op } from "sequelize";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import crypto from "crypto";

import {
  sequelize,
  User,
  Facility,
  Role,
  UserFacility,
  PasswordHistory,
  RefreshToken,
  Organization
} from "../models/index.js";

import { success, error } from "../utils/response.js";
import { buildQueryOptions } from "../utils/queryHelper.js";
import { normalizeDateRangeLocal } from "../utils/date-utils.js";
import { validate } from "../utils/validation.js";
import { resolveOrgFacility } from "../utils/resolveOrgFacility.js";
import { resolveTenantScopeLite } from "../utils/resolveTenantScopeLite.js";
import { applyTenantWhere } from "../utils/setTenantScope.js";
import {
  isSuperAdmin,
  isOrgLevelUser,
  isFacilityHead
} from "../utils/role-utils.js";
import { makeModuleLogger } from "../utils/debugLogger.js";

import { USER_STATUS } from "../constants/enums.js";
import { FIELD_VISIBILITY_USER } from "../constants/fieldVisibility.js";

import { authzService } from "../services/authzService.js";
import { auditService } from "../services/auditService.js";

/* ============================================================
   🔐 MODULE
============================================================ */
const MODULE_KEY = "users";

/* ============================================================
   🔧 DEBUG LOGGER
============================================================ */
const DEBUG_OVERRIDE = false;
const debug = makeModuleLogger("userController", DEBUG_OVERRIDE);

/* ============================================================
   🔗 SHARED INCLUDES (MASTER)
============================================================ */
const USER_INCLUDES = [
  {
    model: Facility,
    as: "facilities",
    attributes: ["id", "name", "code", "organization_id"],
    through: { attributes: [] },
    required: false,
  },
  {
    model: Role,
    as: "roles",
    attributes: ["id", "name", "requires_facility"],
    through: { attributes: [] },
    required: false,
  },
  {
    model: Organization,
    as: "organization",
    attributes: ["id", "name", "code"],
  },
  {
    model: User,
    as: "createdByUser",
    attributes: ["id", "first_name", "last_name", "username"],
  },
  {
    model: User,
    as: "updatedByUser",
    attributes: ["id", "first_name", "last_name", "username"],
  },
  {
    model: User,
    as: "deletedByUser",
    attributes: ["id", "first_name", "last_name", "username"],
  },
];

/* ============================================================
   📋 JOI SCHEMA BUILDER (DEPARTMENT STYLE - CLEAN)
============================================================ */
function buildUserSchema(mode = "create", userRole = "staff") {
  const base = {
    username: Joi.string().max(80),
    email: Joi.string().email().max(150),
    password: Joi.string().min(6),

    first_name: Joi.string().max(150).allow("", null),
    last_name: Joi.string().max(150).allow("", null),

    status: Joi.string().valid(...USER_STATUS),

    // ✅ NEW (flat structure)
    role_id: Joi.string().uuid(),

    // ✅ scope fields (controlled by role)
    organization_id: Joi.string().uuid().optional(),
    facility_id: Joi.string().uuid().allow(null).optional(),
  };

  /* ================= CREATE ================= */
  if (mode === "create") {
    base.username = base.username.required();
    base.email = base.email.required();
    base.password = base.password.required();

    base.role_id = base.role_id.required();   // 🔥 REQUIRED now
    base.status = base.status.default("active");
  }

  /* ================= UPDATE ================= */
  if (mode === "update") {
    Object.keys(base).forEach((k) => {
      base[k] = base[k].optional();
    });
  }

  /* ============================================================
     🔐 ROLE-BASED CONTROL (LIKE DEPARTMENT)
  ============================================================ */

  // 🔹 SUPERADMIN → can send org + facility
  if (userRole === "superadmin") {
    // allow both (already optional)
  }

  // 🔹 ORG LEVEL → cannot send org
  else if (["organization_admin", "org_admin", "org_owner"].includes(userRole)) {
    base.organization_id = Joi.forbidden();   // 🔥 force backend to use req.user
  }

  // 🔹 FACILITY LEVEL → cannot send org or facility
  else {
    base.organization_id = Joi.forbidden();
    base.facility_id = Joi.forbidden();
  }

  return Joi.object(base);
}
/* ============================================================
   📌 CREATE USER — FINAL (DEPARTMENT STYLE)
============================================================ */
export const createUser = async (req, res) => {
  const t = await sequelize.transaction();

  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module_key: MODULE_KEY,
      action: "create",
      res,
    });
    if (!allowed) return;

    debug.log("createUser → incoming body", req.body);

    const { value, errors } = validate(
      buildUserSchema("create", req.user?.roleNames?.[0]),
      req.body
    );

    if (errors) {
      await t.rollback();
      return error(res, "Validation failed", errors, 400);
    }

    /* ========================================================
       🧭 ROLE-BASED SCOPE (LIKE DEPARTMENT)
    ======================================================== */
    let orgId = null;
    let facilityId = null;

    if (isSuperAdmin(req.user)) {
      orgId = value.organization_id;
      facilityId = value.facility_id || null;

    } else if (isOrgLevelUser(req.user)) {
      orgId = req.user.organization_id;
      facilityId = value.facility_id || null;

    } else {
      orgId = req.user.organization_id;
      facilityId = req.user.facility_id ?? null;
    }

    if (!orgId) {
      await t.rollback();
      return error(res, "Missing organization assignment", null, 400);
    }

    /* ================= PASSWORD ================= */
    const password_hash = await bcrypt.hash(value.password, 10);
    delete value.password;

    /* ================= CREATE USER ================= */
    const user = await User.create(
      {
        username: value.username,
        email: value.email,
        password_hash,
        first_name: value.first_name,
        last_name: value.last_name,
        status: value.status,
        organization_id: orgId,
        created_by_id: req.user?.id || null,
      },
      { transaction: t }
    );

    /* ================= CREATE ROLE LINK ================= */
    await UserFacility.create(
      {
        user_id: user.id,
        organization_id: orgId,
        facility_id: facilityId,
        role_id: value.role_id,
        created_by_id: req.user?.id || null,
      },
      { transaction: t }
    );

    await t.commit();

    const full = await User.findOne({
      where: { id: user.id },
      include: USER_INCLUDES,
    });

    await auditService.logAction({
      user: req.user,
      module_key: MODULE_KEY,
      action: "create",
      entityId: user.id,
      entity: full,
    });

    return success(res, "✅ User created", full);

  } catch (err) {
    await t.rollback();
    debug.error("createUser → FAILED", err);
    return error(res, "❌ Failed to create user", err);
  }
};

/* ============================================================
   📌 UPDATE USER — FINAL (DEPARTMENT STYLE)
============================================================ */
export const updateUser = async (req, res) => {
  const t = await sequelize.transaction();

  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module_key: MODULE_KEY,
      action: "update",
      res,
    });
    if (!allowed) return;

    debug.log("updateUser → incoming body", req.body);

    const { value, errors } = validate(
      buildUserSchema("update", req.user?.roleNames?.[0]),
      req.body
    );

    if (errors) {
      await t.rollback();
      return error(res, "Validation failed", errors, 400);
    }

    const record = await User.findByPk(req.params.id, {
      transaction: t,
    });

    if (!record) {
      await t.rollback();
      return error(res, "User not found", null, 404);
    }

    /* ========================================================
       🧭 ROLE-BASED SCOPE
    ======================================================== */
    let orgId = null;
    let facilityId = null;

    if (isSuperAdmin(req.user)) {
      orgId = value.organization_id;
      facilityId = value.facility_id || null;

    } else if (isOrgLevelUser(req.user)) {
      orgId = req.user.organization_id;
      facilityId = value.facility_id || null;

    } else {
      orgId = req.user.organization_id;
      facilityId = req.user.facility_id ?? null;
    }

    /* ================= PASSWORD ================= */
    if (value.password) {
      value.password_hash = await bcrypt.hash(value.password, 10);
      delete value.password;
    }

    /* ================= UPDATE USER ================= */
    await record.update(
      {
        ...value,
        organization_id: orgId || record.organization_id,
        updated_by_id: req.user?.id || null,
      },
      { transaction: t }
    );

    /* ================= UPDATE ROLE LINK ================= */
    await UserFacility.destroy({
      where: { user_id: record.id },
      force: true,
      transaction: t,
    });

    await UserFacility.create(
      {
        user_id: record.id,
        organization_id: orgId,
        facility_id: facilityId,
        role_id: value.role_id,
        created_by_id: req.user?.id || null,
      },
      { transaction: t }
    );

    await t.commit();

    const full = await User.findOne({
      where: { id: record.id },
      include: USER_INCLUDES,
    });

    await auditService.logAction({
      user: req.user,
      module_key: MODULE_KEY,
      action: "update",
      entityId: record.id,
      entity: full,
    });

    return success(res, "✅ User updated", full);

  } catch (err) {
    await t.rollback();
    debug.error("updateUser → FAILED", err);
    return error(res, "❌ Failed to update user", err);
  }
};


/* ============================================================
   📌 GET ALL USERS — FINAL MASTER (ABSOLUTE SAFE)
============================================================ */
export const getAllUsers = async (req, res) => {
  try {
    /* ========================================================
       🔐 AUTHORIZATION
    ======================================================== */
    const allowed = await authzService.checkPermission({
      user: req.user,
      module_key: MODULE_KEY,
      action: "read",
      res,
    });
    if (!allowed) return;

    /* ========================================================
       👤 ROLE + FIELD VISIBILITY
    ======================================================== */
    const role =
      (req.user?.roleNames?.[0] || "staff")
        .toLowerCase()
        .replace(/\s+/g, "");

    const visibleFields =
      FIELD_VISIBILITY_USER[role] || FIELD_VISIBILITY_USER.staff;

    /* ========================================================
       ⚙️ BASE QUERY OPTIONS
    ======================================================== */
    const options = buildQueryOptions(req, "username", "ASC", visibleFields);

    /* ========================================================
       🚫 REMOVE INVALID / RELATION / VIRTUAL / SENSITIVE
    ======================================================== */
    const FORBIDDEN_FIELDS = [
      "password",
      "password_hash",
      "full_name",
      "organization",   // 🔥 FIX
      "facility",
      "facilities",
      "roles",
      "permissions",
    ];

    if (options.attributes) {
      options.attributes = options.attributes.filter(
        (f) => !FORBIDDEN_FIELDS.includes(f)
      );
    }

    /* ========================================================
       🚫 FIX INVALID SORT
    ======================================================== */
    if (options.order?.length) {
      options.order = options.order.map(([field, dir]) => {
        if (FORBIDDEN_FIELDS.includes(field)) {
          return ["username", "ASC"]; // safe fallback
        }
        return [field, dir];
      });
    }

    /* ========================================================
       🧹 REMOVE UI FILTERS
    ======================================================== */
    delete options.filters?.dateRange;
    delete options.filters?.light;

    /* ========================================================
       🧱 WHERE ROOT
    ======================================================== */
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
       🔐 TENANT
    ======================================================== */
    options.where = applyTenantWhere(options.where, req, {
      useFacilityJoin: true,
    });

    /* ========================================================
       🔍 GLOBAL SEARCH (SAFE ONLY)
    ======================================================== */
    if (options.search) {
      options.where[Op.and].push({
        [Op.or]: [
          { username: { [Op.iLike]: `%${options.search}%` } },
          { email: { [Op.iLike]: `%${options.search}%` } },
          { first_name: { [Op.iLike]: `%${options.search}%` } },
          { last_name: { [Op.iLike]: `%${options.search}%` } },
        ],
      });
    }

    /* ========================================================
       📌 STATUS FILTER
    ======================================================== */
    if (req.query.status && USER_STATUS.includes(req.query.status)) {
      options.where[Op.and].push({
        status: req.query.status,
      });
    }

    /* ========================================================
       📌 ORGANIZATION FILTER (REAL COLUMN ONLY)
    ======================================================== */
    if (isSuperAdmin(req.user) && req.query.organization_id) {
      options.where[Op.and].push({
        organization_id: req.query.organization_id,
      });
    }

    /* ========================================================
       📌 FACILITY FILTER (RELATION SAFE)
    ======================================================== */
    if (req.query.facility_id) {
      options.where[Op.and].push({
        "$facilities.id$": req.query.facility_id,
      });
    }

    /* ========================================================
       📦 QUERY
    ======================================================== */
    const { count, rows } = await User.findAndCountAll({
      where: options.where,
      attributes: options.attributes
        ? [...new Set(["id", ...options.attributes])]
        : undefined,
      include: USER_INCLUDES,
      order: options.order,
      offset: options.offset,
      limit: options.limit,
      distinct: true,
      subQuery: false,
    });

    /* ========================================================
       📊 SUMMARY
    ======================================================== */
    const summary = {
      total: count,
      active: rows.filter((r) => r.status === "active").length,
      inactive: rows.filter((r) => r.status === "inactive").length,
      suspended: rows.filter((r) => r.status === "suspended").length,
    };

    /* ========================================================
       🧾 AUDIT
    ======================================================== */
    await auditService.logAction({
      user: req.user,
      module_key: MODULE_KEY,
      action: "list",
      details: {
        query: req.query,
        returned: count,
        dateRange: dateRange || null,
      },
    });

    /* ========================================================
       ✅ RESPONSE
    ======================================================== */
    return success(res, "✅ Users loaded", {
      records: rows,
      summary,
      pagination: {
        total: count,
        page: options.pagination.page,
        pageCount: Math.ceil(count / options.pagination.limit),
      },
    });

  } catch (err) {
    debug.error("getAllUsers → FAILED", err);
    return error(res, "❌ Failed to load users", err);
  }
};
/* ============================================================
   📌 GET ALL USERS LITE — MASTER (FINAL)
============================================================ */
export const getAllUsersLite = async (req, res) => {
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module_key: MODULE_KEY,
      action: "read",
      res,
    });
    if (!allowed) return;

    const { q } = req.query;

    /* ================= TENANT ================= */
    const { orgId, facilityId } = resolveTenantScopeLite({
      user: req.user,
      query: req.query,
    });

    /* ================= BASE WHERE ================= */
    const where = {
      status: "active",
      [Op.and]: [],
    };

    if (orgId) {
      where.organization_id = orgId;
    }

    if (!isSuperAdmin(req.user)) {
      if (!isOrgLevelUser(req.user)) {
        if (facilityId) {
          where[Op.and].push({
            [Op.or]: [
              { "$facilities.id$": facilityId },
              { "$facilities.id$": null },
            ],
          });
        }
      }
    } else {
      if (facilityId) {
        where[Op.and].push({
          "$facilities.id$": facilityId,
        });
      }
    }

    /* ================= SEARCH ================= */
    if (q) {
      where[Op.and].push({
        [Op.or]: [
          { username: { [Op.iLike]: `%${q}%` } },
          { email: { [Op.iLike]: `%${q}%` } },
          { first_name: { [Op.iLike]: `%${q}%` } },
          { last_name: { [Op.iLike]: `%${q}%` } },
        ],
      });
    }

    /* ================= QUERY ================= */
    const rows = await User.findAll({
      where,
      attributes: ["id", "username", "email", "first_name", "last_name"],
      include: [
        {
          model: Facility,
          as: "facilities",
          attributes: ["id", "organization_id"],
          through: { attributes: [] },
          required: false,
        },
      ],
      order: [["username", "ASC"]],
      limit: 20,
      subQuery: false,
      distinct: true,
    });

    /* ================= FORMAT ================= */
    const records = rows.map((u) => ({
      id: u.id,
      username: u.username,
      email: u.email || "",
      full_name: [u.first_name, u.last_name]
        .filter(Boolean)
        .join(" ")
        .trim(),
    }));

    /* ================= AUDIT ================= */
    await auditService.logAction({
      user: req.user,
      module_key: MODULE_KEY,
      action: "list_lite",
      details: {
        count: records.length,
        q: q || null,
      },
    });

    /* ================= RESPONSE ================= */
    return success(res, "✅ Users loaded (lite)", { records });

  } catch (err) {
    debug.error("getAllUsersLite → FAILED", err);
    return error(res, "❌ Failed to load users (lite)", err);
  }
};

/* ============================================================
   📌 GET USER BY ID — MASTER (FINAL)
============================================================ */
export const getUserById = async (req, res) => {
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module_key: MODULE_KEY,
      action: "read",
      res,
    });
    if (!allowed) return;

    const { id } = req.params;

    const role =
      (req.user?.roleNames?.[0] || "staff")
        .toLowerCase()
        .replace(/\s+/g, "");

    const visibleFields =
      FIELD_VISIBILITY_USER[role] || FIELD_VISIBILITY_USER.staff;

    /* ================= BASE WHERE ================= */
    const where = {
      [Op.and]: [{ id }],
    };

    /* ================= TENANT ================= */
    const { orgId, facilityId } = resolveTenantScopeLite({
      user: req.user,
      query: req.query,
    });

    if (!isSuperAdmin(req.user)) {
      if (orgId) {
        where[Op.and].push({ organization_id: orgId });
      }

      if (!isOrgLevelUser(req.user) && facilityId) {
        where[Op.and].push({ "$facilities.id$": facilityId });
      }
    } else {
      if (req.query.organization_id) {
        where[Op.and].push({
          organization_id: req.query.organization_id,
        });
      }

      if (req.query.facility_id) {
        where[Op.and].push({
          "$facilities.id$": req.query.facility_id,
        });
      }
    }

    /* ================= QUERY ================= */
    const record = await User.findOne({
      where,
      attributes: visibleFields,
      include: USER_INCLUDES,
    });

    if (!record) {
      return error(res, "❌ User not found", null, 404);
    }

    /* ================= AUDIT ================= */
    await auditService.logAction({
      user: req.user,
      module_key: MODULE_KEY,
      action: "view",
      entityId: id,
      entity: record,
    });

    /* ================= RESPONSE ================= */
    return success(res, "✅ User loaded", record);

  } catch (err) {
    debug.error("getUserById → FAILED", err);
    return error(res, "❌ Failed to load user", err);
  }
};

/* ============================================================
   📌 TOGGLE USER STATUS — MASTER
============================================================ */
export const toggleUserStatus = async (req, res) => {
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module_key: MODULE_KEY,
      action: "update",
      res,
    });
    if (!allowed) return;

    const { id } = req.params;

    if (req.user.id === id) {
      return error(res, "❌ Cannot disable your own account", null, 403);
    }

    const record = await User.findByPk(id, {
      paranoid: false,
      include: USER_INCLUDES,
    });

    if (!record) {
      return error(res, "❌ User not found", null, 404);
    }

    if (record.is_system) {
      return error(res, "❌ Cannot change system accounts", null, 403);
    }

    if (record.roles?.some((r) => r.name.toLowerCase().includes("superadmin"))) {
      return error(res, "❌ Cannot change superadmin accounts", null, 403);
    }

    /* ================= TENANT ================= */
    const { orgId, facilityId } = resolveTenantScopeLite({
      user: req.user,
      query: req.query,
    });

    if (!isSuperAdmin(req.user)) {
      if (orgId && record.organization_id !== orgId) {
        return error(res, "❌ Not authorized", null, 403);
      }

      if (!isOrgLevelUser(req.user)) {
        const inFacility = record.facilities?.some(
          (f) => f.id === facilityId
        );
        if (!inFacility) {
          return error(res, "❌ Not authorized", null, 403);
        }
      }
    }

    const [ACTIVE, INACTIVE] = USER_STATUS;
    const newStatus = record.status === ACTIVE ? INACTIVE : ACTIVE;
    const oldStatus = record.status;

    await record.update({
      status: newStatus,
      updated_by_id: req.user?.id || null,
    });

    await auditService.logAction({
      user: req.user,
      module_key: MODULE_KEY,
      action: "toggle_status",
      entityId: id,
      details: { from: oldStatus, to: newStatus },
    });

    return success(res, `✅ User ${newStatus}`, {
      id: record.id,
      status: newStatus,
    });
  } catch (err) {
    debug.error("toggleUserStatus → FAILED", err);
    return error(res, "❌ Failed to toggle status", err);
  }
};


/* ============================================================
   📌 DELETE USER — MASTER
============================================================ */
export const deleteUser = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module_key: MODULE_KEY,
      action: "delete",
      res,
    });
    if (!allowed) return;

    const { id } = req.params;

    if (req.user.id === id) {
      await t.rollback();
      return error(res, "❌ Cannot delete your own account", null, 403);
    }

    const record = await User.findByPk(id, {
      paranoid: false,
      include: USER_INCLUDES,
      transaction: t,
    });

    if (!record) {
      await t.rollback();
      return error(res, "❌ User not found", null, 404);
    }

    if (record.is_system) {
      await t.rollback();
      return error(res, "❌ Cannot delete system accounts", null, 403);
    }

    if (record.roles?.some((r) => r.name.toLowerCase().includes("superadmin"))) {
      await t.rollback();
      return error(res, "❌ Cannot delete superadmin accounts", null, 403);
    }

    /* ================= TENANT ================= */
    const { orgId, facilityId } = resolveTenantScopeLite({
      user: req.user,
      query: req.query,
    });

    if (!isSuperAdmin(req.user)) {
      if (orgId && record.organization_id !== orgId) {
        await t.rollback();
        return error(res, "❌ Not authorized", null, 403);
      }

      if (!isOrgLevelUser(req.user)) {
        const inFacility = record.facilities?.some(
          (f) => f.id === facilityId
        );
        if (!inFacility) {
          await t.rollback();
          return error(res, "❌ Not authorized", null, 403);
        }
      }
    }

    await record.update(
      { deleted_by_id: req.user?.id || null },
      { transaction: t }
    );

    await record.destroy({ transaction: t });

    await t.commit();

    await auditService.logAction({
      user: req.user,
      module_key: MODULE_KEY,
      action: "delete",
      entityId: id,
      entity: record,
    });

    return success(res, "✅ User deleted", { id });
  } catch (err) {
    await t.rollback();
    debug.error("deleteUser → FAILED", err);
    return error(res, "❌ Failed to delete user", err);
  }
};
/* ============================================================
   📌 RESET USER PASSWORD — MASTER
============================================================ */
export const resetUserPassword = async (req, res) => {
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module_key: MODULE_KEY,
      action: "reset-password",
      res,
    });
    if (!allowed) return;

    const { id } = req.params;

    const record = await User.findByPk(id, {
      paranoid: false,
      attributes: ["id", "organization_id"],
      include: USER_INCLUDES,
    });

    if (!record) {
      return error(res, "❌ User not found", null, 404);
    }

    /* ================= TENANT ================= */
    const { orgId, facilityId } = resolveTenantScopeLite({
      user: req.user,
      query: req.query,
    });

    if (!isSuperAdmin(req.user)) {
      if (orgId && record.organization_id !== orgId) {
        return error(res, "❌ Not authorized", null, 403);
      }

      if (!isOrgLevelUser(req.user)) {
        const inFacility = record.facilities?.some(
          (f) => f.id === facilityId
        );
        if (!inFacility) {
          return error(res, "❌ Not authorized", null, 403);
        }
      }
    }

    /* ================= RESET ================= */
    const tempPassword = `Temp-${crypto.randomBytes(4).toString("hex")}`;
    const newHash = await bcrypt.hash(tempPassword, 10);

    await record.update({
      password_hash: newHash,
      password_reset_token: null,
      password_reset_expiry: null,
      must_reset_password: true,
      login_attempts: 0,
      locked_until: null,
      updated_by_id: req.user?.id || null,
    });

    await PasswordHistory.create({
      user_id: record.id,
      password_hash: newHash,
    });

    await auditService.logAction({
      user: req.user,
      module_key: MODULE_KEY,
      action: "reset_password",
      entityId: id,
      details: { tempPassword: true },
    });

    return success(res, "✅ Password reset", {
      id: record.id,
      tempPassword,
    });
  } catch (err) {
    debug.error("resetUserPassword → FAILED", err);
    return error(res, "❌ Failed to reset password", err);
  }
};


/* ============================================================
   📌 ADMIN GENERATE RESET TOKEN — MASTER
============================================================ */
export const adminGenerateResetToken = async (req, res) => {
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module_key: MODULE_KEY,
      action: "generate-token",
      res,
    });
    if (!allowed) return;

    const { user_id } = req.body;
    if (!user_id) {
      return error(res, "❌ User ID required", null, 400);
    }

    const record = await User.findByPk(user_id, {
      paranoid: false,
      attributes: [
        "id",
        "organization_id",
        "password_reset_token",
        "password_reset_expiry",
      ],
      include: USER_INCLUDES,
    });

    if (!record) {
      return error(res, "❌ User not found", null, 404);
    }

    /* ================= TENANT ================= */
    const { orgId, facilityId } = resolveTenantScopeLite({
      user: req.user,
      query: req.query,
    });

    if (!isSuperAdmin(req.user)) {
      if (orgId && record.organization_id !== orgId) {
        return error(res, "❌ Not authorized", null, 403);
      }

      if (!isOrgLevelUser(req.user)) {
        const inFacility = record.facilities?.some(
          (f) => f.id === facilityId
        );
        if (!inFacility) {
          return error(res, "❌ Not authorized", null, 403);
        }
      }
    }

    const resetSecret =
      process.env.JWT_RESET_SECRET || process.env.JWT_SECRET;

    if (!resetSecret) {
      return error(res, "❌ Reset secret not configured", null, 500);
    }

    if (
      record.password_reset_token &&
      record.password_reset_expiry > new Date()
    ) {
      return error(
        res,
        "❌ Reset token already active",
        null,
        429
      );
    }

    const token = jwt.sign(
      { id: record.id, type: "password_reset" },
      resetSecret,
      { expiresIn: "30m" }
    );

    const expiry = new Date(Date.now() + 30 * 60 * 1000);

    await record.update({
      password_reset_token: token,
      password_reset_expiry: expiry,
      updated_by_id: req.user?.id || null,
    });

    await auditService.logAction({
      user: req.user,
      module_key: MODULE_KEY,
      action: "generate_reset_token",
      entityId: record.id,
      details: { expiry },
    });

    return success(res, "✅ Reset token generated", {
      id: record.id,
      token,
      exp: expiry,
    });
  } catch (err) {
    debug.error("adminGenerateResetToken → FAILED", err);
    return error(res, "❌ Failed to generate reset token", err);
  }
};


/* ============================================================
   📌 MANUAL RESET PASSWORD — MASTER
============================================================ */
export const manualResetPassword = async (req, res) => {
  try {
    const { email, token, newPassword } = req.body;

    if (!email || !token || !newPassword) {
      return error(res, "❌ All fields required", null, 400);
    }

    const resetSecret =
      process.env.JWT_RESET_SECRET || process.env.JWT_SECRET;

    if (!resetSecret) {
      return error(res, "❌ Reset secret not configured", null, 500);
    }

    let decoded;
    try {
      decoded = jwt.verify(token, resetSecret);
    } catch {
      return error(res, "❌ Invalid or expired token", null, 401);
    }

    const record = await User.findOne({
      where: {
        email,
        id: decoded.id,
        password_reset_token: token,
        password_reset_expiry: { [Op.gt]: new Date() },
      },
      paranoid: false,
    });

    if (!record) {
      return error(res, "❌ Invalid reset request", null, 401);
    }

    /* ================= PASSWORD HISTORY ================= */
    const last = await PasswordHistory.findAll({
      where: { user_id: record.id },
      order: [["created_at", "DESC"]],
      limit: 5,
    });

    for (const ph of last) {
      if (await bcrypt.compare(newPassword, ph.password_hash)) {
        return error(
          res,
          "❌ Cannot reuse last 5 passwords",
          null,
          400
        );
      }
    }

    const newHash = await bcrypt.hash(newPassword, 10);

    await record.update({
      password_hash: newHash,
      password_reset_token: null,
      password_reset_expiry: null,
      must_reset_password: false,
      login_attempts: 0,
      locked_until: null,
      updated_by_id: req.user?.id || null,
    });

    await PasswordHistory.create({
      user_id: record.id,
      password_hash: newHash,
    });

    await auditService.logAction({
      user: req.user,
      module_key: MODULE_KEY,
      action: "manual_reset_password",
      entityId: record.id,
      details: { email },
    });

    return success(res, "✅ Password reset successful", {
      id: record.id,
    });
  } catch (err) {
    debug.error("manualResetPassword → FAILED", err);
    return error(res, "❌ Failed to reset password", err);
  }
};


/* ============================================================
   📌 TOGGLE USER ROLE STATUS — MASTER
============================================================ */
export const toggleUserRoleStatus = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module_key: MODULE_KEY,
      action: "toggle-role",
      res,
    });
    if (!allowed) return;

    const { userId, facilityId, roleId } = req.params;

    const record = await User.findByPk(userId, {
      include: USER_INCLUDES,
      transaction: t,
    });

    if (!record) {
      await t.rollback();
      return error(res, "❌ User not found", null, 404);
    }

    const role = await Role.findByPk(roleId);
    if (!role) {
      await t.rollback();
      return error(res, "❌ Role not found", null, 404);
    }

    if (record.is_system) {
      await t.rollback();
      return error(res, "❌ Cannot modify system accounts", null, 403);
    }

    if (record.roles?.some((r) => r.name.toLowerCase().includes("superadmin"))) {
      await t.rollback();
      return error(res, "❌ Cannot modify superadmin roles", null, 403);
    }

    if (role.requires_facility && !facilityId) {
      await t.rollback();
      return error(res, "❌ Role requires facility", null, 400);
    }

    if (!role.requires_facility && facilityId) {
      await t.rollback();
      return error(res, "❌ Role cannot be tied to facility", null, 400);
    }

    /* ================= TENANT ================= */
    const { orgId, facilityId: fId } = resolveTenantScopeLite({
      user: req.user,
      query: req.query,
    });

    if (!isSuperAdmin(req.user)) {
      if (orgId && record.organization_id !== orgId) {
        await t.rollback();
        return error(res, "❌ Not authorized", null, 403);
      }

      if (!isOrgLevelUser(req.user)) {
        if (facilityId !== fId) {
          await t.rollback();
          return error(res, "❌ Not authorized", null, 403);
        }
      }
    }

    const existing = await UserFacility.findOne({
      where: {
        user_id: userId,
        facility_id: facilityId || null,
        role_id: roleId,
      },
      transaction: t,
    });

    let result;

    if (existing) {
      await existing.destroy({ transaction: t });
      result = { removed: role.id };

      await auditService.logAction({
        user: req.user,
        module_key: MODULE_KEY,
        action: "role_removed",
        entityId: userId,
        details: { role: role.name, facilityId },
      });
    } else {
      await UserFacility.create(
        {
          user_id: userId,
          facility_id: facilityId || null,
          role_id: roleId,
          created_by_id: req.user?.id || null,
        },
        { transaction: t }
      );

      result = { added: role.id };

      await auditService.logAction({
        user: req.user,
        module_key: MODULE_KEY,
        action: "role_added",
        entityId: userId,
        details: { role: role.name, facilityId },
      });
    }

    await t.commit();

    return success(res, "✅ Role toggled", result);
  } catch (err) {
    if (!t.finished) await t.rollback();
    debug.error("toggleUserRoleStatus → FAILED", err);
    return error(res, "❌ Failed to toggle role status", err);
  }
};
/* ============================================================
   📌 LOGIN — MASTER (FINAL)
============================================================ */
export const login = async (req, res) => {
  try {
    const { usernameOrEmail, password } = req.body;

    /* ================= BASIC VALIDATION ================= */
    if (!usernameOrEmail || !password) {
      return error(res, "❌ Username/email and password required", null, 400);
    }

    /* ================= FIND USER ================= */
    const record = await User.findOne({
      where: {
        [Op.or]: [
          { username: usernameOrEmail },
          { email: usernameOrEmail },
        ],
      },
      include: [
        {
          model: Role,
          as: "roles",
          attributes: ["id", "name", "requires_facility"],
          through: { attributes: [] },
        },
        {
          model: Facility,
          as: "facilities",
          attributes: ["id", "name", "organization_id"],
          through: { attributes: [] },
        },
      ],
    });

    if (!record) {
      return error(res, "❌ Invalid credentials", { code: "INVALID_CREDENTIALS" }, 401);
    }

    /* ================= SECURITY CHECKS ================= */
    if (record.is_system) {
      return error(res, "❌ System accounts cannot login", null, 403);
    }

    if (record.roles?.some((r) => r.name.toLowerCase().includes("superadmin"))) {
      return error(res, "❌ Superadmin accounts cannot login directly", null, 403);
    }

    if (record.locked_until && record.locked_until > new Date()) {
      return error(res, `❌ Account locked until ${record.locked_until}`, {
        code: "ACCOUNT_LOCKED",
        locked_until: record.locked_until,
      }, 403);
    }

    /* ================= PASSWORD CHECK ================= */
    const match = await bcrypt.compare(password, record.password_hash);

    if (!match) {
      record.login_attempts += 1;

      if (record.login_attempts >= 5) {
        record.locked_until = new Date(Date.now() + 15 * 60 * 1000);

        await record.save();

        await auditService.logAction({
          user: record,
          module_key: "auth",
          action: "login_failed_locked",
          entityId: record.id,
        });

        return error(res, "❌ Account locked for 15 minutes", {
          code: "ACCOUNT_TEMP_LOCKED",
        }, 403);
      }

      await record.save();

      await auditService.logAction({
        user: record,
        module_key: "auth",
        action: "login_failed",
        entityId: record.id,
      });

      return error(res, "❌ Invalid credentials", { code: "INVALID_CREDENTIALS" }, 401);
    }

    /* ================= PASSWORD RESET CHECK ================= */
    if (record.must_reset_password) {
      return error(res, "❌ Password reset required", {
        code: "PASSWORD_RESET_REQUIRED",
        userId: record.id,
        email: record.email,
      }, 403);
    }

    /* ================= RESET LOGIN STATE ================= */
    record.login_attempts = 0;
    record.locked_until = null;
    record.last_login_at = new Date();

    await record.save();

    /* ================= TOKEN SAFETY ================= */
    if (!process.env.JWT_SECRET) {
      return error(res, "❌ JWT secret not configured", null, 500);
    }

    /* ================= BUILD PAYLOAD ================= */
    const payload = {
      id: record.id,
      organization_id: record.organization_id,
      roles: record.roles?.map((r) => ({
        id: r.id,
        name: r.name,
        requires_facility: r.requires_facility,
      })),
      facilities: record.facilities?.map((f) => ({
        id: f.id,
        name: f.name,
        org: f.organization_id,
      })),
    };

    /* ================= SIGN TOKEN ================= */
    const token = jwt.sign(payload, process.env.JWT_SECRET, {
      expiresIn: "1h",
    });

    /* ================= AUDIT ================= */
    await auditService.logAction({
      user: record,
      module_key: "auth",
      action: "login_success",
      entityId: record.id,
    });

    /* ================= RESPONSE ================= */
    return success(res, "✅ Login successful", {
      token,
      user: payload,
    });

  } catch (err) {
    debug.error("login → FAILED", err);
    return error(res, "❌ Failed to login", { code: "LOGIN_ERROR", err });
  }
};

/* ============================================================
   📌 UNLOCK USER — MASTER
============================================================ */
export const unlockUser = async (req, res) => {
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module_key: MODULE_KEY,
      action: "unlock",
      res,
    });
    if (!allowed) return;

    const { id } = req.params;

    if (req.user.id === id) {
      return error(res, "❌ Cannot unlock your own account", null, 403);
    }

    const record = await User.findByPk(id, {
      include: USER_INCLUDES,
    });

    if (!record) {
      return error(res, "❌ User not found", null, 404);
    }

    if (record.is_system) {
      return error(res, "❌ Cannot unlock system accounts", null, 403);
    }

    if (record.roles?.some((r) => r.name.toLowerCase().includes("superadmin"))) {
      return error(res, "❌ Cannot unlock superadmin accounts", null, 403);
    }

    await record.update({
      login_attempts: 0,
      locked_until: null,
      updated_by_id: req.user?.id || null,
    });

    await auditService.logAction({
      user: req.user,
      module_key: MODULE_KEY,
      action: "unlock_account",
      entityId: record.id,
    });

    return success(res, "✅ User unlocked", { id: record.id });
  } catch (err) {
    debug.error("unlockUser → FAILED", err);
    return error(res, "❌ Failed to unlock user", err);
  }
};


/* ============================================================
   📌 REQUIRE PASSWORD RESET — MASTER
============================================================ */
export const requirePasswordReset = async (req, res) => {
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module_key: MODULE_KEY,
      action: "reset-password",
      res,
    });
    if (!allowed) return;

    const { id } = req.params;

    const record = await User.findByPk(id, {
      include: USER_INCLUDES,
    });

    if (!record) {
      return error(res, "❌ User not found", null, 404);
    }

    if (record.is_system) {
      return error(res, "❌ Cannot modify system accounts", null, 403);
    }

    if (record.roles?.some((r) => r.name.toLowerCase().includes("superadmin"))) {
      return error(res, "❌ Cannot force reset on superadmin", null, 403);
    }

    await record.update({
      must_reset_password: true,
      updated_by_id: req.user?.id || null,
    });

    await auditService.logAction({
      user: req.user,
      module_key: MODULE_KEY,
      action: "require_password_reset",
      entityId: record.id,
    });

    return success(res, "✅ Password reset required", { id: record.id });
  } catch (err) {
    debug.error("requirePasswordReset → FAILED", err);
    return error(res, "❌ Failed to require password reset", err);
  }
};


/* ============================================================
   📌 REVOKE USER SESSIONS — MASTER
============================================================ */
export const revokeUserSessions = async (req, res) => {
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module_key: MODULE_KEY,
      action: "revoke-sessions",
      res,
    });
    if (!allowed) return;

    const { id } = req.params;

    if (req.user.id === id) {
      return error(res, "❌ Cannot revoke your own sessions", null, 403);
    }

    const record = await User.findByPk(id);

    if (!record) {
      return error(res, "❌ User not found", null, 404);
    }

    if (record.is_system) {
      return error(res, "❌ Cannot revoke system sessions", null, 403);
    }

    await RefreshToken.destroy({
      where: { user_id: id },
    });

    await auditService.logAction({
      user: req.user,
      module_key: "auth",
      action: "revoke_sessions",
      entityId: record.id,
      details: { revokedBy: req.user.id },
    });

    return success(res, "✅ Sessions revoked", { id });
  } catch (err) {
    debug.error("revokeUserSessions → FAILED", err);
    return error(res, "❌ Failed to revoke sessions", err);
  }
};


/* ============================================================
   📌 PURGE USER — MASTER
============================================================ */
export const purgeUser = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module_key: MODULE_KEY,
      action: "delete",
      res,
    });
    if (!allowed) return;

    const { id } = req.params;

    const record = await User.findByPk(id, {
      paranoid: false,
      include: USER_INCLUDES,
      transaction: t,
    });

    if (!record) {
      await t.rollback();
      return error(res, "❌ User not found", null, 404);
    }

    if (record.is_system) {
      await t.rollback();
      return error(res, "❌ Cannot purge system accounts", null, 403);
    }

    if (record.roles?.some((r) => r.name.toLowerCase().includes("superadmin"))) {
      await t.rollback();
      return error(res, "❌ Cannot purge superadmin accounts", null, 403);
    }

    await UserFacility.destroy({
      where: { user_id: id },
      transaction: t,
    });

    await record.destroy({
      force: true,
      transaction: t,
    });

    await t.commit();

    await auditService.logAction({
      user: req.user,
      module_key: MODULE_KEY,
      action: "purge",
      entityId: record.id,
      details: { purgedBy: req.user.id },
    });

    return success(res, "✅ User permanently deleted", { id });
  } catch (err) {
    if (!t.finished) await t.rollback();
    debug.error("purgeUser → FAILED", err);
    return error(res, "❌ Failed to purge user", err);
  }
};