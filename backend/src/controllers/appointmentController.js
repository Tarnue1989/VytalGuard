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

import { isSuperAdmin } from "../utils/role-utils.js";
import { resolveOrgFacility } from "../utils/resolveOrgFacility.js";
import { validate } from "../utils/validation.js";
import { makeModuleLogger } from "../utils/debugLogger.js";
import { buildDynamicSummary } from "../utils/summaryHelper.js";

/* ============================================================
   🔧 LOCAL DEBUG OVERRIDE (APPOINTMENT CONTROLLER)
============================================================ */
const DEBUG_OVERRIDE = false; // 👈 NEVER commit true
const debug = makeModuleLogger("appointmentController", DEBUG_OVERRIDE);

const MODULE_KEY = "appointments";

/* ============================================================
   🆔 APPOINTMENT CODE GENERATOR
============================================================ */
function generateAppointmentCode() {
  const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const rand = Math.floor(Math.random() * 9000) + 1000;
  return `APT-${datePart}-${rand}`;
}

/* ============================================================
   🔗 SHARED INCLUDES
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
   📋 JOI SCHEMA (ROLE-AWARE, SAFE)
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

    // system (injected)
    organization_id: Joi.forbidden(),
    facility_id: Joi.forbidden(),
  };

  if (mode === "update") {
    base.status = Joi.string()
      .valid(...Object.values(APPOINTMENT_STATUS))
      .optional();

    Object.keys(base).forEach(k => {
      base[k] = base[k].optional();
    });
  }

  // 🔓 Superadmin override
  if (isSuperAdmin(user)) {
    base.organization_id = Joi.string().uuid().allow("", null);
    base.facility_id = Joi.string().uuid().allow("", null);
  }

  return Joi.object(base);
}

/* ============================================================
   📌 CREATE APPOINTMENT
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

    debug.log("create → incoming body", req.body);

    const { value, errors } = validate(
      buildAppointmentSchema(req.user, "create"),
      req.body
    );

    if (errors) {
      debug.warn("create → validation error", errors);
      await t.rollback();
      return error(res, "Validation failed", errors, 400);
    }

    /* ================= ORG / FACILITY ================= */
    const { orgId, facilityId } = resolveOrgFacility({
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

    debug.log("create → final payload", {
      ...value,
      organization_id: orgId,
      facility_id: facilityId,
    });

    const created = await Appointment.create(
      {
        ...value,
        status: APPOINTMENT_STATUS.SCHEDULED,
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
    debug.error("create → FAILED", err);
    return error(res, "❌ Failed to create appointment", err);
  }
};

/* ============================================================
   📌 UPDATE APPOINTMENT
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

    const { id } = req.params;

    debug.log("update → incoming body", req.body);

    const { value, errors } = validate(
      buildAppointmentSchema(req.user, "update"),
      req.body
    );

    if (errors) {
      debug.warn("update → validation error", errors);
      await t.rollback();
      return error(res, "Validation failed", errors, 400);
    }

    /* ================= ORG / FACILITY ================= */
    const { orgId, facilityId } = resolveOrgFacility({
      user: req.user,
      value,
      body: req.body,
    });

    if (!orgId) {
      await t.rollback();
      return error(res, "Organization is required", null, 400);
    }

    const where = { id };
    if (!isSuperAdmin(req.user)) {
      where.organization_id = orgId;
    }

    const record = await Appointment.findOne({ where, transaction: t });
    if (!record) {
      await t.rollback();
      return error(res, "Appointment not found", null, 404);
    }

    const oldStatus = record.status;

    await record.update(
      {
        ...value,
        organization_id: orgId,
        facility_id: facilityId,
        updated_by_id: req.user?.id || null,
      },
      { transaction: t }
    );

    /* ================= DB-DRIVEN BILLING ================= */
    if (oldStatus !== record.status) {
      await billingService.triggerAutoBilling({
        module: MODULE_KEY,
        entity: record,
        user: {
          ...req.user,
          organization_id: orgId,
          facility_id: facilityId,
        },
        transaction: t,
      });
    }

    await t.commit();

    const full = await Appointment.findOne({
      where: { id },
      include: APPOINTMENT_INCLUDES,
    });

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "update",
      entityId: id,
      entity: full,
      details: { from: oldStatus, to: record.status },
    });

    return success(res, "✅ Appointment updated", full);
  } catch (err) {
    await t.rollback();
    debug.error("update → FAILED", err);
    return error(res, "❌ Failed to update appointment", err);
  }
};
/* ============================================================
   📌 TOGGLE APPOINTMENT STATUS (scheduled ↔ cancelled)
============================================================ */
export const toggleAppointmentStatus = async (req, res) => {
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

    debug.log("toggle_status → request", { id });

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

    // 🔎 Block toggle if consultation active/completed
    const cons = await Consultation.findOne({
      where: { appointment_id: record.id },
      transaction: t,
    });

    if (cons && ["in_progress", "completed", "verified"].includes(cons.status)) {
      await t.rollback();
      return error(
        res,
        "Cannot toggle appointment with active or completed consultation",
        null,
        400
      );
    }

    const oldStatus = record.status;
    let newStatus = oldStatus;

    if (oldStatus === APPOINTMENT_STATUS.SCHEDULED) {
      newStatus = APPOINTMENT_STATUS.CANCELLED;
    } else if (oldStatus === APPOINTMENT_STATUS.CANCELLED) {
      newStatus = APPOINTMENT_STATUS.SCHEDULED;
    }

    if (oldStatus === newStatus) {
      await t.rollback();
      return success(res, "No status change", record);
    }

    await record.update(
      { status: newStatus, updated_by_id: req.user?.id || null },
      { transaction: t }
    );

    // 💰 Billing (DB-driven)
    if (newStatus === APPOINTMENT_STATUS.CANCELLED) {
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
    } else {
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

    const full = await Appointment.findOne({
      where: { id },
      include: APPOINTMENT_INCLUDES,
    });

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "toggle_status",
      entityId: id,
      entity: full,
      details: { from: oldStatus, to: newStatus },
    });

    return success(res, `Appointment status set to ${newStatus}`, full);
  } catch (err) {
    await t.rollback();
    debug.error("toggle_status → FAILED", err);
    return error(res, "Failed to toggle appointment status", err);
  }
};

