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
import { normalizeDateRangeLocal } from "../utils/date-utils.js";

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
   📌 GET ALL ROLE PERMISSIONS (MASTER PARITY WITH DEPOSIT)
   ============================================================ */
export const getAllRolePermissions = async (req, res) => {
  try {
    /* ========================================================
       🔐 AUTH
    ======================================================== */
    const allowed = await authzService.checkPermission({
      user: req.user,
      module: MODULE_KEY,
      action: "view",
      res,
    });
    if (!allowed) return;

    /* ========================================================
       🔢 STRICT PAGINATION (MATCH DEPOSIT)
    ======================================================== */
    const { limit, page, offset } = validatePaginationStrict(req, {
      limit: 25,
      maxLimit: 200,
    });

    /* ========================================================
       🧼 SAFE QUERY (REMOVE UI-ONLY FIELDS)
    ======================================================== */
    const { dateRange, ...safeQuery } = req.query;
    safeQuery.limit = limit;
    safeQuery.page = page;
    req.query = safeQuery;

    /* ========================================================
       ⚙️ BUILD OPTIONS (MASTER)
    ======================================================== */
    const options = buildQueryOptions(req, "created_at", "DESC");

    /* ========================================================
       🔄 MASTER SORT (FULL SAFE)
    ======================================================== */
    const SORT_FIELD_MAP = {
      role: { model: Role, as: "role", field: "name" },
      permission: { model: Permission, as: "permission", field: "key" },
      organization: { model: Organization, as: "organization", field: "name" },
      facility: { model: Facility, as: "facility", field: "name" },
      created_at: { field: "created_at" },
      updated_at: { field: "updated_at" },
    };

    const sortByRaw = (req.query.sort_by || "").trim();

    if (sortByRaw && SORT_FIELD_MAP[sortByRaw]) {
      const config = SORT_FIELD_MAP[sortByRaw];

      const direction =
        (req.query.sort_order || "asc").toUpperCase() === "DESC"
          ? "DESC"
          : "ASC";

      if (config.model) {
        options.order = [[
          { model: config.model, as: config.as },
          config.field,
          direction
        ]];
      } else {
        options.order = [[config.field, direction]];
      }
    }
    /* ========================================================
       🧱 WHERE BASE
    ======================================================== */
    options.where = { [Op.and]: [] };

    /* ========================================================
       📅 DATE RANGE (MASTER)
    ======================================================== */
    if (dateRange) {
      const { start, end } = normalizeDateRangeLocal(dateRange);
      if (start && end) {
        options.where[Op.and].push({
          created_at: { [Op.between]: [start, end] },
        });
      }
    }

    /* ========================================================
       🔐 TENANT FILTER (MATCH DEPOSIT)
    ======================================================== */
    if (!isSuperAdmin(req.user)) {
      options.where[Op.and].push({
        organization_id: req.user.organization_id,
      });

      const facilityIds = Array.isArray(req.user.facility_ids)
        ? req.user.facility_ids
        : [];

      if (facilityIds.length > 0) {
        options.where[Op.and].push({
          [Op.or]: [
            { facility_id: { [Op.in]: facilityIds } },
            { facility_id: null },
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
       🎯 DIRECT FILTERS
    ======================================================== */
    if (req.query.role_id) {
      options.where[Op.and].push({ role_id: req.query.role_id });
    }

    if (req.query.permission_id) {
      options.where[Op.and].push({ permission_id: req.query.permission_id });
    }

    /* ========================================================
       🔍 GLOBAL SEARCH (MASTER)
    ======================================================== */
    if (options.search) {
      options.where[Op.and].push({
        [Op.or]: [
          { "$role.name$": { [Op.iLike]: `%${options.search}%` } },
          { "$permission.name$": { [Op.iLike]: `%${options.search}%` } },
          { "$permission.module$": { [Op.iLike]: `%${options.search}%` } },
          { "$facility.name$": { [Op.iLike]: `%${options.search}%` } },
        ],
      });
    }

    /* ========================================================
       🧼 CLEAN WHERE
    ======================================================== */
    if (!options.where[Op.and].length) {
      delete options.where;
    }

    /* ========================================================
       📦 QUERY (🔥 DISTINCT FIX)
    ======================================================== */
    const { count, rows } = await RolePermission.findAndCountAll({
      where: options.where,
      include: ROLE_PERMISSION_INCLUDES,
      order: options.order,
      offset,
      limit,
      distinct: true, // 🔥 CRITICAL FIX (JOIN DUPLICATES)
    });

    /* ========================================================
       🧾 AUDIT
    ======================================================== */
    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "list",
      details: {
        returned: count,
        query: safeQuery,
        pagination: { page, limit },
      },
    });

    /* ========================================================
       ✅ RESPONSE
    ======================================================== */
    return success(res, "✅ Role permissions loaded", {
      records: rows,
      pagination: {
        total: count,
        page,
        limit,
        pageCount: Math.ceil(count / limit),
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
