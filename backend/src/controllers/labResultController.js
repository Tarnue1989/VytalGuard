// 📁 controllers/labResultController.js
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
import { LAB_RESULT_STATUS, LAB_REQUEST_STATUS, LAB_REQUEST_ITEM_STATUS  } from "../constants/enums.js";
import { authzService } from "../services/authzService.js";
import { auditService } from "../services/auditService.js";
import { FIELD_VISIBILITY_LAB_RESULT,  } from "../constants/fieldVisibility.js";
import { syncLabRequestStatus } from "../services/labRequestSyncService.js";

const MODULE_KEY = "lab_result";

// 🔖 Local enum maps
const LRSR = {
  DRAFT: LAB_RESULT_STATUS[0],
  PENDING: LAB_RESULT_STATUS[1],
  IN_PROGRESS: LAB_RESULT_STATUS[2],
  COMPLETED: LAB_RESULT_STATUS[3],
  REVIEWED: LAB_RESULT_STATUS[4],
  VERIFIED: LAB_RESULT_STATUS[5],
  CANCELLED: LAB_RESULT_STATUS[6],
  VOIDED: LAB_RESULT_STATUS[7],
};
const LRI = {
  DRAFT: LAB_REQUEST_ITEM_STATUS[0],       // draft
  PENDING: LAB_REQUEST_ITEM_STATUS[1],     // pending
  IN_PROGRESS: LAB_REQUEST_ITEM_STATUS[2], // in_progress
  COMPLETED: LAB_REQUEST_ITEM_STATUS[3],   // completed
  VERIFIED: LAB_REQUEST_ITEM_STATUS[4],    // verified
  CANCELLED: LAB_REQUEST_ITEM_STATUS[5],   // cancelled
  VOIDED: LAB_REQUEST_ITEM_STATUS[6],      // voided
};
const LREQ = {
  PENDING: LAB_REQUEST_STATUS[1],
  IN_PROGRESS: LAB_REQUEST_STATUS[2],
};

/* ============================================================
   🔗 SHARED INCLUDES (cleaned)
   ============================================================ */
const LAB_RESULT_INCLUDES = [
  { model: Patient, as: "patient", attributes: ["id", "pat_no", "first_name", "last_name"] },
  { model: Employee.unscoped(), as: "doctor", attributes: ["id", "first_name", "last_name"] },
  { model: Department, as: "department", attributes: ["id", "name"] },
  { model: Consultation, as: "consultation", attributes: ["id", "consultation_date", "status"] },
  { model: RegistrationLog, as: "registrationLog", attributes: ["id", "registration_time", "log_status"] },
  {
    model: LabRequest,
    as: "labRequest",
    attributes: ["id", "status", "request_date"],
  },
  {
    model: sequelize.models.LabRequestItem,
    as: "labRequestItem",
    attributes: ["id", "status", "notes"],
    include: [
      { model: BillableItem, as: "labTest", attributes: ["id", "name", "code", "description"] },
    ],
  },
  { model: Organization, as: "organization", attributes: ["id", "name", "code"] },
  { model: Facility, as: "facility", attributes: ["id", "name", "code", "organization_id"] },

  // 🆕 Audit trail users
  { model: User, as: "enteredBy", attributes: ["id", "first_name", "last_name"] },
  { model: User, as: "reviewedBy", attributes: ["id", "first_name", "last_name"] },
  { model: User, as: "verifiedBy", attributes: ["id", "first_name", "last_name"] },
  { model: User, as: "createdBy", attributes: ["id", "first_name", "last_name"] },
  { model: User, as: "updatedBy", attributes: ["id", "first_name", "last_name"] },
  { model: User, as: "deletedBy", attributes: ["id", "first_name", "last_name"] },
];

/* ============================================================
   🔁 SHARED STATUS UPDATE HANDLER
   ============================================================ */
