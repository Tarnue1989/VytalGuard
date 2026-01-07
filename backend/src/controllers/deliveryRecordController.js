// 📁 controllers/deliveryRecordController.js
import Joi from "joi";
import { Op } from "sequelize";
import {
  sequelize,
  DeliveryRecord,
  Patient,
  Employee,
  Consultation,
  Department,
  Invoice,
  BillableItem,
  User,
  Organization,
  Facility,
} from "../models/index.js";
import { success, error } from "../utils/response.js";
import { buildQueryOptions } from "../utils/queryHelper.js";
import { DELIVERY_STATUS } from "../constants/enums.js";
import { authzService } from "../services/authzService.js";
import { auditService } from "../services/auditService.js";
import { FIELD_VISIBILITY_DELIVERY_RECORD } from "../constants/fieldVisibility.js";
import { billingService } from "../services/billingService.js";
import { shouldTriggerBilling } from "../constants/billing.js";

// 🔖 Local enum map for readability
const DS = {
  SCHEDULED: DELIVERY_STATUS[0],
  IN_PROGRESS: DELIVERY_STATUS[1],
  COMPLETED: DELIVERY_STATUS[2],
  VERIFIED: DELIVERY_STATUS[3],
  CANCELLED: DELIVERY_STATUS[4],
  VOIDED: DELIVERY_STATUS[5],
};

const MODULE_KEY = "delivery-record";

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
const DELIVERY_INCLUDES = [
  { model: Patient, as: "patient", attributes: ["id", "pat_no", "first_name", "last_name"] },
  { model: Employee.unscoped(), as: "doctor", attributes: ["id", "first_name", "last_name"] },
  { model: Employee.unscoped(), as: "midwife", attributes: ["id", "first_name", "last_name"] },
  { model: Consultation, as: "consultation", attributes: ["id", "consultation_date", "status"] },
  { model: Invoice, as: "invoice", attributes: ["id", "invoice_number", "status", "total"] },
  { model: BillableItem, as: "billableItem", attributes: ["id", "name", "price"] },
  { model: Department, as: "department", attributes: ["id", "name", "code"] },
  { model: Organization, as: "organization", attributes: ["id", "name", "code"] },
  { model: Facility, as: "facility", attributes: ["id", "name", "code", "organization_id"] },
  { model: User, as: "createdBy", attributes: ["id", "first_name", "last_name"] },
  { model: User, as: "updatedBy", attributes: ["id", "first_name", "last_name"] },
  { model: User, as: "deletedBy", attributes: ["id", "first_name", "last_name"] },
];

/* ============================================================
   📋 JOI SCHEMA
   ============================================================ */
function buildDeliverySchema(mode = "create") {
  const base = {
    patient_id: Joi.string().uuid().required(),
    consultation_id: Joi.string().uuid().allow(null, ""),
    doctor_id: Joi.string().uuid().allow(null, ""),
    midwife_id: Joi.string().uuid().allow(null, ""),
    department_id: Joi.string().uuid().allow(null, ""),
    billable_item_id: Joi.string().uuid().required(),   // ✅ required for billing
    invoice_id: Joi.string().uuid().allow(null, ""),

    delivery_date: Joi.date().required(),
    delivery_type: Joi.string().allow("", null),        // ✅ optional, will be auto-filled
    baby_count: Joi.number().allow(null),
    delivery_mode: Joi.string().allow("", null),
    birth_weight: Joi.string().allow("", null),
    birth_length: Joi.string().allow("", null),
    newborn_weight: Joi.string().allow("", null),
    newborn_gender: Joi.string().allow("", null),
    apgar_score: Joi.string().allow("", null),
    complications: Joi.string().allow("", null),
    notes: Joi.string().allow("", null),
    is_emergency: Joi.boolean().default(false),

    // 🔒 status excluded → lifecycle endpoints control it
    organization_id: Joi.string().uuid().allow(null),
    facility_id: Joi.string().uuid().allow(null),
  };

  if (mode === "update") {
    Object.keys(base).forEach(k => {
      base[k] = base[k].optional();
    });
  }

  return Joi.object(base);
}

/* ============================================================
   📌 CREATE DELIVERY RECORD
   ============================================================ */
