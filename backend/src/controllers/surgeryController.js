// 📁 backend/src/controllers/surgeryController.js
// ============================================================================
// 🧠 VytalGuard HMS – Surgery Controller (Enterprise Master Pattern Aligned)
// ----------------------------------------------------------------------------
// ✅ Includes:
//    - Full CRUD (Create, Update, Get All, Get by ID)
//    - Role-safe tenant scoping
//    - Lifecycle summary via buildDynamicSummary()
//    - Audit + permission driven actions
//    - Consistent pagination, filtering, and search
// ============================================================================

import Joi from "joi";
import { Op } from "sequelize";
import {
  sequelize,
  Surgery,
  Patient,
  Employee,
  Consultation,
  Invoice,
  BillableItem,
  User,
  Organization,
  Facility,
  Department,
} from "../models/index.js";
import { success, error } from "../utils/response.js";
import { buildQueryOptions } from "../utils/queryHelper.js";
import { SURGERY_STATUS } from "../constants/enums.js";
import { authzService } from "../services/authzService.js";
import { auditService } from "../services/auditService.js";
import { FIELD_VISIBILITY_SURGERY } from "../constants/fieldVisibility.js";
import { resolveClinicalLinks } from "../utils/autoLinkHelpers.js";
import { buildDynamicSummary } from "../utils/summaryHelper.js";
// 💵 Billing Utilities
import { billingService } from "../services/billingService.js";
import { shouldTriggerBilling } from "../constants/billing.js";

// 🔖 Local constants
const MODULE_KEY = "surgery";
const SSS = {
  SCHEDULED: SURGERY_STATUS[0],
  IN_PROGRESS: SURGERY_STATUS[1],
  COMPLETED: SURGERY_STATUS[2],
  VERIFIED: SURGERY_STATUS[3],
  FINALIZED: SURGERY_STATUS[4],
  CANCELLED: SURGERY_STATUS[5],
  VOIDED: SURGERY_STATUS[6],
};

/* ============================================================
   🔧 HELPERS
============================================================ */
function isSuperAdmin(user) {
  if (!user) return false;
  const roles = Array.isArray(user.roleNames)
    ? user.roleNames
    : [user.role || ""];
  return roles.map(r => r.toLowerCase().replace(/\s+/g, "")).includes("superadmin");
}
function isOrgOwner(user) {
  if (!user) return false;
  const roles = Array.isArray(user.roleNames)
    ? user.roleNames
    : [user.role || ""];
  return roles.map(r => r.toLowerCase().replace(/\s+/g, "")).includes("orgowner");
}

/* ============================================================
   🔗 SHARED INCLUDES
============================================================ */
const SURGERY_INCLUDES = [
  { model: Patient, as: "patient", attributes: ["id", "pat_no", "first_name", "last_name", "gender"] },
  { model: Employee.unscoped(), as: "surgeon", attributes: ["id", "first_name", "last_name"] },
  { model: Consultation, as: "consultation", attributes: ["id", "consultation_date", "status"] },
  { model: Invoice, as: "invoice", attributes: ["id", "invoice_number", "status", "total"] },
  { model: BillableItem, as: "billableItem", attributes: ["id", "name", "price"] },
  { model: Department, as: "department", attributes: ["id", "name"] },
  { model: Organization, as: "organization", attributes: ["id", "name", "code"] },
  { model: Facility, as: "facility", attributes: ["id", "name", "code", "organization_id"] },
  { model: User, as: "createdBy", attributes: ["id", "first_name", "last_name"] },
  { model: User, as: "updatedBy", attributes: ["id", "first_name", "last_name"] },
  { model: User, as: "deletedBy", attributes: ["id", "first_name", "last_name"] },
];

