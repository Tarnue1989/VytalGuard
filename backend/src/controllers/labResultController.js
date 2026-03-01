// 📁 controllers/labResultController.js — MASTER PARITY SECTION
import Joi from "joi";
import { Op } from "sequelize";
import {
  sequelize,
  LabResult,
  LabRequest,
  Patient,
  Employee,
  Department,
  Consultation,
  RegistrationLog,
  BillableItem,
  Organization,
  Facility,
  User,
} from "../models/index.js";

import { success, error } from "../utils/response.js";
import { buildQueryOptions } from "../utils/queryHelper.js";
import { validate } from "../utils/validation.js";
import { resolveOrgFacility } from "../utils/resolveOrgFacility.js";
import { makeModuleLogger } from "../utils/debugLogger.js";
import { validatePaginationStrict } from "../utils/query-utils.js";
import { normalizeDateRangeLocal } from "../utils/date-utils.js";
import { isSuperAdmin } from "../utils/role-utils.js";
import { buildDynamicSummary } from "../utils/summaryHelper.js";
import {
  LAB_RESULT_STATUS,
  LAB_REQUEST_STATUS,
  LAB_REQUEST_ITEM_STATUS,
} from "../constants/enums.js";

import { authzService } from "../services/authzService.js";
import { auditService } from "../services/auditService.js";
import { FIELD_VISIBILITY_LAB_RESULT } from "../constants/fieldVisibility.js";
import { syncLabRequestStatus } from "../services/labRequestSyncService.js";

const MODULE_KEY = "lab_result";

/* ============================================================
   🔧 DEBUG LOGGER (MASTER STYLE)
============================================================ */
const DEBUG_OVERRIDE = false;
const debug = makeModuleLogger("labResultController", DEBUG_OVERRIDE);

/* ============================================================
   🔐 ENUM MAPS (ORDER SAFE)
============================================================ */
const LRSR = Object.fromEntries(
  LAB_RESULT_STATUS.map((v) => [v.toLowerCase(), v])
);

const LRI = Object.fromEntries(
  LAB_REQUEST_ITEM_STATUS.map((v) => [v.toLowerCase(), v])
);

/* ============================================================
   🔗 SHARED INCLUDES (MASTER SAFE)
============================================================ */
const LAB_RESULT_INCLUDES = [
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
  { model: Department, as: "department", attributes: ["id", "name"] },
  { model: Consultation, as: "consultation", attributes: ["id", "consultation_date", "status"] },
  { model: RegistrationLog, as: "registrationLog", attributes: ["id", "registration_time", "log_status"] },
  { model: LabRequest, as: "labRequest", attributes: ["id", "status", "request_date"] },
  {
    model: sequelize.models.LabRequestItem,
    as: "labRequestItem",
    attributes: ["id", "status", "notes"],
    include: [
      {
        model: BillableItem,
        as: "labTest",
        attributes: ["id", "name", "code", "description"],
      },
    ],
  },
  { model: Organization, as: "organization", attributes: ["id", "name", "code"] },
  { model: Facility, as: "facility", attributes: ["id", "name", "code", "organization_id"] },
  { model: User, as: "enteredBy", attributes: ["id", "first_name", "last_name"] },
  { model: User, as: "reviewedBy", attributes: ["id", "first_name", "last_name"] },
  { model: User, as: "verifiedBy", attributes: ["id", "first_name", "last_name"] },
  { model: User, as: "createdBy", attributes: ["id", "first_name", "last_name"] },
  { model: User, as: "updatedBy", attributes: ["id", "first_name", "last_name"] },
  { model: User, as: "deletedBy", attributes: ["id", "first_name", "last_name"] },
];

