// 📁 controllers/rolePermissionController.js
import Joi from "joi";
import { Op } from "sequelize";
import {
  sequelize,
  RolePermission,
  Role,
  Permission,
  Organization,
  Facility,
  User,
} from "../models/index.js";
import { success, error } from "../utils/response.js";
import { buildQueryOptions } from "../utils/queryHelper.js";
import { authzService } from "../services/authzService.js";
import { auditService } from "../services/auditService.js";
import { isSuperAdmin, hasRole } from "../utils/role-utils.js";
import { validatePaginationStrict } from "../utils/query-utils.js";
import { resolveOrgFacility } from "../utils/resolveOrgFacility.js";

/* ============================================================
   🧩 MODULE CONFIG
   ============================================================ */
const MODULE_KEY = "role_permissions";

const ROLE_PERMISSION_INCLUDES = [
  { model: Role, as: "role", attributes: ["id", "name"], required: false },
  { model: Permission, as: "permission", attributes: ["id", "key", "name", "module", "category"], required: false },
  { model: Organization, as: "organization", attributes: ["id", "name"], required: false },
  { model: Facility, as: "facility", attributes: ["id", "name", "code"], required: false },
  { model: User, as: "createdBy", attributes: ["id", "first_name", "last_name"], required: false },
  { model: User, as: "updatedBy", attributes: ["id", "first_name", "last_name"], required: false },
  { model: User, as: "deletedBy", attributes: ["id", "first_name", "last_name"], required: false },
];


/* ============================================================
   📋 SCHEMA FACTORY
   ============================================================ */
function buildRolePermissionSchema(userRole, mode = "create") {
  const base = {
    role_id: Joi.string().uuid().required(),
    permission_id: Joi.string().uuid().optional(),
    permission_ids: Joi.array().items(Joi.string().uuid()).optional(),
  };

  if (userRole === "superadmin") {
    base.organization_id = Joi.string().uuid().optional();
    base.facility_id = Joi.string().uuid().allow(null).optional();
  } else {
    base.organization_id = Joi.forbidden();
    base.facility_id = Joi.forbidden(); // 🔥 FIX
  }
  return Joi.object(base);
}
/* ============================================================
   📌 CREATE ROLE PERMISSION (MASTER + HYBRID FACILITY)
============================================================ */
export const createRolePermission = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module: MODULE_KEY,
      action: "create",
      res,
    });
    if (!allowed) return;

  const role =
    (req.user?.roleNames?.[0] || "staff").toLowerCase();

  const schema = buildRolePermissionSchema(role, "create");
    const { error: validationError, value } = schema.validate(req.body, {
      stripUnknown: true,
    });

    if (validationError) {
      await t.rollback();
      return error(res, "Validation failed", validationError, 400);
    }

    /* ========================================================
       🧭 TENANT RESOLUTION (ORG FROM BACKEND)
    ======================================================== */
    const { orgId, facilityId: resolvedFacilityId } =
      await resolveOrgFacility({
        user: req.user,
        value,
        body: req.body,
      });

    if (!orgId) {
      await t.rollback();
      return error(res, "Missing organization assignment", null, 400);
    }

    /* ========================================================
       🏥 FACILITY (HYBRID – FRONTEND + VALIDATION)
    ======================================================== */
    let facilityId = resolvedFacilityId;

    const permissionIds = value.permission_ids || [value.permission_id];

    const createdRecords = [];

    for (const pid of permissionIds) {
      const exists = await RolePermission.findOne({
        where: {
          organization_id: orgId,
          role_id: value.role_id,
          permission_id: pid,
          facility_id: facilityId,
        },
        paranoid: false,
        transaction: t,
      });

      if (exists) continue;

      const created = await RolePermission.create(
        {
          organization_id: orgId,
          facility_id: facilityId,
          role_id: value.role_id,
          permission_id: pid,
          created_by_id: req.user?.id || null,
        },
        { transaction: t }
      );

      createdRecords.push(created);
    }

    await t.commit();

    const fullRecords = await RolePermission.findAll({
      where: { id: { [Op.in]: createdRecords.map((r) => r.id) } },
      include: ROLE_PERMISSION_INCLUDES,
    });

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "create",
      details: {
        organization_id: orgId,
        facility_id: facilityId,
        role_id: value.role_id,
        created_count: fullRecords.length,
      },
    });

    const message =
      fullRecords.length === 0
        ? "⚠️ All selected permissions already exist for this role."
        : `✅ ${fullRecords.length} role permission(s) created successfully.`;

    return success(res, message, { records: fullRecords });
  } catch (err) {
    await t.rollback();
    return error(res, "❌ Failed to create role permission", err);
  }
};
/* ============================================================
   📌 GET LITE ROLE PERMISSIONS
   ============================================================ */