async function updateLabResultStatus({
  req,
  res,
  id,
  expectedFrom,    // status required before change (or array of allowed statuses)
  newStatus,       // status to set
  auditAction,     // audit action string
  extraFields = {},// e.g. reviewed_by_id, verified_by_id
}) {
  const t = await sequelize.transaction();
  try {
    const result = await LabResult.findByPk(id, { transaction: t, lock: t.LOCK.UPDATE });
    if (!result) {
      await t.rollback();
      return error(res, "❌ Lab Result not found", null, 404);
    }

    const allowed = Array.isArray(expectedFrom) ? expectedFrom : [expectedFrom];
    if (expectedFrom && !allowed.includes(result.status)) {
      await t.rollback();
      return error(
        res,
        `❌ Only ${allowed.join(", ")} results can be ${auditAction}`,
        null,
        400
      );
    }

    const oldSnapshot = { ...result.get() };

    // Ensure doctor_id
    let doctorId = result.doctor_id || null;
    if (!doctorId && req.user?.employee_id) {
      const roleName = (req.user?.roleNames?.[0] || "").toLowerCase();
      if (["doctor", "admin", "superadmin"].includes(roleName)) {
        doctorId = req.user.employee_id;
      }
    }

    await result.update(
      {
        status: newStatus,
        doctor_id: doctorId,
        updated_by_id: req.user?.id || null,
        ...extraFields,
      },
      { transaction: t }
    );

    // 🔄 Sync LabRequest + Items
    await cascadeResultStatus(result, newStatus, req.user?.id, t);
    await t.commit();

    const full = await LabResult.findOne({ where: { id }, include: LAB_RESULT_INCLUDES });

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: auditAction,
      entityId: id,
      entity: full,
      details: { from: oldSnapshot.status, to: newStatus, before: oldSnapshot, after: full.get() },
    });

    return success(res, `✅ Lab Result ${auditAction}`, { record: full });
  } catch (err) {
    await t.rollback();
    return error(res, `❌ Failed to ${auditAction} lab result`, err);
  }
}

/* ============================================================
   🔧 HELPERS
   ============================================================ */
function isSuperAdmin(user) {
  if (!user) return false;
  const roles = Array.isArray(user.roleNames) ? user.roleNames : [user.role || ""];
  return roles.map(r => r.toLowerCase()).includes("superadmin");
}

/* ============================================================
   📋 ROLE-BASED JOI SCHEMA FACTORY
   ============================================================ */
function buildLabResultSchema(userRole, mode = "create") {
  const base = {
    patient_id: Joi.string().uuid().required(),
    lab_request_id: Joi.string().uuid().required(),
    lab_request_item_id: Joi.string().uuid().required(),
    department_id: Joi.string().uuid().allow(null),
    consultation_id: Joi.string().uuid().allow(null),
    registration_log_id: Joi.string().uuid().allow(null),
    doctor_id: Joi.string().uuid().allow(null),
    result: Joi.string().allow("", null),
    notes: Joi.string().allow("", null),
    doctor_notes: Joi.string().allow("", null),
    result_date: Joi.date().default(() => new Date()),

    // 🔧 File fields
    attachment_url: Joi.string().allow("", null),
    remove_attachment: Joi.alternatives().try(Joi.boolean(), Joi.string().valid("true", "false")).optional(),

    status: Joi.string().valid(...LAB_RESULT_STATUS).default(LRSR.DRAFT),
  };

  if (mode === "update") {
    Object.keys(base).forEach(k => { base[k] = base[k].optional(); });
  }

  switch (userRole) {
    case "superadmin":
      break;
    case "orgowner":
      base.organization_id = Joi.forbidden();
      break;
    case "admin":
      base.organization_id = Joi.forbidden();
      base.facility_id = Joi.string().uuid().required();
      break;
    case "facilityhead":
      base.organization_id = Joi.forbidden();
      base.facility_id = Joi.forbidden();
      break;
    default:
      base.organization_id = Joi.forbidden();
      base.facility_id = Joi.forbidden();
  }

  return Joi.object(base);
}

