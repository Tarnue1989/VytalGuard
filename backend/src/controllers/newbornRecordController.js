// 📁 controllers/newbornRecordController.js
import Joi from "joi";
import { sequelize, NewbornRecord, Patient, DeliveryRecord, Organization, Facility, User } from "../models/index.js";
import { success, error } from "../utils/response.js";
import { NEWBORN_STATUS, GENDER_TYPES } from "../constants/enums.js";
import { authzService } from "../services/authzService.js";
import { auditService } from "../services/auditService.js";
import { FIELD_VISIBILITY_NEWBORN_RECORD } from "../constants/fieldVisibility.js";
import { Op } from "sequelize";
import { buildQueryOptions } from "../utils/queryHelper.js";


// 🔖 Local enum map
const NBS = {
  ALIVE: NEWBORN_STATUS[0],
  DECEASED: NEWBORN_STATUS[1],
  TRANSFERRED: NEWBORN_STATUS[2],
  VOIDED: NEWBORN_STATUS[3], 
};


const MODULE_KEY = "newborn-record";

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
const NEWBORN_INCLUDES = [
  { model: Patient, as: "mother", required: false, attributes: ["id", "pat_no", "first_name", "last_name"] },
  { model: DeliveryRecord, as: "deliveryRecord", required: false, attributes: ["id", "delivery_date", "status"] },
  { model: Organization, as: "organization", required: false, attributes: ["id", "name", "code"] },
  { model: Facility, as: "facility", required: false, attributes: ["id", "name", "code", "organization_id"] },

  // 🆕 add transfer facility association
  { model: Facility, as: "transferFacility", required: false, attributes: ["id", "name", "code"] },

  { model: User, as: "createdBy", required: false, attributes: ["id", "first_name", "last_name"] },
  { model: User, as: "updatedBy", required: false, attributes: ["id", "first_name", "last_name"] },
  { model: User, as: "deletedBy", required: false, attributes: ["id", "first_name", "last_name"] },

  // 🆕 add voidedBy association
  { model: User, as: "voidedBy", required: false, attributes: ["id", "first_name", "last_name", "email"] },
];


/* ============================================================
   📋 JOI SCHEMA
   ============================================================ */
function buildNewbornSchema(mode = "create") {
  const base = {
    organization_id: Joi.string().uuid().allow(null),
    facility_id: Joi.string().uuid().allow(null),
    mother_id: Joi.string().uuid().required(),
    delivery_record_id: Joi.string().uuid().required(),
    gender: Joi.string().valid(...GENDER_TYPES).required(),
    birth_weight: Joi.number().precision(2).allow(null),
    birth_length: Joi.number().precision(2).allow(null),
    head_circumference: Joi.number().precision(2).allow(null),
    apgar_score_1min: Joi.number().integer().min(0).max(10).allow(null),
    apgar_score_5min: Joi.number().integer().min(0).max(10).allow(null),
    measurement_notes: Joi.string().allow("", null),
    complications: Joi.string().allow("", null),
    notes: Joi.string().allow("", null),
    // 🚼 Lifecycle → controlled by lifecycle endpoints
    death_reason: Joi.string().allow("", null),
    death_time: Joi.date().allow(null),
    transfer_reason: Joi.string().allow("", null),
    transfer_facility_id: Joi.string().uuid().allow(null),
    transfer_time: Joi.date().allow(null),
    void_reason: Joi.string().allow("", null),
    voided_by_id: Joi.string().uuid().allow(null),
    voided_at: Joi.date().allow(null),
  };

  if (mode === "update") {
    Object.keys(base).forEach(k => { base[k] = base[k].optional(); });
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

    const schema = buildNewbornSchema("create");
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
        return error(res, "Organization and Facility are required for superadmin", null, 400);
      }
    } else {
      orgId = req.user.organization_id;
      facilityId = req.user.facility_id;
    }

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

    const full = await NewbornRecord.findOne({ where: { id: created.id }, include: NEWBORN_INCLUDES });

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "create",
      entityId: created.id,
      entity: full,
      details: { ...value, status: NBS.ALIVE },
    });

    return success(res, "✅ Newborn record created", full);
  } catch (err) {
    await t.rollback();
    return error(res, "❌ Failed to create newborn record", err);
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
    const schema = buildNewbornSchema("update");
    const { error: validationError, value } = schema.validate(req.body, { stripUnknown: true });
    if (validationError) {
      await t.rollback();
      return error(res, "Validation failed", validationError, 400);
    }

    const record = await NewbornRecord.findOne({ where: { id }, transaction: t });
    if (!record) {
      await t.rollback();
      return error(res, "Newborn record not found", null, 404);
    }

    // 🔒 Tenant scoping
    if (!isSuperAdmin(req.user)) {
      value.organization_id = req.user.organization_id;
      value.facility_id = req.user.facility_id;
    }

    await record.update(
      { ...value, updated_by_id: req.user?.id || null },
      { transaction: t }
    );

    await t.commit();

    const full = await NewbornRecord.findOne({ where: { id }, include: NEWBORN_INCLUDES });

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "update",
      entityId: id,
      entity: full,
      details: value,
    });

    return success(res, "✅ Newborn record updated", full);
  } catch (err) {
    await t.rollback();
    return error(res, "❌ Failed to update newborn record", err);
  }
};
/* ============================================================
   📌 MARK NEWBORN AS DECEASED (alive → deceased)
   ============================================================ */