export const createDeliveryRecord = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module: MODULE_KEY,
      action: "create",
      res,
    });
    if (!allowed) return;

    const schema = buildDeliverySchema("create");
    const { error: validationError, value } = schema.validate(req.body, { stripUnknown: true });
    if (validationError) {
      await t.rollback();
      return error(res, "Validation failed", validationError, 400);
    }

    // 🔹 Derive delivery_type from BillableItem if not set
    if (value.billable_item_id) {
      const billItem = await BillableItem.findByPk(value.billable_item_id, { attributes: ["name"] });
      if (billItem) value.delivery_type = billItem.name;
    }

    // 🔹 Org/Facility logic
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

    const created = await DeliveryRecord.create(
      {
        ...value,
        status: DS.SCHEDULED,
        organization_id: orgId,
        facility_id: facilityId,
        created_by_id: req.user?.id || null,
      },
      { transaction: t }
    );

    await t.commit();

    const full = await DeliveryRecord.findOne({
      where: { id: created.id },
      include: DELIVERY_INCLUDES,
    });

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "create",
      entityId: created.id,
      entity: created,
      details: { ...value, status: DS.SCHEDULED },
    });

    return success(res, "✅ Delivery record created", full);
  } catch (err) {
    await t.rollback();
    return error(res, "❌ Failed to create delivery record", err);
  }
};

/* ============================================================
   📌 UPDATE DELIVERY RECORD
   ============================================================ */
export const updateDeliveryRecord = async (req, res) => {
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
    const schema = buildDeliverySchema("update");
    const { error: validationError, value } = schema.validate(req.body, { stripUnknown: true });
    if (validationError) {
      await t.rollback();
      return error(res, "Validation failed", validationError, 400);
    }

    const record = await DeliveryRecord.findOne({ where: { id }, transaction: t });
    if (!record) {
      await t.rollback();
      return error(res, "Delivery record not found", null, 404);
    }

    // 🔹 Always refresh delivery_type if billable_item_id provided/changed
    if (value.billable_item_id && value.billable_item_id !== record.billable_item_id) {
      const billItem = await BillableItem.findByPk(value.billable_item_id, { attributes: ["name"] });
      if (billItem) value.delivery_type = billItem.name;
    }

    // 🔹 Org/Facility update logic
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

    await record.update(
      {
        ...value,
        updated_by_id: req.user?.id || null,
      },
      { transaction: t }
    );

    await t.commit();

    const full = await DeliveryRecord.findOne({
      where: { id },
      include: DELIVERY_INCLUDES,
    });

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "update",
      entityId: id,
      entity: full,
      details: value,
    });

    return success(res, "✅ Delivery record updated", full);
  } catch (err) {
    await t.rollback();
    return error(res, "❌ Failed to update delivery record", err);
  }
};


/* ============================================================
   📌 START DELIVERY (scheduled → in_progress)
   ============================================================ */
export const startDeliveryRecord = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { id } = req.params;

    const where = { id };
    const role = (req.user?.roleNames?.[0] || "staff").toLowerCase();
    if (!isSuperAdmin(req.user)) {
      where.organization_id = req.user.organization_id;
      if (role === "facility_head") where.facility_id = req.user.facility_id;
    }

    const rec = await DeliveryRecord.findOne({ where, transaction: t });
    if (!rec) return error(res, "❌ Delivery record not found", null, 404);

    if (rec.status !== DS.SCHEDULED) {
      await t.rollback();
      return error(res, "❌ Only scheduled deliveries can be started", null, 400);
    }

    const oldStatus = rec.status;

    await rec.update(
      { status: DS.IN_PROGRESS, updated_by_id: req.user?.id || null },
      { transaction: t }
    );

    await t.commit();

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "start",
      entityId: id,
      entity: rec,
      details: { from: oldStatus, to: DS.IN_PROGRESS },
    });

    return success(res, "✅ Delivery started (in-progress)", rec);
  } catch (err) {
    await t.rollback();
    return error(res, "❌ Failed to start delivery record", err);
  }
};
/* ============================================================
   📌 COMPLETE DELIVERY (in_progress → completed)
   ============================================================ */
export const completeDeliveryRecord = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { id } = req.params;

    const where = { id };
    const role = (req.user?.roleNames?.[0] || "staff").toLowerCase();
    if (!isSuperAdmin(req.user)) {
      where.organization_id = req.user.organization_id;
      if (role === "facility_head") where.facility_id = req.user.facility_id;
    }

    const rec = await DeliveryRecord.findOne({ where, transaction: t });
    if (!rec) return error(res, "❌ Delivery record not found", null, 404);

    if (rec.status !== DS.IN_PROGRESS) {
      await t.rollback();
      return error(res, "❌ Only in-progress delivery records can be completed", null, 400);
    }

    const oldStatus = rec.status;

    await rec.update(
      { status: DS.COMPLETED, updated_by_id: req.user?.id || null },
      { transaction: t }
    );

    if (shouldTriggerBilling(MODULE_KEY, DS.COMPLETED)) {
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
      details: { from: oldStatus, to: DS.COMPLETED },
    });

    return success(res, "✅ Delivery marked as completed", rec);
  } catch (err) {
    await t.rollback();
    return error(res, "❌ Failed to complete delivery record", err);
  }
};

/* ============================================================
   📌 CANCEL DELIVERY (scheduled/in_progress → cancelled)
   ============================================================ */
