// 📁 controllers/registrationLogController.js
// ============================================================================
// 🧾 Registration Log Controller – ENTERPRISE MASTER–ALIGNED
// ----------------------------------------------------------------------------
// 🔹 NO role-based Joi
// 🔹 NO shouldTriggerBilling
// 🔹 Uses resolveOrgFacility
// 🔹 Billing handled ONLY via billingService
// ============================================================================

import Joi from "joi";
import { Op } from "sequelize";
import {
  sequelize,
  RegistrationLog,
  Patient,
  Employee,
  Facility,
  Organization,
  User,
  Invoice,
  BillableItem,
  InvoiceItem,
} from "../models/index.js";

import { success, error } from "../utils/response.js";
import { buildQueryOptions } from "../utils/queryHelper.js";
import { validatePaginationStrict } from "../utils/query-utils.js";
import { normalizeDateRangeLocal } from "../utils/date-utils.js";
import { validate } from "../utils/validation.js";
import { resolveOrgFacility } from "../utils/resolveOrgFacility.js";
import { isSuperAdmin, isFacilityHead } from "../utils/role-utils.js";
import { makeModuleLogger } from "../utils/debugLogger.js";

import {
  REGISTRATION_LOG_STATUS,
  REGISTRATION_METHODS,
  REGISTRATION_CATEGORIES,
} from "../constants/enums.js";

import { FIELD_VISIBILITY_REGISTRATION_LOG } from "../constants/fieldVisibility.js";
import { authzService } from "../services/authzService.js";
import { auditService } from "../services/auditService.js";
import { billingService } from "../services/billingService.js";

/* ============================================================
   🔐 MODULE
============================================================ */
const MODULE_KEY = "registration_logs";

/* ============================================================
   🔧 DEBUG LOGGER
============================================================ */
const DEBUG_OVERRIDE = false;
const debug = makeModuleLogger("registrationLogController", DEBUG_OVERRIDE);

/* ============================================================
   🔗 SHARED INCLUDES (MASTER PARITY)
============================================================ */
const REGISTRATION_LOG_INCLUDES = [
  { model: Patient, as: "patient", attributes: ["id", "pat_no", "first_name", "last_name"] },
  { model: Employee.unscoped(), as: "registrar", attributes: ["id", "first_name", "last_name"] },
  { model: Invoice, as: "invoice", attributes: ["id", "invoice_number", "status", "total"] },
  { model: BillableItem, as: "registrationType", attributes: ["id", "name", "price"] },
  { model: Organization, as: "organization", attributes: ["id", "name", "code"] },
  { model: Facility, as: "facility", attributes: ["id", "name", "code", "organization_id"] },
  { model: User, as: "createdBy", attributes: ["id", "first_name", "last_name"] },
  { model: User, as: "updatedBy", attributes: ["id", "first_name", "last_name"] },
  { model: User, as: "deletedBy", attributes: ["id", "first_name", "last_name"] },
];

/* ============================================================
   📋 JOI SCHEMA (MASTER – TENANT SAFE)
============================================================ */
function buildRegistrationLogSchema(mode = "create") {
  const base = {
    patient_id: Joi.string().uuid().required(),
    registrar_id: Joi.string().uuid().allow(null, ""),
    registration_type_id: Joi.string().uuid().allow(null, ""),
    invoice_id: Joi.string().uuid().allow(null),

    registration_method: Joi.string()
      .valid(...REGISTRATION_METHODS)
      .required(),

    patient_category: Joi.string()
      .valid(...REGISTRATION_CATEGORIES)
      .required(),

    registration_source: Joi.string().max(120).allow("", null),
    visit_reason: Joi.string().allow("", null),
    notes: Joi.string().allow("", null),
    is_emergency: Joi.boolean().default(false),
    registration_time: Joi.date().default(() => new Date()),

    // 🔒 lifecycle / tenant controlled
    log_status: Joi.forbidden(),
    organization_id: Joi.forbidden(),
    facility_id: Joi.forbidden(),
  };

  if (mode === "update") {
    Object.keys(base).forEach((k) => {
      base[k] = base[k].optional();
    });
  }

  return Joi.object(base);
}