export const markDeceasedNewbornRecord = async (req, res) => {
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

    const rec = await NewbornRecord.findOne({ where, transaction: t });
    if (!rec) return error(res, "❌ Newborn record not found", null, 404);

    if (rec.status !== NBS.ALIVE) {
      await t.rollback();
      return error(res, "❌ Only alive newborns can be marked deceased", null, 400);
    }

    const oldStatus = rec.status;
    await rec.update(
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
      entity: rec,
      details: { from: oldStatus, to: NBS.DECEASED, reason: reason || null },
    });

    return success(res, "✅ Newborn marked as deceased", rec);
  } catch (err) {
    await t.rollback();
    return error(res, "❌ Failed to mark newborn as deceased", err);
  }
};

/* ============================================================
   📌 TRANSFER NEWBORN (alive → transferred)
   ============================================================ */
export const transferNewbornRecord = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { id } = req.params;
    const { reason, transfer_facility_id } = req.body;

    const where = { id };
    const role = (req.user?.roleNames?.[0] || "staff").toLowerCase();
    if (!isSuperAdmin(req.user)) {
      where.organization_id = req.user.organization_id;
      if (role === "facility_head") where.facility_id = req.user.facility_id;
    }

    const rec = await NewbornRecord.findOne({ where, transaction: t });
    if (!rec) return error(res, "❌ Newborn record not found", null, 404);

    if (rec.status !== NBS.ALIVE) {
      await t.rollback();
      return error(res, "❌ Only alive newborns can be transferred", null, 400);
    }

    if (!transfer_facility_id) {
      await t.rollback();
      return error(res, "❌ Transfer facility is required", null, 400);
    }

    const oldStatus = rec.status;
    await rec.update(
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
      entity: rec,
      details: { from: oldStatus, to: NBS.TRANSFERRED, reason: reason || null, transfer_facility_id },
    });

    return success(res, "✅ Newborn transferred", rec);
  } catch (err) {
    await t.rollback();
    return error(res, "❌ Failed to transfer newborn", err);
  }
};

/* ============================================================
   📌 VOID NEWBORN RECORD (any → voided, admin/superadmin only)
   ============================================================ */
export const voidNewbornRecord = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const role = (req.user?.roleNames?.[0] || "").toLowerCase();
    if (!["admin", "superadmin"].includes(role)) {
      return error(res, "❌ Only admin/superadmin can void newborn records", null, 403);
    }

    const { id } = req.params;
    const { reason } = req.body;

    const where = { id };
    if (!isSuperAdmin(req.user)) {
      where.organization_id = req.user.organization_id;
      if (role === "facility_head") where.facility_id = req.user.facility_id;
    }

    const rec = await NewbornRecord.findOne({ where, transaction: t });
    if (!rec) return error(res, "❌ Newborn record not found", null, 404);

    const oldStatus = rec.status;
    await rec.update(
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
      entity: rec,
      details: { from: oldStatus, to: NBS.VOIDED, reason: reason || null },
    });

    return success(res, "✅ Newborn record voided", rec);
  } catch (err) {
    await t.rollback();
    return error(res, "❌ Failed to void newborn record", err);
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
      if (role === "facility_head") where.facility_id = req.user.facility_id;
    } else {
      if (req.query.organization_id) where.organization_id = req.query.organization_id;
      if (req.query.facility_id) where.facility_id = req.query.facility_id;
    }

    const rec = await NewbornRecord.findOne({ where, transaction: t });
    if (!rec) {
      await t.rollback();
      return error(res, "❌ Newborn record not found", null, 404);
    }

    // keep old status for audit trail
    const oldStatus = rec.status;

    await rec.update({ deleted_by_id: req.user?.id || null }, { transaction: t });
    await rec.destroy({ transaction: t });

    await t.commit();

    // fetch full including soft-deleted
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

    return success(res, "✅ Newborn record deleted (soft)", full);
  } catch (err) {
    await t.rollback();
    return error(res, "❌ Failed to delete newborn record", err);
  }
};