/* ============================================================
   📋 JOI SCHEMA BUILDER
============================================================ */
function buildSurgerySchema(mode = "create") {
  const base = {
    patient_id: Joi.string().uuid().required(),
    surgeon_id: Joi.string().uuid().required(),
    department_id: Joi.string().uuid().allow(null, ""),
    invoice_id: Joi.string().uuid().allow(null, ""),
    billable_item_id: Joi.string().uuid().required(),
    scheduled_date: Joi.date().required(),
    surgery_type: Joi.string().allow("", null),
    duration_minutes: Joi.number().integer().allow(null),
    anesthesia_type: Joi.string().allow("", null),
    complications: Joi.string().allow("", null),
    notes: Joi.string().allow("", null),
    document_url: Joi.string().allow("", null),
    is_emergency: Joi.boolean().default(false),
    organization_id: Joi.string().uuid().allow(null),
    facility_id: Joi.string().uuid().allow(null),
  };
  if (mode === "update") {
    Object.keys(base).forEach(k => (base[k] = base[k].optional()));
  }
  return Joi.object(base);
}

/* ============================================================
   📌 CREATE SURGERY
============================================================ */
export const createSurgery = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module: MODULE_KEY,
      action: "create",
      res,
    });
    if (!allowed) return;

    const schema = buildSurgerySchema("create");
    const { error: validationError, value } = schema.validate(req.body, { stripUnknown: true });
    if (validationError) {
      await t.rollback();
      return error(res, "Validation failed", validationError, 400);
    }

    let orgId, facilityId;
    if (isSuperAdmin(req.user)) {
      orgId = value.organization_id;
      facilityId = value.facility_id;
      if (!orgId || !facilityId) {
        await t.rollback();
        return error(res, "Organization and Facility required for Super Admin", null, 400);
      }
    } else {
      orgId = req.user.organization_id;
      facilityId = req.user.facility_id;
    }

    value._currentUser = req.user;
    await resolveClinicalLinks(value, orgId, facilityId, t);

    const created = await Surgery.create(
      {
        ...value,
        organization_id: orgId,
        facility_id: facilityId,
        status: SSS.SCHEDULED,
        created_by_id: req.user?.id || null,
      },
      { transaction: t }
    );

    await t.commit();

    const full = await Surgery.findOne({ where: { id: created.id }, include: SURGERY_INCLUDES });

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "create",
      entityId: created.id,
      entity: created,
      details: { ...value, status: SSS.SCHEDULED },
    });

    return success(res, "✅ Surgery created", full);
  } catch (err) {
    await t.rollback();
    return error(res, "❌ Failed to create surgery", err);
  }
};

/* ============================================================
   📌 UPDATE SURGERY
============================================================ */
export const updateSurgery = async (req, res) => {
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
    const schema = buildSurgerySchema("update");
    const { error: validationError, value } = schema.validate(req.body, { stripUnknown: true });
    if (validationError) {
      await t.rollback();
      return error(res, "Validation failed", validationError, 400);
    }

    const record = await Surgery.findOne({ where: { id }, transaction: t });
    if (!record) {
      await t.rollback();
      return error(res, "Surgery not found", null, 404);
    }

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

    value._currentUser = req.user;
    await resolveClinicalLinks(value, orgId, facilityId, t);

    await record.update(
      { ...value, updated_by_id: req.user?.id || null },
      { transaction: t }
    );

    await t.commit();

    const full = await Surgery.findOne({ where: { id }, include: SURGERY_INCLUDES });

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "update",
      entityId: id,
      entity: full,
      details: value,
    });

    return success(res, "✅ Surgery updated", full);
  } catch (err) {
    await t.rollback();
    return error(res, "❌ Failed to update surgery", err);
  }
};

