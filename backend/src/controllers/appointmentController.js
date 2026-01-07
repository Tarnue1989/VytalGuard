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
import { success, error } from "../utils/response.js";
import { buildQueryOptions } from "../utils/queryHelper.js";
import { APPOINTMENT_STATUS } from "../constants/enums.js";
import { authzService } from "../services/authzService.js";
import { auditService } from "../services/auditService.js";
import { FIELD_VISIBILITY_APPOINTMENT } from "../constants/fieldVisibility.js";
import { billingService } from "../services/billingService.js";
import { shouldTriggerBilling, AUTO_BILLABLE_MODULES } from "../constants/billing.js";
import { isSuperAdmin, hasRole, getUserRoles } from "../utils/role-utils.js";
import { buildDynamicSummary } from "../utils/summaryHelper.js";

const MODULE_KEY = "appointments";

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
   📋 ROLE-BASED JOI SCHEMA (simplified — backend injects org/fac)
   ============================================================ */
function buildAppointmentSchema(userRole, mode = "create") {
  const base = {
    appointment_code: Joi.string().max(50).optional(),
    patient_id: Joi.string().uuid().required(),
    doctor_id: Joi.string().uuid().required(),
    department_id: Joi.string().uuid().allow(null, ""),
    invoice_id: Joi.string().uuid().allow(null, ""),
    date_time: Joi.date().required(),
    notes: Joi.string().allow("", null),
  };

  // ✅ Only allow `status` field in update mode
  if (mode === "update") {
    base.status = Joi.string().valid(...APPOINTMENT_STATUS).optional();
    Object.keys(base).forEach(k => {
      base[k] = base[k].optional();
    });
  }

  // 🔑 Superadmins can submit org/fac explicitly
  if (userRole === "superadmin") {
    base.organization_id = Joi.string().uuid().optional();
    base.facility_id = Joi.string().uuid().optional();
  }

  // All other roles → org/fac injected in controller, never from body
  return Joi.object(base);
}


