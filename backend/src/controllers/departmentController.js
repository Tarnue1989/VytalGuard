// 📁 controllers/departmentController.js
import Joi from "joi";
import { Op } from "sequelize";
import {
  sequelize,
  Department,
  Facility,
  Organization,
  User,
  Employee,
} from "../models/index.js";
import { success, error } from "../utils/response.js";
import { buildQueryOptions } from "../utils/queryHelper.js";
import { DEPARTMENT_STATUS } from "../constants/enums.js";
import { authzService } from "../services/authzService.js";
import { auditService } from "../services/auditService.js";
import { FIELD_VISIBILITY_DEPARTMENT } from "../constants/fieldVisibility.js";
import {
  isSuperAdmin,
  isOrgLevelUser,
  isFacilityHead,
} from "../utils/role-utils.js";

const MODULE_KEY = "departments";

/* ============================================================
   🔗 SHARED INCLUDES
   ============================================================ */
const DEPARTMENT_INCLUDES = [
  {
    model: Organization,
    as: "organization",
    attributes: ["id", "name", "code"],
    required: true, // organization is always required
  },
  {
    model: Facility,
    as: "facility",
    attributes: ["id", "name", "code", "organization_id"],
    required: false, // 🔥 CRITICAL: allow facility_id = NULL
  },
  {
    model: Employee.unscoped(),
    as: "head_of_department",
    attributes: ["id", "first_name", "middle_name", "last_name"],
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
   📋 ROLE-BASED JOI SCHEMA (facility-aware)
============================================================ */
function buildDepartmentSchema(userRole, mode = "create") {
  const base = {
    name: Joi.string().max(120).required(),
    code: Joi.string().max(50).allow("", null),
    description: Joi.string().allow("", null),
    head_of_department_id: Joi.string().uuid().allow("", null),
  };

  if (mode === "update") {
    base.status = Joi.string().valid(...DEPARTMENT_STATUS).optional();
    Object.keys(base).forEach((k) => (base[k] = base[k].optional()));
  }

  // 🔑 Superadmin: org + facility optional
  if (userRole === "superadmin") {
    base.organization_id = Joi.string().uuid().optional();
    base.facility_id = Joi.string().uuid().allow(null).optional();
  }

  // 🏢 Org-level roles: facility OPTIONAL (org-wide departments allowed)
  if (["organization_admin", "org_admin", "org_owner"].includes(userRole)) {
    base.facility_id = Joi.string().uuid().allow(null).optional();
  }

  // 🏥 Facility head: facility auto-resolved → do NOT accept from body
  if (userRole === "facility_head") {
    // facility_id intentionally omitted
  }

  return Joi.object(base);
}

/* ============================================================
   📌 CREATE DEPARTMENT
   ============================================================ */
export const createDepartment = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module: MODULE_KEY,
      action: "create",
      res,
    });
    if (!allowed) return;

    const schema = buildDepartmentSchema(
      (req.user?.roleNames?.[0] || "").toLowerCase(),
      "create"
    );

    const { error: validationError, value } = schema.validate(req.body, {
      stripUnknown: true,
    });

    if (validationError) {
      await t.rollback();
      return error(res, "Validation failed", validationError, 400);
    }

    // 🧭 Scope resolution (ROLE-AWARE)
    let orgId = null;
    let facilityId = null;

    if (isSuperAdmin(req.user)) {
      orgId = value.organization_id || req.body.organization_id || null;
      facilityId = value.facility_id || req.body.facility_id || null;

    } else if (isOrgLevelUser(req.user)) {
      orgId = req.user.organization_id;
      facilityId = value.facility_id || null; // ✅ org-wide allowed

    } else if (isFacilityHead(req.user)) {
      orgId = req.user.organization_id;
      facilityId = req.user.facility_id;

    } else {
      orgId = req.user.organization_id;
      facilityId = req.user.facility_id;
    }

    if (!orgId) {
      await t.rollback();
      return error(res, "Missing organization assignment", null, 400);
    }

    // 🚨 Facility REQUIRED only for non-org / non-super roles
    if (!facilityId && !isOrgLevelUser(req.user) && !isSuperAdmin(req.user)) {
      await t.rollback();
      return error(
        res,
        "Facility is required when creating a department",
        null,
        400
      );
    }

    // 🚫 Duplicate check (org + facility scope)
    const exists = await Department.findOne({
      where: {
        organization_id: orgId,
        facility_id: facilityId,
        name: value.name,
      },
      paranoid: false,
    });

    if (exists) {
      await t.rollback();
      return error(
        res,
        "Department with this name already exists in this scope",
        null,
        400
      );
    }

    const created = await Department.create(
      {
        ...value,
        organization_id: orgId,
        facility_id: facilityId,
        status: value.status || DEPARTMENT_STATUS[0],
        created_by_id: req.user?.id || null,
      },
      { transaction: t }
    );

    await t.commit();

    const full = await Department.findOne({
      where: { id: created.id },
      include: DEPARTMENT_INCLUDES,
    });

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "create",
      entityId: created.id,
      entity: full,
      details: value,
    });

    return success(res, "✅ Department created", full);
  } catch (err) {
    await t.rollback();
    return error(res, "❌ Failed to create department", err);
  }
};



