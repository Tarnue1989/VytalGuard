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

import { normalizeDateRangeLocal } from "../utils/date-utils.js";
import { success, error } from "../utils/response.js";
import { buildQueryOptions } from "../utils/queryHelper.js";
import { DELIVERY_STATUS } from "../constants/enums.js";
import { authzService } from "../services/authzService.js";
import { auditService } from "../services/auditService.js";
import { FIELD_VISIBILITY_DELIVERY_RECORD } from "../constants/fieldVisibility.js";
import { billingService } from "../services/billingService.js";

import { isSuperAdmin } from "../utils/role-utils.js";
import { resolveOrgFacility } from "../utils/resolveOrgFacility.js";
import { validate } from "../utils/validation.js";
import { makeModuleLogger } from "../utils/debugLogger.js";
import { buildDynamicSummary } from "../utils/summaryHelper.js";

/* ============================================================
   🔧 LOCAL DEBUG OVERRIDE (DELIVERY RECORD CONTROLLER)
============================================================ */
const DEBUG_OVERRIDE = false; // 👈 NEVER commit true
const debug = makeModuleLogger("deliveryRecordController", DEBUG_OVERRIDE);

const MODULE_KEY = "delivery_record";

/* ============================================================
   🔖 STATUS MAP (ENUM-DRIVEN)
============================================================ */
const DS = DELIVERY_STATUS;

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
   📋 JOI SCHEMA (MASTER-ALIGNED)
============================================================ */
function buildDeliverySchema(user, mode = "create") {
  const base = {
    patient_id: Joi.string().uuid().required(),
    consultation_id: Joi.string().uuid().allow("", null),
    doctor_id: Joi.string().uuid().allow("", null),
    midwife_id: Joi.string().uuid().allow("", null),
    department_id: Joi.string().uuid().allow("", null),
    billable_item_id: Joi.string().uuid().required(),
    invoice_id: Joi.string().uuid().allow("", null),

    delivery_date: Joi.date().required(),
    delivery_type: Joi.string().allow("", null),
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

    // system-scoped
    organization_id: Joi.forbidden(),
    facility_id: Joi.forbidden(),
  };

  if (mode === "update") {
    Object.keys(base).forEach(k => {
      base[k] = base[k].optional();
    });
  }

  if (isSuperAdmin(user)) {
    base.organization_id = Joi.string().uuid().allow("", null);
    base.facility_id = Joi.string().uuid().allow("", null);
  }

  return Joi.object(base);
}

/* ============================================================
   📌 CREATE DELIVERY RECORD (MASTER-ALIGNED)
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

    debug.log("create → incoming body", req.body);

    const { value, errors } = validate(
      buildDeliverySchema(req.user, "create"),
      req.body
    );

    if (errors) {
      debug.warn("create → validation error", errors);
      await t.rollback();
      return error(res, "Validation failed", errors, 400);
    }

    if (value.billable_item_id) {
      const billItem = await BillableItem.findByPk(value.billable_item_id, {
        attributes: ["name"],
      });
      if (billItem) value.delivery_type = billItem.name;
    }

    const { orgId, facilityId } = resolveOrgFacility({
      user: req.user,
      value,
      body: req.body,
    });

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
      entity: full,
    });

    return success(res, "Delivery record created", full);
  } catch (err) {
    await t.rollback();
    debug.error("create → FAILED", err);
    return error(res, "Failed to create delivery record", err);
  }
};
/* ============================================================
   📌 UPDATE DELIVERY RECORD — MASTER-ALIGNED + LOCKED STATES
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
    debug.log("update → incoming body", req.body);

    const { value, errors } = validate(
      buildDeliverySchema(req.user, "update"),
      req.body
    );

    if (errors) {
      debug.warn("update → validation error", errors);
      await t.rollback();
      return error(res, "Validation failed", errors, 400);
    }

    /* ================= ORG / FACILITY (MASTER) ================= */
    const { orgId, facilityId } = resolveOrgFacility({
      user: req.user,
      value,
      body: req.body,
    });

    const where = { id };
    if (!isSuperAdmin(req.user)) {
      where.organization_id = orgId;
      if (facilityId) where.facility_id = facilityId;
    }

    const record = await DeliveryRecord.findOne({ where, transaction: t });
    if (!record) {
      await t.rollback();
      return error(res, "Delivery record not found", null, 404);
    }

    /* ================= LOCK FINAL STATES ================= */
    if ([DS.FINALIZED, DS.VOIDED].includes(record.status)) {
      await t.rollback();
      return error(
        res,
        "Finalized or voided delivery records cannot be modified",
        null,
        400
      );
    }

    /* ================= DELIVERY TYPE AUTO-REFRESH ================= */
    if (
      value.billable_item_id &&
      value.billable_item_id !== record.billable_item_id
    ) {
      const billItem = await BillableItem.findByPk(value.billable_item_id, {
        attributes: ["name"],
      });
      if (billItem) value.delivery_type = billItem.name;
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
    });

    return success(res, "Delivery record updated", full);
  } catch (err) {
    await t.rollback();
    debug.error("update → FAILED", err);
    return error(res, "Failed to update delivery record", err);
  }
};


