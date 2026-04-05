// 📁 backend/src/controllers/patientController.js
// ============================================================================
// 🧍 Patient Controller – ENTERPRISE MASTER–ALIGNED
// ----------------------------------------------------------------------------
// 🔹 MASTER parity with Consultation Controller
// 🔹 Strict pagination ready
// 🔹 Tenant-safe (resolveOrgFacility)
// 🔹 Role-utils only (no inline role hacks)
// 🔹 Audit-safe
// ============================================================================

import Joi from "joi";
import fs from "fs";
import path from "path";
import { Op } from "sequelize";
import {
  sequelize,
  Patient,
  Facility,
  User,
  Organization,
  Employee,
} from "../models/index.js";

import { success, error } from "../utils/response.js";
import { buildQueryOptions } from "../utils/queryHelper.js";
import { validatePaginationStrict } from "../utils/query-utils.js";
import { normalizeDateOnlyFields } from "../utils/date-utils.js";
import { resolveOrgFacility } from "../utils/resolveOrgFacility.js";
import { validate } from "../utils/validation.js";
import { makeModuleLogger } from "../utils/debugLogger.js";
import { normalizeDateRangeLocal } from "../utils/date-utils.js";

import {
  GENDER_TYPES,
  DOB_PRECISION,
  MARITAL_STATUS,
  RELIGIONS,
  REGISTRATION_LOG_STATUS,
} from "../constants/enums.js";

import { FIELD_VISIBILITY_PATIENT } from "../constants/fieldVisibility.js";

import {
  isSuperAdmin,
  isFacilityHead,
} from "../utils/role-utils.js";

import { authzService } from "../services/authzService.js";
import { auditService } from "../services/auditService.js";
import { generatePatientQR } from "../services/qrService.js";


/* ============================================================
   🔐 MODULE
============================================================ */
const MODULE_KEY = "patient";

/* ============================================================
   🔧 DEBUG LOGGER (MASTER STYLE)
============================================================ */
const DEBUG_OVERRIDE = true;
const debug = makeModuleLogger("patientController", DEBUG_OVERRIDE);


/* ============================================================
   🔧 ENUM NORMALIZER (EMPTY STRING → NULL)
============================================================ */
function normalizeEnumFields(value, enumFields) {
  enumFields.forEach((field) => {
    if (value[field] === "") {
      value[field] = null;
    }
  });
}
/* ============================================================
   🔐 ENUM MAPS (ORDER-SAFE)
============================================================ */
const GENDER = Object.fromEntries(
  Object.values(GENDER_TYPES).map((v) => [v.toLowerCase(), v])
);

const REG_STATUS = Object.fromEntries(
  Object.values(REGISTRATION_LOG_STATUS).map((v) => [v.toUpperCase(), v])
);

/* ============================================================
   🔃 PATIENT SORT MAP (MODEL-AWARE)
============================================================ */
const PATIENT_SORT_MAP = {
  pat_no: ["pat_no"],
  first_name: ["first_name"],
  last_name: ["last_name"],
  gender: ["gender"],
  registration_status: ["registration_status"],
  date_of_birth: ["date_of_birth"],
  created_at: ["created_at"],
  updated_at: ["updated_at"],

  organization: [{ model: Organization, as: "organization" }, "name"],
  facility: [{ model: Facility, as: "facility" }, "name"],
};