/* ============================================================
   📌 CREATE REGISTRATION LOG — MASTER PARITY (FIXED)
============================================================ */
export const createRegistrationLog = async (req, res) => {
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
      buildRegistrationLogSchema("create"),
      req.body
    );
    if (errors) {
      await t.rollback();
      return error(res, "Validation failed", errors, 400);
    }

    /* ================= TENANT RESOLUTION (MASTER-CORRECT) ================= */
    const { orgId, facilityId } = await resolveOrgFacility({
      user: req.user,
      value,
      body: req.body,
    });

    /* ================= REGISTRAR AUTO-LINK ================= */
    let registrarId = value.registrar_id || null;
    if (!registrarId && req.user?.employee_id) {
      registrarId = req.user.employee_id;
    }

    /* ================= CREATE ================= */
    const created = await RegistrationLog.create(
      {
        ...value,
        registrar_id: registrarId,
        organization_id: orgId,
        facility_id: facilityId,
        created_by_id: req.user?.id || null,
        log_status: REGISTRATION_LOG_STATUS[0], // draft
      },
      { transaction: t }
    );

    await t.commit();

    const full = await RegistrationLog.findByPk(created.id, {
      include: REGISTRATION_LOG_INCLUDES,
    });

    await auditService.logAction({
      user: req.user,
      module_key: MODULE_KEY,
      action: "create",
      entityId: created.id,
      entity: full,
      details: value,
    });

    return success(res, "✅ Registration Log created", full);
  } catch (err) {
    await t.rollback();
    return error(res, "❌ Failed to create registration log", err);
  }
};

/* ============================================================
   📌 UPDATE REGISTRATION LOG — MASTER PARITY (FIXED)
============================================================ */
export const updateRegistrationLog = async (req, res) => {
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
      buildRegistrationLogSchema("update"),
      req.body
    );
    if (errors) {
      await t.rollback();
      return error(res, "Validation failed", errors, 400);
    }

    /* ================= TENANT RESOLUTION (MASTER-CORRECT) ================= */
    const { orgId, facilityId } = await resolveOrgFacility({
      user: req.user,
      value,
      body: req.body,
    });

    const log = await RegistrationLog.findOne({
      where: { id, organization_id: orgId },
      transaction: t,
    });

    if (!log) {
      await t.rollback();
      return error(res, "❌ Registration Log not found", null, 404);
    }

    /* ================= REGISTRAR AUTO-LINK ================= */
    let registrarId = value.registrar_id || log.registrar_id || null;
    if (!registrarId && req.user?.employee_id) {
      registrarId = req.user.employee_id;
    }

    await log.update(
      {
        ...value,
        registrar_id: registrarId,
        organization_id: orgId,
        facility_id: facilityId,
        updated_by_id: req.user?.id || null,
      },
      { transaction: t }
    );

    await t.commit();

    const full = await RegistrationLog.findByPk(id, {
      include: REGISTRATION_LOG_INCLUDES,
    });

    await auditService.logAction({
      user: req.user,
      module_key: MODULE_KEY,
      action: "update",
      entityId: id,
      entity: full,
      details: value,
    });

    return success(res, "✅ Registration Log updated", full);
  } catch (err) {
    await t.rollback();
    return error(res, "❌ Failed to update registration log", err);
  }
};

