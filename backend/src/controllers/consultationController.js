// 📁 controllers/consultationController.js
import Joi from "joi";
import { Op } from "sequelize";
import {
  sequelize,
  Consultation,
  Patient,
  Employee,
  Department,
  Appointment,
  RegistrationLog,
  Recommendation,
  Invoice,
  BillableItem,
  User,
  Organization,
  Facility,
  Prescription,
} from "../models/index.js";
import { success, error } from "../utils/response.js";
import { buildQueryOptions } from "../utils/queryHelper.js";
import { CONSULTATION_STATUS, REGISTRATION_LOG_STATUS } from "../constants/enums.js";
import { authzService } from "../services/authzService.js";
import { auditService } from "../services/auditService.js";
import { FIELD_VISIBILITY_CONSULTATION } from "../constants/fieldVisibility.js";
import { billingService } from "../services/billingService.js";
import { shouldTriggerBilling } from "../constants/billing.js";
import { validatePaginationStrict } from "../utils/query-utils.js";
import { normalizeDateRangeLocal } from "../utils/date-utils.js";
// 🔖 Local enum map for readability
const CS = {
  OPEN: CONSULTATION_STATUS[0],
  IN_PROGRESS: CONSULTATION_STATUS[1],
  COMPLETED: CONSULTATION_STATUS[2],
  VERIFIED: CONSULTATION_STATUS[3],
  CANCELLED: CONSULTATION_STATUS[4],
  VOIDED: CONSULTATION_STATUS[5],
};

const MODULE_KEY = "consultation";

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
const CONSULTATION_INCLUDES = [
  { model: Patient, as: "patient", attributes: ["id", "pat_no", "first_name", "last_name"] },
  { model: Employee.unscoped(), as: "doctor", attributes: ["id", "first_name", "last_name"] },
  { model: Department, as: "department", attributes: ["id", "name", "code"] },
  { model: Appointment, as: "appointment", attributes: ["id", "appointment_code", "status"] },
  { 
    model: RegistrationLog, 
    as: "registrationLog", 
    attributes: ["id", "registration_time", "log_status"] 
  },
  { model: Recommendation, as: "recommendation", attributes: ["id", "status", "reason"] },
  { model: Consultation, as: "parentConsultation", attributes: ["id", "status", "diagnosis"] },
  { model: Invoice, as: "invoice", attributes: ["id", "invoice_number", "status", "total"] },
  { model: BillableItem, as: "consultationType", attributes: ["id", "name"] },
  { model: Prescription, as: "prescriptions", attributes: ["id", "status"] },
  { model: Organization, as: "organization", attributes: ["id", "name", "code"] },
  { model: Facility, as: "facility", attributes: ["id", "name", "code", "organization_id"] },
  { model: User, as: "createdBy", attributes: ["id", "first_name", "last_name"] },
  { model: User, as: "updatedBy", attributes: ["id", "first_name", "last_name"] },
  { model: User, as: "deletedBy", attributes: ["id", "first_name", "last_name"] },
];

/* ============================================================
   📋 JOI SCHEMA
   ============================================================ */
function buildConsultationSchema(mode = "create") {
  const base = {
    appointment_id: Joi.string().uuid().allow(null, ""),
    registration_log_id: Joi.forbidden(), // 🔒 backend handles this
    recommendation_id: Joi.string().uuid().allow(null, ""),
    parent_consultation_id: Joi.string().uuid().allow(null, ""),
    patient_id: Joi.string().uuid().required(),
    doctor_id: Joi.string().uuid().allow(null, ""), // 🔄 optional now
    department_id: Joi.string().uuid().allow(null, ""),
    invoice_id: Joi.string().uuid().allow(null, ""),
    consultation_type_id: Joi.string().uuid().allow(null, ""),
    consultation_date: Joi.date().default(() => new Date()),
    diagnosis: Joi.string().max(255).allow("", null),
    consultation_notes: Joi.string().allow("", null),
    prescribed_medications: Joi.string().allow("", null),
    // 🔒 status deliberately excluded → lifecycle endpoints control it
  };

  if (mode === "update") {
    Object.keys(base).forEach(k => {
      base[k] = base[k].optional();
    });
  }

  return Joi.object(base);
}
/* ============================================================
   📌 CREATE CONSULTATION
   ============================================================ */
