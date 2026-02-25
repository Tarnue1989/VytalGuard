// 📁 controllers/labRequestController.js
// ============================================================================
// 🧪 Lab Request Controller — ENTERPRISE MASTER–ALIGNED (Delivery Billing Style)
// ----------------------------------------------------------------------------
// 🔹 NO billing constants / shouldTriggerBilling
// 🔹 NO inline role helpers
// 🔹 Uses role-utils + resolveOrgFacility
// 🔹 Billing handled ONLY via billingService
// ============================================================================

/* ============================================================
   📦 CORE / THIRD-PARTY
============================================================ */
import Joi from "joi";
import { Op } from "sequelize";

/* ============================================================
   🗄️ MODELS
============================================================ */
import {
  sequelize,
  LabRequest,
  LabRequestItem,
  LabResult,
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

/* ============================================================
   🧰 CORE UTILITIES
============================================================ */
import { success, error } from "../utils/response.js";
import { validate } from "../utils/validation.js";
import { buildQueryOptions } from "../utils/queryHelper.js";
import { validatePaginationStrict } from "../utils/query-utils.js";
import { normalizeDateRangeLocal } from "../utils/date-utils.js";
import { resolveOrgFacility } from "../utils/resolveOrgFacility.js";
import { resolveClinicalLinks } from "../utils/autoLinkHelpers.js";

/* ============================================================
   🔐 ROLE & ACCESS
============================================================ */
import {
  isSuperAdmin,
  isOrgLevelUser,
  isFacilityHead,
} from "../utils/role-utils.js";

/* ============================================================
   📜 CONSTANTS
============================================================ */
import { LAB_REQUEST_STATUS } from "../constants/enums.js";
import { FIELD_VISIBILITY_LAB_REQUEST } from "../constants/fieldVisibility.js";

/* ============================================================
   🔧 SERVICES
============================================================ */
import { authzService } from "../services/authzService.js";
import { auditService } from "../services/auditService.js";
import { billingService } from "../services/billingService.js";

/* ============================================================
   🐞 DEBUG LOGGER (MASTER)
============================================================ */
import { makeModuleLogger } from "../utils/debugLogger.js";

const DEBUG_OVERRIDE = false;
const debug = makeModuleLogger("labRequestController", DEBUG_OVERRIDE);

/* ============================================================
   🔐 MODULE
============================================================ */
const MODULE_KEY = "lab-requests";

/* ============================================================
   🔖 STATUS MAP (ENUM-DRIVEN, MASTER)
============================================================ */
const LRS = {
  DRAFT: LAB_REQUEST_STATUS[0],
  PENDING: LAB_REQUEST_STATUS[1],
  IN_PROGRESS: LAB_REQUEST_STATUS[2],
  COMPLETED: LAB_REQUEST_STATUS[3],
  VERIFIED: LAB_REQUEST_STATUS[4],
  CANCELLED: LAB_REQUEST_STATUS[5],
  VOIDED: LAB_REQUEST_STATUS[6],
};

/* ============================================================
   🔗 SHARED INCLUDES (MASTER PARITY)
============================================================ */
const LAB_REQUEST_INCLUDES = [
  { model: Patient, as: "patient", attributes: ["id", "pat_no", "first_name", "last_name"] },
  { model: Employee.unscoped(), as: "doctor", attributes: ["id", "first_name", "last_name"] },
  { model: Department, as: "department", attributes: ["id", "name"] },
  { model: Consultation, as: "consultation", attributes: ["id", "consultation_date", "status"] },
  {
    model: RegistrationLog,
    as: "registrationLog",
    attributes: ["id", "registration_time", "log_status"],
  },
  {
    model: LabRequestItem,
    as: "items",
    required: false,
    where: {
      status: { [Op.notIn]: [LRS.CANCELLED, LRS.VOIDED] },
    },
    include: [
      { model: BillableItem, as: "labTest", attributes: ["id", "name", "price"] },
    ],
  },
  { model: Organization, as: "organization", attributes: ["id", "name", "code"] },
  { model: Facility, as: "facility", attributes: ["id", "name", "code", "organization_id"] },
  { model: User, as: "createdBy", attributes: ["id", "first_name", "last_name"] },
  { model: User, as: "updatedBy", attributes: ["id", "first_name", "last_name"] },
  { model: User, as: "deletedBy", attributes: ["id", "first_name", "last_name"] },
];

/* ============================================================
   📋 JOI SCHEMA (MASTER-ALIGNED, TENANT-SAFE) — REPLACEMENT
============================================================ */
function buildLabRequestSchema(mode = "create") {
  const base = {
    patient_id: Joi.string().uuid().required(),
    doctor_id: Joi.string().uuid().allow(null, ""),
    department_id: Joi.string().uuid().allow(null, ""),
    consultation_id: Joi.string().uuid().allow(null, ""),
    registration_log_id: Joi.string().uuid().allow(null, ""),
    request_date: Joi.date().default(() => new Date()),
    notes: Joi.string().allow("", null),
    is_emergency: Joi.boolean().default(false),

    // 🔒 lifecycle-controlled
    status: Joi.forbidden(),
    organization_id: Joi.forbidden(),
    facility_id: Joi.forbidden(),

    items: Joi.array()
      .items(
        Joi.object({
          lab_test_id: Joi.string().uuid().required(),
          notes: Joi.string().allow("", null),
        })
      )
      .min(1)
      .required(),
  };

  if (mode === "update") {
    Object.keys(base).forEach((k) => {
      base[k] = base[k].optional();
    });

    base.items = Joi.array()
      .items(
        Joi.object({
          id: Joi.string().uuid().optional(),
          lab_test_id: Joi.string().uuid().optional(),
          notes: Joi.string().allow("", null),
          _delete: Joi.boolean().optional().default(false),
        })
      )
      .optional();
  }

  return Joi.object(base);
}
/* ============================================================
   📌 CREATE LAB REQUEST(S) — MASTER / CONSULTATION PARITY
============================================================ */
export const createLabRequests = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    /* ================= PERMISSION ================= */
    const allowed = await authzService.checkPermission({
      user: req.user,
      module_key: MODULE_KEY,
      action: "create",
      res,
    });
    if (!allowed) return;

    /* ================= PAYLOAD NORMALIZATION ================= */
    const payloads = Array.isArray(req.body) ? req.body : [req.body];
    if (!payloads.length) {
      await t.rollback();
      return error(res, "Payload must not be empty", null, 400);
    }

    const createdIds = [];
    const skipped = [];

    /* ================= PROCESS PAYLOADS ================= */
    for (const [idx, payload] of payloads.entries()) {
      /* ---------- VALIDATION ---------- */
      const { value, errors } = validate(
        buildLabRequestSchema("create"),
        payload
      );

      if (errors) {
        skipped.push({ index: idx, reason: "Validation failed", errors });
        continue;
      }

      /* ---------- TENANT RESOLUTION ---------- */
      const { orgId, facilityId } = await resolveOrgFacility({
        user: req.user,
        value,
        body: payload,
      });

      /* ---------- AUTO-LINK CLINICAL CONTEXT (FIX 1) ---------- */
      const resolved = await resolveClinicalLinks({
        value,
        user: req.user,
        orgId,
        facilityId,
        transaction: t,
      });

      /* ---------- DOCTOR ENFORCEMENT (FIX 2) ---------- */
      if (!isSuperAdmin(req.user) && !resolved.doctor_id) {
        resolved.doctor_id = req.user.employee_id;
      }

      if (isSuperAdmin(req.user) && !resolved.doctor_id) {
        skipped.push({
          index: idx,
          reason: "Doctor is required for superadmin",
        });
        continue;
      }

      /* ---------- HARD REQUIREMENT: REGISTRATION LOG ---------- */
      if (!resolved.registration_log_id) {
        skipped.push({
          index: idx,
          reason: "No active registration log found",
        });
        continue;
      }

      /* ---------- CREATE LAB REQUEST ---------- */
      const request = await LabRequest.create(
        {
          ...resolved,
          status: LRS.DRAFT,
          organization_id: orgId,
          facility_id: facilityId,
          created_by_id: req.user?.id || null,
        },
        { transaction: t }
      );

      /* ---------- CREATE ITEMS ---------- */
      const items = resolved.items.map((it) => ({
        lab_request_id: request.id,
        lab_test_id: it.lab_test_id,
        notes: it.notes || null,
        status: request.status,
        organization_id: orgId,
        facility_id: facilityId,
        created_by_id: req.user?.id || null,
      }));

      await LabRequestItem.bulkCreate(items, { transaction: t });

      createdIds.push(request.id);
    }

    await t.commit();

    /* ================= LOAD CREATED ================= */
    const records = createdIds.length
      ? await LabRequest.findAll({
          where: { id: { [Op.in]: createdIds } },
          include: LAB_REQUEST_INCLUDES,
        })
      : [];

    /* ================= AUDIT ================= */
    await auditService.logAction({
      user: req.user,
      module_key: MODULE_KEY,
      action: createdIds.length > 1 ? "bulk_create" : "create",
      details: {
        created: createdIds.length,
        skipped: skipped.length,
      },
    });

    return success(res, "✅ Lab Requests created", {
      records,
      skipped,
    });
  } catch (err) {
    await t.rollback();
    debug.error("createLabRequests → FAILED", err);
    return error(res, "❌ Failed to create lab requests", err);
  }
};


