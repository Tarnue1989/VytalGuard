// ============================================================
// 📁 employeeController.js — MASTER PARITY SECTION (REPLACEMENT)
// ============================================================

import Joi from "joi";

import { Op } from "sequelize";
import {
  sequelize,
  Employee,
  Facility,
  Department,
  User,
  Organization,
} from "../models/index.js";

import { success, error } from "../utils/response.js";
import { buildQueryOptions } from "../utils/queryHelper.js";
import { validatePaginationStrict } from "../utils/query-utils.js";
import { normalizeDateRangeLocal } from "../utils/date-utils.js";

import {
  EMPLOYEE_STATUS,
  GENDER_TYPES,
  EMPLOYEE_POSITIONS,
} from "../constants/enums.js";

import { authzService } from "../services/authzService.js";
import { auditService } from "../services/auditService.js";
import { FIELD_VISIBILITY_EMPLOYEE } from "../constants/fieldVisibility.js";
import { FACILITY_REQUIRED_POSITIONS } from "../constants/employeeRules.js";

import {
  isSuperAdmin,
  isFacilityHead,
} from "../utils/role-utils.js";

import { resolveOrgFacility } from "../utils/resolveOrgFacility.js";
import { makeModuleLogger } from "../utils/debugLogger.js";
import { validate } from "../utils/validation.js";

/* ============================================================
   🔐 MODULE
============================================================ */
const MODULE_KEY = "employee";

/* ============================================================
   🔧 DEBUG LOGGER (MASTER STYLE)
============================================================ */
const DEBUG_OVERRIDE = false;
const debug = makeModuleLogger("employeeController", DEBUG_OVERRIDE);

/* ============================================================
   🔐 ENUM MAPS (ORDER-SAFE)
============================================================ */
const EMP_STATUS = Object.fromEntries(
  Object.values(EMPLOYEE_STATUS).map((v) => [v.toLowerCase(), v])
);

/* ============================================================
   🔃 EMPLOYEE SORT MAP (MODEL-AWARE)
============================================================ */
const EMPLOYEE_SORT_MAP = {
  employee_no: ["employee_no"],
  first_name: ["first_name"],
  last_name: ["last_name"],
  position: ["position"],
  status: ["status"],
  created_at: ["created_at"],
  updated_at: ["updated_at"],

  organization: [{ model: Organization, as: "organization" }, "name"],
  facility: [{ model: Facility, as: "facility" }, "name"],
  department: [{ model: Department, as: "department" }, "name"],
};