/* ============================================================
   📌 ACTIVATE APPOINTMENT (scheduled → in_progress)
============================================================ */
export const activateAppointment = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { id } = req.params;

    debug.log("activate → request", { id });

    const record = await Appointment.findByPk(id, { transaction: t });
    if (!record) {
      await t.rollback();
      return error(res, "Appointment not found", null, 404);
    }

    if (record.status !== APPOINTMENT_STATUS.SCHEDULED) {
      await t.rollback();
      return error(res, "Only scheduled appointments can be activated", null, 400);
    }

    // 🔎 Prevent activation if consultation exists
    const cons = await Consultation.findOne({
      where: { appointment_id: record.id },
      transaction: t,
    });
    if (cons) {
      await t.rollback();
      return error(
        res,
        "Consultation already exists for this appointment",
        null,
        400
      );
    }

    const oldStatus = record.status;

    await record.update(
      {
        status: APPOINTMENT_STATUS.IN_PROGRESS,
        updated_by_id: req.user?.id || null,
      },
      { transaction: t }
    );

    // 💰 Billing (DB-driven)
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

    const full = await Appointment.findOne({
      where: { id },
      include: APPOINTMENT_INCLUDES,
    });

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "activate",
      entityId: id,
      entity: full,
      details: { from: oldStatus, to: APPOINTMENT_STATUS.IN_PROGRESS },
    });

    return success(res, "Appointment activated", full);
  } catch (err) {
    await t.rollback();
    debug.error("activate → FAILED", err);
    return error(res, "Failed to activate appointment", err);
  }
};