/* ============================================================
   📌 GET ALL SURGERIES (with Summary)
============================================================ */
export const getAllSurgeries = async (req, res) => {
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module: MODULE_KEY,
      action: "read",
      res,
    });
    if (!allowed) return;

    const role = (req.user?.roleNames?.[0] || "staff").toLowerCase().replace(/\s+/g, "");
    const visibleFields = FIELD_VISIBILITY_SURGERY[role] || FIELD_VISIBILITY_SURGERY.staff;
    const FRONTEND_ONLY_FIELDS = ["actions"];
    const safeFields = visibleFields.filter(f => !FRONTEND_ONLY_FIELDS.includes(f));

    const options = buildQueryOptions(req, "scheduled_date", "DESC", safeFields);
    options.where = options.where || {};

    if (!isSuperAdmin(req.user)) {
      options.where.organization_id = req.user.organization_id;
      if (role === "facilityhead") options.where.facility_id = req.user.facility_id;
    } else {
      if (req.query.organization_id) options.where.organization_id = req.query.organization_id;
      if (req.query.facility_id) options.where.facility_id = req.query.facility_id;
    }

    if (options.search) {
      options.where[Op.or] = [
        { surgery_type: { [Op.iLike]: `%${options.search}%` } },
        { complications: { [Op.iLike]: `%${options.search}%` } },
        { notes: { [Op.iLike]: `%${options.search}%` } },
      ];
    }

    if (req.query.patient_id) options.where.patient_id = req.query.patient_id;
    if (req.query.surgeon_id) options.where.surgeon_id = req.query.surgeon_id;
    if (req.query.consultation_id) options.where.consultation_id = req.query.consultation_id;
    if (req.query.status) {
      const statuses = Array.isArray(req.query.status) ? req.query.status : [req.query.status];
      options.where.status = { [Op.in]: statuses };
    }

    const { count, rows } = await Surgery.findAndCountAll({
      where: options.where,
      include: SURGERY_INCLUDES,
      order: options.order,
      offset: options.offset,
      limit: options.limit,
    });

    // 🧠 Dynamic Summary (Enterprise Safe)
    const summary = await buildDynamicSummary({
      model: Surgery,
      options,
      statusEnums: SURGERY_STATUS,
      includeGender: true,
      genderJoin: { model: Patient, as: "patient" },
    });

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "list",
      details: { query: req.query, returned: count },
    });

    return success(res, "✅ Surgeries loaded", {
      records: rows,
      summary,
      pagination: {
        total: count,
        page: options.pagination.page,
        pageCount: Math.ceil(count / options.pagination.limit),
      },
    });
  } catch (err) {
    return error(res, "❌ Failed to load surgeries", err);
  }
};

/* ============================================================
   📌 GET SURGERY BY ID
============================================================ */
export const getSurgeryById = async (req, res) => {
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module: MODULE_KEY,
      action: "read",
      res,
    });
    if (!allowed) return;

    const { id } = req.params;
    const role = (req.user?.roleNames?.[0] || "staff").toLowerCase().replace(/\s+/g, "");

    const where = { id };
    if (!isSuperAdmin(req.user)) {
      where.organization_id = req.user.organization_id;
      if (role === "facilityhead") where.facility_id = req.user.facility_id;
    } else {
      if (req.query.organization_id) where.organization_id = req.query.organization_id;
      if (req.query.facility_id) where.facility_id = req.query.facility_id;
    }

    const record = await Surgery.findOne({ where, include: SURGERY_INCLUDES });
    if (!record) return error(res, "❌ Surgery not found", null, 404);

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "view",
      entityId: id,
      entity: record,
      details: { ids: [id] },
    });

    return success(res, "✅ Surgery loaded", record);
  } catch (err) {
    return error(res, "❌ Failed to load surgery", err);
  }
};