export const cancelDeliveryRecord = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { id } = req.params;
    const { reason } = req.body; // still capture for audit

    const where = { id };
    const role = (req.user?.roleNames?.[0] || "staff").toLowerCase();
    if (!isSuperAdmin(req.user)) {
      where.organization_id = req.user.organization_id;
      if (role === "facility_head") where.facility_id = req.user.facility_id;
    }

    const rec = await DeliveryRecord.findOne({ where, transaction: t });
    if (!rec) return error(res, "❌ Delivery record not found", null, 404);

    if (![DS.SCHEDULED, DS.IN_PROGRESS].includes(rec.status)) {
      await t.rollback();
      return error(res, "❌ Only scheduled or in-progress deliveries can be cancelled", null, 400);
    }

    const oldStatus = rec.status;

    await rec.update(
      {
        status: DS.CANCELLED,
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
      details: { from: oldStatus, to: DS.CANCELLED, reason: reason || null },
    });

    return success(res, "✅ Delivery cancelled & charges voided", rec);
  } catch (err) {
    await t.rollback();
    return error(res, "❌ Failed to cancel delivery record", err);
  }
};

/* ============================================================
   📌 VOID DELIVERY (any → voided, admin/superadmin only)
   ============================================================ */
export const voidDeliveryRecord = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const role = (req.user?.roleNames?.[0] || "").toLowerCase();
    if (!["admin", "superadmin"].includes(role)) {
      return error(res, "❌ Only admin/superadmin can void delivery records", null, 403);
    }

    const { id } = req.params;
    const { reason } = req.body; // still capture for audit

    const where = { id };
    if (!isSuperAdmin(req.user)) {
      where.organization_id = req.user.organization_id;
      if (role === "facility_head") where.facility_id = req.user.facility_id;
    }

    const rec = await DeliveryRecord.findOne({ where, transaction: t });
    if (!rec) return error(res, "❌ Delivery record not found", null, 404);

    const oldStatus = rec.status;

    await rec.update(
      {
        status: DS.VOIDED,
        voided_by_id: req.user?.id || null,
        voided_at: new Date(),
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
      details: { from: oldStatus, to: DS.VOIDED, reason: reason || null },
    });

    return success(res, "✅ Delivery record voided & charges rolled back", rec);
  } catch (err) {
    await t.rollback();
    return error(res, "❌ Failed to void delivery record", err);
  }
};

/* ============================================================
   📌 VERIFY DELIVERY (completed → verified)
   ============================================================ */
export const verifyDeliveryRecord = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { id } = req.params;

    const where = { id };
    const role = (req.user?.roleNames?.[0] || "staff").toLowerCase();
    if (!isSuperAdmin(req.user)) {
      where.organization_id = req.user.organization_id;
      if (role === "facility_head") where.facility_id = req.user.facility_id;
    }

    const rec = await DeliveryRecord.findOne({ where, transaction: t });
    if (!rec) return error(res, "❌ Delivery record not found", null, 404);

    if (rec.status !== DS.COMPLETED) {
      await t.rollback();
      return error(res, "❌ Only completed delivery records can be verified", null, 400);
    }

    const oldStatus = rec.status;

    await rec.update(
      { 
        status: DS.VERIFIED, 
        verified_by_id: req.user?.id || null,
        verified_at: new Date(),
      },
      { transaction: t }
    );

    if (shouldTriggerBilling(MODULE_KEY, DS.VERIFIED)) {
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
      details: { from: oldStatus, to: DS.VERIFIED },
    });

    return success(res, "✅ Delivery record verified", rec);
  } catch (err) {
    await t.rollback();
    return error(res, "❌ Failed to verify delivery record", err);
  }
};
/* ============================================================
   📌 FINALIZE DELIVERY (verified → finalized, admin/superadmin only)
   ============================================================ */
export const finalizeDeliveryRecord = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const role = (req.user?.roleNames?.[0] || "").toLowerCase();
    if (!["admin", "superadmin"].includes(role)) {
      return error(res, "❌ Only admin/superadmin can finalize delivery records", null, 403);
    }

    const { id } = req.params;

    const where = { id };
    if (!isSuperAdmin(req.user)) {
      where.organization_id = req.user.organization_id;
      if (role === "facility_head") {
        where.facility_id = req.user.facility_id;
      }
    }

    const rec = await DeliveryRecord.findOne({ where, transaction: t });
    if (!rec) return error(res, "❌ Delivery record not found", null, 404);

    if (rec.status !== DS.VERIFIED) {
      await t.rollback();
      return error(res, "❌ Only verified delivery records can be finalized", null, 400);
    }

    const oldStatus = rec.status;

    await rec.update(
      {
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
      details: { from: oldStatus, to: "FINALIZED" },
    });

    return success(res, "✅ Delivery record finalized (locked)", rec);
  } catch (err) {
    await t.rollback();
    return error(res, "❌ Failed to finalize delivery record", err);
  }
};