/* ============================================================
   📌 UPDATE DEPARTMENT (WITH DEBUG LOGGING)
============================================================ */
export const updateDepartment = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    console.log("🧪 [UPDATE DEP] incoming request", {
      params: req.params,
      body: req.body,
      user: {
        id: req.user?.id,
        roleNames: req.user?.roleNames,
        organization_id: req.user?.organization_id,
        facility_id: req.user?.facility_id,
      },
    });

    const allowed = await authzService.checkPermission({
      user: req.user,
      module: MODULE_KEY,
      action: "update",
      res,
    });
    if (!allowed) return;

    const { id } = req.params;

    const schema = buildDepartmentSchema(
      (req.user?.roleNames?.[0] || "").toLowerCase(),
      "update"
    );

    const { error: validationError, value } = schema.validate(req.body, {
      stripUnknown: true,
    });

    if (validationError) {
      console.log("❌ [UPDATE DEP] Joi validation failed", validationError);
      await t.rollback();
      return error(res, "Validation failed", validationError, 400);
    }

    console.log("🧪 [UPDATE DEP] validated payload", value);

    /* ========================================================
       🧭 Scope resolution (ROLE-AWARE)
    ======================================================== */
    let orgId = null;
    let facilityId = null;

    if (isSuperAdmin(req.user)) {
      orgId = value.organization_id || req.query.organization_id || null;
      facilityId = value.facility_id || req.query.facility_id || null;

    } else if (isOrgLevelUser(req.user)) {
      orgId = req.user.organization_id;
      facilityId = value.facility_id ?? req.user.facility_id ?? null;

    } else if (isFacilityHead(req.user)) {
      orgId = req.user.organization_id;
      facilityId = req.user.facility_id;

    } else {
      orgId = req.user.organization_id;
      facilityId = req.user.facility_id;
    }

    console.log("🧭 [UPDATE DEP] resolved scope", {
      orgId,
      facilityId,
      isSuper: isSuperAdmin(req.user),
      isOrgAdmin: isOrgLevelUser(req.user),
    });

    if (!orgId) {
      await t.rollback();
      return error(res, "Missing organization assignment", null, 400);
    }

    const record = await Department.findOne({
      where: { id, organization_id: orgId },
      transaction: t,
    });

    if (!record) {
      await t.rollback();
      return error(res, "Department not found", null, 404);
    }

    console.log("🧪 [UPDATE DEP] existing record (before)", {
      id: record.id,
      organization_id: record.organization_id,
      facility_id: record.facility_id,
      name: record.name,
    });

    /* ========================================================
       🚫 Duplicate prevention
    ======================================================== */
    if (value.name) {
      const exists = await Department.findOne({
        where: {
          organization_id: orgId,
          facility_id: facilityId,
          name: value.name,
          id: { [Op.ne]: id },
        },
        paranoid: false,
      });

      if (exists) {
        await t.rollback();
        return error(
          res,
          "Department with this name already exists in this scope",
          null,
          400
        );
      }
    }

    /* ========================================================
       💾 Update
    ======================================================== */
    const updatePayload = {
      ...value,
      organization_id: orgId,
      facility_id: facilityId,
      updated_by_id: req.user?.id || null,
    };

    console.log("💾 [UPDATE DEP] update payload", updatePayload);

    await record.update(updatePayload, { transaction: t });

    await t.commit();

    const full = await Department.findOne({
      where: { id },
      include: DEPARTMENT_INCLUDES,
    });

    console.log("✅ [UPDATE DEP] saved record (after)", {
      id: full.id,
      organization_id: full.organization_id,
      facility_id: full.facility_id,
      facility: full.facility?.name || null,
    });

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "update",
      entityId: id,
      entity: full,
      details: value,
    });

    return success(res, "✅ Department updated", full);

  } catch (err) {
    console.error("🔥 [UPDATE DEP] unexpected error", err);
    await t.rollback();
    return error(res, "❌ Failed to update department", err);
  }
};



