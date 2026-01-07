// 📁 controllers/maternityVisitController.js
import Joi from "joi";
import { Op } from "sequelize";
import {
  sequelize,
  MaternityVisit,
  Patient,
  Employee,
  Consultation,
  RegistrationLog,
  Invoice,
  BillableItem,
  User,
  Organization,
  Facility,
} from "../models/index.js";
import { success, error } from "../utils/response.js";
import { buildQueryOptions } from "../utils/queryHelper.js";
import { MATERNITY_VISIT_STATUS, REGISTRATION_LOG_STATUS } from "../constants/enums.js";
import { authzService } from "../services/authzService.js";
import { auditService } from "../services/auditService.js";
import { FIELD_VISIBILITY_MATERNITY_VISIT } from "../constants/fieldVisibility.js";
import { billingService } from "../services/billingService.js";
import { shouldTriggerBilling } from "../constants/billing.js";
import { resolveClinicalLinks } from "../utils/autoLinkHelpers.js";

// 🔖 Local enum map for readability
const MVS = {
  SCHEDULED: MATERNITY_VISIT_STATUS[0],
  IN_PROGRESS: MATERNITY_VISIT_STATUS[1],
  COMPLETED: MATERNITY_VISIT_STATUS[2],
  VERIFIED: MATERNITY_VISIT_STATUS[3],
  CANCELLED: MATERNITY_VISIT_STATUS[4],
  VOIDED: MATERNITY_VISIT_STATUS[5],
};

const MODULE_KEY = "maternity-visit";

/* ============================================================
   🔧 HELPERS
   ============================================================ */
function isSuperAdmin(user) {
  if (!user) return false;
  const roles = Array.isArray(user.roleNames) ? user.roleNames : [user.role || ""];
  return roles.map(r => r.toLowerCase()).includes("superadmin");
}
/* ============================================================
   🔗 SHARED INCLUDES (ULTRASOUND-PARITY)
   ============================================================ */
const MATERNITY_VISIT_INCLUDES = [
  { model: Patient, as: "patient", attributes: ["id", "pat_no", "first_name", "last_name"] },

  { model: Employee.unscoped(), as: "doctor", attributes: ["id", "first_name", "last_name"] },
  { model: Employee.unscoped(), as: "midwife", attributes: ["id", "first_name", "last_name"] },

  { model: Consultation, as: "consultation", attributes: ["id", "consultation_date", "status"] },
  { model: RegistrationLog, as: "registrationLog", attributes: ["id", "registration_time", "log_status"] },

  { model: Invoice, as: "invoice", attributes: ["id", "invoice_number", "status", "total"] },
  { model: BillableItem, as: "billableItem", attributes: ["id", "name", "price"] },

  { model: Organization, as: "organization", attributes: ["id", "name", "code"] },
  { model: Facility, as: "facility", attributes: ["id", "name", "code", "organization_id"] },

  // 🔍 Audit / lifecycle users (MATCHES ULTRASOUND)
  { model: User, as: "verifiedBy", attributes: ["id", "first_name", "last_name"] },
  { model: User, as: "cancelledBy", attributes: ["id", "first_name", "last_name"] },
  { model: User, as: "voidedBy", attributes: ["id", "first_name", "last_name"] },

  // 🧾 Standard audit
  { model: User, as: "createdBy", attributes: ["id", "first_name", "last_name"] },
  { model: User, as: "updatedBy", attributes: ["id", "first_name", "last_name"] },
  { model: User, as: "deletedBy", attributes: ["id", "first_name", "last_name"] },
];

/* ============================================================
   📋 JOI SCHEMA
   ============================================================ */
