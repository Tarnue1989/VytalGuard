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
  InvoiceItem,
} from "../models/index.js";

import { success, error } from "../utils/response.js";
import { buildQueryOptions } from "../utils/queryHelper.js";
import { EKG_STATUS } from "../constants/enums.js";
import { authzService } from "../services/authzService.js";
import { auditService } from "../services/auditService.js";
import { FIELD_VISIBILITY_EKG_RECORD } from "../constants/fieldVisibility.js";
import { billingService } from "../services/billingService.js";
import { resolveClinicalLinks } from "../utils/autoLinkHelpers.js";

import { resolveOrgFacility } from "../utils/resolveOrgFacility.js";
import { validate } from "../utils/validation.js";
import { isSuperAdmin } from "../utils/role-utils.js";
import { normalizeDateRangeLocal } from "../utils/date-utils.js";
import { makeModuleLogger } from "../utils/debugLogger.js";

/* ============================================================
   🔧 LOCAL DEBUG OVERRIDE
============================================================ */
const DEBUG_OVERRIDE = false;
const debug = makeModuleLogger("ekgRecordController", DEBUG_OVERRIDE);

const MODULE_KEY = "ekg_record";

/* ============================================================
   🔖 STATUS MAP (ENUM-DRIVEN)
============================================================ */
const EKS = {
  PENDING: EKG_STATUS[0],
  IN_PROGRESS: EKG_STATUS[1],
  COMPLETED: EKG_STATUS[2],
  VERIFIED: EKG_STATUS[3],
  FINALIZED: EKG_STATUS[4],
  CANCELLED: EKG_STATUS[5],
  VOIDED: EKG_STATUS[6],
};

/* ============================================================
   🔗 SHARED INCLUDES
============================================================ */
const EKG_INCLUDES = [
  { model: Patient, as: "patient", attributes: ["id", "pat_no", "first_name", "last_name",
    [sequelize.literal(`"patient"."first_name" || ' ' || "patient"."last_name"`), "label"],
  ]},
  { model: Employee.unscoped(), as: "technician", attributes: ["id", "first_name", "last_name",
    [sequelize.literal(`"technician"."first_name" || ' ' || "technician"."last_name"`), "label"],
  ]},
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
   📋 JOI SCHEMA (MASTER-ALIGNED)
============================================================ */
function buildEKGSchema(user, mode = "create") {
  const base = {
    patient_id: Joi.string().uuid().required(),
    consultation_id: Joi.string().uuid().allow("", null),
    registration_log_id: Joi.string().uuid().allow("", null),
    invoice_id: Joi.string().uuid().allow("", null),
    billable_item_id: Joi.string().uuid().allow("", null),
    technician_id: Joi.string().uuid().allow("", null),

    heart_rate: Joi.number().min(20).max(250).allow(null),
    pr_interval: Joi.number().allow(null),
    qrs_duration: Joi.number().allow(null),
    qt_interval: Joi.number().allow(null),
    axis: Joi.string().allow("", null),
    rhythm: Joi.string().allow("", null),
    interpretation: Joi.string().allow("", null),
    recommendation: Joi.string().allow("", null),
    note: Joi.string().allow("", null),

    recorded_date: Joi.date().required(),
    file_path: Joi.string().allow("", null),
    source: Joi.string().allow("", null),
    is_emergency: Joi.boolean().default(false),

    organization_id: Joi.forbidden(),
    facility_id: Joi.forbidden(),
  };

  if (mode === "update") {
    Object.keys(base).forEach(k => (base[k] = base[k].optional()));
  }

  if (isSuperAdmin(user)) {
    base.organization_id = Joi.string().uuid().allow("", null);
    base.facility_id = Joi.string().uuid().allow("", null);
  }

  return Joi.object(base);
}

/* ============================================================
   📌 CREATE
============================================================ */
export const createEKGRecord = async (req, res) => {
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
      buildEKGSchema(req.user, "create"),
      req.body
    );
    if (errors) {
      await t.rollback();
      return error(res, "Validation failed", errors, 400);
    }

    const { orgId, facilityId } = resolveOrgFacility({
      user: req.user,
      value,
      body: req.body,
    });

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

    const full = await EKGRecord.findOne({
      where: { id: created.id },
      include: EKG_INCLUDES,
    });

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "create",
      entityId: created.id,
      entity: full,
    });

    return success(res, "EKG record created", full);
  } catch (err) {
    await t.rollback();
    debug.error("create → FAILED", err);
    return error(res, "Failed to create EKG record", err);
  }
};