/* ============================================================
   📌 GET ALL REGISTRATION LOGS — MASTER (ORG ADMIN FAC-FILTER SAFE)
============================================================ */
export const getAllRegistrationLogs = async (req, res) => {
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module_key: MODULE_KEY,
      action: "read",
      res,
    });
    if (!allowed) return;

    /* ================= ROLE → FIELD VISIBILITY ================= */
    const role = (req.user?.roleNames?.[0] || "staff").toLowerCase();
    const visibleFields =
      FIELD_VISIBILITY_REGISTRATION_LOG[role] ||
      FIELD_VISIBILITY_REGISTRATION_LOG.staff;

    /* ================= BASE QUERY OPTIONS (APPOINTMENT PARITY) ================= */
    const options = buildQueryOptions(req, {
      defaultSort: ["registration_time", "DESC"],
      fields: visibleFields,
    });

    options.where = { [Op.and]: [] };

    /* ================= DATE RANGE (UI-ONLY) ================= */
    if (req.query.dateRange) {
      const { start, end } = normalizeDateRangeLocal(req.query.dateRange);
      if (start && end) {
        options.where[Op.and].push({
          registration_time: {
            [Op.between]: [start, end],
          },
        });
      }
    }

    /* ================= TENANT SCOPE (MASTER-CORRECT) ================= */
    if (!isSuperAdmin(req.user)) {
      options.where[Op.and].push({
        organization_id: req.user.organization_id,
      });

      if (isFacilityHead(req.user)) {
        options.where[Op.and].push({
          facility_id: req.user.facility_id,
        });
      } else if (req.query.facility_id) {
        options.where[Op.and].push({
          facility_id: req.query.facility_id,
        });
      }
    } else {
      if (req.query.organization_id) {
        options.where[Op.and].push({
          organization_id: req.query.organization_id,
        });
      }
      if (req.query.facility_id) {
        options.where[Op.and].push({
          facility_id: req.query.facility_id,
        });
      }
    }

    /* ================= MAIN QUERY ================= */
    const { count, rows } = await RegistrationLog.findAndCountAll({
      where: options.where,
      include: REGISTRATION_LOG_INCLUDES,
      order: options.order,
      offset: options.offset,
      limit: options.limit,
      distinct: true,
    });

    /* ================= SUMMARY (MASTER) ================= */
    const summary = { total: count };

    const statusCounts = await RegistrationLog.findAll({
      where: options.where,
      attributes: [
        "log_status",
        [sequelize.fn("COUNT", sequelize.col("id")), "count"],
      ],
      group: ["log_status"],
    });

    REGISTRATION_LOG_STATUS.forEach((s) => {
      const found = statusCounts.find((r) => r.log_status === s);
      summary[s] = found ? Number(found.get("count")) : 0;
    });

    /* ================= AUDIT ================= */
    await auditService.logAction({
      user: req.user,
      module_key: MODULE_KEY,
      action: "list",
      details: {
        query: req.query,
        returned: count,
      },
    });

    /* ================= RESPONSE ================= */
    return success(res, "✅ Registration Logs loaded", {
      records: rows,
      summary,
      pagination: {
        total: count,
        page: options.pagination.page,
        pageCount: Math.ceil(count / options.pagination.limit),
      },
    });
  } catch (err) {
    /* ================= HARD DEBUG (TEMPORARY) ================= */
    console.error("🚨 REGISTRATION LOG STACK TRACE 🚨");
    console.error(err?.stack || err);

    return error(res, "❌ Failed to load registration logs", err);
  }
};


/* ============================================================
   📌 GET REGISTRATION LOG BY ID — MASTER PARITY
============================================================ */
export const getRegistrationLogById = async (req, res) => {
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module_key: MODULE_KEY,
      action: "read",
      res,
    });
    if (!allowed) return;

    const { id } = req.params;
    const { organization_id, facility_id } = resolveOrgFacility(req);

    const where = { id, organization_id };
    if (facility_id) where.facility_id = facility_id;

    const log = await RegistrationLog.findOne({
      where,
      include: REGISTRATION_LOG_INCLUDES,
    });

    if (!log) return error(res, "❌ Registration Log not found", null, 404);

    await auditService.logAction({
      user: req.user,
      module_key: MODULE_KEY,
      action: "view",
      entityId: id,
      entity: log,
    });

    return success(res, "✅ Registration Log loaded", log);
  } catch (err) {
    return error(res, "❌ Failed to load registration log", err);
  }
};

/* ============================================================
   📌 GET ALL REGISTRATION LOGS LITE — MASTER PARITY
============================================================ */
export const getAllRegistrationLogsLite = async (req, res) => {
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module_key: MODULE_KEY,
      action: "read",
      res,
    });
    if (!allowed) return;

    const { q } = req.query;
    const [, , ACTIVE] = REGISTRATION_LOG_STATUS;

    const { organization_id, facility_id } = resolveOrgFacility(req);

    const where = {
      log_status: ACTIVE,
      organization_id,
    };
    if (facility_id) where.facility_id = facility_id;

    if (q) {
      where[Op.or] = [
        { registration_source: { [Op.iLike]: `%${q}%` } },
        { visit_reason: { [Op.iLike]: `%${q}%` } },
      ];
    }

    const logs = await RegistrationLog.findAll({
      where,
      attributes: ["id", "registration_time", "registration_source", "visit_reason"],
      include: [
        {
          model: Patient,
          as: "patient",
          attributes: ["id", "pat_no", "first_name", "last_name"],
        },
      ],
      order: [["registration_time", "DESC"]],
      limit: 20,
    });

    const records = logs.map((l) => ({
      id: l.id,
      label: `${new Date(l.registration_time).toLocaleDateString()} · ${
        l.patient
          ? `${l.patient.pat_no} - ${l.patient.first_name} ${l.patient.last_name}`
          : ""
      } · ${l.visit_reason || "Visit"}`,
    }));

    await auditService.logAction({
      user: req.user,
      module_key: MODULE_KEY,
      action: "list_lite",
      details: { count: records.length, query: q || null },
    });

    return success(res, "✅ Registration Logs loaded (lite)", {
      records,
    });
  } catch (err) {
    return error(res, "❌ Failed to load registration logs (lite)", err);
  }
};