/* ============================================================
   📌 UPDATE LAB REQUEST — MASTER / CONSULTATION PARITY
============================================================ */
export const updateLabRequest = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    /* ================= PERMISSION ================= */
    const allowed = await authzService.checkPermission({
      user: req.user,
      module_key: MODULE_KEY,
      action: "update",
      res,
    });
    if (!allowed) return;

    /* ================= VALIDATION ================= */
    const { value, errors } = validate(
      buildLabRequestSchema("update"),
      req.body
    );
    if (errors) {
      await t.rollback();
      return error(res, "Validation failed", errors, 400);
    }

    /* ================= TENANT RESOLUTION (FIX 3) ================= */
    const { orgId, facilityId } = await resolveOrgFacility({
      user: req.user,
      body: value,
    });

    /* ================= LOAD RECORD (TENANT SAFE) ================= */
    const record = await LabRequest.findOne({
      where: {
        id: req.params.id,
        organization_id: orgId,
        ...(facilityId ? { facility_id: facilityId } : {}),
      },
      include: [{ model: LabRequestItem, as: "items" }],
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    if (!record) {
      await t.rollback();
      return error(res, "Lab Request not found", null, 404);
    }

    if (
      [LRS.COMPLETED, LRS.VERIFIED, LRS.CANCELLED, LRS.VOIDED].includes(
        record.status
      )
    ) {
      await t.rollback();
      return error(res, "Finalized lab request cannot be edited", null, 400);
    }

    /* ================= DOCTOR LOCK (MASTER) ================= */
    if (!isSuperAdmin(req.user) && !value.doctor_id) {
      value.doctor_id = req.user.employee_id;
    }

    /* ================= UPDATE REQUEST ================= */
    await record.update(
      {
        ...value,
        updated_by_id: req.user?.id || null,
      },
      { transaction: t }
    );

    /* ================= ITEM DIFF SYNC ================= */
    if (Array.isArray(value.items)) {
      const existing = new Map(record.items.map((i) => [i.id, i]));

      for (const it of value.items) {
        /* ---- DELETE ITEM ---- */
        if (it._delete && it.id && existing.has(it.id)) {
          const item = existing.get(it.id);

          await item.update(
            {
              status: LRS.CANCELLED,
              deleted_by_id: req.user?.id || null,
            },
            { transaction: t }
          );

          await billingService.voidCharges({
            module_key: MODULE_KEY,
            entityId: item.id,
            user: req.user,
            transaction: t,
          });
          continue;
        }

        /* ---- UPDATE ITEM ---- */
        if (it.id && existing.has(it.id)) {
          const current = existing.get(it.id);

          await current.update(
            {
              lab_test_id: it.lab_test_id || current.lab_test_id,
              notes: it.notes ?? current.notes,
              updated_by_id: req.user?.id || null,
            },
            { transaction: t }
          );
          continue;
        }

        /* ---- ADD NEW ITEM ---- */
        if (it.lab_test_id) {
          await LabRequestItem.create(
            {
              lab_request_id: record.id,
              lab_test_id: it.lab_test_id,
              notes: it.notes || null,
              status: record.status,
              organization_id: record.organization_id,
              facility_id: record.facility_id,
              created_by_id: req.user?.id || null,
            },
            { transaction: t }
          );
        }
      }
    }

    await t.commit();

    /* ================= LOAD FULL ================= */
    const full = await LabRequest.findOne({
      where: { id: record.id },
      include: LAB_REQUEST_INCLUDES,
    });

    /* ================= AUDIT ================= */
    await auditService.logAction({
      user: req.user,
      module_key: MODULE_KEY,
      action: "update",
      entityId: record.id,
      entity: full,
    });

    return success(res, "✅ Lab Request updated", full);
  } catch (err) {
    await t.rollback();
    debug.error("updateLabRequest → FAILED", err);
    return error(res, "❌ Failed to update lab request", err);
  }
};