export const createConsultation = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module: MODULE_KEY,
      action: "create",
      res,
    });
    if (!allowed) return;

    const schema = buildConsultationSchema("create");
    const { error: validationError, value } = schema.validate(req.body, { stripUnknown: true });
    if (validationError) {
      await t.rollback();
      return error(res, "Validation failed", validationError, 400);
    }

    // 🔹 Doctor assignment logic
    if (isSuperAdmin(req.user)) {
      if (!value.doctor_id) {
        await t.rollback();
        return error(res, "Doctor is required for superadmin", null, 400);
      }
    } else {
      value.doctor_id = req.user.employee_id;
    }

    // 🔹 Build whereClause for Registration Log
    let whereClause = {
      patient_id: value.patient_id,
      log_status: REGISTRATION_LOG_STATUS[2], // "active"
    };

    if (!isSuperAdmin(req.user)) {
      whereClause.organization_id = req.user.organization_id;
      whereClause.facility_id = req.user.facility_id;
    } else {
      // allow optional narrowing via query params for superadmin
      if (req.query.organization_id) {
        whereClause.organization_id = req.query.organization_id;
      }
      if (req.query.facility_id) {
        whereClause.facility_id = req.query.facility_id;
      }
    }

    // 🔹 Auto-link active Registration Log
    const activeLog = await RegistrationLog.findOne({
      where: whereClause,
      order: [["registration_time", "DESC"]],
      transaction: t,
    });

    if (!activeLog) {
      await t.rollback();
      return error(res, "❌ No active registration log found for patient", null, 400);
    }

    value.registration_log_id = activeLog.id;

    // 🔹 Org/facility assignment
    const orgId = req.user.organization_id || activeLog.organization_id;
    const facilityId = req.user.facility_id || activeLog.facility_id;

    // 🔒 Prevent duplicate active consultations for the same patient
    const existingActive = await Consultation.findOne({
      where: {
        patient_id: value.patient_id,
        organization_id: orgId,
        facility_id: facilityId,
        status: { [Op.in]: [CS.OPEN, CS.IN_PROGRESS] },
      },
      transaction: t,
    });

    if (existingActive) {
      await t.rollback();
      return error(
        res,
        "❌ Patient already has an active consultation. Please complete or cancel it before creating a new one.",
        null,
        400
      );
    }

    // 🔹 Create consultation
    const created = await Consultation.create(
      {
        ...value,
        status: CS.OPEN, // enforce lifecycle start
        organization_id: orgId,
        facility_id: facilityId,
        created_by_id: req.user?.id || null,
      },
      { transaction: t }
    );

    await t.commit();

    const full = await Consultation.findOne({
      where: { id: created.id },
      include: CONSULTATION_INCLUDES,
    });

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "create",
      entityId: created.id,
      entity: created,
      details: { ...value, status: CS.OPEN },
    });

    return success(res, "✅ Consultation created", full);
  } catch (err) {
    await t.rollback();
    return error(res, "❌ Failed to create consultation", err);
  }
};


/* ============================================================
   📌 UPDATE CONSULTATION
   ============================================================ */
export const updateConsultation = async (req, res) => {
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
    const schema = buildConsultationSchema("update");
    const { error: validationError, value } = schema.validate(req.body, { stripUnknown: true });
    if (validationError) {
      await t.rollback();
      return error(res, "Validation failed", validationError, 400);
    }

    const record = await Consultation.findOne({ where: { id }, transaction: t });
    if (!record) {
      await t.rollback();
      return error(res, "Consultation not found", null, 404);
    }

    // 🔹 Doctor assignment logic
    if (isSuperAdmin(req.user)) {
      if (!value.doctor_id) value.doctor_id = record.doctor_id;
    } else {
      value.doctor_id = req.user.employee_id;
    }

    // 🔒 Prevent duplicate active consultations when patient is reassigned/changed
    if (value.patient_id && value.patient_id !== record.patient_id) {
      const existingActive = await Consultation.findOne({
        where: {
          patient_id: value.patient_id,
          organization_id: record.organization_id,
          facility_id: record.facility_id,
          status: { [Op.in]: [CS.OPEN, CS.IN_PROGRESS] },
          id: { [Op.ne]: record.id }, // exclude current record
        },
        transaction: t,
      });

      if (existingActive) {
        await t.rollback();
        return error(
          res,
          "❌ Patient already has an active consultation. Please complete or cancel it before reassigning.",
          null,
          400
        );
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

    const full = await Consultation.findOne({
      where: { id },
      include: CONSULTATION_INCLUDES,
    });

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "update",
      entityId: id,
      entity: full,
      details: value,
    });

    return success(res, "✅ Consultation updated", full);
  } catch (err) {
    await t.rollback();
    return error(res, "❌ Failed to update consultation", err);
  }
};

