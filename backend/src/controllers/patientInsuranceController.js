// 📁 controllers/patientInsuranceController.js
import Joi from "joi";
import { Op } from "sequelize";
import {
  sequelize,
  PatientInsurance,
  Patient,
  InsuranceProvider,
  User,
  Facility,
  Organization,
} from "../models/index.js";

import { success, error } from "../utils/response.js";
import { PATIENT_INSURANCE_STATUS, CURRENCY  } from "../constants/enums.js";

import { authzService } from "../services/authzService.js";
import { auditService } from "../services/auditService.js";
import {
  isSuperAdmin,
  isOrgOwner,
  isFacilityHead,
} from "../utils/role-utils.js";

import { buildQueryOptions } from "../utils/queryHelper.js";
import { normalizeDateRangeLocal } from "../utils/date-utils.js";
import { makeModuleLogger } from "../utils/debugLogger.js";

const MODULE_KEY = "patient_insurances";

/* ============================================================
   🔧 DEBUG
============================================================ */
const DEBUG_OVERRIDE = true;
const debug = makeModuleLogger("patientInsuranceController", DEBUG_OVERRIDE);

/* ============================================================
   🔗 INCLUDES
============================================================ */
const PATIENT_INSURANCE_INCLUDES = [
  {
    model: Patient,
    as: "patient",
    attributes: ["id", "pat_no","first_name", "last_name"],
    required: false,
  },
  {
    model: InsuranceProvider,
    as: "provider",
    attributes: ["id", "name"],
    required: false,
  },
  {
    model: Organization,
    as: "organization",
    attributes: ["id", "name", "code"],
    required: false,
  },
  {
    model: Facility,
    as: "facility",
    attributes: ["id", "name", "code", "organization_id"],
    required: false,
  },
  {
    model: User,
    as: "createdBy",
    attributes: ["id", "first_name", "last_name"],
    required: false,
  },
  {
    model: User,
    as: "updatedBy",
    attributes: ["id", "first_name", "last_name"],
    required: false,
  },
  {
    model: User,
    as: "deletedBy",
    attributes: ["id", "first_name", "last_name"],
    required: false,
  },
];

/* ============================================================
   📋 JOI SCHEMA
============================================================ */
function buildSchema(isSuper, mode = "create") {
    const base = {
      patient_id: Joi.string().uuid(),
      provider_id: Joi.string().uuid(),
      policy_number: Joi.string().max(120),
      plan_name: Joi.string().allow("", null),
      coverage_limit: Joi.number().min(0).allow(null),
      currency: Joi.string().valid(...Object.values(CURRENCY)).optional(), // ✅ ADD
      valid_from: Joi.date().allow(null),
      valid_to: Joi.date().min(Joi.ref("valid_from")).allow(null),
      is_primary: Joi.boolean(),
      notes: Joi.string().allow("", null),
    };

  if (mode === "create") {
    base.patient_id = base.patient_id.required();
    base.provider_id = base.provider_id.required();
    base.policy_number = base.policy_number.required();
  } else {
    base.status = Joi.string()
      .valid(...Object.values(PATIENT_INSURANCE_STATUS))
      .optional();

    Object.keys(base).forEach(k => (base[k] = base[k].optional()));
  }

  if (isSuper) {
    base.organization_id = Joi.string().uuid().allow(null).optional();
    base.facility_id = Joi.string().uuid().allow(null).optional();
  } else {
    base.facility_id = Joi.string().uuid().allow(null).optional();
  }

  return Joi.object(base);
}

