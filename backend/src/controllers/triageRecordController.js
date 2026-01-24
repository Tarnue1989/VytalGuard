// 📁 controllers/triageRecordController.js
// ============================================================================
// 🔹 ENTERPRISE MASTER – PART 1 (Imports + Constants)
// 🔹 Drop-in replacement
// ============================================================================

import Joi from "joi";
import { Op } from "sequelize";
import {
  sequelize,
  TriageRecord,
  Patient,
  Employee,
  RegistrationLog,
  InvoiceItem,
  User,
  Organization,
  Facility,
} from "../models/index.js";

import { success, error } from "../utils/response.js";
import { buildQueryOptions } from "../utils/queryHelper.js";
import { TRIAGE_STATUS, REGISTRATION_LOG_STATUS } from "../constants/enums.js";
import { authzService } from "../services/authzService.js";
import { auditService } from "../services/auditService.js";
import { FIELD_VISIBILITY_TRIAGE_RECORD } from "../constants/fieldVisibility.js";
import { billingService } from "../services/billingService.js";

import { resolveOrgFacility } from "../utils/resolveOrgFacility.js";
import { validate } from "../utils/validation.js";
import { isSuperAdmin } from "../utils/role-utils.js";
import { normalizeDateRangeLocal } from "../utils/date-utils.js";
import { makeModuleLogger } from "../utils/debugLogger.js";

/* ============================================================
   🔧 LOCAL DEBUG OVERRIDE
============================================================ */
const DEBUG_OVERRIDE = false;
const debug = makeModuleLogger("triageRecordController", DEBUG_OVERRIDE);

/* ============================================================
   🔑 MODULE KEY (MASTER-ALIGNED)
============================================================ */
const MODULE_KEY = "triage_record";

/* ============================================================
   🔖 STATUS MAP (ENUM-DRIVEN)
============================================================ */
const TS = {
  OPEN: TRIAGE_STATUS[0],
  IN_PROGRESS: TRIAGE_STATUS[1],
  COMPLETED: TRIAGE_STATUS[2],
  VERIFIED: TRIAGE_STATUS[3],
  CANCELLED: TRIAGE_STATUS[4],
  VOIDED: TRIAGE_STATUS[5],
};

/* ============================================================
   🔗 SHARED INCLUDES (MASTER-ALIGNED)
============================================================ */
const TRIAGE_INCLUDES = [
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
    as: "nurse",
    attributes: ["id", "first_name", "last_name"],
  },
  {
    model: RegistrationLog,
    as: "registrationLog",
    attributes: ["id", "registration_time", "log_status"],
  },
  { model: Organization, as: "organization", attributes: ["id", "name", "code"] },
  {
    model: Facility,
    as: "facility",
    attributes: ["id", "name", "code", "organization_id"],
  },
  { model: User, as: "createdBy", attributes: ["id", "first_name", "last_name"] },
  { model: User, as: "updatedBy", attributes: ["id", "first_name", "last_name"] },
  { model: User, as: "deletedBy", attributes: ["id", "first_name", "last_name"] },
];