/* ============================================================
   📌 TOGGLE DEPARTMENT STATUS
   ============================================================ */
export const toggleDepartmentStatus = async (req, res) => {
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module: "department",
      action: "update",
      res,
    });
    if (!allowed) return;

    const { id } = req.params;

    const where = { id };

    if (isSuperAdmin(req.user)) {
      if (req.query.organization_id) where.organization_id = req.query.organization_id;
      if (req.query.facility_id) where.facility_id = req.query.facility_id;

    } else if (isOrgLevelUser(req.user)) {
      // ✅ Org admin → org-wide + all facilities
      where.organization_id = req.user.organization_id;

    } else {
      // Facility-scoped users
      where.organization_id = req.user.organization_id;
      where.facility_id = req.user.facility_id;
    }

    const department = await Department.findOne({ where });
    if (!department) {
      return error(res, "❌ Department not found", null, 404);
    }

    const [ACTIVE, INACTIVE] = DEPARTMENT_STATUS;
    const newStatus = department.status === ACTIVE ? INACTIVE : ACTIVE;

    await department.update({
      status: newStatus,
      updated_by_id: req.user?.id || null,
    });

    const full = await Department.findOne({
      where: { id: department.id },
      include: DEPARTMENT_INCLUDES,
    });

    await auditService.logAction({
      user: req.user,
      module: "department",
      action: "toggle_status",
      entityId: id,
      entity: full,
      details: { from: department.status, to: newStatus },
    });

    return success(res, `✅ Department status set to ${newStatus}`, full);
  } catch (err) {
    return error(res, "❌ Failed to toggle department status", err);
  }
};

/* ============================================================
   📌 GET ALL DEPARTMENTS LITE (with ?q= support)
   ============================================================ */
export const getAllDepartmentsLite = async (req, res) => {
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module: "department",
      action: "read",
      res,
    });
    if (!allowed) return;

    const { q } = req.query;
    const where = {
      status: DEPARTMENT_STATUS[0],
    };

    if (isSuperAdmin(req.user)) {
      if (req.query.organization_id) where.organization_id = req.query.organization_id;
      if (req.query.facility_id) where.facility_id = req.query.facility_id;

    } else if (isOrgLevelUser(req.user)) {
      // ✅ Org admin → org-wide + facility departments
      where.organization_id = req.user.organization_id;

    } else {
      // Facility-scoped users
      where.organization_id = req.user.organization_id;
      where.facility_id = req.user.facility_id;
    }

    if (q) {
      where[Op.or] = [
        { name: { [Op.iLike]: `%${q}%` } },
        { code: { [Op.iLike]: `%${q}%` } },
      ];
    }

    const departments = await Department.findAll({
      where,
      attributes: ["id", "name", "code"],
      order: [["name", "ASC"]],
      limit: 20,
    });

    const records = departments.map(d => ({
      id: d.id,
      name: d.name,
      code: d.code || "",
    }));

    await auditService.logAction({
      user: req.user,
      module: "department",
      action: "list_lite",
      details: { count: records.length, query: q || null },
    });

    return success(res, "✅ Departments loaded (lite)", { records });
  } catch (err) {
    return error(res, "❌ Failed to load departments (lite)", err);
  }
};

/* ============================================================
   📌 DELETE DEPARTMENT (Soft Delete with Audit)
   ============================================================ */
