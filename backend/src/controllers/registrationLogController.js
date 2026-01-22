// 📁 controllers/registrationLogController.js
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
import {
  REGISTRATION_LOG_STATUS,
  REGISTRATION_METHODS,
  REGISTRATION_CATEGORIES,
} from "../constants/enums.js";
import { authzService } from "../services/authzService.js";
import { auditService } from "../services/auditService.js";
import { FIELD_VISIBILITY_REGISTRATION_LOG } from "../constants/fieldVisibility.js";
import { billingService } from "../services/billingService.js";
import { shouldTriggerBilling } from "../constants/billing.js";
import { isSuperAdmin } from "../utils/role-utils.js";
import { makeModuleLogger } from "../utils/debugLogger.js";
import { normalizeDateRangeLocal } from "../utils/date-utils.js";

/* ============================================================
   🧭 MODULE CONFIG
============================================================ */
const MODULE_KEY = "registration_log";

/* ============================================================
   🔧 LOCAL DEBUG OVERRIDE (REGISTRATION LOG CONTROLLER)
============================================================ */
const DEBUG_OVERRIDE = true; // 👈 enable only when debugging
const debug = makeModuleLogger("registrationLogController", DEBUG_OVERRIDE);

/* ============================================================
   🔗 SHARED INCLUDES
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
   📋 ROLE-BASED JOI SCHEMA FACTORY (REGISTRATION LOG)
============================================================ */
function buildRegistrationLogSchema(userRole, mode = "create") {
  const base = {
    patient_id: Joi.string().uuid().required(),
    registrar_id: Joi.string().uuid().allow(null, ""),
    organization_id: Joi.string().uuid().allow(null),
    facility_id: Joi.string().uuid().allow(null),
    invoice_id: Joi.string().uuid().allow(null),
    registration_type_id: Joi.string().uuid().allow(null),

    registration_method: Joi.string()
      .valid(...REGISTRATION_METHODS)
      .required(),
    registration_source: Joi.string().max(120).allow("", null),
    patient_category: Joi.string()
      .valid(...REGISTRATION_CATEGORIES)
      .required(),
    visit_reason: Joi.string().allow("", null),
    is_emergency: Joi.boolean().default(false),
    registration_time: Joi.date().default(() => new Date()),
    notes: Joi.string().allow("", null),

    log_status: Joi.string()
      .valid(...REGISTRATION_LOG_STATUS)
      .default(REGISTRATION_LOG_STATUS[0]),
  };

  // 🔁 Update mode → all optional
  if (mode === "update") {
    Object.keys(base).forEach((k) => {
      base[k] = base[k].optional();
    });
  }

  // 🔐 Role-scoped field control
  switch (userRole) {
    case "superadmin":
      break;

    case "org_owner":
      base.organization_id = Joi.forbidden();
      base.facility_id = Joi.string().uuid().allow(null);
      break;

    case "admin":
      base.organization_id = Joi.forbidden();
      base.facility_id = Joi.string().uuid().required();
      break;

    case "facility_head":
    case "staff":
    default:
      base.organization_id = Joi.forbidden();
      base.facility_id = Joi.string().uuid().allow(null);
      break;
  }

  return Joi.object(base);
}