/* ============================================================
   📌 UPDATE EKG RECORD (MASTER-ALIGNED + LOCKED STATES)
   - Permission-gated
   - Org / Facility resolved
   - ❌ Blocks updates after FINALIZED / VOIDED
============================================================ */
export const updateEKGRecord = async (req, res) => {
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

    const { value, errors } = validate(
      buildEKGSchema(req.user, "update"),
      req.body
    );
    if (errors) {
      await t.rollback();
      return error(res, "Validation failed", errors, 400);
    }

    const record = await EKGRecord.findOne({ where: { id }, transaction: t });
    if (!record) {
      await t.rollback();
      return error(res, "EKG record not found", null, 404);
    }

    /* ================= LOCK FINAL STATES ================= */
    if ([EKS.FINALIZED, EKS.VOIDED].includes(record.status)) {
      await t.rollback();
      return error(
        res,
        "Finalized or voided EKG records cannot be modified",
        null,
        400
      );
    }

    const { orgId, facilityId } = resolveOrgFacility({
      user: req.user,
      value,
      body: req.body,
    });

    value._currentUser = req.user;
    await resolveClinicalLinks(value, orgId, facilityId, t);

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

    const full = await EKGRecord.findOne({
      where: { id },
      include: EKG_INCLUDES,
    });

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "update",
      entityId: id,
      entity: full,
    });

    return success(res, "EKG record updated", full);
  } catch (err) {
    await t.rollback();
    debug.error("update → FAILED", err);
    return error(res, "Failed to update EKG record", err);
  }
};

/* ============================================================
   📌 VOID EKG RECORD (any → voided, MASTER-ALIGNED)
   - Permission-gated via authzService
   - Org / Facility scoped
   - Status-guarded
   - Billing rollback (transaction-safe)
============================================================ */
export const voidEKGRecord = async (req, res) => {
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
    const { reason } = req.body;

    const where = { id };

    if (!isSuperAdmin(req.user)) {
      where.organization_id = req.user.organization_id;
      if (req.user.facility_id) {
        where.facility_id = req.user.facility_id;
      }
    }

    const record = await EKGRecord.findOne({ where, transaction: t });
    if (!record) {
      await t.rollback();
      return error(res, "EKG record not found", null, 404);
    }

    /* ================= STATUS GUARD ================= */
    if (record.status === EKS.VOIDED) {
      await t.rollback();
      return error(res, "EKG record is already voided", null, 400);
    }

    const oldStatus = record.status;

    await record.update(
      {
        status: EKS.VOIDED,
        void_reason: reason || null,
        voided_by_id: req.user?.id || null,
        voided_at: new Date(),
        updated_by_id: req.user?.id || null,
      },
      { transaction: t }
    );

    /* ================= BILLING ROLLBACK ================= */
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
      action: "void",
      entityId: id,
      entity: record,
      details: {
        from: oldStatus,
        to: EKS.VOIDED,
        reason: reason || null,
      },
    });

    return success(res, "EKG record voided", record);
  } catch (err) {
    await t.rollback();
    return error(res, "Failed to void EKG record", err);
  }
};