/* ============================================================
   📌 GET ALL SURGERIES LITE (with ?q= + ?status= support)
============================================================ */
export const getAllSurgeriesLite = async (req, res) => {
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

    let statusFilter = [SSS.SCHEDULED, SSS.IN_PROGRESS];
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
        { surgery_type: { [Op.iLike]: `%${q}%` } },
        { complications: { [Op.iLike]: `%${q}%` } },
        { notes: { [Op.iLike]: `%${q}%` } },
      ];
    }

    if (req.query.patient_id) where.patient_id = req.query.patient_id;
    if (req.query.surgeon_id) where.surgeon_id = req.query.surgeon_id;
    if (req.query.consultation_id) where.consultation_id = req.query.consultation_id;

    const surgeries = await Surgery.findAll({
      where,
      attributes: ["id", "scheduled_date", "surgery_type", "status"],
      include: [
        { model: Patient, as: "patient", attributes: ["id", "pat_no", "first_name", "last_name"] },
        { model: Employee.unscoped(), as: "surgeon", attributes: ["id", "first_name", "last_name"] },
      ],
      order: [["scheduled_date", "DESC"]],
      limit: 20,
    });

    const result = surgeries.map(s => ({
      id: s.id,
      patient: s.patient ? `${s.patient.pat_no} - ${s.patient.first_name} ${s.patient.last_name}` : "",
      surgeon: s.surgeon ? `${s.surgeon.first_name} ${s.surgeon.last_name}` : "",
      surgery_type: s.surgery_type || "",
      date: s.scheduled_date,
      status: s.status,
    }));

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "list_lite",
      details: { query: q || null, returned: result.length },
    });

    return success(res, "✅ Surgeries loaded (lite)", { records: result });
  } catch (err) {
    return error(res, "❌ Failed to load surgeries (lite)", err);
  }
};

/* ============================================================
   📌 START SURGERY (scheduled → in_progress)
============================================================ */
export const startSurgery = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { id } = req.params;

    const rec = await Surgery.findOne({ where: { id }, transaction: t });
    if (!rec) return error(res, "❌ Surgery not found", null, 404);

    if (rec.status !== SSS.SCHEDULED) {
      await t.rollback();
      return error(res, "❌ Only scheduled surgeries can be started", null, 400);
    }

    const oldStatus = rec.status;

    await rec.update(
      { status: SSS.IN_PROGRESS, updated_by_id: req.user?.id || null },
      { transaction: t }
    );

    await t.commit();

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "start",
      entityId: id,
      entity: rec,
      details: { from: oldStatus, to: SSS.IN_PROGRESS },
    });

    return success(res, "✅ Surgery started (in-progress)", rec);
  } catch (err) {
    await t.rollback();
    return error(res, "❌ Failed to start surgery", err);
  }
};

/* ============================================================
   📌 COMPLETE SURGERY (in_progress → completed)
============================================================ */
export const completeSurgery = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { id } = req.params;

    const rec = await Surgery.findOne({ where: { id }, transaction: t });
    if (!rec) return error(res, "❌ Surgery not found", null, 404);

    if (rec.status !== SSS.IN_PROGRESS) {
      await t.rollback();
      return error(res, "❌ Only in-progress surgeries can be completed", null, 400);
    }

    const oldStatus = rec.status;

    await rec.update(
      { status: SSS.COMPLETED, updated_by_id: req.user?.id || null },
      { transaction: t }
    );

    if (shouldTriggerBilling(MODULE_KEY, SSS.COMPLETED)) {
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
      details: { from: oldStatus, to: SSS.COMPLETED },
    });

    return success(res, "✅ Surgery completed", rec);
  } catch (err) {
    await t.rollback();
    return error(res, "❌ Failed to complete surgery", err);
  }
};

/* ============================================================
   📌 CANCEL SURGERY (scheduled/in_progress → cancelled)
============================================================ */
export const cancelSurgery = async (req, res) => {
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

    const rec = await Surgery.findOne({ where, transaction: t });
    if (!rec) return error(res, "❌ Surgery not found", null, 404);

    if (![SSS.SCHEDULED, SSS.IN_PROGRESS].includes(rec.status)) {
      await t.rollback();
      return error(res, "❌ Only scheduled or in-progress surgeries can be cancelled", null, 400);
    }

    const oldStatus = rec.status;

    await rec.update(
      {
        status: SSS.CANCELLED,
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
      action: "cancel",
      entityId: id,
      entity: rec,
      details: { from: oldStatus, to: SSS.CANCELLED, reason: reason || null },
    });

    return success(res, "✅ Surgery cancelled & charges voided", rec);
  } catch (err) {
    await t.rollback();
    return error(res, "❌ Failed to cancel surgery", err);
  }
};
/* ============================================================
   📌 VOID SURGERY (any → voided, admin/superadmin only)
============================================================ */
export const voidSurgery = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const role = (req.user?.roleNames?.[0] || "").toLowerCase();
    if (!["admin", "superadmin"].includes(role)) {
      return error(res, "❌ Only admin/superadmin can void surgeries", null, 403);
    }

    const { id } = req.params;
    const { reason } = req.body;

    const where = { id };
    if (!isSuperAdmin(req.user)) {
      where.organization_id = req.user.organization_id;
      if (role === "facility_head") where.facility_id = req.user.facility_id;
    }

    const rec = await Surgery.findOne({ where, transaction: t });
    if (!rec) return error(res, "❌ Surgery not found", null, 404);

    const oldStatus = rec.status;

    await rec.update(
      {
        status: SSS.VOIDED,
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
      details: { from: oldStatus, to: SSS.VOIDED, reason: reason || null },
    });

    return success(res, "✅ Surgery voided & charges rolled back", rec);
  } catch (err) {
    await t.rollback();
    return error(res, "❌ Failed to void surgery", err);
  }
};