/* ============================================================
   📌 GET LAB REQUEST BY ID — MASTER
============================================================ */
export const getLabRequestById = async (req, res) => {
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module_key: MODULE_KEY,
      action: "read",
      res,
    });
    if (!allowed) return;

    const { orgId, facilityId } = await resolveOrgFacility({
      user: req.user,
      query: req.query,
    });

    const record = await LabRequest.findOne({
      where: {
        id: req.params.id,
        organization_id: orgId,
        ...(facilityId ? { facility_id: facilityId } : {}),
      },
      include: LAB_REQUEST_INCLUDES,
    });

    if (!record) {
      return error(res, "Lab request not found", null, 404);
    }

    const plain = record.get({ plain: true });

    const patientLabel = plain.patient
      ? `${plain.patient.pat_no} - ${plain.patient.first_name} ${plain.patient.last_name}`
      : "Unknown Patient";

    const doctorLabel = plain.doctor
      ? `Dr. ${plain.doctor.first_name} ${plain.doctor.last_name}`
      : "No Doctor";

    const tests = (plain.items || [])
      .map((i) => i.labTest?.name)
      .filter(Boolean)
      .join(", ");

    plain.label = `${patientLabel} · ${tests || "No tests"} · ${plain.status}`;
    plain.patient_label = patientLabel;
    plain.doctor_label = doctorLabel;

    await auditService.logAction({
      user: req.user,
      module_key: MODULE_KEY,
      action: "view",
      entityId: plain.id,
    });

    return success(res, "Lab request loaded", plain);
  } catch (err) {
    debug.error("getLabRequestById → FAILED", err);
    return error(res, "Failed to load lab request", err);
  }
};