/* ============================================================
   📌 ACTIVATE REGISTRATION LOG — MASTER
   pending → active
============================================================ */
export const activateRegistrationLog = async (req, res) => {
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

    const [, PENDING, ACTIVE] = REGISTRATION_LOG_STATUS;

    const log = await RegistrationLog.findOne({
      where: {
        id,
        organization_id: orgId,
        ...(facilityId && { facility_id: facilityId }),
      },
      transaction: t,
    });

    if (!log) {
      await t.rollback();
      return error(res, "❌ Registration Log not found", null, 404);
    }

    if (log.log_status !== PENDING) {
      await t.rollback();
      return error(res, "❌ Only pending logs can be activated", null, 400);
    }

    const oldStatus = log.log_status;

    await log.update(
      {
        log_status: ACTIVE,
        updated_by_id: req.user?.id || null,
      },
      { transaction: t }
    );

    await billingService.triggerAutoBilling({
      module_key: MODULE_KEY,
      entity: log,
      user: { ...req.user, organization_id: orgId, facility_id: facilityId },
      transaction: t,
    });

    await t.commit();

    await auditService.logAction({
      user: req.user,
      module_key: MODULE_KEY,
      action: "activate",
      entityId: id,
      entity: log,
      details: { from: oldStatus, to: ACTIVE },
    });

    return success(res, "✅ Registration Log activated", log);
  } catch (err) {
    await t.rollback();
    return error(res, "❌ Failed to activate registration log", err);
  }
};

/* ============================================================
   📌 COMPLETE REGISTRATION LOG — MASTER
   active → completed
============================================================ */
export const completeRegistrationLog = async (req, res) => {
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

    const [, , ACTIVE, COMPLETED] = REGISTRATION_LOG_STATUS;

    const log = await RegistrationLog.findOne({
      where: {
        id,
        organization_id: orgId,
        ...(facilityId && { facility_id: facilityId }),
      },
      transaction: t,
    });

    if (!log) {
      await t.rollback();
      return error(res, "❌ Registration Log not found", null, 404);
    }

    if (log.log_status !== ACTIVE) {
      await t.rollback();
      return error(res, "❌ Only active logs can be completed", null, 400);
    }

    const oldStatus = log.log_status;

    await log.update(
      {
        log_status: COMPLETED,
        updated_by_id: req.user?.id || null,
      },
      { transaction: t }
    );

    await billingService.triggerAutoBilling({
      module_key: MODULE_KEY,
      entity: log,
      user: { ...req.user, organization_id: orgId, facility_id: facilityId },
      transaction: t,
    });

    await t.commit();

    await auditService.logAction({
      user: req.user,
      module_key: MODULE_KEY,
      action: "complete",
      entityId: id,
      entity: log,
      details: { from: oldStatus, to: COMPLETED },
    });

    return success(res, "✅ Registration Log completed", log);
  } catch (err) {
    await t.rollback();
    return error(res, "❌ Failed to complete registration log", err);
  }
};

/* ============================================================
   📌 CANCEL REGISTRATION LOG — MASTER
   pending | active → cancelled
============================================================ */
export const cancelRegistrationLog = async (req, res) => {
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

    const [, PENDING, ACTIVE, , CANCELLED] = REGISTRATION_LOG_STATUS;

    const log = await RegistrationLog.findOne({
      where: {
        id,
        organization_id: orgId,
        ...(facilityId && { facility_id: facilityId }),
      },
      transaction: t,
    });

    if (!log) {
      await t.rollback();
      return error(res, "❌ Registration Log not found", null, 404);
    }

    if (![PENDING, ACTIVE].includes(log.log_status)) {
      await t.rollback();
      return error(
        res,
        "❌ Only pending or active logs can be cancelled",
        null,
        400
      );
    }

    const oldStatus = log.log_status;

    await log.update(
      {
        log_status: CANCELLED,
        updated_by_id: req.user?.id || null,
      },
      { transaction: t }
    );

    await billingService.voidCharges({
      module_key: MODULE_KEY,
      entityId: log.id,
      user: { ...req.user, organization_id: orgId, facility_id: facilityId },
      transaction: t,
    });

    await t.commit();

    await auditService.logAction({
      user: req.user,
      module_key: MODULE_KEY,
      action: "cancel",
      entityId: id,
      entity: log,
      details: { from: oldStatus, to: CANCELLED },
    });

    return success(res, "✅ Registration Log cancelled & charges voided", log);
  } catch (err) {
    await t.rollback();
    return error(res, "❌ Failed to cancel registration log", err);
  }
};

