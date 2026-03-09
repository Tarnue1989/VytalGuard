// 📁 controllers/vitalController.js
import Joi from "joi";
import { Op } from "sequelize";
import {
  sequelize,
  Vital,
  Patient,
  Employee,
  Consultation,
  Admission,
  TriageRecord,
  User,
  Organization,
  Facility,
  InvoiceItem,
} from "../models/index.js";

import { success, error } from "../utils/response.js";
import { buildQueryOptions } from "../utils/queryHelper.js";
import { VITAL_STATUS, ADMISSION_STATUS } from "../constants/enums.js";
import { authzService } from "../services/authzService.js";
import { auditService } from "../services/auditService.js";
import { FIELD_VISIBILITY_VITAL } from "../constants/fieldVisibility.js";
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
const debug = makeModuleLogger("vitalController", DEBUG_OVERRIDE);

const MODULE_KEY = "vitals";

/* ============================================================
   🔖 STATUS MAP (ENUM-DRIVEN)
============================================================ */
const VS = {
  OPEN: VITAL_STATUS[0],
  IN_PROGRESS: VITAL_STATUS[1],
  COMPLETED: VITAL_STATUS[2],
  VERIFIED: VITAL_STATUS[3],
  CANCELLED: VITAL_STATUS[4],
  VOIDED: VITAL_STATUS[5],
};

const AS = {
  ADMITTED: ADMISSION_STATUS[0],
  IN_PROGRESS: ADMISSION_STATUS[1],
  DISCHARGED: ADMISSION_STATUS[2] ?? "discharged",
};

