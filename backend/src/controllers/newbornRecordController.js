// 📁 controllers/newbornRecordController.js
import Joi from "joi";
import { Op } from "sequelize";

import {
  sequelize,
  NewbornRecord,
  Patient,
  DeliveryRecord,
  Organization,
  Facility,
  User,
} from "../models/index.js";

import { success, error } from "../utils/response.js";
import { buildQueryOptions } from "../utils/queryHelper.js";
import { NEWBORN_STATUS, GENDER_TYPES } from "../constants/enums.js";
import { authzService } from "../services/authzService.js";
import { auditService } from "../services/auditService.js";
import { FIELD_VISIBILITY_NEWBORN_RECORD } from "../constants/fieldVisibility.js";

import { resolveOrgFacility } from "../utils/resolveOrgFacility.js";
import { validate } from "../utils/validation.js";
import { isSuperAdmin } from "../utils/role-utils.js";
import { normalizeDateRangeLocal } from "../utils/date-utils.js";
import { makeModuleLogger } from "../utils/debugLogger.js";

/* ============================================================
   🔧 LOCAL DEBUG OVERRIDE
============================================================ */
const DEBUG_OVERRIDE = false;
const debug = makeModuleLogger("newbornRecordController", DEBUG_OVERRIDE);

const MODULE_KEY = "newbornRecord";

/* ============================================================
   🔖 STATUS MAP (ENUM-DRIVEN)
============================================================ */
const NBS = {
  ALIVE: NEWBORN_STATUS.ALIVE,
  DECEASED: NEWBORN_STATUS.DECEASED,
  TRANSFERRED: NEWBORN_STATUS.TRANSFERRED,
  VOIDED: NEWBORN_STATUS.VOIDED,
};

/* ============================================================
   🔗 SHARED INCLUDES
============================================================ */
const NEWBORN_INCLUDES = [
  { model: Patient, as: "mother", attributes: ["id", "pat_no", "first_name", "last_name"] },
  { model: DeliveryRecord, as: "deliveryRecord", attributes: ["id", "delivery_date", "status"] },
  { model: Organization, as: "organization", attributes: ["id", "name", "code"] },
  { model: Facility, as: "facility", attributes: ["id", "name", "code", "organization_id"] },
  { model: Facility, as: "transferFacility", attributes: ["id", "name", "code"] },
  { model: User, as: "createdBy", attributes: ["id", "first_name", "last_name"] },
  { model: User, as: "updatedBy", attributes: ["id", "first_name", "last_name"] },
  { model: User, as: "deletedBy", attributes: ["id", "first_name", "last_name"] },
  { model: User, as: "voidedBy", attributes: ["id", "first_name", "last_name", "email"] },
];

/* ============================================================
   📋 JOI SCHEMA (MASTER-ALIGNED)
============================================================ */
function buildNewbornSchema(user, mode = "create") {
  const base = {
    mother_id: Joi.string().uuid().required(),
    delivery_record_id: Joi.string().uuid().required(),
    gender: Joi.string().valid(...Object.values(GENDER_TYPES)).required(),

    birth_weight: Joi.number().precision(2).allow(null),
    birth_length: Joi.number().precision(2).allow(null),
    head_circumference: Joi.number().precision(2).allow(null),
    apgar_score_1min: Joi.number().integer().min(0).max(10).allow(null),
    apgar_score_5min: Joi.number().integer().min(0).max(10).allow(null),

    measurement_notes: Joi.string().allow("", null),
    complications: Joi.string().allow("", null),
    notes: Joi.string().allow("", null),

    organization_id: Joi.forbidden(),
    facility_id: Joi.forbidden(),
  };

  if (mode === "update") {
    Object.keys(base).forEach(k => (base[k] = base[k].optional()));
  }

  if (isSuperAdmin(user)) {
    base.organization_id = Joi.string().uuid().allow(null);
    base.facility_id = Joi.string().uuid().allow(null);
  }

  return Joi.object(base);
}

