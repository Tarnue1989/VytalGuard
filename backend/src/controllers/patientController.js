// 📁 backend/src/controllers/patientController.js
import Joi from "joi";
import fs from "fs";
import path from "path";
import { Op } from "sequelize";
import { sequelize, Patient, Facility, User, Organization, Employee } from "../models/index.js";
import { success, error } from "../utils/response.js";
import { buildQueryOptions } from "../utils/queryHelper.js";
import {
  GENDER_TYPES,
  DOB_PRECISION,
  MARITAL_STATUS,
  RELIGIONS,
  REGISTRATION_LOG_STATUS,
} from "../constants/enums.js";
import { authzService } from "../services/authzService.js";
import { auditService } from "../services/auditService.js";
import { FIELD_VISIBILITY_PATIENT } from "../constants/fieldVisibility.js";
import { generatePatientQR } from "../services/qrService.js";

import {
  isSuperAdmin,
  isOrgLevelUser,
  isFacilityHead,
} from "../utils/role-utils.js";

import { normalizeDateOnlyFields } from "../utils/date-utils.js";
import { resolveOrgFacility } from "../utils/resolveOrgFacility.js";
import { makeModuleLogger } from "../utils/debugLogger.js";
import { validate } from "../utils/validation.js";

/* ============================================================
   🔧 LOCAL DEBUG OVERRIDE (PATIENT CONTROLLER)
   true  = debug ON for this file only
   false = debug OFF (default / production safe)
============================================================ */
const DEBUG_OVERRIDE = true; // 👈 keep OFF normally
const debug = makeModuleLogger("patientController", DEBUG_OVERRIDE);


// Helper to generate unique patient number per org
async function generateNextPatientNo(orgId) {
  // get organization code for readability
  const org = await Organization.findByPk(orgId, { attributes: ["code"] });
  const prefix = org?.code ? `PAT-${org.code}-` : "PAT-";

  // find latest patient in this org
  const latest = await Patient.findOne({
    where: { organization_id: orgId },
    order: [["created_at", "DESC"]],
    attributes: ["pat_no"],
    paranoid: false,
  });

  let nextSeq = 1;
  if (latest?.pat_no) {
    const match = latest.pat_no.match(/(\d+)$/);
    if (match) nextSeq = parseInt(match[1], 10) + 1;
  }

  return `${prefix}${String(nextSeq).padStart(4, "0")}`;
}

/* ============================================================
   🔗 SHARED INCLUDES
   ============================================================ */