/* ============================================================
   🔗 SHARED INCLUDES
============================================================ */
const VITAL_INCLUDES = [
  {
    model: Patient,
    as: "patient",
    attributes: [
      "id",
      "pat_no",
      "first_name",
      "last_name",
      [
        sequelize.literal(
          `"patient"."first_name" || ' ' || "patient"."last_name"`
        ),
        "label",
      ],
    ],
  },
  {
    model: Employee.unscoped(),
    as: "nurse",
    attributes: [
      "id",
      "first_name",
      "last_name",
      [
        sequelize.literal(
          `"nurse"."first_name" || ' ' || "nurse"."last_name"`
        ),
        "label",
      ],
    ],
  },
  { model: Consultation, as: "consultation", attributes: ["id", "status"] },
  { model: Admission, as: "admission", attributes: ["id", "status"] },
  {
    model: TriageRecord,
    as: "triageRecord",
    attributes: ["id", "triage_status"],
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
function buildVitalSchema(user, mode = "create") {
  const base = {
    patient_id: Joi.string().uuid().required(),
    nurse_id: Joi.string().uuid().allow("", null),
    consultation_id: Joi.string().uuid().allow("", null),
    admission_id: Joi.string().uuid().allow("", null),
    triage_record_id: Joi.string().uuid().allow("", null),
    registration_log_id: Joi.string().uuid().allow("", null),

    bp: Joi.string().max(50).allow("", null),
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

    organization_id: Joi.forbidden(),
    facility_id: Joi.forbidden(),
  };

  if (mode === "update") {
    Object.keys(base).forEach((k) => (base[k] = base[k].optional()));
  }

  if (isSuperAdmin(user)) {
    base.organization_id = Joi.string().uuid().allow("", null);
    base.facility_id = Joi.string().uuid().allow("", null);
  }

  return Joi.object(base);
}

/* ============================================================
   📌 CREATE VITAL
============================================================ */
export const createVital = async (req, res) => {
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
      buildVitalSchema(req.user, "create"),
      req.body
    );

    if (errors) {
      await t.rollback();
      return error(res, "Validation failed", errors, 400);
    }

    const { orgId, facilityId } = await resolveOrgFacility({
      user: req.user,
      value,
      body: req.body,
    });

    /* ================= TENANT SAFETY (MATCH PATIENT) ================= */
    if (!orgId) {
      await t.rollback();
      return error(res, "Organization is required", null, 400);
    }

    if (!facilityId) {
      await t.rollback();
      return error(res, "Facility is required", null, 400);
    }

    value._currentUser = req.user;

    await resolveClinicalLinks(value, orgId, facilityId, t);

    const created = await Vital.create(
      {
        ...value,
        status: VS.OPEN,
        organization_id: orgId,
        facility_id: facilityId,
        created_by_id: req.user?.id || null,
      },
      { transaction: t }
    );

    await t.commit();

    const full = await Vital.findOne({
      where: { id: created.id },
      include: VITAL_INCLUDES,
    });

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "create",
      entityId: created.id,
      entity: full,
    });

    return success(res, "Vital created", full);
  } catch (err) {
    await t.rollback();
    return error(res, "Failed to create vital", err);
  }
};
/* ============================================================
   📌 UPDATE VITAL (LOCKED STATES)
============================================================ */
export const updateVital = async (req, res) => {
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
      buildVitalSchema(req.user, "update"),
      req.body
    );

    if (errors) {
      await t.rollback();
      return error(res, "Validation failed", errors, 400);
    }

    const record = await Vital.findOne({
      where: { id },
      transaction: t,
    });

    if (!record) {
      await t.rollback();
      return error(res, "Vital not found", null, 404);
    }

    if ([VS.VERIFIED, VS.VOIDED].includes(record.status)) {
      await t.rollback();
      return error(
        res,
        "Verified or voided vitals cannot be modified",
        null,
        400
      );
    }

    const { orgId, facilityId } = await resolveOrgFacility({
      user: req.user,
      value,
      body: req.body,
    });

    /* ================= TENANT SAFETY ================= */
    if (!orgId) {
      await t.rollback();
      return error(res, "Organization is required", null, 400);
    }

    if (!facilityId) {
      await t.rollback();
      return error(res, "Facility is required", null, 400);
    }

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

    const full = await Vital.findOne({
      where: { id },
      include: VITAL_INCLUDES,
    });

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "update",
      entityId: id,
      entity: full,
    });

    return success(res, "Vital updated", full);
  } catch (err) {
    await t.rollback();
    return error(res, "Failed to update vital", err);
  }
};
/* ============================================================
   📌 VOID VITAL (any → voided, MASTER-ALIGNED)
============================================================ */
export const voidVital = async (req, res) => {
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

    const record = await Vital.findOne({ where, transaction: t });
    if (!record) {
      await t.rollback();
      return error(res, "Vital not found", null, 404);
    }

    if (record.status === VS.VOIDED) {
      await t.rollback();
      return error(res, "Vital is already voided", null, 400);
    }

    const oldStatus = record.status;

    await record.update(
      {
        status: VS.VOIDED,
        void_reason: reason || null,
        voided_by_id: req.user?.id || null,
        voided_at: new Date(),
        updated_by_id: req.user?.id || null,
      },
      { transaction: t }
    );

    await billingService.voidCharges({
      module_key: MODULE_KEY,
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
      details: { from: oldStatus, to: VS.VOIDED, reason: reason || null },
    });

    return success(res, "Vital voided", record);
  } catch (err) {
    await t.rollback();
    return error(res, "Failed to void vital", err);
  }
};
/* ============================================================
   📌 START VITAL (open → in_progress)
============================================================ */
export const startVital = async (req, res) => {
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

    const record = await Vital.findOne({ where: { id }, transaction: t });
    if (!record) {
      await t.rollback();
      return error(res, "Vital not found", null, 404);
    }

    if (record.status !== VS.OPEN) {
      await t.rollback();
      return error(res, "Only open vitals can be started", null, 400);
    }

    const oldStatus = record.status;

    await record.update(
      { status: VS.IN_PROGRESS, updated_by_id: req.user?.id || null },
      { transaction: t }
    );

    await t.commit();

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "start",
      entityId: id,
      entity: record,
      details: { from: oldStatus, to: VS.IN_PROGRESS },
    });

    return success(res, "Vital started", record);
  } catch (err) {
    await t.rollback();
    return error(res, "Failed to start vital", err);
  }
};