/* ============================================================
   🔗 SHARED INCLUDES (MASTER)
============================================================ */
const EMPLOYEE_INCLUDES = [
  {
    model: Organization,
    as: "organization",
    required: true,
    attributes: ["id", "name", "code"],
  },
  {
    model: Facility,
    as: "facility",
    required: false,
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
  { model: User, as: "createdBy", attributes: ["id", "first_name", "last_name"] },
  { model: User, as: "updatedBy", attributes: ["id", "first_name", "last_name"] },
  { model: User, as: "deletedBy", attributes: ["id", "first_name", "last_name"] },
];

/* ============================================================
   📋 JOI SCHEMA (MASTER-ALIGNED)
============================================================ */
function buildEmployeeSchema(user, mode = "create") {
  const base = {
    /* ================= IDENTITY ================= */
    first_name: Joi.string().max(80).required(),
    middle_name: Joi.string().max(80).allow("", null),
    last_name: Joi.string().max(80).required(),
    gender: Joi.string().valid(...Object.values(GENDER_TYPES)).required(),
    dob: Joi.date().allow(null),

    /* ================= CONTACT ================= */
    phone: Joi.string().max(30).allow("", null),
    email: Joi.string().email().allow("", null),
    address: Joi.string().allow("", null),

    /* ================= EMPLOYMENT ================= */
    employee_no: Joi.string().max(50).required(),
    position: Joi.string().valid(...Object.values(EMPLOYEE_POSITIONS)).required(),
    status: Joi.string().valid(...Object.values(EMPLOYEE_STATUS)),
    department_id: Joi.string().uuid().allow("", null),

    /* ================= CREDENTIALS ================= */
    license_no: Joi.string().allow("", null),
    specialty: Joi.string().allow("", null),
    certifications: Joi.string().allow("", null),

    /* ================= DATES ================= */
    hire_date: Joi.alternatives().try(
      Joi.date(),
      Joi.string().allow("", null)
    ),
    termination_date: Joi.alternatives().try(
      Joi.date(),
      Joi.string().allow("", null)
    ),


    /* ================= EMERGENCY ================= */
    emergency_contact_name: Joi.string().max(120).allow("", null),
    emergency_contact_phone: Joi.string().max(30).allow("", null),

    /* ================= SYSTEM ================= */
    user_id: Joi.string().uuid().allow("", null),
    organization_id: Joi.forbidden(),
    facility_id: Joi.string().uuid().allow("", null),

    /* ================= FILE FLAGS ================= */
    remove_photo: Joi.alternatives().try(Joi.boolean(), Joi.string()),
    remove_resume: Joi.alternatives().try(Joi.boolean(), Joi.string()),
    remove_document: Joi.alternatives().try(Joi.boolean(), Joi.string()),
  };

  if (isSuperAdmin(user)) {
    base.organization_id = Joi.string().uuid().allow("", null);
    base.facility_id = Joi.string().uuid().allow("", null);
  }

  if (mode === "update") {
    Object.keys(base).forEach((k) => {
      base[k] = base[k].optional();
    });
  }

  return Joi.object(base);
}
/* ============================================================
   📌 CREATE EMPLOYEE — MASTER PARITY (FINAL REPLACEMENT)
============================================================ */
export const createEmployee = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    debug.log("create → incoming body", req.body);

    const allowed = await authzService.checkPermission({
      user: req.user,
      module_key: MODULE_KEY,
      action: "create",
      res,
    });
    if (!allowed) return;

    const { value, errors } = validate(
      buildEmployeeSchema(req.user, "create"),
      req.body
    );
    if (errors) {
      await t.rollback();
      return error(res, "Validation failed", errors, 400);
    }

    ["department_id", "facility_id", "organization_id", "user_id"].forEach((f) => {
      if (!value[f] || value[f] === "") value[f] = null;
    });

    const { orgId, facilityId } = await resolveOrgFacility({
      user: req.user,
      value,
      body: req.body,
    });

    if (!orgId) {
      await t.rollback();
      return error(res, "Organization is required", null, 400);
    }

    if (
      value.position &&
      FACILITY_REQUIRED_POSITIONS.includes(value.position.toLowerCase()) &&
      !facilityId
    ) {
      await t.rollback();
      return error(
        res,
        `Facility is required for position "${value.position}"`,
        null,
        400
      );
    }

    const exists = await Employee.findOne({
      where: { organization_id: orgId, employee_no: value.employee_no },
      paranoid: false,
    });
    if (exists) {
      await t.rollback();
      return error(
        res,
        "Employee Number already exists in this organization",
        null,
        400
      );
    }

    if (req.files?.employee_photo?.[0]) {
      value.photo_path = `/uploads/employees/${req.files.employee_photo[0].filename}`;
    }
    if (req.files?.resume_url?.[0]) {
      value.resume_url = `/uploads/resumes/${req.files.resume_url[0].filename}`;
    }
    if (req.files?.document_url?.[0]) {
      value.document_url = `/uploads/documents/${req.files.document_url[0].filename}`;
    }

    if (typeof value.email === "string") {
      value.email = value.email.trim().toLowerCase() || null;
    }

    ["dob", "hire_date", "termination_date"].forEach((f) => {
      if (!value[f] || isNaN(new Date(value[f]).getTime())) value[f] = null;
    });

    value.full_name = [value.first_name, value.middle_name, value.last_name]
      .filter(Boolean)
      .join(" ")
      .trim();

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
      module_key: MODULE_KEY,
      action: "create",
      entityId: created.id,
      entity: full,
    });

    return success(res, "✅ Employee created", full);
  } catch (err) {
    await t.rollback();
    debug.error("createEmployee → FAILED", err);
    return error(res, "❌ Failed to create employee", err);
  }
};