/* ============================================================
   📋 JOI SCHEMA (MASTER STYLE — TENANT SAFE + SA OVERRIDE)
============================================================ */
function buildLabResultSchema(user, mode = "create") {
  const base = {
    patient_id: Joi.string().uuid().required(),
    lab_request_id: Joi.string().uuid().required(),
    lab_request_item_id: Joi.string().uuid().required(),

    department_id: Joi.string().uuid().allow("", null),
    consultation_id: Joi.string().uuid().allow("", null),
    registration_log_id: Joi.string().uuid().allow("", null),
    doctor_id: Joi.string().uuid().allow("", null),

    /* ================= TEXT ================= */
    result: Joi.string().trim().max(2000).allow("", null),
    notes: Joi.string().trim().max(1000).allow("", null),
    doctor_notes: Joi.string().trim().max(1000).allow("", null),
    result_date: Joi.date().allow(null),

    /* ================= ATTACHMENT ================= */
    attachment_url: Joi.string().trim().max(500).allow("", null),
    remove_attachment: Joi.alternatives().try(
      Joi.boolean(),
      Joi.string().valid("true", "false")
    ),

    /* ================= STATUS ================= */
    status: Joi.string().valid(...LAB_RESULT_STATUS),

    /* ================= TENANT (DEFAULT LOCKED) ================= */
    organization_id: Joi.forbidden(),
    facility_id: Joi.forbidden(),
  };

  /* ================= SUPERADMIN OVERRIDE ================= */
  if (isSuperAdmin(user)) {
    base.organization_id = Joi.string().uuid().allow("", null);
    base.facility_id = Joi.string().uuid().allow("", null);
  }

  /* ================= UPDATE MODE ================= */
  if (mode === "update") {
    Object.keys(base).forEach((k) => {
      base[k] = base[k].optional();
    });
  }

  return Joi.object(base);
}
/* ============================================================
   🔁 STATUS TRANSITION MATRIX (STRICT MASTER)
============================================================ */
const LAB_RESULT_TRANSITIONS = {
  draft: ["pending"],
  pending: ["in_progress", "cancelled"],
  in_progress: ["completed", "cancelled"],
  completed: ["reviewed"],
  reviewed: ["verified"],
  verified: [],
  cancelled: [],
  voided: [],
};

/* ============================================================
   🔁 SHARED STATUS UPDATE HANDLER (MASTER SAFE)
============================================================ */
async function updateLabResultStatus({
  req,
  res,
  id,
  newStatus,
  auditAction,
  extraFields = {},
}) {
  const t = await sequelize.transaction();
  try {
  const role = (req.user?.roleNames?.[0] || "").toLowerCase();
  const isSuperAdmin = role === "superadmin";

  const where = { id };

  if (!isSuperAdmin) {
    where.organization_id = req.user.organization_id;
    if (req.user.facility_id) {
      where.facility_id = req.user.facility_id;
    }
  }

  const result = await LabResult.findOne({
    where,
    transaction: t,
    lock: t.LOCK.UPDATE,
  });
    if (!result) {
      await t.rollback();
      return error(res, "Lab Result not found", null, 404);
    }

    const current = result.status?.toLowerCase();
    const next = newStatus?.toLowerCase();

    if (!LAB_RESULT_TRANSITIONS[current]?.includes(next)) {
      await t.rollback();
      return error(
        res,
        `Invalid status transition: ${current} → ${next}`,
        null,
        400
      );
    }

    const oldSnapshot = { ...result.get() };

    await result.update(
      {
        status: LRSR[next],
        updated_by_id: req.user?.id || null,
        ...extraFields,
      },
      { transaction: t }
    );

    await cascadeResultStatus(result, LRSR[next], req.user?.id, t);

    await t.commit();

    const full = await LabResult.findOne({
      where: { id },
      include: LAB_RESULT_INCLUDES,
    });

    await auditService.logAction({
      user: req.user,
      module_key: MODULE_KEY,
      action: auditAction,
      entityId: id,
      entity: full,
      details: {
        from: oldSnapshot.status,
        to: newStatus,
      },
    });

    return success(res, `Lab Result ${auditAction} successful`, full);
  } catch (err) {
    await t.rollback();
    debug.error("updateLabResultStatus → FAILED", err);
    return error(res, "Failed to update lab result status", err);
  }
}

