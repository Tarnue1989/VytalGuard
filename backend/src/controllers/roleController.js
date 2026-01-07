// 📁 controllers/roleController.js
import Joi from "joi";
import { Op } from "sequelize";
import { sequelize, Role, User, Facility, Organization } from "../models/index.js";
import { success, error } from "../utils/response.js";
import { ROLE_STATUS } from "../constants/enums.js";
import { authzService } from "../services/authzService.js";
import { auditService } from "../services/auditService.js";
import { isSuperAdmin, isOrgOwner, isFacilityHead } from "../utils/role-utils.js";
import { buildQueryOptions } from "../utils/queryHelper.js";
import {
  syncOrgAdminForRole
} from "../services/roleProvisioningService.js";

const MODULE_KEY = "roles";

/* ============================================================
   🔗 SHARED INCLUDES (LEFT JOIN SAFE)
============================================================ */
const ROLE_INCLUDES = [
  {
    model: Organization,
    as: "organization",
    attributes: ["id", "name", "code"],
    required: false, // ✅ KEEP roles even if org is NULL
  },
  {
    model: Facility,
    as: "facility",
    attributes: ["id", "name", "code", "organization_id"],
    required: false, // ✅ CRITICAL: keep org-only roles
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

  // CREATE vs UPDATE rules
  if (mode === "create") {
    base.name = base.name.required();
    base.is_system = base.is_system.default(false);
    base.requires_facility = base.requires_facility.default(false);
  } else {
    base.status = Joi.string().valid(...ROLE_STATUS).optional();
    Object.keys(base).forEach((k) => (base[k] = base[k].optional()));
  }

  /* ============================================================
     🧭 SCOPE RULES
  ============================================================ */

  // 👑 Superadmin: may set org + facility explicitly
  if (isSuper) {
    base.organization_id = Joi.string().uuid().allow(null).optional();
    base.facility_id = Joi.string().uuid().allow(null).optional();
  }
  // 🏢 Org-level users (organization_admin / org_owner)
  // ✔ Org is enforced in controller
  // ✔ Facility is OPTIONAL but MUST NOT be stripped
  else {
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
    console.log("🟡 [CREATE ROLE] RAW req.body:", req.body);
    console.log("🟡 [CREATE ROLE] USER:", {
      id: req.user.id,
      org: req.user.organization_id,
      fac: req.user.facility_id,
      roles: req.user.roles,
    });

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

    console.log("🟡 [CREATE ROLE] VALIDATED value:", value);

    if (validationError) {
      await t.rollback();
      return error(res, "Validation failed", validationError, 400);
    }

    if (value.is_system && !isSuperAdmin(req.user)) {
      await t.rollback();
      return error(res, "❌ Only superadmin can create system roles", null, 403);
    }

    /* ============================================================
       🧭 SCOPE RESOLUTION
    ============================================================ */
    let orgId = null;
    let facilityId = null;

    if (isSuperAdmin(req.user)) {
      if (!value.is_system) {
        orgId = "organization_id" in value ? value.organization_id : null;
        facilityId = "facility_id" in value ? value.facility_id : null;
      }
    } else if (isOrgOwner(req.user)) {
      orgId = req.user.organization_id;
      facilityId = "facility_id" in value ? value.facility_id : null;
    } else if (isFacilityHead(req.user)) {
      orgId = req.user.organization_id;
      facilityId = req.user.facility_id;
    } else {
      orgId = req.user.organization_id;
      facilityId = req.user.facility_id ?? null;
    }

    console.log("🟡 [CREATE ROLE] RESOLVED SCOPE:", {
      organization_id: orgId,
      facility_id: facilityId,
    });

    if (!value.is_system && !orgId) {
      await t.rollback();
      return error(res, "Missing organization assignment", null, 400);
    }

    /* ============================================================
       🚫 UNIQUENESS CHECK
    ============================================================ */
    const exists = await Role.findOne({
      where: {
        organization_id: orgId,
        facility_id: facilityId,
        name: value.name,
      },
      paranoid: false,
    });

    if (exists) {
      await t.rollback();
      return error(res, "Role already exists in this scope", null, 400);
    }

    /* ============================================================
       ✅ CREATE ROLE
    ============================================================ */
    const payloadToSave = {
      ...value,
      organization_id: orgId,
      facility_id: facilityId,
      role_type: value.is_system ? "system" : "custom",
      created_by_id: req.user.id,
    };

    console.log("🟢 [CREATE ROLE] FINAL SAVE PAYLOAD:", payloadToSave);

    const created = await Role.create(payloadToSave, { transaction: t });

    // ✅ Commit FIRST (RBAC provisioning must not be inside TX)
    await t.commit();

    /* ============================================================
       🔐 AUTO-PROVISION ORG ADMIN (MODULES + PERMISSIONS)
    ============================================================ */
    try {
      await syncOrgAdminForRole(created.id);
      console.log("🔐 [RBAC] Org admin auto-provisioned:", created.id);
    } catch (provErr) {
      // ⚠️ Do NOT fail role creation if provisioning fails
      console.error("⚠️ [RBAC] Provisioning warning:", provErr);
    }

    const full = await Role.findByPk(created.id, {
      include: ROLE_INCLUDES,
    });

    console.log("✅ [CREATE ROLE] SAVED RECORD:", {
      id: full.id,
      org: full.organization_id,
      fac: full.facility_id,
      name: full.name,
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
    console.error("🔴 [CREATE ROLE] ERROR:", err);
    return error(res, "❌ Failed to create role", err);
  }
};


/* ============================================================
   📌 UPDATE ROLE
============================================================ */
export const updateRole = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    console.log("🟡 [UPDATE ROLE] RAW req.body:", req.body);
    console.log("🟡 [UPDATE ROLE] PARAM id:", req.params.id);

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

    console.log("🟡 [UPDATE ROLE] VALIDATED value:", value);

    if (validationError) {
      await t.rollback();
      return error(res, "Validation failed", validationError, 400);
    }

    const record = await Role.findByPk(req.params.id, { transaction: t });
    if (!record) {
      await t.rollback();
      return error(res, "❌ Role not found", null, 404);
    }

    console.log("🟡 [UPDATE ROLE] BEFORE UPDATE:", {
      org: record.organization_id,
      fac: record.facility_id,
    });

    let orgId = record.organization_id;
    let facilityId = record.facility_id;

    if (isSuperAdmin(req.user)) {
      if ("organization_id" in value) orgId = value.organization_id;
      if ("facility_id" in value) facilityId = value.facility_id;
    } 
    else if (isOrgOwner(req.user)) {
      orgId = req.user.organization_id;
      if ("facility_id" in value) facilityId = value.facility_id;
    } 
    else if (isFacilityHead(req.user)) {
      orgId = req.user.organization_id;
      facilityId = req.user.facility_id;
    } 
    else {
      orgId = req.user.organization_id;
      facilityId = req.user.facility_id ?? record.facility_id;
    }

    console.log("🟡 [UPDATE ROLE] RESOLVED SCOPE:", {
      organization_id: orgId,
      facility_id: facilityId,
    });

    const updatePayload = {
      ...value,
      organization_id: orgId,
      facility_id: facilityId,
      updated_by_id: req.user.id,
      ...(value.is_system !== undefined
        ? { role_type: value.is_system ? "system" : "custom" }
        : {}),
    };

    console.log("🟢 [UPDATE ROLE] FINAL UPDATE PAYLOAD:", updatePayload);

    await record.update(updatePayload, { transaction: t });
    await t.commit();

    const full = await Role.findByPk(record.id, {
      include: ROLE_INCLUDES,
    });

    console.log("✅ [UPDATE ROLE] AFTER SAVE:", {
      org: full.organization_id,
      fac: full.facility_id,
      name: full.name,
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
    console.error("🔴 [UPDATE ROLE] ERROR:", err);
    return error(res, "❌ Failed to update role", err);
  }
};


/* ============================================================
   📌 GET ALL ROLES
============================================================ */
export const getAllRoles = async (req, res) => {
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module: "role",
      action: "read",
      res,
    });
    if (!allowed) return;

    const options = buildQueryOptions(req, "name", "ASC");

    // 🔹 Always normalize WHERE into AND container
    options.where = { [Op.and]: [] };

    /* ============================================================
       🔐 BASE SCOPE
    ============================================================ */
    if (!isSuperAdmin(req.user)) {
      // 🔒 Always restrict to user's organization
      options.where[Op.and].push(
        { organization_id: req.user.organization_id },
        { role_type: { [Op.ne]: "system" } }
      );

      // 🧭 Facility visibility rules
      if (!isOrgOwner(req.user)) {
        // Facility-scoped users see:
        //  • org-wide roles (facility_id = NULL)
        //  • roles for THEIR facility only
        options.where[Op.and].push({
          [Op.or]: [
            { facility_id: null },
            { facility_id: req.user.facility_id },
          ],
        });
      }
      // ✅ Org owners / org admins:
      //  • see ALL roles in the organization
      //  • NO facility filter applied
    } else {
      // 👑 Superadmin optional filters
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

    /* ============================================================
       🔍 SEARCH (SAFE – does NOT overwrite scope)
    ============================================================ */
    if (options.search) {
      options.where[Op.and].push({
        [Op.or]: [
          { name: { [Op.iLike]: `%${options.search}%` } },
          { code: { [Op.iLike]: `%${options.search}%` } },
          { description: { [Op.iLike]: `%${options.search}%` } },
        ],
      });
    }

    /* ============================================================
       📦 QUERY
    ============================================================ */
    const { count, rows } = await Role.findAndCountAll({
      where: options.where,
      include: ROLE_INCLUDES,
      order: options.order,
      offset: options.offset,
      limit: options.limit,
    });

    await auditService.logAction({
      user: req.user,
      module: "role",
      action: "list",
      details: { query: req.query, returned: count },
    });

    return success(res, "✅ Roles loaded", {
      records: rows,
      pagination: {
        total: count,
        page: options.pagination.page,
        pageCount: Math.ceil(count / options.pagination.limit),
      },
    });
  } catch (err) {
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
      module: "role",
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
      module: "role",
      action: "view",
      entityId: id,
      entity: found,
    });

    return success(res, "✅ Role loaded", found);
  } catch (err) {
    return error(res, "❌ Failed to load role", err);
  }
};