export const deleteDepartment = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module: "department",
      action: "delete",
      res,
    });
    if (!allowed) return;

    const { id } = req.params;
    const where = { id };

    if (isSuperAdmin(req.user)) {
      if (req.query.organization_id) where.organization_id = req.query.organization_id;
      if (req.query.facility_id) where.facility_id = req.query.facility_id;

    } else if (isOrgLevelUser(req.user)) {
      // ✅ Org admin → org-wide + all facilities
      where.organization_id = req.user.organization_id;

    } else {
      // Facility-scoped users
      where.organization_id = req.user.organization_id;
      where.facility_id = req.user.facility_id;
    }

    const department = await Department.findOne({ where, transaction: t });
    if (!department) {
      await t.rollback();
      return error(res, "❌ Department not found", null, 404);
    }

    const hasEmployees = await Employee.count({
      where: { department_id: id },
      transaction: t,
    });

    if (hasEmployees > 0) {
      await t.rollback();
      return error(
        res,
        "❌ Cannot delete — employees are still assigned",
        null,
        400
      );
    }

    await department.update(
      { deleted_by_id: req.user?.id || null },
      { transaction: t }
    );

    await department.destroy({ transaction: t });
    await t.commit();

    const full = await Department.findOne({
      where: { id },
      include: DEPARTMENT_INCLUDES,
      paranoid: false,
    });

    await auditService.logAction({
      user: req.user,
      module: "department",
      action: "delete",
      entityId: id,
      entity: full,
    });

    return success(res, "✅ Department deleted", full);
  } catch (err) {
    await t.rollback();
    return error(res, "❌ Failed to delete department", err);
  }
};


/* ============================================================
   📌 GET ALL DEPARTMENTS
   ============================================================ */
export const getAllDepartments = async (req, res) => {
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module: "department",
      action: "read",
      res,
    });
    if (!allowed) return;

    const visibleFields =
      FIELD_VISIBILITY_DEPARTMENT[
        (req.user?.roleNames?.[0] || "staff").toLowerCase()
      ] || FIELD_VISIBILITY_DEPARTMENT.staff;

    const options = buildQueryOptions(req, "name", "ASC", visibleFields);
    options.where = options.where || {};

    if (isSuperAdmin(req.user)) {
      if (req.query.organization_id)
        options.where.organization_id = req.query.organization_id;
      if (req.query.facility_id)
        options.where.facility_id = req.query.facility_id;

    } else if (isOrgLevelUser(req.user)) {
      // ✅ Org admin → org-wide + all facilities
      options.where.organization_id = req.user.organization_id;

      // 🔥 CRITICAL FIX — REMOVE ANY FACILITY FILTER
      delete options.where.facility_id;

    } else {
      // Facility-scoped users
      options.where.organization_id = req.user.organization_id;
      options.where.facility_id = req.user.facility_id;
    }

    if (options.search) {
      options.where[Op.or] = [
        { name: { [Op.iLike]: `%${options.search}%` } },
        { code: { [Op.iLike]: `%${options.search}%` } },
      ];
    }

    const { count, rows } = await Department.findAndCountAll({
      where: options.where,
      include: [...DEPARTMENT_INCLUDES, ...(options.include || [])],
      order: options.order,
      offset: options.offset,
      limit: options.limit,
    });

    await auditService.logAction({
      user: req.user,
      module: "department",
      action: "list",
      details: { query: req.query, returned: count },
    });

    return success(res, "✅ Departments loaded", {
      records: rows,
      pagination: {
        total: count,
        page: options.pagination.page,
        pageCount: Math.ceil(count / options.pagination.limit),
      },
    });
  } catch (err) {
    return error(res, "❌ Failed to load departments", err);
  }
};


/* ============================================================
   📌 GET DEPARTMENT BY ID
   ============================================================ */
export const getDepartmentById = async (req, res) => {
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module: "department",
      action: "read",
      res,
    });
    if (!allowed) return;

    const { id } = req.params;
    const where = { id };

    if (isSuperAdmin(req.user)) {
      if (req.query.organization_id) where.organization_id = req.query.organization_id;
      if (req.query.facility_id) where.facility_id = req.query.facility_id;

    } else if (isOrgLevelUser(req.user)) {
      // ✅ Org admin → org-wide + all facilities
      where.organization_id = req.user.organization_id;

    } else {
      // Facility-scoped users
      where.organization_id = req.user.organization_id;
      where.facility_id = req.user.facility_id;
    }

    const department = await Department.findOne({
      where,
      include: DEPARTMENT_INCLUDES,
    });

    if (!department) {
      return error(res, "❌ Department not found", null, 404);
    }

    await auditService.logAction({
      user: req.user,
      module: "department",
      action: "view",
      entityId: id,
      entity: department,
    });

    return success(res, "✅ Department loaded", department);
  } catch (err) {
    return error(res, "❌ Failed to load department", err);
  }
};