/* ============================================================
   📌 UPDATE EMPLOYEE — MASTER PARITY (FINAL REPLACEMENT)
============================================================ */
export const updateEmployee = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module_key: MODULE_KEY,
      action: "update",
      res,
    });
    if (!allowed) return;

    const { id } = req.params;

    const { value, errors } = validate(
      buildEmployeeSchema(req.user, "update"),
      req.body
    );
    if (errors) {
      await t.rollback();
      return error(res, "Validation failed", errors, 400);
    }

    ["remove_photo", "remove_resume", "remove_document"].forEach((flag) => {
      if (value[flag] === "true") value[flag] = true;
      if (value[flag] === "false") value[flag] = false;
    });

    ["department_id", "facility_id", "organization_id", "user_id"].forEach((f) => {
      if (!value[f] || value[f] === "") value[f] = null;
    });

    const where = { id };
    if (!isSuperAdmin(req.user)) {
      where.organization_id = req.user.organization_id;
      if (isFacilityHead(req.user)) {
        where.facility_id = req.user.facility_id;
      }
    }

    const employee = await Employee.findOne({ where, transaction: t });
    if (!employee) {
      await t.rollback();
      return error(res, "Employee not found", null, 404);
    }

    const { orgId, facilityId } = await resolveOrgFacility({
      user: req.user,
      value,
      body: req.body,
    });

    if (
      value.employee_no &&
      value.employee_no !== employee.employee_no &&
      (await Employee.findOne({
        where: {
          organization_id: orgId,
          employee_no: value.employee_no,
          id: { [Op.ne]: id },
        },
        paranoid: false,
      }))
    ) {
      await t.rollback();
      return error(
        res,
        "Employee Number already exists in this organization",
        null,
        400
      );
    }

    if (
      value.position &&
      FACILITY_REQUIRED_POSITIONS.includes(value.position.toLowerCase()) &&
      !facilityId
    ) {
      await t.rollback();
      return error(
        res,
        `Facility is required for position "${value.position}"`,
        null,
        400
      );
    }

    if (value.remove_photo) value.photo_path = null;
    if (value.remove_resume) value.resume_url = null;
    if (value.remove_document) value.document_url = null;

    if (req.files?.employee_photo?.[0]) {
      value.photo_path = `/uploads/employees/${req.files.employee_photo[0].filename}`;
    }
    if (req.files?.resume_url?.[0]) {
      value.resume_url = `/uploads/resumes/${req.files.resume_url[0].filename}`;
    }
    if (req.files?.document_url?.[0]) {
      value.document_url = `/uploads/documents/${req.files.document_url[0].filename}`;
    }

    if (typeof value.email === "string") {
      value.email = value.email.trim().toLowerCase() || null;
    }

    ["dob", "hire_date", "termination_date"].forEach((f) => {
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
      module_key: MODULE_KEY,
      action: "update",
      entityId: id,
      entity: full,
    });

    return success(res, "✅ Employee updated", full);
  } catch (err) {
    await t.rollback();
    debug.error("updateEmployee → FAILED", err);
    return error(res, "❌ Failed to update employee", err);
  }
};

/* ============================================================
   📌 DELETE EMPLOYEE — MASTER PARITY (FINAL REPLACEMENT)
============================================================ */
export const deleteEmployee = async (req, res) => {
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

    const where = { id };
    if (!isSuperAdmin(req.user)) {
      where.organization_id = req.user.organization_id;
      if (isFacilityHead(req.user)) {
        where.facility_id = req.user.facility_id;
      }
    }

    const employee = await Employee.findOne({ where, transaction: t });
    if (!employee) {
      await t.rollback();
      return error(res, "Employee not found", null, 404);
    }

    if (employee.user_id) {
      const linked = await User.count({
        where: { id: employee.user_id },
        transaction: t,
      });
      if (linked > 0) {
        await t.rollback();
        return error(
          res,
          "Cannot delete — employee is linked to a user account",
          null,
          400
        );
      }
    }

    await employee.update(
      { deleted_by_id: req.user?.id || null },
      { transaction: t }
    );
    await employee.destroy({ transaction: t });

    await t.commit();

    const full = await Employee.findOne({
      where: { id },
      include: EMPLOYEE_INCLUDES,
      paranoid: false,
    });

    await auditService.logAction({
      user: req.user,
      module_key: MODULE_KEY,
      action: "delete",
      entityId: id,
      entity: full,
    });

    return success(res, "✅ Employee deleted", full);
  } catch (err) {
    await t.rollback();
    debug.error("deleteEmployee → FAILED", err);
    return error(res, "❌ Failed to delete employee", err);
  }
};


