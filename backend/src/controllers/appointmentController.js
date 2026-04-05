// 📁 controllers/appointmentController.js

import Joi from "joi";
import { Op } from "sequelize";
import {
  sequelize,
  Appointment,
  Patient,
  Employee,
  Department,
  Facility,
  Organization,
  User,
  Invoice,
  Consultation,
} from "../models/index.js";
import { normalizeDateRangeLocal } from "../utils/date-utils.js";
import { success, error } from "../utils/response.js";
import { buildQueryOptions } from "../utils/queryHelper.js";
import { APPOINTMENT_STATUS } from "../constants/enums.js";
import { authzService } from "../services/authzService.js";
import { auditService } from "../services/auditService.js";
import { FIELD_VISIBILITY_APPOINTMENT } from "../constants/fieldVisibility.js";
import { billingService } from "../services/billingService.js";

import { CONSULTATION_STATUS } from "../constants/enums.js";
import { isSuperAdmin } from "../utils/role-utils.js";
import { resolveOrgFacility } from "../utils/resolveOrgFacility.js";
import { validate } from "../utils/validation.js";
import { makeModuleLogger } from "../utils/debugLogger.js";
import { buildDynamicSummary } from "../utils/summaryHelper.js";

/* ============================================================
   🔧 LOCAL DEBUG OVERRIDE (APPOINTMENT CONTROLLER)
============================================================ */
const DEBUG_OVERRIDE = false;
const debug = makeModuleLogger("appointmentController", DEBUG_OVERRIDE);

const MODULE_KEY = "appointments";

/* ============================================================
   🔖 STATUS MAP (MASTER / DELIVERY PARITY)
============================================================ */
const AS = APPOINTMENT_STATUS;

const BLOCKING_CONSULTATION_STATUSES = [
  CONSULTATION_STATUS.IN_PROGRESS,
  CONSULTATION_STATUS.COMPLETED,
  CONSULTATION_STATUS.VERIFIED,
];
/* ============================================================
   🆔 APPOINTMENT CODE GENERATOR
============================================================ */
function generateAppointmentCode() {
  const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const rand = Math.floor(Math.random() * 9000) + 1000;
  return `APT-${datePart}-${rand}`;
}

/* ============================================================
   🔗 SHARED INCLUDES (MASTER PARITY)
============================================================ */
const APPOINTMENT_INCLUDES = [
  { model: Patient, as: "patient", attributes: ["id", "pat_no", "first_name", "last_name"] },
  { model: Employee.unscoped(), as: "doctor", attributes: ["id", "first_name", "last_name"] },
  { model: Department, as: "department", attributes: ["id", "name"] },
  { model: Invoice, as: "invoice", attributes: ["id", "invoice_number", "status", "total"] },
  { model: Organization, as: "organization", attributes: ["id", "name", "code"] },
  { model: Facility, as: "facility", attributes: ["id", "name", "code", "organization_id"] },
  { model: User, as: "createdBy", attributes: ["id", "first_name", "last_name"] },
  { model: User, as: "updatedBy", attributes: ["id", "first_name", "last_name"] },
  { model: User, as: "deletedBy", attributes: ["id", "first_name", "last_name"] },
];

