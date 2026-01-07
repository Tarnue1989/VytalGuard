// 📁 controllers/triageRecordController.js
import Joi from "joi";
import { Op } from "sequelize";
import {
  sequelize,
  TriageRecord,
  Patient,
  Employee,
  RegistrationLog,
  Invoice,
  BillableItem,
  User,
  Organization,
  Facility,
} from "../models/index.js";
import { success, error } from "../utils/response.js";
import { buildQueryOptions } from "../utils/queryHelper.js";
import { TRIAGE_STATUS, REGISTRATION_LOG_STATUS } from "../constants/enums.js";
import { authzService } from "../services/authzService.js";
import { auditService } from "../services/auditService.js";
import { FIELD_VISIBILITY_TRIAGE_RECORD } from "../constants/fieldVisibility.js";
import { billingService } from "../services/billingService.js";
import { shouldTriggerBilling } from "../constants/billing.js";

// 🔖 Local enum map for readability
const TS = {
  OPEN: TRIAGE_STATUS[0],
  IN_PROGRESS: TRIAGE_STATUS[1],
  COMPLETED: TRIAGE_STATUS[2],
  VERIFIED: TRIAGE_STATUS[3],
  CANCELLED: TRIAGE_STATUS[4],
  VOIDED: TRIAGE_STATUS[5],
};

const MODULE_KEY = "triage-record";

/* ============================================================
   🔧 HELPERS
============================================================ */
function isSuperAdmin(user) {
  if (!user) return false;
  const roles = Array.isArray(user.roleNames) ? user.roleNames : [user.role || ""];
  return roles.map((r) => r.toLowerCase()).includes("superadmin");
}

/* ============================================================
   🔗 SHARED INCLUDES
============================================================ */
const TRIAGE_INCLUDES = [
  { model: Patient, as: "patient", attributes: ["id", "pat_no", "first_name", "last_name"] },
  { model: Employee.unscoped(), as: "doctor", attributes: ["id", "first_name", "last_name"] },
  { model: Employee.unscoped(), as: "nurse", attributes: ["id", "first_name", "last_name"] },
  { model: RegistrationLog, as: "registrationLog", attributes: ["id", "registration_time", "log_status"] },
  { model: Invoice, as: "invoice", attributes: ["id", "invoice_number", "status", "total"] },
  { model: BillableItem, as: "triageType", attributes: ["id", "name", "price"] },
  { model: Organization, as: "organization", attributes: ["id", "name", "code"] },
  { model: Facility, as: "facility", attributes: ["id", "name", "code", "organization_id"] },
  { model: User, as: "createdBy", attributes: ["id", "first_name", "last_name"] },
  { model: User, as: "updatedBy", attributes: ["id", "first_name", "last_name"] },
  { model: User, as: "deletedBy", attributes: ["id", "first_name", "last_name"] },
];

/* ============================================================
   📋 JOI SCHEMA
============================================================ */
function buildTriageSchema(mode = "create") {
  const base = {
    patient_id: Joi.string().uuid().required(),
    doctor_id: Joi.string().uuid().allow(null, ""),
    nurse_id: Joi.string().uuid().allow(null, ""),
    registration_log_id: Joi.string().uuid().allow(null, ""),
    invoice_id: Joi.string().uuid().allow(null, ""),
    triage_type_id: Joi.string().uuid().allow(null, ""),
    symptoms: Joi.string().allow("", null),
    triage_notes: Joi.string().allow("", null),
    bp: Joi.string().allow("", null),
    pulse: Joi.number().allow(null),
    rr: Joi.number().allow(null),
    temp: Joi.number().allow(null),
    oxygen: Joi.number().allow(null),
    weight: Joi.number().allow(null),
    height: Joi.number().allow(null),
    rbg: Joi.number().allow(null),
    pain_score: Joi.number().min(0).max(10).allow(null),
    position: Joi.string().allow("", null),
    recorded_at: Joi.date().default(() => new Date()),
    organization_id: Joi.string().uuid().allow(null),
    facility_id: Joi.string().uuid().allow(null),
  };

  if (mode === "update") {
    Object.keys(base).forEach((k) => {
      base[k] = base[k].optional();
    });
  }

  return Joi.object(base);
}