/* ============================================================
   📌 CREATE
============================================================ */
export const createPatientInsurance = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    debug.log("create → incoming", req.body);

    const allowed = await authzService.checkPermission({
      user: req.user,
      module: MODULE_KEY,
      action: "create",
      res,
    });
    if (!allowed) return;

    const schema = buildSchema(isSuperAdmin(req.user), "create");
    const { error: validationError, value } = schema.validate(req.body, {
      stripUnknown: true,
    });

    if (validationError) {
      await t.rollback();
      return error(res, "Validation failed", validationError, 400);
    }

    /* ================= SCOPE ================= */
    let orgId = null;
    let facilityId = null;

    if (isSuperAdmin(req.user)) {
      orgId = value.organization_id ?? null;
      facilityId = value.facility_id ?? null;
    } else if (isOrgOwner(req.user)) {
      orgId = req.user.organization_id;
      facilityId = value.facility_id ?? null;
    } else if (isFacilityHead(req.user)) {
      orgId = req.user.organization_id;
      facilityId = req.user.facility_id;
    } else {
      orgId = req.user.organization_id;
      facilityId = req.user.facility_id ?? null;
    }

    if (!orgId) {
      await t.rollback();
      return error(res, "Missing organization assignment", null, 400);
    }

    /* ================= DUP CHECK ================= */
    const exists = await PatientInsurance.findOne({
      where: {
        organization_id: orgId,
        facility_id: facilityId ?? null,
        policy_number: value.policy_number,
        provider_id: value.provider_id,
      },
      paranoid: false,
      transaction: t,
    });

    if (exists) {
      await t.rollback();
      return error(res, "Policy already exists", null, 400);
    }

    /* ================= PRIMARY LOGIC ================= */
    if (value.is_primary) {
      await PatientInsurance.update(
        { is_primary: false },
        {
          where: {
            patient_id: value.patient_id,
            organization_id: orgId,
          },
          transaction: t,
        }
      );
    }

    /* ================= CREATE ================= */
    const created = await PatientInsurance.create(
      {
        ...value,
        organization_id: orgId,
        facility_id: facilityId,
        created_by_id: req.user?.id || null,
      },
      { transaction: t }
    );

    await t.commit();

    const full = await PatientInsurance.findByPk(created.id, {
      include: PATIENT_INSURANCE_INCLUDES,
    });

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "create",
      entityId: created.id,
      entity: full,
    });

    return success(res, "✅ Patient insurance created", full);
  } catch (err) {
    await t.rollback();
    debug.error("create → FAILED", err);
    return error(res, "❌ Failed to create patient insurance", err);
  }
};

/* ============================================================
   📌 UPDATE
============================================================ */
export const updatePatientInsurance = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    debug.log("update → incoming", {
      id: req.params.id,
      body: req.body,
    });

    const allowed = await authzService.checkPermission({
      user: req.user,
      module: MODULE_KEY,
      action: "update",
      res,
    });
    if (!allowed) return;

    const schema = buildSchema(isSuperAdmin(req.user), "update");
    const { error: validationError, value } = schema.validate(req.body, {
      stripUnknown: true,
    });

    if (validationError) {
      await t.rollback();
      return error(res, "Validation failed", validationError, 400);
    }

    const record = await PatientInsurance.findByPk(req.params.id, {
      transaction: t,
    });

    if (!record) {
      await t.rollback();
      return error(res, "❌ Record not found", null, 404);
    }

    let orgId = record.organization_id;
    let facilityId = record.facility_id;

    if (isSuperAdmin(req.user)) {
      if ("organization_id" in value) orgId = value.organization_id;
      if ("facility_id" in value) facilityId = value.facility_id;
    } else if (isOrgOwner(req.user)) {
      orgId = req.user.organization_id;
      if ("facility_id" in value) facilityId = value.facility_id;
    } else if (isFacilityHead(req.user)) {
      orgId = req.user.organization_id;
      facilityId = req.user.facility_id;
    } else {
      orgId = req.user.organization_id;
      facilityId = req.user.facility_id ?? record.facility_id;
    }

    /* ================= PRIMARY LOGIC ================= */
    if (value.is_primary === true) {
      await PatientInsurance.update(
        { is_primary: false },
        {
          where: {
            patient_id: record.patient_id,
            organization_id: orgId,
          },
          transaction: t,
        }
      );
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

    const full = await PatientInsurance.findByPk(record.id, {
      include: PATIENT_INSURANCE_INCLUDES,
    });

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "update",
      entityId: record.id,
      entity: full,
    });

    return success(res, "✅ Patient insurance updated", full);
  } catch (err) {
    await t.rollback();
    debug.error("update → FAILED", err);
    return error(res, "❌ Failed to update patient insurance", err);
  }
};