/* ============================================================
   📋 JOI SCHEMA (MASTER-ALIGNED, TENANT-SAFE)
============================================================ */
function buildAppointmentSchema(user, mode = "create") {
  const base = {
    appointment_code: Joi.string().max(50).allow("", null),
    patient_id: Joi.string().uuid().required(),
    doctor_id: Joi.string().uuid().required(),
    department_id: Joi.string().uuid().allow("", null),
    invoice_id: Joi.string().uuid().allow("", null),
    date_time: Joi.date().required(),
    notes: Joi.string().allow("", null),

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
   📌 CREATE APPOINTMENT — MASTER / DELIVERY PARITY
============================================================ */
export const createAppointment = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module: MODULE_KEY,
      action: "create",
      res,
    });
    if (!allowed) return;

    const { value, errors } = validate(
      buildAppointmentSchema(req.user, "create"),
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

    if (!orgId) {
      await t.rollback();
      return error(res, "Organization is required", null, 400);
    }

    /* ================= AUTO CODE ================= */
    if (!value.appointment_code || value.appointment_code.trim() === "") {
      value.appointment_code = generateAppointmentCode();
    }

    const created = await Appointment.create(
      {
        ...value,
        status: AS.SCHEDULED,
        organization_id: orgId,
        facility_id: facilityId,
        created_by_id: req.user?.id || null,
      },
      { transaction: t }
    );

    await t.commit();

    const full = await Appointment.findOne({
      where: { id: created.id },
      include: APPOINTMENT_INCLUDES,
    });

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "create",
      entityId: created.id,
      entity: full,
    });

    return success(res, "✅ Appointment created", full);
  } catch (err) {
    await t.rollback();
    debug.error("createAppointment → FAILED", err);
    return error(res, "❌ Failed to create appointment", err);
  }
};

/* ============================================================
   📌 UPDATE APPOINTMENT — MASTER (NO STATUS, NO BILLING)
============================================================ */
export const updateAppointment = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module: MODULE_KEY,
      action: "update",
      res,
    });
    if (!allowed) return;

    const { value, errors } = validate(
      buildAppointmentSchema(req.user, "update"),
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

    if (!orgId) {
      await t.rollback();
      return error(res, "Organization is required", null, 400);
    }

    const where = { id: req.params.id };

    if (!isSuperAdmin(req.user)) {
      where.organization_id = orgId;
      if (facilityId) where.facility_id = facilityId;
    }

    const record = await Appointment.findOne({ where, transaction: t });
    if (!record) {
      await t.rollback();
      return error(res, "Appointment not found", null, 404);
    }

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

    const full = await Appointment.findOne({
      where: { id: record.id },
      include: APPOINTMENT_INCLUDES,
    });

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "update",
      entityId: record.id,
      entity: full,
    });

    return success(res, "✅ Appointment updated", full);
  } catch (err) {
    await t.rollback();
    debug.error("updateAppointment → FAILED", err);
    return error(res, "❌ Failed to update appointment", err);
  }
};

/* ============================================================
   📌 ACTIVATE APPOINTMENT (scheduled → in_progress) — MASTER
============================================================ */
export const activateAppointment = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { id } = req.params;

    const record = await Appointment.findByPk(id, { transaction: t });
    if (!record) {
      await t.rollback();
      return error(res, "Appointment not found", null, 404);
    }

    if (record.status !== AS.SCHEDULED) {
      await t.rollback();
      return error(res, "❌ Only scheduled appointments can be activated", null, 400);
    }

    /* ================= CONSULTATION GUARD ================= */
    const cons = await Consultation.findOne({
      where: { appointment_id: record.id },
      transaction: t,
    });
    if (cons) {
      await t.rollback();
      return error(res, "❌ Consultation already exists for this appointment", null, 400);
    }

    const oldStatus = record.status;

    await record.update(
      {
        status: AS.IN_PROGRESS,
        updated_by_id: req.user?.id || null,
      },
      { transaction: t }
    );

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

    await t.commit();

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "activate",
      entityId: id,
      entity: record,
      details: { from: oldStatus, to: AS.IN_PROGRESS },
    });

    return success(res, "✅ Appointment activated", record);
  } catch (err) {
    await t.rollback();
    debug.error("activateAppointment → FAILED", err);
    return error(res, "❌ Failed to activate appointment", err);
  }
};