function buildMaternityVisitSchema(mode = "create") {
  const base = {
    patient_id: Joi.string().uuid().required(),
    doctor_id: Joi.string().uuid().allow(null, ""),
    midwife_id: Joi.string().uuid().allow(null, ""),
    consultation_id: Joi.string().uuid().allow(null, ""),
    registration_log_id: Joi.string().uuid().allow(null, ""),
    invoice_id: Joi.string().uuid().allow(null, ""),
    billable_item_id: Joi.string().uuid().allow(null, ""),
    visit_date: Joi.date().required(),
    visit_type: Joi.string().allow("", null),

    lnmp: Joi.date().allow(null),
    expected_due_date: Joi.date().allow(null),
    estimated_gestational_age: Joi.string().allow("", null),
    fundus_height: Joi.string().allow("", null),
    fetal_heart_rate: Joi.string().allow("", null),
    presentation: Joi.string().allow("", null),
    position: Joi.string().allow("", null),
    complaint: Joi.string().allow("", null),
    gravida: Joi.number().allow(null),
    para: Joi.number().allow(null),
    abortion: Joi.number().allow(null),
    living: Joi.number().allow(null),
    visit_notes: Joi.string().allow("", null),

    blood_pressure: Joi.string().allow("", null),
    weight: Joi.number().min(1).max(500).allow(null),
    height: Joi.number().min(30).max(250).allow(null),
    temperature: Joi.number().min(30).max(45).allow(null),
    pulse_rate: Joi.number().min(20).max(250).allow(null),

    is_emergency: Joi.boolean().default(false),

    // ⚠️ allowed but enforced by controller
    organization_id: Joi.string().uuid().allow(null),
    facility_id: Joi.string().uuid().allow(null),
  };

  if (mode === "update") {
    Object.keys(base).forEach(k => (base[k] = base[k].optional()));
  }

  return Joi.object(base);
}

/* ============================================================
   📌 CREATE MATERNITY VISIT (ULTRASOUND-PARITY)
   ============================================================ */
export const createMaternityVisit = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module: MODULE_KEY,
      action: "create",
      res,
    });
    if (!allowed) return;

    const { error: validationError, value } =
      buildMaternityVisitSchema("create").validate(req.body, { stripUnknown: true });

    if (validationError) {
      await t.rollback();
      return error(res, "Validation failed", validationError, 400);
    }

    // 👩🏽‍⚕️ Doctor / Midwife fallback
    if (!isSuperAdmin(req.user)) {
      if (!value.doctor_id && !value.midwife_id) {
        value.doctor_id = req.user.employee_id;
      }
    } else if (!value.doctor_id && !value.midwife_id) {
      await t.rollback();
      return error(res, "Doctor or Midwife is required for superadmin", null, 400);
    }

    // 🏢 STRICT tenant enforcement (MATCHES ULTRASOUND)
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
      value.organization_id = orgId;   // 🔒 FORCE
      value.facility_id = facilityId;  // 🔒 FORCE
    }

    value._currentUser = req.user;
    await resolveClinicalLinks(value, orgId, facilityId, t);

    const created = await MaternityVisit.create(
      {
        ...value,
        status: MVS.SCHEDULED,
        organization_id: orgId,
        facility_id: facilityId,
        created_by_id: req.user?.id || null,
      },
      { transaction: t }
    );

    await t.commit();

    const full = await MaternityVisit.findOne({
      where: { id: created.id },
      include: MATERNITY_VISIT_INCLUDES,
    });

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "create",
      entityId: created.id,
      entity: created,
    });

    return success(res, "✅ Maternity visit created", full);
  } catch (err) {
    await t.rollback();
    return error(res, "❌ Failed to create maternity visit", err);
  }
};

/* ============================================================
   📌 UPDATE MATERNITY VISIT (ULTRASOUND-PARITY)
   ============================================================ */
export const updateMaternityVisit = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module: MODULE_KEY,
      action: "update",
      res,
    });
    if (!allowed) return;

    const { error: validationError, value } =
      buildMaternityVisitSchema("update").validate(req.body, { stripUnknown: true });

    if (validationError) {
      await t.rollback();
      return error(res, "Validation failed", validationError, 400);
    }

    const record = await MaternityVisit.findOne({ where: { id: req.params.id }, transaction: t });
    if (!record) {
      await t.rollback();
      return error(res, "Maternity visit not found", null, 404);
    }

    // 🔒 BLOCK cross-facility update (MATCHES ULTRASOUND)
    if (
      !isSuperAdmin(req.user) &&
      (
        record.organization_id !== req.user.organization_id ||
        record.facility_id !== req.user.facility_id
      )
    ) {
      await t.rollback();
      return error(res, "Unauthorized: cross-facility update blocked", null, 403);
    }

    // 👩🏽‍⚕️ Doctor / Midwife fallback
    if (!isSuperAdmin(req.user)) {
      if (!value.doctor_id && !value.midwife_id) {
        value.doctor_id = req.user.employee_id;
      }
    } else {
      if (!value.doctor_id) value.doctor_id = record.doctor_id;
      if (!value.midwife_id) value.midwife_id = record.midwife_id;
    }

    // 🏢 STRICT tenant enforcement
    let orgId, facilityId;
    if (isSuperAdmin(req.user)) {
      orgId = value.organization_id || record.organization_id;
      facilityId = value.facility_id || record.facility_id;
    } else {
      orgId = req.user.organization_id;
      facilityId = req.user.facility_id;
      value.organization_id = orgId;   // 🔒 FORCE
      value.facility_id = facilityId;  // 🔒 FORCE
    }

    value._currentUser = req.user;
    await resolveClinicalLinks(value, orgId, facilityId, t);

    await record.update(
      { ...value, updated_by_id: req.user?.id || null },
      { transaction: t }
    );

    await t.commit();

    const full = await MaternityVisit.findOne({
      where: { id: record.id },
      include: MATERNITY_VISIT_INCLUDES,
    });

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "update",
      entityId: record.id,
      entity: full,
    });

    return success(res, "✅ Maternity visit updated", full);
  } catch (err) {
    await t.rollback();
    return error(res, "❌ Failed to update maternity visit", err);
  }
};