/* ============================================================
   📌 START DELIVERY (scheduled → in_progress) — MASTER-ALIGNED
============================================================ */
export const startDeliveryRecord = async (req, res) => {
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
    debug.log("start → request", { id });

    const where = { id };
    if (!isSuperAdmin(req.user)) {
      where.organization_id = req.user.organization_id;
      if (req.user.facility_id) where.facility_id = req.user.facility_id;
    }

    const record = await DeliveryRecord.findOne({ where, transaction: t });
    if (!record) {
      await t.rollback();
      return error(res, "Delivery record not found", null, 404);
    }

    /* ================= MASTER STATE GUARDS ================= */
    if ([DS.FINALIZED, DS.VOIDED].includes(record.status)) {
      await t.rollback();
      return error(
        res,
        "Finalized or voided delivery records cannot be started",
        null,
        400
      );
    }

    if (record.status !== DS.SCHEDULED) {
      await t.rollback();
      return error(
        res,
        "Only scheduled delivery records can be started",
        null,
        400
      );
    }

    const oldStatus = record.status;

    await record.update(
      {
        status: DS.IN_PROGRESS,
        updated_by_id: req.user?.id || null,
      },
      { transaction: t }
    );

    /* ================= BILLING (MASTER RULE) ================= */
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

    await t.commit();

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "start",
      entityId: id,
      entity: record,
      details: { from: oldStatus, to: DS.IN_PROGRESS },
    });

    return success(res, "Delivery started (in progress)", record);
  } catch (err) {
    await t.rollback();
    debug.error("start → FAILED", err);
    return error(res, "Failed to start delivery record", err);
  }
};

/* ============================================================
   📌 COMPLETE DELIVERY (in_progress → completed) — MASTER-ALIGNED
============================================================ */
export const completeDeliveryRecord = async (req, res) => {
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
    debug.log("complete → request", { id });

    const where = { id };
    if (!isSuperAdmin(req.user)) {
      where.organization_id = req.user.organization_id;
      if (req.user.facility_id) where.facility_id = req.user.facility_id;
    }

    const record = await DeliveryRecord.findOne({ where, transaction: t });
    if (!record) {
      await t.rollback();
      return error(res, "Delivery record not found", null, 404);
    }

    /* ================= MASTER STATE GUARDS ================= */
    if ([DS.VOIDED, DS.FINALIZED].includes(record.status)) {
      await t.rollback();
      return error(res, "Finalized or voided delivery records cannot be completed", null, 400);
    }

    if (record.status !== DS.IN_PROGRESS) {
      await t.rollback();
      return error(res, "Only in-progress delivery records can be completed", null, 400);
    }

    const oldStatus = record.status;

    await record.update(
      {
        status: DS.COMPLETED,
        updated_by_id: req.user?.id || null,
      },
      { transaction: t }
    );

    /* ================= BILLING (MASTER RULE) ================= */
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

    await t.commit();

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "complete",
      entityId: id,
      entity: record,
      details: { from: oldStatus, to: DS.COMPLETED },
    });

    return success(res, "Delivery marked as completed", record);
  } catch (err) {
    await t.rollback();
    debug.error("complete → FAILED", err);
    return error(res, "Failed to complete delivery record", err);
  }
};


/* ============================================================
   📌 CANCEL DELIVERY (scheduled/in_progress → cancelled) — MASTER
============================================================ */
export const cancelDeliveryRecord = async (req, res) => {
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
    debug.log("cancel → request", { id, reason });

    const where = { id };
    if (!isSuperAdmin(req.user)) {
      where.organization_id = req.user.organization_id;
      if (req.user.facility_id) where.facility_id = req.user.facility_id;
    }

    const record = await DeliveryRecord.findOne({ where, transaction: t });
    if (!record) {
      await t.rollback();
      return error(res, "Delivery record not found", null, 404);
    }

    /* ================= MASTER STATE GUARDS ================= */
    if ([DS.VOIDED, DS.FINALIZED].includes(record.status)) {
      await t.rollback();
      return error(res, "Finalized or voided delivery records cannot be cancelled", null, 400);
    }

    if (![DS.SCHEDULED, DS.IN_PROGRESS].includes(record.status)) {
      await t.rollback();
      return error(
        res,
        "Only scheduled or in-progress delivery records can be cancelled",
        null,
        400
      );
    }

    const oldStatus = record.status;

    await record.update(
      {
        status: DS.CANCELLED,
        cancel_reason: reason || null,
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
        to: DS.CANCELLED,
        reason: reason || null,
      },
    });

    return success(res, "Delivery cancelled and charges voided", record);
  } catch (err) {
    await t.rollback();
    debug.error("cancel → FAILED", err);
    return error(res, "Failed to cancel delivery record", err);
  }
};