/* ============================================================
   🔄 CASCADE RESULT → ITEM → REQUEST (MASTER SAFE)
============================================================ */
async function cascadeResultStatus(result, newStatus, userId, transaction) {
  if (!result) return;

  const statusKey = newStatus.toLowerCase();

  const itemMap = {
    draft: LRI.pending,
    pending: LRI.in_progress,
    in_progress: LRI.in_progress,
    completed: LRI.completed,
    reviewed: LRI.completed,
    verified: LRI.verified,
    cancelled: LRI.cancelled,
    voided: LRI.cancelled,
  };

  const itemStatus = itemMap[statusKey];

  if (itemStatus && result.lab_request_item_id) {
    await sequelize.models.LabRequestItem.update(
      {
        status: itemStatus,
        updated_by_id: userId || null,
      },
      {
        where: { id: result.lab_request_item_id },
        transaction,
      }
    );
  }

  if (result.lab_request_id) {
    await syncLabRequestStatus(result.lab_request_id, transaction);
  }
}

/* ============================================================
   🔧 NORMALIZE MULTIPART (MASTER SAFE)
============================================================ */
function normalizeResultsForm(body) {
  const results = [];

  for (const [key, value] of Object.entries(body)) {
    const match = key.match(/^results\[(\d+)\]\[(.+)\]$/);
    if (match) {
      const idx = parseInt(match[1], 10);
      const field = match[2];
      if (!results[idx]) results[idx] = {};
      results[idx][field] = value;
    }
  }

  if (Array.isArray(body.results)) {
    body.results.forEach((r, idx) => {
      results[idx] = { ...(results[idx] || {}), ...r };
    });
  }

  return results.length ? results : [body];
}
/* ============================================================
   📌 CREATE LAB RESULT(S) — MASTER PARITY
============================================================ */
export const createLabResults = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module_key: MODULE_KEY,
      action: "create",
      res,
    });
    if (!allowed) return;

    let payloads = normalizeResultsForm(req.body);
    if (!Array.isArray(payloads)) payloads = [payloads];
    if (!payloads.length) {
      await t.rollback();
      return error(res, "Payload must not be empty", null, 400);
    }

    const prepared = [];
    const skipped = [];

    for (const [idx, raw] of payloads.entries()) {
      const { value, errors } = validate(
        buildLabResultSchema(req.user, "create"),
        raw
      );

      if (errors) {
        skipped.push({ index: idx, reason: "Validation failed", details: errors });
        continue;
      }

      ["department_id", "consultation_id", "registration_log_id", "facility_id"]
        .forEach((f) => {
          if (!value[f] || value[f] === "") value[f] = null;
        });

      const { orgId, facilityId } = await resolveOrgFacility({
        user: req.user,
        value,
        body: raw,
      });

      if (!orgId) {
        skipped.push({ index: idx, reason: "Missing organization assignment" });
        continue;
      }

      if (value.remove_attachment === "true") value.remove_attachment = true;
      if (value.remove_attachment === "false") value.remove_attachment = false;

      if (req.files && Array.isArray(req.files)) {
        const file = req.files.find(
          (f) =>
            f.fieldname === `results[${idx}][attachment]` ||
            f.fieldname === `results[${idx}][lab_result_file]`
        );
        if (file) {
          value.attachment_url = `/uploads/lab-results/${file.filename}`;
        }
      }

      prepared.push({
        ...value,
        organization_id: orgId,
        facility_id: facilityId,
        created_by_id: req.user?.id || null,
        entered_by_id: req.user?.id || null,
      });
    }

    let created = [];

    if (prepared.length) {
      created = await LabResult.bulkCreate(prepared, { transaction: t });

      for (const r of created) {
        await cascadeResultStatus(r, r.status, req.user?.id, t);
      }
    }

    await t.commit();

    const full = created.length
      ? await LabResult.findAll({
          where: { id: { [Op.in]: created.map((c) => c.id) } },
          include: LAB_RESULT_INCLUDES,
        })
      : [];

    await auditService.logAction({
      user: req.user,
      module_key: MODULE_KEY,
      action: payloads.length > 1 ? "bulk_create" : "create",
      details: {
        saved: created.length,
        skipped: skipped.length,
      },
    });

    return success(res, "Lab Results processed", {
      records: full,
      skipped,
    });
  } catch (err) {
    await t.rollback();
    return error(res, "Failed to create lab result(s)", err);
  }
};


