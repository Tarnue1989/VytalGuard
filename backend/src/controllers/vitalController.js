// 📁 controllers/vitalController.js
import Joi from "joi";
import { Op } from "sequelize";
import {
  sequelize,
  Vital,
  Patient,
  Employee,
  Consultation,
  Admission,
  TriageRecord,
  Facility,
  Organization,
  User,
} from "../models/index.js";
import { success, error } from "../utils/response.js";
import { buildQueryOptions } from "../utils/queryHelper.js";
import { VITAL_STATUS, ADMISSION_STATUS } from "../constants/enums.js"; // ✅ added
import { authzService } from "../services/authzService.js";
import { auditService } from "../services/auditService.js";
import { FIELD_VISIBILITY_VITAL } from "../constants/fieldVisibility.js";
import { billingService } from "../services/billingService.js";
import { shouldTriggerBilling } from "../constants/billing.js";

const MODULE_KEY = "vital";

// 🔖 Local enum maps
const VS = {
  OPEN: VITAL_STATUS[0],
  IN_PROGRESS: VITAL_STATUS[1],
  COMPLETED: VITAL_STATUS[2],
  VERIFIED: VITAL_STATUS[3],
  CANCELLED: VITAL_STATUS[4],
  VOIDED: VITAL_STATUS[5],
};

// ✅ Admission status map (enterprise-aligned, no hardcoding)
const AS = {
  ADMITTED: ADMISSION_STATUS[0],
  IN_PROGRESS: ADMISSION_STATUS[1],
  DISCHARGED: ADMISSION_STATUS[2] ?? "discharged", // fallback if present
};

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
const VITAL_INCLUDES = [
  { model: Patient, as: "patient", attributes: ["id", "pat_no", "first_name", "last_name"] },
  { model: Employee.unscoped(), as: "nurse", attributes: ["id", "first_name", "last_name"] },
  { model: Consultation, as: "consultation", attributes: ["id", "status", "diagnosis"] },
  { model: Admission, as: "admission", attributes: ["id", "status"] },
  { model: TriageRecord, as: "triageRecord", attributes: ["id", "triage_status"] },
  { model: Organization, as: "organization", attributes: ["id", "name", "code"] },
  { model: Facility, as: "facility", attributes: ["id", "name", "code", "organization_id"] },
  { model: User, as: "createdBy", attributes: ["id", "first_name", "last_name"] },
  { model: User, as: "updatedBy", attributes: ["id", "first_name", "last_name"] },
  { model: User, as: "deletedBy", attributes: ["id", "first_name", "last_name"] },
];

/* ============================================================
   📋 JOI SCHEMA (Enterprise-Aligned: Medical Record Pattern)
============================================================ */
function buildVitalSchema(mode = "create") {
  const base = {
    patient_id: Joi.string().uuid().required(),
    nurse_id: Joi.string().uuid().allow(null, ""),
    consultation_id: Joi.string().uuid().allow(null, ""),
    admission_id: Joi.string().uuid().allow(null, ""),
    triage_record_id: Joi.string().uuid().allow(null, ""),
    registration_log_id: Joi.string().uuid().allow(null, ""),

    // Clinical data
    bp: Joi.string().max(50).allow("", null),
    pulse: Joi.number().allow(null),
    rr: Joi.number().allow(null),
    temp: Joi.number().allow(null),
    oxygen: Joi.number().allow(null),
    weight: Joi.number().allow(null),
    height: Joi.number().allow(null),
    rbg: Joi.number().allow(null),
    pain_score: Joi.number().min(0).max(10).allow(null),
    position: Joi.string().allow("", null),

    recorded_at: Joi.date().iso().allow(null, ""),
    organization_id: Joi.string().uuid().allow(null, ""),
    facility_id: Joi.string().uuid().allow(null, ""),
  };

  if (mode === "update") {
    Object.keys(base).forEach((k) => (base[k] = base[k].optional()));
  }

  return Joi.object(base);
}