/* ============================================================
   📌 GET ALL CONSULTATIONS (MASTER FINAL)
============================================================ */
export const getAllConsultations = async (req, res) => {
  try {
    // 🔐 Permission check
    const allowed = await authzService.checkPermission({
      user: req.user,
      module: MODULE_KEY,
      action: "read",
      res,
    });
    if (!allowed) return;

    // 🔎 Strict pagination validation
    const { limit, page, offset } = validatePaginationStrict(req, {
      limit: 25,
      maxLimit: 200,
    });

    // 🔎 Role-based visibility
    const role = (req.user?.roleNames?.[0] || "staff").toLowerCase();
    const visibleFields =
      FIELD_VISIBILITY_CONSULTATION[role] ||
      FIELD_VISIBILITY_CONSULTATION.staff;

    /* ========================================================
       📅 DATE RANGE (UI-ONLY — MUST BE STRIPPED)
    ======================================================== */
    const { dateRange, ...safeQuery } = req.query;

    // Inject safe pagination back
    safeQuery.limit = limit;
    safeQuery.page = page;

    // Replace req.query ONLY with safeQuery
    req.query = safeQuery;

    const options = buildQueryOptions(
      req,
      "consultation_date",
      "DESC",
      visibleFields
    );
    options.where = options.where || {};

    /* ========================================================
      📅 DATE RANGE (UI-ONLY → consultation_date)
    ======================================================== */
    if (dateRange) {
      const { start, end } = normalizeDateRangeLocal(dateRange);

      // normalizeDateRangeLocal returns Date objects
      // consultation_date is DATEONLY → compare as YYYY-MM-DD
      if (start && end) {
        options.where.consultation_date = {
          [Op.between]: [
            start.toISOString().slice(0, 10),
            end.toISOString().slice(0, 10),
          ],
        };
      }
    }


    /* ========================================================
       🔐 ORG / FACILITY SCOPING
    ======================================================== */
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

    /* ========================================================
       🔍 GLOBAL SEARCH
    ======================================================== */
    if (options.search) {
      options.where[Op.or] = [
        { diagnosis: { [Op.iLike]: `%${options.search}%` } },
        { consultation_notes: { [Op.iLike]: `%${options.search}%` } },
      ];
    }

    /* ========================================================
       🗂️ QUERY
    ======================================================== */
    const { count, rows } = await Consultation.findAndCountAll({
      where: options.where,
      include: [...CONSULTATION_INCLUDES, ...(options.include || [])],
      order: options.order,
      offset,
      limit,
    });

    /* ========================================================
       🔢 SUMMARY (STATUS-BASED, PAGE-AWARE)
    ======================================================== */
    const summary = { total: count };
    CONSULTATION_STATUS.forEach((status) => {
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
        query: safeQuery, // ✅ no dateRange leak
        returned: count,
        pagination: { page, limit },
      },
    });

    /* ========================================================
       ✅ RESPONSE (MASTER CONTRACT)
    ======================================================== */
    return success(res, "✅ Consultations loaded", {
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
    if (err.statusCode === 400) {
      return error(res, err.message, null, 400);
    }
    return error(res, "❌ Failed to load consultations", err);
  }
};

/* ============================================================
   📌 GET CONSULTATION BY ID
   ============================================================ */
export const getConsultationById = async (req, res) => {
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

    // 🔒 Apply org/facility scoping
    if (!isSuperAdmin(req.user)) {
      where.organization_id = req.user.organization_id;
      if (role === "facility_head") {
        where.facility_id = req.user.facility_id;
      }
    } else {
      if (req.query.organization_id) {
        where.organization_id = req.query.organization_id;
      }
      if (req.query.facility_id) {
        where.facility_id = req.query.facility_id;
      }
    }

    const record = await Consultation.findOne({
      where,
      include: CONSULTATION_INCLUDES,
    });

    if (!record) {
      return error(res, "❌ Consultation not found", null, 404);
    }

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "view",
      entityId: id,
      entity: record,
    });

    return success(res, "✅ Consultation loaded", record);
  } catch (err) {
    return error(res, "❌ Failed to load consultation", err);
  }
};