/* ============================================================
   📌 VOID DELIVERY (any → voided) — MASTER-ALIGNED
============================================================ */
export const voidDeliveryRecord = async (req, res) => {
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
      if (req.user.facility_id) where.facility_id = req.user.facility_id;
    }

    const record = await DeliveryRecord.findOne({ where, transaction: t });
    if (!record) {
      await t.rollback();
      return error(res, "Delivery record not found", null, 404);
    }

    if (record.status === DS.VOIDED) {
      await t.rollback();
      return error(res, "Delivery record is already voided", null, 400);
    }

    const oldStatus = record.status;

    await record.update(
      {
        status: DS.VOIDED,
        void_reason: reason || null,
        voided_by_id: req.user?.id || null,
        voided_at: new Date(),
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
      details: { from: oldStatus, to: DS.VOIDED, reason: reason || null },
    });

    return success(res, "Delivery record voided", record);
  } catch (err) {
    await t.rollback();
    return error(res, "Failed to void delivery record", err);
  }
};

/* ============================================================
   📌 VERIFY DELIVERY (completed → verified) — MASTER-ALIGNED
============================================================ */
export const verifyDeliveryRecord = async (req, res) => {
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

    const where = { id };
    if (!isSuperAdmin(req.user)) {
      where.organization_id = req.user.organization_id;
      if (req.user.facility_id) where.facility_id = req.user.facility_id;
    }

    const record = await DeliveryRecord.findOne({ where, transaction: t });
    if (!record) {
      await t.rollback();
      return error(res, "Delivery record not found", null, 404);
    }

    /* ================= MASTER STATE GUARDS ================= */
    if ([DS.VOIDED, DS.FINALIZED].includes(record.status)) {
      await t.rollback();
      return error(res, "Finalized or voided delivery records cannot be verified", null, 400);
    }

    if (record.status !== DS.COMPLETED) {
      await t.rollback();
      return error(res, "Only completed delivery records can be verified", null, 400);
    }

    const oldStatus = record.status;

    await record.update(
      {
        status: DS.VERIFIED,
        verified_by_id: req.user?.id || null,
        verified_at: new Date(),
        updated_by_id: req.user?.id || null,
      },
      { transaction: t }
    );

    /* ================= BILLING (MASTER RULE) ================= */
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

    await t.commit();

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "verify",
      entityId: id,
      entity: record,
      details: { from: oldStatus, to: DS.VERIFIED },
    });

    return success(res, "Delivery record verified", record);
  } catch (err) {
    await t.rollback();
    return error(res, "Failed to verify delivery record", err);
  }
};


/* ============================================================
   📌 FINALIZE DELIVERY (verified → finalized) — MASTER-ALIGNED
============================================================ */
export const finalizeDeliveryRecord = async (req, res) => {
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

    const where = { id };
    if (!isSuperAdmin(req.user)) {
      where.organization_id = req.user.organization_id;
      if (req.user.facility_id) where.facility_id = req.user.facility_id;
    }

    const record = await DeliveryRecord.findOne({ where, transaction: t });
    if (!record) {
      await t.rollback();
      return error(res, "Delivery record not found", null, 404);
    }

    if (record.status !== DS.VERIFIED) {
      await t.rollback();
      return error(res, "Only verified delivery records can be finalized", null, 400);
    }

    const oldStatus = record.status;

    await record.update(
      {
        status: DS.FINALIZED,
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
      details: { from: oldStatus, to: DS.FINALIZED },
    });

    return success(res, "Delivery record finalized", record);
  } catch (err) {
    await t.rollback();
    return error(res, "Failed to finalize delivery record", err);
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

    const where = { id };
    if (!isSuperAdmin(req.user)) {
      where.organization_id = req.user.organization_id;
      if (req.user.facility_id) where.facility_id = req.user.facility_id;
    }

    const record = await DeliveryRecord.findOne({ where, transaction: t });
    if (!record) {
      await t.rollback();
      return error(res, "Delivery record not found", null, 404);
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

    return success(res, "Delivery record deleted", full);
  } catch (err) {
    await t.rollback();
    return error(res, "Failed to delete delivery record", err);
  }
};


