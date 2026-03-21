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

const MODULE_KEY = "ekg_records";

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
   📋 JOI SCHEMA (MASTER – TENANT SAFE, REGISTRATION PARITY)
============================================================ */
function buildEKGSchema(mode = "create") {
  const base = {
    patient_id: Joi.string().uuid().required(),
    consultation_id: Joi.string().uuid().allow(null, ""),
    registration_log_id: Joi.string().uuid().allow(null, ""),
    invoice_id: Joi.string().uuid().allow(null),
    billable_item_id: Joi.string().uuid().allow(null, ""),
    technician_id: Joi.string().uuid().allow(null, ""),

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

    // 🔒 TENANT + LIFECYCLE CONTROL (BACKEND ONLY)
    organization_id: Joi.forbidden(),
    facility_id: Joi.forbidden(),
    status: Joi.forbidden(),
  };

  if (mode === "update") {
    Object.keys(base).forEach((k) => {
      base[k] = base[k].optional();
    });
  }

  return Joi.object(base);
}

/* ============================================================
   📌 CREATE EKG RECORD — MASTER PARITY
============================================================ */
export const createEKGRecord = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module_key: MODULE_KEY,
      action: "create",
      res,
    });
    if (!allowed) return;

    /* ================= VALIDATION (MASTER) ================= */
    const { value, errors } = validate(
      buildEKGSchema("create"),
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

    /* ================= CLINICAL AUTO-LINK ================= */
    value._currentUser = req.user;
    await resolveClinicalLinks(value, orgId, facilityId, t);

    /* ================= CREATE ================= */
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

    const full = await EKGRecord.findByPk(created.id, {
      include: EKG_INCLUDES,
    });

    /* ================= AUDIT ================= */
    await auditService.logAction({
      user: req.user,
      module_key: MODULE_KEY,
      action: "create",
      entityId: created.id,
      entity: full,
      details: value,
    });

    return success(res, "✅ EKG record created", full);
  } catch (err) {
    await t.rollback();
    debug.error("create → FAILED", err);
    return error(res, "❌ Failed to create EKG record", err);
  }
};


/* ============================================================
   📌 UPDATE EKG RECORD — MASTER PARITY
   - Tenant-safe
   - Locks finalized/voided
============================================================ */
export const updateEKGRecord = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module_key: MODULE_KEY,
      action: "update",
      res,
    });
    if (!allowed) return;

    const { id } = req.params;

    /* ================= VALIDATION (MASTER) ================= */
    const { value, errors } = validate(
      buildEKGSchema("update"),
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

    /* ================= FETCH (TENANT-SAFE) ================= */
    const record = await EKGRecord.findOne({
      where: {
        id,
        organization_id: orgId,
        ...(facilityId && { facility_id: facilityId }),
      },
      transaction: t,
    });

    if (!record) {
      await t.rollback();
      return error(res, "❌ EKG record not found", null, 404);
    }

    /* ================= LOCK FINAL STATES ================= */
    if ([EKS.FINALIZED, EKS.VOIDED].includes(record.status)) {
      await t.rollback();
      return error(
        res,
        "❌ Finalized or voided EKG records cannot be modified",
        null,
        400
      );
    }

    /* ================= CLINICAL AUTO-LINK ================= */
    value._currentUser = req.user;
    await resolveClinicalLinks(value, orgId, facilityId, t);

    /* ================= UPDATE ================= */
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

    const full = await EKGRecord.findByPk(id, {
      include: EKG_INCLUDES,
    });

    /* ================= AUDIT ================= */
    await auditService.logAction({
      user: req.user,
      module_key: MODULE_KEY,
      action: "update",
      entityId: id,
      entity: full,
      details: value,
    });

    return success(res, "✅ EKG record updated", full);
  } catch (err) {
    await t.rollback();
    debug.error("update → FAILED", err);
    return error(res, "❌ Failed to update EKG record", err);
  }
};
/* ============================================================
   📌 VOID EKG RECORD — MASTER PARITY
============================================================ */
export const voidEKGRecord = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module_key: MODULE_KEY,
      action: "update",
      res,
    });
    if (!allowed) return;

    const { id } = req.params;
    const { reason } = req.body;

    /* ================= TENANT RESOLUTION ================= */
    const { orgId, facilityId } = await resolveOrgFacility({
      user: req.user,
      value: {},
      body: {},
    });

    const record = await EKGRecord.findOne({
      where: {
        id,
        organization_id: orgId,
        ...(facilityId && { facility_id: facilityId }),
      },
      transaction: t,
    });

    if (!record) {
      await t.rollback();
      return error(res, "❌ EKG record not found", null, 404);
    }

    if (record.status === EKS.VOIDED) {
      await t.rollback();
      return error(res, "❌ EKG already voided", null, 400);
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
      module_key: MODULE_KEY,
      entityId: record.id,
      user: { ...req.user, organization_id: orgId, facility_id: facilityId },
      transaction: t,
    });

    await t.commit();

    await auditService.logAction({
      user: req.user,
      module_key: MODULE_KEY,
      action: "void",
      entityId: id,
      entity: record,
      details: { from: oldStatus, to: EKS.VOIDED, reason },
    });

    return success(res, "✅ EKG record voided", record);
  } catch (err) {
    await t.rollback();
    return error(res, "❌ Failed to void EKG record", err);
  }
};