/* ============================================================
   📌 GET ALL LAB REQUESTS — MASTER (STRICT + FILTERS + SUMMARY)
============================================================ */
export const getAllLabRequests = async (req, res) => {
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module_key: MODULE_KEY,
      action: "read",
      res,
    });
    if (!allowed) return;

    /* ================= STRICT PAGINATION ================= */
    const { limit, page, offset } = validatePaginationStrict(req, {
      limit: 25,
      maxLimit: 200,
    });

    const role = (req.user?.roleNames?.[0] || "staff").toLowerCase();
    const visibleFields =
      FIELD_VISIBILITY_LAB_REQUEST[role] ||
      FIELD_VISIBILITY_LAB_REQUEST.staff;

    /* ================= STRIP UI-ONLY PARAMS ================= */
    const {
      dateRange,
      status,
      patient_id,
      doctor_id,
      department_id,
      consultation_id,
      facility_id, // explicitly captured
      ...safeQuery
    } = req.query;

    safeQuery.limit = limit;
    safeQuery.page = page;
    req.query = safeQuery;

    const options = buildQueryOptions(
      req,
      "request_date",
      "DESC",
      visibleFields
    );

    options.where = { [Op.and]: [] };

    /* ========================================================
       📅 DATE RANGE (request_date) — FIXED
    ======================================================== */
    if (dateRange) {
      const { start, end } = normalizeDateRangeLocal(dateRange);
      if (start && end) {
        options.where[Op.and].push({
          request_date: { [Op.between]: [start, end] },
        });
      }
    }

    /* ================= TENANT SCOPE (MASTER) ================= */
    if (!isSuperAdmin(req.user)) {
      options.where[Op.and].push({
        organization_id: req.user.organization_id,
      });

      if (isFacilityHead(req.user)) {
        options.where[Op.and].push({
          facility_id: req.user.facility_id,
        });
      } else if (facility_id) {
        options.where[Op.and].push({
          facility_id,
        });
      }
    } else {
      if (req.query.organization_id) {
        options.where[Op.and].push({
          organization_id: req.query.organization_id,
        });
      }
      if (facility_id) {
        options.where[Op.and].push({
          facility_id,
        });
      }
    }

    /* ================= FILTERS ================= */
    if (patient_id) {
      options.where[Op.and].push({ patient_id });
    }

    if (doctor_id) {
      options.where[Op.and].push({ doctor_id });
    }

    if (department_id) {
      options.where[Op.and].push({ department_id });
    }

    if (consultation_id) {
      options.where[Op.and].push({ consultation_id });
    }

    if (status) {
      const statuses = Array.isArray(status)
        ? status
        : status.split(",").map((s) => s.trim());

      options.where[Op.and].push({
        status: { [Op.in]: statuses },
      });
    }

    /* ================= GLOBAL SEARCH ================= */
    if (options.search) {
      options.where[Op.and].push({
        [Op.or]: [
          { notes: { [Op.iLike]: `%${options.search}%` } },
          { "$patient.first_name$": { [Op.iLike]: `%${options.search}%` } },
          { "$patient.last_name$": { [Op.iLike]: `%${options.search}%` } },
        ],
      });
    }

    /* ================= MAIN QUERY ================= */
    const { count, rows } = await LabRequest.findAndCountAll({
      where: options.where,
      include: LAB_REQUEST_INCLUDES,
      order: options.order,
      offset,
      limit,
      distinct: true,
    });

    /* ================= RICH SUMMARY (MASTER) ================= */
    const summary = { total: count };

    const statusCounts = await LabRequest.findAll({
      where: options.where,
      attributes: [
        "status",
        [sequelize.fn("COUNT", sequelize.col("id")), "count"],
      ],
      group: ["status"],
    });

    Object.values(LRS).forEach((s) => {
      const found = statusCounts.find((r) => r.status === s);
      summary[s] = found ? Number(found.get("count")) : 0;
    });

    /* ================= AUDIT ================= */
    await auditService.logAction({
      user: req.user,
      module_key: MODULE_KEY,
      action: "list",
      details: {
        query: safeQuery,
        returned: count,
        pagination: { page, limit },
      },
    });

    /* ================= RESPONSE ================= */
    return success(res, "✅ Lab requests loaded", {
      records: rows,
      summary,
      pagination: {
        total: count,
        page,
        limit,
        pageCount: Math.ceil(count / limit),
      },
    });
  } catch (err) {
    debug.error("getAllLabRequests → FAILED", err);
    return error(res, "❌ Failed to load lab requests", err);
  }
};