/* ============================================================
   📌 START MATERNITY VISIT (scheduled → in_progress)
   ============================================================ */
export const startMaternityVisit = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { id } = req.params;

    const where = { id };
    const role = (req.user?.roleNames?.[0] || "staff").toLowerCase();
    if (!isSuperAdmin(req.user)) {
      where.organization_id = req.user.organization_id;
      if (role === "facility_head") where.facility_id = req.user.facility_id;
    }

    const rec = await MaternityVisit.findOne({ where, transaction: t });
    if (!rec) return error(res, "❌ Maternity visit not found", null, 404);

    if (rec.status !== MVS.SCHEDULED) {
      await t.rollback();
      return error(res, "❌ Only scheduled visits can be started", null, 400);
    }

    const oldStatus = rec.status;

    await rec.update(
      { status: MVS.IN_PROGRESS, updated_by_id: req.user?.id || null },
      { transaction: t }
    );

    await t.commit();

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "start",
      entityId: id,
      entity: rec,
      details: { from: oldStatus, to: MVS.IN_PROGRESS },
    });

    return success(res, "✅ Maternity visit started (in-progress)", rec);
  } catch (err) {
    await t.rollback();
    return error(res, "❌ Failed to start maternity visit", err);
  }
};

/* ============================================================
   📌 COMPLETE MATERNITY VISIT (in_progress → completed)
   ============================================================ */
export const completeMaternityVisit = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { id } = req.params;

    const where = { id };
    const role = (req.user?.roleNames?.[0] || "staff").toLowerCase();
    if (!isSuperAdmin(req.user)) {
      where.organization_id = req.user.organization_id;
      if (role === "facility_head") where.facility_id = req.user.facility_id;
    }

    const rec = await MaternityVisit.findOne({ where, transaction: t });
    if (!rec) return error(res, "❌ Maternity visit not found", null, 404);

    if (rec.status !== MVS.IN_PROGRESS) {
      await t.rollback();
      return error(res, "❌ Only in-progress visits can be completed", null, 400);
    }

    const oldStatus = rec.status;

    await rec.update(
      { status: MVS.COMPLETED, updated_by_id: req.user?.id || null },
      { transaction: t }
    );

    if (shouldTriggerBilling(MODULE_KEY, MVS.COMPLETED)) {
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
      details: { from: oldStatus, to: MVS.COMPLETED },
    });

    return success(res, "✅ Maternity visit marked as completed", rec);
  } catch (err) {
    await t.rollback();
    return error(res, "❌ Failed to complete maternity visit", err);
  }
};

/* ============================================================
   📌 CANCEL MATERNITY VISIT (scheduled/in_progress → cancelled)
   ============================================================ */
export const cancelMaternityVisit = async (req, res) => {
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

    const rec = await MaternityVisit.findOne({ where, transaction: t });
    if (!rec) return error(res, "❌ Maternity visit not found", null, 404);

    if (![MVS.SCHEDULED, MVS.IN_PROGRESS].includes(rec.status)) {
      await t.rollback();
      return error(res, "❌ Only scheduled or in-progress visits can be cancelled", null, 400);
    }

    const oldStatus = rec.status;

    await rec.update(
      {
        status: MVS.CANCELLED,
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
      details: { from: oldStatus, to: MVS.CANCELLED, reason: reason || null },
    });

    return success(res, "✅ Maternity visit cancelled & charges voided", rec);
  } catch (err) {
    await t.rollback();
    return error(res, "❌ Failed to cancel maternity visit", err);
  }
};

/* ============================================================
   📌 VOID MATERNITY VISIT (any → voided, admin/superadmin only)
   ============================================================ */