/* ============================================================
   📌 COMPLETE VITAL (in_progress → completed)
============================================================ */
export const completeVital = async (req, res) => {
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

    const record = await Vital.findOne({ where: { id }, transaction: t });
    if (!record) {
      await t.rollback();
      return error(res, "Vital not found", null, 404);
    }

    if (record.status !== VS.IN_PROGRESS) {
      await t.rollback();
      return error(res, "Only in-progress vitals can be completed", null, 400);
    }

    const oldStatus = record.status;

    await record.update(
      {
        status: VS.COMPLETED,
        updated_by_id: req.user?.id || null,
      },
      { transaction: t }
    );

    /* 🔹 Trigger billing (billingService handles duplicates) */
    await billingService.triggerAutoBilling({
      module_key: MODULE_KEY,
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
      details: { from: oldStatus, to: VS.COMPLETED },
    });

    return success(res, "Vital completed", record);
  } catch (err) {
    await t.rollback();
    return error(res, "Failed to complete vital", err);
  }
};


/* ============================================================
   📌 VERIFY VITAL (completed → verified)
============================================================ */
export const verifyVital = async (req, res) => {
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

    const record = await Vital.findOne({ where: { id }, transaction: t });
    if (!record) {
      await t.rollback();
      return error(res, "Vital not found", null, 404);
    }

    if (record.status !== VS.COMPLETED) {
      await t.rollback();
      return error(res, "Only completed vitals can be verified", null, 400);
    }

    const oldStatus = record.status;

    await record.update(
      {
        status: VS.VERIFIED,
        verified_by_id: req.user?.id || null,
        verified_at: new Date(),
        updated_by_id: req.user?.id || null,
      },
      { transaction: t }
    );

    /* 🔹 Trigger billing (billingService prevents duplicates) */
    await billingService.triggerAutoBilling({
      module_key: MODULE_KEY,
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
      action: "verify",
      entityId: id,
      entity: record,
      details: { from: oldStatus, to: VS.VERIFIED },
    });

    return success(res, "Vital verified", record);
  } catch (err) {
    await t.rollback();
    return error(res, "Failed to verify vital", err);
  }
};
/* ============================================================
   📌 FINALIZE VITAL (verified → verified)
   - Semantic finalization (no separate FINALIZED status)
============================================================ */
export const finalizeVital = async (req, res) => {
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

    const record = await Vital.findOne({ where: { id }, transaction: t });
    if (!record) {
      await t.rollback();
      return error(res, "Vital not found", null, 404);
    }

    if (record.status !== VS.VERIFIED) {
      await t.rollback();
      return error(res, "Only verified vitals can be finalized", null, 400);
    }

    const oldStatus = record.status;

    await record.update(
      {
        status: VS.VERIFIED, // terminal state (FINALIZED is semantic, not enum)
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
      details: { from: oldStatus, to: VS.VERIFIED },
    });

    return success(res, "Vital finalized", record);
  } catch (err) {
    await t.rollback();
    return error(res, "Failed to finalize vital", err);
  }
};

/* ============================================================
   📌 CANCEL VITAL (open/in_progress → cancelled)
   - Permission-gated
   - Org / Facility scoped
   - Status-guarded
   - Billing rollback
============================================================ */
export const cancelVital = async (req, res) => {
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

    const record = await Vital.findOne({ where, transaction: t });
    if (!record) {
      await t.rollback();
      return error(res, "Vital not found", null, 404);
    }

    if (record.status === VS.CANCELLED) {
      await t.rollback();
      return error(res, "Vital is already cancelled", null, 400);
    }

    if (![VS.OPEN, VS.IN_PROGRESS].includes(record.status)) {
      await t.rollback();
      return error(
        res,
        "Only open or in-progress vitals can be cancelled",
        null,
        400
      );
    }

    const oldStatus = record.status;

    await record.update(
      {
        status: VS.CANCELLED,
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
      details: { from: oldStatus, to: VS.CANCELLED, reason: reason || null },
    });

    return success(res, "Vital cancelled", record);
  } catch (err) {
    await t.rollback();
    return error(res, "Failed to cancel vital", err);
  }
};