/* ============================================================
   📌 START EKG RECORD — MASTER PARITY (BILLING POINT)
============================================================ */
export const startEKGRecord = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module_key: MODULE_KEY,
      action: "update",
      res,
    });
    if (!allowed) return;

    const { id } = req.params;

    const { orgId, facilityId } = await resolveOrgFacility({
      user: req.user,
      value: {},
      body: {},
    });

    const record = await EKGRecord.findOne({
      where: {
        id,
        organization_id: orgId,
        ...(facilityId && { facility_id: facilityId }),
      },
      transaction: t,
    });

    if (!record) {
      await t.rollback();
      return error(res, "❌ EKG record not found", null, 404);
    }

    if (record.status !== EKS.PENDING) {
      await t.rollback();
      return error(res, "❌ Only pending EKG can be started", null, 400);
    }

    const oldStatus = record.status;

    /* ================= UPDATE ================= */
    await record.update(
      {
        status: EKS.IN_PROGRESS,
        updated_by_id: req.user?.id || null,
      },
      { transaction: t }
    );

    /* 🔥 CRITICAL FIX — ENSURE UPDATED STATE */
    await record.reload({ transaction: t });

    /* ================= BILLING (MASTER PARITY) ================= */
    await billingService.triggerAutoBilling({
      module_key: MODULE_KEY,
      entity: {
        ...record.toJSON(),
        billable_item_id:
          record.billable_item_id ||
          record.billableItem?.id ||
          null,
      },
      user: {
        ...req.user,
        organization_id: orgId,
        facility_id: facilityId,
      },
      transaction: t,
    });

    await t.commit();

    await auditService.logAction({
      user: req.user,
      module_key: MODULE_KEY,
      action: "start",
      entityId: id,
      entity: record,
      details: { from: oldStatus, to: EKS.IN_PROGRESS },
    });

    return success(res, "✅ EKG record started", record);
  } catch (err) {
    await t.rollback();
    return error(res, "❌ Failed to start EKG record", err);
  }
};
/* ============================================================
   📌 COMPLETE EKG RECORD — MASTER PARITY
   (NO BILLING — billing happens at VERIFY)
============================================================ */
export const completeEKGRecord = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module_key: MODULE_KEY,
      action: "update",
      res,
    });
    if (!allowed) return;

    const { id } = req.params;

    const { orgId, facilityId } = await resolveOrgFacility({
      user: req.user,
      value: {},
      body: {},
    });

    const record = await EKGRecord.findOne({
      where: {
        id,
        organization_id: orgId,
        ...(facilityId && { facility_id: facilityId }),
      },
      transaction: t,
    });

    if (!record) {
      await t.rollback();
      return error(res, "❌ EKG record not found", null, 404);
    }

    if (record.status !== EKS.IN_PROGRESS) {
      await t.rollback();
      return error(res, "❌ Only in-progress EKG can be completed", null, 400);
    }

    const oldStatus = record.status;

    await record.update(
      {
        status: EKS.COMPLETED,
        updated_by_id: req.user?.id || null,
      },
      { transaction: t }
    );

    await t.commit();

    await auditService.logAction({
      user: req.user,
      module_key: MODULE_KEY,
      action: "complete",
      entityId: id,
      entity: record,
      details: { from: oldStatus, to: EKS.COMPLETED },
    });

    return success(res, "✅ EKG record completed", record);
  } catch (err) {
    await t.rollback();
    return error(res, "❌ Failed to complete EKG record", err);
  }
};

/* ============================================================
   📌 VERIFY EKG RECORD — MASTER PARITY (NO BILLING)
============================================================ */
export const verifyEKGRecord = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module_key: MODULE_KEY,
      action: "update",
      res,
    });
    if (!allowed) return;

    const { id } = req.params;

    /* ================= TENANT RESOLUTION ================= */
    const { orgId, facilityId } = await resolveOrgFacility({
      user: req.user,
      value: {},
      body: {},
    });

    const record = await EKGRecord.findOne({
      where: {
        id,
        organization_id: orgId,
        ...(facilityId && { facility_id: facilityId }),
      },
      transaction: t,
    });

    if (!record) {
      await t.rollback();
      return error(res, "❌ EKG record not found", null, 404);
    }

    if (record.status !== EKS.COMPLETED) {
      await t.rollback();
      return error(res, "❌ Only completed EKG can be verified", null, 400);
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

    await t.commit();

    /* ================= AUDIT ================= */
    await auditService.logAction({
      user: req.user,
      module_key: MODULE_KEY,
      action: "verify",
      entityId: id,
      entity: record,
      details: { from: oldStatus, to: EKS.VERIFIED },
    });

    return success(res, "✅ EKG record verified", record);
  } catch (err) {
    await t.rollback();
    return error(res, "❌ Failed to verify EKG record", err);
  }
};