/* ============================================================
   📌 CREATE REGISTRATION LOG
============================================================ */
export const createRegistrationLog = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    debug.log("create → incoming body", req.body);

    const allowed = await authzService.checkPermission({
      user: req.user,
      module: MODULE_KEY,
      action: "create",
      res,
    });

    debug.log("PERMISSION CHECK", {
      module: MODULE_KEY,
      action: "create",
      allowed,
      userId: req.user?.id,
      roles: req.user?.roleNames,
    });

    if (!allowed) return;

    const role = (req.user?.roleNames?.[0] || "").toLowerCase();
    const schema = buildRegistrationLogSchema(role, "create");
    const { error: validationError, value } = schema.validate(req.body, {
      stripUnknown: true,
      abortEarly: false,
    });

    if (validationError) {
      debug.warn("create → validation failed", validationError.details);
      await t.rollback();
      return error(res, "Validation failed", validationError, 400);
    }

    /* ================= TENANT RESOLUTION ================= */
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

    /* ================= REGISTRAR AUTO-LINK ================= */
    let registrarId = value.registrar_id || null;
    if (!registrarId && req.user?.employee_id) {
      registrarId = req.user.employee_id;
    }

    const created = await RegistrationLog.create(
      {
        ...value,
        registrar_id: registrarId,
        organization_id: orgId,
        facility_id: facilityId,
        created_by_id: req.user?.id || null,
      },
      { transaction: t }
    );

    await t.commit();

    const full = await RegistrationLog.findOne({
      where: { id: created.id },
      include: REGISTRATION_LOG_INCLUDES,
    });

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "create",
      entityId: created.id,
      entity: full,
      details: value,
    });

    debug.log("create → success", { id: created.id });

    return success(res, "✅ Registration Log created", full);
  } catch (err) {
    debug.error("create → FAILED", err);
    await t.rollback();
    return error(res, "❌ Failed to create registration log", err);
  }
};

/* ============================================================
   📌 UPDATE REGISTRATION LOG
============================================================ */
export const updateRegistrationLog = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    debug.log("update → incoming request", {
      params: req.params,
      body: req.body,
      user: req.user?.id,
    });

    const allowed = await authzService.checkPermission({
      user: req.user,
      module: MODULE_KEY,
      action: "update",
      res,
    });

    debug.log("PERMISSION CHECK", {
      module: MODULE_KEY,
      action: "update",
      allowed,
      userId: req.user?.id,
      roles: req.user?.roleNames,
    });

    if (!allowed) return;

    const { id } = req.params;
    const role = (req.user?.roleNames?.[0] || "").toLowerCase();
    const schema = buildRegistrationLogSchema(role, "update");
    const { error: validationError, value } = schema.validate(req.body, {
      stripUnknown: true,
      abortEarly: false,
    });

    if (validationError) {
      debug.warn("update → validation failed", validationError.details);
      await t.rollback();
      return error(res, "Validation failed", validationError, 400);
    }

    /* ================= TENANT RESOLUTION ================= */
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

    const log = await RegistrationLog.findOne({
      where: { id, organization_id: orgId },
      transaction: t,
    });

    if (!log) {
      await t.rollback();
      return error(res, "Registration Log not found", null, 404);
    }

    const oldStatus = log.log_status;

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

    /* ================= BILLING CHECK ================= */
    if (oldStatus !== log.log_status && shouldTriggerBilling(MODULE_KEY, log.log_status)) {
      debug.log("billing → trigger", {
        id,
        from: oldStatus,
        to: log.log_status,
      });

      await billingService.triggerAutoBilling({
        module: MODULE_KEY,
        entity: log,
        user: { ...req.user, organization_id: orgId, facility_id: facilityId },
        transaction: t,
      });
    }

    await t.commit();

    const full = await RegistrationLog.findOne({
      where: { id },
      include: REGISTRATION_LOG_INCLUDES,
    });

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "update",
      entityId: id,
      entity: full,
      details: value,
    });

    debug.log("update → success", { id });

    return success(res, "✅ Registration Log updated", full);
  } catch (err) {
    debug.error("update → FAILED", err);
    await t.rollback();
    return error(res, "❌ Failed to update registration log", err);
  }
};
/* ============================================================
   📌 GET ALL REGISTRATION LOGS (MASTER FINAL + SUMMARY)
============================================================ */
export const getAllRegistrationLogs = async (req, res) => {
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module: MODULE_KEY,
      action: "read",
      res,
    });

    debug.log("PERMISSION CHECK", {
      module: MODULE_KEY,
      action: "read",
      allowed,
      userId: req.user?.id,
      roles: req.user?.roleNames,
    });

    if (!allowed) return;

    const role = (req.user?.roleNames?.[0] || "staff").toLowerCase();
    const visibleFields =
      FIELD_VISIBILITY_REGISTRATION_LOG[role] ||
      FIELD_VISIBILITY_REGISTRATION_LOG.staff;

    /* ============================================================
       🧠 QUERY OPTIONS (MASTER SAFE)
    ============================================================ */
    const options = buildQueryOptions(
      req,
      "registration_time",
      "DESC",
      visibleFields
    );

    options.where = options.where || {};

    /* ============================================================
       🧹 UI-ONLY FILTER STRIP (CRITICAL FIX)
       ❌ dateRange must NEVER reach Sequelize
    ============================================================ */
    const { dateRange } = req.query || {};
    if (dateRange) {
      delete options.where.dateRange;
    }

    /* ============================================================
       📅 DATE RANGE (MASTER PATTERN)
       UI-only → maps to REAL column
    ============================================================ */
    if (dateRange) {
      const { start, end } = normalizeDateRangeLocal(dateRange);
      options.where.registration_time = {
        [Op.between]: [start, end],
      };
    }

    /* ============================================================
       🏢 TENANT SCOPE (ENTERPRISE SAFE)
    ============================================================ */
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

    /* ============================================================
       🔍 GLOBAL SEARCH (MASTER SAFE)
    ============================================================ */
    if (options.search) {
      options.where[Op.or] = [
        { visit_reason: { [Op.iLike]: `%${options.search}%` } },
        { registration_source: { [Op.iLike]: `%${options.search}%` } },
      ];
    }

    /* ============================================================
       📦 QUERY
    ============================================================ */
    const { count, rows } = await RegistrationLog.findAndCountAll({
      where: options.where,
      include: [...REGISTRATION_LOG_INCLUDES, ...(options.include || [])],
      order: options.order,
      offset: options.offset,
      limit: options.limit,
    });

    /* ============================================================
       📊 SUMMARY (STATUS-BASED, PAGE-AWARE)
    ============================================================ */
    const summary = { total: count };
    REGISTRATION_LOG_STATUS.forEach((status) => {
      summary[status] = rows.filter(
        (r) => r.log_status === status
      ).length;
    });

    /* ============================================================
       🧾 AUDIT
    ============================================================ */
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

    debug.log("LIST → success", { returned: count });

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
    debug.error("LIST → FAILED", err);
    return error(res, "❌ Failed to load registration logs", err);
  }
};