/* ============================================================
   📌 GET ALL LAB REQUESTS — LITE (MASTER)
============================================================ */
export const getAllLabRequestsLite = async (req, res) => {
  try {
    /* ================= PERMISSION ================= */
    const allowed = await authzService.checkPermission({
      user: req.user,
      module_key: MODULE_KEY,
      action: "read",
      res,
    });
    if (!allowed) return;

    /* ================= QUERY PARAMS ================= */
    const { q, patient_id, status } = req.query;

    /* ================= TENANT RESOLUTION ================= */
    const { orgId, facilityId } = await resolveOrgFacility({
      user: req.user,
      query: req.query,
    });

    /* ================= WHERE ================= */
    const where = {
      organization_id: orgId,
      ...(facilityId ? { facility_id: facilityId } : {}),
      ...(patient_id ? { patient_id } : {}),
      ...(status ? { status } : {}),
    };

    if (q) {
      where[Op.or] = [
        { notes: { [Op.iLike]: `%${q}%` } },
        { "$patient.first_name$": { [Op.iLike]: `%${q}%` } },
        { "$patient.last_name$": { [Op.iLike]: `%${q}%` } },
      ];
    }

    /* ================= QUERY ================= */
    const rows = await LabRequest.findAll({
      where,
      attributes: ["id", "request_date", "status"],
      include: [
        {
          model: Patient,
          as: "patient",
          attributes: ["pat_no", "first_name", "last_name"],
        },
      ],
      order: [["request_date", "DESC"]],
      limit: 50,
    });

    /* ================= SHAPE ================= */
    const records = rows.map((r) => ({
      id: r.id,
      label: `${r.patient?.pat_no || "PAT"} · ${r.status}`,
      patient: r.patient
        ? `${r.patient.first_name} ${r.patient.last_name}`
        : "Unknown",
      date: r.request_date,
      status: r.status,
    }));

    return success(res, "Lab requests loaded (lite)", { records });
  } catch (err) {
    debug.error("getAllLabRequestsLite → FAILED", err);
    return error(res, "Failed to load lab requests (lite)", err);
  }
};

/* ============================================================
   📌 GET ALL LAB REQUEST ITEMS — LITE (MASTER)
============================================================ */
export const getAllLabRequestItemsLite = async (req, res) => {
  try {
    /* ================= PERMISSION ================= */
    const allowed = await authzService.checkPermission({
      user: req.user,
      module_key: MODULE_KEY,
      action: "read",
      res,
    });
    if (!allowed) return;

    /* ================= PARAMS ================= */
    const { lab_request_id, status } = req.query;
    if (!lab_request_id) {
      return error(res, "lab_request_id is required", null, 400);
    }

    /* ================= TENANT RESOLUTION ================= */
    const { orgId, facilityId } = await resolveOrgFacility({
      user: req.user,
      query: req.query,
    });

    /* ================= WHERE ================= */
    const where = {
      lab_request_id,
      organization_id: orgId,
      ...(facilityId ? { facility_id: facilityId } : {}),
      ...(status ? { status } : {}),
    };

    /* ================= QUERY ================= */
    const items = await LabRequestItem.findAll({
      where,
      attributes: ["id", "lab_request_id", "lab_test_id", "status", "notes"],
      include: [
        {
          model: BillableItem,
          as: "labTest",
          attributes: ["id", "name", "price"],
        },
      ],
      order: [["created_at", "ASC"]],
    });

    /* ================= SHAPE ================= */
    const records = items.map((i) => ({
      id: i.id,
      label: `${i.labTest?.name || "Unnamed Test"} · ${(i.status || "").toLowerCase()}`,
      lab_request_id: i.lab_request_id,
      lab_test_id: i.lab_test_id,
      test: i.labTest?.name || "",
      status: i.status,
      notes: i.notes || "",
    }));

    return success(res, "Lab request items loaded (lite)", { records });
  } catch (err) {
    debug.error("getAllLabRequestItemsLite → FAILED", err);
    return error(res, "Failed to load lab request items (lite)", err);
  }
};

/* ============================================================
   📌 ACTIVATE LAB REQUEST(S) (pending → in_progress) — MASTER
============================================================ */
export const activateLabRequests = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    /* ================= PERMISSION ================= */
    const allowed = await authzService.checkPermission({
      user: req.user,
      module_key: MODULE_KEY,
      action: "update",
      res,
    });
    if (!allowed) return;

    /* ================= IDS ================= */
    const ids = Array.isArray(req.body?.ids)
      ? req.body.ids
      : [req.params.id];

    if (!ids.length) {
      await t.rollback();
      return error(res, "At least one ID is required", null, 400);
    }

    /* ================= TENANT ================= */
    const { orgId, facilityId } = await resolveOrgFacility({
      user: req.user,
      query: req.query,
    });

    /* ================= LOAD ================= */
    const requests = await LabRequest.findAll({
      where: {
        id: { [Op.in]: ids },
        organization_id: orgId,
        ...(facilityId ? { facility_id: facilityId } : {}),
        status: LRS.PENDING,
      },
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    if (!requests.length) {
      await t.rollback();
      return error(res, "No pending lab requests found", null, 404);
    }

    /* ================= UPDATE ================= */
    for (const r of requests) {
      await r.update(
        {
          status: LRS.IN_PROGRESS,
          updated_by_id: req.user.id,
        },
        { transaction: t }
      );
    }

    await t.commit();

    const records = await LabRequest.findAll({
      where: { id: { [Op.in]: ids } },
      include: LAB_REQUEST_INCLUDES,
    });

    await auditService.logAction({
      user: req.user,
      module_key: MODULE_KEY,
      action: ids.length > 1 ? "bulk_activate" : "activate",
      details: { count: records.length },
    });

    return success(res, "Lab requests activated", { records });
  } catch (err) {
    await t.rollback();
    debug.error("activateLabRequests → FAILED", err);
    return error(res, "Failed to activate lab requests", err);
  }
};