/* ============================================================
   📌 FINALIZE EKG RECORD — MASTER PARITY
============================================================ */
export const finalizeEKGRecord = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module_key: MODULE_KEY,
      action: "update",
      res,
    });
    if (!allowed) return;

    const { id } = req.params;

    const { orgId, facilityId } = await resolveOrgFacility({
      user: req.user,
      value: {},
      body: {},
    });

    const record = await EKGRecord.findOne({
      where: {
        id,
        organization_id: orgId,
        ...(facilityId && { facility_id: facilityId }),
      },
      transaction: t,
    });

    if (!record) {
      await t.rollback();
      return error(res, "❌ EKG record not found", null, 404);
    }

    if (record.status !== EKS.VERIFIED) {
      await t.rollback();
      return error(res, "❌ Only verified EKG can be finalized", null, 400);
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
      module_key: MODULE_KEY,
      action: "finalize",
      entityId: id,
      entity: record,
      details: { from: oldStatus, to: EKS.FINALIZED },
    });

    return success(res, "✅ EKG record finalized", record);
  } catch (err) {
    await t.rollback();
    return error(res, "❌ Failed to finalize EKG record", err);
  }
};


/* ============================================================
   📌 CANCEL EKG RECORD — MASTER PARITY
============================================================ */
export const cancelEKGRecord = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module_key: MODULE_KEY,
      action: "update",
      res,
    });
    if (!allowed) return;

    const { id } = req.params;
    const { reason } = req.body;

    /* ================= TENANT RESOLUTION ================= */
    const { orgId, facilityId } = await resolveOrgFacility({
      user: req.user,
      value: {},
      body: {},
    });

    const record = await EKGRecord.findOne({
      where: {
        id,
        organization_id: orgId,
        ...(facilityId && { facility_id: facilityId }),
      },
      transaction: t,
    });

    if (!record) {
      await t.rollback();
      return error(res, "❌ EKG record not found", null, 404);
    }

    if (![EKS.PENDING, EKS.IN_PROGRESS].includes(record.status)) {
      await t.rollback();
      return error(
        res,
        "❌ Only pending or in-progress EKG can be cancelled",
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
      module_key: MODULE_KEY,
      entityId: record.id,
      user: { ...req.user, organization_id: orgId, facility_id: facilityId },
      transaction: t,
    });

    await t.commit();

    await auditService.logAction({
      user: req.user,
      module_key: MODULE_KEY,
      action: "cancel",
      entityId: id,
      entity: record,
      details: { from: oldStatus, to: EKS.CANCELLED, reason },
    });

    return success(res, "✅ EKG record cancelled", record);
  } catch (err) {
    await t.rollback();
    return error(res, "❌ Failed to cancel EKG record", err);
  }
};

/* ============================================================
   📌 DELETE EKG RECORD — MASTER PARITY
============================================================ */
export const deleteEKGRecord = async (req, res) => {
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

    const { orgId, facilityId } = await resolveOrgFacility({
      user: req.user,
      value: {},
      body: {},
    });

    const record = await EKGRecord.findOne({
      where: {
        id,
        organization_id: orgId,
        ...(facilityId && { facility_id: facilityId }),
      },
      transaction: t,
    });

    if (!record) {
      await t.rollback();
      return error(res, "❌ EKG record not found", null, 404);
    }

    /* ================= BILLING ROLLBACK ================= */
    await billingService.voidCharges({
      module_key: MODULE_KEY,
      entityId: record.id,
      user: { ...req.user, organization_id: orgId, facility_id: facilityId },
      transaction: t,
    });

    await record.update(
      { deleted_by_id: req.user?.id || null },
      { transaction: t }
    );
    await record.destroy({ transaction: t });

    await t.commit();

    const full = await EKGRecord.findByPk(id, {
      include: EKG_INCLUDES,
      paranoid: false,
    });

    await auditService.logAction({
      user: req.user,
      module_key: MODULE_KEY,
      action: "delete",
      entityId: id,
      entity: full,
    });

    return success(res, "✅ EKG record deleted", full);
  } catch (err) {
    await t.rollback();
    return error(res, "❌ Failed to delete EKG record", err);
  }
};


