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
  Facility,
  Organization,
  User,
} from "../models/index.js";
import { success, error } from "../utils/response.js";
import { buildQueryOptions } from "../utils/queryHelper.js";
import { VITAL_STATUS, ADMISSION_STATUS } from "../constants/enums.js";
import { authzService } from "../services/authzService.js";
import { auditService } from "../services/auditService.js";
import { FIELD_VISIBILITY_VITAL } from "../constants/fieldVisibility.js";
import { billingService } from "../services/billingService.js";
import { shouldTriggerBilling } from "../constants/billing.js";
import { makeModuleLogger } from "../utils/debugLogger.js";

const MODULE_KEY = "vital";

/* ============================================================
   🔧 LOCAL DEBUG OVERRIDE (VITAL CONTROLLER)
============================================================ */
const DEBUG_OVERRIDE = true; // turn OFF in prod
const debug = makeModuleLogger("vitalController", DEBUG_OVERRIDE);

/* ============================================================
   🔖 ENUM MAPS
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
const VITAL_INCLUDES = [
  { model: Patient, as: "patient", attributes: ["id", "pat_no", "first_name", "last_name"] },
  { model: Employee.unscoped(), as: "nurse", attributes: ["id", "first_name", "last_name"] },
  { model: Consultation, as: "consultation", attributes: ["id", "status", "diagnosis"] },
  { model: Admission, as: "admission", attributes: ["id", "status"] },
  { model: TriageRecord, as: "triageRecord", attributes: ["id", "triage_status"] },
  { model: Organization, as: "organization", attributes: ["id", "name", "code"] },
  { model: Facility, as: "facility", attributes: ["id", "name", "code", "organization_id"] },
  { model: User, as: "createdBy", attributes: ["id", "first_name", "last_name"] },
  { model: User, as: "updatedBy", attributes: ["id", "first_name", "last_name"] },
  { model: User, as: "deletedBy", attributes: ["id", "first_name", "last_name"] },
];

/* ============================================================
   📋 JOI SCHEMA
============================================================ */
function buildVitalSchema(mode = "create") {
  const base = {
    patient_id: Joi.string().uuid().required(),
    nurse_id: Joi.string().uuid().allow(null, ""),
    consultation_id: Joi.string().uuid().allow(null, ""),
    admission_id: Joi.string().uuid().allow(null, ""),
    triage_record_id: Joi.string().uuid().allow(null, ""),
    registration_log_id: Joi.string().uuid().allow(null, ""),

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

    recorded_at: Joi.date().iso().allow(null, ""),
    organization_id: Joi.string().uuid().allow(null, ""),
    facility_id: Joi.string().uuid().allow(null, ""),
  };

  if (mode === "update") {
    Object.keys(base).forEach(k => (base[k] = base[k].optional()));
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

    debug.log("create → incoming body", req.body);

    const { value, error: validationError } = buildVitalSchema("create").validate(
      req.body,
      { stripUnknown: true }
    );
    if (validationError) {
      debug.warn("create → validation error", validationError);
      await t.rollback();
      return error(res, "Validation failed", validationError, 400);
    }

    [
      "nurse_id",
      "consultation_id",
      "admission_id",
      "triage_record_id",
      "registration_log_id",
      "organization_id",
      "facility_id",
    ].forEach(f => value[f] === "" && (value[f] = null));

    if (!value.recorded_at) value.recorded_at = new Date();

    let orgId, facilityId;
    if (isSuperAdmin(req.user)) {
      orgId = value.organization_id;
      facilityId = value.facility_id;
      if (!orgId || !facilityId) {
        await t.rollback();
        return error(res, "Organization and Facility are required", null, 400);
      }
    } else {
      orgId = req.user.organization_id;
      facilityId = req.user.facility_id;
    }

    debug.log("create → resolved scope", { orgId, facilityId });

    const nurseId = value.nurse_id || req.user.employee_id || null;

    const linkFilters = { patient_id: value.patient_id, organization_id: orgId, facility_id: facilityId };

    const admission = await Admission.findOne({
      where: { ...linkFilters, status: { [Op.in]: [AS.ADMITTED, AS.IN_PROGRESS] } },
      order: [["created_at", "DESC"]],
      transaction: t,
    });
    if (admission && !value.admission_id) value.admission_id = admission.id;

    const consultation = await Consultation.findOne({
      where: { ...linkFilters, status: { [Op.in]: [VS.OPEN, VS.IN_PROGRESS] } },
      order: [["created_at", "DESC"]],
      transaction: t,
    });
    if (consultation && !value.consultation_id) value.consultation_id = consultation.id;

    const triage = await TriageRecord.findOne({
      where: { ...linkFilters, triage_status: { [Op.in]: ["open", "in_progress"] } },
      order: [["created_at", "DESC"]],
      transaction: t,
    });
    if (triage && !value.triage_record_id) value.triage_record_id = triage.id;

    debug.log("create → final payload", {
      ...value,
      nurse_id: nurseId,
      organization_id: orgId,
      facility_id: facilityId,
      status: VS.OPEN,
    });

    const created = await Vital.create(
      {
        ...value,
        nurse_id: nurseId,
        status: VS.OPEN,
        organization_id: orgId,
        facility_id: facilityId,
        created_by_id: req.user?.id || null,
      },
      { transaction: t }
    );

    await t.commit();
    debug.log("create → committed", { vitalId: created.id });

    const full = await Vital.findOne({ where: { id: created.id }, include: VITAL_INCLUDES });

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "create",
      entityId: created.id,
      entity: full,
    });

    return success(res, "✅ Vital created", full);
  } catch (err) {
    await t.rollback();
    debug.error("create → FAILED", err);
    return error(res, "❌ Failed to create vital", err);
  }
};

