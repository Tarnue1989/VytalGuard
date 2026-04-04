// 📁 controllers/medicalRecordController.js
import Joi from "joi";
import fs from "fs";
import path from "path";
import { Op } from "sequelize";
import {
  sequelize,
  MedicalRecord,
  Patient,
  Employee,
  Consultation,
  RegistrationLog,
  Invoice,
  User,
  Organization,
  Facility,
} from "../models/index.js";
import { success, error } from "../utils/response.js";
import { buildQueryOptions } from "../utils/queryHelper.js";
import { MEDICAL_RECORD_STATUS } from "../constants/enums.js";
import { authzService } from "../services/authzService.js";
import { auditService } from "../services/auditService.js";
import { FIELD_VISIBILITY_MEDICAL_RECORD } from "../constants/fieldVisibility.js";
import { resolveClinicalLinks } from "../utils/autoLinkHelpers.js";

const MS = {
  DRAFT: MEDICAL_RECORD_STATUS.DRAFT,
  REVIEWED: MEDICAL_RECORD_STATUS.REVIEWED,
  FINALIZED: MEDICAL_RECORD_STATUS.FINALIZED,
  VERIFIED: MEDICAL_RECORD_STATUS.VERIFIED,
  VOIDED: MEDICAL_RECORD_STATUS.VOIDED,
};

const MODULE_KEY = "medical_record";

/* ============================================================
   🔧 HELPERS
   ============================================================ */
function isSuperAdmin(user) {
  if (!user) return false;
  const roles = Array.isArray(user.roleNames) ? user.roleNames : [user.role || ""];
  return roles.map(r => r.toLowerCase()).includes("superadmin");
}

/* ============================================================
   🔗 SHARED INCLUDES
   ============================================================ */
const MEDICAL_RECORD_INCLUDES = [
  { model: Patient, as: "patient", attributes: ["id", "pat_no", "first_name", "last_name"] },
  { model: Employee.unscoped(), as: "doctor", attributes: ["id", "first_name", "last_name"] },
  { model: Consultation, as: "consultation", attributes: ["id", "consultation_date", "diagnosis"] },
  { model: RegistrationLog, as: "registrationLog", attributes: ["id", "registration_time", "log_status"] },
  { model: Invoice, as: "invoice", attributes: ["id", "invoice_number", "status", "total"] },
  { model: Organization, as: "organization", attributes: ["id", "name", "code"] },
  { model: Facility, as: "facility", attributes: ["id", "name", "code", "organization_id"] },
  { model: User, as: "createdBy", attributes: ["id", "first_name", "last_name"] },
  { model: User, as: "updatedBy", attributes: ["id", "first_name", "last_name"] },
  { model: User, as: "deletedBy", attributes: ["id", "first_name", "last_name"] },
  { model: User, as: "reviewedBy", attributes: ["id", "first_name", "last_name"] },
  { model: User, as: "finalizedBy", attributes: ["id", "first_name", "last_name"] },
  { model: User, as: "verifiedBy", attributes: ["id", "first_name", "last_name"] },
  { model: User, as: "voidedBy", attributes: ["id", "first_name", "last_name"] },

];

/* ============================================================
   📋 JOI SCHEMA (with empty-string → null normalization)
   ============================================================ */
function buildMedicalRecordSchema(mode = "create") {
  const base = {
    patient_id: Joi.string().uuid().required(),

    doctor_id: Joi.string().uuid().allow(null, ""),
    consultation_id: Joi.string().uuid().allow(null, ""),
    registration_log_id: Joi.string().uuid().allow(null, ""),
    invoice_id: Joi.string().uuid().allow(null, ""),

    recorded_at: Joi.date().iso().allow(null, ""),  // ✅ added

    is_emergency: Joi.boolean().default(false),
    report_path: Joi.string().allow("", null), // handled by file upload

    cc: Joi.string().allow("", null),
    hpi: Joi.string().allow("", null),
    pmh: Joi.string().allow("", null),
    fh_sh: Joi.string().allow("", null),
    nut_hx: Joi.string().allow("", null),
    imm_hx: Joi.string().allow("", null),
    obs_hx: Joi.string().allow("", null),
    gyn_hx: Joi.string().allow("", null),

    pe: Joi.string().allow("", null),
    resp_ex: Joi.string().allow("", null),
    cv_ex: Joi.string().allow("", null),
    abd_ex: Joi.string().allow("", null),
    pel_ex: Joi.string().allow("", null),
    ext: Joi.string().allow("", null),
    neuro_ex: Joi.string().allow("", null),

    ddx: Joi.string().allow("", null),
    dx: Joi.string().allow("", null),
    lab_inv: Joi.string().allow("", null),
    img_inv: Joi.string().allow("", null),
    tx_mx: Joi.string().allow("", null),
    summary_pg: Joi.string().allow("", null),

    organization_id: Joi.string().uuid().allow(null, ""),
    facility_id: Joi.string().uuid().allow(null, ""),

    // 🔒 status excluded → lifecycle endpoints control it
    remove_report: Joi.alternatives()
      .try(Joi.boolean(), Joi.string().valid("true", "false"))
      .optional(),
  };

  if (mode === "update") {
    Object.keys(base).forEach((k) => {
      base[k] = base[k].optional();
    });
  }

  return Joi.object(base);
}