// 🔄 CASCADE RESULT → ITEM → REQUEST (Final Enterprise-Aligned)
async function cascadeResultStatus(result, newStatus, userId, transaction, user = null) {
  if (!result) return;

  let itemStatus = null;

  // 🧭 Map LabResult status → LabRequestItem status (realistic enterprise flow)
  switch (newStatus) {
    case LRSR.DRAFT:
      itemStatus = LRI.PENDING; // new result created but not yet acted upon
      break;

    case LRSR.PENDING:
    case LRSR.IN_PROGRESS:
      itemStatus = LRI.IN_PROGRESS; // lab begins work on specimen
      break;

    case LRSR.COMPLETED:
    case LRSR.REVIEWED:
      itemStatus = LRI.COMPLETED; // test done or reviewed
      break;

    case LRSR.VERIFIED:
      itemStatus = LRI.VERIFIED; // verified = final approval
      break;

    case LRSR.CANCELLED:
    case LRSR.VOIDED:
      itemStatus = LRI.CANCELLED; // cancel or void affects item too
      break;

    default:
      itemStatus = null;
  }

  // 🔧 Update LabRequestItem status if possible
  if (itemStatus) {
    if (result.lab_request_item_id) {
      console.log(`🔄 Item ${result.lab_request_item_id}: ${newStatus} → ${itemStatus}`);
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
    } else if (result.lab_request_id) {
      // fallback if item_id is missing (batch update)
      console.log(
        `🔄 No specific item linked — updating ALL items of request ${result.lab_request_id} → ${itemStatus}`
      );
      await sequelize.models.LabRequestItem.update(
        {
          status: itemStatus,
          updated_by_id: userId || null,
        },
        {
          where: { lab_request_id: result.lab_request_id },
          transaction,
        }
      );
    } else {
      console.warn("⚠️ No lab_request_id or lab_request_item_id found — skipping item cascade");
    }
  }

  // 🧩 Sync parent LabRequest after item update
  try {
    if (result.lab_request_id) {
      console.log(`🧮 Syncing parent LabRequest ${result.lab_request_id} after ${newStatus}`);
      await syncLabRequestStatus(result.lab_request_id, transaction, user);
    } else {
      console.warn("⚠️ No parent lab_request_id found — skipping request sync");
    }
  } catch (syncErr) {
    console.warn("⚠️ LabRequest sync failed:", syncErr.message);
  }
}


// 🔧 Normalize multipart form-data (results[0][field]) → array of objects
function normalizeResultsForm(body) {
  const results = [];

  // Case 1: Flat keys like "results[0][patient_id]"
  for (const [key, value] of Object.entries(body)) {
    const match = key.match(/^results\[(\d+)\]\[(.+)\]$/);
    if (match) {
      const idx = parseInt(match[1], 10);
      const field = match[2];
      if (!results[idx]) results[idx] = {};
      results[idx][field] = value;
    }
  }

  // Case 2: Multer/busboy may already parse nested objects
  if (Array.isArray(body.results)) {
    body.results.forEach((r, idx) => {
      results[idx] = { ...(results[idx] || {}), ...r };
    });
  }

  if (results.length > 0) {
    // Hydrate with top-level fields
    for (const r of results) {
      for (const [k, v] of Object.entries(body)) {
        if (k !== "results" && !k.startsWith("results[") && r[k] === undefined) {
          r[k] = v;
        }
      }
    }
    return results;
  }

  // Fallback: single payload
  return [body];
}

/* ============================================================
   📌 CREATE LAB RESULT(S)
   ============================================================ */