/* ============================================================
   📌 CREATE VITAL (Enterprise-Aligned)
============================================================ */
export const createVital = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module: MODULE_KEY,
      action: "create",
      res,
    });
    if (!allowed) return;

    const schema = buildVitalSchema("create");
    const { error: validationError, value } = schema.validate(req.body, {
      stripUnknown: true,
    });
    if (validationError) {
      await t.rollback();
      return error(res, "Validation failed", validationError, 400);
    }

    // 🔄 Normalize UUID fields
    const uuidFields = [
      "nurse_id",
      "consultation_id",
      "admission_id",
      "triage_record_id",
      "registration_log_id",
      "organization_id",
      "facility_id",
    ];
    uuidFields.forEach((f) => {
      if (value[f] === "") value[f] = null;
    });

    // ✅ Default timestamp
    if (!value.recorded_at) value.recorded_at = new Date();

    // 🧭 Org/facility logic (same as Medical Record)
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

    // 👩‍⚕️ Nurse assignment
    const nurseId = value.nurse_id || req.user.employee_id || null;

    // 🔗 Auto-link related entities (consultation/admission/triage)
    const linkFilters = { patient_id: value.patient_id, organization_id: orgId, facility_id: facilityId };

    const admission = await Admission.findOne({
      where: { ...linkFilters, status: { [Op.in]: [AS.ADMITTED, AS.IN_PROGRESS] } },
      order: [["created_at", "DESC"]],
      transaction: t,
    });
    if (admission && !value.admission_id) value.admission_id = admission.id;

    const consultation = await Consultation.findOne({
      where: { ...linkFilters, status: { [Op.in]: [VS.OPEN, VS.IN_PROGRESS] } },
      order: [["created_at", "DESC"]],
      transaction: t,
    });
    if (consultation && !value.consultation_id) value.consultation_id = consultation.id;

    const triage = await TriageRecord.findOne({
      where: { ...linkFilters, triage_status: { [Op.in]: ["open", "in_progress"] } },
      order: [["created_at", "DESC"]],
      transaction: t,
    });
    if (triage && !value.triage_record_id) value.triage_record_id = triage.id;

    // 🩺 Create
    const created = await Vital.create(
      {
        ...value,
        nurse_id: nurseId,
        status: VS.OPEN,
        organization_id: orgId,
        facility_id: facilityId,
        created_by_id: req.user?.id || null,
      },
      { transaction: t }
    );

    await t.commit();

    const full = await Vital.findOne({
      where: { id: created.id },
      include: VITAL_INCLUDES,
    });

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "create",
      entityId: created.id,
      entity: created,
      details: { ...value, status: VS.OPEN },
    });

    return success(res, "✅ Vital created successfully", full);
  } catch (err) {
    await t.rollback();
    return error(res, "❌ Failed to create vital", err);
  }
};

/* ============================================================
   📌 UPDATE VITAL (Enterprise-Aligned)
============================================================ */
export const updateVital = async (req, res) => {
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
    const schema = buildVitalSchema("update");
    const { error: validationError, value } = schema.validate(req.body, {
      stripUnknown: true,
    });
    if (validationError) {
      await t.rollback();
      return error(res, "Validation failed", validationError, 400);
    }

    // 🔄 Normalize UUID fields
    const uuidFields = [
      "nurse_id",
      "consultation_id",
      "admission_id",
      "triage_record_id",
      "registration_log_id",
      "organization_id",
      "facility_id",
    ];
    uuidFields.forEach((f) => {
      if (value[f] === "") value[f] = null;
    });

    // ✅ Default timestamp
    if (!value.recorded_at) value.recorded_at = new Date();

    const record = await Vital.findOne({ where: { id }, transaction: t });
    if (!record) {
      await t.rollback();
      return error(res, "Vital record not found", null, 404);
    }

    // 🧭 Org/facility logic
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

    const nurseId = value.nurse_id || record.nurse_id || req.user.employee_id || null;

    // 🔗 Re-resolve linked records if needed
    const linkFilters = { patient_id: value.patient_id || record.patient_id, organization_id: orgId, facility_id: facilityId };

    const admission = await Admission.findOne({
      where: { ...linkFilters, status: { [Op.in]: [AS.ADMITTED, AS.IN_PROGRESS] } },
      order: [["created_at", "DESC"]],
      transaction: t,
    });
    if (admission && !value.admission_id) value.admission_id = admission.id;

    await record.update(
      {
        ...value,
        nurse_id: nurseId,
        organization_id: orgId,
        facility_id: facilityId,
        updated_by_id: req.user?.id || null,
      },
      { transaction: t }
    );

    await t.commit();

    const full = await Vital.findOne({ where: { id }, include: VITAL_INCLUDES });

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "update",
      entityId: id,
      entity: full,
      details: value,
    });

    return success(res, "✅ Vital updated successfully", full);
  } catch (err) {
    await t.rollback();
    return error(res, "❌ Failed to update vital", err);
  }
};