/* ============================================================
   📌 GET ALL EKG RECORDS — MASTER PARITY (FINAL)
============================================================ */
export const getAllEKGRecords = async (req, res) => {
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module_key: MODULE_KEY,
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
       ⚙️ BASE QUERY OPTIONS (MASTER)
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
       🧭 ORG / FACILITY SCOPING (MASTER)
    ======================================================== */
    if (!isSuperAdmin(req.user)) {
      options.where.organization_id = req.user.organization_id;

      if (role === "facilityhead") {
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
       🔍 GLOBAL SEARCH (MASTER)
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
      distinct: true,
    });

    /* ========================================================
       📊 SUMMARY (DB LEVEL — MASTER)
    ======================================================== */
    const summary = { total: count };

    const statusCounts = await EKGRecord.findAll({
      where: options.where,
      attributes: [
        "status",
        [sequelize.fn("COUNT", sequelize.col("id")), "count"],
      ],
      group: ["status"],
    });

    EKG_STATUS.forEach((s) => {
      const found = statusCounts.find((r) => r.status === s);
      summary[s] = found ? Number(found.get("count")) : 0;
    });

    /* ========================================================
       🧾 AUDIT
    ======================================================== */
    await auditService.logAction({
      user: req.user,
      module_key: MODULE_KEY,
      action: "list",
      details: {
        query: req.query,
        returned: count,
        pagination: options.pagination,
      },
    });

    return success(res, "✅ EKG records loaded", {
      records: rows,
      summary,
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
   📌 GET ALL EKG RECORDS LITE — MASTER PARITY (FINAL)
============================================================ */
export const getAllEKGRecordsLite = async (req, res) => {
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module_key: MODULE_KEY,
      action: "read",
      res,
    });
    if (!allowed) return;

    const { q } = req.query;

    /* ================= STATUS (MASTER) ================= */
    let statusFilter = [EKS.PENDING, EKS.IN_PROGRESS];

    /* ================= TENANT RESOLUTION ================= */
    const { orgId, facilityId } = await resolveOrgFacility({
      user: req.user,
      value: {},
      body: {},
    });

    /* ================= WHERE ================= */
    const where = {
      status: { [Op.in]: statusFilter },
      organization_id: orgId,
      ...(facilityId && { facility_id: facilityId }),
    };

    /* ================= SEARCH ================= */
    if (q) {
      where[Op.or] = [
        { rhythm: { [Op.iLike]: `%${q}%` } },
        { interpretation: { [Op.iLike]: `%${q}%` } },
        { recommendation: { [Op.iLike]: `%${q}%` } },
      ];
    }

    /* ================= QUERY ================= */
    const rows = await EKGRecord.findAll({
      where,
      attributes: ["id", "recorded_date", "rhythm"],
      include: [
        {
          model: Patient,
          as: "patient",
          attributes: ["id", "pat_no", "first_name", "last_name"],
        },
        {
          model: Employee.unscoped(),
          as: "technician",
          attributes: ["id", "first_name", "last_name"],
        },
      ],
      order: [["recorded_date", "DESC"]],
      limit: 20,
    });

    /* ================= FORMAT ================= */
    const records = rows.map((r) => ({
      id: r.id,
      label: `${new Date(r.recorded_date).toLocaleDateString()} · ${
        r.patient
          ? `${r.patient.pat_no} - ${r.patient.first_name} ${r.patient.last_name}`
          : ""
      } · ${r.rhythm || "EKG"}`,
    }));

    /* ================= AUDIT ================= */
    await auditService.logAction({
      user: req.user,
      module_key: MODULE_KEY,
      action: "list_lite",
      details: {
        count: records.length,
        query: q || null,
      },
    });

    return success(res, "✅ EKG records loaded (lite)", { records });
  } catch (err) {
    return error(res, "❌ Failed to load EKG records (lite)", err);
  }
};

/* ============================================================
   📌 GET EKG RECORD BY ID — MASTER PARITY
============================================================ */
export const getEKGRecordById = async (req, res) => {
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module_key: MODULE_KEY,
      action: "read",
      res,
    });
    if (!allowed) return;

    const { id } = req.params;

    /* ================= TENANT RESOLUTION (FIXED) ================= */
    const { orgId, facilityId } = await resolveOrgFacility({
      user: req.user,
      value: {},
      body: {},
    });

    const where = {
      id,
      organization_id: orgId,
      ...(facilityId && { facility_id: facilityId }),
    };

    const record = await EKGRecord.findOne({
      where,
      include: EKG_INCLUDES,
    });

    if (!record) {
      return error(res, "❌ EKG record not found", null, 404);
    }

    await auditService.logAction({
      user: req.user,
      module_key: MODULE_KEY,
      action: "view",
      entityId: id,
      entity: record,
    });

    return success(res, "✅ EKG record loaded", record);
  } catch (err) {
    return error(res, "❌ Failed to load EKG record", err);
  }
};