export const voidMaternityVisit = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const role = (req.user?.roleNames?.[0] || "").toLowerCase();
    if (!["admin", "superadmin"].includes(role)) {
      return error(res, "❌ Only admin/superadmin can void maternity visits", null, 403);
    }

    const { id } = req.params;
    const { reason } = req.body;

    const where = { id };
    if (!isSuperAdmin(req.user)) {
      where.organization_id = req.user.organization_id;
      if (role === "facility_head") where.facility_id = req.user.facility_id;
    }

    const rec = await MaternityVisit.findOne({ where, transaction: t });
    if (!rec) return error(res, "❌ Maternity visit not found", null, 404);

    const oldStatus = rec.status;

    await rec.update(
      {
        status: MVS.VOIDED,
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
      details: { from: oldStatus, to: MVS.VOIDED, reason: reason || null },
    });

    return success(res, "✅ Maternity visit voided & charges rolled back", rec);
  } catch (err) {
    await t.rollback();
    return error(res, "❌ Failed to void maternity visit", err);
  }
};

/* ============================================================
   📌 VERIFY MATERNITY VISIT (completed → verified)
   ============================================================ */
export const verifyMaternityVisit = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { id } = req.params;

    const where = { id };
    const role = (req.user?.roleNames?.[0] || "staff").toLowerCase();
    if (!isSuperAdmin(req.user)) {
      where.organization_id = req.user.organization_id;
      if (role === "facility_head") where.facility_id = req.user.facility_id;
    }

    const rec = await MaternityVisit.findOne({ where, transaction: t });
    if (!rec) return error(res, "❌ Maternity visit not found", null, 404);

    if (rec.status !== MVS.COMPLETED) {
      await t.rollback();
      return error(res, "❌ Only completed visits can be verified", null, 400);
    }

    const oldStatus = rec.status;

    await rec.update(
      { status: MVS.VERIFIED, verified_by_id: req.user?.id || null },
      { transaction: t }
    );

    if (shouldTriggerBilling(MODULE_KEY, MVS.VERIFIED)) {
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
      details: { from: oldStatus, to: MVS.VERIFIED },
    });

    return success(res, "✅ Maternity visit verified", rec);
  } catch (err) {
    await t.rollback();
    return error(res, "❌ Failed to verify maternity visit", err);
  }
};


/* ============================================================
   📌 DELETE MATERNITY VISIT (Soft Delete + Billing Rollback)
   ============================================================ */
export const deleteMaternityVisit = async (req, res) => {
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
      if (role === "facility_head") {
        where.facility_id = req.user.facility_id;
      }
    } else {
      if (req.query.organization_id) where.organization_id = req.query.organization_id;
      if (req.query.facility_id) where.facility_id = req.query.facility_id;
    }

    const rec = await MaternityVisit.findOne({ where, transaction: t });
    if (!rec) {
      await t.rollback();
      return error(res, "❌ Maternity visit not found", null, 404);
    }

    await billingService.voidCharges({
      module: MODULE_KEY,
      entityId: rec.id,
      user: { ...req.user, organization_id: rec.organization_id, facility_id: rec.facility_id },
      transaction: t,
    });

    await rec.update({ deleted_by_id: req.user?.id || null }, { transaction: t });
    await rec.destroy({ transaction: t });

    await t.commit();

    const full = await MaternityVisit.findOne({
      where: { id },
      include: MATERNITY_VISIT_INCLUDES,
      paranoid: false,
    });

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "delete",
      entityId: id,
      entity: full,
    });

    return success(res, "✅ Maternity visit deleted (with billing rollback)", full);
  } catch (err) {
    await t.rollback();
    return error(res, "❌ Failed to delete maternity visit", err);
  }
};

/* ============================================================
   📌 GET ALL MATERNITY VISITS LITE (with ?q= + ?status= support)
   ============================================================ */
