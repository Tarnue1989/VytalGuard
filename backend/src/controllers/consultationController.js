// 📁 controllers/consultationController.js
// ============================================================================
// 🩺 Consultation Controller – ENTERPRISE MASTER–ALIGNED (Delivery Billing Style)
// ----------------------------------------------------------------------------
// 🔹 NO billing constants / shouldTriggerBilling
// 🔹 NO inline role helpers
// 🔹 Uses role-utils + resolveOrgFacility
// 🔹 Billing handled ONLY via billingService
// ============================================================================

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
import { validatePaginationStrict } from "../utils/query-utils.js";
import { normalizeDateRangeLocal } from "../utils/date-utils.js";
import { validate } from "../utils/validation.js";
import { resolveOrgFacility } from "../utils/resolveOrgFacility.js";
import {
  isSuperAdmin,
  isOrgLevelUser,
  isFacilityHead,
} from "../utils/role-utils.js";
import { makeModuleLogger } from "../utils/debugLogger.js";

import {
  CONSULTATION_STATUS,
  REGISTRATION_LOG_STATUS,
} from "../constants/enums.js";
import { FIELD_VISIBILITY_CONSULTATION } from "../constants/fieldVisibility.js";

import { authzService } from "../services/authzService.js";
import { auditService } from "../services/auditService.js";
import { billingService } from "../services/billingService.js";

/* ============================================================
   🔐 MODULE
============================================================ */
const MODULE_KEY = "consultations";

/* ============================================================
   🔧 DEBUG LOGGER
============================================================ */
const DEBUG_OVERRIDE = false;
const debug = makeModuleLogger("consultationController", DEBUG_OVERRIDE);

/* ============================================================
   🔖 STATUS MAP (ENUM-DRIVEN, DELIVERY PARITY)
============================================================ */
const CS = {
  OPEN: CONSULTATION_STATUS[0],
  IN_PROGRESS: CONSULTATION_STATUS[1],
  COMPLETED: CONSULTATION_STATUS[2],
  VERIFIED: CONSULTATION_STATUS[3],
  CANCELLED: CONSULTATION_STATUS[4],
  VOIDED: CONSULTATION_STATUS[5],
};

/* ============================================================
   🔗 SHARED INCLUDES (MASTER PARITY)
============================================================ */
const CONSULTATION_INCLUDES = [
  { model: Patient, as: "patient", attributes: ["id", "pat_no", "first_name", "last_name"] },
  { model: Employee.unscoped(), as: "doctor", attributes: ["id", "first_name", "last_name"] },
  { model: Department, as: "department", attributes: ["id", "name", "code"] },
  { model: Appointment, as: "appointment", attributes: ["id", "appointment_code", "status"] },
  {
    model: RegistrationLog,
    as: "registrationLog",
    attributes: ["id", "registration_time", "log_status"],
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
   📋 JOI SCHEMA (MASTER-ALIGNED, TENANT-SAFE)
============================================================ */
function buildConsultationSchema(mode = "create") {
  const base = {
    appointment_id: Joi.string().uuid().allow(null, ""),
    registration_log_id: Joi.forbidden(),
    recommendation_id: Joi.string().uuid().allow(null, ""),
    parent_consultation_id: Joi.string().uuid().allow(null, ""),
    patient_id: Joi.string().uuid().required(),
    doctor_id: Joi.string().uuid().allow(null, ""),
    department_id: Joi.string().uuid().allow(null, ""),
    invoice_id: Joi.string().uuid().allow(null, ""),
    consultation_type_id: Joi.string().uuid().allow(null, ""),
    consultation_date: Joi.date().default(() => new Date()),
    diagnosis: Joi.string().max(255).allow("", null),
    consultation_notes: Joi.string().allow("", null),
    prescribed_medications: Joi.string().allow("", null),

    // 🔒 lifecycle-controlled
    status: Joi.forbidden(),
    organization_id: Joi.forbidden(),
    facility_id: Joi.forbidden(),
  };

  if (mode === "update") {
    Object.keys(base).forEach((k) => {
      base[k] = base[k].optional();
    });
  }

  return Joi.object(base);
}

/* ============================================================
   📌 CREATE CONSULTATION — MASTER / DELIVERY PARITY
============================================================ */
export const createConsultation = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module_key: MODULE_KEY,
      action: "create",
      res,
    });
    if (!allowed) return;

    const { value, errors } = validate(
      buildConsultationSchema("create"),
      req.body
    );
    if (errors) {
      await t.rollback();
      return error(res, "Validation failed", errors, 400);
    }

    /* ================= TENANT RESOLUTION (MASTER) ================= */
    const { orgId, facilityId } = await resolveOrgFacility({
      user: req.user,
      value,
      body: req.body,
    });

    /* ================= DOCTOR ASSIGNMENT (ROLE-UTIL) ================= */
    if (isSuperAdmin(req.user)) {
      if (!value.doctor_id) {
        await t.rollback();
        return error(res, "Doctor is required for superadmin", null, 400);
      }
    } else {
      value.doctor_id = req.user.employee_id;
    }

    /* ================= REGISTRATION LOG AUTO-LINK ================= */
    const whereLog = {
      patient_id: value.patient_id,
      log_status: REGISTRATION_LOG_STATUS[2],
      organization_id: orgId,
      facility_id: facilityId,
    };

    const activeLog = await RegistrationLog.findOne({
      where: whereLog,
      order: [["registration_time", "DESC"]],
      transaction: t,
    });

    if (!activeLog) {
      await t.rollback();
      return error(
        res,
        "❌ No active registration log found for patient",
        null,
        400
      );
    }

    value.registration_log_id = activeLog.id;

    /* ================= DUPLICATE ACTIVE GUARD ================= */
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
        "❌ Patient already has an active consultation",
        null,
        400
      );
    }

    /* ================= CREATE ================= */
    const created = await Consultation.create(
      {
        ...value,
        status: CS.OPEN,
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
      module_key: MODULE_KEY,
      action: "create",
      entityId: created.id,
      entity: full,
    });

    return success(res, "✅ Consultation created", full);
  } catch (err) {
    await t.rollback();
    debug.error("createConsultation → FAILED", err);
    return error(res, "❌ Failed to create consultation", err);
  }
};