/* ============================================================
   📌 TOGGLE EMPLOYEE STATUS — MASTER PARITY (FINAL REPLACEMENT)
============================================================ */
export const toggleEmployeeStatus = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module_key: MODULE_KEY,
      action: "update",
      res,
    });
    if (!allowed) return;

    const { id } = req.params;

    /* ================= TENANT SCOPE ================= */
    const where = { id };
    if (!isSuperAdmin(req.user)) {
      where.organization_id = req.user.organization_id;
      if (isFacilityHead(req.user)) {
        where.facility_id = req.user.facility_id;
      }
    }

    const employee = await Employee.findOne({ where, transaction: t });
    if (!employee) {
      await t.rollback();
      return error(res, "Employee not found", null, 404);
    }

    /* ================= STATUS TRANSITION ================= */
    const currentStatus = employee.status;

    let nextStatus = null;
    if (currentStatus === EMP_STATUS.active) nextStatus = EMP_STATUS.inactive;
    else if (currentStatus === EMP_STATUS.inactive) nextStatus = EMP_STATUS.active;
    else {
      await t.rollback();
      return error(
        res,
        "Invalid employee status transition",
        { from: currentStatus },
        400
      );
    }

    await employee.update(
      {
        status: nextStatus,
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
      module_key: MODULE_KEY,
      action: "toggle_status",
      entityId: id,
      entity: full,
      details: { from: currentStatus, to: nextStatus },
    });

    return success(
      res,
      `✅ Employee status changed from ${currentStatus} to ${nextStatus}`,
      full
    );
  } catch (err) {
    await t.rollback();
    debug.error("toggleEmployeeStatus → FAILED", err);
    return error(res, "❌ Failed to toggle employee status", err);
  }
};
/* ============================================================
   📌 GET ALL EMPLOYEES — MASTER PARITY (FINAL + FIXED)
============================================================ */
export const getAllEmployees = async (req, res) => {
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module_key: MODULE_KEY,
      action: "read",
      res,
    });
    if (!allowed) return;

    /* ================= STRICT PAGINATION ================= */
    const { limit, page, offset } = validatePaginationStrict(req, {
      limit: 25,
      maxLimit: 200,
    });

    const role = (req.user?.roleNames?.[0] || "staff").toLowerCase();
    const visibleFields =
      FIELD_VISIBILITY_EMPLOYEE[role] ||
      FIELD_VISIBILITY_EMPLOYEE.staff;

    /* ======================================================
       🔧 SORT + FILTER BRIDGE (FULL)
    ====================================================== */
    const {
      sort_by,
      sort_order,
      sortBy,
      sortDir,
      status,
      gender,
      organization_id,
      facility_id,
      department_id,
      dateRange,
      ...safeQuery
    } = req.query;

    const finalSortBy = sortBy || sort_by;
    const finalSortDir = sortDir || sort_order;

    safeQuery.limit = limit;
    safeQuery.page = page;
    req.query = safeQuery;

    const options = buildQueryOptions(
      req,
      "last_name",
      "ASC",
      visibleFields
    );

    options.where = { [Op.and]: [] };

    /* ================= TENANT SCOPE (PATIENT PARITY) ================= */
    if (!isSuperAdmin(req.user)) {
      // Always lock organization
      options.where[Op.and].push({
        organization_id: req.user.organization_id,
      });

      // Facility Head → hard lock
      if (isFacilityHead(req.user)) {
        options.where[Op.and].push({
          facility_id: req.user.facility_id,
        });
      }
      // Org Admin → allow facility filter
      else if (facility_id) {
        options.where[Op.and].push({
          facility_id,
        });
      }
    } else {
      // Super Admin
      if (organization_id)
        options.where[Op.and].push({ organization_id });

      if (facility_id)
        options.where[Op.and].push({ facility_id });
    }

    /* ================= DEPARTMENT FILTER ================= */
    if (department_id) {
      options.where[Op.and].push({
        department_id,
      });
    }

    /* ================= SEARCH ================= */
    if (options.search) {
      options.where[Op.and].push({
        [Op.or]: [
          { first_name: { [Op.iLike]: `%${options.search}%` } },
          { middle_name: { [Op.iLike]: `%${options.search}%` } },
          { last_name: { [Op.iLike]: `%${options.search}%` } },
          { employee_no: { [Op.iLike]: `%${options.search}%` } },
        ],
      });
    }

    /* ================= STATUS FILTER ================= */
    if (status) {
      options.where[Op.and].push({
        status: status.toLowerCase(),
      });
    }

    /* ================= GENDER FILTER ================= */
    if (gender) {
      options.where[Op.and].push({
        gender: gender.toLowerCase(),
      });
    }

    /* ================= DATE RANGE ================= */
    if (dateRange) {
      const { start, end } = normalizeDateRangeLocal(dateRange);
      options.where[Op.and].push({
        created_at: { [Op.between]: [start, end] },
      });
    }

    /* ================= SORT ================= */
    let order = options.order;
    if (finalSortBy && EMPLOYEE_SORT_MAP[finalSortBy]) {
      const dir =
        String(finalSortDir).toUpperCase() === "DESC" ? "DESC" : "ASC";
      order = [[...EMPLOYEE_SORT_MAP[finalSortBy], dir]];
    }

    /* ================= MAIN QUERY ================= */
    const { count, rows } = await Employee.findAndCountAll({
      where: options.where,
      include: EMPLOYEE_INCLUDES,
      order,
      offset,
      limit,
      distinct: true,
    });

    /* ================= SUMMARY ================= */
    const summary = {
      total: count,
      active: 0,
      inactive: 0,
      male: 0,
      female: 0,
    };

    rows.forEach((e) => {
      if (e.status === EMPLOYEE_STATUS.ACTIVE) summary.active++;
      if (e.status === EMPLOYEE_STATUS.INACTIVE) summary.inactive++;
    });

    const genderCounts = await Employee.findAll({
      where: options.where,
      attributes: [
        "gender",
        [sequelize.fn("COUNT", sequelize.col("id")), "count"],
      ],
      group: ["gender"],
    });

    genderCounts.forEach((g) => {
      if (g.gender === GENDER_TYPES.MALE) summary.male = Number(g.get("count"));
      if (g.gender === GENDER_TYPES.FEMALE) summary.female = Number(g.get("count"));
    });

    await auditService.logAction({
      user: req.user,
      module_key: MODULE_KEY,
      action: "list",
      details: {
        query: safeQuery,
        returned: count,
        pagination: { page, limit },
      },
    });

    return success(res, "✅ Employees loaded", {
      records: rows,
      summary,
      pagination: {
        total: count,
        page,
        limit,
        pageCount: Math.ceil(count / limit),
      },
    });
  } catch (err) {
    debug.error("getAllEmployees → FAILED", err);
    return error(res, "❌ Failed to load employees", err);
  }
};