/* ============================================================
   📌 CREATE TRIAGE RECORD
============================================================ */
export const createTriageRecord = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module: MODULE_KEY,
      action: "create",
      res,
    });
    if (!allowed) return;

    const schema = buildTriageSchema("create");
    const { error: validationError, value } = schema.validate(req.body, { stripUnknown: true });
    if (validationError) {
      await t.rollback();
      return error(res, "Validation failed", validationError, 400);
    }

    // 👩‍⚕️ Doctor/Nurse fallback
    if (!isSuperAdmin(req.user)) {
      if (!value.doctor_id) value.doctor_id = req.user.employee_id;
    } else {
      if (!value.doctor_id && !value.nurse_id) {
        await t.rollback();
        return error(res, "Doctor or Nurse is required for superadmin", null, 400);
      }
    }

    // 🏢 Org/Facility logic
    let orgId, facilityId;
    if (isSuperAdmin(req.user)) {
      orgId = value.organization_id;
      facilityId = value.facility_id;
      if (!orgId || !facilityId) {
        await t.rollback();
        return error(res, "Organization and Facility are required for superadmin", null, 400);
      }
    } else {
      orgId = req.user.organization_id;
      facilityId = req.user.facility_id;
    }

    // 🔗 Auto-link RegistrationLog if not provided
    if (!value.registration_log_id && value.patient_id) {
      const latestReg = await RegistrationLog.findOne({
        where: {
          patient_id: value.patient_id,
          organization_id: orgId,
          facility_id: facilityId,
          log_status: { [Op.in]: [REGISTRATION_LOG_STATUS[1], REGISTRATION_LOG_STATUS[2]] },
        },
        order: [["created_at", "DESC"]],
        transaction: t,
      });
      if (latestReg) {
        value.registration_log_id = latestReg.id;
      }
    }

    // 🩺 Create record
    const created = await TriageRecord.create(
      {
        ...value,
        triage_status: TS.OPEN,
        organization_id: orgId,
        facility_id: facilityId,
        created_by_id: req.user?.id || null,
      },
      { transaction: t }
    );

    await t.commit();

    const full = await TriageRecord.findOne({
      where: { id: created.id },
      include: TRIAGE_INCLUDES,
    });

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "create",
      entityId: created.id,
      entity: created,
      details: { ...value, triage_status: TS.OPEN },
    });

    return success(res, "✅ Triage record created", full);
  } catch (err) {
    await t.rollback();
    return error(res, "❌ Failed to create triage record", err);
  }
};

/* ============================================================
   📌 UPDATE TRIAGE RECORD
============================================================ */
export const updateTriageRecord = async (req, res) => {
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
    const schema = buildTriageSchema("update");
    const { error: validationError, value } = schema.validate(req.body, { stripUnknown: true });
    if (validationError) {
      await t.rollback();
      return error(res, "Validation failed", validationError, 400);
    }

    const record = await TriageRecord.findOne({ where: { id }, transaction: t });
    if (!record) {
      await t.rollback();
      return error(res, "Triage record not found", null, 404);
    }

    // 👨‍⚕️ Doctor/Nurse logic
    if (isSuperAdmin(req.user)) {
      if (!value.doctor_id) value.doctor_id = record.doctor_id;
      if (!value.nurse_id) value.nurse_id = record.nurse_id;
    } else {
      if (!value.doctor_id) value.doctor_id = req.user.employee_id;
    }

    // 🏢 Org/Facility scoping (mirror vital)
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

    // 🔗 Re-link RegistrationLog
    if (!value.registration_log_id && value.patient_id) {
      const latestReg = await RegistrationLog.findOne({
        where: {
          patient_id: value.patient_id,
          organization_id: orgId,
          facility_id: facilityId,
          log_status: { [Op.in]: [REGISTRATION_LOG_STATUS[1], REGISTRATION_LOG_STATUS[2]] },
        },
        order: [["created_at", "DESC"]],
        transaction: t,
      });
      if (latestReg) {
        value.registration_log_id = latestReg.id;
      }
    }

    await record.update(
      {
        ...value,
        updated_by_id: req.user?.id || null,
      },
      { transaction: t }
    );

    await t.commit();

    const full = await TriageRecord.findOne({
      where: { id },
      include: TRIAGE_INCLUDES,
    });

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "update",
      entityId: id,
      entity: full,
      details: value,
    });

    return success(res, "✅ Triage record updated", full);
  } catch (err) {
    await t.rollback();
    return error(res, "❌ Failed to update triage record", err);
  }
};