export const getAllMaternityVisitsLite = async (req, res) => {
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module: MODULE_KEY,
      action: "read",
      res,
    });
    if (!allowed) return;

    const { q, status } = req.query;
    const role = (req.user?.roleNames?.[0] || "").toLowerCase();

    // Default filter: scheduled + in-progress
    let statusFilter = [MVS.SCHEDULED, MVS.IN_PROGRESS];
    if (status) {
      const statuses = Array.isArray(status) ? status : [status];
      statusFilter = statuses;
    }
    const where = { status: { [Op.in]: statusFilter } };

    if (!isSuperAdmin(req.user)) {
      where.organization_id = req.user.organization_id;
      if (role === "facility_head") {
        where.facility_id = req.user.facility_id;
      }
    } else {
      if (req.query.organization_id) where.organization_id = req.query.organization_id;
      if (req.query.facility_id) where.facility_id = req.query.facility_id;
    }

    if (q) {
      where[Op.or] = [
        { complaint: { [Op.iLike]: `%${q}%` } },
        { visit_notes: { [Op.iLike]: `%${q}%` } },
      ];
    }

    if (req.query.patient_id) where.patient_id = req.query.patient_id;
    if (req.query.doctor_id) where.doctor_id = req.query.doctor_id;
    if (req.query.midwife_id) where.midwife_id = req.query.midwife_id;
    if (req.query.consultation_id) where.consultation_id = req.query.consultation_id;

    const visits = await MaternityVisit.findAll({
      where,
      attributes: ["id", "visit_date", "visit_type", "complaint", "status"],
      include: [
        { model: Patient, as: "patient", attributes: ["id", "pat_no", "first_name", "last_name"] },
        { model: Employee.unscoped(), as: "doctor", attributes: ["id", "first_name", "last_name"] },
        { model: Employee.unscoped(), as: "midwife", attributes: ["id", "first_name", "last_name"] },
      ],
      order: [["visit_date", "DESC"]],
      limit: 20,
    });

    const result = visits.map(v => ({
      id: v.id,
      patient: v.patient ? `${v.patient.pat_no} - ${v.patient.first_name} ${v.patient.last_name}` : "",
      doctor: v.doctor ? `${v.doctor.first_name} ${v.doctor.last_name}` : "",
      midwife: v.midwife ? `${v.midwife.first_name} ${v.midwife.last_name}` : "",
      complaint: v.complaint || "",
      date: v.visit_date,
      status: v.status,
    }));

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "list_lite",
      details: { query: q || null, returned: result.length },
    });

    return success(res, "✅ Maternity visits loaded (lite)", { records: result });
  } catch (err) {
    return error(res, "❌ Failed to load maternity visits (lite)", err);
  }
};
/* ============================================================
   📌 GET ALL MATERNITY VISITS (with ?status= support)
   ============================================================ */
export const getAllMaternityVisits = async (req, res) => {
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
      FIELD_VISIBILITY_MATERNITY_VISIT[role] || FIELD_VISIBILITY_MATERNITY_VISIT.staff;

    const FRONTEND_ONLY_FIELDS = ["actions"];
    const safeFields = visibleFields.filter(f => !FRONTEND_ONLY_FIELDS.includes(f));

    const options = buildQueryOptions(req, "visit_date", "DESC", safeFields);
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
        { complaint: { [Op.iLike]: `%${options.search}%` } },
        { visit_notes: { [Op.iLike]: `%${options.search}%` } },
      ];
    }

    // 🔎 Extra filters
    if (req.query.patient_id) options.where.patient_id = req.query.patient_id;
    if (req.query.doctor_id) options.where.doctor_id = req.query.doctor_id;
    if (req.query.midwife_id) options.where.midwife_id = req.query.midwife_id;
    if (req.query.consultation_id) options.where.consultation_id = req.query.consultation_id;

    // 🔎 Status filter
    if (req.query.status) {
      const statuses = Array.isArray(req.query.status)
        ? req.query.status
        : [req.query.status];
      options.where.status = { [Op.in]: statuses };
    }

    const { count, rows } = await MaternityVisit.findAndCountAll({
      where: options.where,
      include: [...MATERNITY_VISIT_INCLUDES, ...(options.include || [])],
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

    return success(res, "✅ Maternity visits loaded", {
      records: rows,
      pagination: {
        total: count,
        page: options.pagination.page,
        pageCount: Math.ceil(count / options.pagination.limit),
      },
    });
  } catch (err) {
    return error(res, "❌ Failed to load maternity visits", err);
  }
};

/* ============================================================
   📌 GET MATERNITY VISIT BY ID
   ============================================================ */
export const getMaternityVisitById = async (req, res) => {
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

    const record = await MaternityVisit.findOne({
      where,
      include: MATERNITY_VISIT_INCLUDES,
    });
    if (!record) return error(res, "❌ Maternity visit not found", null, 404);

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "view",
      entityId: id,
      entity: record,
    });

    return success(res, "✅ Maternity visit loaded", record);
  } catch (err) {
    return error(res, "❌ Failed to load maternity visit", err);
  }
};