export const createLabResults = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module: MODULE_KEY,
      action: "create",
      res,
    });
    if (!allowed) return;

    const role = (req.user?.roleNames?.[0] || "staff").toLowerCase();
    const schema = buildLabResultSchema(role, "create");

    // ✅ Normalize multipart
    let payloads = normalizeResultsForm(req.body);

    // 🔎 DEBUG LOGS
    console.log("===== DEBUG LAB RESULT CREATE =====");
    console.log("🔹 RAW BODY:", JSON.stringify(req.body, null, 2));
    console.log("🔹 NORMALIZED PAYLOADS:", JSON.stringify(payloads, null, 2));
    console.log("===================================");

    if (!Array.isArray(payloads)) payloads = [payloads];

    if (payloads.length === 0) {
      await t.rollback();
      return error(res, "Payload must be an object or non-empty array", null, 400);
    }

    const prepared = [];
    const skipped = [];

    for (const [idx, payload] of payloads.entries()) {
      const { error: validationError, value } = schema.validate(payload, { stripUnknown: true });
      if (validationError) {
        console.log(`❌ Validation failed for payload[${idx}]`, validationError.details);
        skipped.push({ index: idx, reason: "Validation failed", details: validationError.details });
        continue;
      }

      let orgId = req.user.organization_id || null;
      let facilityId = null;

      if (isSuperAdmin(req.user)) {
        orgId = value.organization_id || payload.organization_id || req.body.organization_id || null;
        facilityId = value.facility_id || payload.facility_id || req.body.facility_id || null;
      } else if (role === "orgowner") {
        orgId = req.user.organization_id;
        facilityId = value.facility_id || payload.facility_id || null;
      } else if (role === "admin") {
        orgId = req.user.organization_id;
        facilityId = value.facility_id || payload.facility_id || null;
      } else if (role === "facilityhead") {
        orgId = req.user.organization_id;
        facilityId = req.user.facility_id;
      } else {
        orgId = req.user.organization_id;
        facilityId = req.user.facility_id || null;
      }

      if (!orgId) {
        console.log(`⚠️ Skipped payload[${idx}] → Missing organization assignment`);
        skipped.push({ index: idx, reason: "Missing organization assignment" });
        continue;
      }

      // 👨‍⚕️ Doctor resolution
      let doctorId = value.doctor_id || null;
      if (!doctorId && req.user?.employee_id) {
        const roleName = (req.user?.roleNames?.[0] || "").toLowerCase();
        if (["doctor", "admin", "superadmin"].includes(roleName)) {
          doctorId = req.user.employee_id;
        }
      }

      // 🔧 File upload handling (per-pill attachment)
      if (req.files && Array.isArray(req.files)) {
        const file = req.files.find(
          f =>
            f.fieldname === `results[${idx}][attachment]` ||
            f.fieldname === `results[${idx}][lab_result_file]`
        );
        if (file) {
          value.attachment_url = `/uploads/lab-results/${file.filename}`;
        }
      }

      prepared.push({
        ...value,
        patient_id: value.patient_id,
        lab_request_id: value.lab_request_id,
        lab_request_item_id: value.lab_request_item_id || null,
        doctor_id: doctorId,
        organization_id: orgId,
        facility_id: facilityId,
        created_by_id: req.user?.id || null,
        entered_by_id: req.user?.id || null,
      });
    }

    let created = [];
    if (prepared.length > 0) {
      try {
        created = await LabResult.bulkCreate(prepared, { transaction: t });

        // 🔄 Cascade for each created result
        for (const r of created) {
          await cascadeResultStatus(r, r.status, req.user?.id, t);
        }
      } catch (err) {
        if (err.name === "SequelizeUniqueConstraintError") {
          await t.rollback();
          return error(res, "Duplicate lab result detected at DB level", err, 409);
        }
        throw err;
      }
    }

    await t.commit();

    const full = created.length
      ? await LabResult.findAll({
          where: { id: { [Op.in]: created.map(c => c.id) } },
          include: LAB_RESULT_INCLUDES,
        })
      : [];

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: payloads.length > 1 ? "bulk_create" : "create",
      details: { saved: created.length, skipped: skipped.length },
    });

    return success(
      res,
      `✅ ${created.length} created, ⚠️ ${skipped.length} skipped`,
      { records: full, skipped }
    );
  } catch (err) {
    if (t && !t.finished) await t.rollback();
    return error(res, "❌ Failed to create lab result(s)", err);
  }
};

/* ============================================================
   📌 UPDATE LAB RESULT
   ============================================================ */