const PATIENT_INCLUDES = [
  {
    model: Organization,
    as: "organization",
    required: true,   // org MUST exist
    attributes: ["id", "name", "code"],
  },
  {
    model: Facility,
    as: "facility",
    required: false,  // ⭐ CRITICAL: allow NULL facility
    attributes: ["id", "name", "code", "organization_id"],
  },
  {
    model: Employee,
    as: "registeredBy",
    required: false,
    attributes: ["id", "first_name", "last_name", "employee_no"],
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
   📋 ROLE-AWARE JOI SCHEMA (Employee-Parity, FINAL)
   ============================================================ */
function buildPatientSchema(user, mode = "create") {
  const base = {
    // ================= Identity =================
    pat_no: Joi.string().max(50).allow("", null),
    first_name: Joi.string().max(120).required(),
    middle_name: Joi.string().max(120).allow("", null),
    last_name: Joi.string().max(120).required(),
    date_of_birth: Joi.date().allow(null),
    date_of_birth_precision: Joi.string()
      .valid(...DOB_PRECISION)
      .allow("", null),
    gender: Joi.string()
      .valid(...GENDER_TYPES)
      .allow("", null),

    // ================= Contact =================
    phone_number: Joi.string().allow("", null),
    email_address: Joi.string().email().allow("", null),
    home_address: Joi.string().allow("", null),

    // ================= Demographics =================
    marital_status: Joi.string()
      .valid(...MARITAL_STATUS)
      .allow("", null),
    religion: Joi.string()
      .valid(...RELIGIONS)
      .allow("", null),
    profession: Joi.string().max(120).allow("", null),

    // ================= Identifiers =================
    national_id: Joi.string().max(50).allow("", null),
    insurance_number: Joi.string().max(50).allow("", null),
    passport_number: Joi.string().max(50).allow("", null),

    // ================= Emergency =================
    emergency_contact_name: Joi.string().allow("", null),
    emergency_contact_phone: Joi.string().allow("", null),

    // ================= Notes =================
    notes: Joi.string().allow("", null),

    // ================= Registration =================
    employee_id: Joi.string().uuid().allow("", null),

    // ================= System =================
    organization_id: Joi.forbidden(), // 🔒 derived from session
    facility_id: Joi.string().uuid().allow("", null),

    // ================= File Flags =================
    remove_photo: Joi.alternatives().try(
      Joi.boolean(),
      Joi.string().valid("true", "false")
    ),
    remove_qr_code: Joi.alternatives().try(
      Joi.boolean(),
      Joi.string().valid("true", "false")
    ),
  };

  /* ============================================================
     🔓 SUPER ADMIN OVERRIDE (EXACT Employee parity)
     ============================================================ */
  if (isSuperAdmin(user)) {
    base.organization_id = Joi.string().uuid().allow("", null);
    base.facility_id = Joi.string().uuid().allow("", null);
  }

  /* ============================================================
     ✏️ UPDATE MODE (all fields optional)
     ============================================================ */
  if (mode === "update") {
    Object.keys(base).forEach((key) => {
      base[key] = base[key].optional();
    });
  }

  return Joi.object(base);
}

/* ============================================================
   📌 CREATE + UPDATE PATIENT (Enterprise-Aligned, Employee-Parity)
   ============================================================ */
/* ============================
   CREATE PATIENT
============================ */
export const createPatient = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module: "patient",
      action: "create",
      res,
    });
    if (!allowed) return;

    /* ================= DEBUG: INCOMING ================= */
    debug.log("create → incoming body", req.body);

    /* ================= VALIDATION ================= */
    const { value, errors } = validate(
      buildPatientSchema(req.user, "create"),
      req.body
    );

    if (errors) {
      debug.warn("create → validation error", errors);
      await t.rollback();
      return res.status(400).json({ success: false, errors });
    }

    debug.log("create → validated value", value);

    /* ================= NORMALIZATION ================= */
    normalizeDateOnlyFields(value, ["date_of_birth"]);

    if (typeof value.email_address === "string") {
      value.email_address = value.email_address.trim().toLowerCase() || null;
    }
    if (typeof value.phone_number === "string") {
      value.phone_number = value.phone_number.trim() || null;
    }

    /* ================= ORG / FACILITY ================= */
    const { orgId, facilityId } = resolveOrgFacility({
      user: req.user,
      value,
      body: req.body,
    });

    debug.log("create → resolved scope", {
      organization_id: orgId,
      facility_id: facilityId,
    });

    if (!orgId) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        errors: [{ field: "organization_id", message: "Organization is required" }],
      });
    }

    /* ================= PATIENT NUMBER ================= */
    if (!value.pat_no || value.pat_no.trim() === "") {
      value.pat_no = await generateNextPatientNo(orgId);
    }

    /* ================= FINAL PAYLOAD ================= */
    debug.log("create → final payload", {
      ...value,
      organization_id: orgId,
      facility_id: facilityId,
    });

    /* ================= CREATE ================= */
    const created = await Patient.create(
      {
        ...value,
        organization_id: orgId,
        facility_id: facilityId,
        created_by_id: req.user?.id || null,
      },
      { transaction: t }
    );

    const qrPath = await generatePatientQR(created.id, created.pat_no);
    await created.update({ qr_code_path: qrPath }, { transaction: t });

    await t.commit();

    debug.log("create → committed", { patientId: created.id });

    const full = await Patient.findOne({
      where: { id: created.id },
      include: PATIENT_INCLUDES,
    });

    await auditService.logAction({
      user: req.user,
      module: "patient",
      action: "create",
      entityId: created.id,
      entity: full,
    });

    return success(res, "✅ Patient created", full);
  } catch (err) {
    debug.error("create → ERROR", err);
    await t.rollback();
    throw err;
  }
};