/* ============================================================
   📌 CREATE NEWBORN RECORD
============================================================ */
export const createNewbornRecord = async (req, res) => {
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
      buildNewbornSchema(req.user, "create"),
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

    const created = await NewbornRecord.create(
      {
        ...value,
        status: NBS.ALIVE,
        organization_id: orgId,
        facility_id: facilityId,
        created_by_id: req.user?.id || null,
      },
      { transaction: t }
    );

    await t.commit();

    const full = await NewbornRecord.findOne({
      where: { id: created.id },
      include: NEWBORN_INCLUDES,
    });

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "create",
      entityId: created.id,
      entity: full,
    });

    return success(res, "Newborn record created", full);
  } catch (err) {
    await t.rollback();
    debug.error("create → FAILED", err);
    return error(res, "Failed to create newborn record", err);
  }
};

/* ============================================================
   📌 UPDATE NEWBORN RECORD
============================================================ */
export const updateNewbornRecord = async (req, res) => {
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
      buildNewbornSchema(req.user, "update"),
      req.body
    );
    if (errors) {
      await t.rollback();
      return error(res, "Validation failed", errors, 400);
    }

    const record = await NewbornRecord.findOne({ where: { id }, transaction: t });
    if (!record) {
      await t.rollback();
      return error(res, "Newborn record not found", null, 404);
    }

    const { orgId, facilityId } = resolveOrgFacility({
      user: req.user,
      value,
      body: req.body,
    });

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

    const full = await NewbornRecord.findOne({
      where: { id },
      include: NEWBORN_INCLUDES,
    });

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "update",
      entityId: id,
      entity: full,
    });

    return success(res, "Newborn record updated", full);
  } catch (err) {
    await t.rollback();
    debug.error("update → FAILED", err);
    return error(res, "Failed to update newborn record", err);
  }
};

/* ============================================================
   📌 MARK NEWBORN AS DECEASED (alive → deceased)
============================================================ */
export const markDeceasedNewbornRecord = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module: MODULE_KEY,
      action: "mark_deceased",
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

    const record = await NewbornRecord.findOne({ where, transaction: t });
    if (!record) {
      await t.rollback();
      return error(res, "Newborn record not found", null, 404);
    }

    if (record.status !== NBS.ALIVE) {
      await t.rollback();
      return error(res, "Only alive newborns can be marked deceased", null, 400);
    }

    const oldStatus = record.status;

    await record.update(
      {
        status: NBS.DECEASED,
        death_reason: reason || null,
        death_time: new Date(),
        updated_by_id: req.user?.id || null,
      },
      { transaction: t }
    );

    await t.commit();

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "mark_deceased",
      entityId: id,
      entity: record,
      details: { from: oldStatus, to: NBS.DECEASED, reason: reason || null },
    });

    return success(res, "Newborn marked as deceased", record);
  } catch (err) {
    await t.rollback();
    return error(res, "Failed to mark newborn as deceased", err);
  }
};

/* ============================================================
   📌 TRANSFER NEWBORN (alive → transferred)
============================================================ */
export const transferNewbornRecord = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module: MODULE_KEY,
      action: "transfer",
      res,
    });
    if (!allowed) return;

    const { id } = req.params;
    const { reason, transfer_facility_id } = req.body;

    const where = { id };
    if (!isSuperAdmin(req.user)) {
      where.organization_id = req.user.organization_id;
      if (req.user.facility_id) where.facility_id = req.user.facility_id;
    }

    const record = await NewbornRecord.findOne({ where, transaction: t });
    if (!record) {
      await t.rollback();
      return error(res, "Newborn record not found", null, 404);
    }

    if (record.status !== NBS.ALIVE) {
      await t.rollback();
      return error(res, "Only alive newborns can be transferred", null, 400);
    }

    if (!transfer_facility_id) {
      await t.rollback();
      return error(res, "Transfer facility is required", null, 400);
    }

    const oldStatus = record.status;

    await record.update(
      {
        status: NBS.TRANSFERRED,
        transfer_reason: reason || null,
        transfer_facility_id,
        transfer_time: new Date(),
        updated_by_id: req.user?.id || null,
      },
      { transaction: t }
    );

    await t.commit();

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "transfer",
      entityId: id,
      entity: record,
      details: { from: oldStatus, to: NBS.TRANSFERRED, reason: reason || null },
    });

    return success(res, "Newborn transferred", record);
  } catch (err) {
    await t.rollback();
    return error(res, "Failed to transfer newborn", err);
  }
};