/* ============================================================
   📌 GET ALL NEWBORN RECORDS LITE (?q=, ?status= support)
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

    let statusFilter = [NBS.ALIVE]; // default filter
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
        { notes: { [Op.iLike]: `%${q}%` } },
        { complications: { [Op.iLike]: `%${q}%` } },
      ];
    }

    const newborns = await NewbornRecord.findAll({
      where,
      attributes: ["id", "gender", "birth_weight", "birth_length", "status", "created_at"],
      include: [
        { model: Patient, as: "mother", attributes: ["id", "pat_no", "first_name", "last_name"] },
        { model: DeliveryRecord, as: "deliveryRecord", attributes: ["id", "delivery_date"] }, // ✅ fixed here
      ],
      order: [["created_at", "DESC"]],
      limit: 20,
    });

    const result = newborns.map(n => ({
      id: n.id,
      mother: n.mother ? `${n.mother.pat_no} - ${n.mother.first_name} ${n.mother.last_name}` : "",
      delivery: n.deliveryRecord ? n.deliveryRecord.delivery_date : "", // ✅ fixed here
      gender: n.gender,
      weight: n.birth_weight,
      status: n.status,
      created_at: n.created_at,
    }));

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "list_lite",
      details: { query: q || null, returned: result.length },
    });

    return success(res, "✅ Newborn records loaded (lite)", { records: result });
  } catch (err) {
    return error(res, "❌ Failed to load newborn records (lite)", err);
  }
};
/* ============================================================
   📌 GET ALL NEWBORN RECORDS (with ?status= support)
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
      FIELD_VISIBILITY_NEWBORN_RECORD[role] || FIELD_VISIBILITY_NEWBORN_RECORD.staff;

    // 🚫 remove pseudo-fields like "actions"
    const FRONTEND_ONLY_FIELDS = ["actions"];
    const safeFields = visibleFields.filter(f => !FRONTEND_ONLY_FIELDS.includes(f));

    const options = buildQueryOptions(req, "created_at", "DESC", safeFields);
    options.where = options.where || {};

    // 🔒 Apply org/facility scoping
    if (!isSuperAdmin(req.user)) {
      options.where.organization_id = req.user.organization_id;
      if (role === "facility_head") {
        options.where.facility_id = req.user.facility_id;
      }
    } else {
      if (req.query.organization_id) options.where.organization_id = req.query.organization_id;
      if (req.query.facility_id) options.where.facility_id = req.query.facility_id;
    }

    // 🔎 Apply search
    if (options.search) {
      options.where[Op.or] = [
        { notes: { [Op.iLike]: `%${options.search}%` } },
        { complications: { [Op.iLike]: `%${options.search}%` } },
      ];
    }

    // 🔎 Extra filters
    if (req.query.mother_id) options.where.mother_id = req.query.mother_id;
    if (req.query.delivery_record_id) options.where.delivery_record_id = req.query.delivery_record_id;
    if (req.query.gender) options.where.gender = req.query.gender;

    // 🔎 Status filter
    if (req.query.status) {
      const statuses = Array.isArray(req.query.status) ? req.query.status : [req.query.status];
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

    return success(res, "✅ Newborn records loaded", {
      records: rows,
      pagination: {
        total: count,
        page: options.pagination.page,
        pageCount: Math.ceil(count / options.pagination.limit),
      },
    });
  } catch (err) {
    console.error("❌ [getAllNewbornRecords] Error:", err);
    return error(res, "❌ Failed to load newborn records", err);
  }
};


/* ============================================================
   📌 GET NEWBORN RECORD BY ID
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
    } else {
      if (req.query.organization_id) where.organization_id = req.query.organization_id;
      if (req.query.facility_id) where.facility_id = req.query.facility_id;
    }

    const record = await NewbornRecord.findOne({
      where,
      include: NEWBORN_INCLUDES,
    });
    if (!record) return error(res, "❌ Newborn record not found", null, 404);

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "view",
      entityId: id,
      entity: record,
    });

    return success(res, "✅ Newborn record loaded", record);
  } catch (err) {
    return error(res, "❌ Failed to load newborn record", err);
  }
};
