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
import { makeModuleLogger } from "../utils/debugLogger.js";
import { validate } from "../utils/validation.js";
import { normalizeDateRangeLocal } from "../utils/date-utils.js";
import { resolveOrgFacility } from "../utils/resolveOrgFacility.js";

const MODULE_KEY = "departments";

/* ============================================================
   🔧 LOCAL DEBUG OVERRIDE (DEPARTMENT CONTROLLER)
============================================================ */
const DEBUG_OVERRIDE = true; // 👈 turn OFF in production
const debug = makeModuleLogger("departmentController", DEBUG_OVERRIDE);

/* ============================================================
   🔗 SHARED INCLUDES
============================================================ */
const DEPARTMENT_INCLUDES = [
  {
    model: Organization,
    as: "organization",
    attributes: ["id", "name", "code"],
    required: true,
  },
  {
    model: Facility,
    as: "facility",
    attributes: ["id", "name", "code", "organization_id"],
    required: false,
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

  if (userRole === "superadmin") {
    base.organization_id = Joi.string().uuid().optional();
    base.facility_id = Joi.string().uuid().allow(null).optional();
  }

  if (["organization_admin", "org_admin", "org_owner"].includes(userRole)) {
    base.facility_id = Joi.string().uuid().allow(null).optional();
  }

  return Joi.object(base);
}

/* ============================================================
   📌 CREATE DEPARTMENT (MASTER — ROLE PATTERN)
   ✔ NO resolveOrgFacility
   ✔ Org comes from user for org admin
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

    debug.log("create → incoming body", req.body);

    const { value, errors } = validate(
      buildDepartmentSchema(
        (req.user?.roleNames?.[0] || "").toLowerCase(),
        "create"
      ),
      req.body
    );

    if (errors) {
      debug.warn("create → validation error", errors);
      await t.rollback();
      return res.status(400).json({ success: false, errors });
    }

    /* ========================================================
       🧭 ROLE-BASED SCOPE RESOLUTION (MATCH ROLE CONTROLLER)
    ======================================================== */
    let orgId = null;
    let facilityId = null;

    if (isSuperAdmin(req.user)) {
      orgId = value.organization_id;
      facilityId = value.facility_id || null;

    } else if (isOrgLevelUser(req.user)) {
      orgId = req.user.organization_id;
      facilityId = value.facility_id || null;

    } else if (isFacilityHead(req.user)) {
      orgId = req.user.organization_id;
      facilityId = req.user.facility_id;

    } else {
      orgId = req.user.organization_id;
      facilityId = req.user.facility_id ?? null;
    }

    debug.log("create → resolved scope", { orgId, facilityId });

    /* ========================================================
       🚨 HARD VALIDATION
    ======================================================== */
    if (!orgId) {
      await t.rollback();
      return error(res, "Missing organization assignment", null, 400);
    }

    // Optional rule (keep if your system requires facility)
    if (!facilityId && !isOrgLevelUser(req.user) && !isSuperAdmin(req.user)) {
      await t.rollback();
      return error(
        res,
        "Facility is required when creating a department",
        null,
        400
      );
    }

    /* ========================================================
       🚫 UNIQUENESS CHECK
    ======================================================== */
    const exists = await Department.findOne({
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
        "Department with this name already exists in this scope",
        null,
        400
      );
    }

    /* ========================================================
       ✅ CREATE
    ======================================================== */
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

    /* ========================================================
       📦 LOAD FULL RECORD
    ======================================================== */
    const full = await Department.findOne({
      where: { id: created.id },
      include: DEPARTMENT_INCLUDES,
    });

    /* ========================================================
       🧾 AUDIT
    ======================================================== */
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
    debug.error("createDepartment → FAILED", err);
    return error(res, "❌ Failed to create department", err);
  }
};

