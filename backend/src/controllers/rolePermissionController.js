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

/* ============================================================
   🧩 MODULE CONFIG
   ============================================================ */
const MODULE_KEY = "rolepermissions";

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
   ⚙️ ACCESS HELPERS
   ============================================================ */
function resolveOrganizationId(req, bodyOrgId) {
  return isSuperAdmin(req.user)
    ? bodyOrgId
    : req.user?.organization_id || null;
}

function resolveFacilityId(req, bodyFacilityId) {
  if (isSuperAdmin(req.user)) return bodyFacilityId;
  if (hasRole(req.user, ["org owner", "organization owner"])) {
    if (
      Array.isArray(req.user.facility_ids) &&
      req.user.facility_ids.includes(bodyFacilityId)
    ) {
      return bodyFacilityId;
    }
    return null;
  }
  return req.user?.facility_id || null;
}

/* ============================================================
   📋 SCHEMA FACTORY
   ============================================================ */
function buildRolePermissionSchema(mode = "create") {
  const base = {
    organization_id: Joi.string().uuid().required(),
    facility_id: Joi.string().uuid().allow(null, ""),
    role_id: Joi.string().uuid().required(),
    permission_id: Joi.string().uuid().optional(),
    permission_ids: Joi.array().items(Joi.string().uuid()).optional(),
  };

  return Joi.object(base).custom((value, helpers) => {
    if (!value.permission_id && (!value.permission_ids || value.permission_ids.length === 0)) {
      return helpers.error("any.custom", { message: "Either permission_id or permission_ids is required" });
    }
    return value;
  });
}

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
   📌 CREATE ROLE PERMISSION (Single or Bulk)
   ============================================================ */
export const createRolePermission = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    await authzService.checkPermission(req.user, MODULE_KEY, "create");

    const schema = buildRolePermissionSchema("create");
    const { error: validationError, value } = schema.validate(req.body, { stripUnknown: true });
    if (validationError) {
      await t.rollback();
      return error(res, "Validation failed", validationError, 400);
    }

    const finalOrgId = resolveOrganizationId(req, value.organization_id);
    const finalFacilityId = resolveFacilityId(req, value.facility_id);
    const permissionIds = value.permission_ids || [value.permission_id];

    const createdRecords = [];

    for (const pid of permissionIds) {
      const exists = await RolePermission.findOne({
        where: {
          organization_id: finalOrgId,
          role_id: value.role_id,
          permission_id: pid,
          facility_id: finalFacilityId,
        },
        paranoid: false,
        transaction: t,
      });
      if (exists) continue;

      const created = await RolePermission.create(
        {
          organization_id: finalOrgId,
          facility_id: finalFacilityId,
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
        organization_id: finalOrgId,
        facility_id: finalFacilityId,
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
   📌 REPLACE ROLE PERMISSIONS (Bulk Safe Replace)
   ============================================================ */
export const replaceRolePermissions = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    await authzService.checkPermission(req.user, MODULE_KEY, "edit");

    console.log("\n===============================");
    console.log("🟢 [ROLE PERMISSION UPDATE] Incoming Request Body:");
    console.log(JSON.stringify(req.body, null, 2));
    console.log("===============================");

    // 🔹 Normalize incoming payload
    const normalizedBody = {
      role_id: req.params.role_id || req.body.role_id,
      organization_id: req.body.organization_id,
      facility_id: req.body.facility_id ?? null,
      permission_ids: Array.isArray(req.body.permission_ids)
        ? req.body.permission_ids
        : req.body.permission_id
        ? [req.body.permission_id]
        : [],
    };

    console.log("🧩 Normalized Body:", normalizedBody);

    // 🔹 Validate
    const schema = Joi.object({
      role_id: Joi.string().uuid().required(),
      organization_id: Joi.string().uuid().required(),
      facility_id: Joi.string().uuid().allow(null, ""),
      permission_ids: Joi.array().items(Joi.string().uuid()).min(1).required(),
    });

    const { error: validationError, value } = schema.validate(normalizedBody, {
      stripUnknown: true,
      abortEarly: false,
    });

    if (validationError) {
      console.error("❌ Joi validation error:", validationError.details);
      await t.rollback();
      return error(res, "Validation failed", validationError.details, 400);
    }

    const finalOrgId = value.organization_id || req.user.organization_id;
    const finalFacilityId = value.facility_id || req.user.facility_id;

    console.log("🏢 Final Resolved Org/Facility:", {
      finalOrgId,
      finalFacilityId,
    });

    // 🔹 Remove old permissions
    const destroyCount = await RolePermission.destroy({
      where: {
        role_id: value.role_id,
        organization_id: finalOrgId,
        [Op.or]: [{ facility_id: finalFacilityId }, { facility_id: null }],
      },
      force: true,
      transaction: t,
    });
    console.log(`🗑️ Deleted old permissions: ${destroyCount}`);

    // 🔹 Insert new permissions
    if (!value.permission_ids || value.permission_ids.length === 0) {
      console.warn("⚠️ No permissions provided in request body!");
      await t.rollback();
      return error(res, "❌ No permissions selected to update.", null, 400);
    }

    const newEntries = value.permission_ids.map((pid) => ({
      organization_id: finalOrgId,
      facility_id: finalFacilityId,
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

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "replace",
      details: {
        role_id: value.role_id,
        organization_id: finalOrgId,
        facility_id: finalFacilityId,
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