/* ============================================================
   📌 CREATE APPOINTMENT (always scheduled)
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

    const role = (req.user?.roleNames?.[0] || "").toLowerCase();
    const schema = buildAppointmentSchema(role, "create");
    const { error: validationError, value } = schema.validate(req.body, { stripUnknown: true });

    if (validationError) {
      await t.rollback();
      return error(res, "Validation failed", validationError, 400);
    }

    // Scope
    let orgId = req.user.organization_id || null;
    let facilityId = null;
    if (role === "superadmin") {
      orgId = value.organization_id || req.body.organization_id;
      facilityId = value.facility_id || req.body.facility_id || null;
    } else if (role === "org_owner") {
      orgId = req.user.organization_id;
      facilityId = value.facility_id || null;
    } else if (role === "admin") {
      orgId = req.user.organization_id;
      facilityId = value.facility_id;
    } else if (role === "facility_head") {
      orgId = req.user.organization_id;
      facilityId = req.user.facility_id;
    } else {
      orgId = req.user.organization_id;
      facilityId = req.user.facility_id || null;
    }

    if (!orgId) {
      await t.rollback();
      return error(res, "Missing organization assignment", null, 400);
    }

    // Auto-code
    if (!value.appointment_code) {
      value.appointment_code = generateAppointmentCode();
    }

    const created = await Appointment.create(
      {
        ...value,
        status: "scheduled", // ✅ force default status
        organization_id: orgId,
        facility_id: facilityId,
        created_by_id: req.user?.id || null,
      },
      { transaction: t }
    );

    await t.commit();

    const full = await Appointment.findOne({ where: { id: created.id }, include: APPOINTMENT_INCLUDES });

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "create",
      entityId: created.id,
      entity: full,
      details: value,
    });

    return success(res, "✅ Appointment created", full);
  } catch (err) {
    await t.rollback();
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
    const role = (req.user?.roleNames?.[0] || "").toLowerCase();
    const schema = buildAppointmentSchema(role, "update");
    const { error: validationError, value } = schema.validate(req.body, { stripUnknown: true });
    if (validationError) {
      await t.rollback();
      return error(res, "Validation failed", validationError, 400);
    }

    let orgId = req.user.organization_id || null;
    let facilityId = null;
    if (isSuperAdmin(req.user)) {
      orgId = value.organization_id || req.query.organization_id || null;
      facilityId = value.facility_id || req.query.facility_id || null;
    } else if (role === "org_owner") {
      orgId = req.user.organization_id;
      facilityId = value.facility_id || null;
    } else if (role === "admin") {
      orgId = req.user.organization_id;
      facilityId = value.facility_id;
    } else if (role === "facility_head") {
      orgId = req.user.organization_id;
      facilityId = req.user.facility_id;
    } else {
      orgId = req.user.organization_id;
      facilityId = req.user.facility_id || null;
    }

    if (!orgId) {
      await t.rollback();
      return error(res, "Missing organization assignment", null, 400);
    }

    const record = await Appointment.findOne({ where: { id, organization_id: orgId }, transaction: t });
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

    // ✅ Only bill if status changes to billable
    if (oldStatus !== record.status && shouldTriggerBilling(MODULE_KEY, record.status)) {
      await billingService.triggerAutoBilling({
        module: MODULE_KEY,
        entity: record,
        user: { ...req.user, organization_id: orgId, facility_id: facilityId },
        transaction: t,
      });
    }

    await t.commit();

    const full = await Appointment.findOne({ where: { id }, include: APPOINTMENT_INCLUDES });

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "update",
      entityId: id,
      entity: full,
      details: value,
    });

    return success(res, "✅ Appointment updated", full);
  } catch (err) {
    await t.rollback();
    return error(res, "❌ Failed to update appointment", err);
  }
};

/* ============================================================
   📌 TOGGLE APPOINTMENT STATUS (with Consultation Check)
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
    const role = (req.user?.roleNames?.[0] || "").toLowerCase();

    const where = { id };
    if (!isSuperAdmin(req.user)) {
      where.organization_id = req.user.organization_id;
      if (role === "facility_head") where.facility_id = req.user.facility_id;
    }

    const record = await Appointment.findOne({ where, transaction: t });
    if (!record) {
      await t.rollback();
      return error(res, "❌ Appointment not found", null, 404);
    }

    // 🔎 Block if linked consultation is in-progress
    const cons = await Consultation.findOne({
      where: { appointment_id: record.id },
      transaction: t,
    });
    if (cons && [ "in_progress", "completed" ].includes(cons.status)) {
      await t.rollback();
      return error(res, "❌ Cannot toggle appointment with an active/finished consultation", null, 400);
    }

    const [SCHEDULED, IN_PROGRESS, COMPLETED, CANCELLED, NO_SHOW] = APPOINTMENT_STATUS;
    const oldStatus = record.status;
    let newStatus;

    if (record.status === SCHEDULED) newStatus = CANCELLED;
    else if (record.status === CANCELLED) newStatus = SCHEDULED;
    else newStatus = record.status;

    await record.update({ status: newStatus, updated_by_id: req.user?.id || null }, { transaction: t });

    if (oldStatus !== newStatus && shouldTriggerBilling(MODULE_KEY, newStatus)) {
      await billingService.triggerAutoBilling({
        module: MODULE_KEY,
        entity: record,
        user: { ...req.user, organization_id: record.organization_id, facility_id: record.facility_id },
        transaction: t,
      });
    }

    if (newStatus === CANCELLED) {
      await billingService.voidCharges({
        module: MODULE_KEY,
        entityId: record.id,
        user: { ...req.user, organization_id: record.organization_id, facility_id: record.facility_id },
        transaction: t,
      });
    }

    await t.commit();

    const full = await Appointment.findOne({ where: { id }, include: APPOINTMENT_INCLUDES });

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "toggle_status",
      entityId: id,
      entity: full,
      details: { from: oldStatus, to: newStatus },
    });

    return success(res, `✅ Appointment status set to ${newStatus}`, full);
  } catch (err) {
    await t.rollback();
    return error(res, "❌ Failed to toggle appointment status", err);
  }
};

/* ============================================================
   📌 ACTIVATE APPOINTMENT (scheduled → in_progress)
   ============================================================ */