/* ============================================================
   📌 UPDATE CONSULTATION — MASTER
============================================================ */
export const updateConsultation = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module_key: MODULE_KEY,
      action: "update",
      res,
    });
    if (!allowed) return;

    const { value, errors } = validate(
      buildConsultationSchema("update"),
      req.body
    );
    if (errors) {
      await t.rollback();
      return error(res, "Validation failed", errors, 400);
    }

    const record = await Consultation.findByPk(req.params.id, {
      transaction: t,
    });
    if (!record) {
      await t.rollback();
      return error(res, "Consultation not found", null, 404);
    }

    /* ================= DOCTOR ASSIGNMENT ================= */
    if (!isSuperAdmin(req.user)) {
      value.doctor_id = req.user.employee_id;
    }

    /* ================= DUPLICATE ACTIVE GUARD ================= */
    if (value.patient_id && value.patient_id !== record.patient_id) {
      const dup = await Consultation.findOne({
        where: {
          patient_id: value.patient_id,
          organization_id: record.organization_id,
          facility_id: record.facility_id,
          status: { [Op.in]: [CS.OPEN, CS.IN_PROGRESS] },
          id: { [Op.ne]: record.id },
        },
        transaction: t,
      });

      if (dup) {
        await t.rollback();
        return error(
          res,
          "❌ Patient already has an active consultation",
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
      where: { id: record.id },
      include: CONSULTATION_INCLUDES,
    });

    await auditService.logAction({
      user: req.user,
      module_key: MODULE_KEY,
      action: "update",
      entityId: record.id,
      entity: full,
    });

    return success(res, "✅ Consultation updated", full);
  } catch (err) {
    await t.rollback();
    debug.error("updateConsultation → FAILED", err);
    return error(res, "❌ Failed to update consultation", err);
  }
};