/* ============================================================
   📌 CREATE MEDICAL RECORD
   ============================================================ */
export const createMedicalRecord = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module: MODULE_KEY,
      action: "create",
      res,
    });
    if (!allowed) return;

    const schema = buildMedicalRecordSchema("create");
    const { error: validationError, value } = schema.validate(req.body, {
      stripUnknown: true,
    });
    if (validationError) {
      await t.rollback();
      return error(res, "Validation failed", validationError, 400);
    }

    // 🔄 Normalize optional UUIDs (convert "" → null)
    const uuidFields = [
      "doctor_id",
      "consultation_id",
      "registration_log_id",
      "invoice_id",
      "organization_id",
      "facility_id",
    ];
    uuidFields.forEach((f) => {
      if (value[f] === "") value[f] = null;
    });

    // ✅ Ensure recorded_at is set
    if (!value.recorded_at) {
      value.recorded_at = new Date();
    }

    // handle file upload
    if (req.files?.report_file?.[0]) {
      value.report_path = `/uploads/medical-records/${req.files.report_file[0].filename}`;
    }

    // org/facility logic
    let orgId, facilityId;
    if (isSuperAdmin(req.user)) {
      orgId = value.organization_id;
      facilityId = value.facility_id;
      if (!orgId || !facilityId) {
        await t.rollback();
        return error(
          res,
          "Organization and Facility are required for superadmin",
          null,
          400
        );
      }
    } else {
      orgId = req.user.organization_id;
      facilityId = req.user.facility_id;
    }

    // 🔹 Auto-link associations
    value._currentUser = req.user;
    await resolveClinicalLinks(value, orgId, facilityId, t);

    const created = await MedicalRecord.create(
      {
        ...value,
        status: MS.DRAFT,
        organization_id: orgId,
        facility_id: facilityId,
        created_by_id: req.user?.id || null,
      },
      { transaction: t }
    );

    await t.commit();

    const full = await MedicalRecord.findOne({
      where: { id: created.id },
      include: MEDICAL_RECORD_INCLUDES,
    });

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "create",
      entityId: created.id,
      entity: full,
      details: { ...value, status: MS.DRAFT },
    });

    return success(res, "✅ Medical record created", full);
  } catch (err) {
    await t.rollback();
    return error(res, "❌ Failed to create medical record", err);
  }
};

/* ============================================================
   📌 UPDATE MEDICAL RECORD
   ============================================================ */