/* ============================================================
   📌 GET ALL CONSULTATIONS LITE (with ?q=, ?patient_id=, ?status=)
   ============================================================ */
export const getAllConsultationsLite = async (req, res) => {
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module: MODULE_KEY,
      action: "read",
      res,
    });
    if (!allowed) return;

    const { q, patient_id, status } = req.query;
    const role = (req.user?.roleNames?.[0] || "").toLowerCase();

    const where = {};

    // 🔒 Scoping
    if (!isSuperAdmin(req.user)) {
      where.organization_id = req.user.organization_id;
      if (role === "facility_head") where.facility_id = req.user.facility_id;
    } else {
      if (req.query.organization_id) where.organization_id = req.query.organization_id;
      if (req.query.facility_id) where.facility_id = req.query.facility_id;
    }

    // 🔎 Patient-specific filter
    if (patient_id) {
      where.patient_id = patient_id;
    }

    // 🔎 Status filter (multi allowed, comma-separated)
    if (status) {
      const statuses = status.split(",").map(s => s.trim());
      where.status = { [Op.in]: statuses };
    } else {
      // default if none provided
      where.status = { [Op.in]: [CS.OPEN, CS.IN_PROGRESS] };
    }

    // 🔎 Free-text search
    if (q) {
      where[Op.or] = [
        { diagnosis: { [Op.iLike]: `%${q}%` } },
        { consultation_notes: { [Op.iLike]: `%${q}%` } },
      ];
    }

    const consultations = await Consultation.findAll({
      where,
      attributes: ["id", "consultation_date", "diagnosis", "status"],
      include: [
        { model: Patient, as: "patient", attributes: ["id", "pat_no", "first_name", "last_name"] },
        { model: Employee.unscoped(), as: "doctor", attributes: ["id", "first_name", "last_name"] },
      ],
      order: [["consultation_date", "DESC"]],
      limit: 20,
    });

    // 🔧 Helper to build friendly label
    const formatDate = (date) =>
      date
        ? new Date(date).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          })
        : "Unknown";

    const result = consultations.map(c => {
      const doctor = c.doctor
        ? `Dr. ${c.doctor.first_name} ${c.doctor.last_name}`
        : "No Doctor";

      const statusTxt = (c.status || "").replace("_", " ").toLowerCase();

      return {
        id: c.id,
        label: `${formatDate(c.consultation_date)} · ${statusTxt} · ${doctor}`, // ✅ For dropdown
        patient: c.patient
          ? `${c.patient.pat_no} - ${c.patient.first_name} ${c.patient.last_name}`
          : "",
        doctor,
        diagnosis: c.diagnosis || "",
        date: c.consultation_date,
        status: c.status,
      };
    });

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "list_lite",
      details: { count: result.length, query: q || null, patient_id: patient_id || null, status: status || null },
    });

    return success(res, "✅ Consultations loaded (lite)", { records: result });
  } catch (err) {
    return error(res, "❌ Failed to load consultations (lite)", err);
  }
};


/* ============================================================
   📌 START CONSULTATION (open → in_progress)
   ============================================================ */