/* ============================================================
   🔢 GENERATE PATIENT NUMBER (ORG-SCOPED)
============================================================ */
async function generateNextPatientNo(orgId) {
  const org = await Organization.findByPk(orgId, { attributes: ["code"] });
  const prefix = org?.code ? `PAT-${org.code}-` : "PAT-";

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
   🔗 SHARED INCLUDES (MASTER)
============================================================ */
const PATIENT_INCLUDES = [
  {
    model: Organization,
    as: "organization",
    attributes: ["id", "name", "code"],
  },
  {
    model: Facility,
    as: "facility",
    required: false,
    attributes: ["id", "name", "code", "organization_id"],
  },
  {
    model: Employee,
    as: "registeredBy",
    required: false,
    attributes: ["id", "first_name", "last_name", "employee_no"],
  },
  { model: User, as: "createdBy", attributes: ["id", "first_name", "last_name"] },
  { model: User, as: "updatedBy", attributes: ["id", "first_name", "last_name"] },
  { model: User, as: "deletedBy", attributes: ["id", "first_name", "last_name"] },
];

/* ============================================================
   📋 JOI SCHEMA (MASTER-ALIGNED — JSONB READY)
============================================================ */
function buildPatientSchema(user, mode = "create") {
  const base = {
    /* ================= CORE ================= */
    pat_no: Joi.string().max(50).allow("", null),

    first_name: Joi.string().max(120).required(),
    middle_name: Joi.string().max(120).allow("", null),
    last_name: Joi.string().max(120).required(),

    /* ================= DOB ================= */
    date_of_birth: Joi.date().allow(null),
    date_of_birth_precision: Joi.string()
      .valid(...Object.values(DOB_PRECISION))
      .allow("", null),

    /* ================= DEMOGRAPHICS ================= */
    gender: Joi.string()
      .valid(...Object.values(GENDER_TYPES))
      .allow("", null),

    marital_status: Joi.string()
      .valid(...Object.values(MARITAL_STATUS))
      .allow("", null),

    religion: Joi.string()
      .valid(...Object.values(RELIGIONS))
      .allow("", null),

    profession: Joi.string().max(120).allow("", null),

    /* ================= CONTACT ================= */
    phone_number: Joi.string().allow("", null),
    email_address: Joi.string().email().allow("", null),
    home_address: Joi.string().allow("", null),

    /* ================= IDENTIFIERS ================= */
    national_id: Joi.string().max(50).allow("", null),
    insurance_number: Joi.string().max(50).allow("", null),
    passport_number: Joi.string().max(50).allow("", null),

    /* ================= 🚨 EMERGENCY CONTACTS (JSONB) ================= */
    emergency_contacts: Joi.array()
      .items(
        Joi.object({
          name: Joi.string().max(120).allow("", null),
          phone: Joi.string().max(50).allow("", null),
        })
      )
      .allow(null),

    /* ================= MISC ================= */
    notes: Joi.string().allow("", null),

    employee_id: Joi.string().uuid().allow("", null),

    /* ================= TENANT ================= */
    organization_id: Joi.forbidden(),
    facility_id: Joi.forbidden(),

    /* ================= MEDIA FLAGS ================= */
    remove_photo: Joi.alternatives().try(
      Joi.boolean(),
      Joi.string().valid("true", "false")
    ),
    remove_qr_code: Joi.alternatives().try(
      Joi.boolean(),
      Joi.string().valid("true", "false")
    ),
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
   📌 CREATE PATIENT — MASTER (FINAL)
============================================================ */
export const createPatient = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module_key: MODULE_KEY,
      action: "create",
      res,
    });
    if (!allowed) return;

    /* ===== JSONB PARSE (MULTIPART SAFE) ===== */
    if (typeof req.body.emergency_contacts === "string") {
      try {
        req.body.emergency_contacts = JSON.parse(req.body.emergency_contacts);
      } catch {
        return error(res, "Validation failed", [
          { field: "emergency_contacts", message: "Invalid JSON format" },
        ], 400);
      }
    }

    /* ===== STRIP FILE-ONLY FIELDS ===== */
    delete req.body.photo_path;
    delete req.body.qr_code_path;

    /* ===== STRIP TENANT FIELDS (NON-SA) ===== */
    if (!isSuperAdmin(req.user)) {
      delete req.body.organization_id;
      delete req.body.facility_id;
    }

    const { value, errors } = validate(
      buildPatientSchema(req.user, "create"),
      req.body
    );
    if (errors) {
      await t.rollback();
      return error(res, "Validation failed", errors, 400);
    }

    normalizeDateOnlyFields(value, ["date_of_birth"]);
    normalizeEnumFields(value, [
      "gender",
      "marital_status",
      "religion"
    ]);
    if (typeof value.email_address === "string") {
      value.email_address = value.email_address.trim().toLowerCase() || null;
    }
    if (typeof value.phone_number === "string") {
      value.phone_number = value.phone_number.trim() || null;
    }

    const { orgId, facilityId } = await resolveOrgFacility({
      user: req.user,
      value,
      body: req.body,
    });

    if (!orgId) {
      await t.rollback();
      return error(res, "Organization is required", null, 400);
    }

    if (!value.pat_no || value.pat_no.trim() === "") {
      value.pat_no = await generateNextPatientNo(orgId);
    }

    /* ===== DUPLICATE CHECK (PHONE / EMAIL) ===== */
    const existingPatient = await Patient.findOne({
      where: {
        organization_id: orgId,
        [Op.or]: [
          value.phone_number ? { phone_number: value.phone_number } : null,
          value.email_address ? { email_address: value.email_address } : null,
        ].filter(Boolean),
      },
    });

    if (existingPatient) {
      await t.rollback();

      if (
        value.phone_number &&
        existingPatient.phone_number === value.phone_number
      ) {
        return error(
          res,
          "Patient with this phone number already exists in this organization",
          null,
          409
        );
      }

      if (
        value.email_address &&
        existingPatient.email_address === value.email_address
      ) {
        return error(
          res,
          "Patient with this email already exists in this organization",
          null,
          409
        );
      }
    }
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

    const full = await Patient.findOne({
      where: { id: created.id },
      include: PATIENT_INCLUDES,
    });

    await auditService.logAction({
      user: req.user,
      module_key: MODULE_KEY,
      action: "create",
      entityId: created.id,
      entity: full,
    });

    return success(res, "✅ Patient created", full);
  } catch (err) {
    await t.rollback();
    debug.error("createPatient → FAILED", err);
    return error(res, "❌ Failed to create patient", err);
  }
};

