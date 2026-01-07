import Joi from "joi";
import fs from "fs";
import path from "path";
import { Op } from "sequelize";
import { sequelize, Employee, Facility, Department, User, Organization } from "../models/index.js";
import { success, error } from "../utils/response.js";
import { buildQueryOptions } from "../utils/queryHelper.js";
import { EMPLOYEE_STATUS, GENDER_TYPES, EMPLOYEE_POSITIONS } from "../constants/enums.js";
import { authzService } from "../services/authzService.js";
import { auditService } from "../services/auditService.js";
import { FIELD_VISIBILITY_EMPLOYEE } from "../constants/fieldVisibility.js";
import { FACILITY_REQUIRED_POSITIONS } from "../constants/employeeRules.js"; // 👈 new import
import {
  isSuperAdmin,
  isOrgLevelUser,
  isFacilityHead,
} from "../utils/role-utils.js";
import { resolveOrgFacility } from "../utils/resolveOrgFacility.js";
import { makeModuleLogger } from "../utils/debugLogger.js";

/* ============================================================
   🔧 LOCAL DEBUG OVERRIDE (EMPLOYEE CONTROLLER)
   true  = debug ON for this file only
   false = debug OFF (default / production safe)
============================================================ */
const DEBUG_OVERRIDE = true; // 👈 keep OFF normally
const debug = makeModuleLogger("employeeController", DEBUG_OVERRIDE);

/* ============================================================
   🔗 SHARED INCLUDES (EMPLOYEE – PATIENT PARITY FIX)
============================================================ */
const EMPLOYEE_INCLUDES = [
  {
    model: Organization,
    as: "organization",
    required: true, // ✅ org must exist
    attributes: ["id", "name", "code"],
  },
  {
    model: Facility,
    as: "facility",
    required: false, // ⭐ CRITICAL FIX (allow org-only employees)
    attributes: ["id", "name", "code", "organization_id"],
  },
  {
    model: Department,
    as: "department",
    required: false,
    attributes: ["id", "name", "code"],
  },
  {
    model: User,
    as: "user",
    required: false,
    attributes: ["id", "first_name", "last_name", "email"],
  },
  {
    model: User,
    as: "createdBy",
    required: false,
    attributes: ["id", "first_name", "last_name"],
  },
  {
    model: User,
    as: "updatedBy",
    required: false,
    attributes: ["id", "first_name", "last_name"],
  },
  {
    model: User,
    as: "deletedBy",
    required: false,
    attributes: ["id", "first_name", "last_name"],
  },
];

/* ============================================================
   📋 ROLE-BASED JOI SCHEMA FACTORY
   ============================================================ */
/* ============================================================
   📋 ROLE-BASED JOI SCHEMA FACTORY (FINAL)
   ============================================================ */
function buildEmployeeSchema(user) {
  const base = {
    // ================= Identity =================
    first_name: Joi.string().max(80).required(),
    middle_name: Joi.string().max(80).allow("", null),
    last_name: Joi.string().max(80).required(),
    gender: Joi.string().valid(...GENDER_TYPES).required(),
    dob: Joi.date().allow(null),

    // ================= Contact =================
    phone: Joi.string().max(30).allow("", null),
    email: Joi.string().email().allow("", null),
    address: Joi.string().allow("", null),

    // ================= Employment =================
    employee_no: Joi.string().max(50).required(),
    position: Joi.string().valid(...EMPLOYEE_POSITIONS).required(),
    status: Joi.string().valid(...EMPLOYEE_STATUS),
    department_id: Joi.string().uuid().allow(null, ""),

    // ================= Credentials =================
    license_no: Joi.string().allow("", null),
    specialty: Joi.string().allow("", null),
    certifications: Joi.string().allow("", null),

    // ================= Dates =================
    hire_date: Joi.date().allow(null),
    termination_date: Joi.date().allow(null),

    // ================= Emergency =================
    emergency_contact_name: Joi.string().max(120).allow("", null),
    emergency_contact_phone: Joi.string().max(30).allow("", null),

    // ================= System =================
    user_id: Joi.string().uuid().allow(null, ""),
    organization_id: Joi.forbidden(),
    facility_id: Joi.string().uuid().allow(null, ""),

    // ================= File Flags =================
    remove_photo: Joi.alternatives().try(Joi.boolean(), Joi.string()),
    remove_resume: Joi.alternatives().try(Joi.boolean(), Joi.string()),
    remove_document: Joi.alternatives().try(Joi.boolean(), Joi.string()),
  };

  // 🔓 Superadmin override
  if (isSuperAdmin(user)) {
    base.organization_id = Joi.string().uuid().allow(null, "");
    base.facility_id = Joi.string().uuid().allow(null, "");
  }

  return Joi.object(base);
}