export const activateAppointment = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { id } = req.params;
    const record = await Appointment.findByPk(id, { transaction: t });
    if (!record) return error(res, "❌ Appointment not found", null, 404);

    if (record.status !== "scheduled") {
      await t.rollback();
      return error(res, "❌ Only scheduled appointments can be activated", null, 400);
    }

    // 🔎 Prevent conflict if consultation already exists
    const cons = await Consultation.findOne({ where: { appointment_id: record.id }, transaction: t });
    if (cons && cons.status !== "open") {
      await t.rollback();
      return error(res, "❌ Consultation already in progress or closed", null, 400);
    }

    const oldStatus = record.status;
    await record.update(
      { status: "in_progress", updated_by_id: req.user?.id || null },
      { transaction: t }
    );

    if (oldStatus !== "in_progress" && shouldTriggerBilling(MODULE_KEY, "in_progress")) {
      await billingService.triggerAutoBilling({
        module: MODULE_KEY,
        entity: record,
        user: { ...req.user, organization_id: record.organization_id, facility_id: record.facility_id },
        transaction: t,
      });
    }

    await t.commit();
    const full = await Appointment.findOne({ where: { id }, include: APPOINTMENT_INCLUDES });

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "activate",
      entityId: id,
      entity: full,
      details: { from: oldStatus, to: "in_progress" },
    });

    return success(res, "✅ Appointment activated", full);
  } catch (err) {
    await t.rollback();
    return error(res, "❌ Failed to activate appointment", err);
  }
};

/* ============================================================
   📌 COMPLETE APPOINTMENT (in_progress → completed)
   ============================================================ */
export const completeAppointment = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { id } = req.params;
    const record = await Appointment.findByPk(id, { transaction: t });
    if (!record) return error(res, "❌ Appointment not found", null, 404);

    if (record.status !== "in_progress") {
      await t.rollback();
      return error(res, "❌ Only in-progress appointments can be completed", null, 400);
    }

    // 🔎 Block if consultation not yet completed
    const cons = await Consultation.findOne({ where: { appointment_id: record.id }, transaction: t });
    if (cons && cons.status !== "completed") {
      await t.rollback();
      return error(res, "❌ Consultation must be completed before closing appointment", null, 400);
    }

    const oldStatus = record.status;
    await record.update(
      { status: "completed", updated_by_id: req.user?.id || null },
      { transaction: t }
    );

    if (oldStatus !== "completed" && shouldTriggerBilling(MODULE_KEY, "completed")) {
      await billingService.triggerAutoBilling({
        module: MODULE_KEY,
        entity: record,
        user: { ...req.user, organization_id: record.organization_id, facility_id: record.facility_id },
        transaction: t,
      });
    }

    await t.commit();
    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "complete",
      entityId: id,
      entity: record,
      details: { from: oldStatus, to: "completed" },
    });

    return success(res, "✅ Appointment marked as completed", record);
  } catch (err) {
    await t.rollback();
    return error(res, "❌ Failed to complete appointment", err);
  }
};

/* ============================================================
   📌 CANCEL APPOINTMENT (scheduled/in_progress → cancelled)
   ============================================================ */