/* ============================================================ 
   📌 GET ALL VITALS (with labels)
   ============================================================ */
export const getAllVitals = async (req, res) => {
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
      FIELD_VISIBILITY_VITAL[role] || FIELD_VISIBILITY_VITAL.staff;

    const options = buildQueryOptions(req, "recorded_at", "DESC", visibleFields);
    options.where = options.where || {};

    // 🔒 Org/facility scoping
    if (!isSuperAdmin(req.user)) {
      options.where.organization_id = req.user.organization_id;
      if (role === "facility_head") {
        options.where.facility_id = req.user.facility_id;
      }
    } else {
      if (req.query.organization_id) {
        options.where.organization_id = req.query.organization_id;
      }
      if (req.query.facility_id) {
        options.where.facility_id = req.query.facility_id;
      }
    }

    // ✅ Direct filters
    if (req.query.patient_id) options.where.patient_id = req.query.patient_id;
    if (req.query.nurse_id) options.where.nurse_id = req.query.nurse_id;
    if (req.query.doctor_id) options.where.doctor_id = req.query.doctor_id;
    if (req.query.status) options.where.status = req.query.status;

    // ✅ Date filters
    if (req.query["created_at[gte]"]) {
      options.where.recorded_at = {
        ...(options.where.recorded_at || {}),
        [Op.gte]: req.query["created_at[gte]"],
      };
    }
    if (req.query["created_at[lte]"]) {
      options.where.recorded_at = {
        ...(options.where.recorded_at || {}),
        [Op.lte]: req.query["created_at[lte]"],
      };
    }

    // 🔎 Unified search (bp, patient, nurse, etc.)
    if (options.search) {
      const term = `%${options.search}%`;
      options.where[Op.or] = [
        { bp: { [Op.iLike]: term } },
        { position: { [Op.iLike]: term } },
        { status: { [Op.iLike]: term } },
        sequelize.where(sequelize.cast(sequelize.col("pulse"), "TEXT"), { [Op.iLike]: term }),
        sequelize.where(sequelize.cast(sequelize.col("temp"), "TEXT"), { [Op.iLike]: term }),
        { "$patient.first_name$": { [Op.iLike]: term } },
        { "$patient.last_name$": { [Op.iLike]: term } },
        { "$patient.pat_no$": { [Op.iLike]: term } },
        { "$nurse.first_name$": { [Op.iLike]: term } },
        { "$nurse.last_name$": { [Op.iLike]: term } },
      ];
      options.include = options.include || [];
      if (!options.include.find(i => i.as === "patient")) {
        options.include.push({ model: Patient, as: "patient", attributes: [] });
      }
      if (!options.include.find(i => i.as === "nurse")) {
        options.include.push({ model: Employee.unscoped(), as: "nurse", attributes: [] });
      }
    }

    const { count, rows } = await Vital.findAndCountAll({
      where: options.where,
      include: [...VITAL_INCLUDES, ...(options.include || [])],
      order: options.order,
      offset: options.offset,
      limit: options.limit,
    });

    // 🏷️ Add friendly labels
    const records = rows.map(r => {
      const plain = r.get({ plain: true });
      const patientLabel = plain.patient
        ? `${plain.patient.pat_no} - ${plain.patient.first_name} ${plain.patient.last_name}`
        : "Unknown Patient";
      const nurseLabel = plain.nurse
        ? `${plain.nurse.first_name} ${plain.nurse.last_name}`
        : "No Nurse";
      const dateLabel = plain.recorded_at
        ? new Date(plain.recorded_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
        : "Unknown Date";

      const vitalsSummary = [
        plain.bp ? `BP: ${plain.bp}` : null,
        plain.pulse ? `Pulse: ${plain.pulse}` : null,
        plain.temp ? `Temp: ${plain.temp}` : null,
        plain.oxygen ? `O₂: ${plain.oxygen}` : null,
      ].filter(Boolean).join(" · ");

      return {
        ...plain,
        label: `${dateLabel} · ${patientLabel} · ${vitalsSummary || "Vitals"} · ${plain.status || ""}`,
        patient_label: patientLabel,
        nurse_label: nurseLabel,
      };
    });

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "list",
      details: { query: req.query, returned: count },
    });

    return success(res, "✅ Vitals loaded", {
      records,
      pagination: {
        total: count,
        page: options.pagination.page,
        pageCount: Math.ceil(count / options.pagination.limit),
      },
    });
  } catch (err) {
    return error(res, "❌ Failed to load vitals", err);
  }
};

