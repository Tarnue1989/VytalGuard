// 📁 controllers/ekgRecordController.js
import Joi from "joi";
import { Op } from "sequelize";
import {
  sequelize,
  EKGRecord,
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
import { EKG_STATUS } from "../constants/enums.js";
import { authzService } from "../services/authzService.js";
import { auditService } from "../services/auditService.js";
import { FIELD_VISIBILITY_EKG_RECORD } from "../constants/fieldVisibility.js";
import { billingService } from "../services/billingService.js";
import { shouldTriggerBilling } from "../constants/billing.js";
import { resolveClinicalLinks } from "../utils/autoLinkHelpers.js";

// 🔖 Local enum map for readability
const EKS = {
  PENDING: EKG_STATUS[0],
  IN_PROGRESS: EKG_STATUS[1],
  COMPLETED: EKG_STATUS[2],
  VERIFIED: EKG_STATUS[3],
  FINALIZED: EKG_STATUS[4],
  CANCELLED: EKG_STATUS[5],
  VOIDED: EKG_STATUS[6],
};

// ✅ Consistent module key for permissions & audits
const MODULE_KEY = "ekg-record";

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
const EKG_INCLUDES = [
  { model: Patient, as: "patient", attributes: ["id", "pat_no", "first_name", "last_name"] },
  { model: Employee.unscoped(), as: "technician", attributes: ["id", "first_name", "last_name"] },
  { model: Consultation, as: "consultation", attributes: ["id", "consultation_date", "status"] },
  { model: RegistrationLog, as: "registrationLog", attributes: ["id", "registration_time", "log_status"] },
  { model: Invoice, as: "invoice", attributes: ["id", "invoice_number", "status", "total"] },
  { model: BillableItem, as: "billableItem", attributes: ["id", "name", "price"] },
  { model: Organization, as: "organization", attributes: ["id", "name", "code"] },
  { model: Facility, as: "facility", attributes: ["id", "name", "code", "organization_id"] },
  { model: User, as: "createdBy", attributes: ["id", "first_name", "last_name"] },
  { model: User, as: "updatedBy", attributes: ["id", "first_name", "last_name"] },
  { model: User, as: "deletedBy", attributes: ["id", "first_name", "last_name"] },
];

/* ============================================================
   📋 JOI SCHEMA
   ============================================================ */
function buildEKGSchema(mode = "create") {
  const base = {
    patient_id: Joi.string().uuid().required(),
    consultation_id: Joi.string().uuid().allow(null, ""),
    registration_log_id: Joi.string().uuid().allow(null, ""),
    invoice_id: Joi.string().uuid().allow(null, ""),
    billable_item_id: Joi.string().uuid().allow(null, ""),
    technician_id: Joi.string().uuid().allow(null, ""),

    // EKG Observations
    heart_rate: Joi.number().min(20).max(250).allow(null),
    pr_interval: Joi.number().allow(null),
    qrs_duration: Joi.number().allow(null),
    qt_interval: Joi.number().allow(null),
    axis: Joi.string().allow("", null),
    rhythm: Joi.string().allow("", null),
    interpretation: Joi.string().allow("", null),
    recommendation: Joi.string().allow("", null),
    note: Joi.string().allow("", null),

    // Meta
    recorded_date: Joi.date().required(),
    file_path: Joi.string().allow("", null),
    source: Joi.string().allow("", null),

    is_emergency: Joi.boolean().default(false),
    organization_id: Joi.string().uuid().allow(null),
    facility_id: Joi.string().uuid().allow(null),
  };

  if (mode === "update") {
    Object.keys(base).forEach(k => { base[k] = base[k].optional(); });
  }

  return Joi.object(base);
}

/* ============================================================
   📌 CREATE EKG RECORD
   ============================================================ */
export const createEKGRecord = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const allowed = await authzService.checkPermission({ user: req.user, module: MODULE_KEY, action: "create", res });
    if (!allowed) return;

    const schema = buildEKGSchema("create");
    const { error: validationError, value } = schema.validate(req.body, { stripUnknown: true });
    if (validationError) {
      await t.rollback();
      return error(res, "Validation failed", validationError, 400);
    }

    // Org/Facility logic
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

    // Auto-link associations
    value._currentUser = req.user;
    await resolveClinicalLinks(value, orgId, facilityId, t);

    const created = await EKGRecord.create(
      {
        ...value,
        status: EKS.PENDING,
        organization_id: orgId,
        facility_id: facilityId,
        created_by_id: req.user?.id || null,
      },
      { transaction: t }
    );

    await t.commit();

    const full = await EKGRecord.findOne({ where: { id: created.id }, include: EKG_INCLUDES });

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "create",
      entityId: created.id,
      entity: created,
      details: { ...value, status: EKS.PENDING },
    });

    return success(res, "✅ EKG record created", full);
  } catch (err) {
    await t.rollback();
    return error(res, "❌ Failed to create EKG record", err);
  }
};