/* ============================================================
   📌 DELETE LAB REQUEST(S) (SOFT DELETE) — MASTER
============================================================ */
export const deleteLabRequests = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    /* ================= PERMISSION ================= */
    const allowed = await authzService.checkPermission({
      user: req.user,
      module_key: MODULE_KEY,
      action: "delete",
      res,
    });
    if (!allowed) return;

    /* ================= IDS ================= */
    const ids = Array.isArray(req.body?.ids)
      ? req.body.ids
      : [req.params.id];

    if (!ids.length) {
      await t.rollback();
      return error(res, "At least one ID is required", null, 400);
    }

    /* ================= TENANT ================= */
    const { orgId, facilityId } = await resolveOrgFacility({
      user: req.user,
      query: req.query,
    });

    /* ================= LOAD ================= */
    const requests = await LabRequest.findAll({
      where: {
        id: { [Op.in]: ids },
        organization_id: orgId,
        ...(facilityId ? { facility_id: facilityId } : {}),
      },
      include: [{ model: LabRequestItem, as: "items" }],
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    if (!requests.length) {
      await t.rollback();
      return error(res, "No lab requests found", null, 404);
    }

    const deleted = [];
    const skipped = [];

    /* ================= PROCESS ================= */
    for (const r of requests) {
      if ([LRS.COMPLETED, LRS.VERIFIED].includes(r.status)) {
        skipped.push({ id: r.id, reason: "Finalized request cannot be deleted" });
        continue;
      }

      for (const item of r.items || []) {
        await billingService.voidCharges({
          module_key: MODULE_KEY,
          entityId: item.id,
          user: req.user,
          transaction: t,
        });
      }

      await LabRequestItem.update(
        { status: LRS.CANCELLED },
        { where: { lab_request_id: r.id }, transaction: t }
      );

      await LabResult.update(
        { status: "cancelled" },
        { where: { lab_request_id: r.id }, transaction: t }
      );

      await r.update({ deleted_by_id: req.user.id }, { transaction: t });
      await r.destroy({ transaction: t });

      deleted.push(r.id);
    }

    await t.commit();

    await auditService.logAction({
      user: req.user,
      module_key: MODULE_KEY,
      action: ids.length > 1 ? "bulk_delete" : "delete",
      details: { deleted, skipped },
    });

    return success(res, "Lab requests deleted", { deleted, skipped });
  } catch (err) {
    await t.rollback();
    debug.error("deleteLabRequests → FAILED", err);
    return error(res, "Failed to delete lab requests", err);
  }
};