/* ============================================================
   📌 CREATE EMPLOYEE (reload full record before returning)
   ============================================================ */
export const createEmployee = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    // 🔹 ENTRY LOG (ALWAYS)
    debug.log("create → incoming body", req.body);

    const allowed = await authzService.checkPermission({
      user: req.user,
      module: "employee",
      action: "create",
      res,
    });

    // 🔐 PERMISSION LOG (ALWAYS)
    debug.log("PERMISSION CHECK", {
      module: "employee",
      action: "create",
      allowed,
      userId: req.user?.id,
      roles: req.user?.roleNames,
    });

    if (!allowed) return;

    const schema = buildEmployeeSchema(req.user);
    const { error: validationError, value } = schema.validate(req.body, {
      stripUnknown: true,
      abortEarly: false,
    });

    debug.log("create → validated payload", value);

    if (validationError) {
      debug.warn("EMPLOYEE:create → validation error", validationError.details);
      await t.rollback();
      return res.status(400).json({
        success: false,
        errors: validationError.details.map(d => ({
          field: d.path.join("."),
          message: d.message.replace(/["]/g, ""),
        })),
      });
    }

    ["department_id", "facility_id", "organization_id", "user_id"].forEach(f => {
      if (!value[f] || value[f] === "") value[f] = null;
    });

    const { orgId, facilityId } = resolveOrgFacility({
      user: req.user,
      value,
      body: req.body,
    });

    debug.log("EMPLOYEE:create → resolved org/facility", { orgId, facilityId });

    if (!orgId) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        errors: [{ field: "organization_id", message: "Organization is required" }],
      });
    }

    if (
      value.position &&
      FACILITY_REQUIRED_POSITIONS.includes(value.position.toLowerCase()) &&
      !facilityId
    ) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        errors: [{
          field: "facility_id",
          message: `Facility is required for position "${value.position}"`,
        }],
      });
    }

    const exists = await Employee.findOne({
      where: { organization_id: orgId, employee_no: value.employee_no },
      paranoid: false,
    });

    if (exists) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        errors: [{
          field: "employee_no",
          message: "Employee Number already exists in this organization",
        }],
      });
    }

    if (req.files) {
      if (req.files.employee_photo?.[0])
        value.photo_path = `/uploads/employees/${req.files.employee_photo[0].filename}`;
      if (req.files.resume_url?.[0])
        value.resume_url = `/uploads/resumes/${req.files.resume_url[0].filename}`;
      if (req.files.document_url?.[0])
        value.document_url = `/uploads/documents/${req.files.document_url[0].filename}`;
    }

    if (value.email) value.email = value.email.toLowerCase().trim();
    ["dob", "hire_date", "termination_date"].forEach(f => {
      if (!value[f] || isNaN(new Date(value[f]).getTime())) value[f] = null;
    });

    value.full_name = [value.first_name, value.middle_name, value.last_name]
      .filter(Boolean)
      .join(" ")
      .trim();

    debug.log("EMPLOYEE:create → final payload", {
      organization_id: orgId,
      facility_id: facilityId,
      employee_no: value.employee_no,
    });

    const created = await Employee.create(
      {
        ...value,
        organization_id: orgId,
        facility_id: facilityId,
        created_by_id: req.user?.id || null,
      },
      { transaction: t }
    );

    await t.commit();

    const full = await Employee.findOne({
      where: { id: created.id },
      include: EMPLOYEE_INCLUDES,
    });

    await auditService.logAction({
      user: req.user,
      module: "employee",
      action: "create",
      entityId: created.id,
      entity: full,
    });

    debug.log("EMPLOYEE:create → success", { id: created.id });

    return success(res, "✅ Employee created", full);
  } catch (err) {
    debug.error("EMPLOYEE:create → FAILED", err);
    await t.rollback();
    return error(res, "❌ Failed to create employee", err);
  }
};