/* ============================================================
   📌 UPDATE EKG RECORD
   ============================================================ */
export const updateEKGRecord = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const allowed = await authzService.checkPermission({ user: req.user, module: MODULE_KEY, action: "update", res });
    if (!allowed) return;

    const { id } = req.params;
    const schema = buildEKGSchema("update");
    const { error: validationError, value } = schema.validate(req.body, { stripUnknown: true });
    if (validationError) {
      await t.rollback();
      return error(res, "Validation failed", validationError, 400);
    }

    const record = await EKGRecord.findOne({ where: { id }, transaction: t });
    if (!record) {
      await t.rollback();
      return error(res, "EKG record not found", null, 404);
    }

    // Org/Facility
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

    // Auto-link
    value._currentUser = req.user;
    await resolveClinicalLinks(value, orgId, facilityId, t);

    await record.update({ ...value, updated_by_id: req.user?.id || null }, { transaction: t });
    await t.commit();

    const full = await EKGRecord.findOne({ where: { id }, include: EKG_INCLUDES });

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "update",
      entityId: id,
      entity: full,
      details: value,
    });

    return success(res, "✅ EKG record updated", full);
  } catch (err) {
    await t.rollback();
    return error(res, "❌ Failed to update EKG record", err);
  }
};

/* ============================================================
   📌 START EKG RECORD (pending → in_progress)
============================================================ */
export const startEKGRecord = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { id } = req.params;

    // 🔒 Permission check
    const allowed = await authzService.checkPermission({
      user: req.user,
      module: MODULE_KEY,
      action: "start",
      res,
    });
    if (!allowed) return;

    const rec = await EKGRecord.findOne({ where: { id }, transaction: t });
    if (!rec) {
      await t.rollback();
      return error(res, "❌ EKG record not found", null, 404);
    }

    if (rec.status !== EKS.PENDING) {
      await t.rollback();
      return error(res, "❌ Only pending EKG records can be started", null, 400);
    }

    const oldStatus = rec.status;

    await rec.update(
      {
        status: EKS.IN_PROGRESS,
        updated_by_id: req.user?.id || null,
      },
      { transaction: t }
    );

    await t.commit();

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "start",
      entityId: id,
      entity: rec,
      details: { from: oldStatus, to: EKS.IN_PROGRESS },
    });

    return success(res, "✅ EKG record started", rec);
  } catch (err) {
    await t.rollback();
    return error(res, "❌ Failed to start EKG record", err);
  }
};

/* ============================================================
   📌 COMPLETE EKG RECORD (in_progress → completed)
   ============================================================ */
export const completeEKGRecord = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { id } = req.params;
    const rec = await EKGRecord.findOne({ where: { id }, transaction: t });
    if (!rec) return error(res, "❌ EKG record not found", null, 404);

    if (rec.status !== EKS.IN_PROGRESS) {
      await t.rollback();
      return error(res, "❌ Only in-progress EKGs can be completed", null, 400);
    }

    const oldStatus = rec.status;
    await rec.update({ status: EKS.COMPLETED, updated_by_id: req.user?.id || null }, { transaction: t });

    if (shouldTriggerBilling(MODULE_KEY, EKS.COMPLETED)) {
      await billingService.triggerAutoBilling({
        module: MODULE_KEY,
        entity: rec,
        user: { ...req.user, organization_id: rec.organization_id, facility_id: rec.facility_id },
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
      details: { from: oldStatus, to: EKS.COMPLETED },
    });

    return success(res, "✅ EKG record completed", rec);
  } catch (err) {
    await t.rollback();
    return error(res, "❌ Failed to complete EKG record", err);
  }
};

/* ============================================================
   📌 VERIFY EKG RECORD (completed → verified)
   ============================================================ */