/* ============================================================
   📌 UPDATE DEPARTMENT (MASTER PARITY)
============================================================ */
export const updateDepartment = async (req, res) => {
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
      buildDepartmentSchema(
        (req.user?.roleNames?.[0] || "").toLowerCase(),
        "update"
      ),
      req.body
    );

    if (errors) {
      await t.rollback();
      return res.status(400).json({ success: false, errors });
    }

    /* ========================================================
       🧭 SCOPE RESOLUTION (MASTER PARITY)
    ======================================================== */
    const { orgId, facilityId } = resolveOrgFacility({
      user: req.user,
      value,
      body: req.body,
    });

    if (!orgId) {
      await t.rollback();
      return error(res, "Missing organization assignment", null, 400);
    }

    const record = await Department.findOne({
      where: { id: req.params.id, organization_id: orgId },
      transaction: t,
    });

    if (!record) {
      await t.rollback();
      return error(res, "Department not found", null, 404);
    }

    /* ========================================================
       🚫 UNIQUENESS CHECK
    ======================================================== */
    if (value.name) {
      const exists = await Department.findOne({
        where: {
          organization_id: orgId,
          facility_id: facilityId,
          name: value.name,
          id: { [Op.ne]: record.id },
        },
        paranoid: false,
        transaction: t,
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
       💾 UPDATE
    ======================================================== */
    await record.update(
      {
        ...value,
        organization_id: orgId,
        facility_id: facilityId,
        updated_by_id: req.user?.id || null,
      },
      { transaction: t }
    );

    await t.commit();

    const full = await Department.findOne({
      where: { id: record.id },
      include: DEPARTMENT_INCLUDES,
    });

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "update",
      entityId: record.id,
      entity: full,
      details: value,
    });

    return success(res, "✅ Department updated", full);
  } catch (err) {
    await t.rollback();
    debug.error("updateDepartment → FAILED", err);
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
    } else {
      if (req.query.organization_id)
        where.organization_id = req.query.organization_id;
      if (req.query.facility_id)
        where.facility_id = req.query.facility_id;
    }

    const department = await Department.findOne({ where });
    if (!department) return error(res, "❌ Department not found", null, 404);

    const [ACTIVE, INACTIVE] = DEPARTMENT_STATUS;
    const newStatus = department.status === ACTIVE ? INACTIVE : ACTIVE;

    await department.update({
      status: newStatus,
      updated_by_id: req.user?.id || null,
    });

    const full = await Department.findOne({
      where: { id },
      include: DEPARTMENT_INCLUDES,
    });

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "toggle_status",
      entityId: id,
      entity: full,
      details: { from: department.status, to: newStatus },
    });

    return success(res, `✅ Department status set to ${newStatus}`, full);
  } catch (err) {
    debug.error("toggleDepartmentStatus → FAILED", err);
    return error(res, "❌ Failed to toggle department status", err);
  }
};
/* ============================================================
   📌 GET ALL DEPARTMENTS LITE (MASTER PARITY)
============================================================ */
export const getAllDepartmentsLite = async (req, res) => {
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
      status: DEPARTMENT_STATUS[0],
      [Op.and]: [],
    };

    /* ========================================================
       🔐 TENANT SCOPE (MASTER PATTERN)
    ======================================================== */
    if (!isSuperAdmin(req.user)) {
      where.organization_id = req.user.organization_id;

      if (!isOrgLevelUser(req.user)) {
        where[Op.and].push({
          [Op.or]: [
            { facility_id: null },
            { facility_id: req.user.facility_id },
          ],
        });
      }
    } else {
      if (req.query.organization_id)
        where.organization_id = req.query.organization_id;
      if (req.query.facility_id)
        where.facility_id = req.query.facility_id;
    }

    /* ========================================================
       🔍 SEARCH (SAFE, ADDITIVE)
    ======================================================== */
    if (q) {
      where[Op.and].push({
        [Op.or]: [
          { name: { [Op.iLike]: `%${q}%` } },
          { code: { [Op.iLike]: `%${q}%` } },
        ],
      });
    }

    const departments = await Department.findAll({
      where,
      attributes: ["id", "name", "code"],
      order: [["name", "ASC"]],
      limit: 50,
    });

    const records = departments.map((d) => ({
      id: d.id,
      name: d.name,
      code: d.code || "",
    }));

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "list_lite",
      details: { count: records.length, q: q || null },
    });

    return success(res, "✅ Departments loaded (lite)", { records });
  } catch (err) {
    debug.error("list_lite → FAILED", err);
    return error(res, "❌ Failed to load departments (lite)", err);
  }
};