export const updateLabResult = async (req, res) => {
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
    const role = (req.user?.roleNames?.[0] || "staff").toLowerCase();
    const schema = buildLabResultSchema(role, "update");

    // ✅ Normalize multipart too
    let rawPayload = normalizeResultsForm(req.body);
    if (Array.isArray(rawPayload)) {
      rawPayload = rawPayload[0]; // ✅ Unwrap for single update
    }

    const { error: validationError, value } = schema.validate(rawPayload, { stripUnknown: true });
    if (validationError) {
      await t.rollback();
      return error(res, "Validation failed", validationError, 400);
    }

    // normalize remove_attachment flag
    if (value.remove_attachment === "true") value.remove_attachment = true;
    if (value.remove_attachment === "false") value.remove_attachment = false;

    let orgId = req.user.organization_id || null;
    let facilityId = null;
    if (isSuperAdmin(req.user)) {
      orgId = value.organization_id || req.body.organization_id || req.query.organization_id || null;
      facilityId = value.facility_id || req.body.facility_id || req.query.facility_id || null;
    } else if (role === "orgowner") {
      orgId = req.user.organization_id;
      facilityId = value.facility_id || req.body.facility_id || null;
    } else if (role === "admin") {
      orgId = req.user.organization_id;
      facilityId = value.facility_id || req.body.facility_id || null;
    } else if (role === "facilityhead") {
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

    // 🔒 Apply org + facility scoping
    const where = { id, organization_id: orgId };
    if (!isSuperAdmin(req.user) && facilityId) {
      where.facility_id = facilityId;
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

    const oldSnapshot = { ...result.get() };

    // 👨‍⚕️ Doctor resolution
    let doctorId = value.doctor_id || result.doctor_id || null;
    if (!doctorId && req.user?.employee_id) {
      const roleName = (req.user?.roleNames?.[0] || "").toLowerCase();
      if (["doctor", "admin", "superadmin"].includes(roleName)) {
        doctorId = req.user.employee_id;
      }
    }

    // 🔧 Handle file removal
    if (value.remove_attachment) {
      value.attachment_url = null;
    }

    // 🔧 Handle file upload replacement
    if (req.files && Array.isArray(req.files)) {
      const file = req.files.find(
        f => f.fieldname === "attachment" || f.fieldname === "lab_result_file"
      );
      if (file) {
        value.attachment_url = `/uploads/lab-results/${file.filename}`;
      }
    }

    await result.update(
      {
        ...value,
        doctor_id: doctorId,
        organization_id: orgId,
        facility_id: facilityId,
        lab_request_item_id: value.lab_request_item_id ?? result.lab_request_item_id,
        updated_by_id: req.user?.id || null,
      },
      { transaction: t }
    );

    // 🔄 Cascade after update
    await cascadeResultStatus(result, result.status, req.user?.id, t);

    await t.commit();

    const full = await LabResult.findOne({
      where: { id },
      include: LAB_RESULT_INCLUDES,
    });

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "update",
      entityId: id,
      entity: full,
      details: { before: oldSnapshot, after: full.get() },
    });

    return success(res, "✅ Lab Result updated", full);
  } catch (err) {
    if (t && !t.finished) await t.rollback();
    return error(res, "❌ Failed to update lab result", err);
  }
};


/* ============================================================
   📌 GET ALL LAB RESULTS LITE (only pending, with ?q= support)
   ============================================================ */
export const getAllLabResultsLite = async (req, res) => {
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

    const where = { status: LRSR.PENDING };

    if (!isSuperAdmin(req.user)) {
      where.organization_id = req.user.organization_id;
      if (role === "facilityhead" && req.user.facility_id) {
        where.facility_id = req.user.facility_id;
      }
    } else {
      if (req.query.organization_id) where.organization_id = req.query.organization_id;
      if (req.query.facility_id) where.facility_id = req.query.facility_id;
    }

    if (q) {
      where[Op.or] = [
        { result: { [Op.iLike]: `%${q}%` } },
        { notes: { [Op.iLike]: `%${q}%` } },
        { "$patient.first_name$": { [Op.iLike]: `%${q}%` } },
        { "$patient.last_name$": { [Op.iLike]: `%${q}%` } },
      ];
    }

    const results = await LabResult.findAll({
      where,
      attributes: ["id", "result_date", "result", "notes", "status"],
      include: [
        { model: Patient, as: "patient", attributes: ["id", "pat_no", "first_name", "last_name"] },
        { model: Employee, as: "doctor", attributes: ["id", "first_name", "last_name"] },
      ],
      order: [["result_date", "DESC"]],
      limit: 20,
    });

    const mapped = results.map(r => ({
      id: r.id,
      patient: r.patient ? `${r.patient.pat_no} - ${r.patient.first_name} ${r.patient.last_name}` : "",
      doctor: r.doctor ? `${r.doctor.first_name} ${r.doctor.last_name}` : "",
      result: r.result || "",
      date: r.result_date,
      notes: r.notes || "",
      status: r.status,
    }));

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "list_lite_pending",
      details: { count: mapped.length, query: q || null },
    });

    return success(res, "✅ Pending Lab Results loaded (lite)", { records: mapped });
  } catch (err) {
    return error(res, "❌ Failed to load pending lab results (lite)", err);
  }
};
/* ============================================================
   📌 GET LAB RESULT BY ID (with labels)
   ============================================================ */