/* ============================================================
   📌 UPDATE EMPLOYEE (reload full record before returning)
   ============================================================ */
export const updateEmployee = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    debug.log("update → incoming request", {
      params: req.params,
      body: req.body,
      user: {
        id: req.user?.id,
        roles: req.user?.roleNames,
        organization_id: req.user?.organization_id,
        facility_id: req.user?.facility_id,
      },
    });

    const allowed = await authzService.checkPermission({
      user: req.user,
      module: "employee",
      action: "update",
      res,
    });

    debug.log("PERMISSION CHECK", {
      module: "employee",
      action: "update",
      allowed,
      userId: req.user?.id,
      roles: req.user?.roleNames,
    });

    if (!allowed) return;

    const { id } = req.params;

    const schema = buildEmployeeSchema(req.user);
    const { error: validationError, value } = schema.validate(req.body, {
      stripUnknown: true,
      abortEarly: false,
    });

    debug.log("update → validated payload", value);

    if (validationError) {
      debug.warn("EMPLOYEE:update → validation failed", validationError.details);
      await t.rollback();
      return res.status(400).json({
        success: false,
        errors: validationError.details.map(d => ({
          field: d.path.join("."),
          message: d.message.replace(/["]/g, ""),
        })),
      });
    }

    ["remove_photo", "remove_resume", "remove_document"].forEach(flag => {
      if (value[flag] === "true") value[flag] = true;
      if (value[flag] === "false") value[flag] = false;
    });

    ["department_id", "facility_id", "organization_id", "user_id"].forEach(f => {
      if (!value[f] || value[f] === "") value[f] = null;
    });

    const where = { id };
    if (!isSuperAdmin(req.user)) {
      where.organization_id = req.user.organization_id;
    }

    const employee = await Employee.findOne({ where, transaction: t });
    if (!employee) {
      await t.rollback();
      return res.status(404).json({
        success: false,
        errors: [{ field: "id", message: "Employee not found" }],
      });
    }

    const { orgId, facilityId } = resolveOrgFacility({
      user: req.user,
      value,
      body: req.body,
    });

    debug.log("EMPLOYEE:update → resolved org/facility", { orgId, facilityId });

    if (
      value.employee_no &&
      value.employee_no !== employee.employee_no &&
      await Employee.findOne({
        where: {
          organization_id: orgId,
          employee_no: value.employee_no,
          id: { [Op.ne]: id },
        },
        paranoid: false,
      })
    ) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        errors: [{
          field: "employee_no",
          message: "Employee Number already exists in this organization",
        }],
      });
    }

    if (
      value.position &&
      FACILITY_REQUIRED_POSITIONS.includes(value.position.toLowerCase()) &&
      !facilityId
    ) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        errors: [{
          field: "facility_id",
          message: `Facility is required for position "${value.position}"`,
        }],
      });
    }

    if (value.remove_photo) value.photo_path = null;
    if (value.remove_resume) value.resume_url = null;
    if (value.remove_document) value.document_url = null;

    if (req.files) {
      if (req.files.employee_photo?.[0])
        value.photo_path = `/uploads/employees/${req.files.employee_photo[0].filename}`;
      if (req.files.resume_url?.[0])
        value.resume_url = `/uploads/resumes/${req.files.resume_url[0].filename}`;
      if (req.files.document_url?.[0])
        value.document_url = `/uploads/documents/${req.files.document_url[0].filename}`;
    }

    if (value.email) value.email = value.email.toLowerCase().trim();
    ["dob", "hire_date", "termination_date"].forEach(f => {
      if (!value[f] || isNaN(new Date(value[f]).getTime())) value[f] = null;
    });

    value.full_name = [value.first_name, value.middle_name, value.last_name]
      .filter(Boolean)
      .join(" ")
      .trim();

    await employee.update(
      {
        ...value,
        organization_id: orgId,
        facility_id: facilityId,
        updated_by_id: req.user?.id || null,
      },
      { transaction: t }
    );

    await t.commit();

    const full = await Employee.findOne({
      where: { id },
      include: EMPLOYEE_INCLUDES,
    });

    await auditService.logAction({
      user: req.user,
      module: "employee",
      action: "update",
      entityId: id,
      entity: full,
    });

    debug.log("EMPLOYEE:update → success", { id });

    return success(res, "✅ Employee updated", full);
  } catch (err) {
    debug.error("EMPLOYEE:update → FAILED", err);
    await t.rollback();
    return error(res, "❌ Failed to update employee", err);
  }
};