/* ============================================================
   📌 START EKG RECORD (pending → in_progress)
============================================================ */
export const startEKGRecord = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module: MODULE_KEY,
      action: "start",
      res,
    });
    if (!allowed) return;

    const { id } = req.params;

    const record = await EKGRecord.findOne({ where: { id }, transaction: t });
    if (!record) {
      await t.rollback();
      return error(res, "EKG record not found", null, 404);
    }

    if (record.status !== EKS.PENDING) {
      await t.rollback();
      return error(res, "Only pending EKG records can be started", null, 400);
    }

    const oldStatus = record.status;

    await record.update(
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
      entity: record,
      details: { from: oldStatus, to: EKS.IN_PROGRESS },
    });

    return success(res, "EKG record started", record);
  } catch (err) {
    await t.rollback();
    return error(res, "Failed to start EKG record", err);
  }
};
/* ============================================================
   📌 COMPLETE EKG RECORD (in_progress → completed)
============================================================ */
export const completeEKGRecord = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module: MODULE_KEY,
      action: "complete",
      res,
    });
    if (!allowed) return;

    const { id } = req.params;

    const record = await EKGRecord.findOne({ where: { id }, transaction: t });
    if (!record) {
      await t.rollback();
      return error(res, "EKG record not found", null, 404);
    }

    if (record.status !== EKS.IN_PROGRESS) {
      await t.rollback();
      return error(res, "Only in-progress EKGs can be completed", null, 400);
    }

    const oldStatus = record.status;

    await record.update(
      {
        status: EKS.COMPLETED,
        updated_by_id: req.user?.id || null,
      },
      { transaction: t }
    );

    /* ================= BILLING (DUPLICATE-SAFE) ================= */
    const existing = await InvoiceItem.findOne({
      where: {
        module: MODULE_KEY,
        entity_id: record.id,
        status: "applied",
      },
      transaction: t,
    });

    if (!existing) {
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

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "complete",
      entityId: id,
      entity: record,
      details: { from: oldStatus, to: EKS.COMPLETED },
    });

    return success(res, "EKG record completed", record);
  } catch (err) {
    await t.rollback();
    return error(res, "Failed to complete EKG record", err);
  }
};

/* ============================================================
   📌 VERIFY EKG RECORD (completed → verified)
============================================================ */
export const verifyEKGRecord = async (req, res) => {
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

    const record = await EKGRecord.findOne({ where: { id }, transaction: t });
    if (!record) {
      await t.rollback();
      return error(res, "EKG record not found", null, 404);
    }

    if (record.status !== EKS.COMPLETED) {
      await t.rollback();
      return error(res, "Only completed EKGs can be verified", null, 400);
    }

    const oldStatus = record.status;

    await record.update(
      {
        status: EKS.VERIFIED,
        verified_by_id: req.user?.id || null,
        verified_at: new Date(),
        updated_by_id: req.user?.id || null,
      },
      { transaction: t }
    );

    /* ================= BILLING (DUPLICATE-SAFE) ================= */
    const existing = await InvoiceItem.findOne({
      where: {
        module: MODULE_KEY,
        entity_id: record.id,
        status: "applied",
      },
      transaction: t,
    });

    if (!existing) {
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

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "verify",
      entityId: id,
      entity: record,
      details: { from: oldStatus, to: EKS.VERIFIED },
    });

    return success(res, "EKG record verified", record);
  } catch (err) {
    await t.rollback();
    return error(res, "Failed to verify EKG record", err);
  }
};