/* ============================================================
   📋 JOI SCHEMA (MASTER-ALIGNED)
============================================================ */
function buildTriageSchema(user, mode = "create") {
  const base = {
    patient_id: Joi.string().uuid().required(),
    doctor_id: Joi.string().uuid().allow("", null),
    nurse_id: Joi.string().uuid().allow("", null),
    registration_log_id: Joi.string().uuid().allow("", null),
    triage_type_id: Joi.string().uuid().allow("", null),

    symptoms: Joi.string().allow("", null),
    triage_notes: Joi.string().allow("", null),
    bp: Joi.string().allow("", null),
    pulse: Joi.number().allow(null),
    rr: Joi.number().allow(null),
    temp: Joi.number().allow(null),
    oxygen: Joi.number().allow(null),
    weight: Joi.number().allow(null),
    height: Joi.number().allow(null),
    rbg: Joi.number().allow(null),
    pain_score: Joi.number().min(0).max(10).allow(null),
    position: Joi.string().allow("", null),

    recorded_at: Joi.date().required(),

    // 🔒 tenant fields controlled centrally
    organization_id: Joi.forbidden(),
    facility_id: Joi.forbidden(),
  };

  if (mode === "update") {
    Object.keys(base).forEach((k) => {
      base[k] = base[k].optional();
    });
  }

  // 🟢 Superadmin override
  if (isSuperAdmin(user)) {
    base.organization_id = Joi.string().uuid().allow("", null);
    base.facility_id = Joi.string().uuid().allow("", null);
  }

  return Joi.object(base);
}
/* ============================================================
   📌 CREATE TRIAGE RECORD (MASTER-ALIGNED)
============================================================ */
export const createTriageRecord = async (req, res) => {
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
      buildTriageSchema(req.user, "create"),
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

    // 🔗 Auto-link RegistrationLog
    if (!value.registration_log_id && value.patient_id) {
      const latestReg = await RegistrationLog.findOne({
        where: {
          patient_id: value.patient_id,
          organization_id: orgId,
          facility_id: facilityId,
          log_status: { [Op.in]: [REGISTRATION_LOG_STATUS[1], REGISTRATION_LOG_STATUS[2]] },
        },
        order: [["created_at", "DESC"]],
        transaction: t,
      });
      if (latestReg) value.registration_log_id = latestReg.id;
    }

    const created = await TriageRecord.create(
      {
        ...value,
        triage_status: TS.OPEN,
        organization_id: orgId,
        facility_id: facilityId,
        created_by_id: req.user?.id || null,
      },
      { transaction: t }
    );

    await t.commit();

    const full = await TriageRecord.findOne({
      where: { id: created.id },
      include: TRIAGE_INCLUDES,
    });

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "create",
      entityId: created.id,
      entity: full,
    });

    return success(res, "Triage record created", full);
  } catch (err) {
    await t.rollback();
    return error(res, "Failed to create triage record", err);
  }
};

/* ============================================================
   📌 UPDATE TRIAGE RECORD (LOCKED STATES)
============================================================ */
export const updateTriageRecord = async (req, res) => {
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
      buildTriageSchema(req.user, "update"),
      req.body
    );
    if (errors) {
      await t.rollback();
      return error(res, "Validation failed", errors, 400);
    }

    const record = await TriageRecord.findOne({ where: { id }, transaction: t });
    if (!record) {
      await t.rollback();
      return error(res, "Triage record not found", null, 404);
    }

    if ([TS.VERIFIED, TS.VOIDED].includes(record.triage_status)) {
      await t.rollback();
      return error(
        res,
        "Verified or voided triage records cannot be modified",
        null,
        400
      );
    }

    const { orgId, facilityId } = resolveOrgFacility({
      user: req.user,
      value,
      body: req.body,
    });

    // 🔗 Re-link RegistrationLog
    if (!value.registration_log_id && value.patient_id) {
      const latestReg = await RegistrationLog.findOne({
        where: {
          patient_id: value.patient_id,
          organization_id: orgId,
          facility_id: facilityId,
          log_status: { [Op.in]: [REGISTRATION_LOG_STATUS[1], REGISTRATION_LOG_STATUS[2]] },
        },
        order: [["created_at", "DESC"]],
        transaction: t,
      });
      if (latestReg) value.registration_log_id = latestReg.id;
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

    const full = await TriageRecord.findOne({
      where: { id },
      include: TRIAGE_INCLUDES,
    });

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "update",
      entityId: id,
      entity: full,
    });

    return success(res, "Triage record updated", full);
  } catch (err) {
    await t.rollback();
    return error(res, "Failed to update triage record", err);
  }
};