/* ============================================================
   📌 COMPLETE APPOINTMENT (in_progress → completed)
============================================================ */
export const completeAppointment = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { id } = req.params;

    debug.log("complete → request", { id });

    const record = await Appointment.findByPk(id, { transaction: t });
    if (!record) {
      await t.rollback();
      return error(res, "Appointment not found", null, 404);
    }

    if (record.status !== APPOINTMENT_STATUS.IN_PROGRESS) {
      await t.rollback();
      return error(
        res,
        "Only in-progress appointments can be completed",
        null,
        400
      );
    }

    // 🔎 Require completed consultation
    const cons = await Consultation.findOne({
      where: { appointment_id: record.id },
      transaction: t,
    });

    if (!cons || cons.status !== "completed") {
      await t.rollback();
      return error(
        res,
        "Consultation must be completed before closing appointment",
        null,
        400
      );
    }

    const oldStatus = record.status;

    await record.update(
      {
        status: APPOINTMENT_STATUS.COMPLETED,
        updated_by_id: req.user?.id || null,
      },
      { transaction: t }
    );

    // 💰 Billing (DB-driven)
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
      details: { from: oldStatus, to: APPOINTMENT_STATUS.COMPLETED },
    });

    return success(res, "Appointment marked as completed", record);
  } catch (err) {
    await t.rollback();
    debug.error("complete → FAILED", err);
    return error(res, "Failed to complete appointment", err);
  }
};

/* ============================================================
   📌 CANCEL APPOINTMENT (scheduled/in_progress → cancelled)
============================================================ */
export const cancelAppointment = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { id } = req.params;

    debug.log("cancel → request", { id });

    const record = await Appointment.findByPk(id, { transaction: t });
    if (!record) {
      await t.rollback();
      return error(res, "Appointment not found", null, 404);
    }

    if (
      ![
        APPOINTMENT_STATUS.SCHEDULED,
        APPOINTMENT_STATUS.IN_PROGRESS,
      ].includes(record.status)
    ) {
      await t.rollback();
      return error(
        res,
        "Only scheduled or in-progress appointments can be cancelled",
        null,
        400
      );
    }

    // 🔎 Block cancellation if consultation active/completed
    const cons = await Consultation.findOne({
      where: { appointment_id: record.id },
      transaction: t,
    });
    if (cons && ["in_progress", "completed", "verified"].includes(cons.status)) {
      await t.rollback();
      return error(
        res,
        "Cannot cancel appointment with active or completed consultation",
        null,
        400
      );
    }

    const oldStatus = record.status;

    await record.update(
      {
        status: APPOINTMENT_STATUS.CANCELLED,
        updated_by_id: req.user?.id || null,
      },
      { transaction: t }
    );

    // 💰 Void billing
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
      details: { from: oldStatus, to: APPOINTMENT_STATUS.CANCELLED },
    });

    return success(res, "Appointment cancelled and charges voided", record);
  } catch (err) {
    await t.rollback();
    debug.error("cancel → FAILED", err);
    return error(res, "Failed to cancel appointment", err);
  }
};