/* ============================================================
   📌 COMPLETE LAB REQUEST(S) (in_progress → completed) — MASTER
============================================================ */
export const completeLabRequests = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    /* ================= PERMISSION ================= */
    const allowed = await authzService.checkPermission({
      user: req.user,
      module_key: MODULE_KEY,
      action: "update",
      res,
    });
    if (!allowed) return;

    /* ================= IDS ================= */
    const ids = Array.isArray(req.body?.ids)
      ? req.body.ids
      : [req.params.id];

    if (!ids.length) {
      await t.rollback();
      return error(res, "At least one ID is required", null, 400);
    }

    /* ================= TENANT ================= */
    const { orgId, facilityId } = await resolveOrgFacility({
      user: req.user,
      query: req.query,
    });

    /* ================= LOAD ================= */
    const requests = await LabRequest.findAll({
      where: {
        id: { [Op.in]: ids },
        organization_id: orgId,
        ...(facilityId ? { facility_id: facilityId } : {}),
        status: LRS.IN_PROGRESS,
      },
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    if (!requests.length) {
      await t.rollback();
      return error(res, "No in-progress lab requests found", null, 404);
    }

    const updated = [];
    const skipped = [];

    /* ================= PROCESS ================= */
    for (const r of requests) {
      const resultCount = await LabResult.count({
        where: { lab_request_id: r.id },
        transaction: t,
      });

      if (!resultCount) {
        skipped.push({ id: r.id, reason: "No lab results found" });
        continue;
      }

      await r.update(
        {
          status: LRS.COMPLETED,
          updated_by_id: req.user.id,
        },
        { transaction: t }
      );

      await LabRequestItem.update(
        { status: LRS.COMPLETED },
        { where: { lab_request_id: r.id }, transaction: t }
      );

      updated.push(r.id);
    }

    await t.commit();

    const records = await LabRequest.findAll({
      where: { id: { [Op.in]: updated } },
      include: LAB_REQUEST_INCLUDES,
    });

    await auditService.logAction({
      user: req.user,
      module_key: MODULE_KEY,
      action: ids.length > 1 ? "bulk_complete" : "complete",
      details: { updated, skipped },
    });

    return success(res, "Lab requests completed", { records, skipped });
  } catch (err) {
    await t.rollback();
    debug.error("completeLabRequests → FAILED", err);
    return error(res, "Failed to complete lab requests", err);
  }
};
/* ============================================================
   📌 CANCEL LAB REQUEST(S) (pending / in_progress → cancelled)
============================================================ */
export const cancelLabRequests = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    /* ================= PERMISSION ================= */
    const allowed = await authzService.checkPermission({
      user: req.user,
      module_key: MODULE_KEY,
      action: "update",
      res,
    });
    if (!allowed) return;

    /* ================= IDS ================= */
    const ids = Array.isArray(req.body?.ids)
      ? req.body.ids
      : [req.params.id];

    if (!ids.length) {
      await t.rollback();
      return error(res, "At least one ID is required", null, 400);
    }

    /* ================= TENANT ================= */
    const { orgId, facilityId } = await resolveOrgFacility({
      user: req.user,
      query: req.query,
    });

    /* ================= LOAD ================= */
    const requests = await LabRequest.findAll({
      where: {
        id: { [Op.in]: ids },
        organization_id: orgId,
        ...(facilityId ? { facility_id: facilityId } : {}),
        status: { [Op.in]: [LRS.PENDING, LRS.IN_PROGRESS] },
      },
      include: [{ model: LabRequestItem, as: "items" }],
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    if (!requests.length) {
      await t.rollback();
      return error(res, "No cancellable lab requests found", null, 404);
    }

    const updated = [];
    const skipped = [];

    /* ================= PROCESS ================= */
    for (const r of requests) {
      await r.update(
        {
          status: LRS.CANCELLED,
          updated_by_id: req.user.id,
        },
        { transaction: t }
      );

      for (const item of r.items || []) {
        await billingService.voidCharges({
          module_key: MODULE_KEY,
          entityId: item.id,
          user: req.user,
          transaction: t,
        });
      }

      await LabRequestItem.update(
        { status: LRS.CANCELLED },
        { where: { lab_request_id: r.id }, transaction: t }
      );

      await LabResult.update(
        { status: "cancelled" },
        { where: { lab_request_id: r.id }, transaction: t }
      );

      updated.push(r.id);
    }

    await t.commit();

    await auditService.logAction({
      user: req.user,
      module_key: MODULE_KEY,
      action: ids.length > 1 ? "bulk_cancel" : "cancel",
      details: { updated, skipped },
    });

    return success(res, "Lab requests cancelled", { updated, skipped });
  } catch (err) {
    await t.rollback();
    debug.error("cancelLabRequests → FAILED", err);
    return error(res, "Failed to cancel lab requests", err);
  }
};

/* ============================================================
   📌 VOID LAB REQUEST(S) (any → voided) — ADMIN ONLY
============================================================ */
export const voidLabRequests = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    /* ================= PERMISSION ================= */
    const allowed = await authzService.checkPermission({
      user: req.user,
      module_key: MODULE_KEY,
      action: "void",
      res,
    });
    if (!allowed) return;

    /* ================= IDS ================= */
    const ids = Array.isArray(req.body?.ids)
      ? req.body.ids
      : [req.params.id];

    if (!ids.length) {
      await t.rollback();
      return error(res, "At least one ID is required", null, 400);
    }

    /* ================= TENANT ================= */
    const { orgId, facilityId } = await resolveOrgFacility({
      user: req.user,
      query: req.query,
    });

    /* ================= LOAD ================= */
    const requests = await LabRequest.findAll({
      where: {
        id: { [Op.in]: ids },
        organization_id: orgId,
        ...(facilityId ? { facility_id: facilityId } : {}),
        status: { [Op.ne]: LRS.VERIFIED },
      },
      include: [{ model: LabRequestItem, as: "items" }],
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    if (!requests.length) {
      await t.rollback();
      return error(res, "No voidable lab requests found", null, 404);
    }

    const updated = [];
    const skipped = [];

    /* ================= PROCESS ================= */
    for (const r of requests) {
      await r.update(
        {
          status: LRS.VOIDED,
          updated_by_id: req.user.id,
        },
        { transaction: t }
      );

      for (const item of r.items || []) {
        await billingService.voidCharges({
          module_key: MODULE_KEY,
          entityId: item.id,
          user: req.user,
          transaction: t,
        });
      }

      await LabRequestItem.update(
        { status: LRS.VOIDED },
        { where: { lab_request_id: r.id }, transaction: t }
      );

      await LabResult.update(
        { status: "voided" },
        { where: { lab_request_id: r.id }, transaction: t }
      );

      updated.push(r.id);
    }

    await t.commit();

    await auditService.logAction({
      user: req.user,
      module_key: MODULE_KEY,
      action: ids.length > 1 ? "bulk_void" : "void",
      details: { updated, skipped },
    });

    return success(res, "Lab requests voided", { updated, skipped });
  } catch (err) {
    await t.rollback();
    debug.error("voidLabRequests → FAILED", err);
    return error(res, "Failed to void lab requests", err);
  }
};