/* ============================================================
   📌 GET REGISTRATION LOG BY ID
============================================================ */
export const getRegistrationLogById = async (req, res) => {
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module: MODULE_KEY,
      action: "read",
      res,
    });

    debug.log("PERMISSION CHECK", {
      module: MODULE_KEY,
      action: "read",
      allowed,
      userId: req.user?.id,
      roles: req.user?.roleNames,
    });

    if (!allowed) return;

    const { id } = req.params;
    const role = (req.user?.roleNames?.[0] || "staff").toLowerCase();

    const where = { id };

    /* ================= TENANT SCOPE ================= */
    if (!isSuperAdmin(req.user)) {
      where.organization_id = req.user.organization_id;
      if (role === "facility_head") {
        where.facility_id = req.user.facility_id;
      }
    } else {
      if (req.query.organization_id) {
        where.organization_id = req.query.organization_id;
      }
      if (req.query.facility_id) {
        where.facility_id = req.query.facility_id;
      }
    }

    const log = await RegistrationLog.findOne({
      where,
      include: REGISTRATION_LOG_INCLUDES,
    });

    if (!log) {
      return error(res, "❌ Registration Log not found", null, 404);
    }

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "view",
      entityId: id,
      entity: log,
    });

    debug.log("VIEW → success", { id });

    return success(res, "✅ Registration Log loaded", log);
  } catch (err) {
    debug.error("VIEW → FAILED", err);
    return error(res, "❌ Failed to load registration log", err);
  }
};