export const startConsultation = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { id } = req.params;
    const cons = await Consultation.findByPk(id, { transaction: t });
    if (!cons) return error(res, "❌ Consultation not found", null, 404);

    if (cons.status !== CS.OPEN) {
      await t.rollback();
      return error(res, "❌ Only open consultations can be started", null, 400);
    }

    const oldStatus = cons.status;

    await cons.update(
      { status: CS.IN_PROGRESS, updated_by_id: req.user?.id || null },
      { transaction: t }
    );

    // 🔹 If linked appointment exists, mark it in_progress too
    if (cons.appointment_id) {
      await Appointment.update(
        { status: "in_progress" },
        { where: { id: cons.appointment_id }, transaction: t }
      );
    }

    await t.commit();

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "start",
      entityId: id,
      entity: cons,
      details: { from: oldStatus, to: CS.IN_PROGRESS },
    });

    return success(res, "✅ Consultation started (in-progress)", cons);
  } catch (err) {
    await t.rollback();
    return error(res, "❌ Failed to start consultation", err);
  }
};

/* ============================================================
   📌 COMPLETE CONSULTATION (in_progress → completed)
   ============================================================ */
export const completeConsultation = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { id } = req.params;
    const cons = await Consultation.findByPk(id, { transaction: t });
    if (!cons) return error(res, "❌ Consultation not found", null, 404);

    if (cons.status !== CS.IN_PROGRESS) {
      await t.rollback();
      return error(res, "❌ Only in-progress consultations can be completed", null, 400);
    }

    const oldStatus = cons.status;

    await cons.update(
      { status: CS.COMPLETED, updated_by_id: req.user?.id || null },
      { transaction: t }
    );

    // 🔹 If linked appointment exists, mark it completed too
    if (cons.appointment_id) {
      await Appointment.update(
        { status: "completed" },
        { where: { id: cons.appointment_id }, transaction: t }
      );
    }

    if (shouldTriggerBilling(MODULE_KEY, CS.COMPLETED)) {
      await billingService.triggerAutoBilling({
        module: MODULE_KEY,
        entity: cons,
        user: { 
          ...req.user, 
          organization_id: cons.organization_id, 
          facility_id: cons.facility_id 
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
      entity: cons,
      details: { from: oldStatus, to: CS.COMPLETED },
    });

    return success(res, "✅ Consultation marked as completed", cons);
  } catch (err) {
    await t.rollback();
    return error(res, "❌ Failed to complete consultation", err);
  }
};

/* ============================================================
   📌 CANCEL CONSULTATION (open/in_progress → cancelled)
   ============================================================ */
export const cancelConsultation = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const cons = await Consultation.findByPk(id, { transaction: t });
    if (!cons) return error(res, "❌ Consultation not found", null, 404);

    if (![CS.OPEN, CS.IN_PROGRESS].includes(cons.status)) {
      await t.rollback();
      return error(res, "❌ Only open or in-progress consultations can be cancelled", null, 400);
    }

    const oldStatus = cons.status;

    await cons.update(
      {
        status: CS.CANCELLED,
        cancel_reason: reason || null,
        cancelled_by_id: req.user?.id || null,
        updated_by_id: req.user?.id || null,
      },
      { transaction: t }
    );

    // 🔹 Cancel appointment if linked
    if (cons.appointment_id) {
      await Appointment.update(
        { status: "cancelled" },
        { where: { id: cons.appointment_id }, transaction: t }
      );
    }

    await billingService.voidCharges({
      module: MODULE_KEY,
      entityId: cons.id,
      user: req.user,
      transaction: t,
    });

    await t.commit();

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "cancel",
      entityId: id,
      entity: cons,
      details: { from: oldStatus, to: CS.CANCELLED, reason: reason || null },
    });

    return success(res, "✅ Consultation cancelled & charges voided", cons);
  } catch (err) {
    await t.rollback();
    return error(res, "❌ Failed to cancel consultation", err);
  }
};

/* ============================================================
   📌 VOID CONSULTATION (any → voided, admin/superadmin only)
   ============================================================ */