/* ============================================================
   📌 START TRIAGE (open → in_progress)
   ============================================================ */
export const startTriageRecord = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { id } = req.params;

    const where = { id };
    const role = (req.user?.roleNames?.[0] || "staff").toLowerCase();
    if (!isSuperAdmin(req.user)) {
      where.organization_id = req.user.organization_id;
      if (role === "facility_head") where.facility_id = req.user.facility_id;
    }

    const rec = await TriageRecord.findOne({ where, transaction: t });
    if (!rec) return error(res, "❌ Triage record not found", null, 404);

    if (rec.triage_status !== TS.OPEN) {
      await t.rollback();
      return error(res, "❌ Only open triage records can be started", null, 400);
    }

    const oldStatus = rec.triage_status;

    await rec.update(
      { triage_status: TS.IN_PROGRESS, updated_by_id: req.user?.id || null },
      { transaction: t }
    );

    await t.commit();

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "start",
      entityId: id,
      entity: rec,
      details: { from: oldStatus, to: TS.IN_PROGRESS },
    });

    return success(res, "✅ Triage started (in-progress)", rec);
  } catch (err) {
    await t.rollback();
    return error(res, "❌ Failed to start triage record", err);
  }
};

/* ============================================================
   📌 COMPLETE TRIAGE (in_progress → completed)
   ============================================================ */
export const completeTriageRecord = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { id } = req.params;

    const where = { id };
    const role = (req.user?.roleNames?.[0] || "staff").toLowerCase();
    if (!isSuperAdmin(req.user)) {
      where.organization_id = req.user.organization_id;
      if (role === "facility_head") where.facility_id = req.user.facility_id;
    }

    const rec = await TriageRecord.findOne({ where, transaction: t });
    if (!rec) return error(res, "❌ Triage record not found", null, 404);

    if (rec.triage_status !== TS.IN_PROGRESS) {
      await t.rollback();
      return error(res, "❌ Only in-progress triage records can be completed", null, 400);
    }

    const oldStatus = rec.triage_status;

    await rec.update(
      { triage_status: TS.COMPLETED, updated_by_id: req.user?.id || null },
      { transaction: t }
    );

    if (shouldTriggerBilling(MODULE_KEY, TS.COMPLETED)) {
      await billingService.triggerAutoBilling({
        module: MODULE_KEY,
        entity: rec,
        user: {
          ...req.user,
          organization_id: rec.organization_id,
          facility_id: rec.facility_id,
        },
        transaction: t,
      });
    }

    await t.commit();

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "complete",
      entityId: id,
      entity: rec,
      details: { from: oldStatus, to: TS.COMPLETED },
    });

    return success(res, "✅ Triage marked as completed", rec);
  } catch (err) {
    await t.rollback();
    return error(res, "❌ Failed to complete triage record", err);
  }
};

/* ============================================================
   📌 CANCEL TRIAGE (open/in_progress → cancelled)
   ============================================================ */