/* ============================================================
   📌 START TRIAGE (open → in_progress)
============================================================ */
export const startTriageRecord = async (req, res) => {
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

    const record = await TriageRecord.findOne({ where: { id }, transaction: t });
    if (!record) {
      await t.rollback();
      return error(res, "Triage record not found", null, 404);
    }

    if (record.triage_status !== TS.OPEN) {
      await t.rollback();
      return error(res, "Only open triage records can be started", null, 400);
    }

    const oldStatus = record.triage_status;

    await record.update(
      { triage_status: TS.IN_PROGRESS, updated_by_id: req.user?.id || null },
      { transaction: t }
    );

    await t.commit();

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "start",
      entityId: id,
      entity: record,
      details: { from: oldStatus, to: TS.IN_PROGRESS },
    });

    return success(res, "Triage started", record);
  } catch (err) {
    await t.rollback();
    return error(res, "Failed to start triage record", err);
  }
};

/* ============================================================
   📌 COMPLETE TRIAGE (in_progress → completed)
============================================================ */
export const completeTriageRecord = async (req, res) => {
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

    const record = await TriageRecord.findOne({ where: { id }, transaction: t });
    if (!record) {
      await t.rollback();
      return error(res, "Triage record not found", null, 404);
    }

    if (record.triage_status !== TS.IN_PROGRESS) {
      await t.rollback();
      return error(res, "Only in-progress triage records can be completed", null, 400);
    }

    const oldStatus = record.triage_status;

    await record.update(
      { triage_status: TS.COMPLETED, updated_by_id: req.user?.id || null },
      { transaction: t }
    );

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
      details: { from: oldStatus, to: TS.COMPLETED },
    });

    return success(res, "Triage completed", record);
  } catch (err) {
    await t.rollback();
    return error(res, "Failed to complete triage record", err);
  }
};

/* ============================================================
   📌 CANCEL TRIAGE (open/in_progress → cancelled)
============================================================ */
export const cancelTriageRecord = async (req, res) => {
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

    const record = await TriageRecord.findOne({ where: { id }, transaction: t });
    if (!record) {
      await t.rollback();
      return error(res, "Triage record not found", null, 404);
    }

    if (![TS.OPEN, TS.IN_PROGRESS].includes(record.triage_status)) {
      await t.rollback();
      return error(
        res,
        "Only open or in-progress triage records can be cancelled",
        null,
        400
      );
    }

    const oldStatus = record.triage_status;

    await record.update(
      {
        triage_status: TS.CANCELLED,
        cancel_reason: reason || null,
        cancelled_by_id: req.user?.id || null,
        updated_by_id: req.user?.id || null,
      },
      { transaction: t }
    );

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
      details: { from: oldStatus, to: TS.CANCELLED, reason: reason || null },
    });

    return success(res, "Triage cancelled", record);
  } catch (err) {
    await t.rollback();
    return error(res, "Failed to cancel triage record", err);
  }
};

/* ============================================================
   📌 VOID TRIAGE (any → voided, MASTER-ALIGNED)
============================================================ */
export const voidTriageRecord = async (req, res) => {
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

    const record = await TriageRecord.findOne({ where, transaction: t });
    if (!record) {
      await t.rollback();
      return error(res, "Triage record not found", null, 404);
    }

    if (record.triage_status === TS.VOIDED) {
      await t.rollback();
      return error(res, "Triage record already voided", null, 400);
    }

    const oldStatus = record.triage_status;

    await record.update(
      {
        triage_status: TS.VOIDED,
        void_reason: reason || null,
        voided_by_id: req.user?.id || null,
        updated_by_id: req.user?.id || null,
      },
      { transaction: t }
    );

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
      details: { from: oldStatus, to: TS.VOIDED, reason: reason || null },
    });

    return success(res, "Triage record voided", record);
  } catch (err) {
    await t.rollback();
    return error(res, "Failed to void triage record", err);
  }
};