/* ============================================================
   📌 GET ALL REGISTRATION LOGS LITE (with ?q= support)
============================================================ */
export const getAllRegistrationLogsLite = async (req, res) => {
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module: MODULE_KEY,
      action: "read",
      res,
    });

    debug.log("PERMISSION CHECK", {
      module: MODULE_KEY,
      action: "read",
      allowed,
      userId: req.user?.id,
      roles: req.user?.roleNames,
    });

    if (!allowed) return;

    const { q } = req.query;
    const role = (req.user?.roleNames?.[0] || "").toLowerCase();

    const [, , ACTIVE] = REGISTRATION_LOG_STATUS;
    const where = { log_status: ACTIVE };

    /* ================= TENANT SCOPE ================= */
    if (!isSuperAdmin(req.user)) {
      where.organization_id = req.user.organization_id;
      if (role === "facility_head") {
        where.facility_id = req.user.facility_id;
      }
    } else {
      if (req.query.organization_id) {
        where.organization_id = req.query.organization_id;
      }
      if (req.query.facility_id) {
        where.facility_id = req.query.facility_id;
      }
    }

    /* ================= SEARCH ================= */
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

    const result = logs.map((l) => {
      const patientLabel = l.patient
        ? `${l.patient.pat_no} - ${l.patient.first_name} ${l.patient.last_name}`
        : "";

      const dateLabel = l.registration_time
        ? new Date(l.registration_time).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          })
        : "Unknown Date";

      return {
        id: l.id,
        label: `${dateLabel} · ${patientLabel} · ${l.visit_reason || "Visit"}`,
        patient: patientLabel,
        source: l.registration_source || "",
        reason: l.visit_reason || "",
        time: l.registration_time,
      };
    });

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "list_lite",
      details: { count: result.length, query: q || null, status: ACTIVE },
    });

    debug.log("LIST_LITE → success", { count: result.length });

    return success(res, "✅ Registration Logs loaded (lite)", {
      records: result,
    });
  } catch (err) {
    debug.error("LIST_LITE → FAILED", err);
    return error(res, "❌ Failed to load registration logs (lite)", err);
  }
};