/* ============================================================
   📌 VERIFY SURGERY (completed → verified)
============================================================ */
export const verifySurgery = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { id } = req.params;

    const where = { id };
    const role = (req.user?.roleNames?.[0] || "staff").toLowerCase();
    if (!isSuperAdmin(req.user)) {
      where.organization_id = req.user.organization_id;
      if (role === "facility_head") where.facility_id = req.user.facility_id;
    }

    const rec = await Surgery.findOne({ where, transaction: t });
    if (!rec) return error(res, "❌ Surgery not found", null, 404);

    if (rec.status !== SSS.COMPLETED) {
      await t.rollback();
      return error(res, "❌ Only completed surgeries can be verified", null, 400);
    }

    const oldStatus = rec.status;

    await rec.update(
      { status: SSS.VERIFIED, verified_by_id: req.user?.id || null, verified_at: new Date() },
      { transaction: t }
    );

    if (shouldTriggerBilling(MODULE_KEY, SSS.VERIFIED)) {
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
      details: { from: oldStatus, to: SSS.VERIFIED },
    });

    return success(res, "✅ Surgery verified", rec);
  } catch (err) {
    await t.rollback();
    return error(res, "❌ Failed to verify surgery", err);
  }
};

/* ============================================================
   📌 DELETE SURGERY (Soft Delete + Billing Rollback)
============================================================ */
export const deleteSurgery = async (req, res) => {
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

    const rec = await Surgery.findOne({ where, transaction: t });
    if (!rec) {
      await t.rollback();
      return error(res, "❌ Surgery not found", null, 404);
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

    const full = await Surgery.findOne({
      where: { id },
      include: SURGERY_INCLUDES,
      paranoid: false,
    });

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "delete",
      entityId: id,
      entity: full,
    });

    return success(res, "✅ Surgery deleted (with billing rollback)", full);
  } catch (err) {
    await t.rollback();
    return error(res, "❌ Failed to delete surgery", err);
  }
};

/* ============================================================
   📌 FINALIZE SURGERY (verified → finalized, lock record)
============================================================ */
export const finalizeSurgery = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const role = (req.user?.roleNames?.[0] || "").toLowerCase();
    if (!["admin", "superadmin"].includes(role)) {
      return error(res, "❌ Only admin/superadmin can finalize surgeries", null, 403);
    }

    const { id } = req.params;

    const rec = await Surgery.findOne({ where: { id }, transaction: t });
    if (!rec) return error(res, "❌ Surgery not found", null, 404);

    if (rec.status !== SSS.VERIFIED) {
      await t.rollback();
      return error(res, "❌ Only verified surgeries can be finalized", null, 400);
    }

    const oldStatus = rec.status;

    await rec.update(
      {
        status: SSS.FINALIZED, // add "finalized" to SURGERY_STATUS if needed
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
      entity: rec,
      details: { from: oldStatus, to: SSS.FINALIZED },
    });

    return success(res, "✅ Surgery finalized (locked)", rec);
  } catch (err) {
    await t.rollback();
    return error(res, "❌ Failed to finalize surgery", err);
  }
};