/* ============================================================
   📌 VOID REGISTRATION LOG — MASTER PARITY
============================================================ */
export const voidRegistrationLog = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const role = (req.user?.roleNames?.[0] || "").toLowerCase();
    if (!["admin", "superadmin"].includes(role)) {
      return error(res, "❌ Only admin/superadmin can void logs", null, 403);
    }

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

    const log = await RegistrationLog.findOne({
      where: {
        id,
        organization_id: orgId,
        ...(facilityId && { facility_id: facilityId }),
      },
      transaction: t,
    });
    if (!log) {
      await t.rollback();
      return error(res, "❌ Registration Log not found", null, 404);
    }

    const oldStatus = log.log_status;

    await log.update(
      { log_status: "voided", updated_by_id: req.user?.id || null },
      { transaction: t }
    );

    await billingService.voidCharges({
      module_key: MODULE_KEY,
      entityId: log.id,
      user: { ...req.user, organization_id: orgId, facility_id: facilityId },
      transaction: t,
    });

    await t.commit();

    await auditService.logAction({
      user: req.user,
      module_key: MODULE_KEY,
      action: "void",
      entityId: id,
      entity: log,
      details: { from: oldStatus, to: "voided" },
    });

    return success(res, "✅ Registration Log voided and charges voided", log);
  } catch (err) {
    await t.rollback();
    return error(res, "❌ Failed to void registration log", err);
  }
};

/* ============================================================
   📌 SUBMIT REGISTRATION LOG — MASTER PARITY
============================================================ */
export const submitRegistrationLog = async (req, res) => {
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

    const log = await RegistrationLog.findOne({
      where: {
        id,
        organization_id: orgId,
        ...(facilityId && { facility_id: facilityId }),
      },
      transaction: t,
    });
    if (!log) {
      await t.rollback();
      return error(res, "❌ Registration Log not found", null, 404);
    }

    if (log.log_status !== REGISTRATION_LOG_STATUS[0]) {
      await t.rollback();
      return error(res, "❌ Only draft logs can be submitted", null, 400);
    }

    await log.update(
      { log_status: "pending", updated_by_id: req.user?.id || null },
      { transaction: t }
    );

    await t.commit();

    await auditService.logAction({
      user: req.user,
      module_key: MODULE_KEY,
      action: "submit",
      entityId: id,
      entity: log,
      details: { from: "draft", to: "pending" },
    });

    return success(res, "✅ Registration Log submitted (pending)", log);
  } catch (err) {
    await t.rollback();
    return error(res, "❌ Failed to submit registration log", err);
  }
};

/* ============================================================
   📌 DELETE REGISTRATION LOG — MASTER PARITY
============================================================ */
export const deleteRegistrationLog = async (req, res) => {
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
    const { organization_id, facility_id } = resolveOrgFacility(req);

    const log = await RegistrationLog.findOne({
      where: { id, organization_id, ...(facility_id && { facility_id }) },
      transaction: t,
    });
    if (!log) {
      await t.rollback();
      return error(res, "❌ Registration Log not found", null, 404);
    }

    const consultations = await log.countConsultations({ transaction: t });
    const admissions = await log.countAdmissions({ transaction: t });
    const triages = await log.countTriageRecords({ transaction: t });

    if (consultations || admissions || triages) {
      await t.rollback();
      return error(res, "❌ Cannot delete — downstream records exist", null, 400);
    }

    await billingService.voidCharges({
      module_key: MODULE_KEY,
      entityId: log.id,
      user: { ...req.user, organization_id, facility_id },
      transaction: t,
    });

    await log.update(
      { deleted_by_id: req.user?.id || null },
      { transaction: t }
    );
    await log.destroy({ transaction: t });

    await t.commit();

    const full = await RegistrationLog.findByPk(id, {
      include: REGISTRATION_LOG_INCLUDES,
      paranoid: false,
    });

    await auditService.logAction({
      user: req.user,
      module_key: MODULE_KEY,
      action: "delete",
      entityId: id,
      entity: full,
    });

    return success(res, "✅ Registration Log deleted (with billing rollback)", full);
  } catch (err) {
    await t.rollback();
    return error(res, "❌ Failed to delete registration log", err);
  }
};