export const getLabResultById = async (req, res) => {
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
      if (role === "facilityhead" && req.user.facility_id) {
        where.facility_id = req.user.facility_id;
      }
    } else {
      if (req.query.organization_id) where.organization_id = req.query.organization_id;
      if (req.query.facility_id) where.facility_id = req.query.facility_id;
    }

    const result = await LabResult.findOne({ where, include: LAB_RESULT_INCLUDES });
    if (!result) return error(res, "❌ Lab Result not found", null, 404);

    const plain = result.get({ plain: true });

    // 🏷️ Friendly labels
    const patientLabel = plain.patient
      ? `${plain.patient.pat_no} - ${plain.patient.first_name} ${plain.patient.last_name}`
      : "Unknown Patient";
    const doctorLabel = plain.doctor
      ? `Dr. ${plain.doctor.first_name} ${plain.doctor.last_name}`
      : "No Doctor";
    const testNames = plain.labRequest?.items
      ? plain.labRequest.items.map(i => i.labTest?.name).filter(Boolean).join(", ")
      : "";
    const dateLabel = plain.result_date
      ? new Date(plain.result_date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
      : "Unknown Date";

    plain.label = `${dateLabel} · ${patientLabel} · ${testNames || "No tests"} · ${plain.status}`;
    plain.patient_label = patientLabel;
    plain.doctor_label = doctorLabel;

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "view",
      entityId: id,
      entity: plain,
    });

    return success(res, "✅ Lab Result loaded", { record: plain });
  } catch (err) {
    return error(res, "❌ Failed to load lab result", err);
  }
};


/* ============================================================
   📌 GET ALL LAB RESULTS (with labels)
   ============================================================ */
export const getAllLabResults = async (req, res) => {
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module: MODULE_KEY,
      action: "read",
      res,
    });
    if (!allowed) return;

    const role = (req.user?.roleNames?.[0] || "staff").toLowerCase();
    const visibleFields = FIELD_VISIBILITY_LAB_RESULT[role] || FIELD_VISIBILITY_LAB_RESULT.staff;

    const options = buildQueryOptions(req, "result_date", "DESC", visibleFields);
    options.where = options.where || {};

    if (!isSuperAdmin(req.user)) {
      options.where.organization_id = req.user.organization_id;
      if (role === "facilityhead" && req.user.facility_id) {
        options.where.facility_id = req.user.facility_id;
      }
    } else {
      if (req.query.organization_id) options.where.organization_id = req.query.organization_id;
      if (req.query.facility_id) options.where.facility_id = req.query.facility_id;
    }

    if (options.search) {
      options.where[Op.or] = [
        { result: { [Op.iLike]: `%${options.search}%` } },
        { notes: { [Op.iLike]: `%${options.search}%` } },
        { doctor_notes: { [Op.iLike]: `%${options.search}%` } },
      ];
    }

    const liteMode = req.query.lite === "true";

    const { count, rows } = await LabResult.findAndCountAll({
      where: options.where,
      include: liteMode ? [] : [...LAB_RESULT_INCLUDES, ...(options.include || [])],
      order: options.order,
      offset: options.offset,
      limit: Math.min(options.limit, 50),
    });

    // 🏷️ Map with labels
    const records = rows.map(r => {
      const plain = r.get({ plain: true });
      const patientLabel = plain.patient
        ? `${plain.patient.pat_no} - ${plain.patient.first_name} ${plain.patient.last_name}`
        : "Unknown Patient";
      const doctorLabel = plain.doctor
        ? `Dr. ${plain.doctor.first_name} ${plain.doctor.last_name}`
        : "No Doctor";
      const testNames = plain.labRequest?.items
        ? plain.labRequest.items.map(i => i.labTest?.name).filter(Boolean).join(", ")
        : "";
      const dateLabel = plain.result_date
        ? new Date(plain.result_date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
        : "Unknown Date";

      return {
        ...plain,
        label: `${dateLabel} · ${patientLabel} · ${testNames || "No tests"} · ${plain.status}`,
        patient_label: patientLabel,
        doctor_label: doctorLabel,
      };
    });

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "list",
      details: { query: req.query, returned: count, liteMode },
    });

    return success(res, "✅ Lab Results loaded", {
      records,
      pagination: {
        total: count,
        page: options.pagination.page,
        pageCount: Math.ceil(count / options.pagination.limit),
      },
    });
  } catch (err) {
    return error(res, "❌ Failed to load lab results", err);
  }
};