/* ============================================================
   📌 GET ROLES LITE (Autocomplete)
   - Used by forms (Create User, Assign Role, Role Permission, etc.)
   - MUST include org-only roles (facility_id = NULL)
============================================================ */
export const getAllRolesLite = async (req, res) => {
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module: "role",
      action: "read",
      res,
    });
    if (!allowed) return;

    const { q, organization_id, facility_id } = req.query;

    /* ============================================================
       🧱 BASE WHERE (ACTIVE ROLES ONLY)
    ============================================================ */
    const where = {
      status: ROLE_STATUS[0], // usually "active"
      [Op.and]: [],
    };

    /* ============================================================
       🏢 ORGANIZATION SCOPE
       Priority:
       1️⃣ UI-selected organization
       2️⃣ User organization (non-superadmin)
       3️⃣ No org filter (superadmin)
    ============================================================ */
    if (organization_id && /^[0-9a-f-]{36}$/i.test(organization_id)) {
      where.organization_id = organization_id;
    } else if (!isSuperAdmin(req.user)) {
      where.organization_id = req.user.organization_id;
    }

    /* ============================================================
       🏥 FACILITY VISIBILITY (🔥 CRITICAL FIX 🔥)
       RULES:
       - Org-only roles (facility_id = NULL) must ALWAYS be visible
       - Facility roles only when facility is known
       - Superadmin ignores facility entirely
    ============================================================ */
    if (!isSuperAdmin(req.user)) {
      where[Op.and].push({
        [Op.or]: [
          // ✅ ORG-LEVEL ROLES (NO FACILITY)
          { facility_id: null },

          // ✅ FACILITY ROLES (ONLY WHEN FACILITY IS KNOWN)
          ...(facility_id && /^[0-9a-f-]{36}$/i.test(facility_id)
            ? [{ facility_id }]
            : []),
        ],
      });
    }

    /* ============================================================
       🔒 SYSTEM ROLE VISIBILITY
       - Only superadmin can see system roles
    ============================================================ */
    if (!isSuperAdmin(req.user)) {
      where.role_type = { [Op.ne]: "system" };
    }

    /* ============================================================
       🔍 TEXT SEARCH (SAFE – DOES NOT BREAK SCOPE)
    ============================================================ */
    if (q) {
      where[Op.and].push({
        [Op.or]: [
          { name: { [Op.iLike]: `%${q}%` } },
          { code: { [Op.iLike]: `%${q}%` } },
          { description: { [Op.iLike]: `%${q}%` } },
        ],
      });
    }

    /* ============================================================
       📦 QUERY
    ============================================================ */
    const roles = await Role.findAll({
      where,
      attributes: ["id", "name", "code", "description", "role_type"],
      order: [["name", "ASC"]],
      limit: 50,
    });

    const result = roles.map((r) => ({
      id: r.id,
      name: r.name,
      code: r.code || "",
      description: r.description || "",
      is_system: r.role_type === "system",
    }));

    await auditService.logAction({
      user: req.user,
      module: "role",
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
    console.error("❌ getAllRolesLite ERROR:", err);
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
      module: "role",
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

    const [ACTIVE, INACTIVE] = ROLE_STATUS;
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
      module: "role",
      action: "toggle_status",
      entityId: id,
      entity: full,
      details: { from: role.status, to: newStatus },
    });

    return success(res, `✅ Role status set to ${newStatus}`, full);
  } catch (err) {
    return error(res, "❌ Failed to toggle role status", err);
  }
};

/* ============================================================
   📌 DELETE ROLE
============================================================ */
export const deleteRole = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module: "role",
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

      where.role_type = { [Op.ne]: "system" };
    } else {
      if (req.query.organization_id)
        where.organization_id = req.query.organization_id;
      if (req.query.facility_id)
        where.facility_id = req.query.facility_id;
    }

    const role = await Role.findOne({ where, transaction: t });
    if (!role) {
      await t.rollback();
      return error(res, "❌ Role not found", null, 404);
    }

    if (role.role_type === "system" && !isSuperAdmin(req.user)) {
      await t.rollback();
      return error(res, "❌ Cannot delete a system role", null, 403);
    }

    await role.update(
      { deleted_by_id: req.user.id },
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
      module: "role",
      action: "delete",
      entityId: id,
      entity: full,
    });

    return success(res, "✅ Role deleted", full);
  } catch (err) {
    await t.rollback();
    return error(res, "❌ Failed to delete role", err);
  }
};