/* ============================================================
   📌 UPDATE PATIENT — MASTER (FINAL)
============================================================ */
export const updatePatient = async (req, res) => {
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

    /* ===== JSONB PARSE (MULTIPART SAFE) ===== */
    if (typeof req.body.emergency_contacts === "string") {
      try {
        req.body.emergency_contacts = JSON.parse(req.body.emergency_contacts);
      } catch {
        return error(
          res,
          "Validation failed",
          [{ field: "emergency_contacts", message: "Invalid JSON format" }],
          400
        );
      }
    }

    /* ===== STRIP FILE-ONLY FIELDS ===== */
    delete req.body.photo_path;
    delete req.body.qr_code_path;

    /* ===== STRIP TENANT FIELDS (NON-SA) ===== */
    if (!isSuperAdmin(req.user)) {
      delete req.body.organization_id;
      delete req.body.facility_id;
    }

    const { value, errors } = validate(
      buildPatientSchema(req.user, "update"),
      req.body
    );
    if (errors) {
      await t.rollback();
      return error(res, "Validation failed", errors, 400);
    }

    normalizeDateOnlyFields(value, ["date_of_birth"]);
    normalizeEnumFields(value, [
      "gender",
      "marital_status",
      "religion"
    ]);
    /* ===== UNIQUE-SAFE NORMALIZATION ===== */
    ["phone_number", "email_address"].forEach((field) => {
      if (value[field] === "") value[field] = null;
    });

    if (typeof value.email_address === "string") {
      value.email_address = value.email_address.trim().toLowerCase() || null;
    }
    if (typeof value.phone_number === "string") {
      value.phone_number = value.phone_number.trim() || null;
    }

    /* ===== LOAD PATIENT ===== */
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

    /* ========================================================
       🆔 FIX #1: PROTECT pat_no (NOT NULL)
    ======================================================== */
    if (!value.pat_no || value.pat_no.trim() === "") {
      value.pat_no = patient.pat_no;
    }

    /* ========================================================
       🧭 FIX #2: PRESERVE registration_status
    ======================================================== */
    if (!("registration_status" in value)) {
      value.registration_status = patient.registration_status;
    }

    /* ===== REMOVE FLAGS ===== */
    ["remove_photo", "remove_qr_code"].forEach((flag) => {
      if (value[flag] === "true") value[flag] = true;
      if (value[flag] === "false") value[flag] = false;
    });

    if (value.remove_photo === true) value.photo_path = null;
    if (value.remove_qr_code === true) value.qr_code_path = null;

    delete value.remove_photo;
    delete value.remove_qr_code;

    if (req.files?.photo_path?.[0]) {
      value.photo_path = `/uploads/patients/${req.files.photo_path[0].filename}`;
    }

    const { orgId, facilityId } = await resolveOrgFacility({
      user: req.user,
      value,
      body: req.body,
    });

    /* ===== UPDATE ===== */
    await patient.update(
      {
        ...value,
        organization_id: orgId,
        facility_id: facilityId,
        updated_by_id: req.user?.id || null,
      },
      { transaction: t }
    );

    /* ===== QR AUTO-REGEN ===== */
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

    const full = await Patient.findOne({
      where: { id },
      include: PATIENT_INCLUDES,
    });

    await auditService.logAction({
      user: req.user,
      module_key: MODULE_KEY,
      action: "update",
      entityId: id,
      entity: full,
    });

    return success(res, "✅ Patient updated", full);
  } catch (err) {
    await t.rollback();
    debug.error("updatePatient → FAILED", err);
    return error(res, "❌ Failed to update patient", err);
  }
};