/* ============================================================
   📌 MARK NO-SHOW APPOINTMENT (scheduled → no_show)
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
    debug.log("mark_no_show → request", { id });

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

    if (record.status !== APPOINTMENT_STATUS.SCHEDULED) {
      await t.rollback();
      return error(
        res,
        "Only scheduled appointments can be marked as no-show",
        null,
        400
      );
    }

    // 🔎 Block if consultation exists
    const cons = await Consultation.findOne({
      where: { appointment_id: record.id },
      transaction: t,
    });
    if (cons && ["in_progress", "completed", "verified"].includes(cons.status)) {
      await t.rollback();
      return error(
        res,
        "Cannot mark no-show for appointment with active or completed consultation",
        null,
        400
      );
    }

    const oldStatus = record.status;

    await record.update(
      {
        status: APPOINTMENT_STATUS.NO_SHOW,
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
      details: { from: oldStatus, to: APPOINTMENT_STATUS.NO_SHOW },
    });

    return success(res, "Appointment marked as no-show", record);
  } catch (err) {
    await t.rollback();
    debug.error("mark_no_show → FAILED", err);
    return error(res, "Failed to mark appointment as no-show", err);
  }
};

/* ============================================================
   📌 VOID APPOINTMENT (scheduled/in_progress → voided)
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
    debug.log("void → request", { id });

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

    if (
      [APPOINTMENT_STATUS.VERIFIED, APPOINTMENT_STATUS.VOIDED].includes(
        record.status
      )
    ) {
      await t.rollback();
      return error(
        res,
        "Cannot void a verified or already voided appointment",
        null,
        400
      );
    }

    // 🔎 Block void if consultation active/completed
    const cons = await Consultation.findOne({
      where: { appointment_id: record.id },
      transaction: t,
    });
    if (cons && ["in_progress", "completed", "verified"].includes(cons.status)) {
      await t.rollback();
      return error(
        res,
        "Cannot void appointment with active or completed consultation",
        null,
        400
      );
    }

    const oldStatus = record.status;

    // 💰 Void all related billing
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
        status: APPOINTMENT_STATUS.VOIDED,
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
      details: { from: oldStatus, to: APPOINTMENT_STATUS.VOIDED },
    });

    return success(res, "Appointment voided successfully", record);
  } catch (err) {
    await t.rollback();
    debug.error("void → FAILED", err);
    return error(res, "Failed to void appointment", err);
  }
};

/* ============================================================
   📌 VERIFY APPOINTMENT (completed → verified)
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
    debug.log("verify → request", { id });

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

    if (record.status !== APPOINTMENT_STATUS.COMPLETED) {
      await t.rollback();
      return error(
        res,
        "Only completed appointments can be verified",
        null,
        400
      );
    }

    const oldStatus = record.status;

    await record.update(
      {
        status: APPOINTMENT_STATUS.VERIFIED,
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
      details: { from: oldStatus, to: APPOINTMENT_STATUS.VERIFIED },
    });

    return success(res, "Appointment verified successfully", record);
  } catch (err) {
    await t.rollback();
    debug.error("verify → FAILED", err);
    return error(res, "Failed to verify appointment", err);
  }
};

/* ============================================================
   📌 DELETE APPOINTMENT (Soft Delete + Billing Rollback)
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
    debug.log("delete → request", { id });

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

    // 🔒 Block delete if consultation exists
    const cons = await Consultation.findOne({
      where: { appointment_id: record.id },
      transaction: t,
    });
    if (cons) {
      await t.rollback();
      return error(
        res,
        "Cannot delete appointment — linked consultation exists",
        null,
        400
      );
    }

    // 💰 Roll back billing
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

    // 🗑️ Soft delete
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

    return success(res, "Appointment deleted (billing rolled back)", full);
  } catch (err) {
    await t.rollback();
    debug.error("delete → FAILED", err);
    return error(res, "Failed to delete appointment", err);
  }
};
/* ============================================================
   📌 RESTORE APPOINTMENT (cancelled/no_show/voided → scheduled)
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
    debug.log("restore → request", { id });

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

    if (
      ![
        APPOINTMENT_STATUS.CANCELLED,
        APPOINTMENT_STATUS.NO_SHOW,
        APPOINTMENT_STATUS.VOIDED,
      ].includes(record.status)
    ) {
      await t.rollback();
      return error(
        res,
        "Only cancelled, no-show, or voided appointments can be restored",
        null,
        400
      );
    }

    const oldStatus = record.status;

    await record.update(
      {
        status: APPOINTMENT_STATUS.SCHEDULED,
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
      details: { from: oldStatus, to: APPOINTMENT_STATUS.SCHEDULED },
    });

    return success(res, "Appointment restored to scheduled", record);
  } catch (err) {
    await t.rollback();
    debug.error("restore → FAILED", err);
    return error(res, "Failed to restore appointment", err);
  }
};

/* ============================================================
   📌 GET ALL APPOINTMENTS (Paginated + Summary)
   ✅ MASTER-ALIGNED (GLOBAL FILTERS + DATE RANGE)
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

    /* ========================================================
       👤 ROLE → FIELD VISIBILITY
    ======================================================== */
    const role = (req.user?.roleNames?.[0] || "staff").toLowerCase();
    const visibleFields =
      FIELD_VISIBILITY_APPOINTMENT[role] ||
      FIELD_VISIBILITY_APPOINTMENT.staff;

    /* ========================================================
       ⚙️ BASE QUERY OPTIONS (MASTER)
    ======================================================== */
    const options = buildQueryOptions(req, {
      defaultSort: ["date_time", "DESC"],
      fields: visibleFields,
    });

    options.where = options.where || {};

    /* ========================================================
       🧹 STRIP UI-ONLY FILTERS (CRITICAL – PREVENT DB ERRORS)
    ======================================================== */
    if (options.where.dateRange) {
      delete options.where.dateRange;
    }

    /* ========================================================
       📅 DATE RANGE FILTER (SINGLE SOURCE OF TRUTH)
    ======================================================== */
    if (req.query.dateRange) {
      const range = normalizeDateRangeLocal(req.query.dateRange);
      if (range) {
        options.where.date_time = {
          ...(options.where.date_time || {}),
          [Op.between]: [range.start, range.end],
        };
      }
    }

    /* ========================================================
       🏢 ORG / FACILITY SCOPING (SECURITY FIRST)
    ======================================================== */
    if (!isSuperAdmin(req.user)) {
      options.where.organization_id = req.user.organization_id;

      if (req.user.facility_id) {
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
       🔎 APPLY SAFE FILTERS (MASTER PARITY)
    ======================================================== */
    [
      "department_id",
      "patient_id",
      "doctor_id",
      "status",
    ].forEach((key) => {
      if (req.query[key]) {
        options.where[key] = req.query[key];
      }
    });

    /* ========================================================
       🔍 SEARCH (SAFE FIELDS ONLY)
    ======================================================== */
    if (options.search) {
      options.where[Op.or] = [
        { notes: { [Op.iLike]: `%${options.search}%` } },
        { appointment_code: { [Op.iLike]: `%${options.search}%` } },
      ];
    }

    /* ========================================================
       📦 QUERY (DISTINCT FOR JOINS)
    ======================================================== */
    const { count, rows } = await Appointment.findAndCountAll({
      where: options.where,
      include: APPOINTMENT_INCLUDES,
      order: options.order,
      offset: options.offset,
      limit: options.limit,
      distinct: true,
    });

    /* ========================================================
       📊 SUMMARY (FILTER-ALIGNED)
    ======================================================== */
    const summary = await buildDynamicSummary({
      model: Appointment,
      options,
      statusEnums: Object.values(APPOINTMENT_STATUS),
      includeGender: true,
      genderJoin: { model: Patient, as: "patient" },
    });

    /* ========================================================
       🧾 AUDIT
    ======================================================== */
    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "list",
      details: {
        query: req.query,
        returned: count,
      },
    });

    /* ========================================================
       ✅ RESPONSE
    ======================================================== */
    return success(res, "Appointments loaded", {
      records: rows,
      pagination: {
        total: count,
        page: options.pagination.page,
        pageCount: Math.ceil(count / options.pagination.limit),
      },
      summary,
    });
  } catch (err) {
    debug.error("list → FAILED", err);
    return error(res, "Failed to load appointments", err);
  }
};