/* ============================================================
   📌 COMPLETE APPOINTMENT (in_progress → completed) — MASTER
============================================================ */
export const completeAppointment = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { id } = req.params;

    const record = await Appointment.findByPk(id, { transaction: t });
    if (!record) {
      await t.rollback();
      return error(res, "Appointment not found", null, 404);
    }

    if (record.status !== AS.IN_PROGRESS) {
      await t.rollback();
      return error(res, "❌ Only in-progress appointments can be completed", null, 400);
    }

    /* ================= CONSULTATION REQUIREMENT ================= */
    const cons = await Consultation.findOne({
      where: { appointment_id: record.id },
      transaction: t,
    });

    if (!cons || cons.status !== CONSULTATION_STATUS.COMPLETED) {
      await t.rollback();
      return error(
        res,
        "❌ Consultation must be completed before closing appointment",
        null,
        400
      );
    }

    const oldStatus = record.status;

    await record.update(
      {
        status: AS.COMPLETED,
        updated_by_id: req.user?.id || null,
      },
      { transaction: t }
    );

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

    await t.commit();

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "complete",
      entityId: id,
      entity: record,
      details: { from: oldStatus, to: AS.COMPLETED },
    });

    return success(res, "✅ Appointment completed", record);
  } catch (err) {
    await t.rollback();
    debug.error("completeAppointment → FAILED", err);
    return error(res, "❌ Failed to complete appointment", err);
  }
};
/* ============================================================
   📌 CANCEL APPOINTMENT (scheduled/in_progress → cancelled) — MASTER
============================================================ */
export const cancelAppointment = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { id } = req.params;

    const record = await Appointment.findByPk(id, { transaction: t });
    if (!record) {
      await t.rollback();
      return error(res, "Appointment not found", null, 404);
    }

    if (![AS.SCHEDULED, AS.IN_PROGRESS].includes(record.status)) {
      await t.rollback();
      return error(
        res,
        "❌ Only scheduled or in-progress appointments can be cancelled",
        null,
        400
      );
    }

    /* ================= CONSULTATION GUARD ================= */
    const cons = await Consultation.findOne({
      where: { appointment_id: record.id },
      transaction: t,
    });

    if (cons && BLOCKING_CONSULTATION_STATUSES.includes(cons.status)) {
      await t.rollback();
      return error(
        res,
        "❌ Cannot cancel appointment with active or completed consultation",
        null,
        400
      );
    }

    const oldStatus = record.status;

    await record.update(
      {
        status: AS.CANCELLED,
        updated_by_id: req.user?.id || null,
      },
      { transaction: t }
    );

    /* ================= BILLING (VOID) ================= */
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

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "cancel",
      entityId: id,
      entity: record,
      details: { from: oldStatus, to: AS.CANCELLED },
    });

    return success(res, "✅ Appointment cancelled & charges voided", record);
  } catch (err) {
    await t.rollback();
    debug.error("cancelAppointment → FAILED", err);
    return error(res, "❌ Failed to cancel appointment", err);
  }
};

/* ============================================================
   📌 MARK NO-SHOW APPOINTMENT (scheduled → no_show) — MASTER
============================================================ */
export const markNoShowAppointment = async (req, res) => {
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

    const where = { id };
    if (!isSuperAdmin(req.user)) {
      where.organization_id = req.user.organization_id;
      if (req.user.facility_id) where.facility_id = req.user.facility_id;
    }

    const record = await Appointment.findOne({ where, transaction: t });
    if (!record) {
      await t.rollback();
      return error(res, "Appointment not found", null, 404);
    }

    if (record.status !== AS.SCHEDULED) {
      await t.rollback();
      return error(
        res,
        "❌ Only scheduled appointments can be marked as no-show",
        null,
        400
      );
    }

    /* ================= CONSULTATION GUARD ================= */
    const cons = await Consultation.findOne({
      where: { appointment_id: record.id },
      transaction: t,
    });

    if (cons && BLOCKING_CONSULTATION_STATUSES.includes(cons.status)) {
      await t.rollback();
      return error(
        res,
        "❌ Cannot mark no-show with active or completed consultation",
        null,
        400
      );
    }

    const oldStatus = record.status;

    await record.update(
      {
        status: AS.NO_SHOW,
        updated_by_id: req.user?.id || null,
      },
      { transaction: t }
    );

    await t.commit();

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "mark_no_show",
      entityId: id,
      entity: record,
      details: { from: oldStatus, to: AS.NO_SHOW },
    });

    return success(res, "✅ Appointment marked as no-show", record);
  } catch (err) {
    await t.rollback();
    debug.error("markNoShowAppointment → FAILED", err);
    return error(res, "❌ Failed to mark appointment as no-show", err);
  }
};