/* ============================================================
   📌 FINALIZE EKG RECORD (verified → finalized)
============================================================ */
export const finalizeEKGRecord = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module: MODULE_KEY,
      action: "finalize",
      res,
    });
    if (!allowed) return;

    const { id } = req.params;

    const record = await EKGRecord.findOne({ where: { id }, transaction: t });
    if (!record) {
      await t.rollback();
      return error(res, "EKG record not found", null, 404);
    }

    if (record.status !== EKS.VERIFIED) {
      await t.rollback();
      return error(res, "Only verified EKGs can be finalized", null, 400);
    }

    const oldStatus = record.status;

    await record.update(
      {
        status: EKS.FINALIZED,
        finalized_by_id: req.user?.id || null,
        finalized_at: new Date(),
        updated_by_id: req.user?.id || null,
      },
      { transaction: t }
    );

    await t.commit();

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "finalize",
      entityId: id,
      entity: record,
      details: { from: oldStatus, to: EKS.FINALIZED },
    });

    return success(res, "EKG record finalized", record);
  } catch (err) {
    await t.rollback();
    return error(res, "Failed to finalize EKG record", err);
  }
};

/* ============================================================
   📌 CANCEL EKG RECORD (pending/in_progress → cancelled, MASTER-ALIGNED)
   - Permission-gated
   - Org / Facility scoped
   - Status-guarded (idempotent-safe)
   - Billing rollback (transaction-safe)
============================================================ */
export const cancelEKGRecord = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module: MODULE_KEY,
      action: "cancel",
      res,
    });
    if (!allowed) return;

    const { id } = req.params;
    const { reason } = req.body;

    const where = { id };
    const role = (req.user?.roleNames?.[0] || "staff").toLowerCase();

    if (!isSuperAdmin(req.user)) {
      where.organization_id = req.user.organization_id;
      if (role === "facility_head") {
        where.facility_id = req.user.facility_id;
      }
    }

    const record = await EKGRecord.findOne({ where, transaction: t });
    if (!record) {
      await t.rollback();
      return error(res, "EKG record not found", null, 404);
    }

    /* ================= STATUS GUARDS ================= */
    if (record.status === EKS.CANCELLED) {
      await t.rollback();
      return error(res, "EKG record is already cancelled", null, 400);
    }

    if (![EKS.PENDING, EKS.IN_PROGRESS].includes(record.status)) {
      await t.rollback();
      return error(
        res,
        "Only pending or in-progress EKGs can be cancelled",
        null,
        400
      );
    }

    const oldStatus = record.status;

    await record.update(
      {
        status: EKS.CANCELLED,
        cancel_reason: reason || null,
        cancelled_by_id: req.user?.id || null,
        updated_by_id: req.user?.id || null,
      },
      { transaction: t }
    );

    /* ================= BILLING ROLLBACK ================= */
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
      details: {
        from: oldStatus,
        to: EKS.CANCELLED,
        reason: reason || null,
      },
    });

    return success(res, "EKG record cancelled", record);
  } catch (err) {
    await t.rollback();
    return error(res, "Failed to cancel EKG record", err);
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
      if (role === "facility_head") where.facility_id = req.user.facility_id;
    }

    const record = await EKGRecord.findOne({ where, transaction: t });
    if (!record) {
      await t.rollback();
      return error(res, "EKG record not found", null, 404);
    }

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

    await record.update({ deleted_by_id: req.user?.id || null }, { transaction: t });
    await record.destroy({ transaction: t });

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

    return success(res, "EKG record deleted", full);
  } catch (err) {
    await t.rollback();
    return error(res, "Failed to delete EKG record", err);
  }
};