/* ============================
   UPDATE PATIENT
============================ */
export const updatePatient = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module: "patient",
      action: "update",
      res,
    });
    if (!allowed) return;

    const { id } = req.params;

    /* ================= DEBUG: INCOMING ================= */
    debug.log("update → incoming body", req.body);

    /* ================= VALIDATION ================= */
    const { value, errors } = validate(
      buildPatientSchema(req.user, "update"),
      req.body
    );

    if (errors) {
      debug.warn("update → validation error", errors);
      await t.rollback();
      return res.status(400).json({ success: false, errors });
    }

    debug.log("update → validated payload", value);

    normalizeDateOnlyFields(value, ["date_of_birth"]);

    if (typeof value.email_address === "string") {
      value.email_address = value.email_address.trim().toLowerCase() || null;
    }
    if (typeof value.phone_number === "string") {
      value.phone_number = value.phone_number.trim() || null;
    }

    /* ================= LOAD PATIENT ================= */
    const where = { id };
    if (!isSuperAdmin(req.user)) {
      where.organization_id = req.user.organization_id;
    }

    const patient = await Patient.findOne({ where, transaction: t });
    if (!patient) {
      await t.rollback();
      return error(res, "Patient not found", null, 404);
    }

    /* ================= DEBUG: BEFORE ================= */
    debug.log("update → before", patient.toJSON());

    const { orgId, facilityId } = resolveOrgFacility({
      user: req.user,
      value,
      body: req.body,
    });

    /* ================= UPDATE ================= */
    await patient.update(
      {
        ...value,
        organization_id: orgId,
        facility_id: facilityId,
        updated_by_id: req.user?.id || null,
      },
      { transaction: t }
    );

    /* ================= DEBUG: AFTER ================= */
    debug.log("update → after", patient.toJSON());

    if (
      !patient.qr_code_path ||
      (value.pat_no && value.pat_no !== patient.pat_no)
    ) {
      const qrPath = await generatePatientQR(
        patient.id,
        value.pat_no || patient.pat_no
      );
      await patient.update({ qr_code_path: qrPath }, { transaction: t });
    }

    await t.commit();

    debug.log("update → committed", { patientId: id });

    const full = await Patient.findOne({
      where: { id },
      include: PATIENT_INCLUDES,
    });

    await auditService.logAction({
      user: req.user,
      module: "patient",
      action: "update",
      entityId: id,
      entity: full,
    });

    return success(res, "✅ Patient updated", full);
  } catch (err) {
    debug.error("update → FAILED", err);
    await t.rollback();
    throw err;
  }
};



/* ============================================================
   📌 TOGGLE PATIENT STATUS
   ============================================================ */
export const togglePatientStatus = async (req, res) => {
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module: "patient",
      action: "update",
      res,
    });
    debug.log("PERMISSION CHECK", {
      module: "patient",
      action: "update",
      allowed,
      userId: req.user?.id,
      roles: req.user?.roleNames,
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

    const patient = await Patient.findOne({ where });
    if (!patient) return error(res, "Patient not found", null, 404);

    /* ================= STATUS TOGGLE ================= */
    const [, , ACTIVE, , CANCELLED] = REGISTRATION_LOG_STATUS;
    const newStatus =
      patient.registration_status === ACTIVE ? CANCELLED : ACTIVE;

    await patient.update({
      registration_status: newStatus,
      updated_by_id: req.user?.id || null,
    });

    const full = await Patient.findOne({
      where: { id },
      include: PATIENT_INCLUDES,
    });

    await auditService.logAction({
      user: req.user,
      module: "patient",
      action: "toggle_status",
      entityId: id,
      entity: full,
      details: {
        from: patient.registration_status,
        to: newStatus,
      },
    });

    return success(res, `Patient status set to ${newStatus}`, full);
  } catch (err) {
    debug.error("toggle_status → FAILED", err);
    return error(res, "Failed to toggle patient status", err);
  }
};

/* ============================================================
   📌 GET ALL PATIENTS (Enterprise-Aligned)
   ============================================================ */