/* ============================================================
   📌 GET ALL PATIENT INSURANCES (MASTER PARITY + SUMMARY)
============================================================ */
export const getAllPatientInsurances = async (req, res) => {
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module: MODULE_KEY,
      action: "read",
      res,
    });
    if (!allowed) return;

    debug.log("list → raw query", req.query);

    const options = buildQueryOptions(req, "created_at", "DESC");

    delete options.filters?.dateRange;
    delete options.filters?.light;

    options.where = { [Op.and]: [] };

    /* ================= DATE RANGE ================= */
    const dateRange = normalizeDateRangeLocal(req.query.dateRange);
    if (dateRange) {
      options.where[Op.and].push({
        created_at: {
          [Op.between]: [dateRange.start, dateRange.end],
        },
      });
    }

    /* ================= TENANT ================= */
    if (!isSuperAdmin(req.user)) {
      options.where[Op.and].push({
        organization_id: req.user.organization_id,
      });

      if (!isOrgOwner(req.user)) {
        options.where[Op.and].push({
          [Op.or]: [
            { facility_id: null },
            { facility_id: req.user.facility_id },
          ],
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

    /* ================= SEARCH ================= */
    if (options.search) {
      options.where[Op.and].push({
        [Op.or]: [
          { policy_number: { [Op.iLike]: `%${options.search}%` } },
          { plan_name: { [Op.iLike]: `%${options.search}%` } },
        ],
      });
    }

    /* ================= FILTERS ================= */
    if (req.query.patient_id) {
      options.where[Op.and].push({
        patient_id: req.query.patient_id,
      });
    }

    if (req.query.provider_id) {
      options.where[Op.and].push({
        provider_id: req.query.provider_id,
      });
    }

    /* 🔥 ADD THIS (CURRENCY FILTER) */
    if (req.query.currency) {
      options.where[Op.and].push({
        currency: req.query.currency,
      });
    }

    if (
      req.query.status &&
      Object.values(PATIENT_INSURANCE_STATUS).includes(req.query.status)
    ) {
      options.where[Op.and].push({
        status: req.query.status,
      });
    }

    /* ================= QUERY ================= */
    const { count, rows } = await PatientInsurance.findAndCountAll({
      where: options.where,
      include: PATIENT_INSURANCE_INCLUDES,
      order: options.order,
      offset: options.offset,
      limit: options.limit,
    });

    /* ================= AUTO-EXPIRE ================= */
    await PatientInsurance.update(
      { status: PATIENT_INSURANCE_STATUS.EXPIRED },
      {
        where: {
          valid_to: { [Op.lt]: new Date() },
          status: PATIENT_INSURANCE_STATUS.ACTIVE,
        },
      }
    );

    /* ================= SUMMARY ================= */
    const {
      ACTIVE,
      INACTIVE,
      EXPIRED,
      CANCELLED,
    } = PATIENT_INSURANCE_STATUS;

    const summary = {
      total: count,
      active: rows.filter(r => r.status === ACTIVE).length,
      inactive: rows.filter(r => r.status === INACTIVE).length,
      expired: rows.filter(r => r.status === EXPIRED).length,
      cancelled: rows.filter(r => r.status === CANCELLED).length,
    };

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "list",
      details: {
        returned: count,
        query: req.query,
        dateRange: dateRange || null,
      },
    });

    return success(res, "✅ Patient insurances loaded", {
      records: rows,
      summary,
      pagination: {
        total: count,
        page: options.pagination.page,
        pageCount: Math.ceil(count / options.pagination.limit),
      },
    });
  } catch (err) {
    debug.error("list → FAILED", err);
    return error(res, "❌ Failed to load patient insurances", err);
  }
};

/* ============================================================
   📌 GET BY ID
============================================================ */
export const getPatientInsuranceById = async (req, res) => {
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

      if (isFacilityHead(req.user)) {
        where.facility_id = req.user.facility_id;
      }
    } else {
      if (req.query.organization_id)
        where.organization_id = req.query.organization_id;
      if (req.query.facility_id)
        where.facility_id = req.query.facility_id;
    }

    const found = await PatientInsurance.findOne({
      where,
      include: PATIENT_INSURANCE_INCLUDES,
    });

    if (!found) return error(res, "❌ Record not found", null, 404);

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "view",
      entityId: id,
      entity: found,
    });

    return success(res, "✅ Patient insurance loaded", found);
  } catch (err) {
    debug.error("view → FAILED", err);
    return error(res, "❌ Failed to load patient insurance", err);
  }
};