/* ============================================================
   📌 TOGGLE PATIENT STATUS — MASTER (EXPLICIT + AUDIT-SAFE)
============================================================ */
export const togglePatientStatus = async (req, res) => {
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

    const patient = await Patient.findOne({
      where,
      transaction: t,
    });

    if (!patient) {
      await t.rollback();
      return error(res, "Patient not found", null, 404);
    }

    /* ================= STATUS TRANSITION ================= */
    const currentStatus = patient.registration_status;

    let nextStatus = null;

    if (currentStatus === REG_STATUS.ACTIVE) {
      nextStatus = REG_STATUS.CANCELLED;
    } else if (currentStatus === REG_STATUS.CANCELLED) {
      nextStatus = REG_STATUS.ACTIVE;
    } else {
      await t.rollback();
      return error(
        res,
        "❌ Invalid patient status transition",
        { from: currentStatus },
        400
      );
    }

    /* ================= UPDATE ================= */
    await patient.update(
      {
        registration_status: nextStatus,
        updated_by_id: req.user?.id || null,
      },
      { transaction: t }
    );

    await t.commit();

    const full = await Patient.findOne({
      where: { id },
      include: PATIENT_INCLUDES,
    });

    /* ================= AUDIT ================= */
    await auditService.logAction({
      user: req.user,
      module_key: MODULE_KEY,
      action: "toggle_status",
      entityId: id,
      entity: full,
      details: {
        from: currentStatus,
        to: nextStatus,
      },
    });

    return success(
      res,
      `✅ Patient status changed from ${currentStatus} to ${nextStatus}`,
      full
    );
  } catch (err) {
    await t.rollback();
    debug.error("togglePatientStatus → FAILED", err);
    return error(res, "❌ Failed to update patient status", err);
  }
};
/* ============================================================
   📌 GET ALL PATIENTS — MASTER (STRICT + FILTERS + SORT + SUMMARY)
============================================================ */
export const getAllPatients = async (req, res) => {
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
      FIELD_VISIBILITY_PATIENT[role] ||
      FIELD_VISIBILITY_PATIENT.staff;

    /* ======================================================
       🔧 SORT BRIDGE (FRONTEND + LEGACY SAFE)
    ====================================================== */
    const {
      sort_by,
      sort_order,
      sortBy,
      sortDir,
      registration_status,
      gender,
      organization_id,
      facility_id,
      dateRange,
      ...safeQuery
    } = req.query;

    const finalSortBy = sortBy || sort_by;
    const finalSortDir = sortDir || sort_order;

    safeQuery.limit = limit;
    safeQuery.page = page;
    req.query = safeQuery;

    /* ================= BASE QUERY OPTIONS ================= */
    const options = buildQueryOptions(
      req,
      "last_name",
      "ASC",
      visibleFields
    );

    options.where = { [Op.and]: [] };

    /* ================= TENANT SCOPE ================= */
    if (!isSuperAdmin(req.user)) {
      options.where[Op.and].push({
        organization_id: req.user.organization_id,
      });

      if (isFacilityHead(req.user)) {
        options.where[Op.and].push({
          facility_id: req.user.facility_id,
        });
      }
    } else {
      if (organization_id) {
        options.where[Op.and].push({ organization_id });
      }
      if (facility_id) {
        options.where[Op.and].push({ facility_id });
      }
    }

    /* ================= SEARCH ================= */
    if (options.search) {
      options.where[Op.and].push({
        [Op.or]: [
          { first_name: { [Op.iLike]: `%${options.search}%` } },
          { last_name: { [Op.iLike]: `%${options.search}%` } },
          { middle_name: { [Op.iLike]: `%${options.search}%` } },
          { pat_no: { [Op.iLike]: `%${options.search}%` } },
          { phone_number: { [Op.iLike]: `%${options.search}%` } },
          { email_address: { [Op.iLike]: `%${options.search}%` } },
        ],
      });
    }

    /* ================= STATUS FILTER ================= */
    if (registration_status) {
      options.where[Op.and].push({
        registration_status: registration_status.toLowerCase(),
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
    if (finalSortBy && PATIENT_SORT_MAP[finalSortBy]) {
      const dir =
        String(finalSortDir).toUpperCase() === "DESC" ? "DESC" : "ASC";
      order = [[...PATIENT_SORT_MAP[finalSortBy], dir]];
    }

    /* ================= MAIN QUERY ================= */
    const { count, rows } = await Patient.findAndCountAll({
      where: options.where,
      include: PATIENT_INCLUDES,
      order,
      offset,
      limit,
      distinct: true,
    });

    /* ================= SUMMARY (ENTERPRISE-CORRECT) ================= */
    const summary = {
      total: count,
      active: 0,
      cancelled: 0,
      male: 0,
      female: 0,
    };

    /* ---- status counts (page-safe) ---- */
    rows.forEach((p) => {
      if (p.registration_status === "active") summary.active++;
      if (p.registration_status === "cancelled") summary.cancelled++;
    });

    /* ---- gender counts (FULL DATASET, FILTER-SAFE) ---- */
    const genderCounts = await Patient.findAll({
      where: options.where,
      attributes: [
        "gender",
        [sequelize.fn("COUNT", sequelize.col("id")), "count"],
      ],
      group: ["gender"],
    });

    genderCounts.forEach((g) => {
      if (g.gender === "male") summary.male = Number(g.get("count"));
      if (g.gender === "female") summary.female = Number(g.get("count"));
    });

    /* ================= AUDIT ================= */
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

    return success(res, "✅ Patients loaded", {
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
    debug.error("getAllPatients → FAILED", err);
    return error(res, "❌ Failed to load patients", err);
  }
};

/* ============================================================
   📌 GET PATIENT BY ID — MASTER
============================================================ */
export const getPatientById = async (req, res) => {
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

    const patient = await Patient.findOne({
      where,
      include: PATIENT_INCLUDES,
    });

    if (!patient) {
      return error(res, "❌ Patient not found", null, 404);
    }

    await auditService.logAction({
      user: req.user,
      module_key: MODULE_KEY,
      action: "view",
      entityId: id,
      entity: patient,
    });

    return success(res, "✅ Patient loaded", patient);
  } catch (err) {
    debug.error("getPatientById → FAILED", err);
    return error(res, "❌ Failed to load patient", err);
  }
};

/* ============================================================
   📌 GET ALL PATIENTS LITE WITH CONTACT — MASTER
============================================================ */
export const getAllPatientsLiteWithContact = async (req, res) => {
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module_key: MODULE_KEY,
      action: "read",
      res,
    });
    if (!allowed) return;

    const { q } = req.query;

    const where = { deleted_at: null };

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
        { pat_no: { [Op.iLike]: `%${q}%` } },
        { phone_number: { [Op.iLike]: `%${q}%` } },
        { email_address: { [Op.iLike]: `%${q}%` } },
      ];
    }

    const rows = await Patient.findAll({
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

    const records = rows.map((p) => ({
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
      module_key: MODULE_KEY,
      action: "list_lite_contact",
      details: { count: records.length, q: q || null },
    });

    return success(res, "✅ Patients loaded (lite + contact)", {
      records,
    });
  } catch (err) {
    debug.error("getAllPatientsLiteWithContact → FAILED", err);
    return error(res, "❌ Failed to load patients (lite + contact)", err);
  }
};

/* ============================================================
   📌 GET ALL PATIENTS LITE — MASTER
============================================================ */
export const getAllPatientsLite = async (req, res) => {
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module_key: MODULE_KEY,
      action: "read",
      res,
    });
    if (!allowed) return;

    const { q } = req.query;

    const where = { deleted_at: null };

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
        { pat_no: { [Op.iLike]: `%${q}%` } },
      ];
    }

    const rows = await Patient.findAll({
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

    const records = rows.map((p) => {
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
      module_key: MODULE_KEY,
      action: "list_lite",
      details: { q: q || null, count: records.length },
    });

    return success(res, "✅ Patients loaded (lite)", { records });
  } catch (err) {
    debug.error("getAllPatientsLite → FAILED", err);
    return error(res, "❌ Failed to load patients (lite)", err);
  }
};