/* ============================================================
   📌 GET ALL EKG RECORDS LITE
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
    if (status) statusFilter = Array.isArray(status) ? status : [status];

    const where = { status: { [Op.in]: statusFilter } };

    if (!isSuperAdmin(req.user)) {
      where.organization_id = req.user.organization_id;
      if (role === "facility_head") where.facility_id = req.user.facility_id;
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

    const rows = await EKGRecord.findAll({
      where,
      attributes: ["id", "recorded_date", "rhythm", "status"],
      include: [
        { model: Patient, as: "patient", attributes: ["id", "pat_no", "first_name", "last_name"] },
        { model: Employee.unscoped(), as: "technician", attributes: ["id", "first_name", "last_name"] },
      ],
      order: [["recorded_date", "DESC"]],
      limit: 20,
    });

    const records = rows.map(r => ({
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
      details: { query: q || null, returned: records.length },
    });

    return success(res, "EKG records loaded (lite)", { records });
  } catch (err) {
    return error(res, "Failed to load EKG records (lite)", err);
  }
};

/* ============================================================
   📌 GET ALL EKG RECORDS (MASTER-ALIGNED + SUMMARY)
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

    /* ========================================================
       👁️ FIELD VISIBILITY
    ======================================================== */
    const visibleFields =
      FIELD_VISIBILITY_EKG_RECORD[role] ||
      FIELD_VISIBILITY_EKG_RECORD.staff;

    const safeFields = visibleFields.filter((f) => f !== "actions");

    /* ========================================================
       ⚙️ BASE QUERY OPTIONS
    ======================================================== */
    const options = buildQueryOptions(
      req,
      "recorded_date",
      "DESC",
      safeFields
    );

    options.where = options.where || {};

    /* ========================================================
       🧹 STRIP UI-ONLY FILTERS (CRITICAL)
    ======================================================== */
    const { dateRange } = req.query || {};
    if (dateRange) {
      delete options.where.dateRange;
    }
    delete options.filters?.light;

    /* ========================================================
       🧭 ORG / FACILITY SCOPING
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
       📅 DATE RANGE FILTER (MASTER PATTERN)
    ======================================================== */
    if (dateRange) {
      const range = normalizeDateRangeLocal(dateRange);
      if (range) {
        options.where.recorded_date = {
          [Op.between]: [range.start, range.end],
        };
      }
    }

    /* ========================================================
       🔍 GLOBAL SEARCH (ADDITIVE)
    ======================================================== */
    if (options.search) {
      options.where[Op.or] = [
        { rhythm: { [Op.iLike]: `%${options.search}%` } },
        { interpretation: { [Op.iLike]: `%${options.search}%` } },
        { recommendation: { [Op.iLike]: `%${options.search}%` } },
      ];
    }

    /* ========================================================
       🔍 EXTRA FILTERS
    ======================================================== */
    if (req.query.patient_id) {
      options.where.patient_id = req.query.patient_id;
    }
    if (req.query.consultation_id) {
      options.where.consultation_id = req.query.consultation_id;
    }
    if (req.query.registration_log_id) {
      options.where.registration_log_id = req.query.registration_log_id;
    }
    if (req.query.technician_id) {
      options.where.technician_id = req.query.technician_id;
    }
    if (req.query.status) {
      const statuses = Array.isArray(req.query.status)
        ? req.query.status
        : [req.query.status];
      options.where.status = { [Op.in]: statuses };
    }

    /* ========================================================
       📦 QUERY
    ======================================================== */
    const { count, rows } = await EKGRecord.findAndCountAll({
      where: options.where,
      include: [...EKG_INCLUDES, ...(options.include || [])],
      order: options.order,
      offset: options.offset,
      limit: options.limit,
    });

    /* ========================================================
       📊 SUMMARY (STATUS-BASED, PAGE-AWARE)
    ======================================================== */
    const summary = { total: count };
    EKG_STATUS.forEach((status) => {
      summary[status] = rows.filter((r) => r.status === status).length;
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
        pagination: options.pagination,
      },
    });

    return success(res, "EKG records loaded", {
      records: rows,
      summary,
      pagination: {
        total: count,
        page: options.pagination.page,
        pageCount: Math.ceil(count / options.pagination.limit),
      },
    });
  } catch (err) {
    return error(res, "Failed to load EKG records", err);
  }
};

/* ============================================================
   📌 GET EKG RECORD BY ID (MASTER-ALIGNED)
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

    if (!record) {
      return error(res, "EKG record not found", null, 404);
    }

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "view",
      entityId: id,
      entity: record,
    });

    return success(res, "EKG record loaded", record);
  } catch (err) {
    return error(res, "Failed to load EKG record", err);
  }
};