export const updateMedicalRecord = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module: MODULE_KEY,
      action: "update",
      res,
    });
    if (!allowed) return;

    const { id } = req.params;
    const schema = buildMedicalRecordSchema("update");
    const { error: validationError, value } = schema.validate(req.body, {
      stripUnknown: true,
    });
    if (validationError) {
      await t.rollback();
      return error(res, "Validation failed", validationError, 400);
    }

    // 🔄 Normalize optional UUIDs
    const uuidFields = [
      "doctor_id",
      "consultation_id",
      "registration_log_id",
      "invoice_id",
      "organization_id",
      "facility_id",
    ];
    uuidFields.forEach((f) => {
      if (value[f] === "") value[f] = null;
    });

    // ✅ Ensure recorded_at is not lost
    if (!value.recorded_at) {
      value.recorded_at = new Date();
    }

    // normalize remove_report flag
    if (value.remove_report === "true") value.remove_report = true;
    if (value.remove_report === "false") value.remove_report = false;

    const record = await MedicalRecord.findOne({ where: { id }, transaction: t });
    if (!record) {
      await t.rollback();
      return error(res, "Medical record not found", null, 404);
    }

    // org/facility enforcement
    let orgId, facilityId;
    if (isSuperAdmin(req.user)) {
      orgId = value.organization_id || record.organization_id;
      facilityId = value.facility_id || record.facility_id;
    } else {
      orgId = req.user.organization_id;
      facilityId = req.user.facility_id;
      value.organization_id = orgId;
      value.facility_id = facilityId;
    }

    if (value.remove_report) value.report_path = null;
    if (req.files?.report_file?.[0]) {
      value.report_path = `/uploads/medical-records/${req.files.report_file[0].filename}`;
    }

    // 🔹 Auto-link associations
    value._currentUser = req.user;
    await resolveClinicalLinks(value, orgId, facilityId, t);

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

    const full = await MedicalRecord.findOne({
      where: { id },
      include: MEDICAL_RECORD_INCLUDES,
    });

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "update",
      entityId: id,
      entity: full,
      details: value,
    });

    return success(res, "✅ Medical record updated", full);
  } catch (err) {
    await t.rollback();
    return error(res, "❌ Failed to update medical record", err);
  }
};

/* ============================================================
   📌 REVIEW MEDICAL RECORD (draft → reviewed)
   ============================================================ */
export const reviewMedicalRecord = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { id } = req.params;

    const where = { id };
    const role = (req.user?.roleNames?.[0] || "staff").toLowerCase();
    if (!isSuperAdmin(req.user)) {
      where.organization_id = req.user.organization_id;
      if (role === "facility_head") where.facility_id = req.user.facility_id;
    }

    const rec = await MedicalRecord.findOne({ where, transaction: t });
    if (!rec) return error(res, "❌ Medical record not found", null, 404);

    if (rec.status !== MS.DRAFT) {
      await t.rollback();
      return error(res, "❌ Only draft records can be reviewed", null, 400);
    }

    const oldStatus = rec.status;

    await rec.update(
      {
        status: MS.REVIEWED,
        reviewed_by_id: req.user?.id || null,
        reviewed_at: new Date(),
      },
      { transaction: t }
    );

    await t.commit();

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "review",
      entityId: id,
      entity: rec,
      details: { from: oldStatus, to: MS.REVIEWED },
    });

    return success(res, "✅ Medical record reviewed", rec);
  } catch (err) {
    await t.rollback();
    return error(res, "❌ Failed to review medical record", err);
  }
};

/* ============================================================
   📌 FINALIZE MEDICAL RECORD (reviewed → finalized)
   ============================================================ */
export const finalizeMedicalRecord = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { id } = req.params;

    const where = { id };
    const role = (req.user?.roleNames?.[0] || "staff").toLowerCase();
    if (!isSuperAdmin(req.user)) {
      where.organization_id = req.user.organization_id;
      if (role === "facility_head") where.facility_id = req.user.facility_id;
    }

    const rec = await MedicalRecord.findOne({ where, transaction: t });
    if (!rec) return error(res, "❌ Medical record not found", null, 404);

    if (rec.status !== MS.REVIEWED) {
      await t.rollback();
      return error(res, "❌ Only reviewed records can be finalized", null, 400);
    }

    const oldStatus = rec.status;

    await rec.update(
      {
        status: MS.FINALIZED,
        finalized_by_id: req.user?.id || null,
        finalized_at: new Date(),
      },
      { transaction: t }
    );

    await t.commit();

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "finalize",
      entityId: id,
      entity: rec,
      details: { from: oldStatus, to: MS.FINALIZED },
    });

    return success(res, "✅ Medical record finalized", rec);
  } catch (err) {
    await t.rollback();
    return error(res, "❌ Failed to finalize medical record", err);
  }
};

/* ============================================================
   📌 VERIFY MEDICAL RECORD (finalized → verified)
   ============================================================ */
export const verifyMedicalRecord = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { id } = req.params;

    const where = { id };
    const role = (req.user?.roleNames?.[0] || "staff").toLowerCase();
    if (!isSuperAdmin(req.user)) {
      where.organization_id = req.user.organization_id;
      if (role === "facility_head") where.facility_id = req.user.facility_id;
    }

    const rec = await MedicalRecord.findOne({ where, transaction: t });
    if (!rec) return error(res, "❌ Medical record not found", null, 404);

    if (rec.status !== MS.FINALIZED) {
      await t.rollback();
      return error(res, "❌ Only finalized records can be verified", null, 400);
    }

    const oldStatus = rec.status;

    await rec.update(
      {
        status: MS.VERIFIED,
        verified_by_id: req.user?.id || null,
        verified_at: new Date(),
      },
      { transaction: t }
    );

    await t.commit();

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "verify",
      entityId: id,
      entity: rec,
      details: { from: oldStatus, to: MS.VERIFIED },
    });

    return success(res, "✅ Medical record verified", rec);
  } catch (err) {
    await t.rollback();
    return error(res, "❌ Failed to verify medical record", err);
  }
};