export const cancelTriageRecord = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const where = { id };
    const role = (req.user?.roleNames?.[0] || "staff").toLowerCase();
    if (!isSuperAdmin(req.user)) {
      where.organization_id = req.user.organization_id;
      if (role === "facility_head") where.facility_id = req.user.facility_id;
    }

    const rec = await TriageRecord.findOne({ where, transaction: t });
    if (!rec) return error(res, "❌ Triage record not found", null, 404);

    if (![TS.OPEN, TS.IN_PROGRESS].includes(rec.triage_status)) {
      await t.rollback();
      return error(res, "❌ Only open or in-progress triage records can be cancelled", null, 400);
    }

    const oldStatus = rec.triage_status;

    await rec.update(
      {
        triage_status: TS.CANCELLED,
        cancel_reason: reason || null,
        cancelled_by_id: req.user?.id || null,
        updated_by_id: req.user?.id || null,
      },
      { transaction: t }
    );

    await billingService.voidCharges({
      module: MODULE_KEY,
      entityId: rec.id,
      user: req.user,
      transaction: t,
    });

    await t.commit();

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "cancel",
      entityId: id,
      entity: rec,
      details: { from: oldStatus, to: TS.CANCELLED, reason: reason || null },
    });

    return success(res, "✅ Triage cancelled & charges voided", rec);
  } catch (err) {
    await t.rollback();
    return error(res, "❌ Failed to cancel triage record", err);
  }
};

/* ============================================================
   📌 VOID TRIAGE (any → voided, admin/superadmin only)
   ============================================================ */
export const voidTriageRecord = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const role = (req.user?.roleNames?.[0] || "").toLowerCase();
    if (!["admin", "superadmin"].includes(role)) {
      return error(res, "❌ Only admin/superadmin can void triage records", null, 403);
    }

    const { id } = req.params;
    const { reason } = req.body;

    const where = { id };
    if (!isSuperAdmin(req.user)) {
      where.organization_id = req.user.organization_id;
      if (role === "facility_head") where.facility_id = req.user.facility_id;
    }

    const rec = await TriageRecord.findOne({ where, transaction: t });
    if (!rec) return error(res, "❌ Triage record not found", null, 404);

    const oldStatus = rec.triage_status;

    await rec.update(
      {
        triage_status: TS.VOIDED,
        void_reason: reason || null,
        voided_by_id: req.user?.id || null,
        updated_by_id: req.user?.id || null,
      },
      { transaction: t }
    );

    await billingService.voidCharges({
      module: MODULE_KEY,
      entityId: rec.id,
      user: req.user,
      transaction: t,
    });

    await t.commit();

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "void",
      entityId: id,
      entity: rec,
      details: { from: oldStatus, to: TS.VOIDED, reason: reason || null },
    });

    return success(res, "✅ Triage record voided & charges rolled back", rec);
  } catch (err) {
    await t.rollback();
    return error(res, "❌ Failed to void triage record", err);
  }
};

/* ============================================================
   📌 VERIFY TRIAGE (completed → verified)
   ============================================================ */
export const verifyTriageRecord = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { id } = req.params;

    const where = { id };
    const role = (req.user?.roleNames?.[0] || "staff").toLowerCase();
    if (!isSuperAdmin(req.user)) {
      where.organization_id = req.user.organization_id;
      if (role === "facility_head") where.facility_id = req.user.facility_id;
    }

    const rec = await TriageRecord.findOne({ where, transaction: t });
    if (!rec) return error(res, "❌ Triage record not found", null, 404);

    if (rec.triage_status !== TS.COMPLETED) {
      await t.rollback();
      return error(res, "❌ Only completed triage records can be verified", null, 400);
    }

    const oldStatus = rec.triage_status;

    await rec.update(
      { triage_status: TS.VERIFIED, verified_by_id: req.user?.id || null },
      { transaction: t }
    );

    if (shouldTriggerBilling(MODULE_KEY, TS.VERIFIED)) {
      await billingService.triggerAutoBilling({
        module: MODULE_KEY,
        entity: rec,
        user: {
          ...req.user,
          organization_id: rec.organization_id,
          facility_id: rec.facility_id,
        },
        transaction: t,
      });
    }

    await t.commit();

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "verify",
      entityId: id,
      entity: rec,
      details: { from: oldStatus, to: TS.VERIFIED },
    });

    return success(res, "✅ Triage record verified", rec);
  } catch (err) {
    await t.rollback();
    return error(res, "❌ Failed to verify triage record", err);
  }
};