/* ============================================================
   📌 VOID NEWBORN RECORD (any → voided)
============================================================ */
export const voidNewbornRecord = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const role = (req.user?.roleNames?.[0] || "").toLowerCase();
    if (!["admin", "superadmin"].includes(role)) {
      return error(res, "Only admin/superadmin can void newborn records", null, 403);
    }

    const { id } = req.params;
    const { reason } = req.body;

    const where = { id };
    if (!isSuperAdmin(req.user)) {
      where.organization_id = req.user.organization_id;
      if (req.user.facility_id) where.facility_id = req.user.facility_id;
    }

    const record = await NewbornRecord.findOne({ where, transaction: t });
    if (!record) {
      await t.rollback();
      return error(res, "Newborn record not found", null, 404);
    }

    const oldStatus = record.status;

    await record.update(
      {
        status: NBS.VOIDED,
        void_reason: reason || null,
        voided_by_id: req.user?.id || null,
        voided_at: new Date(),
        updated_by_id: req.user?.id || null,
      },
      { transaction: t }
    );

    await t.commit();

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "void",
      entityId: id,
      entity: record,
      details: { from: oldStatus, to: NBS.VOIDED, reason: reason || null },
    });

    return success(res, "Newborn record voided", record);
  } catch (err) {
    await t.rollback();
    return error(res, "Failed to void newborn record", err);
  }
};
/* ============================================================
   📌 DELETE NEWBORN RECORD (Soft Delete)
============================================================ */
export const deleteNewbornRecord = async (req, res) => {
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
    }

    const record = await NewbornRecord.findOne({ where, transaction: t });
    if (!record) {
      await t.rollback();
      return error(res, "Newborn record not found", null, 404);
    }

    const oldStatus = record.status;

    await record.update(
      { deleted_by_id: req.user?.id || null },
      { transaction: t }
    );

    await record.destroy({ transaction: t });

    await t.commit();

    const full = await NewbornRecord.findOne({
      where: { id },
      include: NEWBORN_INCLUDES,
      paranoid: false,
    });

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "delete",
      entityId: id,
      entity: full,
      details: { from: oldStatus, to: "deleted" },
    });

    return success(res, "Newborn record deleted", full);
  } catch (err) {
    await t.rollback();
    return error(res, "Failed to delete newborn record", err);
  }
};

/* ============================================================
   📌 GET ALL NEWBORN RECORDS LITE
============================================================ */
export const getAllNewbornRecordsLite = async (req, res) => {
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

    let statusFilter = [NBS.ALIVE];
    if (status) {
      statusFilter = Array.isArray(status) ? status : [status];
    }

    const where = {
      status: { [Op.in]: statusFilter },
    };

    if (!isSuperAdmin(req.user)) {
      where.organization_id = req.user.organization_id;
      if (role === "facility_head") {
        where.facility_id = req.user.facility_id;
      }
    }

    if (q) {
      where[Op.or] = [
        { notes: { [Op.iLike]: `%${q}%` } },
        { complications: { [Op.iLike]: `%${q}%` } },
      ];
    }

    const rows = await NewbornRecord.findAll({
      where,
      attributes: ["id", "gender", "birth_weight", "status", "created_at"],
      include: [
        { model: Patient, as: "mother", attributes: ["id", "pat_no", "first_name", "last_name"] },
        { model: DeliveryRecord, as: "deliveryRecord", attributes: ["id", "delivery_date"] },
      ],
      order: [["created_at", "DESC"]],
      limit: 20,
    });

    const records = rows.map(r => ({
      id: r.id,
      mother: r.mother
        ? `${r.mother.pat_no} - ${r.mother.first_name} ${r.mother.last_name}`
        : "",
      delivery_date: r.deliveryRecord?.delivery_date || null,
      gender: r.gender,
      weight: r.birth_weight,
      status: r.status,
      created_at: r.created_at,
    }));

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "list_lite",
      details: { query: q || null, returned: records.length },
    });

    return success(res, "Newborn records loaded (lite)", { records });
  } catch (err) {
    return error(res, "Failed to load newborn records (lite)", err);
  }
};