/* ============================================================
   📌 VOID MEDICAL RECORD (any → voided, admin/superadmin only)
   ============================================================ */
export const voidMedicalRecord = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const role = (req.user?.roleNames?.[0] || "").toLowerCase();
    if (!["admin", "superadmin"].includes(role)) {
      return error(res, "❌ Only admin/superadmin can void medical records", null, 403);
    }

    const { id } = req.params;
    const { reason } = req.body;

    const where = { id };
    if (!isSuperAdmin(req.user)) {
      where.organization_id = req.user.organization_id;
      if (role === "facility_head") where.facility_id = req.user.facility_id;
    }

    const rec = await MedicalRecord.findOne({ where, transaction: t });
    if (!rec) return error(res, "❌ Medical record not found", null, 404);

    const oldStatus = rec.status;

    await rec.update(
      {
        status: MS.VOIDED,
        void_reason: reason || null,
        voided_by_id: req.user?.id || null,
        voided_at: new Date(),
        updated_by_id: req.user?.id || null,
      },
      { transaction: t }
    );

    await t.commit();

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "void",
      entityId: id,
      entity: rec,
      details: { from: oldStatus, to: MS.VOIDED, reason: reason || null },
    });

    return success(res, "✅ Medical record voided", rec);
  } catch (err) {
    await t.rollback();
    return error(res, "❌ Failed to void medical record", err);
  }
};

/* ============================================================
   📌 DELETE MEDICAL RECORD (Soft Delete)
   ============================================================ */
export const deleteMedicalRecord = async (req, res) => {
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
    const role = (req.user?.roleNames?.[0] || "").toLowerCase();

    const where = { id };
    if (!isSuperAdmin(req.user)) {
      // 🔒 Non-superadmin → force scoping
      where.organization_id = req.user.organization_id;
      if (role === "facility_head") {
        where.facility_id = req.user.facility_id;
      }
    } else {
      // 🟢 Superadmin → allow query scoping
      if (req.query.organization_id) where.organization_id = req.query.organization_id;
      if (req.query.facility_id) where.facility_id = req.query.facility_id;
    }

    const rec = await MedicalRecord.findOne({ where, transaction: t });
    if (!rec) {
      await t.rollback();
      return error(res, "❌ Medical record not found", null, 404);
    }

    // Soft-delete (audit trail)
    await rec.update({ deleted_by_id: req.user?.id || null }, { transaction: t });
    await rec.destroy({ transaction: t });

    await t.commit();

    // Load full record including soft-deleted
    const full = await MedicalRecord.findOne({
      where: { id },
      include: MEDICAL_RECORD_INCLUDES,
      paranoid: false,
    });

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "delete",
      entityId: id,
      entity: full,
    });

    return success(res, "✅ Medical record deleted", full);
  } catch (err) {
    await t.rollback();
    return error(res, "❌ Failed to delete medical record", err);
  }
};

/* ============================================================
   📌 GET ALL MEDICAL RECORDS LITE (with ?q + ?status support)
   ============================================================ */