/* ============================================================
   📌 UPDATE LAB RESULT — MASTER PARITY (TENANT SAFE — HARDENED)
============================================================ */
export const updateLabResult = async (req, res) => {
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

    /* ================= ROLE RESOLUTION ================= */
    const role = (req.user?.roleNames?.[0] || "").toLowerCase();
    const isSuperAdmin = role === "superadmin";

    /* ================= NORMALIZE PAYLOAD ================= */
    let payload = normalizeResultsForm(req.body);
    if (Array.isArray(payload)) payload = payload[0];

    const { value, errors } = validate(
      buildLabResultSchema(req.user, "update"),
      payload
    );

    if (errors) {
      await t.rollback();
      return error(res, "Validation failed", errors, 400);
    }

    /* ================= ORG / FACILITY RESOLUTION ================= */
    const { orgId, facilityId } = await resolveOrgFacility({
      user: req.user,
      value,
      body: payload,
    });

    if (!orgId) {
      await t.rollback();
      return error(res, "Missing organization assignment", null, 400);
    }

    /* ================= TENANT-SAFE WHERE ================= */
    const where = { id };

    if (!isSuperAdmin) {
      where.organization_id = orgId;
      if (facilityId) {
        where.facility_id = facilityId;
      }
    }

    const result = await LabResult.findOne({
      where,
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    if (!result) {
      await t.rollback();
      return error(res, "Lab Result not found", null, 404);
    }

    /* ================= PROTECT VERIFIED RECORDS ================= */
    if (result.status?.toLowerCase() === "verified") {
      await t.rollback();
      return error(
        res,
        "Verified lab results cannot be modified",
        null,
        403
      );
    }

    /* ================= ATTACHMENT HANDLING ================= */
    if (value.remove_attachment === true) {
      value.attachment_url = null;
    }

    if (req.files && Array.isArray(req.files)) {
      const file = req.files.find(
        (f) =>
          f.fieldname === "attachment" ||
          f.fieldname === "lab_result_file"
      );
      if (file) {
        value.attachment_url = `/uploads/lab-results/${file.filename}`;
      }
    }

    /* ================= STATUS TIMESTAMP SYNC ================= */
    const nextStatus = value.status?.toLowerCase();
    const timeFields = {};

    if (nextStatus === "reviewed") {
      timeFields.reviewed_at = new Date();
      timeFields.reviewed_by_id = req.user?.id || null;
    }

    if (nextStatus === "verified") {
      timeFields.verified_at = new Date();
      timeFields.verified_by_id = req.user?.id || null;
    }

    const oldSnapshot = { ...result.get() };

    /* ================= UPDATE ================= */
    await result.update(
      {
        ...value,
        ...timeFields,
        organization_id: orgId,
        facility_id: facilityId,
        updated_by_id: req.user?.id || null,
      },
      { transaction: t }
    );

    /* ================= CASCADE ================= */
    await cascadeResultStatus(result, result.status, req.user?.id, t);

    await t.commit();

    const full = await LabResult.findOne({
      where: { id },
      include: LAB_RESULT_INCLUDES,
    });

    /* ================= AUDIT ================= */
    await auditService.logAction({
      user: req.user,
      module_key: MODULE_KEY,
      action: "update",
      entityId: id,
      entity: full,
      details: {
        before: oldSnapshot,
        after: full.get(),
      },
    });

    return success(res, "Lab Result updated", full);
  } catch (err) {
    await t.rollback();
    return error(res, "Failed to update lab result", err);
  }
};
/* ============================================================
   📌 GET ALL LAB RESULTS LITE — MASTER FILTER PARITY
============================================================ */
export const getAllLabResultsLite = async (req, res) => {
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module_key: MODULE_KEY,
      action: "read",
      res,
    });
    if (!allowed) return;

    const { q } = req.query;

    const where = {
      status: LRSR.pending,
      organization_id: req.user.organization_id,
    };

    if (req.user.facility_id) {
      where.facility_id = req.user.facility_id;
    }

    if (q) {
      where[Op.or] = [
        { result: { [Op.iLike]: `%${q}%` } },
        { notes: { [Op.iLike]: `%${q}%` } },
        { "$patient.first_name$": { [Op.iLike]: `%${q}%` } },
        { "$patient.last_name$": { [Op.iLike]: `%${q}%` } },
      ];
    }

    const rows = await LabResult.findAll({
      where,
      attributes: ["id", "result_date", "result", "notes", "status"],
      include: [
        { model: Patient, as: "patient", attributes: ["pat_no", "first_name", "last_name"] },
        { model: Employee, as: "doctor", attributes: ["first_name", "last_name"] },
      ],
      order: [["result_date", "DESC"]],
      limit: 20,
    });

    await auditService.logAction({
      user: req.user,
      module_key: MODULE_KEY,
      action: "list_lite_pending",
      details: { count: rows.length },
    });

    return success(res, "Pending Lab Results loaded", {
      records: rows,
    });
  } catch (err) {
    return error(res, "Failed to load pending lab results", err);
  }
};