/* ============================================================
   📌 TOGGLE LAB RESULT STATUS
   ============================================================ */
export const toggleLabResultStatus = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module: MODULE_KEY,
      action: "update",
      res,
    });
    if (!allowed) return;

    // 🔄 Normalize body (handles multipart FormData)
    const body = Array.isArray(req.body) ? req.body[0] : req.body || {};

    const { id } = req.params;
    const role = (req.user?.roleNames?.[0] || "").toLowerCase();

    const where = { id };
    if (!isSuperAdmin(req.user)) {
      where.organization_id = req.user.organization_id;
      if (role === "facilityhead" && req.user.facility_id) {
        where.facility_id = req.user.facility_id;
      }
    } else {
      if (req.query.organization_id) where.organization_id = req.query.organization_id;
      if (req.query.facility_id) where.facility_id = req.query.facility_id;
    }

    const result = await LabResult.findOne({ where, transaction: t, lock: t.LOCK.UPDATE });
    if (!result) {
      await t.rollback();
      return error(res, "❌ Lab Result not found", null, 404);
    }

    const oldSnapshot = { ...result.get() };
    let newStatus;

    if (body?.status && LAB_RESULT_STATUS.includes(body.status)) {
      newStatus = body.status;
    } else if (result.status === LRSR.COMPLETED) {
      newStatus = LRSR.CANCELLED;
    } else if (result.status === LRSR.CANCELLED) {
      newStatus = LRSR.COMPLETED;
    } else {
      newStatus = result.status;
    }

    if (oldSnapshot.status === newStatus) {
      await t.rollback();
      return error(res, "No status change performed", null, 400);
    }

    // 🔑 Ensure doctor_id
    let doctorId = result.doctor_id || null;
    if (!doctorId && req.user?.employee_id) {
      const roleName = (req.user?.roleNames?.[0] || "").toLowerCase();
      if (["doctor", "admin", "superadmin"].includes(roleName)) {
        doctorId = req.user.employee_id;
      }
    }

    await result.update(
      { status: newStatus, doctor_id: doctorId, updated_by_id: req.user?.id || null },
      { transaction: t }
    );

    // 🔄 Cascade → LabRequestItem + LabRequest
    await cascadeResultStatus(result, newStatus, req.user?.id, t);

    await t.commit();

    const full = await LabResult.findOne({ where: { id }, include: LAB_RESULT_INCLUDES });

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "toggle_status",
      entityId: id,
      entity: full,
      details: { from: oldSnapshot.status, to: newStatus, before: oldSnapshot, after: full.get() },
    });

    return success(res, `✅ Lab Result status set to ${newStatus}`, { record: full });
  } catch (err) {
    await t.rollback();
    return error(res, "❌ Failed to toggle lab result status", err);
  }
};

/* ============================================================
   📌 DELETE LAB RESULT (Soft Delete with Audit + Cascade)
   ============================================================ */