/* ============================================================
   📌 VOID APPOINTMENT (any → voided) — MASTER
============================================================ */
export const voidAppointment = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module: MODULE_KEY,
      action: "void",
      res,
    });
    if (!allowed) return;

    const { id } = req.params;

    const where = { id };
    if (!isSuperAdmin(req.user)) {
      where.organization_id = req.user.organization_id;
      if (req.user.facility_id) where.facility_id = req.user.facility_id;
    }

    const record = await Appointment.findOne({ where, transaction: t });
    if (!record) {
      await t.rollback();
      return error(res, "Appointment not found", null, 404);
    }

    if (record.status === AS.VOIDED) {
      await t.rollback();
      return error(res, "❌ Appointment already voided", null, 400);
    }

    /* ================= CONSULTATION GUARD ================= */
    const cons = await Consultation.findOne({
      where: { appointment_id: record.id },
      transaction: t,
    });

    if (cons && BLOCKING_CONSULTATION_STATUSES.includes(cons.status)) {
      await t.rollback();
      return error(
        res,
        "❌ Cannot void appointment with active or completed consultation",
        null,
        400
      );
    }

    const oldStatus = record.status;

    /* ================= BILLING (VOID) ================= */
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

    await record.update(
      {
        status: AS.VOIDED,
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
      entity: record,
      details: { from: oldStatus, to: AS.VOIDED },
    });

    return success(res, "✅ Appointment voided & charges rolled back", record);
  } catch (err) {
    await t.rollback();
    debug.error("voidAppointment → FAILED", err);
    return error(res, "❌ Failed to void appointment", err);
  }
};

/* ============================================================
   📌 VERIFY APPOINTMENT (completed → verified) — MASTER
============================================================ */
export const verifyAppointment = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module: MODULE_KEY,
      action: "verify",
      res,
    });
    if (!allowed) return;

    const { id } = req.params;

    const where = { id };
    if (!isSuperAdmin(req.user)) {
      where.organization_id = req.user.organization_id;
      if (req.user.facility_id) where.facility_id = req.user.facility_id;
    }

    const record = await Appointment.findOne({ where, transaction: t });
    if (!record) {
      await t.rollback();
      return error(res, "Appointment not found", null, 404);
    }

    if (record.status !== AS.COMPLETED) {
      await t.rollback();
      return error(
        res,
        "❌ Only completed appointments can be verified",
        null,
        400
      );
    }

    const oldStatus = record.status;

    await record.update(
      {
        status: AS.VERIFIED,
        updated_by_id: req.user?.id || null,
      },
      { transaction: t }
    );

    await t.commit();

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "verify",
      entityId: id,
      entity: record,
      details: { from: oldStatus, to: AS.VERIFIED },
    });

    return success(res, "✅ Appointment verified", record);
  } catch (err) {
    await t.rollback();
    debug.error("verifyAppointment → FAILED", err);
    return error(res, "❌ Failed to verify appointment", err);
  }
};
/* ============================================================
   📌 DELETE APPOINTMENT (Soft Delete + Billing Rollback) — MASTER
============================================================ */
export const deleteAppointment = async (req, res) => {
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
      if (req.user.facility_id) where.facility_id = req.user.facility_id;
    }

    const record = await Appointment.findOne({ where, transaction: t });
    if (!record) {
      await t.rollback();
      return error(res, "Appointment not found", null, 404);
    }

    /* ================= CONSULTATION GUARD ================= */
    const cons = await Consultation.findOne({
      where: { appointment_id: record.id },
      transaction: t,
    });
    if (cons) {
      await t.rollback();
      return error(
        res,
        "❌ Cannot delete appointment — linked consultation exists",
        null,
        400
      );
    }

    /* ================= BILLING (VOID) ================= */
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

    /* ================= SOFT DELETE ================= */
    await record.update(
      { deleted_by_id: req.user?.id || null },
      { transaction: t }
    );
    await record.destroy({ transaction: t });

    await t.commit();

    const full = await Appointment.findOne({
      where: { id },
      include: APPOINTMENT_INCLUDES,
      paranoid: false,
    });

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "delete",
      entityId: id,
      entity: full,
    });

    return success(res, "✅ Appointment deleted (billing rolled back)", full);
  } catch (err) {
    await t.rollback();
    debug.error("deleteAppointment → FAILED", err);
    return error(res, "❌ Failed to delete appointment", err);
  }
};