/* ============================================================
   📌 GET LAB RESULT BY ID — MASTER TENANT SAFE
============================================================ */
export const getLabResultById = async (req, res) => {
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module_key: MODULE_KEY,
      action: "read",
      res,
    });
    if (!allowed) return;

    const { id } = req.params;

    /* ================= ROLE RESOLUTION ================= */
    const role = (req.user?.roleNames?.[0] || "").toLowerCase();
    const isSuperAdmin = role === "superadmin";

    /* ================= TENANT-SAFE WHERE ================= */
    const where = { id };

    if (!isSuperAdmin) {
      where.organization_id = req.user.organization_id;

      if (req.user.facility_id) {
        where.facility_id = req.user.facility_id;
      }
    }

    const result = await LabResult.findOne({
      where,
      include: LAB_RESULT_INCLUDES,
    });

    if (!result) {
      return error(res, "Lab Result not found", null, 404);
    }

    /* ================= AUDIT ================= */
    await auditService.logAction({
      user: req.user,
      module_key: MODULE_KEY,
      action: "view",
      entityId: id,
      entity: result,
    });

    return success(res, "Lab Result loaded", result);
  } catch (err) {
    return error(res, "Failed to load lab result", err);
  }
};

/* ============================================================
   📌 GET ALL LAB RESULTS — MASTER (APPOINTMENT PARITY)
============================================================ */
export const getAllLabResults = async (req, res) => {
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
      FIELD_VISIBILITY_LAB_RESULT[role] ||
      FIELD_VISIBILITY_LAB_RESULT.staff;

    /* ================= BASE QUERY OPTIONS ================= */
    const options = buildQueryOptions(req, {
      defaultSort: ["result_date", "DESC"],
      fields: visibleFields,
    });

    options.where = { [Op.and]: [] };

    /* ================= DATE RANGE ================= */
    if (req.query.dateRange) {
      const { start, end } = normalizeDateRangeLocal(req.query.dateRange);
      if (start && end) {
        options.where[Op.and].push({
          result_date: { [Op.between]: [start, end] },
        });
      }
    }

    /* ================= TENANT SCOPE ================= */
    if (!isSuperAdmin(req.user)) {
      options.where[Op.and].push({
        organization_id: req.user.organization_id,
      });

      if (req.user.roleNames?.includes("facility_head")) {
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

    /* ================= SAFE FILTERS ================= */
    ["department_id", "patient_id", "doctor_id"].forEach((key) => {
      if (req.query[key]) {
        options.where[Op.and].push({ [key]: req.query[key] });
      }
    });

    if (req.query.status) {
      const statuses = Array.isArray(req.query.status)
        ? req.query.status
        : req.query.status.split(",").map((s) => s.trim());

      options.where[Op.and].push({
        status: { [Op.in]: statuses },
      });
    }

    /* ================= GLOBAL SEARCH ================= */
    if (options.search) {
      options.where[Op.and].push({
        [Op.or]: [
          { result: { [Op.iLike]: `%${options.search}%` } },
          { notes: { [Op.iLike]: `%${options.search}%` } },
          { doctor_notes: { [Op.iLike]: `%${options.search}%` } },
        ],
      });
    }

    /* ================= MAIN QUERY ================= */
    const { count, rows } = await LabResult.findAndCountAll({
      where: options.where,
      include: LAB_RESULT_INCLUDES,
      order: options.order,
      offset: options.offset,
      limit: options.limit,
      distinct: true,
    });

    /* ================= ENTERPRISE SUMMARY ================= */
    const summary = await buildDynamicSummary({
      model: LabResult,
      options,
      statusEnums: LAB_RESULT_STATUS,
      includeGender: true,
      genderJoin: { model: Patient, as: "patient" },
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
    return success(res, "Lab Results loaded", {
      records: rows,
      pagination: {
        total: count,
        page: options.pagination.page,
        pageCount: Math.ceil(count / options.pagination.limit),
      },
      summary,
    });
  } catch (err) {
    debug.error("getAllLabResults → FAILED", err);
    return error(res, "Failed to load lab results", err);
  }
};
/* ============================================================
   📌 TOGGLE LAB RESULT STATUS — STRICT MASTER
============================================================ */
export const toggleLabResultStatus = async (req, res) => {
  const body = Array.isArray(req.body) ? req.body[0] : req.body || {};
  const id = req.params.id || body.id;

  return updateLabResultStatus({
    req,
    res,
    id,
    newStatus: body.status,
    auditAction: "toggle_status",
  });
};

/* ============================================================
   📌 DELETE LAB RESULT — MASTER SAFE (TENANT ISOLATED)
============================================================ */
export const deleteLabResult = async (req, res) => {
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

    /* ================= ROLE RESOLUTION ================= */
    const role = (req.user?.roleNames?.[0] || "").toLowerCase();
    const isSuperAdmin = role === "superadmin";

    /* ================= TENANT-SAFE WHERE ================= */
    const where = { id };

    if (!isSuperAdmin) {
      where.organization_id = req.user.organization_id;

      if (req.user.facility_id) {
        where.facility_id = req.user.facility_id;
      }
    }

    const result = await LabResult.findOne({
      where,
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    if (!result) {
      await t.rollback();
      return error(res, "Lab Result not found", null, 404);
    }

    /* ================= VERIFIED PROTECTION ================= */
    if (result.status?.toLowerCase() === "verified") {
      await t.rollback();
      return error(
        res,
        "Verified lab results cannot be deleted",
        null,
        403
      );
    }

    const oldSnapshot = { ...result.get() };

    /* ================= SOFT DELETE ================= */
    await result.update(
      { deleted_by_id: req.user?.id || null },
      { transaction: t }
    );

    await result.destroy({ transaction: t });

    /* ================= CASCADE ================= */
    await cascadeResultStatus(
      result,
      LRSR.cancelled,
      req.user?.id,
      t
    );

    await t.commit();

    const full = await LabResult.findOne({
      where: { id },
      include: LAB_RESULT_INCLUDES,
      paranoid: false, // include soft-deleted record
    });

    /* ================= AUDIT ================= */
    await auditService.logAction({
      user: req.user,
      module_key: MODULE_KEY,
      action: "delete",
      entityId: id,
      entity: full,
      details: {
        before: oldSnapshot,
        after: full?.get?.() || null,
      },
    });

    return success(res, "Lab Result deleted", full);
  } catch (err) {
    await t.rollback();
    return error(res, "Failed to delete lab result", err);
  }
};
/* ============================================================
   📌 SUBMIT LAB RESULT (draft → pending) — MASTER
============================================================ */
export const submitLabResult = async (req, res) => {
  const body = Array.isArray(req.body) ? req.body[0] : req.body || {};
  return updateLabResultStatus({
    req,
    res,
    id: req.params.id || body.id,
    newStatus: "pending",
    auditAction: "submit",
  });
};

/* ============================================================
   📌 START LAB RESULT (pending → in_progress)
============================================================ */
export const startLabResult = async (req, res) => {
  const body = Array.isArray(req.body) ? req.body[0] : req.body || {};

  return updateLabResultStatus({
    req,
    res,
    id: req.params.id || body.id,
    newStatus: "in_progress",
    auditAction: "start",
  });
};


/* ============================================================
   📌 COMPLETE LAB RESULT (in_progress → completed)
============================================================ */
export const completeLabResult = async (req, res) => {
  const body = Array.isArray(req.body) ? req.body[0] : req.body || {};

  return updateLabResultStatus({
    req,
    res,
    id: req.params.id || body.id,
    newStatus: "completed",
    auditAction: "complete",
  });
};


/* ============================================================
   📌 REVIEW LAB RESULT (completed → reviewed)
============================================================ */
export const reviewLabResult = async (req, res) => {
  const body = Array.isArray(req.body) ? req.body[0] : req.body || {};

  return updateLabResultStatus({
    req,
    res,
    id: req.params.id || body.id,
    newStatus: "reviewed",
    auditAction: "review",
    extraFields: {
      reviewed_by_id: req.user?.id || null,
    },
  });
};


/* ============================================================
   📌 VERIFY LAB RESULT (reviewed → verified)
   🔒 Admin / SuperAdmin Only
============================================================ */
export const verifyLabResult = async (req, res) => {
  const role = (req.user?.roleNames?.[0] || "").toLowerCase();

  if (!["admin", "superadmin"].includes(role)) {
    return error(
      res,
      "Only admin or superadmin can verify lab results",
      null,
      403
    );
  }

  const body = Array.isArray(req.body) ? req.body[0] : req.body || {};

  return updateLabResultStatus({
    req,
    res,
    id: req.params.id || body.id,
    newStatus: "verified",
    auditAction: "verify",
    extraFields: {
      verified_by_id: req.user?.id || null,
    },
  });
};


/* ============================================================
   📌 CANCEL LAB RESULT (pending/in_progress → cancelled)
============================================================ */
export const cancelLabResult = async (req, res) => {
  const body = Array.isArray(req.body) ? req.body[0] : req.body || {};

  return updateLabResultStatus({
    req,
    res,
    id: req.params.id || body.id,
    newStatus: "cancelled",
    auditAction: "cancel",
  });
};


/* ============================================================
   📌 VOID LAB RESULT
   🔒 Admin / SuperAdmin Only
============================================================ */
export const voidLabResult = async (req, res) => {
  const role = (req.user?.roleNames?.[0] || "").toLowerCase();

  if (!["admin", "superadmin"].includes(role)) {
    return error(
      res,
      "Only admin or superadmin can void lab results",
      null,
      403
    );
  }

  const body = Array.isArray(req.body) ? req.body[0] : req.body || {};

  return updateLabResultStatus({
    req,
    res,
    id: req.params.id || body.id,
    newStatus: "voided",
    auditAction: "void",
  });
};