export const getLiteRolePermissions = async (req, res) => {
  try {
    await authzService.checkPermission(req.user, MODULE_KEY, "view");

    const { q } = req.query;
    const where = {};

    if (q) {
      where[Op.or] = [
        { "$role.name$": { [Op.iLike]: `%${q}%` } },
        { "$permission.name$": { [Op.iLike]: `%${q}%` } },
        { "$permission.module$": { [Op.iLike]: `%${q}%` } },
        { "$facility.name$": { [Op.iLike]: `%${q}%` } },
      ];
    }

    if (!isSuperAdmin(req.user)) {
      const orgId = req.user.organization_id;
      const facilityIds = Array.isArray(req.user.facility_ids)
        ? req.user.facility_ids
        : [];
      where.organization_id = orgId;
      if (facilityIds.length > 0) {
        where[Op.or] = [
          { facility_id: { [Op.in]: facilityIds } },
          { facility_id: null },
        ];
      }
    }

    const records = await RolePermission.findAll({
      where,
      include: [
        { model: Role, as: "role", attributes: ["id", "name"] },
        { model: Permission, as: "permission", attributes: ["id", "key", "name", "module", "category"] },
        { model: Facility, as: "facility", attributes: ["id", "name", "code"] },
      ],
      order: [["created_at", "DESC"]],
      limit: 20,
    });

    return success(res, "✅ Lite role permissions loaded", { records });
  } catch (err) {
    return error(res, "❌ Failed to load lite role permissions", err);
  }
};

/* ============================================================
   📌 GET ALL ROLE PERMISSIONS
   ============================================================ */
export const getAllRolePermissions = async (req, res) => {
  try {
    // 🔐 Permission check
    await authzService.checkPermission(req.user, MODULE_KEY, "view");

    // 🧭 Strict pagination validation (from query-utils.js)
    const pagination = validatePaginationStrict(req, { limit: 25, maxLimit: 200 });

    // 🧩 Build other dynamic query options (ordering, searching, etc.)
    const options = buildQueryOptions(req, "created_at", "DESC");

    // Ensure pagination props are attached for Sequelize query
    options.limit = pagination.limit;
    options.offset = pagination.offset;
    options.pagination = pagination;

    /* ============================================================
       🧱 Multi-tenant scope: Organization + Facilities
    ============================================================ */
    if (!isSuperAdmin(req.user)) {
      const orgId = req.user.organization_id;
      const facilityIds = Array.isArray(req.user.facility_ids)
        ? req.user.facility_ids
        : [];

      options.where.organization_id = orgId;
      if (facilityIds.length > 0) {
        options.where[Op.or] = [
          { facility_id: { [Op.in]: facilityIds } },
          { facility_id: null },
        ];
      }
    }

    /* ============================================================
       🔍 Search filter (cross-table fields)
    ============================================================ */
    if (options.search) {
      options.where[Op.or] = [
        { "$role.name$": { [Op.iLike]: `%${options.search}%` } },
        { "$permission.name$": { [Op.iLike]: `%${options.search}%` } },
        { "$permission.module$": { [Op.iLike]: `%${options.search}%` } },
        { "$facility.name$": { [Op.iLike]: `%${options.search}%` } },
      ];
    }

    /* ============================================================
       📦 Query DB
    ============================================================ */
    const { count, rows } = await RolePermission.findAndCountAll({
      where: options.where,
      include: ROLE_PERMISSION_INCLUDES,
      order: options.order,
      offset: options.offset,
      limit: options.limit,
    });

    /* ============================================================
       🧾 Audit Log
    ============================================================ */
    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "list",
      details: { query: req.query, returned: count },
    });

    /* ============================================================
       📤 Return Success
    ============================================================ */
    return success(res, "✅ Role permissions loaded", {
      records: rows,
      pagination: {
        total: count,
        page: pagination.page,
        pageCount: Math.ceil(count / pagination.limit),
        limit: pagination.limit,
      },
    });
  } catch (err) {
    return error(res, "❌ Failed to load role permissions", err);
  }
};

/* ============================================================
   📌 GET ROLE PERMISSION BY ID
   ============================================================ */
export const getRolePermissionById = async (req, res) => {
  try {
    await authzService.checkPermission(req.user, MODULE_KEY, "view");

    const { id } = req.params;
    const where = { id };

    if (!isSuperAdmin(req.user)) {
      const orgId = req.user.organization_id;
      const facilityIds = Array.isArray(req.user.facility_ids)
        ? req.user.facility_ids
        : [];
      where.organization_id = orgId;
      if (facilityIds.length > 0) {
        where[Op.or] = [
          { facility_id: { [Op.in]: facilityIds } },
          { facility_id: null },
        ];
      }
    }

    const record = await RolePermission.findOne({
      where,
      include: ROLE_PERMISSION_INCLUDES,
    });

    if (!record) return error(res, "❌ Role permission not found", null, 404);

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "view",
      entityId: id,
      entity: record,
    });

    return success(res, "✅ Role permission loaded", { record });
  } catch (err) {
    return error(res, "❌ Failed to load role permission", err);
  }
};