/* ============================================================
   📌 GET ALL NEWBORN RECORDS (MASTER-ALIGNED)
============================================================ */
export const getAllNewbornRecords = async (req, res) => {
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
      FIELD_VISIBILITY_NEWBORN_RECORD[role] ||
      FIELD_VISIBILITY_NEWBORN_RECORD.staff;

    const safeFields = visibleFields.filter(f => f !== "actions");

    const options = buildQueryOptions(
      req,
      "created_at",
      "DESC",
      safeFields
    );

    /* ========================================================
       🧹 STRIP UI-ONLY FILTERS
    ======================================================== */
    delete options.filters?.dateRange;
    delete options.filters?.light;

    options.where = options.where || {};

    /* ========================================================
       🧭 ORG / FACILITY SCOPING
    ======================================================== */
    if (!isSuperAdmin(req.user)) {
      options.where.organization_id = req.user.organization_id;
      if (role === "facility_head") {
        options.where.facility_id = req.user.facility_id;
      }
    }

    /* ========================================================
       📅 DATE RANGE FILTER
    ======================================================== */
    const dateRange = normalizeDateRangeLocal(req.query.dateRange);
    if (dateRange) {
      options.where.created_at = {
        [Op.between]: [dateRange.start, dateRange.end],
      };
    }

    /* ========================================================
       🔍 SEARCH
    ======================================================== */
    if (options.search) {
      options.where[Op.or] = [
        { notes: { [Op.iLike]: `%${options.search}%` } },
        { complications: { [Op.iLike]: `%${options.search}%` } },
      ];
    }

    /* ========================================================
       🔍 EXTRA FILTERS
    ======================================================== */
    if (req.query.mother_id) {
      options.where.mother_id = req.query.mother_id;
    }

    if (req.query.delivery_record_id) {
      options.where.delivery_record_id = req.query.delivery_record_id;
    }

    if (req.query.gender) {
      options.where.gender = req.query.gender;
    }

    if (req.query.status) {
      const statuses = Array.isArray(req.query.status)
        ? req.query.status
        : [req.query.status];
      options.where.status = { [Op.in]: statuses };
    }

    const { count, rows } = await NewbornRecord.findAndCountAll({
      where: options.where,
      include: [...NEWBORN_INCLUDES, ...(options.include || [])],
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

    return success(res, "Newborn records loaded", {
      records: rows,
      pagination: {
        total: count,
        page: options.pagination.page,
        pageCount: Math.ceil(count / options.pagination.limit),
      },
    });
  } catch (err) {
    return error(res, "Failed to load newborn records", err);
  }
};

/* ============================================================
   📌 GET NEWBORN RECORD BY ID (MASTER-ALIGNED)
============================================================ */
export const getNewbornRecordById = async (req, res) => {
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
    }

    const record = await NewbornRecord.findOne({
      where,
      include: NEWBORN_INCLUDES,
    });

    if (!record) {
      return error(res, "Newborn record not found", null, 404);
    }

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "view",
      entityId: id,
      entity: record,
    });

    return success(res, "Newborn record loaded", record);
  } catch (err) {
    return error(res, "Failed to load newborn record", err);
  }
};