/* ============================================================
   📌 RESTORE APPOINTMENT (cancelled/no_show/voided → scheduled) — MASTER
============================================================ */
export const restoreAppointment = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module: MODULE_KEY,
      action: "restore",
      res,
    });
    if (!allowed) return;

    const { id } = req.params;

    const where = { id };
    if (!isSuperAdmin(req.user)) {
      where.organization_id = req.user.organization_id;
      if (req.user.facility_id) where.facility_id = req.user.facility_id;
    }

    const record = await Appointment.findOne({
      where,
      paranoid: false,
      transaction: t,
    });
    if (!record) {
      await t.rollback();
      return error(res, "Appointment not found", null, 404);
    }

    if (![AS.CANCELLED, AS.NO_SHOW, AS.VOIDED].includes(record.status)) {
      await t.rollback();
      return error(
        res,
        "❌ Only cancelled, no-show, or voided appointments can be restored",
        null,
        400
      );
    }

    const oldStatus = record.status;

    await record.update(
      {
        status: AS.SCHEDULED,
        updated_by_id: req.user?.id || null,
      },
      { transaction: t }
    );

    await t.commit();

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "restore",
      entityId: id,
      entity: record,
      details: { from: oldStatus, to: AS.SCHEDULED },
    });

    return success(res, "✅ Appointment restored to scheduled", record);
  } catch (err) {
    await t.rollback();
    debug.error("restoreAppointment → FAILED", err);
    return error(res, "❌ Failed to restore appointment", err);
  }
};

/* ============================================================
   📌 GET ALL APPOINTMENTS — MASTER / STRICT (CONSULTATION PARITY)
============================================================ */
export const getAllAppointments = async (req, res) => {
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module: MODULE_KEY,
      action: "read",
      res,
    });
    if (!allowed) return;

    /* ================= ROLE → FIELD VISIBILITY ================= */
    const role = (req.user?.roleNames?.[0] || "staff").toLowerCase();
    const visibleFields =
      FIELD_VISIBILITY_APPOINTMENT[role] ||
      FIELD_VISIBILITY_APPOINTMENT.staff;

    /* ================= BASE QUERY OPTIONS ================= */
    const options = buildQueryOptions(req, {
      defaultSort: ["date_time", "DESC"],
      fields: visibleFields,
    });

    options.where = { [Op.and]: [] };

    /* ================= DATE RANGE (UI-ONLY, AUDIT-SAFE) ================= */
    if (req.query.dateRange) {
      const { start, end } = normalizeDateRangeLocal(req.query.dateRange);
      if (start && end) {
        options.where[Op.and].push({
          created_at: { [Op.between]: [start, end] },
        });
      }
    }

    /* ================= TENANT SCOPE (EXACT CONSULTATION PARITY) ================= */
    if (!isSuperAdmin(req.user)) {
      // 🔒 Always lock to organization
      options.where[Op.and].push({
        organization_id: req.user.organization_id,
      });

      // 🔒 Facility Head → always locked
      if (req.user.roleNames?.includes("facility_head")) {
        options.where[Op.and].push({
          facility_id: req.user.facility_id,
        });
      }
      // ✅ Org Admin / others → ONLY when user selects
      else if (req.query.facility_id) {
        options.where[Op.and].push({
          facility_id: req.query.facility_id,
        });
      }
    } else {
      // 🧠 SuperAdmin → filters ONLY when selected
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

    /* ================= SAFE FILTERS (USER-DRIVEN ONLY) ================= */
    ["department_id", "patient_id", "doctor_id"].forEach((key) => {
      if (req.query[key]) {
        options.where[Op.and].push({ [key]: req.query[key] });
      }
    });

    if (req.query.status) {
      const statuses = Array.isArray(req.query.status)
        ? req.query.status
        : req.query.status.split(",").map((s) => s.trim());
      options.where[Op.and].push({
        status: { [Op.in]: statuses },
      });
    }

    /* ================= GLOBAL SEARCH ================= */
    if (options.search) {
      options.where[Op.and].push({
        [Op.or]: [
          { notes: { [Op.iLike]: `%${options.search}%` } },
          { appointment_code: { [Op.iLike]: `%${options.search}%` } },
        ],
      });
    }

    /* ================= MAIN QUERY ================= */
    const { count, rows } = await Appointment.findAndCountAll({
      where: options.where,
      include: APPOINTMENT_INCLUDES,
      order: options.order,
      offset: options.offset,
      limit: options.limit,
      distinct: true,
    });

    /* ================= SUMMARY ================= */
    const summary = await buildDynamicSummary({
      model: Appointment,
      options,
      statusEnums: Object.values(AS),
      includeGender: true,
      genderJoin: { model: Patient, as: "patient" },
    });

    /* ================= AUDIT ================= */
    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "list",
      details: {
        query: req.query,
        returned: count,
      },
    });

    /* ================= RESPONSE ================= */
    return success(res, "✅ Appointments loaded", {
      records: rows,
      pagination: {
        total: count,
        page: options.pagination.page,
        pageCount: Math.ceil(count / options.pagination.limit),
      },
      summary,
    });
  } catch (err) {
    debug.error("getAllAppointments → FAILED", err);
    return error(res, "❌ Failed to load appointments", err);
  }
};