/* ============================================================
   📌 DELETE PATIENT — MASTER (SOFT DELETE + FILE CLEANUP)
============================================================ */
export const deletePatient = async (req, res) => {
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

    /* ================= TENANT SCOPE ================= */
    if (!isSuperAdmin(req.user)) {
      where.organization_id = req.user.organization_id;

      if (isFacilityHead(req.user)) {
        where.facility_id = req.user.facility_id;
      }
    }

    const patient = await Patient.findOne({
      where,
      transaction: t,
    });

    if (!patient) {
      await t.rollback();
      return error(res, "❌ Patient not found", null, 404);
    }

    /* ================= FILE CLEANUP (NON-BLOCKING) ================= */
    try {
      if (patient.photo_path) {
        fs.unlinkSync(path.join(process.cwd(), patient.photo_path));
      }
      if (patient.qr_code_path) {
        fs.unlinkSync(path.join(process.cwd(), patient.qr_code_path));
      }
    } catch (fileErr) {
      debug.warn("deletePatient → file cleanup warning", {
        message: fileErr.message,
      });
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
      paranoid: false,
    });

    await auditService.logAction({
      user: req.user,
      module_key: MODULE_KEY,
      action: "delete",
      entityId: id,
      entity: full,
    });

    return success(
      res,
      "✅ Patient deleted (soft delete, files cleaned up)",
      full
    );
  } catch (err) {
    await t.rollback();
    debug.error("deletePatient → FAILED", err);
    return error(res, "❌ Failed to delete patient", err);
  }
};