/* ============================================================
   📌 GET ALL CONSULTATIONS — MASTER / STRICT (FULL FILTER PARITY)
============================================================ */
export const getAllConsultations = async (req, res) => {
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
      FIELD_VISIBILITY_CONSULTATION[role] ||
      FIELD_VISIBILITY_CONSULTATION.staff;

    /* ================= STRIP UI-ONLY PARAMS ================= */
    const {
      dateRange,
      status,
      doctor_id,
      department_id,
      consultation_type_id,
      facility_id, // 👈 explicitly captured
      ...safeQuery
    } = req.query;

    safeQuery.limit = limit;
    safeQuery.page = page;
    req.query = safeQuery;

    const options = buildQueryOptions(
      req,
      "consultation_date",
      "DESC",
      visibleFields
    );

    options.where = { [Op.and]: [] };

    /* ========================================================
       📅 DATE RANGE (created_at)
    ======================================================== */
    if (dateRange) {
      const { start, end } = normalizeDateRangeLocal(dateRange);
      if (start && end) {
        options.where[Op.and].push({
          created_at: { [Op.between]: [start, end] },
        });
      }
    }


    /* ================= TENANT SCOPE (CORRECTED) ================= */
    if (!isSuperAdmin(req.user)) {
      // Always lock to org
      options.where[Op.and].push({
        organization_id: req.user.organization_id,
      });

      if (isFacilityHead(req.user)) {
        // Facility head is hard-locked
        options.where[Op.and].push({
          facility_id: req.user.facility_id,
        });
      } else if (facility_id) {
        // ✅ Org Admin allowed to filter by facility
        options.where[Op.and].push({
          facility_id,
        });
      }
    } else {
      // SuperAdmin fully flexible
      if (req.query.organization_id) {
        options.where[Op.and].push({
          organization_id: req.query.organization_id,
        });
      }
      if (facility_id) {
        options.where[Op.and].push({
          facility_id,
        });
      }
    }

    /* ================= PATIENT FILTER ================= */
    if (req.query.patient_id) {
      options.where[Op.and].push({
        patient_id: req.query.patient_id,
      });
    }

    /* ================= DOCTOR FILTER ================= */
    if (doctor_id) {
      options.where[Op.and].push({ doctor_id });
    }

    /* ================= DEPARTMENT FILTER ================= */
    if (department_id) {
      options.where[Op.and].push({ department_id });
    }

    /* ================= CONSULTATION TYPE FILTER ================= */
    if (consultation_type_id) {
      options.where[Op.and].push({ consultation_type_id });
    }

    /* ================= STATUS FILTER ================= */
    if (status) {
      const statuses = Array.isArray(status)
        ? status
        : status.split(",").map((s) => s.trim());

      options.where[Op.and].push({
        status: { [Op.in]: statuses },
      });
    }

    /* ================= GLOBAL SEARCH ================= */
    if (options.search) {
      options.where[Op.and].push({
        [Op.or]: [
          { diagnosis: { [Op.iLike]: `%${options.search}%` } },
          { consultation_notes: { [Op.iLike]: `%${options.search}%` } },
        ],
      });
    }

    /* ================= MAIN QUERY ================= */
    const { count, rows } = await Consultation.findAndCountAll({
      where: options.where,
      include: CONSULTATION_INCLUDES,
      order: options.order,
      offset,
      limit,
      distinct: true,
    });

    /* ================= MASTER SUMMARY ================= */
    const summary = { total: count };

    const statusCounts = await Consultation.findAll({
      where: options.where,
      attributes: [
        "status",
        [sequelize.fn("COUNT", sequelize.col("id")), "count"],
      ],
      group: ["status"],
    });

    Object.values(CS).forEach((s) => {
      const found = statusCounts.find((r) => r.status === s);
      summary[s] = found ? Number(found.get("count")) : 0;
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

    /* ================= RESPONSE ================= */
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
    debug.error("getAllConsultations → FAILED", err);
    return error(res, "❌ Failed to load consultations", err);
  }
};



/* ============================================================
   📌 GET CONSULTATION BY ID — MASTER
============================================================ */
export const getConsultationById = async (req, res) => {
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

    const record = await Consultation.findOne({
      where,
      include: CONSULTATION_INCLUDES,
    });

    if (!record) {
      return error(res, "❌ Consultation not found", null, 404);
    }

    await auditService.logAction({
      user: req.user,
      module_key: MODULE_KEY,
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
   📌 GET ALL CONSULTATIONS LITE — MASTER
============================================================ */
export const getAllConsultationsLite = async (req, res) => {
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module_key: MODULE_KEY,
      action: "read",
      res,
    });
    if (!allowed) return;

    const { q, patient_id, status } = req.query;
    const where = {};

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

    /* ================= FILTERS ================= */
    if (patient_id) where.patient_id = patient_id;

    if (status) {
      const statuses = Array.isArray(status)
        ? status
        : status.split(",").map((s) => s.trim());
      where.status = { [Op.in]: statuses };
    } else {
      where.status = { [Op.in]: [CS.OPEN, CS.IN_PROGRESS] };
    }

    if (q) {
      where[Op.or] = [
        { diagnosis: { [Op.iLike]: `%${q}%` } },
        { consultation_notes: { [Op.iLike]: `%${q}%` } },
      ];
    }

    const rows = await Consultation.findAll({
      where,
      attributes: ["id", "consultation_date", "diagnosis", "status"],
      include: [
        { model: Patient, as: "patient", attributes: ["id", "pat_no", "first_name", "last_name"] },
        { model: Employee.unscoped(), as: "doctor", attributes: ["id", "first_name", "last_name"] },
      ],
      order: [["consultation_date", "DESC"]],
      limit: 20,
    });

    const records = rows.map((c) => {
      const doctor = c.doctor
        ? `Dr. ${c.doctor.first_name} ${c.doctor.last_name}`
        : "No Doctor";

      const labelDate = c.consultation_date
        ? new Date(c.consultation_date).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          })
        : "Unknown";

      return {
        id: c.id,
        label: `${labelDate} · ${(c.status || "").toLowerCase()} · ${doctor}`,
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
      module_key: MODULE_KEY,
      action: "list_lite",
      details: { count: records.length, q: q || null },
    });

    return success(res, "✅ Consultations loaded (lite)", { records });
  } catch (err) {
    return error(res, "❌ Failed to load consultations (lite)", err);
  }
};