export const cancelAppointment = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { id } = req.params;
    const record = await Appointment.findByPk(id, { transaction: t });
    if (!record) return error(res, "❌ Appointment not found", null, 404);

    // ✅ Only scheduled or in-progress appointments can be cancelled
    if (!["scheduled", "in_progress"].includes(record.status)) {
      await t.rollback();
      return error(
        res,
        "❌ Only scheduled or in-progress appointments can be cancelled",
        null,
        400
      );
    }

    // 🔎 Prevent cancellation if consultation is active/finished
    const cons = await Consultation.findOne({
      where: { appointment_id: record.id },
      transaction: t,
    });
    if (cons && ["in_progress", "completed", "verified"].includes(cons.status)) {
      await t.rollback();
      return error(
        res,
        "❌ Cannot cancel appointment with active/finished consultation",
        null,
        400
      );
    }

    // ✅ Mark appointment cancelled
    await record.update(
      { status: "cancelled", updated_by_id: req.user?.id || null },
      { transaction: t }
    );

    // 💰 Void related charges
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

    // 📝 Audit trail
    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "cancel",
      entityId: id,
      entity: record,
    });

    return success(res, "✅ Appointment cancelled and charges voided", record);
  } catch (err) {
    await t.rollback();
    return error(res, "❌ Failed to cancel appointment", err);
  }
};

/* ============================================================
   📌 MARK NO-SHOW APPOINTMENT (scheduled → no_show)
   ============================================================ */
export const markNoShowAppointment = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { id } = req.params;
    const record = await Appointment.findByPk(id, { transaction: t });
    if (!record) return error(res, "❌ Appointment not found", null, 404);

    if (record.status !== "scheduled") {
      await t.rollback();
      return error(res, "❌ Only scheduled appointments can be marked as no-show", null, 400);
    }

    // 🔎 Block no-show if consultation already exists
    const cons = await Consultation.findOne({ where: { appointment_id: record.id }, transaction: t });
    if (cons && ["in_progress", "completed"].includes(cons.status)) {
      await t.rollback();
      return error(res, "❌ Cannot mark no-show for appointment with active/finished consultation", null, 400);
    }

    const oldStatus = record.status;
    await record.update(
      { status: "no_show", updated_by_id: req.user?.id || null },
      { transaction: t }
    );

    await t.commit();
    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "mark_no_show",
      entityId: id,
      entity: record,
      details: { from: oldStatus, to: "no_show" },
    });

    return success(res, "✅ Appointment marked as no-show", record);
  } catch (err) {
    await t.rollback();
    return error(res, "❌ Failed to mark appointment as no-show", err);
  }
};

/* ============================================================
   📌 VOID APPOINTMENT (scheduled/in_progress → voided)
   ============================================================ */
export const voidAppointment = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    // 🔐 Permission check
    const allowed = await authzService.checkPermission({
      user: req.user,
      module: MODULE_KEY,
      action: "void",
      res,
    });
    if (!allowed) return;

    const { id } = req.params;
    const role = (req.user?.roleNames?.[0] || "").toLowerCase();

    // 🧭 Scope restrictions
    const where = { id };
    if (!isSuperAdmin(req.user)) {
      where.organization_id = req.user.organization_id;
      if (role === "facility_head") where.facility_id = req.user.facility_id;
    }

    const record = await Appointment.findOne({ where, transaction: t });
    if (!record) {
      await t.rollback();
      return error(res, "❌ Appointment not found", null, 404);
    }

    // 🧱 RBAC – Only high-level roles can void
    if (!["superadmin", "admin", "org_owner", "facility_head"].includes(role)) {
      await t.rollback();
      return error(res, "⛔ Only privileged users can void appointments", null, 403);
    }

    // 🚫 Prevent voiding verified / already voided
    if (["verified", "voided"].includes(record.status)) {
      await t.rollback();
      return error(res, "❌ Cannot void a verified or already voided appointment", null, 400);
    }

    // 🚫 Optional: block void if linked consultation is active or done
    const cons = await Consultation.findOne({
      where: { appointment_id: record.id },
      transaction: t,
    });
    if (cons && ["in_progress", "completed", "verified"].includes(cons.status)) {
      await t.rollback();
      return error(
        res,
        "❌ Cannot void appointment with active or completed consultation",
        null,
        400
      );
    }

    // 💰 Reverse all related billing
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

    // 🩺 Update → voided
    const oldStatus = record.status;
    await record.update(
      { status: "voided", updated_by_id: req.user?.id || null },
      { transaction: t }
    );

    await t.commit();

    // 🧾 Full audit log
    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "void",
      entityId: id,
      entity: record,
      details: { from: oldStatus, to: "voided" },
    });

    return success(res, "✅ Appointment voided successfully", record);
  } catch (err) {
    await t.rollback();
    console.error("❌ voidAppointment failed:", err);
    return error(res, "❌ Failed to void appointment", err);
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
    const record = await Appointment.findByPk(id, { transaction: t });
    if (!record) return error(res, "❌ Appointment not found", null, 404);

    if (record.status !== "completed") {
      await t.rollback();
      return error(res, "❌ Only completed appointments can be verified", null, 400);
    }

    const oldStatus = record.status;
    await record.update(
      { status: "verified", updated_by_id: req.user?.id || null },
      { transaction: t }
    );

    await t.commit();

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "verify",
      entityId: id,
      entity: record,
      details: { from: oldStatus, to: "verified" },
    });

    return success(res, "✅ Appointment verified successfully", record);
  } catch (err) {
    await t.rollback();
    console.error("❌ verifyAppointment failed:", err);
    return error(res, "❌ Failed to verify appointment", err);
  }
};