/* ============================================================
   📌 DELETE DEPARTMENT (MASTER PARITY)
============================================================ */
export const deleteDepartment = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module: MODULE_KEY,
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
    } else {
      if (req.query.organization_id)
        where.organization_id = req.query.organization_id;
      if (req.query.facility_id)
        where.facility_id = req.query.facility_id;
    }

    const department = await Department.findOne({
      where,
      transaction: t,
    });

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
      module: MODULE_KEY,
      action: "delete",
      entityId: id,
      entity: full,
    });

    return success(res, "✅ Department deleted", full);
  } catch (err) {
    await t.rollback();
    debug.error("deleteDepartment → FAILED", err);
    return error(res, "❌ Failed to delete department", err);
  }
};

/* ============================================================
   📌 GET ALL DEPARTMENTS (MASTER PARITY + ENUM SUMMARY)
============================================================ */
export const getAllDepartments = async (req, res) => {
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

    /* ========================================================
       👁️ FIELD VISIBILITY (ROLE-AWARE)
    ======================================================== */
    const visibleFields =
      FIELD_VISIBILITY_DEPARTMENT[
        (req.user?.roleNames?.[0] || "staff").toLowerCase()
      ] || FIELD_VISIBILITY_DEPARTMENT.staff;

    /* ========================================================
       ⚙️ BASE QUERY OPTIONS (MASTER PARITY)
    ======================================================== */
    const options = buildQueryOptions(req, "name", "ASC", visibleFields);

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
       🔐 TENANT SCOPE
    ======================================================== */
    if (!isSuperAdmin(req.user)) {
      // Organization lock
      options.where[Op.and].push({
        organization_id: req.user.organization_id,
      });

      // Facility scope (org-level users see all)
      if (!isOrgLevelUser(req.user)) {
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
        ],
      });
    }

    /* ========================================================
       📌 STATUS FILTER (ENUM SAFE)
    ======================================================== */
    if (
      req.query.status &&
      DEPARTMENT_STATUS.includes(req.query.status)
    ) {
      options.where[Op.and].push({
        status: req.query.status,
      });
    }

    /* ========================================================
       🗂️ QUERY EXECUTION
    ======================================================== */
    const { count, rows } = await Department.findAndCountAll({
      where: options.where,
      include: [...DEPARTMENT_INCLUDES, ...(options.include || [])],
      order: options.order,
      offset: options.offset,
      limit: options.limit,
    });

    /* ========================================================
       🔢 SUMMARY (ENUM-BASED, FILTER-AWARE, PAGE-BASED)
    ======================================================== */
    const summary = { total: count };

    DEPARTMENT_STATUS.forEach((status) => {
      summary[status] = rows.filter((r) => r.status === status).length;
    });

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
       ✅ RESPONSE (MASTER CONTRACT)
    ======================================================== */
    return success(res, "✅ Departments loaded", {
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
    return error(res, "❌ Failed to load departments", err);
  }
};

/* ============================================================
   📌 GET DEPARTMENT BY ID (MASTER PARITY)
============================================================ */
export const getDepartmentById = async (req, res) => {
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
    } else {
      if (req.query.organization_id)
        where.organization_id = req.query.organization_id;
      if (req.query.facility_id)
        where.facility_id = req.query.facility_id;
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
      module: MODULE_KEY,
      action: "view",
      entityId: id,
      entity: department,
    });

    return success(res, "✅ Department loaded", department);
  } catch (err) {
    debug.error("view → FAILED", err);
    return error(res, "❌ Failed to load department", err);
  }
};