/* ============================================================
   📌 VERIFY TRIAGE (completed → verified, MASTER-ALIGNED)
============================================================ */
export const verifyTriageRecord = async (req, res) => {
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

    const record = await TriageRecord.findOne({ where: { id }, transaction: t });
    if (!record) {
      await t.rollback();
      return error(res, "Triage record not found", null, 404);
    }

    if (record.triage_status !== TS.COMPLETED) {
      await t.rollback();
      return error(res, "Only completed triage records can be verified", null, 400);
    }

    const oldStatus = record.triage_status;

    await record.update(
      {
        triage_status: TS.VERIFIED,
        verified_by_id: req.user?.id || null,
        verified_at: new Date(),
        updated_by_id: req.user?.id || null,
      },
      { transaction: t }
    );

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
      details: { from: oldStatus, to: TS.VERIFIED },
    });

    return success(res, "Triage record verified", record);
  } catch (err) {
    await t.rollback();
    return error(res, "Failed to verify triage record", err);
  }
};

/* ============================================================
   📌 DELETE TRIAGE RECORD (Soft Delete + Billing Rollback)
============================================================ */
export const deleteTriageRecord = async (req, res) => {
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

    const record = await TriageRecord.findOne({ where, transaction: t });
    if (!record) {
      await t.rollback();
      return error(res, "Triage record not found", null, 404);
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

    await record.update(
      { deleted_by_id: req.user?.id || null },
      { transaction: t }
    );
    await record.destroy({ transaction: t });

    await t.commit();

    const full = await TriageRecord.findOne({
      where: { id },
      include: TRIAGE_INCLUDES,
      paranoid: false,
    });

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "delete",
      entityId: id,
      entity: full,
    });

    return success(res, "Triage record deleted", full);
  } catch (err) {
    await t.rollback();
    return error(res, "Failed to delete triage record", err);
  }
};