/* ============================================================
   📌 DELETE DELIVERY RECORD (Soft Delete + Billing Rollback)
   ============================================================ */
export const deleteDeliveryRecord = async (req, res) => {
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

    const rec = await DeliveryRecord.findOne({ where, transaction: t });
    if (!rec) {
      await t.rollback();
      return error(res, "❌ Delivery record not found", null, 404);
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
    const full = await DeliveryRecord.findOne({
      where: { id },
      include: DELIVERY_INCLUDES,
      paranoid: false,
    });

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "delete",
      entityId: id,
      entity: full,
    });

    return success(res, "✅ Delivery record deleted (with billing rollback)", full);
  } catch (err) {
    await t.rollback();
    return error(res, "❌ Failed to delete delivery record", err);
  }
};

/* ============================================================
   📌 GET ALL DELIVERY RECORDS LITE (with ?q= + ?status= support)
   ============================================================ */
export const getAllDeliveryRecordsLite = async (req, res) => {
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

    // Default status filter (scheduled + in-progress), overridable by query
    let statusFilter = [DS.SCHEDULED, DS.IN_PROGRESS];
    if (status) {
      const statuses = Array.isArray(status) ? status : [status];
      statusFilter = statuses;
    }
    const where = { status: { [Op.in]: statusFilter } };

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
        { delivery_type: { [Op.iLike]: `%${q}%` } },
        { notes: { [Op.iLike]: `%${q}%` } },
      ];
    }

    // 🔎 Extra filters
    if (req.query.patient_id) where.patient_id = req.query.patient_id;
    if (req.query.doctor_id) where.doctor_id = req.query.doctor_id;
    if (req.query.midwife_id) where.midwife_id = req.query.midwife_id;
    if (req.query.consultation_id) where.consultation_id = req.query.consultation_id;

    const deliveries = await DeliveryRecord.findAll({
      where,
      attributes: ["id", "delivery_date", "delivery_type", "status"],
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
          as: "midwife",
          attributes: ["id", "first_name", "last_name"],
        },
      ],
      order: [["delivery_date", "DESC"]],
      limit: 20,
    });

    const result = deliveries.map(d => ({
      id: d.id,
      patient: d.patient
        ? `${d.patient.pat_no} - ${d.patient.first_name} ${d.patient.last_name}`
        : "",
      doctor: d.doctor ? `${d.doctor.first_name} ${d.doctor.last_name}` : "",
      midwife: d.midwife ? `${d.midwife.first_name} ${d.midwife.last_name}` : "",
      delivery_type: d.delivery_type || "",
      date: d.delivery_date,
      status: d.status,
    }));

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "list_lite",
      details: { query: q || null, returned: result.length },
    });

    return success(res, "✅ Delivery records loaded (lite)", { records: result });
  } catch (err) {
    return error(res, "❌ Failed to load delivery records (lite)", err);
  }
};

/* ============================================================
   📌 GET ALL DELIVERY RECORDS (with ?status= support)
   ============================================================ */
export const getAllDeliveryRecords = async (req, res) => {
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
      FIELD_VISIBILITY_DELIVERY_RECORD[role] || FIELD_VISIBILITY_DELIVERY_RECORD.staff;

    // 🚫 remove pseudo-fields like "actions"
    const FRONTEND_ONLY_FIELDS = ["actions"];
    const safeFields = visibleFields.filter(f => !FRONTEND_ONLY_FIELDS.includes(f));

    const options = buildQueryOptions(req, "delivery_date", "DESC", safeFields);
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
        { delivery_type: { [Op.iLike]: `%${options.search}%` } },
        { notes: { [Op.iLike]: `%${options.search}%` } },
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

    const { count, rows } = await DeliveryRecord.findAndCountAll({
      where: options.where,
      include: [...DELIVERY_INCLUDES, ...(options.include || [])],
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

    return success(res, "✅ Delivery records loaded", {
      records: rows,
      pagination: {
        total: count,
        page: options.pagination.page,
        pageCount: Math.ceil(count / options.pagination.limit),
      },
    });
  } catch (err) {
    return error(res, "❌ Failed to load delivery records", err);
  }
};

/* ============================================================
   📌 GET DELIVERY RECORD BY ID
   ============================================================ */
export const getDeliveryRecordById = async (req, res) => {
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

    const record = await DeliveryRecord.findOne({
      where,
      include: DELIVERY_INCLUDES,
    });
    if (!record) return error(res, "❌ Delivery record not found", null, 404);

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "view",
      entityId: id,
      entity: record,
    });

    return success(res, "✅ Delivery record loaded", record);
  } catch (err) {
    return error(res, "❌ Failed to load delivery record", err);
  }
};