/* ============================================================
   📌 TOGGLE REGISTRATION LOG STATUS
============================================================ */
export const toggleRegistrationLogStatus = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module: MODULE_KEY,
      action: "update",
      res,
    });

    debug.log("PERMISSION CHECK", {
      module: MODULE_KEY,
      action: "update",
      allowed,
      userId: req.user?.id,
      roles: req.user?.roleNames,
    });

    if (!allowed) return;

    const { id } = req.params;
    const role = (req.user?.roleNames?.[0] || "").toLowerCase();

    const where = { id };

    /* ================= TENANT SCOPE ================= */
    if (!isSuperAdmin(req.user)) {
      where.organization_id = req.user.organization_id;
      if (role === "facility_head") {
        where.facility_id = req.user.facility_id;
      }
    } else {
      if (req.query.organization_id) {
        where.organization_id = req.query.organization_id;
      }
      if (req.query.facility_id) {
        where.facility_id = req.query.facility_id;
      }
    }

    const log = await RegistrationLog.findOne({ where, transaction: t });
    if (!log) {
      await t.rollback();
      return error(res, "❌ Registration Log not found", null, 404);
    }

    const [, , ACTIVE, , CANCELLED] = REGISTRATION_LOG_STATUS;
    const oldStatus = log.log_status;
    let newStatus = log.log_status;

    if (oldStatus === ACTIVE) newStatus = CANCELLED;
    else if (oldStatus === CANCELLED) newStatus = ACTIVE;

    debug.log("STATUS TRANSITION", {
      id,
      from: oldStatus,
      to: newStatus,
    });

    await log.update(
      { log_status: newStatus, updated_by_id: req.user?.id || null },
      { transaction: t }
    );

    /* ================= BILLING ================= */
    if (oldStatus !== newStatus && shouldTriggerBilling(MODULE_KEY, newStatus)) {
      const existing = await InvoiceItem.findOne({
        where: { module: MODULE_KEY, entity_id: log.id, status: "applied" },
        transaction: t,
      });

      if (!existing) {
        debug.log("BILLING → trigger", { id, status: newStatus });

        await billingService.triggerAutoBilling({
          module: MODULE_KEY,
          entity: log,
          user: {
            ...req.user,
            organization_id: log.organization_id,
            facility_id: log.facility_id,
          },
          transaction: t,
        });
      }
    }

    if (newStatus === CANCELLED) {
      debug.log("BILLING → void", { id });

      await billingService.voidCharges({
        module: MODULE_KEY,
        entityId: log.id,
        user: {
          ...req.user,
          organization_id: log.organization_id,
          facility_id: log.facility_id,
        },
        transaction: t,
      });
    }

    await t.commit();

    const full = await RegistrationLog.findOne({
      where: { id },
      include: REGISTRATION_LOG_INCLUDES,
    });

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "toggle_status",
      entityId: id,
      entity: full,
      details: { from: oldStatus, to: newStatus },
    });

    debug.log("TOGGLE_STATUS → success", { id });

    return success(res, `✅ Registration Log status set to ${newStatus}`, full);
  } catch (err) {
    debug.error("TOGGLE_STATUS → FAILED", err);
    await t.rollback();
    return error(res, "❌ Failed to toggle registration log status", err);
  }
};
/* ============================================================
   📌 ACTIVATE REGISTRATION LOG (pending → active)
============================================================ */
export const activateRegistrationLog = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    debug.log("activate → incoming request", {
      params: req.params,
      user: req.user?.id,
    });

    const allowed = await authzService.checkPermission({
      user: req.user,
      module: MODULE_KEY,
      action: "update",
      res,
    });

    debug.log("PERMISSION CHECK", {
      module: MODULE_KEY,
      action: "update",
      allowed,
      userId: req.user?.id,
      roles: req.user?.roleNames,
    });

    if (!allowed) return;

    const { id } = req.params;

    const log = await RegistrationLog.findByPk(id, { transaction: t });
    if (!log) {
      await t.rollback();
      return error(res, "❌ Registration Log not found", null, 404);
    }

    if (log.log_status !== "pending") {
      await t.rollback();
      return error(res, "❌ Only pending logs can be activated", null, 400);
    }

    const oldStatus = log.log_status;

    debug.log("STATUS TRANSITION", {
      id,
      from: oldStatus,
      to: "active",
    });

    await log.update(
      { log_status: "active", updated_by_id: req.user?.id || null },
      { transaction: t }
    );

    /* ================= BILLING ================= */
    if (shouldTriggerBilling(MODULE_KEY, "active")) {
      const existing = await InvoiceItem.findOne({
        where: {
          module: MODULE_KEY,
          entity_id: log.id,
          status: "applied",
        },
        transaction: t,
      });

      if (!existing) {
        debug.log("BILLING → trigger", { id });

        await billingService.triggerAutoBilling({
          module: MODULE_KEY,
          entity: log,
          user: {
            ...req.user,
            organization_id: log.organization_id,
            facility_id: log.facility_id,
          },
          transaction: t,
        });
      }
    }

    await t.commit();

    const full = await RegistrationLog.findOne({
      where: { id },
      include: REGISTRATION_LOG_INCLUDES,
    });

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "activate",
      entityId: id,
      entity: full,
      details: { from: oldStatus, to: "active" },
    });

    debug.log("ACTIVATE → success", { id });

    return success(res, "✅ Registration Log activated", full);
  } catch (err) {
    debug.error("ACTIVATE → FAILED", err);
    await t.rollback();
    return error(res, "❌ Failed to activate registration log", err);
  }
};