/* ============================================================
   📌 DELETE VITAL (Soft Delete + Billing Rollback)
============================================================ */
export const deleteVital = async (req, res) => {
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

    const record = await Vital.findOne({ where, transaction: t });
    if (!record) {
      await t.rollback();
      return error(res, "Vital not found", null, 404);
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

    const full = await Vital.findOne({
      where: { id },
      include: VITAL_INCLUDES,
      paranoid: false,
    });

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "delete",
      entityId: id,
      entity: full,
    });

    return success(res, "Vital deleted", full);
  } catch (err) {
    await t.rollback();
    return error(res, "Failed to delete vital", err);
  }
};

/* ============================================================
   📌 GET ALL VITALS LITE
============================================================ */
export const getAllVitalsLite = async (req, res) => {
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

    let statusFilter = [VS.OPEN, VS.IN_PROGRESS];
    if (status) statusFilter = Array.isArray(status) ? status : [status];

    const where = { status: { [Op.in]: statusFilter } };

    if (!isSuperAdmin(req.user)) {
      where.organization_id = req.user.organization_id;
      if (role === "facility_head") where.facility_id = req.user.facility_id;
    }

    if (q) {
      where[Op.or] = [
        { bp: { [Op.iLike]: `%${q}%` } },
        { position: { [Op.iLike]: `%${q}%` } },
      ];
    }

    if (req.query.patient_id) where.patient_id = req.query.patient_id;
    if (req.query.nurse_id) where.nurse_id = req.query.nurse_id;

    const rows = await Vital.findAll({
      where,
      attributes: ["id", "recorded_at", "bp", "pulse", "status"],
      include: [
        {
          model: Patient,
          as: "patient",
          attributes: ["id", "pat_no", "first_name", "last_name"],
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
      nurse: r.nurse
        ? `${r.nurse.first_name} ${r.nurse.last_name}`
        : "",
      bp: r.bp || "",
      pulse: r.pulse || "",
      date: r.recorded_at,
      status: r.status,
    }));

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "list_lite",
      details: { query: q || null, returned: records.length },
    });

    return success(res, "Vitals loaded (lite)", { records });
  } catch (err) {
    return error(res, "Failed to load vitals (lite)", err);
  }
};
/* ============================================================
   📌 GET ALL VITALS (MASTER-ALIGNED + SUMMARY)
============================================================ */
export const getAllVitals = async (req, res) => {
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
      FIELD_VISIBILITY_VITAL[role] || FIELD_VISIBILITY_VITAL.staff;

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
        options.where.recorded_at = {
          [Op.between]: [range.start, range.end],
        };
      }
    }

    /* ========================================================
       🔍 GLOBAL SEARCH (ADDITIVE)
    ======================================================== */
    if (options.search) {
      options.where[Op.or] = [
        { bp: { [Op.iLike]: `%${options.search}%` } },
        { position: { [Op.iLike]: `%${options.search}%` } },
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
    if (req.query.triage_record_id) {
      options.where.triage_record_id = req.query.triage_record_id;
    }
    if (req.query.nurse_id) {
      options.where.nurse_id = req.query.nurse_id;
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
    const { count, rows } = await Vital.findAndCountAll({
      where: options.where,
      include: [...VITAL_INCLUDES, ...(options.include || [])],
      order: options.order,
      offset: options.offset,
      limit: options.limit,
    });

    /* ========================================================
       📊 SUMMARY (STATUS-BASED, PAGE-AWARE)
    ======================================================== */
    const summary = { total: count };
    VITAL_STATUS.forEach((status) => {
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

    return success(res, "Vitals loaded", {
      records: rows,
      summary,
      pagination: {
        total: count,
        page: options.pagination.page,
        pageCount: Math.ceil(count / options.pagination.limit),
      },
    });
  } catch (err) {
    return error(res, "Failed to load vitals", err);
  }
};

/* ============================================================
   📌 GET VITAL BY ID (MASTER-ALIGNED)
============================================================ */
export const getVitalById = async (req, res) => {
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

    const record = await Vital.findOne({
      where,
      include: VITAL_INCLUDES,
    });

    if (!record) {
      return error(res, "Vital not found", null, 404);
    }

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "view",
      entityId: id,
      entity: record,
    });

    return success(res, "Vital loaded", record);
  } catch (err) {
    return error(res, "Failed to load vital", err);
  }
};