/* ============================================================
   📌 GET EMPLOYEE BY ID — MASTER PARITY (FINAL REPLACEMENT)
============================================================ */
export const getEmployeeById = async (req, res) => {
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module_key: MODULE_KEY,
      action: "read",
      res,
    });
    if (!allowed) return;

    const { id } = req.params;
    const where = { id };

    /* ================= TENANT SCOPE ================= */
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

    const employee = await Employee.findOne({
      where,
      include: EMPLOYEE_INCLUDES,
    });

    if (!employee) {
      return error(res, "❌ Employee not found", null, 404);
    }

    await auditService.logAction({
      user: req.user,
      module_key: MODULE_KEY,
      action: "view",
      entityId: id,
      entity: employee,
    });

    return success(res, "✅ Employee loaded", employee);
  } catch (err) {
    debug.error("getEmployeeById → FAILED", err);
    return error(res, "❌ Failed to load employee", err);
  }
};

/* ============================================================
   📌 GET ALL EMPLOYEES LITE WITH EMAIL — MASTER PARITY (REPLACEMENT)
============================================================ */
export const getAllEmployeesLiteWithEmail = async (req, res) => {
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module_key: MODULE_KEY,
      action: "read",
      res,
    });
    if (!allowed) return;

    const { q, position } = req.query;

    const where = {
      deleted_at: null,
      status: EMPLOYEE_STATUS.ACTIVE,
    };

    /* ================= TENANT SCOPE ================= */
    if (!isSuperAdmin(req.user)) {
      where.organization_id = req.user.organization_id;

      if (isFacilityHead(req.user)) {
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

    /* ================= POSITION FILTER ================= */
    if (position) {
      where.position = position;
    }

    const rows = await Employee.findAll({
      where,
      attributes: [
        "id",
        "employee_no",
        "first_name",
        "middle_name",
        "last_name",
        "email",
      ],
      order: [
        [
          sequelize.fn(
            "concat_ws",
            " ",
            sequelize.col("first_name"),
            sequelize.col("middle_name"),
            sequelize.col("last_name")
          ),
          "ASC",
        ],
      ],
      limit: 20,
    });

    const records = rows.map((e) => ({
      id: e.id,
      employee_no: e.employee_no,
      full_name: [e.first_name, e.middle_name, e.last_name]
        .filter(Boolean)
        .join(" ")
        .replace(/\s+/g, " ")
        .trim(),
      email: e.email || "",
    }));

    await auditService.logAction({
      user: req.user,
      module_key: MODULE_KEY,
      action: "list_lite_email",
      details: {
        count: records.length,
        q: q || null,
        position: position || null,
      },
    });

    return success(res, "✅ Employees loaded (lite + email)", {
      records,
    });
  } catch (err) {
    debug.error("getAllEmployeesLiteWithEmail → FAILED", err);
    return error(res, "❌ Failed to load employees (lite + email)", err);
  }
};