/* ============================================================
   📌 UPDATE VITAL
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
    debug.log("update → incoming body", req.body);

    const { value, error: validationError } = buildVitalSchema("update").validate(
      req.body,
      { stripUnknown: true }
    );
    if (validationError) {
      debug.warn("update → validation error", validationError);
      await t.rollback();
      return error(res, "Validation failed", validationError, 400);
    }

    [
      "nurse_id",
      "consultation_id",
      "admission_id",
      "triage_record_id",
      "registration_log_id",
      "organization_id",
      "facility_id",
    ].forEach(f => value[f] === "" && (value[f] = null));

    if (!value.recorded_at) value.recorded_at = new Date();

    const record = await Vital.findOne({ where: { id }, transaction: t });
    if (!record) {
      await t.rollback();
      return error(res, "Vital record not found", null, 404);
    }

    debug.log("update → before", record.toJSON());

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

    debug.log("update → resolved scope", { orgId, facilityId });

    const nurseId = value.nurse_id || record.nurse_id || req.user.employee_id || null;

    await record.update(
      {
        ...value,
        nurse_id: nurseId,
        organization_id: orgId,
        facility_id: facilityId,
        updated_by_id: req.user?.id || null,
      },
      { transaction: t }
    );

    debug.log("update → after", record.toJSON());

    await t.commit();
    debug.log("update → committed", { vitalId: id });

    const full = await Vital.findOne({ where: { id }, include: VITAL_INCLUDES });

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "update",
      entityId: id,
      entity: full,
    });

    return success(res, "✅ Vital updated", full);
  } catch (err) {
    await t.rollback();
    debug.error("update → FAILED", err);
    return error(res, "❌ Failed to update vital", err);
  }
};

/* ============================================================ 
   📌 GET ALL VITALS (Enterprise-Mirrored)
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

    debug.log("list → incoming query", req.query);

    const role = (req.user?.roleNames?.[0] || "staff").toLowerCase();
    const visibleFields =
      FIELD_VISIBILITY_VITAL[role] || FIELD_VISIBILITY_VITAL.staff;

    const options = buildQueryOptions(req, "recorded_at", "DESC", visibleFields);
    options.where = options.where || {};

    /* ================= TENANT SCOPE ================= */
    if (!isSuperAdmin(req.user)) {
      options.where.organization_id = req.user.organization_id;
      if (role === "facility_head") {
        options.where.facility_id = req.user.facility_id;
      }
    } else {
      if (req.query.organization_id)
        options.where.organization_id = req.query.organization_id;
      if (req.query.facility_id)
        options.where.facility_id = req.query.facility_id;
    }

    debug.log("list → resolved scope", options.where);

    /* ================= FILTERS ================= */
    if (req.query.patient_id) options.where.patient_id = req.query.patient_id;
    if (req.query.nurse_id) options.where.nurse_id = req.query.nurse_id;
    if (req.query.status) options.where.status = req.query.status;

    if (req.query["created_at[gte]"]) {
      options.where.recorded_at = {
        ...(options.where.recorded_at || {}),
        [Op.gte]: req.query["created_at[gte]"],
      };
    }
    if (req.query["created_at[lte]"]) {
      options.where.recorded_at = {
        ...(options.where.recorded_at || {}),
        [Op.lte]: req.query["created_at[lte]"],
      };
    }

    /* ================= SEARCH ================= */
    if (options.search) {
      const term = `%${options.search}%`;
      options.where[Op.or] = [
        { bp: { [Op.iLike]: term } },
        { position: { [Op.iLike]: term } },
        { status: { [Op.iLike]: term } },
        sequelize.where(sequelize.cast(sequelize.col("pulse"), "TEXT"), {
          [Op.iLike]: term,
        }),
        sequelize.where(sequelize.cast(sequelize.col("temp"), "TEXT"), {
          [Op.iLike]: term,
        }),
        { "$patient.first_name$": { [Op.iLike]: term } },
        { "$patient.last_name$": { [Op.iLike]: term } },
        { "$patient.pat_no$": { [Op.iLike]: term } },
        { "$nurse.first_name$": { [Op.iLike]: term } },
        { "$nurse.last_name$": { [Op.iLike]: term } },
      ];
      options.include = options.include || [];
      if (!options.include.find(i => i.as === "patient")) {
        options.include.push({ model: Patient, as: "patient", attributes: [] });
      }
      if (!options.include.find(i => i.as === "nurse")) {
        options.include.push({
          model: Employee.unscoped(),
          as: "nurse",
          attributes: [],
        });
      }
    }

    const { count, rows } = await Vital.findAndCountAll({
      where: options.where,
      include: [...VITAL_INCLUDES, ...(options.include || [])],
      order: options.order,
      offset: options.offset,
      limit: options.limit,
    });

    debug.log("list → result count", count);

    const records = rows.map(r => {
      const p = r.get({ plain: true });
      const patientLabel = p.patient
        ? `${p.patient.pat_no} - ${p.patient.first_name} ${p.patient.last_name}`
        : "Unknown Patient";
      const nurseLabel = p.nurse
        ? `${p.nurse.first_name} ${p.nurse.last_name}`
        : "No Nurse";
      const dateLabel = p.recorded_at
        ? new Date(p.recorded_at).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          })
        : "Unknown Date";

      const vitalsSummary = [
        p.bp ? `BP: ${p.bp}` : null,
        p.pulse ? `Pulse: ${p.pulse}` : null,
        p.temp ? `Temp: ${p.temp}` : null,
        p.oxygen ? `O₂: ${p.oxygen}` : null,
      ]
        .filter(Boolean)
        .join(" · ");

      return {
        ...p,
        label: `${dateLabel} · ${patientLabel} · ${
          vitalsSummary || "Vitals"
        } · ${p.status || ""}`,
        patient_label: patientLabel,
        nurse_label: nurseLabel,
      };
    });

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "list",
      details: { query: req.query, returned: count },
    });

    return success(res, "✅ Vitals loaded", {
      records,
      pagination: {
        total: count,
        page: options.pagination.page,
        pageCount: Math.ceil(count / options.pagination.limit),
      },
    });
  } catch (err) {
    debug.error("getAllVitals → FAILED", err);
    return error(res, "❌ Failed to load vitals", err);
  }
};