export const verifyEKGRecord = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { id } = req.params;
    const rec = await EKGRecord.findOne({ where: { id }, transaction: t });
    if (!rec) return error(res, "❌ EKG record not found", null, 404);

    if (rec.status !== EKS.COMPLETED) {
      await t.rollback();
      return error(res, "❌ Only completed EKGs can be verified", null, 400);
    }

    const oldStatus = rec.status;
    await rec.update({ status: EKS.VERIFIED, verified_by_id: req.user?.id || null, verified_at: new Date() }, { transaction: t });

    if (shouldTriggerBilling(MODULE_KEY, EKS.VERIFIED)) {
      await billingService.triggerAutoBilling({
        module: MODULE_KEY,
        entity: rec,
        user: { ...req.user, organization_id: rec.organization_id, facility_id: rec.facility_id },
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
      details: { from: oldStatus, to: EKS.VERIFIED },
    });

    return success(res, "✅ EKG record verified", rec);
  } catch (err) {
    await t.rollback();
    return error(res, "❌ Failed to verify EKG record", err);
  }
};

/* ============================================================
   📌 FINALIZE EKG RECORD (any → finalized, lock edits)
   ============================================================ */
export const finalizeEKGRecord = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { id } = req.params;
    const rec = await EKGRecord.findOne({ where: { id }, transaction: t });
    if (!rec) return error(res, "❌ EKG record not found", null, 404);

    const oldStatus = rec.status;
    await rec.update({ status: EKS.FINALIZED, finalized_by_id: req.user?.id || null, finalized_at: new Date() }, { transaction: t });

    await t.commit();

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "finalize",
      entityId: id,
      entity: rec,
      details: { from: oldStatus, to: EKS.FINALIZED },
    });

    return success(res, "✅ EKG record finalized", rec);
  } catch (err) {
    await t.rollback();
    return error(res, "❌ Failed to finalize EKG record", err);
  }
};

/* ============================================================
   📌 VOID EKG RECORD (any → voided, admin/superadmin only)
   ============================================================ */
export const voidEKGRecord = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const role = (req.user?.roleNames?.[0] || "").toLowerCase();
    if (!["admin", "superadmin"].includes(role)) {
      return error(res, "❌ Only admin/superadmin can void EKG records", null, 403);
    }

    const { id } = req.params;
    const { reason } = req.body;
    const rec = await EKGRecord.findOne({ where: { id }, transaction: t });
    if (!rec) return error(res, "❌ EKG record not found", null, 404);

    const oldStatus = rec.status;
    await rec.update(
      { status: EKS.VOIDED, void_reason: reason || null, voided_by_id: req.user?.id || null, voided_at: new Date() },
      { transaction: t }
    );

    await billingService.voidCharges({ module: MODULE_KEY, entityId: rec.id, user: req.user, transaction: t });
    await t.commit();

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "void",
      entityId: id,
      entity: rec,
      details: { from: oldStatus, to: EKS.VOIDED, reason: reason || null },
    });

    return success(res, "✅ EKG record voided & charges rolled back", rec);
  } catch (err) {
    await t.rollback();
    return error(res, "❌ Failed to void EKG record", err);
  }
};
/* ============================================================
   📌 CANCEL EKG RECORD (pending/in_progress → cancelled)
   ============================================================ */
export const cancelEKGRecord = async (req, res) => {
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

    const rec = await EKGRecord.findOne({ where, transaction: t });
    if (!rec) return error(res, "❌ EKG record not found", null, 404);

    if (![EKS.PENDING, EKS.IN_PROGRESS].includes(rec.status)) {
      await t.rollback();
      return error(res, "❌ Only pending or in-progress EKGs can be cancelled", null, 400);
    }

    const oldStatus = rec.status;

    await rec.update(
      {
        status: EKS.CANCELLED,
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
      details: { from: oldStatus, to: EKS.CANCELLED, reason: reason || null },
    });

    return success(res, "✅ EKG record cancelled & charges voided", rec);
  } catch (err) {
    await t.rollback();
    return error(res, "❌ Failed to cancel EKG record", err);
  }
};

/* ============================================================
   📌 DELETE EKG RECORD (Soft Delete + Billing Rollback)
   ============================================================ */
export const deleteEKGRecord = async (req, res) => {
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

    const rec = await EKGRecord.findOne({ where, transaction: t });
    if (!rec) {
      await t.rollback();
      return error(res, "❌ EKG record not found", null, 404);
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

    const full = await EKGRecord.findOne({
      where: { id },
      include: EKG_INCLUDES,
      paranoid: false,
    });

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "delete",
      entityId: id,
      entity: full,
    });

    return success(res, "✅ EKG record deleted (with billing rollback)", full);
  } catch (err) {
    await t.rollback();
    return error(res, "❌ Failed to delete EKG record", err);
  }
};

/* ============================================================
   📌 GET ALL EKG RECORDS LITE (with ?q= + ?status= support)
   ============================================================ */