/* ============================================================
   📌 GET LITE (AUTOCOMPLETE) — ENTERPRISE MASTER FINAL
============================================================ */
export const getAllPatientInsurancesLite = async (req, res) => {
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module: MODULE_KEY,
      action: "read",
      res,
    });
    if (!allowed) return;

    const { q, patient_id, provider_id } = req.query;

    const where = {
      status: PATIENT_INSURANCE_STATUS.ACTIVE,
      [Op.and]: [],
    };

    /* ================= TENANT ================= */
    if (!isSuperAdmin(req.user)) {
      where.organization_id = req.user.organization_id;
    }

    /* ================= FILTERS ================= */
    if (patient_id) {
      where.patient_id = patient_id;
    }

    if (provider_id) {
      where.provider_id = provider_id;
    }

    /* ================= SEARCH ================= */
    if (q) {
      where[Op.and].push({
        [Op.or]: [
          { policy_number: { [Op.iLike]: `%${q}%` } },
          { plan_name: { [Op.iLike]: `%${q}%` } },
        ],
      });
    }

    /* ================= QUERY ================= */
    const records = await PatientInsurance.findAll({
      where,
      attributes: ["id", "policy_number", "plan_name"],
      include: [
        {
          model: InsuranceProvider,
          as: "provider",
          attributes: ["name"],
        },
      ],
      order: [["created_at", "DESC"]],
      limit: 50,
    });

    /* ================= TRANSFORM (MASTER KEY) ================= */
    const result = records.map(r => ({
      id: r.id,

      // ⭐ ENTERPRISE LABEL (USED BY ALL DROPDOWNS)
      label: `${r.policy_number}${
        r.plan_name ? " - " + r.plan_name : ""
      }${
        r.provider?.name ? " (" + r.provider.name + ")" : ""
      }`,

      // 🔹 RAW DATA (optional but useful)
      policy_number: r.policy_number,
      plan_name: r.plan_name || "",
      provider_name: r.provider?.name || "",
    }));

    /* ================= AUDIT ================= */
    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "list_lite",
      details: {
        count: result.length,
        q: q || null,
        patient_id: patient_id || null,
        provider_id: provider_id || null,
      },
    });

    /* ================= RESPONSE ================= */
    return success(res, "✅ Patient insurances loaded (lite)", {
      records: result,
    });

  } catch (err) {
    debug.error("list_lite → FAILED", err);
    return error(res, "❌ Failed to load patient insurances (lite)", err);
  }
};
/* ============================================================
   📌 TOGGLE STATUS
============================================================ */
export const togglePatientInsuranceStatus = async (req, res) => {
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module: MODULE_KEY,
      action: "update",
      res,
    });
    if (!allowed) return;

    const { id } = req.params;
    const where = { id };

    if (!isSuperAdmin(req.user)) {
      where.organization_id = req.user.organization_id;

      if (isFacilityHead(req.user)) {
        where.facility_id = req.user.facility_id;
      }
    } else {
      if (req.query.organization_id)
        where.organization_id = req.query.organization_id;
      if (req.query.facility_id)
        where.facility_id = req.query.facility_id;
    }

    const record = await PatientInsurance.findOne({ where });
    if (!record) return error(res, "❌ Record not found", null, 404);

    const { ACTIVE, INACTIVE } = PATIENT_INSURANCE_STATUS;
    const previousStatus = record.status;
    const newStatus = previousStatus === ACTIVE ? INACTIVE : ACTIVE;

    await record.update({
      status: newStatus,
      updated_by_id: req.user.id,
    });

    const full = await PatientInsurance.findOne({
      where: { id },
      include: PATIENT_INSURANCE_INCLUDES,
    });

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "toggle_status",
      entityId: id,
      entity: full,
      details: { from: previousStatus, to: newStatus },
    });

    return success(
      res,
      `✅ Patient insurance status set to ${newStatus}`,
      full
    );
  } catch (err) {
    debug.error("toggle_status → FAILED", err);
    return error(res, "❌ Failed to toggle patient insurance status", err);
  }
};

/* ============================================================
   📌 DELETE PATIENT INSURANCE
   (MASTER-PARITY, SAFE SOFT DELETE + AUDIT)
============================================================ */
export const deletePatientInsurance = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    debug.log("delete → incoming", {
      id: req.params.id,
      query: req.query,
    });

    const allowed = await authzService.checkPermission({
      user: req.user,
      module: MODULE_KEY,
      action: "delete",
      res,
    });
    if (!allowed) return;

    const { id } = req.params;
    const where = { id };

    /* ================= SCOPE ================= */
    if (!isSuperAdmin(req.user)) {
      where.organization_id = req.user.organization_id;

      if (isFacilityHead(req.user)) {
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

    const record = await PatientInsurance.findOne({
      where,
      transaction: t,
    });

    if (!record) {
      await t.rollback();
      return error(res, "❌ Record not found", null, 404);
    }

    /* ================= SOFT DELETE ================= */
    await record.update(
      { deleted_by_id: req.user?.id || null },
      { transaction: t }
    );

    await record.destroy({ transaction: t });
    await t.commit();

    const full = await PatientInsurance.findOne({
      where: { id },
      include: PATIENT_INSURANCE_INCLUDES,
      paranoid: false,
    });

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "delete",
      entityId: id,
      entity: full,
    });

    return success(res, "✅ Patient insurance deleted", full);
  } catch (err) {
    await t.rollback();
    debug.error("delete → FAILED", err);
    return error(res, "❌ Failed to delete patient insurance", err);
  }
};