/* ============================================================
   📌 DELETE EMPLOYEE (Soft Delete)
   ============================================================ */
export const deleteEmployee = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module: "employee",
      action: "delete",
      res,
    });

    debug.log("PERMISSION CHECK", {
      module: "employee",
      action: "delete",
      allowed,
      userId: req.user?.id,
      roles: req.user?.roleNames,
    });

    if (!allowed) return;


    const { id } = req.params;
    const role = (req.user?.roleNames?.[0] || "").toLowerCase();

    const where = { id };
    if (!isSuperAdmin(req.user)) {
      where.organization_id = req.user.organization_id;
      if (role === "facility_head") {
        where.facility_id = req.user.facility_id; // 🔒 restrict deletion scope
      }
    }

    const employee = await Employee.findOne({ where, transaction: t });
    if (!employee) {
      await t.rollback();
      return error(res, "Employee not found", null, 404);
    }

    if (employee.user_id) {
      const hasUser = await User.count({ where: { id: employee.user_id }, transaction: t });
      if (hasUser > 0) {
        await t.rollback();
        return error(res, "Cannot delete — employee is linked to a user account", null, 400);
      }
    }

    await employee.update({ deleted_by_id: req.user?.id || null }, { transaction: t });
    await employee.destroy({ transaction: t });

    await t.commit();

    const full = await Employee.findOne({
      where: { id },
      include: EMPLOYEE_INCLUDES,
      paranoid: false,
    });

    await auditService.logAction({
      user: req.user,
      module: "employee",
      action: "delete",
      entityId: id,
      entity: full, // 👈 capture org/facility from soft-deleted record
    });

    return success(res, "Employee deleted successfully", full);
  } catch (err) {
    await t.rollback();
    return error(res, "Failed to delete employee", err);
  }
};

/* ============================================================
   📌 TOGGLE EMPLOYEE STATUS
   ============================================================ */
export const toggleEmployeeStatus = async (req, res) => {
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module: "employee",
      action: "update",
      res,
    });

    debug.log("PERMISSION CHECK", {
      module: "employee",
      action: "update",
      allowed,
      userId: req.user?.id,
      roles: req.user?.roleNames,
    });

    if (!allowed) return;


    const { id } = req.params;
    const role = (req.user?.roleNames?.[0] || "").toLowerCase();

    const where = { id };
    if (!isSuperAdmin(req.user)) {
      where.organization_id = req.user.organization_id;
      if (role === "facility_head") {
        where.facility_id = req.user.facility_id; // 🔒 restrict to their facility
      }
    }

    const employee = await Employee.findOne({ where });
    if (!employee) return error(res, "Employee not found", null, 404);

    const [ACTIVE, INACTIVE] = EMPLOYEE_STATUS;
    const newStatus = employee.status === ACTIVE ? INACTIVE : ACTIVE;

    await employee.update({ status: newStatus, updated_by_id: req.user?.id || null });

    // 🔥 reload full record with associations
    const full = await Employee.findOne({ where: { id }, include: EMPLOYEE_INCLUDES });

    await auditService.logAction({
      user: req.user,
      module: "employee",
      action: "toggle_status",
      entityId: id,
      entity: full, // 👈 now capturing the full employee record
      details: { from: employee.status, to: newStatus },
    });

    return success(res, `Employee status set to ${newStatus}`, full);
  } catch (err) {
    return error(res, "Failed to toggle employee status", err);
  }
};

/* ============================================================
   📌 GET ALL EMPLOYEES
   ============================================================ */