/* ============================================================
   📌 GET ALL DELIVERY RECORDS — MASTER-ALIGNED + SUMMARY
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
      FIELD_VISIBILITY_DELIVERY_RECORD[role] ||
      FIELD_VISIBILITY_DELIVERY_RECORD.staff;

    const safeFields = visibleFields.filter(f => f !== "actions");

    const options = buildQueryOptions(req, "delivery_date", "DESC", safeFields);
    options.where = options.where || {};

    /* ================= UI-ONLY FILTER STRIP ================= */
    delete options.filters?.light;
    const { dateRange } = req.query || {};
    if (dateRange) delete options.where.dateRange;

    /* ================= ORG / FACILITY ================= */
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

    /* ================= DATE RANGE (MASTER) ================= */
    if (dateRange) {
      const range = normalizeDateRangeLocal(dateRange);
      if (range) {
        options.where.delivery_date = {
          [Op.between]: [range.start, range.end],
        };
      }
    }

    /* ================= GLOBAL SEARCH ================= */
    if (options.search) {
      options.where[Op.or] = [
        { delivery_type: { [Op.iLike]: `%${options.search}%` } },
        { notes: { [Op.iLike]: `%${options.search}%` } },
      ];
    }

    /* ================= EXTRA FILTERS ================= */
    if (req.query.patient_id)
      options.where.patient_id = req.query.patient_id;

    if (req.query.doctor_id)
      options.where.doctor_id = req.query.doctor_id;

    if (req.query.midwife_id)
      options.where.midwife_id = req.query.midwife_id;

    if (req.query.consultation_id)
      options.where.consultation_id = req.query.consultation_id;

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

    /* ================= MASTER SUMMARY ================= */
    const summary = { total: count };
    Object.values(DELIVERY_STATUS).forEach(status => {
      summary[status] = rows.filter(r => r.status === status).length;
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

    return success(res, "Delivery records loaded", {
      records: rows,
      summary,
      pagination: {
        total: count,
        page: options.pagination.page,
        pageCount: Math.ceil(count / options.pagination.limit),
      },
    });
  } catch (err) {
    return error(res, "Failed to load delivery records", err);
  }
};

/* ============================================================
   📌 GET ALL DELIVERY RECORDS LITE (MASTER-ALIGNED)
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

    const role = (req.user?.roleNames?.[0] || "staff").toLowerCase();
    const { q, status } = req.query;

    /* ========================================================
       🔒 BASE WHERE + STATUS (MASTER STYLE)
    ======================================================== */
    let statusFilter = [DS.SCHEDULED, DS.IN_PROGRESS];
    if (status) {
      statusFilter = Array.isArray(status) ? status : [status];
    }

    const where = {
      status: { [Op.in]: statusFilter },
    };

    /* ========================================================
       🧭 ORG / FACILITY SCOPING
    ======================================================== */
    if (!isSuperAdmin(req.user)) {
      where.organization_id = req.user.organization_id;
      if (role === "facility_head") {
        where.facility_id = req.user.facility_id;
      }
    } else {
      if (req.query.organization_id) where.organization_id = req.query.organization_id;
      if (req.query.facility_id) where.facility_id = req.query.facility_id;
    }

    /* ========================================================
       🔍 SEARCH (GLOBAL, ADDITIVE)
    ======================================================== */
    if (q) {
      where[Op.or] = [
        { delivery_type: { [Op.iLike]: `%${q}%` } },
        { notes: { [Op.iLike]: `%${q}%` } },
      ];
    }

    /* ========================================================
       🔍 EXTRA FILTERS (DB FIELDS ONLY)
    ======================================================== */
    if (req.query.patient_id) where.patient_id = req.query.patient_id;
    if (req.query.doctor_id) where.doctor_id = req.query.doctor_id;
    if (req.query.midwife_id) where.midwife_id = req.query.midwife_id;
    if (req.query.consultation_id) where.consultation_id = req.query.consultation_id;

    const rows = await DeliveryRecord.findAll({
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

    const records = rows.map(r => ({
      id: r.id,
      patient: r.patient
        ? `${r.patient.pat_no} - ${r.patient.first_name} ${r.patient.last_name}`
        : "",
      doctor: r.doctor ? `${r.doctor.first_name} ${r.doctor.last_name}` : "",
      midwife: r.midwife ? `${r.midwife.first_name} ${r.midwife.last_name}` : "",
      delivery_type: r.delivery_type || "",
      date: r.delivery_date,
      status: r.status,
    }));

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "list_lite",
      details: { query: q || null, returned: records.length },
    });

    return success(res, "Delivery records loaded (lite)", { records });
  } catch (err) {
    return error(res, "Failed to load delivery records (lite)", err);
  }
};


/* ============================================================
   📌 GET DELIVERY RECORD BY ID (MASTER-ALIGNED)
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

    if (!record) {
      return error(res, "Delivery record not found", null, 404);
    }

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "view",
      entityId: id,
      entity: record,
    });

    return success(res, "Delivery record loaded", record);
  } catch (err) {
    return error(res, "Failed to load delivery record", err);
  }
};