/* ============================================================
   📌 DELETE APPOINTMENT (Soft Delete with Audit + Billing Rollback)
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
    const role = (req.user?.roleNames?.[0] || "").toLowerCase();

    const where = { id };
    if (!isSuperAdmin(req.user)) {
      where.organization_id = req.user.organization_id;
      if (role === "facility_head") where.facility_id = req.user.facility_id;
    }

    const record = await Appointment.findOne({ where, transaction: t });
    if (!record) {
      await t.rollback();
      return error(res, "❌ Appointment not found", null, 404);
    }

    // 🔒 Block delete if consultations exist for this appointment
    const cons = await Consultation.findOne({
      where: { appointment_id: record.id },
      transaction: t,
    });
    if (cons) {
      // If consultation is active/finished, block hard
      if (["in_progress", "completed", "verified"].includes(cons.status)) {
        await t.rollback();
        return error(
          res,
          "❌ Cannot delete appointment — linked consultation is active/finished",
          null,
          400
        );
      }
      // Even if consultation is cancelled/voided, block to preserve history
      await t.rollback();
      return error(
        res,
        "❌ Cannot delete appointment — linked consultations exist",
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

    // 📝 Audit log
    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "delete",
      entityId: id,
      entity: full,
    });

    return success(res, "✅ Appointment deleted (with billing rollback)", full);
  } catch (err) {
    await t.rollback();
    return error(res, "❌ Failed to delete appointment", err);
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
    const role = (req.user?.roleNames?.[0] || "").toLowerCase();

    const where = { id };
    if (!isSuperAdmin(req.user)) {
      where.organization_id = req.user.organization_id;
      if (role === "facility_head") where.facility_id = req.user.facility_id;
    }

    const record = await Appointment.findOne({ where, transaction: t });
    if (!record) {
      await t.rollback();
      return error(res, "❌ Appointment not found", null, 404);
    }

    if (!["cancelled", "no_show", "voided", "deleted"].includes(record.status)) {
      await t.rollback();
      return error(res, "⚠️ Only cancelled, no-show, voided, or deleted appointments can be restored", null, 400);
    }

    const oldStatus = record.status;
    await record.update(
      { status: "scheduled", updated_by_id: req.user.id },
      { transaction: t }
    );

    await t.commit();
    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "restore",
      entityId: id,
      entity: record,
      details: { from: oldStatus, to: "scheduled" },
    });

    return success(res, "✅ Appointment restored to scheduled", record);
  } catch (err) {
    await t.rollback();
    return error(res, "❌ Failed to restore appointment", err);
  }
};

/* ============================================================
   📌 GET ALL APPOINTMENTS (with Dynamic Summary)
   ============================================================ */