export const getAllMedicalRecordsLite = async (req, res) => {
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module: MODULE_KEY,
      action: "read",
      res,
    });
    if (!allowed) return;

    const { q, status } = req.query;
    const role = (req.user?.roleNames?.[0] || "staff").toLowerCase();

    // Default filter (draft + reviewed), overridable
    let statusFilter = [MS.DRAFT, MS.REVIEWED];
    if (status) {
      const statuses = Array.isArray(status) ? status : [status];
      statusFilter = statuses;
    }
    const where = { status: { [Op.in]: statusFilter } };

    // 🔒 Apply org/facility scoping
    if (!isSuperAdmin(req.user)) {
      where.organization_id = req.user.organization_id;
      if (role === "facility_head") where.facility_id = req.user.facility_id;
    } else {
      if (req.query.organization_id) where.organization_id = req.query.organization_id;
      if (req.query.facility_id) where.facility_id = req.query.facility_id;
    }

    // 🔎 Search
    if (q) {
      where[Op.or] = [
        { cc: { [Op.iLike]: `%${q}%` } },
        { hpi: { [Op.iLike]: `%${q}%` } },
        { dx: { [Op.iLike]: `%${q}%` } },
      ];
    }

    // 🔎 Extra filters
    if (req.query.patient_id) where.patient_id = req.query.patient_id;
    if (req.query.doctor_id) where.doctor_id = req.query.doctor_id;
    if (req.query.consultation_id) where.consultation_id = req.query.consultation_id;

    const records = await MedicalRecord.findAll({
      where,
      attributes: ["id", "cc", "dx", "status"],
      include: [
        { model: Patient, as: "patient", attributes: ["id", "pat_no", "first_name", "last_name"] },
        { model: Employee.unscoped(), as: "doctor", attributes: ["id", "first_name", "last_name"] },
      ],
      order: [["created_at", "DESC"]],
      limit: 20,
    });

    const result = records.map(r => ({
      id: r.id,
      patient: r.patient
        ? `${r.patient.pat_no} - ${r.patient.first_name} ${r.patient.last_name}`
        : "",
      doctor: r.doctor ? `${r.doctor.first_name} ${r.doctor.last_name}` : "",
      cc: r.cc || "",
      dx: r.dx || "",
      status: r.status,
    }));

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "list_lite",
      details: { query: q || null, returned: result.length },
    });

    return success(res, "✅ Medical records loaded (lite)", { records: result });
  } catch (err) {
    return error(res, "❌ Failed to load medical records (lite)", err);
  }
};

/* ============================================================
   📌 GET ALL MEDICAL RECORDS (compact, with ID always included)
   ============================================================ */
export const getAllMedicalRecords = async (req, res) => {
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module: MODULE_KEY,
      action: "read",
      res,
    });
    if (!allowed) return;

    const role = (req.user?.roleNames?.[0] || "staff").toLowerCase();
    const visibleFields =
      FIELD_VISIBILITY_MEDICAL_RECORD[role] ||
      FIELD_VISIBILITY_MEDICAL_RECORD.staff;
    const safeFields = visibleFields.filter((f) => f !== "actions");

    const options = buildQueryOptions(req, "created_at", "DESC", safeFields);
    options.where = options.where || {};

    // 🔒 Scoping
    if (!isSuperAdmin(req.user)) {
      options.where.organization_id = req.user.organization_id;
      if (role === "facility_head")
        options.where.facility_id = req.user.facility_id;
    } else {
      if (req.query.organization_id)
        options.where.organization_id = req.query.organization_id;
      if (req.query.facility_id)
        options.where.facility_id = req.query.facility_id;
    }

    // 🔍 Search
    if (options.search) {
      options.where[Op.or] = [
        { cc: { [Op.iLike]: `%${options.search}%` } },
        { hpi: { [Op.iLike]: `%${options.search}%` } },
        { dx: { [Op.iLike]: `%${options.search}%` } },
      ];
    }

    // 🔍 Extra filters
    if (req.query.patient_id) options.where.patient_id = req.query.patient_id;
    if (req.query.doctor_id) options.where.doctor_id = req.query.doctor_id;
    if (req.query.consultation_id)
      options.where.consultation_id = req.query.consultation_id;

    // 🔍 Status filter
    if (req.query.status) {
      const statuses = Array.isArray(req.query.status)
        ? req.query.status
        : [req.query.status];
      options.where.status = { [Op.in]: statuses };
    }

    // 🗑️ Include deleted if admin/superadmin requests it
    if (
      ["admin", "superadmin"].includes(role) &&
      req.query.includeDeleted === "true"
    ) {
      options.paranoid = false;
    }

    /* ============================================================
       ✅ Always include "id" & "recorded_at" safely
       ============================================================ */
    const ASSOCIATION_FIELDS = [
      "organization",
      "facility",
      "patient",
      "doctor",
      "consultation",
      "registrationLog",
      "invoice",
      "createdBy",
      "updatedBy",
      "deletedBy",
      "actions",
    ];

    if (options.attributes) {
      // remove pseudo-fields
      options.attributes = options.attributes.filter(
        (f) => !ASSOCIATION_FIELDS.includes(f)
      );

      // ensure id and recorded_at always exist
      if (!options.attributes.includes("id")) options.attributes.unshift("id");
      if (!options.attributes.includes("recorded_at"))
        options.attributes.push("recorded_at");

      if (!options.attributes.length) delete options.attributes;
    } else {
      // fallback attribute set
      options.attributes = [
        "id",
        "cc",
        "hpi",
        "dx",
        "status",
        "recorded_at",
        "created_at",
      ];
    }

    // ============================================================
    // 🧩 Fetch from DB with all relevant includes
    // ============================================================
    const { count, rows } = await MedicalRecord.findAndCountAll({
      where: options.where,
      include: [...MEDICAL_RECORD_INCLUDES, ...(options.include || [])],
      order: options.order,
      offset: options.offset,
      limit: options.limit,
      attributes: options.attributes,
      paranoid: options.paranoid !== false, // default true unless overridden
    });

    // ============================================================
    // 🧾 Audit Log
    // ============================================================
    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "list",
      details: { query: req.query, returned: count },
    });

    // ============================================================
    // ✅ Response
    // ============================================================
    return success(res, "✅ Medical records loaded", {
      records: rows,
      pagination: {
        total: count,
        page: options.pagination.page,
        pageCount: Math.ceil(count / options.pagination.limit),
      },
    });
  } catch (err) {
    console.error("❌ MedicalRecord list error:", err);
    return error(res, "❌ Failed to load medical records", err);
  }
};