/* ============================================================
   📌 GET VITAL BY ID (with labels)
   ============================================================ */
export const getVitalById = async (req, res) => {
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module: MODULE_KEY,
      action: "read",
      res,
    });
    if (!allowed) return;

    const { id } = req.params;
    const role = (req.user?.roleNames?.[0] || "staff").toLowerCase();

    const where = { id };
    if (!isSuperAdmin(req.user)) {
      where.organization_id = req.user.organization_id;
      if (role === "facility_head") where.facility_id = req.user.facility_id;
    } else {
      if (req.query.organization_id) where.organization_id = req.query.organization_id;
      if (req.query.facility_id) where.facility_id = req.query.facility_id;
    }

    const record = await Vital.findOne({ where, include: VITAL_INCLUDES });
    if (!record) return error(res, "❌ Vital not found", null, 404);

    const plain = record.get({ plain: true });
    const patientLabel = plain.patient
      ? `${plain.patient.pat_no} - ${plain.patient.first_name} ${plain.patient.last_name}`
      : "Unknown Patient";
    const nurseLabel = plain.nurse
      ? `${plain.nurse.first_name} ${plain.nurse.last_name}`
      : "No Nurse";
    const dateLabel = plain.recorded_at
      ? new Date(plain.recorded_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
      : "Unknown Date";

    const vitalsSummary = [
      plain.bp ? `BP: ${plain.bp}` : null,
      plain.pulse ? `Pulse: ${plain.pulse}` : null,
      plain.temp ? `Temp: ${plain.temp}` : null,
      plain.oxygen ? `O₂: ${plain.oxygen}` : null,
    ].filter(Boolean).join(" · ");

    plain.label = `${dateLabel} · ${patientLabel} · ${vitalsSummary || "Vitals"} · ${plain.status || ""}`;
    plain.patient_label = patientLabel;
    plain.nurse_label = nurseLabel;

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "view",
      entityId: id,
      entity: plain,
    });

    return success(res, "✅ Vital loaded", plain);
  } catch (err) {
    return error(res, "❌ Failed to load vital", err);
  }
};

/* ============================================================
   📌 TOGGLE VITAL STATUS
   ============================================================ */
export const toggleVitalStatus = async (req, res) => {
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
    const role = (req.user?.roleNames?.[0] || "").toLowerCase();

    const where = { id };
    if (!isSuperAdmin(req.user)) {
      where.organization_id = req.user.organization_id;
      if (role === "facility_head") where.facility_id = req.user.facility_id;
    } else {
      if (req.query.organization_id) where.organization_id = req.query.organization_id;
      if (req.query.facility_id) where.facility_id = req.query.facility_id;
    }

    const record = await Vital.findOne({ where, transaction: t });
    if (!record) {
      await t.rollback();
      return error(res, "❌ Vital not found", null, 404);
    }

    const oldStatus = record.status;
    let newStatus;

    if (record.status === VS.COMPLETED) newStatus = VS.VOIDED;
    else if (record.status === VS.VOIDED) newStatus = VS.COMPLETED;
    else newStatus = record.status;

    await record.update(
      { status: newStatus, updated_by_id: req.user?.id || null },
      { transaction: t }
    );

    if (oldStatus !== newStatus && shouldTriggerBilling(MODULE_KEY, newStatus)) {
      await billingService.triggerAutoBilling({
        module: MODULE_KEY,
        entity: record,
        user: {
          ...req.user,
          organization_id: record.organization_id,
          facility_id: record.facility_id,
        },
        transaction: t,
      });
    }

    await t.commit();

    const full = await Vital.findOne({ where: { id }, include: VITAL_INCLUDES });

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "toggle_status",
      entityId: id,
      entity: full,
      details: { from: oldStatus, to: newStatus },
    });

    return success(res, `✅ Vital status set to ${newStatus}`, full);
  } catch (err) {
    await t.rollback();
    return error(res, "❌ Failed to toggle vital status", err);
  }
};