/* ============================================================
   📌 DELETE TRIAGE RECORD (Soft Delete + Billing Rollback)
   ============================================================ */
export const deleteTriageRecord = async (req, res) => {
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

    const rec = await TriageRecord.findOne({ where, transaction: t });
    if (!rec) {
      await t.rollback();
      return error(res, "❌ Triage record not found", null, 404);
    }

    // ⚡ Roll back billing
    await billingService.voidCharges({
      module: MODULE_KEY,
      entityId: rec.id,
      user: { ...req.user, organization_id: rec.organization_id, facility_id: rec.facility_id },
      transaction: t,
    });

    // Soft-delete (audit trail)
    await rec.update({ deleted_by_id: req.user?.id || null }, { transaction: t });
    await rec.destroy({ transaction: t });

    await t.commit();

    // Load full record including soft-deleted
    const full = await TriageRecord.findOne({
      where: { id },
      include: TRIAGE_INCLUDES,
      paranoid: false,
    });

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "delete",
      entityId: id,
      entity: full,
    });

    return success(res, "✅ Triage record deleted (with billing rollback)", full);
  } catch (err) {
    await t.rollback();
    return error(res, "❌ Failed to delete triage record", err);
  }
};

/* ============================================================
   📌 GET ALL TRIAGE RECORDS LITE (with ?q= + ?triage_status= support)
   ============================================================ */
export const getAllTriageRecordsLite = async (req, res) => {
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module: MODULE_KEY,
      action: "read",
      res,
    });
    if (!allowed) return;

    const { q, triage_status } = req.query;
    const role = (req.user?.roleNames?.[0] || "").toLowerCase();

    // Default status filter (open + in-progress), overridable by query
    let statusFilter = [TS.OPEN, TS.IN_PROGRESS];
    if (triage_status) {
      const statuses = Array.isArray(triage_status) ? triage_status : [triage_status];
      statusFilter = statuses;
    }
    const where = { triage_status: { [Op.in]: statusFilter } };

    // 🔒 Apply org/facility scoping
    if (!isSuperAdmin(req.user)) {
      where.organization_id = req.user.organization_id;
      if (role === "facility_head") {
        where.facility_id = req.user.facility_id;
      }
    } else {
      if (req.query.organization_id) where.organization_id = req.query.organization_id;
      if (req.query.facility_id) where.facility_id = req.query.facility_id;
    }

    // 🔎 Search support
    if (q) {
      where[Op.or] = [
        { symptoms: { [Op.iLike]: `%${q}%` } },
        { triage_notes: { [Op.iLike]: `%${q}%` } },
      ];
    }

    // 🔎 Extra filters
    if (req.query.patient_id) where.patient_id = req.query.patient_id;
    if (req.query.doctor_id) where.doctor_id = req.query.doctor_id;
    if (req.query.nurse_id) where.nurse_id = req.query.nurse_id;
    if (req.query.registration_log_id) where.registration_log_id = req.query.registration_log_id;
    if (req.query.triage_type_id) where.triage_type_id = req.query.triage_type_id;

    const triages = await TriageRecord.findAll({
      where,
      attributes: ["id", "recorded_at", "symptoms", "triage_status"],
      include: [
        {
          model: Patient,
          as: "patient",
          attributes: ["id", "pat_no", "first_name", "last_name"],
        },
        {
          model: Employee.unscoped(),
          as: "doctor",
          attributes: ["id", "first_name", "last_name"],
        },
        {
          model: Employee.unscoped(),
          as: "nurse",
          attributes: ["id", "first_name", "last_name"],
        },
      ],
      order: [["recorded_at", "DESC"]],
      limit: 20,
    });

    const result = triages.map(t => ({
      id: t.id,
      patient: t.patient
        ? `${t.patient.pat_no} - ${t.patient.first_name} ${t.patient.last_name}`
        : "",
      doctor: t.doctor ? `${t.doctor.first_name} ${t.doctor.last_name}` : "",
      nurse: t.nurse ? `${t.nurse.first_name} ${t.nurse.last_name}` : "",
      symptoms: t.symptoms || "",
      date: t.recorded_at,
      status: t.triage_status,
    }));

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "list_lite",
      details: { query: q || null, returned: result.length },
    });

    return success(res, "✅ Triage records loaded (lite)", { records: result });
  } catch (err) {
    return error(res, "❌ Failed to load triage records (lite)", err);
  }
};