/* ============================================================
   📌 GET VITAL BY ID (Enterprise-Mirrored)
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
      if (role === "facility_head") where.facility_id = req.user.facility_id;
    } else {
      if (req.query.organization_id)
        where.organization_id = req.query.organization_id;
      if (req.query.facility_id)
        where.facility_id = req.query.facility_id;
    }

    debug.log("view → where", where);

    const record = await Vital.findOne({ where, include: VITAL_INCLUDES });
    if (!record) return error(res, "❌ Vital not found", null, 404);

    const p = record.get({ plain: true });
    const patientLabel = p.patient
      ? `${p.patient.pat_no} - ${p.patient.first_name} ${p.patient.last_name}`
      : "Unknown Patient";
    const nurseLabel = p.nurse
      ? `${p.nurse.first_name} ${p.nurse.last_name}`
      : "No Nurse";
    const dateLabel = p.recorded_at
      ? new Date(p.recorded_at).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        })
      : "Unknown Date";

    const vitalsSummary = [
      p.bp ? `BP: ${p.bp}` : null,
      p.pulse ? `Pulse: ${p.pulse}` : null,
      p.temp ? `Temp: ${p.temp}` : null,
      p.oxygen ? `O₂: ${p.oxygen}` : null,
    ]
      .filter(Boolean)
      .join(" · ");

    p.label = `${dateLabel} · ${patientLabel} · ${
      vitalsSummary || "Vitals"
    } · ${p.status || ""}`;
    p.patient_label = patientLabel;
    p.nurse_label = nurseLabel;

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "view",
      entityId: id,
      entity: p,
    });

    return success(res, "✅ Vital loaded", p);
  } catch (err) {
    debug.error("getVitalById → FAILED", err);
    return error(res, "❌ Failed to load vital", err);
  }
};

/* ============================================================
   📌 TOGGLE VITAL STATUS (Enterprise-Mirrored)
============================================================ */
export const toggleVitalStatus = async (req, res) => {
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

    const record = await Vital.findOne({ where, transaction: t });
    if (!record) {
      await t.rollback();
      return error(res, "❌ Vital not found", null, 404);
    }

    debug.log("toggle → before", record.toJSON());

    const oldStatus = record.status;
    let newStatus = oldStatus;

    if (oldStatus === VS.COMPLETED) newStatus = VS.VOIDED;
    else if (oldStatus === VS.VOIDED) newStatus = VS.COMPLETED;

    await record.update(
      { status: newStatus, updated_by_id: req.user?.id || null },
      { transaction: t }
    );

    if (oldStatus !== newStatus && shouldTriggerBilling(MODULE_KEY, newStatus)) {
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
    debug.log("toggle → committed", { id, from: oldStatus, to: newStatus });

    const full = await Vital.findOne({ where: { id }, include: VITAL_INCLUDES });

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "toggle_status",
      entityId: id,
      entity: full,
      details: { from: oldStatus, to: newStatus },
    });

    return success(res, `✅ Vital status set to ${newStatus}`, full);
  } catch (err) {
    await t.rollback();
    debug.error("toggleVitalStatus → FAILED", err);
    return error(res, "❌ Failed to toggle vital status", err);
  }
};