/* ============================================================ 
   📌 REPLACE ROLE PERMISSIONS (MASTER + HYBRID FACILITY)
============================================================ */
export const replaceRolePermissions = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module: MODULE_KEY,
      action: "edit",
      res,
    });
    if (!allowed) return;

    console.log("\n===============================");
    console.log("🟢 [ROLE PERMISSION UPDATE] Incoming Request Body:");
    console.log(JSON.stringify(req.body, null, 2));
    console.log("===============================");

    /* ========================================================
       🔹 NORMALIZE INPUT (NO ORG FROM FRONTEND)
    ======================================================== */
    const normalizedBody = {
      role_id: req.params.role_id || req.body.role_id,
      facility_id: req.body.facility_id ?? null,
      permission_ids: Array.isArray(req.body.permission_ids)
        ? req.body.permission_ids
        : req.body.permission_id
        ? [req.body.permission_id]
        : [],
    };

    console.log("🧩 Normalized Body:", normalizedBody);

    /* ========================================================
       🔹 VALIDATE (NO organization_id HERE)
    ======================================================== */
    const schema = Joi.object({
      role_id: Joi.string().uuid().required(),
      facility_id: Joi.string().uuid().allow(null, ""),
      permission_ids: Joi.array()
        .items(Joi.string().uuid())
        .min(1)
        .required(),
    });

    const { error: validationError, value } = schema.validate(
      normalizedBody,
      {
        stripUnknown: true,
        abortEarly: false,
      }
    );

    if (validationError) {
      console.error("❌ Joi validation error:", validationError.details);
      await t.rollback();
      return error(res, "Validation failed", validationError.details, 400);
    }

    /* ========================================================
       🧭 TENANT RESOLUTION (MASTER – SAME AS DEPOSIT)
    ======================================================== */
    const { orgId, facilityId: resolvedFacilityId } =
      await resolveOrgFacility({
        user: req.user,
        value,
        body: req.body,
      });

    if (!orgId) {
      await t.rollback();
      return error(res, "Missing organization assignment", null, 400);
    }

    /* ========================================================
       🏥 FACILITY VALIDATION (HYBRID)
    ======================================================== */
    let facilityId = resolvedFacilityId;

    console.log("🏢 Final Org/Facility:", { orgId, facilityId });

    /* ========================================================
       🗑️ REMOVE OLD PERMISSIONS (SAFE SCOPE)
    ======================================================== */
    const destroyCount = await RolePermission.destroy({
      where: {
        role_id: value.role_id,
        organization_id: orgId,
        [Op.or]: [{ facility_id: facilityId }, { facility_id: null }],
      },
      force: true,
      transaction: t,
    });

    console.log(`🗑️ Deleted old permissions: ${destroyCount}`);

    /* ========================================================
       ➕ INSERT NEW PERMISSIONS
    ======================================================== */
    const newEntries = value.permission_ids.map((pid) => ({
      organization_id: orgId,
      facility_id: facilityId,
      role_id: value.role_id,
      permission_id: pid,
      created_by_id: req.user?.id || null,
    }));

    console.log("🆕 Entries to create:", newEntries);

    const created = await RolePermission.bulkCreate(newEntries, {
      returning: true,
      ignoreDuplicates: true,
      transaction: t,
    });

    await t.commit();

    console.log("✅ Created Records:", created.length);

    const message =
      created.length < newEntries.length
        ? `⚠️ ${newEntries.length - created.length} duplicate permissions were skipped.`
        : `✅ ${created.length} permissions successfully assigned.`;

    console.log("📦 Final Response:", { message });

    /* ========================================================
       🧾 AUDIT LOG
    ======================================================== */
    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "replace",
      details: {
        role_id: value.role_id,
        organization_id: orgId,
        facility_id: facilityId,
        permissions: value.permission_ids,
        message,
      },
    });

    return success(res, message, { records: created });
  } catch (err) {
    await t.rollback();
    console.error("💥 replaceRolePermissions ERROR:", err);
    return error(res, "❌ Failed to replace role permissions", err);
  }
};

/* ============================================================
   📌 DELETE ROLE PERMISSION
   ============================================================ */
export const deleteRolePermission = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    await authzService.checkPermission(req.user, MODULE_KEY, "delete");

    const { id } = req.params;
    const record = await RolePermission.findOne({ where: { id }, transaction: t });
    if (!record) {
      await t.rollback();
      return error(res, "❌ Role permission not found", null, 404);
    }

    await record.update({ deleted_by_id: req.user?.id || null }, { transaction: t });
    await record.destroy({ transaction: t });
    await t.commit();

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "delete",
      entityId: id,
      entity: record,
    });

    return success(res, "✅ Role permission deleted", { record });
  } catch (err) {
    await t.rollback();
    return error(res, "❌ Failed to delete role permission", err);
  }
};