/* ============================================================
   📌 GET ALL TRIAGE RECORDS LITE (MASTER-ALIGNED)
============================================================ */
export const getAllTriageRecordsLite = async (req, res) => {
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module: MODULE_KEY,
      action: "read",
      res,
    });
    if (!allowed) return;

    const { q, triage_status } = req.query;

    let statusFilter = [TS.OPEN, TS.IN_PROGRESS];
    if (triage_status) {
      statusFilter = Array.isArray(triage_status)
        ? triage_status
        : [triage_status];
    }

    const where = { triage_status: { [Op.in]: statusFilter } };

    if (!isSuperAdmin(req.user)) {
      where.organization_id = req.user.organization_id;
      if (req.user.facility_id) where.facility_id = req.user.facility_id;
    }

    if (q) {
      where[Op.or] = [
        { symptoms: { [Op.iLike]: `%${q}%` } },
        { triage_notes: { [Op.iLike]: `%${q}%` } },
      ];
    }

    const rows = await TriageRecord.findAll({
      where,
      attributes: ["id", "recorded_at", "symptoms", "triage_status"],
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
          as: "nurse",
          attributes: ["id", "first_name", "last_name"],
        },
      ],
      order: [["recorded_at", "DESC"]],
      limit: 20,
    });

    const records = rows.map((r) => ({
      id: r.id,
      patient: r.patient
        ? `${r.patient.pat_no} - ${r.patient.first_name} ${r.patient.last_name}`
        : "",
      doctor: r.doctor ? `${r.doctor.first_name} ${r.doctor.last_name}` : "",
      nurse: r.nurse ? `${r.nurse.first_name} ${r.nurse.last_name}` : "",
      symptoms: r.symptoms || "",
      date: r.recorded_at,
      status: r.triage_status,
    }));

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "list_lite",
      details: { query: q || null, returned: records.length },
    });

    return success(res, "Triage records loaded (lite)", { records });
  } catch (err) {
    return error(res, "Failed to load triage records (lite)", err);
  }
};
/* ============================================================
   📌 GET ALL TRIAGE RECORDS (MASTER-ALIGNED + DATE RANGE)
============================================================ */
export const getAllTriageRecords = async (req, res) => {
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
      FIELD_VISIBILITY_TRIAGE_RECORD[role] ||
      FIELD_VISIBILITY_TRIAGE_RECORD.staff;

    const safeFields = visibleFields.filter((f) => f !== "actions");

    /* ========================================================
       ⚙️ BASE QUERY OPTIONS
    ======================================================== */
    const options = buildQueryOptions(
      req,
      "recorded_at",
      "DESC",
      safeFields
    );
    options.where = options.where || {};

    /* ========================================================
       🧹 STRIP UI-ONLY FILTERS
    ======================================================== */
    const { dateRange } = req.query || {};
    if (dateRange) delete options.where.dateRange;
    delete options.filters?.light;

    /* ========================================================
       🧭 ORG / FACILITY SCOPING
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
       📅 DATE RANGE FILTER (MASTER)
    ======================================================== */
    if (dateRange) {
      const range = normalizeDateRangeLocal(dateRange);
      if (range) {
        options.where.recorded_at = {
          [Op.between]: [range.start, range.end],
        };
      }
    }

    /* ========================================================
       🔍 GLOBAL SEARCH
    ======================================================== */
    if (options.search) {
      options.where[Op.or] = [
        { symptoms: { [Op.iLike]: `%${options.search}%` } },
        { triage_notes: { [Op.iLike]: `%${options.search}%` } },
      ];
    }

    /* ========================================================
       🔍 EXTRA FILTERS
    ======================================================== */
    if (req.query.patient_id) options.where.patient_id = req.query.patient_id;
    if (req.query.doctor_id) options.where.doctor_id = req.query.doctor_id;
    if (req.query.nurse_id) options.where.nurse_id = req.query.nurse_id;
    if (req.query.registration_log_id) {
      options.where.registration_log_id = req.query.registration_log_id;
    }
    if (req.query.triage_type_id) {
      options.where.triage_type_id = req.query.triage_type_id;
    }
    if (req.query.triage_status) {
      const statuses = Array.isArray(req.query.triage_status)
        ? req.query.triage_status
        : [req.query.triage_status];
      options.where.triage_status = { [Op.in]: statuses };
    }

    /* ========================================================
       📦 QUERY
    ======================================================== */
    const { count, rows } = await TriageRecord.findAndCountAll({
      where: options.where,
      include: [...TRIAGE_INCLUDES, ...(options.include || [])],
      order: options.order,
      offset: options.offset,
      limit: options.limit,
    });

    /* ========================================================
       📊 SUMMARY (STATUS-BASED, PAGE-AWARE)
    ======================================================== */
    const summary = { total: count };
    TRIAGE_STATUS.forEach((status) => {
      summary[status] = rows.filter(
        (r) => r.triage_status === status
      ).length;
    });

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

    return success(res, "Triage records loaded", {
      records: rows,
      summary,
      pagination: {
        total: count,
        page: options.pagination.page,
        pageCount: Math.ceil(count / options.pagination.limit),
      },
    });
  } catch (err) {
    return error(res, "Failed to load triage records", err);
  }
};

/* ============================================================
   📌 GET TRIAGE RECORD BY ID (MASTER-ALIGNED)
============================================================ */
export const getTriageRecordById = async (req, res) => {
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
      if (req.user.facility_id) {
        where.facility_id = req.user.facility_id;
      }
    } else {
      if (req.query.organization_id) where.organization_id = req.query.organization_id;
      if (req.query.facility_id) where.facility_id = req.query.facility_id;
    }

    const record = await TriageRecord.findOne({
      where,
      include: TRIAGE_INCLUDES,
    });

    if (!record) {
      return error(res, "Triage record not found", null, 404);
    }

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "view",
      entityId: id,
      entity: record,
    });

    return success(res, "Triage record loaded", record);
  } catch (err) {
    return error(res, "Failed to load triage record", err);
  }
};