/* ============================================================
   📌 SUBMIT LAB REQUEST(S) (draft → pending)
============================================================ */
export const submitLabRequests = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    /* ================= PERMISSION ================= */
    const allowed = await authzService.checkPermission({
      user: req.user,
      module_key: MODULE_KEY,
      action: "update",
      res,
    });
    if (!allowed) return;

    /* ================= IDS ================= */
    const ids = Array.isArray(req.body?.ids)
      ? req.body.ids
      : [req.params.id];

    if (!ids.length) {
      await t.rollback();
      return error(res, "At least one ID is required", null, 400);
    }

    /* ================= TENANT ================= */
    const { orgId, facilityId } = await resolveOrgFacility({
      user: req.user,
      query: req.query,
    });

    /* ================= LOAD ================= */
    const requests = await LabRequest.findAll({
      where: {
        id: { [Op.in]: ids },
        organization_id: orgId,
        ...(facilityId ? { facility_id: facilityId } : {}),
        status: LRS.DRAFT,
      },
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    if (!requests.length) {
      await t.rollback();
      return error(res, "No draft lab requests found", null, 404);
    }

    const updated = [];

    /* ================= PROCESS ================= */
    for (const r of requests) {
      await r.update(
        {
          status: LRS.PENDING,
          updated_by_id: req.user.id,
        },
        { transaction: t }
      );

      await LabRequestItem.update(
        { status: LRS.PENDING },
        { where: { lab_request_id: r.id }, transaction: t }
      );

      updated.push(r.id);
    }

    await t.commit();

    await auditService.logAction({
      user: req.user,
      module_key: MODULE_KEY,
      action: ids.length > 1 ? "bulk_submit" : "submit",
      details: { updated },
    });

    return success(res, "Lab requests submitted", { updated });
  } catch (err) {
    await t.rollback();
    debug.error("submitLabRequests → FAILED", err);
    return error(res, "Failed to submit lab requests", err);
  }
};

/* ============================================================
   📌 VERIFY LAB REQUEST(S) (completed → verified) — ADMIN ONLY
============================================================ */
export const verifyLabRequests = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    /* ================= PERMISSION ================= */
    const allowed = await authzService.checkPermission({
      user: req.user,
      module_key: MODULE_KEY,
      action: "verify",
      res,
    });
    if (!allowed) return;

    /* ================= IDS ================= */
    const ids = Array.isArray(req.body?.ids)
      ? req.body.ids
      : [req.params.id];

    if (!ids.length) {
      await t.rollback();
      return error(res, "At least one ID is required", null, 400);
    }

    /* ================= TENANT ================= */
    const { orgId, facilityId } = await resolveOrgFacility({
      user: req.user,
      query: req.query,
    });

    /* ================= LOAD ================= */
    const requests = await LabRequest.findAll({
      where: {
        id: { [Op.in]: ids },
        organization_id: orgId,
        ...(facilityId ? { facility_id: facilityId } : {}),
        status: LRS.COMPLETED,
      },
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    if (!requests.length) {
      await t.rollback();
      return error(res, "No completed lab requests found", null, 404);
    }

    const updated = [];
    const skipped = [];

    /* ================= PROCESS ================= */
    for (const r of requests) {
      const unverified = await LabResult.count({
        where: {
          lab_request_id: r.id,
          status: { [Op.ne]: "verified" },
        },
        transaction: t,
      });

      if (unverified) {
        skipped.push({ id: r.id, reason: "Unverified results remain" });
        continue;
      }

      await r.update(
        {
          status: LRS.VERIFIED,
          updated_by_id: req.user.id,
        },
        { transaction: t }
      );

      await LabRequestItem.update(
        { status: LRS.VERIFIED },
        { where: { lab_request_id: r.id }, transaction: t }
      );

      updated.push(r.id);
    }

    await t.commit();

    await auditService.logAction({
      user: req.user,
      module_key: MODULE_KEY,
      action: ids.length > 1 ? "bulk_verify" : "verify",
      details: { updated, skipped },
    });

    return success(res, "Lab requests verified", { updated, skipped });
  } catch (err) {
    await t.rollback();
    debug.error("verifyLabRequests → FAILED", err);
    return error(res, "Failed to verify lab requests", err);
  }
};