export const getAllEKGRecordsLite = async (req, res) => {
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

    let statusFilter = [EKS.PENDING, EKS.IN_PROGRESS];
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
        { rhythm: { [Op.iLike]: `%${q}%` } },
        { interpretation: { [Op.iLike]: `%${q}%` } },
        { recommendation: { [Op.iLike]: `%${q}%` } },
      ];
    }

    if (req.query.patient_id) where.patient_id = req.query.patient_id;
    if (req.query.consultation_id) where.consultation_id = req.query.consultation_id;
    if (req.query.technician_id) where.technician_id = req.query.technician_id;

    const records = await EKGRecord.findAll({
      where,
      attributes: ["id", "recorded_date", "rhythm", "status"],
      include: [
        { model: Patient, as: "patient", attributes: ["id", "pat_no", "first_name", "last_name"] },
        { model: Employee.unscoped(), as: "technician", attributes: ["id", "first_name", "last_name"] },
      ],
      order: [["recorded_date", "DESC"]],
      limit: 20,
    });

    const result = records.map(r => ({
      id: r.id,
      patient: r.patient ? `${r.patient.pat_no} - ${r.patient.first_name} ${r.patient.last_name}` : "",
      technician: r.technician ? `${r.technician.first_name} ${r.technician.last_name}` : "",
      rhythm: r.rhythm || "",
      date: r.recorded_date,
      status: r.status,
    }));

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "list_lite",
      details: { query: q || null, returned: result.length },
    });

    return success(res, "✅ EKG records loaded (lite)", { records: result });
  } catch (err) {
    return error(res, "❌ Failed to load EKG records (lite)", err);
  }
};
/* ============================================================
   📌 GET ALL EKG RECORDS (with ?status= support)
   ============================================================ */
export const getAllEKGRecords = async (req, res) => {
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
      FIELD_VISIBILITY_EKG_RECORD[role] || FIELD_VISIBILITY_EKG_RECORD.staff;

    const FRONTEND_ONLY_FIELDS = ["actions"];
    const safeFields = visibleFields.filter(f => !FRONTEND_ONLY_FIELDS.includes(f));

    const options = buildQueryOptions(req, "recorded_date", "DESC", safeFields);
    options.where = options.where || {};

    // 🔒 Org/facility scope
    if (!isSuperAdmin(req.user)) {
      options.where.organization_id = req.user.organization_id;
      if (role === "facility_head") {
        options.where.facility_id = req.user.facility_id;
      }
    } else {
      if (req.query.organization_id) options.where.organization_id = req.query.organization_id;
      if (req.query.facility_id) options.where.facility_id = req.query.facility_id;
    }

    // 🔎 Search
    if (options.search) {
      options.where[Op.or] = [
        { rhythm: { [Op.iLike]: `%${options.search}%` } },
        { interpretation: { [Op.iLike]: `%${options.search}%` } },
        { recommendation: { [Op.iLike]: `%${options.search}%` } },
      ];
    }

    // 🔎 Filters
    if (req.query.patient_id) options.where.patient_id = req.query.patient_id;
    if (req.query.consultation_id) options.where.consultation_id = req.query.consultation_id;
    if (req.query.registration_log_id) options.where.registration_log_id = req.query.registration_log_id;
    if (req.query.technician_id) options.where.technician_id = req.query.technician_id;

    // 🔎 Status filter
    if (req.query.status) {
      const statuses = Array.isArray(req.query.status) ? req.query.status : [req.query.status];
      options.where.status = { [Op.in]: statuses };
    }

    const { count, rows } = await EKGRecord.findAndCountAll({
      where: options.where,
      include: [...EKG_INCLUDES, ...(options.include || [])],
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

    return success(res, "✅ EKG records loaded", {
      records: rows,
      pagination: {
        total: count,
        page: options.pagination.page,
        pageCount: Math.ceil(count / options.pagination.limit),
      },
    });
  } catch (err) {
    return error(res, "❌ Failed to load EKG records", err);
  }
};

/* ============================================================
   📌 GET EKG RECORD BY ID
   ============================================================ */
export const getEKGRecordById = async (req, res) => {
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

    const record = await EKGRecord.findOne({
      where,
      include: EKG_INCLUDES,
    });
    if (!record) return error(res, "❌ EKG record not found", null, 404);

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "view",
      entityId: id,
      entity: record,
    });

    return success(res, "✅ EKG record loaded", record);
  } catch (err) {
    return error(res, "❌ Failed to load EKG record", err);
  }
};