/* ============================================================
   📌 GET ALL TRIAGE RECORDS (with ?triage_status= support)
   ============================================================ */
export const getAllTriageRecords = async (req, res) => {
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
      FIELD_VISIBILITY_TRIAGE_RECORD[role] || FIELD_VISIBILITY_TRIAGE_RECORD.staff;

    // 🚫 remove pseudo-fields like "actions"
    const FRONTEND_ONLY_FIELDS = ["actions"];
    const safeFields = visibleFields.filter(f => !FRONTEND_ONLY_FIELDS.includes(f));

    const options = buildQueryOptions(req, "recorded_at", "DESC", safeFields);
    options.where = options.where || {};

    // 🔒 Apply org/facility scoping
    if (!isSuperAdmin(req.user)) {
      options.where.organization_id = req.user.organization_id;
      if (role === "facility_head") {
        options.where.facility_id = req.user.facility_id;
      }
    } else {
      if (req.query.organization_id) options.where.organization_id = req.query.organization_id;
      if (req.query.facility_id) options.where.facility_id = req.query.facility_id;
    }

    // 🔎 Apply search
    if (options.search) {
      options.where[Op.or] = [
        { symptoms: { [Op.iLike]: `%${options.search}%` } },
        { triage_notes: { [Op.iLike]: `%${options.search}%` } },
      ];
    }

    // 🔎 Extra filters
    if (req.query.patient_id) options.where.patient_id = req.query.patient_id;
    if (req.query.doctor_id) options.where.doctor_id = req.query.doctor_id;
    if (req.query.nurse_id) options.where.nurse_id = req.query.nurse_id;
    if (req.query.registration_log_id) options.where.registration_log_id = req.query.registration_log_id;
    if (req.query.triage_type_id) options.where.triage_type_id = req.query.triage_type_id;

    // 🔎 Status filter
    if (req.query.triage_status) {
      const statuses = Array.isArray(req.query.triage_status)
        ? req.query.triage_status
        : [req.query.triage_status];
      options.where.triage_status = { [Op.in]: statuses };
    }

    const { count, rows } = await TriageRecord.findAndCountAll({
      where: options.where,
      include: [...TRIAGE_INCLUDES, ...(options.include || [])],
      order: options.order,
      offset: options.offset,
      limit: options.limit,
    });

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "list",
      details: { query: req.query, returned: count },
    });

    return success(res, "✅ Triage records loaded", {
      records: rows,
      pagination: {
        total: count,
        page: options.pagination.page,
        pageCount: Math.ceil(count / options.pagination.limit),
      },
    });
  } catch (err) {
    return error(res, "❌ Failed to load triage records", err);
  }
};

/* ============================================================
   📌 GET TRIAGE RECORD BY ID
   ============================================================ */
export const getTriageRecordById = async (req, res) => {
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
      if (role === "facility_head") {
        where.facility_id = req.user.facility_id;
      }
    } else {
      if (req.query.organization_id) where.organization_id = req.query.organization_id;
      if (req.query.facility_id) where.facility_id = req.query.facility_id;
    }

    const record = await TriageRecord.findOne({
      where,
      include: TRIAGE_INCLUDES,
    });
    if (!record) return error(res, "❌ Triage record not found", null, 404);

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "view",
      entityId: id,
      entity: record,
    });

    return success(res, "✅ Triage record loaded", record);
  } catch (err) {
    return error(res, "❌ Failed to load triage record", err);
  }
};