/* ============================================================
   📌 DELETE REGISTRATION LOG (Soft Delete + Billing Rollback)
============================================================ */
export const deleteRegistrationLog = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module: MODULE_KEY,
      action: "delete",
      res,
    });

    debug.log("PERMISSION CHECK", {
      module: MODULE_KEY,
      action: "delete",
      allowed,
      userId: req.user?.id,
      roles: req.user?.roleNames,
    });

    if (!allowed) return;

    const { id } = req.params;
    const role = (req.user?.roleNames?.[0] || "").toLowerCase();

    const where = { id };

    /* ================= TENANT SCOPE ================= */
    if (!isSuperAdmin(req.user)) {
      where.organization_id = req.user.organization_id;
      if (role === "facility_head") {
        where.facility_id = req.user.facility_id;
      }
    } else {
      if (req.query.organization_id) where.organization_id = req.query.organization_id;
      if (req.query.facility_id) where.facility_id = req.query.facility_id;
    }

    const log = await RegistrationLog.findOne({ where, transaction: t });
    if (!log) {
      await t.rollback();
      return error(res, "❌ Registration Log not found", null, 404);
    }

    /* ================= DEPENDENCY CHECK ================= */
    const consultations = await log.countConsultations({ transaction: t });
    const admissions = await log.countAdmissions({ transaction: t });
    const triages = await log.countTriageRecords({ transaction: t });

    if (consultations > 0 || admissions > 0 || triages > 0) {
      await t.rollback();
      return error(res, "❌ Cannot delete — downstream records exist", null, 400);
    }

    debug.log("BILLING → void (delete)", { id });

    await billingService.voidCharges({
      module: MODULE_KEY,
      entityId: log.id,
      user: {
        ...req.user,
        organization_id: log.organization_id,
        facility_id: log.facility_id,
      },
      transaction: t,
    });

    await log.update(
      { deleted_by_id: req.user?.id || null },
      { transaction: t }
    );
    await log.destroy({ transaction: t });

    await t.commit();

    const full = await RegistrationLog.findOne({
      where: { id },
      include: REGISTRATION_LOG_INCLUDES,
      paranoid: false,
    });

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "delete",
      entityId: id,
      entity: full,
    });

    debug.log("DELETE → success", { id });

    return success(res, "✅ Registration Log deleted (with billing rollback)", full);
  } catch (err) {
    debug.error("DELETE → FAILED", err);
    await t.rollback();
    return error(res, "❌ Failed to delete registration log", err);
  }
};

/* ============================================================
   📌 COMPLETE REGISTRATION LOG (active → completed)
============================================================ */
export const completeRegistrationLog = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { id } = req.params;

    const log = await RegistrationLog.findByPk(id, { transaction: t });
    if (!log) {
      await t.rollback();
      return error(res, "❌ Registration Log not found", null, 404);
    }

    if (log.log_status !== "active") {
      await t.rollback();
      return error(res, "❌ Only active logs can be completed", null, 400);
    }

    const oldStatus = log.log_status;

    debug.log("STATUS TRANSITION", {
      id,
      from: oldStatus,
      to: "completed",
    });

    await log.update(
      { log_status: "completed", updated_by_id: req.user?.id || null },
      { transaction: t }
    );

    if (shouldTriggerBilling(MODULE_KEY, "completed")) {
      const existing = await InvoiceItem.findOne({
        where: {
          module: MODULE_KEY,
          entity_id: log.id,
          status: "applied",
        },
        transaction: t,
      });

      if (!existing) {
        debug.log("BILLING → trigger (complete)", { id });

        await billingService.triggerAutoBilling({
          module: MODULE_KEY,
          entity: log,
          user: {
            ...req.user,
            organization_id: log.organization_id,
            facility_id: log.facility_id,
          },
          transaction: t,
        });
      }
    }

    await t.commit();

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "complete",
      entityId: id,
      entity: log,
      details: { from: oldStatus, to: "completed" },
    });

    debug.log("COMPLETE → success", { id });

    return success(res, "✅ Registration Log marked as completed", log);
  } catch (err) {
    debug.error("COMPLETE → FAILED", err);
    await t.rollback();
    return error(res, "❌ Failed to complete registration log", err);
  }
};