/* ============================================================
   📌 GET APPOINTMENT BY ID — MASTER
============================================================ */
export const getAppointmentById = async (req, res) => {
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

    /* ================= TENANT SCOPE ================= */
    if (!isSuperAdmin(req.user)) {
      where.organization_id = req.user.organization_id;
      if (req.user.facility_id) {
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

    const record = await Appointment.findOne({
      where,
      include: APPOINTMENT_INCLUDES,
    });

    if (!record) {
      return error(res, "❌ Appointment not found", null, 404);
    }

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "view",
      entityId: id,
      entity: record,
    });

    return success(res, "✅ Appointment loaded", record);
  } catch (err) {
    debug.error("getAppointmentById → FAILED", err);
    return error(res, "❌ Failed to load appointment", err);
  }
};

/* ============================================================
   📌 GET ALL APPOINTMENTS LITE — MASTER
============================================================ */
export const getAllAppointmentsLite = async (req, res) => {
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
      status: { [Op.in]: [AS.SCHEDULED, AS.IN_PROGRESS] },
    };

    /* ================= TENANT SCOPE ================= */
    if (!isSuperAdmin(req.user)) {
      where.organization_id = req.user.organization_id;
      if (req.user.facility_id) {
        where.facility_id = req.user.facility_id;
      }
    }

    /* ================= SEARCH ================= */
    if (q) {
      where[Op.or] = [
        { appointment_code: { [Op.iLike]: `%${q}%` } },
        { notes: { [Op.iLike]: `%${q}%` } },
      ];
    }

    const rows = await Appointment.findAll({
      where,
      attributes: ["id", "appointment_code", "date_time", "status"],
      include: [
        {
          model: Patient,
          as: "patient",
          attributes: ["id", "pat_no", "first_name", "last_name"],
        },
      ],
      order: [["date_time", "DESC"]],
      limit: 20,
    });

    const records = rows.map((r) => ({
      id: r.id,
      label: r.patient
        ? `${r.patient.pat_no} · ${r.patient.first_name} ${r.patient.last_name}`
        : "",
      code: r.appointment_code,
      date: r.date_time,
      status: r.status,
    }));

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "list_lite",
      details: { count: records.length, q: q || null },
    });

    return success(res, "✅ Appointments loaded (lite)", { records });
  } catch (err) {
    debug.error("getAllAppointmentsLite → FAILED", err);
    return error(res, "❌ Failed to load appointments (lite)", err);
  }
};