export const getAllPatients = async (req, res) => {
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module: "patient",
      action: "read",
      res,
    });
    debug.log("PERMISSION CHECK", {
      module: "patient",
      action: "read",
      allowed,
      userId: req.user?.id,
      roles: req.user?.roleNames,
    });
    if (!allowed) return;

    const roleKey = (req.user?.roleNames?.[0] || "staff").toLowerCase();
    const visibleFields =
      FIELD_VISIBILITY_PATIENT[roleKey] || FIELD_VISIBILITY_PATIENT.staff;

    const options = buildQueryOptions(req, "last_name", "ASC", visibleFields);

    /* ================= TENANT SCOPE ================= */
    if (!isSuperAdmin(req.user)) {
      options.where = {
        ...(options.where || {}),
        organization_id: req.user.organization_id,
      };

      if (isFacilityHead(req.user)) {
        options.where.facility_id = req.user.facility_id;
      }
    }

    /* ================= GLOBAL FILTER ================= */
    if (req.query.global) {
      options.where = {
        ...(options.where || {}),
        id: req.query.global,
      };
    }

    /* ================= TEXT SEARCH ================= */
    if (options.search && !req.query.global) {
      options.where[Op.or] = [
        { first_name: { [Op.iLike]: `%${options.search}%` } },
        { last_name: { [Op.iLike]: `%${options.search}%` } },
        { middle_name: { [Op.iLike]: `%${options.search}%` } },
        { pat_no: { [Op.iLike]: `%${options.search}%` } },
        { phone_number: { [Op.iLike]: `%${options.search}%` } },
        { email_address: { [Op.iLike]: `%${options.search}%` } },
      ];
    }

    const { count, rows } = await Patient.findAndCountAll({
      where: options.where,
      include: PATIENT_INCLUDES,
      order: options.order?.length ? options.order : [["last_name", "ASC"]],
      offset: options.offset,
      limit: options.limit,
      distinct: true,
      subQuery: false,
    });

    await auditService.logAction({
      user: req.user,
      module: "patient",
      action: "list",
      details: { query: req.query, returned: count },
    });

    return success(res, "✅ Patients loaded", {
      records: rows,
      pagination: {
        total: count,
        page: options.pagination.page,
        pageCount: Math.ceil(count / options.pagination.limit),
      },
    });
  } catch (err) {
    debug.error("list → FAILED", err);
    return error(res, "❌ Failed to load patients", err);
  }
};

/* ============================================================
   📌 GET PATIENT BY ID
   ============================================================ */
export const getPatientById = async (req, res) => {
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module: "patient",
      action: "read",
      res,
    });
    debug.log("PERMISSION CHECK", {
      module: "patient",
      action: "read",
      allowed,
      userId: req.user?.id,
      roles: req.user?.roleNames,
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

    const patient = await Patient.findOne({
      where,
      include: PATIENT_INCLUDES,
    });
    if (!patient) return error(res, "❌ Patient not found", null, 404);

    await auditService.logAction({
      user: req.user,
      module: "patient",
      action: "view",
      entityId: id,
      entity: patient,
    });

    return success(res, "✅ Patient loaded", patient);
  } catch (err) {
    debug.error("getById → FAILED", err);
    return error(res, "❌ Failed to load patient", err);
  }
};

/* ============================================================
   📌 GET ALL PATIENTS LITE WITH CONTACT
   ============================================================ */