/* ============================================================
   📌 GET MEDICAL RECORD BY ID (Safe & Hardened)
   ============================================================ */
export const getMedicalRecordById = async (req, res) => {
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module: MODULE_KEY,
      action: "read",
      res,
    });
    if (!allowed) return;

    const { id } = req.params;

    // ✅ 1. Guard against missing or invalid UUID
    if (!id || typeof id !== "string" || !/^[0-9a-fA-F-]{36}$/.test(id)) {
      return error(res, "❌ Invalid medical record ID", null, 400);
    }

    // ✅ 2. Scoped Query
    const role = (req.user?.roleNames?.[0] || "staff").toLowerCase();
    const where = { id };

    if (!isSuperAdmin(req.user)) {
      where.organization_id = req.user.organization_id;
      if (role === "facility_head") where.facility_id = req.user.facility_id;
    } else {
      if (req.query.organization_id) where.organization_id = req.query.organization_id;
      if (req.query.facility_id) where.facility_id = req.query.facility_id;
    }

    // ✅ 3. Fetch Record with all core relations
    const record = await MedicalRecord.findOne({
      where,
      attributes: {
        include: [
          "recorded_at",
          "created_at",
          "updated_at",
          "deleted_at",
        ],
      },
      include: MEDICAL_RECORD_INCLUDES,
    });

    // ✅ 4. Handle Not Found
    if (!record) {
      return error(res, "❌ Medical record not found", null, 404);
    }

    // ✅ 5. Audit Trail
    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "view",
      entityId: id,
      entity: record,
    });

    // ✅ 6. Success Response
    return success(res, "✅ Medical record loaded", record);
  } catch (err) {
    console.error("❌ getMedicalRecordById error:", err);
    return error(res, "❌ Failed to load medical record", err);
  }
};

/* ============================================================
   📌 RESTORE MEDICAL RECORD (undo soft delete)
   ============================================================ */
export const restoreMedicalRecord = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const role = (req.user?.roleNames?.[0] || "").toLowerCase();
    if (!["admin", "superadmin"].includes(role)) {
      return error(res, "❌ Only admin/superadmin can restore medical records", null, 403);
    }

    const { id } = req.params;

    const record = await MedicalRecord.findOne({
      where: { id },
      paranoid: false, // include deleted
      transaction: t,
    });

    if (!record) {
      await t.rollback();
      return error(res, "❌ Medical record not found", null, 404);
    }

    // Only restore if actually deleted
    if (!record.deleted_at) {
      await t.rollback();
      return error(res, "❌ Medical record is not deleted", null, 400);
    }

    await record.restore({ transaction: t });
    await record.update(
      { updated_by_id: req.user?.id || null },
      { transaction: t }
    );

    await t.commit();

    const full = await MedicalRecord.findOne({
      where: { id },
      include: MEDICAL_RECORD_INCLUDES,
    });

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "restore",
      entityId: id,
      entity: full,
    });

    return success(res, "✅ Medical record restored", full);
  } catch (err) {
    await t.rollback();
    return error(res, "❌ Failed to restore medical record", err);
  }
};