/* ============================================================
   📌 START CONSULTATION (open → in_progress) — MASTER + BILLING
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

    /* ================= STATUS UPDATE ================= */
    await cons.update(
      {
        status: CS.IN_PROGRESS,
        updated_by_id: req.user?.id || null,
      },
      { transaction: t }
    );

    /* ================= APPOINTMENT SYNC ================= */
    if (cons.appointment_id) {
      await Appointment.update(
        { status: "in_progress" },
        { where: { id: cons.appointment_id }, transaction: t }
      );
    }

    /* ================= BILLING (REGISTRATION PARITY) ================= */
    await billingService.triggerAutoBilling({
      module_key: MODULE_KEY,
      entity: {
        ...cons.toJSON(),
        billable_item_id: cons.consultation_type_id,
      },
      user: {
        ...req.user,
        organization_id: cons.organization_id,
        facility_id: cons.facility_id,
      },
      transaction: t,
    });

    await t.commit();

    await auditService.logAction({
      user: req.user,
      module_key: MODULE_KEY,
      action: "start",
      entityId: id,
      entity: {
     ...cons.toJSON(),
        billable_item_id: cons.consultation_type_id,
      },
      details: { from: oldStatus, to: CS.IN_PROGRESS },
    });

    return success(res, "✅ Consultation started", cons);
  } catch (err) {
    await t.rollback();
    return error(res, "❌ Failed to start consultation", err);
  }
};
/* ============================================================
   📌 COMPLETE CONSULTATION (in_progress → completed) — MASTER (NO BILLING)
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

    /* ================= STATUS UPDATE ================= */
    await cons.update(
      {
        status: CS.COMPLETED,
        updated_by_id: req.user?.id || null,
      },
      { transaction: t }
    );

    /* ================= APPOINTMENT SYNC ================= */
    if (cons.appointment_id) {
      await Appointment.update(
        { status: "completed" },
        { where: { id: cons.appointment_id }, transaction: t }
      );
    }

    await t.commit();

    await auditService.logAction({
      user: req.user,
      module_key: MODULE_KEY,
      action: "complete",
      entityId: id,
      entity: cons,
      details: { from: oldStatus, to: CS.COMPLETED },
    });

    return success(res, "✅ Consultation completed", cons);
  } catch (err) {
    await t.rollback();
    return error(res, "❌ Failed to complete consultation", err);
  }
};