export const getAllPatientsLiteWithContact = async (req, res) => {
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module: "patient",
      action: "read",
      res,
    });
    debug.log("PERMISSION CHECK", {
      module: "patient",
      action: "read",
      allowed,
      userId: req.user?.id,
      roles: req.user?.roleNames,
    });
    if (!allowed) return;

    const { q } = req.query;

    /* ================= TENANT SCOPE ================= */
    const where = { deleted_at: null };
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
        { pat_no: { [Op.iLike]: `%${q}%` } },
        { phone_number: { [Op.iLike]: `%${q}%` } },
        { email_address: { [Op.iLike]: `%${q}%` } },
      ];
    }

    const patients = await Patient.findAll({
      where,
      attributes: [
        "id",
        "pat_no",
        "first_name",
        "middle_name",
        "last_name",
        "phone_number",
        "email_address",
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

    const result = patients.map((p) => ({
      id: p.id,
      pat_no: p.pat_no,
      full_name: [p.first_name, p.middle_name, p.last_name]
        .filter(Boolean)
        .join(" ")
        .replace(/\s+/g, " ")
        .trim(),
      phone: p.phone_number || "",
      email: p.email_address || "",
    }));

    await auditService.logAction({
      user: req.user,
      module: "patient",
      action: "list_lite_contact",
      details: { count: result.length, query: q || null },
    });

    return success(res, "✅ Patients loaded (lite + contact)", {
      records: result,
    });
  } catch (err) {
    debug.error("list_lite_contact → FAILED", err);
    return error(res, "❌ Failed to load patients (lite + contact)", err);
  }
};


/* ============================================================
   📌 GET ALL PATIENTS LITE (ID + NAME)
   ============================================================ */
export const getAllPatientsLite = async (req, res) => {
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module: "patient",
      action: "read",
      res,
    });
    debug.log("PERMISSION CHECK", {
      module: "patient",
      action: "read",
      allowed,
      userId: req.user?.id,
      roles: req.user?.roleNames,
    });
    if (!allowed) return;

    const { q } = req.query;

    /* ================= TENANT SCOPE ================= */
    const where = { deleted_at: null };
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
        { pat_no: { [Op.iLike]: `%${q}%` } },
      ];
    }

    const patients = await Patient.findAll({
      where,
      attributes: ["id", "pat_no", "first_name", "middle_name", "last_name"],
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

    const result = patients.map((p) => {
      const fullName = [p.first_name, p.middle_name, p.last_name]
        .filter(Boolean)
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();

      return {
        id: p.id,
        pat_no: p.pat_no,
        full_name: fullName,
        label: p.pat_no ? `${fullName} (${p.pat_no})` : fullName,
      };
    });

    await auditService.logAction({
      user: req.user,
      module: "patient",
      action: "list_lite",
      details: { query: q || null, count: result.length },
    });

    return success(res, "✅ Patients loaded (lite)", { records: result });
  } catch (err) {
    debug.error("list_lite → FAILED", err);
    return error(res, "❌ Failed to load patients (lite)", err);
  }
};


/* ============================================================
   📌 DELETE PATIENT (Soft Delete + File Cleanup)
   ============================================================ */
export const deletePatient = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module: "patient",
      action: "delete",
      res,
    });
    debug.log("PERMISSION CHECK", {
      module: "patient",
      action: "delete",
      allowed,
      userId: req.user?.id,
      roles: req.user?.roleNames,
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

    const patient = await Patient.findOne({ where, transaction: t });
    if (!patient) {
      await t.rollback();
      return error(res, "Patient not found", null, 404);
    }

    /* ================= FILE CLEANUP ================= */
    try {
      if (patient.photo_path) {
        fs.unlinkSync(path.join(process.cwd(), patient.photo_path));
      }
      if (patient.qr_code_path) {
        fs.unlinkSync(path.join(process.cwd(), patient.qr_code_path));
      }
    } catch (fileErr) {
      // Do not block deletion if files are missing
      debug.warn("File cleanup error", { message: fileErr.message });
    }

    /* ================= SOFT DELETE ================= */
    await patient.update(
      { deleted_by_id: req.user?.id || null },
      { transaction: t }
    );
    await patient.destroy({ transaction: t });

    await t.commit();

    const full = await Patient.findOne({
      where: { id },
      include: PATIENT_INCLUDES,
      paranoid: false, // include soft-deleted
    });

    await auditService.logAction({
      user: req.user,
      module: "patient",
      action: "delete",
      entityId: id,
      entity: full,
    });

    return success(res, "✅ Patient deleted (files cleaned up)", full);
  } catch (err) {
    debug.error("delete → FAILED", err);
    await t.rollback();
    return error(res, "❌ Failed to delete patient", err);
  }
};