export const deleteLabResult = async (req, res) => {
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
      if (role === "facilityhead") where.facility_id = req.user.facility_id;
    } else {
      if (req.query.organization_id) where.organization_id = req.query.organization_id;
      if (req.query.facility_id) where.facility_id = req.query.facility_id;
    }

    const result = await LabResult.findOne({ where, transaction: t, lock: t.LOCK.UPDATE });
    if (!result) {
      await t.rollback();
      return error(res, "❌ Lab Result not found", null, 404);
    }

    if (result.status === LRSR.VERIFIED) {
      await t.rollback();
      return error(res, "❌ Verified lab results cannot be deleted", null, 403);
    }

    const oldSnapshot = { ...result.get() };

    await result.update({ deleted_by_id: req.user?.id || null }, { transaction: t });
    await result.destroy({ transaction: t });

    // 🔄 Cascade → LabRequestItem + LabRequest
    await cascadeResultStatus(result, LRSR.CANCELLED, req.user?.id, t);

    await t.commit();

    const full = await LabResult.findOne({
      where: { id },
      include: LAB_RESULT_INCLUDES,
      paranoid: false, // include soft-deleted
    });

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "delete",
      entityId: id,
      entity: full,
      details: {
        reason: "Soft delete with cascade",
        before: oldSnapshot,
        after: full?.get?.() || null,
      },
    });

    return success(res, "✅ Lab Result deleted (cascade applied if needed)", { record: full });
  } catch (err) {
    await t.rollback();
    return error(res, "❌ Failed to delete lab result", err);
  }
};
/* ============================================================
   📌 SUBMIT LAB RESULT (draft → pending)
============================================================ */
export const submitLabResult = async (req, res) => {
  const body = Array.isArray(req.body) ? req.body[0] : req.body || {};
  return updateLabResultStatus({
    req,
    res,
    id: req.params.id || body.id,
    expectedFrom: LRSR.DRAFT,
    newStatus: LRSR.PENDING,
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
    expectedFrom: LRSR.PENDING,
    newStatus: LRSR.IN_PROGRESS,
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
    expectedFrom: LRSR.IN_PROGRESS,   // ✅ only allow in_progress
    newStatus: LRSR.COMPLETED,
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
    expectedFrom: LRSR.COMPLETED,
    newStatus: LRSR.REVIEWED,
    auditAction: "review",
    extraFields: { reviewed_by_id: req.user?.id || null },
  });
};

/* ============================================================
   📌 VERIFY LAB RESULT (reviewed → verified, admin/superadmin only)
============================================================ */
export const verifyLabResult = async (req, res) => {
  const role = (req.user?.roleNames?.[0] || "").toLowerCase();
  if (!["admin", "superadmin"].includes(role)) {
    return error(res, "❌ Only admin/superadmin can verify lab results", null, 403);
  }

  const body = Array.isArray(req.body) ? req.body[0] : req.body || {};
  return updateLabResultStatus({
    req,
    res,
    id: req.params.id || body.id,
    expectedFrom: LRSR.REVIEWED,
    newStatus: LRSR.VERIFIED,
    auditAction: "verify",
    extraFields: { verified_by_id: req.user?.id || null },
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
    expectedFrom: [LRSR.PENDING, LRSR.IN_PROGRESS],  // ✅ corrected
    newStatus: LRSR.CANCELLED,
    auditAction: "cancel",
  });
};

/* ============================================================
   📌 VOID LAB RESULT (any → voided, admin/superadmin only)
============================================================ */
export const voidLabResult = async (req, res) => {
  const role = (req.user?.roleNames?.[0] || "").toLowerCase();
  if (!["admin", "superadmin"].includes(role)) {
    return error(res, "❌ Only admin/superadmin can void lab results", null, 403);
  }

  const body = Array.isArray(req.body) ? req.body[0] : req.body || {};
  const id = req.params.id || body.id;

  const result = await LabResult.findByPk(id);
  if (result?.status === LRSR.VERIFIED) {
    return error(res, "❌ Verified lab results cannot be voided", null, 403);
  }

  return updateLabResultStatus({
    req,
    res,
    id,
    expectedFrom: [
      LRSR.DRAFT,
      LRSR.PENDING,
      LRSR.IN_PROGRESS,
      LRSR.COMPLETED,
      LRSR.REVIEWED,
    ],
    newStatus: LRSR.VOIDED,
    auditAction: "void",
  });
};