export const getAllEmployees = async (req, res) => {
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module: "employee",
      action: "read",
      res,
    });

    debug.log("PERMISSION CHECK", {
      module: "employee",
      action: "read",
      allowed,
      userId: req.user?.id,
      roles: req.user?.roleNames,
    });

    if (!allowed) return;

    const role = (req.user?.roleNames?.[0] || "staff").toLowerCase();
    const visibleFields =
      FIELD_VISIBILITY_EMPLOYEE[role] || FIELD_VISIBILITY_EMPLOYEE.staff;

    const options = buildQueryOptions(req, "last_name", "ASC", visibleFields);

    // 🔒 Scope
    if (!isSuperAdmin(req.user)) {
      options.where = {
        ...(options.where || {}),
        organization_id: req.user.organization_id,
      };
      if (role === "facility_head") {
        options.where.facility_id = req.user.facility_id;
      }
    }

    // ✅ Handle global (UUID from autocomplete)
    if (req.query.global) {
      options.where = {
        ...(options.where || {}),
        id: req.query.global,   // direct match on employee.id
      };
    }

    // 🔎 Search support
    if (options.search && !req.query.global) {
      options.where[Op.or] = [
        { first_name: { [Op.iLike]: `%${options.search}%` } },
        { last_name: { [Op.iLike]: `%${options.search}%` } },
        { employee_no: { [Op.iLike]: `%${options.search}%` } },
      ];
    }

    const { count, rows } = await Employee.findAndCountAll({
      where: options.where,
      include: EMPLOYEE_INCLUDES,

      order: options.order?.length ? options.order : [["last_name", "ASC"]],
      offset: options.offset,
      limit: options.limit,
    });

    await auditService.logAction({
      user: req.user,
      module: "employee",
      action: "list",
      details: { query: req.query, returned: count },
    });

    return success(res, "✅ Employees loaded", {
      records: rows,
      pagination: {
        total: count,
        page: options.pagination.page,
        pageCount: Math.ceil(count / options.pagination.limit),
      },
    });
  } catch (err) {
    return error(res, "❌ Failed to load employees", err);
  }
};

/* ============================================================
   📌 GET EMPLOYEE BY ID (full record)
   ============================================================ */
export const getEmployeeById = async (req, res) => {
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module: "employee",
      action: "read",
      res,
    });
    debug.log("PERMISSION CHECK", {
      module: "employee",
      action: "read",
      allowed,
      userId: req.user?.id,
      roles: req.user?.roleNames,
    });

    if (!allowed) return;
    const { id } = req.params;
    const role = (req.user?.roleNames?.[0] || "").toLowerCase();

    const where = { id };
    if (!isSuperAdmin(req.user)) {
      where.organization_id = req.user.organization_id;
      if (role === "facility_head") {
        where.facility_id = req.user.facility_id; // 🔒 restrict
      }
    }

    const employee = await Employee.findOne({
      where,
      include: EMPLOYEE_INCLUDES,
    });

    if (!employee) return error(res, "❌ Employee not found", null, 404);

    await auditService.logAction({
      user: req.user,
      module: "employee",
      action: "view",
      entityId: id,
      entity: employee, // ✅ log entity so org/facility are captured
    });

    return success(res, "✅ Employee loaded", employee);
  } catch (err) {
    return error(res, "❌ Failed to load employee", err);
  }
};