/* ============================================================
   📌 FINALIZE VITAL (Enterprise-Mirrored)
============================================================ */
export const finalizeVital = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { id } = req.params;
    const record = await Vital.findByPk(id, { transaction: t });
    if (!record) return error(res, "❌ Vital not found", null, 404);

    if (record.status !== VS.IN_PROGRESS) {
      await t.rollback();
      return error(res, "❌ Only in-progress vitals can be finalized", null, 400);
    }

    debug.log("finalize → before", record.toJSON());

    const oldStatus = record.status;

    await record.update(
      { status: VS.COMPLETED, updated_by_id: req.user?.id || null },
      { transaction: t }
    );

    if (shouldTriggerBilling(MODULE_KEY, VS.COMPLETED)) {
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
    debug.log("finalize → committed", { id });

    const full = await Vital.findOne({ where: { id }, include: VITAL_INCLUDES });

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "finalize",
      entityId: id,
      entity: full,
      details: { from: oldStatus, to: VS.COMPLETED },
    });

    return success(res, "✅ Vital finalized", full);
  } catch (err) {
    await t.rollback();
    debug.error("finalizeVital → FAILED", err);
    return error(res, "❌ Failed to finalize vital", err);
  }
};

/* ============================================================
   📌 VOID VITAL (Enterprise-Mirrored)
============================================================ */
export const voidVital = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const role = (req.user?.roleNames?.[0] || "").toLowerCase();
    if (!["admin", "superadmin"].includes(role)) {
      return error(res, "❌ Only admin/superadmin can void vitals", null, 403);
    }

    const { id } = req.params;

    debug.log("void → incoming", { id });

    const record = await Vital.findByPk(id, { transaction: t });
    if (!record) {
      await t.rollback();
      return error(res, "❌ Vital not found", null, 404);
    }

    debug.log("void → before", record.toJSON());

    await record.update(
      { status: VS.VOIDED, updated_by_id: req.user?.id || null },
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

    debug.log("void → committed", { id });

    const full = await Vital.findOne({
      where: { id },
      include: VITAL_INCLUDES,
    });

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "void",
      entityId: id,
      entity: full,
    });

    return success(res, "✅ Vital voided", full);
  } catch (err) {
    await t.rollback();
    debug.error("voidVital → FAILED", err);
    return error(res, "❌ Failed to void vital", err);
  }
};