/* ============================================================
   📌 CANCEL REGISTRATION LOG (pending/active → cancelled)
============================================================ */
export const cancelRegistrationLog = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { id } = req.params;

    const log = await RegistrationLog.findByPk(id, { transaction: t });
    if (!log) {
      await t.rollback();
      return error(res, "❌ Registration Log not found", null, 404);
    }

    if (!["pending", "active"].includes(log.log_status)) {
      await t.rollback();
      return error(res, "❌ Only pending or active logs can be cancelled", null, 400);
    }

    debug.log("STATUS TRANSITION", {
      id,
      from: log.log_status,
      to: "cancelled",
    });

    await log.update(
      { log_status: "cancelled", updated_by_id: req.user?.id || null },
      { transaction: t }
    );

    debug.log("BILLING → void (cancel)", { id });

    await billingService.voidCharges({
      module: MODULE_KEY,
      entityId: log.id,
      user: {
        ...req.user,
        organization_id: log.organization_id,
        facility_id: log.facility_id,
      },
      transaction: t,
    });

    await t.commit();

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "cancel",
      entityId: id,
      entity: log,
    });

    debug.log("CANCEL → success", { id });

    return success(res, "✅ Registration Log cancelled and charges voided", log);
  } catch (err) {
    debug.error("CANCEL → FAILED", err);
    await t.rollback();
    return error(res, "❌ Failed to cancel registration log", err);
  }
};
/* ============================================================
   📌 VOID REGISTRATION LOG (any → voided, admin/superadmin only)
============================================================ */
export const voidRegistrationLog = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    debug.log("void → incoming request", {
      params: req.params,
      user: req.user?.id,
    });

    const role = (req.user?.roleNames?.[0] || "").toLowerCase();
    if (!["admin", "superadmin"].includes(role)) {
      return error(res, "❌ Only admin/superadmin can void logs", null, 403);
    }

    const allowed = await authzService.checkPermission({
      user: req.user,
      module: MODULE_KEY,
      action: "update",
      res,
    });

    debug.log("PERMISSION CHECK", {
      module: MODULE_KEY,
      action: "update",
      allowed,
      userId: req.user?.id,
      roles: req.user?.roleNames,
    });

    if (!allowed) return;

    const { id } = req.params;

    const log = await RegistrationLog.findByPk(id, { transaction: t });
    if (!log) {
      await t.rollback();
      return error(res, "❌ Registration Log not found", null, 404);
    }

    debug.log("STATUS TRANSITION", {
      id,
      from: log.log_status,
      to: "voided",
    });

    await log.update(
      { log_status: "voided", updated_by_id: req.user?.id || null },
      { transaction: t }
    );

    debug.log("BILLING → void (manual)", { id });

    await billingService.voidCharges({
      module: MODULE_KEY,
      entityId: log.id,
      user: {
        ...req.user,
        organization_id: log.organization_id,
        facility_id: log.facility_id,
      },
      transaction: t,
    });

    await t.commit();

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "void",
      entityId: id,
      entity: log,
    });

    debug.log("VOID → success", { id });

    return success(res, "✅ Registration Log voided and charges voided", log);
  } catch (err) {
    debug.error("VOID → FAILED", err);
    await t.rollback();
    return error(res, "❌ Failed to void registration log", err);
  }
};

/* ============================================================
   📌 SUBMIT REGISTRATION LOG (draft → pending)
============================================================ */
export const submitRegistrationLog = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    debug.log("submit → incoming request", {
      params: req.params,
      user: req.user?.id,
    });

    const allowed = await authzService.checkPermission({
      user: req.user,
      module: MODULE_KEY,
      action: "update",
      res,
    });

    debug.log("PERMISSION CHECK", {
      module: MODULE_KEY,
      action: "update",
      allowed,
      userId: req.user?.id,
      roles: req.user?.roleNames,
    });

    if (!allowed) return;

    const { id } = req.params;

    const log = await RegistrationLog.findByPk(id, { transaction: t });
    if (!log) {
      await t.rollback();
      return error(res, "❌ Registration Log not found", null, 404);
    }

    // ⛔ Only allow submit if status is draft
    if (log.log_status !== REGISTRATION_LOG_STATUS[0]) {
      await t.rollback();
      return error(res, "❌ Only draft logs can be submitted", null, 400);
    }

    debug.log("STATUS TRANSITION", {
      id,
      from: "draft",
      to: "pending",
    });

    await log.update(
      { log_status: "pending", updated_by_id: req.user?.id || null },
      { transaction: t }
    );

    await t.commit();

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "submit",
      entityId: id,
      entity: log,
      details: { from: "draft", to: "pending" },
    });

    debug.log("SUBMIT → success", { id });

    return success(res, "✅ Registration Log submitted (pending)", log);
  } catch (err) {
    debug.error("SUBMIT → FAILED", err);
    await t.rollback();
    return error(res, "❌ Failed to submit registration log", err);
  }
};