/* ============================================================
   📌 GET ALL EMPLOYEES LITE WITH EMAIL (with ?q= and ?position support)
============================================================ */
export const getAllEmployeesLiteWithEmail = async (req, res) => {
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module: "employee",
      action: "read",
      res,
    });

    debug.log("PERMISSION CHECK", {
      module: "employee",
      action: "read",
      allowed,
      userId: req.user?.id,
      roles: req.user?.roleNames,
    });

    if (!allowed) return;

    const { q, position } = req.query;
    const role = (req.user?.roleNames?.[0] || "").toLowerCase();

    const where = { deleted_at: null, status: "active" };

    /* ================= TENANT SCOPE ================= */
    if (!isSuperAdmin(req.user)) {
      const orgId =
        req.user.organization_id ||
        req.user.organization?.id ||
        req.user.org_id;

      debug.log("TENANT SCOPE (lite+email)", {
        role,
        orgId,
        facilityId: req.user.facility_id || null,
      });

      if (!orgId) {
        throw new Error("Tenant violation: user missing organization_id");
      }

      where.organization_id = orgId;

      if (role === "facility_head") {
        where.facility_id = req.user.facility_id;
      }
    }

    /* ================= SEARCH ================= */
    if (q) {
      where[Op.or] = [
        { first_name: { [Op.iLike]: `%${q}%` } },
        { middle_name: { [Op.iLike]: `%${q}%` } },
        { last_name: { [Op.iLike]: `%${q}%` } },
        { email: { [Op.iLike]: `%${q}%` } },
        { employee_no: { [Op.iLike]: `%${q}%` } },
      ];
    }

    if (position) {
      where.position = position;
    }

    const employees = await Employee.findAll({
      where,
      attributes: [
        "id",
        "employee_no",
        "first_name",
        "middle_name",
        "last_name",
        "email",
      ],
      order: [[
        sequelize.fn(
          "concat_ws",
          " ",
          sequelize.col("first_name"),
          sequelize.col("middle_name"),
          sequelize.col("last_name")
        ),
        "ASC",
      ]],
      limit: 20,
    });

    const result = employees.map(emp => ({
      id: emp.id,
      employee_no: emp.employee_no,
      full_name: [emp.first_name, emp.middle_name, emp.last_name]
        .filter(Boolean)
        .join(" ")
        .replace(/\s+/g, " ")
        .trim(),
      email: emp.email || "",
    }));

    await auditService.logAction({
      user: req.user,
      module: "employee",
      action: "list_lite_email",
      details: {
        count: result.length,
        query: q || null,
        position: position || null,
      },
    });

    return success(res, "✅ Employees loaded (lite + email)", {
      records: result,
    });
  } catch (err) {
    debug.error("getAllEmployeesLiteWithEmail → FAILED", err);
    return error(res, "❌ Failed to load employees (lite + email)", err);
  }
};


/* ============================================================
   📌 GET ALL EMPLOYEES LITE (with ?q and ?position support)
============================================================ */
export const getAllEmployeesLite = async (req, res) => {
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module: "employee",
      action: "read",
      res,
    });

    debug.log("PERMISSION CHECK", {
      module: "employee",
      action: "read",
      allowed,
      userId: req.user?.id,
      roles: req.user?.roleNames,
    });

    if (!allowed) return;

    const { q, position } = req.query;
    const role = (req.user?.roleNames?.[0] || "").toLowerCase();

    const where = { deleted_at: null, status: "active" };

    /* ================= TENANT SCOPE ================= */
    if (!isSuperAdmin(req.user)) {
      const orgId =
        req.user.organization_id ||
        req.user.organization?.id ||
        req.user.org_id;

      debug.log("TENANT SCOPE (lite)", {
        role,
        orgId,
        facilityId: req.user.facility_id || null,
      });

      if (!orgId) {
        throw new Error("Tenant violation: user missing organization_id");
      }

      where.organization_id = orgId;

      if (role === "facility_head") {
        where.facility_id = req.user.facility_id;
      }
    }

    /* ================= SEARCH ================= */
    if (q) {
      where[Op.or] = [
        { first_name: { [Op.iLike]: `%${q}%` } },
        { middle_name: { [Op.iLike]: `%${q}%` } },
        { last_name: { [Op.iLike]: `%${q}%` } },
        { employee_no: { [Op.iLike]: `%${q}%` } },
      ];
    }

    if (position) {
      where.position = position;
    }

    const employees = await Employee.findAll({
      where,
      attributes: [
        "id",
        "employee_no",
        "first_name",
        "middle_name",
        "last_name",
      ],
      order: [[
        sequelize.fn(
          "concat_ws",
          " ",
          sequelize.col("first_name"),
          sequelize.col("middle_name"),
          sequelize.col("last_name")
        ),
        "ASC",
      ]],
      limit: 20,
    });

    const result = employees.map(emp => {
      const fullName = [emp.first_name, emp.middle_name, emp.last_name]
        .filter(Boolean)
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();

      return {
        id: emp.id,
        employee_no: emp.employee_no,
        full_name: fullName,
        label: emp.employee_no
          ? `${fullName} (${emp.employee_no})`
          : fullName,
      };
    });

    await auditService.logAction({
      user: req.user,
      module: "employee",
      action: "list_lite",
      details: {
        query: q || null,
        position: position || null,
        count: result.length,
      },
    });

    return success(res, "✅ Employees loaded (lite)", {
      records: result,
    });
  } catch (err) {
    debug.error("getAllEmployeesLite → FAILED", err);
    return error(res, "❌ Failed to load employees (lite)", err);
  }
};