/* ============================================================
   📌 FINALIZE VITAL (in_progress → completed)
   ============================================================ */
export const finalizeVital = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { id } = req.params;
    const record = await Vital.findByPk(id, { transaction: t });
    if (!record) return error(res, "❌ Vital not found", null, 404);

    if (record.status !== VS.IN_PROGRESS) {
      await t.rollback();
      return error(res, "❌ Only in-progress vitals can be finalized", null, 400);
    }

    const oldStatus = record.status;

    await record.update(
      { status: VS.COMPLETED, updated_by_id: req.user?.id || null },
      { transaction: t }
    );

    if (oldStatus !== VS.COMPLETED && shouldTriggerBilling(MODULE_KEY, VS.COMPLETED)) {
      await billingService.triggerAutoBilling({
        module: MODULE_KEY,
        entity: record,
        user: {
          ...req.user,
          organization_id: record.organization_id,
          facility_id: record.facility_id,
        },
        transaction: t,
      });
    }

    await t.commit();

    const full = await Vital.findOne({ where: { id }, include: VITAL_INCLUDES });

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "finalize",
      entityId: id,
      entity: full,
      details: { from: oldStatus, to: VS.COMPLETED },
    });

    return success(res, "✅ Vital finalized", full);
  } catch (err) {
    await t.rollback();
    return error(res, "❌ Failed to finalize vital", err);
  }
};

/* ============================================================
   📌 VOID VITAL (any → voided, admin/superadmin only)
   ============================================================ */
export const voidVital = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const role = (req.user?.roleNames?.[0] || "").toLowerCase();
    if (!["admin", "superadmin"].includes(role)) {
      return error(res, "❌ Only admin/superadmin can void vitals", null, 403);
    }

    const { id } = req.params;
    const record = await Vital.findByPk(id, { transaction: t });
    if (!record) return error(res, "❌ Vital not found", null, 404);

    await record.update(
      { status: VS.VOIDED, updated_by_id: req.user?.id || null },
      { transaction: t }
    );

    await billingService.voidCharges({
      module: MODULE_KEY,
      entityId: record.id,
      user: {
        ...req.user,
        organization_id: record.organization_id,
        facility_id: record.facility_id,
      },
      transaction: t,
    });

    await t.commit();

    const full = await Vital.findOne({ where: { id }, include: VITAL_INCLUDES });

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "void",
      entityId: id,
      entity: full,
    });

    return success(res, "✅ Vital voided", full);
  } catch (err) {
    await t.rollback();
    return error(res, "❌ Failed to void vital", err);
  }
};

/* ============================================================
   📌 DELETE VITAL (Soft Delete with Audit)
   ============================================================ */
export const deleteVital = async (req, res) => {
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
      where.organization_id = req.user.organization_id;
      if (role === "facility_head") where.facility_id = req.user.facility_id;
    }

    const record = await Vital.findOne({ where, transaction: t });
    if (!record) {
      await t.rollback();
      return error(res, "❌ Vital not found", null, 404);
    }

    await record.update({ deleted_by_id: req.user?.id || null }, { transaction: t });
    await record.destroy({ transaction: t });

    await t.commit();

    const full = await Vital.findOne({ where: { id }, include: VITAL_INCLUDES, paranoid: false });

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "delete",
      entityId: id,
      entity: full,
    });

    return success(res, "✅ Vital deleted", full);
  } catch (err) {
    await t.rollback();
    return error(res, "❌ Failed to delete vital", err);
  }
};

/* ============================================================
   📌 GET ALL VITALS LITE (with ?q= support)
   ============================================================ */