/* ============================================================
   📌 GET ALL EMPLOYEES LITE — MASTER PARITY (REPLACEMENT)
============================================================ */
export const getAllEmployeesLite = async (req, res) => {
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module_key: MODULE_KEY,
      action: "read",
      res,
    });
    if (!allowed) return;

    const { q, position } = req.query;

    const where = {
      deleted_at: null,
      status: EMPLOYEE_STATUS.ACTIVE,
    };

    /* ================= TENANT SCOPE ================= */
    if (!isSuperAdmin(req.user)) {
      where.organization_id = req.user.organization_id;

      if (isFacilityHead(req.user)) {
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

    /* ================= POSITION FILTER ================= */
    if (position) {
      where.position = position;
    }

    const rows = await Employee.findAll({
      where,
      attributes: [
        "id",
        "employee_no",
        "first_name",
        "middle_name",
        "last_name",
      ],
      order: [
        [
          sequelize.fn(
            "concat_ws",
            " ",
            sequelize.col("first_name"),
            sequelize.col("middle_name"),
            sequelize.col("last_name")
          ),
          "ASC",
        ],
      ],
      limit: 20,
    });

    const records = rows.map((e) => {
      const fullName = [e.first_name, e.middle_name, e.last_name]
        .filter(Boolean)
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();

      return {
        id: e.id,
        employee_no: e.employee_no,
        full_name: fullName,
        label: e.employee_no
          ? `${fullName} (${e.employee_no})`
          : fullName,
      };
    });

    await auditService.logAction({
      user: req.user,
      module_key: MODULE_KEY,
      action: "list_lite",
      details: {
        q: q || null,
        position: position || null,
        count: records.length,
      },
    });

    return success(res, "✅ Employees loaded (lite)", {
      records,
    });
  } catch (err) {
    debug.error("getAllEmployeesLite → FAILED", err);
    return error(res, "❌ Failed to load employees (lite)", err);
  }
};