export const getAllAppointments = async (req, res) => {
  try {
    // 🔐 Permission
    const allowed = await authzService.checkPermission({
      user: req.user,
      module: MODULE_KEY,
      action: "read",
      res,
    });
    if (!allowed) return;

    // 🧭 Role normalization
    const role = (req.user?.roleNames?.[0] || "staff").toLowerCase();
    const visibleFields =
      FIELD_VISIBILITY_APPOINTMENT[role] || FIELD_VISIBILITY_APPOINTMENT.staff;

    // 🧱 Build filter options (date range, search, pagination)
    const options = buildQueryOptions(req, "date_time", "DESC", visibleFields);
    options.where = options.where || {};

    // 🏢 Scope enforcement
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

    // 🔍 Search logic
    if (options.search) {
      options.where[Op.or] = [
        { notes: { [Op.iLike]: `%${options.search}%` } },
        { appointment_code: { [Op.iLike]: `%${options.search}%` } },
      ];
    }

    // 📦 Fetch paginated results
    const { count, rows } = await Appointment.findAndCountAll({
      where: options.where,
      include: [...APPOINTMENT_INCLUDES, ...(options.include || [])],
      order: options.order,
      offset: options.offset,
      limit: options.limit,
    });

    // 🧠 Build lifecycle + gender summary (filtered + enum-driven)
    const summary = await buildDynamicSummary({
      model: Appointment,
      options,
      statusEnums: Object.values(APPOINTMENT_STATUS), // lifecycle from enums
      includeGender: true,
      genderJoin: { model: Patient, as: "patient" },
    });

    // 🧾 Audit Trail
    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "list",
      details: { query: req.query, returned: count },
    });

    // ✅ Unified enterprise response
    return success(res, "✅ Appointments loaded", {
      records: rows,
      pagination: {
        total: count,
        page: options.pagination.page,
        pageCount: Math.ceil(count / options.pagination.limit),
      },
      summary, // ⬅️ Lifecycle + Gender breakdown
    });
  } catch (err) {
    return error(res, "❌ Failed to load appointments", err);
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
    const role = (req.user?.roleNames?.[0] || "staff").toLowerCase();

    const where = { id };
    if (!isSuperAdmin(req.user)) {
      where.organization_id = req.user.organization_id;
      if (role === "facility_head") where.facility_id = req.user.facility_id;
    }

    const record = await Appointment.findOne({ where, include: APPOINTMENT_INCLUDES });
    if (!record) return error(res, "❌ Appointment not found", null, 404);

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "view",
      entityId: id,
      entity: record,
    });

    return success(res, "✅ Appointment loaded", record);
  } catch (err) {
    return error(res, "❌ Failed to load appointment", err);
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
    const role = (req.user?.roleNames?.[0] || "").toLowerCase();

    const where = { status: { [Op.in]: ["scheduled", "in_progress"] } };

    if (!isSuperAdmin(req.user)) {
      where.organization_id = req.user.organization_id;
      if (role === "facility_head") where.facility_id = req.user.facility_id;
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
        { model: Patient, as: "patient", attributes: ["id", "pat_no", "first_name", "last_name"] },
      ],
      order: [["date_time", "DESC"]],
      limit: 20,
    });

    const result = rows.map(r => ({
      id: r.id,
      code: r.appointment_code,
      patient: r.patient ? `${r.patient.pat_no} - ${r.patient.first_name} ${r.patient.last_name}` : "",
      date: r.date_time,
      status: r.status,
    }));

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "list_lite",
      details: { count: result.length, query: q || null },
    });

    return success(res, "✅ Appointments loaded (lite)", { records: result });
  } catch (err) {
    return error(res, "❌ Failed to load appointments (lite)", err);
  }
};