/* ============================================================
   📌 DELETE VITAL (Enterprise-Mirrored)
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

    debug.log("delete → where", where);

    const record = await Vital.findOne({ where, transaction: t });
    if (!record) {
      await t.rollback();
      return error(res, "❌ Vital not found", null, 404);
    }

    debug.log("delete → before", record.toJSON());

    await record.update(
      { deleted_by_id: req.user?.id || null },
      { transaction: t }
    );
    await record.destroy({ transaction: t });

    await t.commit();

    debug.log("delete → committed", { id });

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

    return success(res, "✅ Vital deleted", full);
  } catch (err) {
    await t.rollback();
    debug.error("deleteVital → FAILED", err);
    return error(res, "❌ Failed to delete vital", err);
  }
};

/* ============================================================
   📌 GET ALL VITALS LITE (Enterprise-Mirrored)
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

    const { q } = req.query;
    const role = (req.user?.roleNames?.[0] || "").toLowerCase();

    const where = {
      status: { [Op.in]: [VS.COMPLETED, VS.VERIFIED] },
    };

    if (!isSuperAdmin(req.user)) {
      where.organization_id = req.user.organization_id;
      if (role === "facility_head") where.facility_id = req.user.facility_id;
    } else {
      if (req.query.organization_id)
        where.organization_id = req.query.organization_id;
      if (req.query.facility_id)
        where.facility_id = req.query.facility_id;
    }

    if (q) {
      where[Op.or] = [
        { bp: { [Op.iLike]: `%${q}%` } },
        { pulse: { [Op.iLike]: `%${q}%` } },
        { temp: { [Op.iLike]: `%${q}%` } },
      ];
    }

    debug.log("list_lite → where", where);

    const vitals = await Vital.findAll({
      where,
      attributes: ["id", "bp", "pulse", "rr", "temp", "recorded_at"],
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

    const result = vitals.map(v => ({
      id: v.id,
      patient: v.patient
        ? `${v.patient.pat_no} - ${v.patient.first_name} ${v.patient.last_name}`
        : "",
      nurse: v.nurse
        ? `${v.nurse.first_name} ${v.nurse.last_name}`
        : "",
      summary: `BP: ${v.bp}, P: ${v.pulse}, T: ${v.temp}`,
      recorded_at: v.recorded_at,
    }));

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "list_lite",
      details: { count: result.length, query: q || null },
    });

    return success(res, "✅ Vitals loaded (lite)", { records: result });
  } catch (err) {
    debug.error("getAllVitalsLite → FAILED", err);
    return error(res, "❌ Failed to load vitals (lite)", err);
  }
};

/* ============================================================
   📌 START VITAL (Enterprise-Mirrored)
============================================================ */
export const startVital = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { id } = req.params;

    debug.log("start → incoming", { id });

    const record = await Vital.findByPk(id, { transaction: t });
    if (!record) return error(res, "❌ Vital not found", null, 404);

    if (record.status !== VS.OPEN) {
      await t.rollback();
      return error(res, "❌ Only open vitals can be started", null, 400);
    }

    debug.log("start → before", record.toJSON());

    const oldStatus = record.status;

    await record.update(
      { status: VS.IN_PROGRESS, updated_by_id: req.user?.id || null },
      { transaction: t }
    );

    await t.commit();

    debug.log("start → committed", { id });

    const full = await Vital.findOne({
      where: { id },
      include: VITAL_INCLUDES,
    });

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "start",
      entityId: id,
      entity: full,
      details: { from: oldStatus, to: VS.IN_PROGRESS },
    });

    return success(res, "✅ Vital started", full);
  } catch (err) {
    await t.rollback();
    debug.error("startVital → FAILED", err);
    return error(res, "❌ Failed to start vital", err);
  }
};

/* ============================================================
   📌 VERIFY VITAL (Enterprise-Mirrored)
============================================================ */
export const verifyVital = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const role = (req.user?.roleNames?.[0] || "").toLowerCase();
    if (!["admin", "superadmin"].includes(role)) {
      return error(res, "❌ Only admin/superadmin can verify vitals", null, 403);
    }

    const { id } = req.params;

    debug.log("verify → incoming", { id });

    const record = await Vital.findByPk(id, { transaction: t });
    if (!record) return error(res, "❌ Vital not found", null, 404);

    if (record.status !== VS.COMPLETED) {
      await t.rollback();
      return error(res, "❌ Only completed vitals can be verified", null, 400);
    }

    debug.log("verify → before", record.toJSON());

    const oldStatus = record.status;

    await record.update(
      { status: VS.VERIFIED, updated_by_id: req.user?.id || null },
      { transaction: t }
    );

    await t.commit();

    debug.log("verify → committed", { id });

    const full = await Vital.findOne({
      where: { id },
      include: VITAL_INCLUDES,
    });

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "verify",
      entityId: id,
      entity: full,
      details: { from: oldStatus, to: VS.VERIFIED },
    });

    return success(res, "✅ Vital verified", full);
  } catch (err) {
    await t.rollback();
    debug.error("verifyVital → FAILED", err);
    return error(res, "❌ Failed to verify vital", err);
  }
};