/* ============================================================
   📌 VERIFY CONSULTATION (completed → verified) — MASTER (NO BILLING)
============================================================ */
export const verifyConsultation = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { id } = req.params;

    const cons = await Consultation.findByPk(id, { transaction: t });
    if (!cons) {
      await t.rollback();
      return error(res, "❌ Consultation not found", null, 404);
    }

    if (cons.status !== CS.COMPLETED) {
      await t.rollback();
      return error(
        res,
        "❌ Only completed consultations can be verified",
        null,
        400
      );
    }

    const oldStatus = cons.status;

    /* ================= STATUS UPDATE ================= */
    await cons.update(
      {
        status: CS.VERIFIED,
        verified_by_id: req.user?.id || null,
        updated_by_id: req.user?.id || null,
      },
      { transaction: t }
    );

    /* ================= APPOINTMENT SYNC ================= */
    if (cons.appointment_id) {
      await Appointment.update(
        { status: "attended" },
        { where: { id: cons.appointment_id }, transaction: t }
      );
    }

    await t.commit();

    await auditService.logAction({
      user: req.user,
      module_key: MODULE_KEY,
      action: "verify",
      entityId: id,
      entity: {
        ...cons.toJSON(),
        billable_item_id: cons.consultation_type_id,
      },
      details: { from: oldStatus, to: CS.VERIFIED },
    });

    return success(res, "✅ Consultation verified", cons);
  } catch (err) {
    await t.rollback();
    return error(res, "❌ Failed to verify consultation", err);
  }
};
/* ============================================================
   📌 CANCEL CONSULTATION (open/in_progress → cancelled) — MASTER
============================================================ */
export const cancelConsultation = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const cons = await Consultation.findByPk(id, { transaction: t });
    if (!cons) {
      await t.rollback();
      return error(res, "❌ Consultation not found", null, 404);
    }

    if (![CS.OPEN, CS.IN_PROGRESS].includes(cons.status)) {
      await t.rollback();
      return error(
        res,
        "❌ Only open or in-progress consultations can be cancelled",
        null,
        400
      );
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

    if (cons.appointment_id) {
      await Appointment.update(
        { status: "cancelled" },
        { where: { id: cons.appointment_id }, transaction: t }
      );
    }

    await billingService.voidCharges({
      module_key: MODULE_KEY,
      entityId: cons.id,
      user: {
        ...req.user,
        organization_id: cons.organization_id,
        facility_id: cons.facility_id,
      },
      transaction: t,
    });

    await t.commit();

    await auditService.logAction({
      user: req.user,
      module_key: MODULE_KEY,
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
   📌 VOID CONSULTATION (any → voided) — MASTER
============================================================ */
export const voidConsultation = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module_key: MODULE_KEY,
      action: "void",
      res,
    });
    if (!allowed) return;

    const { id } = req.params;
    const { reason } = req.body;

    const cons = await Consultation.findByPk(id, { transaction: t });
    if (!cons) {
      await t.rollback();
      return error(res, "❌ Consultation not found", null, 404);
    }

    if (cons.status === CS.VOIDED) {
      await t.rollback();
      return error(res, "❌ Consultation already voided", null, 400);
    }

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

    if (cons.appointment_id) {
      await Appointment.update(
        { status: "voided" },
        { where: { id: cons.appointment_id }, transaction: t }
      );
    }

    await billingService.voidCharges({
      module_key: MODULE_KEY,
      entityId: cons.id,
      user: {
        ...req.user,
        organization_id: cons.organization_id,
        facility_id: cons.facility_id,
      },
      transaction: t,
    });

    await t.commit();

    await auditService.logAction({
      user: req.user,
      module_key: MODULE_KEY,
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
   📌 DELETE CONSULTATION (Soft Delete + Billing Rollback) — MASTER
============================================================ */
export const deleteConsultation = async (req, res) => {
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

    const cons = await Consultation.findOne({ where, transaction: t });
    if (!cons) {
      await t.rollback();
      return error(res, "❌ Consultation not found", null, 404);
    }

    const prescriptions =
      (await cons.countPrescriptions?.({ transaction: t })) || 0;
    if (prescriptions > 0) {
      await t.rollback();
      return error(res, "❌ Cannot delete — prescriptions exist", null, 400);
    }

    await billingService.voidCharges({
      module_key: MODULE_KEY,
      entityId: cons.id,
      user: {
        ...req.user,
        organization_id: cons.organization_id,
        facility_id: cons.facility_id,
      },
      transaction: t,
    });

    if (cons.appointment_id) {
      await Appointment.update(
        { status: "cancelled" },
        { where: { id: cons.appointment_id }, transaction: t }
      );
    }

    await cons.update(
      { deleted_by_id: req.user?.id || null },
      { transaction: t }
    );
    await cons.destroy({ transaction: t });

    await t.commit();

    const full = await Consultation.findOne({
      where: { id },
      include: CONSULTATION_INCLUDES,
      paranoid: false,
    });

    await auditService.logAction({
      user: req.user,
      module_key: MODULE_KEY,
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