/* ============================================================
   📌 GET APPOINTMENT BY ID
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
    if (!isSuperAdmin(req.user)) {
      where.organization_id = req.user.organization_id;
      if (req.user.facility_id) where.facility_id = req.user.facility_id;
    }

    const record = await Appointment.findOne({
      where,
      include: APPOINTMENT_INCLUDES,
    });
    if (!record) return error(res, "Appointment not found", null, 404);

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "view",
      entityId: id,
      entity: record,
    });

    return success(res, "Appointment loaded", record);
  } catch (err) {
    debug.error("getById → FAILED", err);
    return error(res, "Failed to load appointment", err);
  }
};

/* ============================================================
   📌 GET ALL APPOINTMENTS LITE (?q=)
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
      status: {
        [Op.in]: [
          APPOINTMENT_STATUS.SCHEDULED,
          APPOINTMENT_STATUS.IN_PROGRESS,
        ],
      },
    };

    if (!isSuperAdmin(req.user)) {
      where.organization_id = req.user.organization_id;
      if (req.user.facility_id) where.facility_id = req.user.facility_id;
    }

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

    const result = rows.map(r => ({
      id: r.id,
      code: r.appointment_code,
      patient: r.patient
        ? `${r.patient.pat_no} - ${r.patient.first_name} ${r.patient.last_name}`
        : "",
      date: r.date_time,
      status: r.status,
    }));

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "list_lite",
      details: { count: result.length, query: q || null },
    });

    return success(res, "Appointments loaded (lite)", { records: result });
  } catch (err) {
    debug.error("list_lite → FAILED", err);
    return error(res, "Failed to load appointments (lite)", err);
  }
};