export const getAllVitalsLite = async (req, res) => {
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module: MODULE_KEY,
      action: "read",
      res,
    });
    if (!allowed) return;

    const { q } = req.query;
    const role = (req.user?.roleNames?.[0] || "").toLowerCase();

    const where = { status: { [Op.in]: [VS.COMPLETED, VS.VERIFIED] } };

    if (!isSuperAdmin(req.user)) {
      where.organization_id = req.user.organization_id;
      if (role === "facility_head") where.facility_id = req.user.facility_id;
    } else {
      if (req.query.organization_id) where.organization_id = req.query.organization_id;
      if (req.query.facility_id) where.facility_id = req.query.facility_id;
    }

    if (q) {
      where[Op.or] = [
        { bp: { [Op.iLike]: `%${q}%` } },
        { pulse: { [Op.iLike]: `%${q}%` } },
        { temp: { [Op.iLike]: `%${q}%` } },
      ];
    }

    const vitals = await Vital.findAll({
      where,
      attributes: ["id", "bp", "pulse", "rr", "temp", "recorded_at"],
      include: [
        { model: Patient, as: "patient", attributes: ["id", "pat_no", "first_name", "last_name"] },
        { model: Employee.unscoped(), as: "nurse", attributes: ["id", "first_name", "last_name"] },
      ],
      order: [["recorded_at", "DESC"]],
      limit: 20,
    });

    const result = vitals.map(v => ({
      id: v.id,
      patient: v.patient ? `${v.patient.pat_no} - ${v.patient.first_name} ${v.patient.last_name}` : "",
      nurse: v.nurse ? `${v.nurse.first_name} ${v.nurse.last_name}` : "",
      summary: `BP: ${v.bp}, P: ${v.pulse}, T: ${v.temp}`,
      recorded_at: v.recorded_at,
    }));

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "list_lite",
      details: { count: result.length, query: q || null },
    });

    return success(res, "✅ Vitals loaded (lite)", { records: result });
  } catch (err) {
    return error(res, "❌ Failed to load vitals (lite)", err);
  }
};
/* ============================================================
   📌 START VITAL (open → in_progress)
   ============================================================ */
export const startVital = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { id } = req.params;
    const record = await Vital.findByPk(id, { transaction: t });
    if (!record) return error(res, "❌ Vital not found", null, 404);

    if (record.status !== VS.OPEN) {
      await t.rollback();
      return error(res, "❌ Only open vitals can be started", null, 400);
    }

    const oldStatus = record.status;

    await record.update(
      { status: VS.IN_PROGRESS, updated_by_id: req.user?.id || null },
      { transaction: t }
    );

    await t.commit();

    const full = await Vital.findOne({ where: { id }, include: VITAL_INCLUDES });

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "start",
      entityId: id,
      entity: full,
      details: { from: oldStatus, to: VS.IN_PROGRESS },
    });

    return success(res, "✅ Vital started", full);
  } catch (err) {
    await t.rollback();
    return error(res, "❌ Failed to start vital", err);
  }
};
/* ============================================================
   📌 VERIFY VITAL (completed → verified)
   ============================================================ */
export const verifyVital = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const role = (req.user?.roleNames?.[0] || "").toLowerCase();
    if (!["admin", "superadmin"].includes(role)) {
      return error(res, "❌ Only admin/superadmin can verify vitals", null, 403);
    }

    const { id } = req.params;
    const record = await Vital.findByPk(id, { transaction: t });
    if (!record) return error(res, "❌ Vital not found", null, 404);

    if (record.status !== VS.COMPLETED) {
      await t.rollback();
      return error(res, "❌ Only completed vitals can be verified", null, 400);
    }

    const oldStatus = record.status;

    await record.update(
      { status: VS.VERIFIED, updated_by_id: req.user?.id || null },
      { transaction: t }
    );

    await t.commit();

    const full = await Vital.findOne({ where: { id }, include: VITAL_INCLUDES });

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "verify",
      entityId: id,
      entity: full,
      details: { from: oldStatus, to: VS.VERIFIED },
    });

    return success(res, "✅ Vital verified", full);
  } catch (err) {
    await t.rollback();
    return error(res, "❌ Failed to verify vital", err);
  }
};