export const voidConsultation = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const role = (req.user?.roleNames?.[0] || "").toLowerCase();
    if (!["admin", "superadmin"].includes(role)) {
      return error(res, "❌ Only admin/superadmin can void consultations", null, 403);
    }

    const { id } = req.params;
    const { reason } = req.body;
    const cons = await Consultation.findByPk(id, { transaction: t });
    if (!cons) return error(res, "❌ Consultation not found", null, 404);

    const oldStatus = cons.status;

    await cons.update(
      {
        status: CS.VOIDED,
        void_reason: reason || null,
        voided_by_id: req.user?.id || null,
        updated_by_id: req.user?.id || null,
      },
      { transaction: t }
    );

    // 🔹 If linked appointment exists, mark it void/cancel too
    if (cons.appointment_id) {
      await Appointment.update(
        { status: "voided" }, // or "cancelled" if you don’t track "voided"
        { where: { id: cons.appointment_id }, transaction: t }
      );
    }

    await billingService.voidCharges({
      module: MODULE_KEY,
      entityId: cons.id,
      user: req.user,
      transaction: t,
    });

    await t.commit();

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "void",
      entityId: id,
      entity: cons,
      details: { from: oldStatus, to: CS.VOIDED, reason: reason || null },
    });

    return success(res, "✅ Consultation voided & charges rolled back", cons);
  } catch (err) {
    await t.rollback();
    return error(res, "❌ Failed to void consultation", err);
  }
};

/* ============================================================
   📌 VERIFY CONSULTATION (completed → verified)
   ============================================================ */
export const verifyConsultation = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { id } = req.params;
    const cons = await Consultation.findByPk(id, { transaction: t });
    if (!cons) return error(res, "❌ Consultation not found", null, 404);

    if (cons.status !== CS.COMPLETED) {
      await t.rollback();
      return error(res, "❌ Only completed consultations can be verified", null, 400);
    }

    const oldStatus = cons.status;

    await cons.update(
      { status: CS.VERIFIED, verified_by_id: req.user?.id || null },
      { transaction: t }
    );

    // 🔹 Update appointment if linked
    if (cons.appointment_id) {
      await Appointment.update(
        { status: "attended" }, // pick your enum: "attended" / "verified"
        { where: { id: cons.appointment_id }, transaction: t }
      );
    }

    if (shouldTriggerBilling(MODULE_KEY, CS.VERIFIED)) {
      await billingService.triggerAutoBilling({
        module: MODULE_KEY,
        entity: cons,
        user: {
          ...req.user,
          organization_id: cons.organization_id,
          facility_id: cons.facility_id,
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
      entity: cons,
      details: { from: oldStatus, to: CS.VERIFIED },
    });

    return success(res, "✅ Consultation verified", cons);
  } catch (err) {
    await t.rollback();
    return error(res, "❌ Failed to verify consultation", err);
  }
};


/* ============================================================
   📌 DELETE CONSULTATION (Soft Delete with Audit + Rollback Billing)
   ============================================================ */
export const deleteConsultation = async (req, res) => {
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
    } else {
      if (req.query.organization_id) where.organization_id = req.query.organization_id;
      if (req.query.facility_id) where.facility_id = req.query.facility_id;
    }

    const cons = await Consultation.findOne({ where, transaction: t });
    if (!cons) {
      await t.rollback();
      return error(res, "❌ Consultation not found", null, 404);
    }

    // 🔒 Block delete if dependent records exist
    const prescriptions = (await cons.countPrescriptions?.({ transaction: t })) || 0;
    if (prescriptions > 0) {
      await t.rollback();
      return error(res, "❌ Cannot delete — prescriptions exist", null, 400);
    }

    await billingService.voidCharges({
      module: MODULE_KEY,
      entityId: cons.id,
      user: { ...req.user, organization_id: cons.organization_id, facility_id: cons.facility_id },
      transaction: t,
    });

    // 🔹 If linked appointment exists, mark it cancelled
    if (cons.appointment_id) {
      await Appointment.update(
        { status: "cancelled" },
        { where: { id: cons.appointment_id }, transaction: t }
      );
    }

    await cons.update({ deleted_by_id: req.user?.id || null }, { transaction: t });
    await cons.destroy({ transaction: t });

    await t.commit();

    const full = await Consultation.findOne({
      where: { id },
      include: CONSULTATION_INCLUDES,
      paranoid: false,
    });

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "delete",
      entityId: id,
      entity: full,
    });

    return success(res, "✅ Consultation deleted (with billing rollback)", full);
  } catch (err) {
    await t.rollback();
    return error(res, "❌ Failed to delete consultation", err);
  }
};

