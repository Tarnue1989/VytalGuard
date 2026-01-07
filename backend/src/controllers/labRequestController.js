// 📁 controllers/labRequestController.js
import Joi from "joi";
import { Op } from "sequelize";
import {
  sequelize,
  LabRequest,
  LabRequestItem,
  Patient,
  Employee,
  Department,
  Consultation,
  RegistrationLog,
  BillableItem,
  Organization,
  Facility,
  User,
  LabResult 
} from "../models/index.js";
import { success, error } from "../utils/response.js";
import { buildQueryOptions } from "../utils/queryHelper.js";
import { LAB_REQUEST_STATUS } from "../constants/enums.js";
import { authzService } from "../services/authzService.js";
import { auditService } from "../services/auditService.js";
import { FIELD_VISIBILITY_LAB_REQUEST } from "../constants/fieldVisibility.js";
import { billingService } from "../services/billingService.js";
import { shouldTriggerBilling } from "../constants/billing.js";
import { isSuperAdmin, hasRole, getUserRoles } from "../utils/role-utils.js";

const MODULE_KEY = "lab-request";

// 🔖 Local enum map for readability
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
   👨‍⚕️ DOCTOR RESOLUTION HELPER
   ============================================================ */
function resolveDoctorId(request, user) {
  if (request?.doctor_id) return request.doctor_id;
  if (user?.employee_id) {
    const roleName = (user.roleNames?.[0] || "").toLowerCase();
    if (["doctor", "admin", "superadmin"].includes(roleName)) {
      return user.employee_id;
    }
  }
  return null;
}

/* ============================================================
   🔗 SHARED INCLUDES
   ============================================================ */
const LAB_REQUEST_INCLUDES = [
  { model: Patient, as: "patient", attributes: ["id", "pat_no", "first_name", "last_name"] },
  { model: Employee.unscoped(), as: "doctor", attributes: ["id", "first_name", "last_name"] },
  { model: Department, as: "department", attributes: ["id", "name"] },
  { model: Consultation, as: "consultation", attributes: ["id", "consultation_date", "status"] },
  { model: RegistrationLog, as: "registrationLog", attributes: ["id", "registration_time", "log_status"] },
  {
    model: LabRequestItem,
    as: "items",
    where: { status: { [Op.notIn]: [LRS.CANCELLED, LRS.VOIDED] } }, // 🚫 hide cancelled/voided
    required: false,
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
   📋 ROLE-BASED JOI SCHEMA FACTORY (Consultation-Aligned)
   ============================================================ */
function buildLabRequestSchema(mode = "create") {
  const base = {
    patient_id: Joi.string().uuid().required(),
    doctor_id: Joi.string().uuid().allow(null, ""), // optional, resolved automatically
    department_id: Joi.string().uuid().allow(null),
    consultation_id: Joi.string().uuid().allow(null),
    registration_log_id: Joi.string().uuid().allow(null, "").optional(),
    facility_id: Joi.string().uuid().allow(null, "").optional(),
    organization_id: Joi.string().uuid().allow(null, "").optional(),
    request_date: Joi.date().iso().allow(null),
    notes: Joi.string().allow("", null),
    is_emergency: Joi.boolean().default(false),
    status: Joi.string().valid(...LAB_REQUEST_STATUS).default(LRS.DRAFT),

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

    // ✅ Items: optional + supports id + _delete flag
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
   📌 CREATE LAB REQUEST(S) + ITEMS (Consultation-Aligned)
   ============================================================ */
export const createLabRequests = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    // 🔐 Permission
    const allowed = await authzService.checkPermission({
      user: req.user,
      module: MODULE_KEY,
      action: "create",
      res,
    });
    if (!allowed) return;

    const role = (req.user?.roleNames?.[0] || "staff").toLowerCase();
    const schema = buildLabRequestSchema("create");

    const payloads = Array.isArray(req.body) ? req.body : [req.body];
    if (payloads.length === 0) {
      await t.rollback();
      return error(res, "Payload must be an object or non-empty array", null, 400);
    }

    const prepared = [];
    const skipped = [];

    for (const [idx, payload] of payloads.entries()) {
      const { error: validationError, value } = schema.validate(payload, { stripUnknown: true });
      if (validationError) {
        skipped.push({ index: idx, reason: "Validation failed", details: validationError.details });
        continue;
      }

      // 👨‍⚕️ Doctor resolution
      let doctorId = resolveDoctorId(value, req.user);

      // 🏢 Org/facility (Consultation-aligned)
      let orgId = req.user.organization_id || null;
      let facilityId = req.user.facility_id || null;

      // Allow superadmin query override
      if (isSuperAdmin(req.user)) {
        if (req.query.organization_id) orgId = req.query.organization_id;
        if (req.query.facility_id) facilityId = req.query.facility_id;
      }

      // 🧩 Encounter / Consultation linkage
      let registrationLogId = null;
      let consultationId = value.consultation_id || null;

      // 1️⃣ From consultation
      if (consultationId) {
        const consult = await Consultation.findByPk(consultationId);
        if (consult) {
          registrationLogId = consult.registration_log_id;
          orgId = orgId || consult.organization_id;
          facilityId = facilityId || consult.facility_id;
        }
      }

      // 2️⃣ From active registration log
      if (!registrationLogId) {
        const regLog = await RegistrationLog.findOne({
          where: {
            patient_id: value.patient_id,
            log_status: "active",
          },
          order: [["registration_time", "DESC"]],
        });

        if (regLog) {
          registrationLogId = regLog.id;
          orgId = orgId || regLog.organization_id;
          facilityId = facilityId || regLog.facility_id;

          // auto-link latest consultation if any
          const consult = await Consultation.findOne({
            where: { registration_log_id: regLog.id },
            order: [["consultation_date", "DESC"]],
          });
          if (consult) consultationId = consultationId || consult.id;
        }
      }

      // 3️⃣ Superadmin fallback: try again via query
      if (isSuperAdmin(req.user)) {
        if (!orgId && req.query.organization_id) orgId = req.query.organization_id;
        if (!facilityId && req.query.facility_id) facilityId = req.query.facility_id;
      }

      // 4️⃣ Final safety net (match Consultation)
      if (!orgId || !facilityId) {
        const activeLog = await RegistrationLog.findOne({
          where: {
            patient_id: value.patient_id,
            log_status: "active",
          },
          order: [["registration_time", "DESC"]],
        });
        if (activeLog) {
          orgId = orgId || activeLog.organization_id;
          facilityId = facilityId || activeLog.facility_id;
          registrationLogId = registrationLogId || activeLog.id;
        }
      }

      // ⛔ Still unresolved org → skip
      if (!orgId) {
        skipped.push({
          index: idx,
          reason: "Unable to resolve organization (no org_id, registration, or query param)",
        });
        continue;
      }

      // ✅ Build main request (Consultation-aligned)
      prepared.push({
        request: {
          patient_id: value.patient_id,
          doctor_id: doctorId,
          department_id: value.department_id,
          registration_log_id: registrationLogId,
          consultation_id: consultationId,
          request_date: value.request_date || new Date(),
          notes: value.notes,
          is_emergency: value.is_emergency,
          status: value.status,
          organization_id: orgId,
          facility_id: facilityId,
          created_by_id: req.user?.id || null,
        },
        items: value.items,
      });
    }

    // 🚀 Create records
    const createdRequests = [];
    try {
      for (const entry of prepared) {
        const request = await LabRequest.create(entry.request, { transaction: t });

        // 🧾 Create items (inherit parent)
        const itemsData = entry.items.map((it) => ({
          lab_request_id: request.id,
          lab_test_id: it.lab_test_id,
          notes: it.notes,
          status: request.status,
          organization_id: request.organization_id,
          facility_id: request.facility_id,
          created_by_id: req.user?.id || null,
        }));
        await LabRequestItem.bulkCreate(itemsData, { transaction: t });

        // 💵 Billing Hook
        try {
          if (shouldTriggerBilling(MODULE_KEY, request.status)) {
            if (typeof billingService.billLabRequestItems === "function") {
              await billingService.billLabRequestItems({
                labRequest: request,
                user: { ...req.user, organization_id: request.organization_id, facility_id: request.facility_id },
                transaction: t,
              });
            } else {
              console.warn("⚠️ billingService.billLabRequestItems not defined");
            }
          }
        } catch (billErr) {
          console.error("❌ Billing service failed:", billErr);
        }

        createdRequests.push(request);
      }
    } catch (loopErr) {
      console.error("❌ Lab request creation loop failed:", loopErr);
      await t.rollback();
      return error(res, "❌ Failed to create lab request(s)", loopErr, 500);
    }

    await t.commit();

    const full = createdRequests.length
      ? await LabRequest.findAll({
          where: { id: { [Op.in]: createdRequests.map((c) => c.id) } },
          include: LAB_REQUEST_INCLUDES,
        })
      : [];

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: payloads.length > 1 ? "bulk_create" : "create",
      details: { saved: createdRequests.length, skipped: skipped.length },
    });

    return success(res, {
      message: `✅ ${createdRequests.length} created, ⚠️ ${skipped.length} skipped`,
      records: full,
      skipped,
    });
  } catch (err) {
    console.error("❌ Top-level createLabRequests error:", err);
    if (t && !t.finished) await t.rollback();
    return error(res, "❌ Failed to create lab request(s)", err);
  }
};

/* ============================================================
   📌 UPDATE LAB REQUEST (Consultation-Aligned, Diff-Based Sync)
   ============================================================ */
export const updateLabRequest = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    console.log("🔹 Incoming update payload:", JSON.stringify(req.body, null, 2));

    // 🔐 Permission
    const allowed = await authzService.checkPermission({
      user: req.user,
      module: MODULE_KEY,
      action: "update",
      res,
    });
    if (!allowed) return;

    const { id } = req.params;
    const schema = buildLabRequestSchema("update");
    const { error: validationError, value } = schema.validate(req.body, { stripUnknown: true });
    if (validationError) {
      console.warn("❌ Validation failed:", validationError.details);
      await t.rollback();
      return error(res, "Validation failed", validationError, 400);
    }

    /* ============================================================
       🏢 Organization / Facility Resolution (Consultation-aligned)
    ============================================================ */
    let orgId = req.user.organization_id || null;
    let facilityId = req.user.facility_id || null;

    if (isSuperAdmin(req.user)) {
      if (req.query.organization_id) orgId = req.query.organization_id;
      if (req.query.facility_id) facilityId = req.query.facility_id;
    }

    // Load the existing request record
    const request = await LabRequest.findOne({
      where: { id },
      include: [{ model: LabRequestItem, as: "items" }],
      transaction: t,
      lock: { level: t.LOCK.UPDATE, of: LabRequest },
    });
    if (!request) {
      await t.rollback();
      return error(res, "Lab Request not found", null, 404);
    }

    const currentStatus = request.status;
    const oldSnapshot = { ...request.get() };

    // Protect finalized requests
    if ([LRS.COMPLETED, LRS.VERIFIED, LRS.CANCELLED, LRS.VOIDED].includes(currentStatus)) {
      await t.rollback();
      return error(res, `Cannot update Lab Request in status ${currentStatus}`, null, 400);
    }

    /* ============================================================
       👨‍⚕️ Doctor / Encounter Re-resolution (Consultation-aligned)
    ============================================================ */
    let doctorId = resolveDoctorId(value, req.user);
    let registrationLogId = value.registration_log_id || request.registration_log_id || null;
    let consultationId = value.consultation_id || request.consultation_id || null;

    // 1️⃣ Try consultation first
    if (consultationId) {
      const consult = await Consultation.findByPk(consultationId);
      if (consult) {
        registrationLogId = registrationLogId || consult.registration_log_id;
        orgId = orgId || consult.organization_id;
        facilityId = facilityId || consult.facility_id;
      }
    }

    // 2️⃣ From active registration log
    if (!registrationLogId) {
      const regLog = await RegistrationLog.findOne({
        where: {
          patient_id: value.patient_id || request.patient_id,
          log_status: "active",
        },
        order: [["registration_time", "DESC"]],
      });

      if (regLog) {
        registrationLogId = regLog.id;
        orgId = orgId || regLog.organization_id;
        facilityId = facilityId || regLog.facility_id;

        const consult = await Consultation.findOne({
          where: { registration_log_id: regLog.id },
          order: [["consultation_date", "DESC"]],
        });
        if (consult) consultationId = consultationId || consult.id;
      }
    }

    // 3️⃣ Superadmin fallback via query
    if (isSuperAdmin(req.user)) {
      if (!orgId && req.query.organization_id) orgId = req.query.organization_id;
      if (!facilityId && req.query.facility_id) facilityId = req.query.facility_id;
    }

    // 4️⃣ Final fallback from any active registration (safety net)
    if (!orgId || !facilityId) {
      const activeLog = await RegistrationLog.findOne({
        where: {
          patient_id: value.patient_id || request.patient_id,
          log_status: "active",
        },
        order: [["registration_time", "DESC"]],
      });
      if (activeLog) {
        orgId = orgId || activeLog.organization_id;
        facilityId = facilityId || activeLog.facility_id;
        registrationLogId = registrationLogId || activeLog.id;
      }
    }

    /* ============================================================
       ✏️ Update parent LabRequest
    ============================================================ */
    await request.update(
      {
        patient_id: value.patient_id || request.patient_id,
        doctor_id: doctorId || request.doctor_id,
        department_id: value.department_id ?? request.department_id,
        registration_log_id: registrationLogId,
        consultation_id: consultationId,
        request_date: value.request_date || request.request_date,
        notes: value.notes ?? request.notes,
        is_emergency: value.is_emergency ?? request.is_emergency,
        status: value.status || request.status,
        organization_id: orgId,
        facility_id: facilityId || request.facility_id,
        updated_by_id: req.user?.id || null,
      },
      { transaction: t }
    );

    /* ============================================================
       🔄 Diff-Based Sync for Items
    ============================================================ */
    if (Array.isArray(value.items)) {
      const existingItems = request.items || [];
      const existingById = new Map(existingItems.map((e) => [e.id, e]));
      const touched = new Set();

      for (const it of value.items) {
        if (!it.lab_test_id && !it.id) continue;

        // DELETE
        if (it._delete && it.id && existingById.has(it.id)) {
          const existing = existingById.get(it.id);
          await existing.update(
            {
              status: LRS.CANCELLED,
              deleted_at: new Date(),
              deleted_by_id: req.user?.id || null,
              updated_by_id: req.user?.id || null,
            },
            { transaction: t }
          );
          await billingService.voidCharges({
            module: "lab_request_item",
            entityId: existing.id,
            user: req.user,
            transaction: t,
          });
          touched.add(existing.id);
          continue;
        }

        // UPDATE
        if (it.id && existingById.has(it.id)) {
          const existing = existingById.get(it.id);
          await existing.update(
            {
              lab_test_id: it.lab_test_id || existing.lab_test_id,
              notes: it.notes ?? existing.notes,
              status: request.status,
              updated_by_id: req.user?.id || null,
            },
            { transaction: t }
          );
          touched.add(existing.id);
          continue;
        }

        // CREATE or REACTIVATE
        const dup = await LabRequestItem.findOne({
          where: { lab_request_id: request.id, lab_test_id: it.lab_test_id },
          transaction: t,
        });

        if (dup) {
          if ([LRS.CANCELLED, LRS.VOIDED].includes(dup.status)) {
            await dup.update(
              {
                status: request.status,
                notes: it.notes || dup.notes,
                deleted_at: null,
                deleted_by_id: null,
                updated_by_id: req.user?.id || null,
              },
              { transaction: t }
            );
            touched.add(dup.id);
          } else {
            touched.add(dup.id);
          }
        } else {
          const newItem = await LabRequestItem.create(
            {
              lab_request_id: request.id,
              lab_test_id: it.lab_test_id,
              notes: it.notes || null,
              status: request.status,
              organization_id: orgId,
              facility_id: facilityId,
              created_by_id: req.user?.id || null,
            },
            { transaction: t }
          );
          touched.add(newItem.id);
        }
      }

      // Auto-cancel missing items (draft only)
      if (currentStatus === LRS.DRAFT) {
        for (const existing of existingItems) {
          if (!touched.has(existing.id)) {
            await existing.update(
              {
                status: LRS.CANCELLED,
                deleted_at: new Date(),
                deleted_by_id: req.user?.id || null,
                updated_by_id: req.user?.id || null,
              },
              { transaction: t }
            );
            await billingService.voidCharges({
              module: "lab_request_item",
              entityId: existing.id,
              user: req.user,
              transaction: t,
            });
          }
        }
      }
    }

    /* ============================================================
       💵 Billing Hook
    ============================================================ */
    try {
      if (oldSnapshot.status !== request.status && shouldTriggerBilling(MODULE_KEY, request.status)) {
        await billingService.billLabRequestItems({
          labRequest: request,
          user: { ...req.user, organization_id: orgId, facility_id: facilityId },
          transaction: t,
        });
      }
    } catch (billErr) {
      console.error("❌ Billing failed:", billErr);
    }

    await t.commit();

    const full = await LabRequest.findOne({ where: { id }, include: LAB_REQUEST_INCLUDES });

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "update",
      entityId: id,
      entity: full,
      details: { before: oldSnapshot, after: full.get() },
    });

    return success(res, "✅ Lab Request updated", full);
  } catch (err) {
    console.error("❌ updateLabRequest error:", err);
    if (t && !t.finished) await t.rollback();
    return error(res, "❌ Failed to update lab request", err);
  }
};


/* ============================================================
   📌 TOGGLE LAB REQUEST STATUS (single + bulk)
   ============================================================ */
export const toggleLabRequestStatus = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module: MODULE_KEY,
      action: "update",
      res,
    });
    if (!allowed) return;

    const ids = Array.isArray(req.body?.ids) ? req.body.ids : [req.params.id];
    if (!ids?.length) {
      await t.rollback();
      return error(res, "❌ Must provide at least one Lab Request ID", null, 400);
    }

    // 🔒 Tenant scoping
    const role = (req.user?.roleNames?.[0] || "staff").toLowerCase();
    const where = { id: { [Op.in]: ids } };
    if (!isSuperAdmin(req.user)) {
      where.organization_id = req.user.organization_id;
      if (role === "facilityhead") where.facility_id = req.user.facility_id;
    } else {
      if (req.query.organization_id) where.organization_id = req.query.organization_id;
      if (req.query.facility_id) where.facility_id = req.query.facility_id;
    }

    const requests = await LabRequest.findAll({
      where,
      include: [{ model: LabRequestItem, as: "items" }],
      transaction: t,
      lock: { level: t.LOCK.UPDATE, of: LabRequest }
    });
    if (!requests.length) {
      await t.rollback();
      return error(res, "❌ No Lab Requests found", null, 404);
    }

    const updated = [], skipped = [];

    for (const request of requests) {
      const oldStatus = request.status;
      let newStatus = oldStatus;

      // explicit override from body
      if (req.body?.status && LAB_REQUEST_STATUS.includes(req.body.status)) {
        newStatus = req.body.status;
      } else if (oldStatus === LRS.IN_PROGRESS) {
        newStatus = LRS.CANCELLED;
      } else if (oldStatus === LRS.CANCELLED) {
        newStatus = LRS.IN_PROGRESS;
      }

      if (oldStatus === newStatus) {
        skipped.push({ id: request.id, reason: "No status change" });
        continue;
      }

      let doctorId = resolveDoctorId(request, req.user);
      await request.update(
        { status: newStatus, doctor_id: doctorId, updated_by_id: req.user?.id || null },
        { transaction: t }
      );

      // Cascade children + billing
      if (newStatus === LRS.CANCELLED) {
        // rollback billing per item
        for (const item of request.items || []) {
          await billingService.voidCharges({
            module: "lab_request_item",
            entityId: item.id,
            user: { ...req.user, organization_id: request.organization_id, facility_id: request.facility_id },
            transaction: t,
          });
        }

        await LabResult.update(
          { status: "cancelled", updated_by_id: req.user?.id },
          { where: { lab_request_id: request.id, status: { [Op.notIn]: ["verified", "voided", "cancelled"] } }, transaction: t }
        );

        await LabRequestItem.update(
          { status: "cancelled", updated_by_id: req.user?.id },
          { where: { lab_request_id: request.id, status: { [Op.notIn]: ["verified", "voided", "cancelled"] } }, transaction: t }
        );
      } else if (shouldTriggerBilling(MODULE_KEY, newStatus)) {
        await billingService.billLabRequestItems({
          labRequest: request,
          user: { ...req.user, organization_id: request.organization_id, facility_id: request.facility_id },
          transaction: t,
        });
      }

      updated.push({ request, from: oldStatus, to: newStatus });
    }

    await t.commit();

    const full = updated.length
      ? await LabRequest.findAll({ where: { id: updated.map(u => u.request.id) }, include: LAB_REQUEST_INCLUDES })
      : [];

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: ids.length > 1 ? "bulk_toggle_status" : "toggle_status",
      details: { updated: updated.map(u => ({ id: u.request.id, from: u.from, to: u.to })), skipped },
    });

    return success(res, `✅ ${updated.length} toggled, ⚠️ ${skipped.length} skipped`, { records: full, skipped });
  } catch (err) {
    await t.rollback();
    return error(res, "❌ Failed to toggle lab request status", err);
  }
};

/* ============================================================
   📌 GET LAB REQUEST BY ID (with labels)
   ============================================================ */
export const getLabRequestById = async (req, res) => {
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
      if (role === "facilityhead") where.facility_id = req.user.facility_id;
    } else {
      if (req.query.organization_id) where.organization_id = req.query.organization_id;
      if (req.query.facility_id) where.facility_id = req.query.facility_id;
    }

    const request = await LabRequest.findOne({ where, include: LAB_REQUEST_INCLUDES });
    if (!request) return error(res, "❌ Lab Request not found", null, 404);

    // 🏷️ Add friendly labels
    const plain = request.get({ plain: true });
    const patientLabel = plain.patient
      ? `${plain.patient.pat_no} - ${plain.patient.first_name} ${plain.patient.last_name}`
      : "Unknown Patient";
    const doctorLabel = plain.doctor
      ? `Dr. ${plain.doctor.first_name} ${plain.doctor.last_name}`
      : "No Doctor";
    const testNames = (plain.items || [])
      .map(i => i.labTest?.name)
      .filter(Boolean)
      .join(", ");
    const dateLabel = plain.request_date
      ? new Date(plain.request_date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
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

    return success(res, "✅ Lab Request loaded", plain);
  } catch (err) {
    return error(res, "❌ Failed to load lab request", err);
  }
};


/* ============================================================
   📌 GET ALL LAB REQUESTS (with labels)
============================================================ */
export const getAllLabRequests = async (req, res) => {
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
      FIELD_VISIBILITY_LAB_REQUEST[role] ||
      FIELD_VISIBILITY_LAB_REQUEST.staff;

    const options = buildQueryOptions(req, "request_date", "DESC", visibleFields);
    options.where = options.where || {};

    // 🗓️ Ensure range filter (if not already handled by queryHelper)
    if (req.query["request_date[gte]"]) {
      options.where.request_date = {
        ...(options.where.request_date || {}),
        [Op.gte]: req.query["request_date[gte]"],
      };
    }
    if (req.query["request_date[lte]"]) {
      options.where.request_date = {
        ...(options.where.request_date || {}),
        [Op.lte]: req.query["request_date[lte]"],
      };
    }

    // 🔐 Scoped org/fac filtering
    if (!isSuperAdmin(req.user)) {
      options.where.organization_id = req.user.organization_id;
      if (role === "facilityhead")
        options.where.facility_id = req.user.facility_id;
    } else {
      if (req.query.organization_id)
        options.where.organization_id = req.query.organization_id;
      if (req.query.facility_id)
        options.where.facility_id = req.query.facility_id;
    }

    // 🔎 Search by notes (or extend later)
    if (options.search) {
      options.where[Op.or] = [
        { notes: { [Op.iLike]: `%${options.search}%` } },
      ];
    }

    const liteMode = req.query.lite === "true";
    const safeLimit =
      Number.isFinite(options.limit) && options.limit > 0 ? options.limit : 25;

    const { count, rows } = await LabRequest.findAndCountAll({
      where: options.where,
      distinct: true,
      include: liteMode ? [] : [...LAB_REQUEST_INCLUDES, ...(options.include || [])],
      order: options.order,
      offset: options.offset,
      limit: Math.min(safeLimit, 50),
    });

    // 🏷️ Map rows with labels
    const records = rows.map((r) => {
      const plain = r.get({ plain: true });
      const patientLabel = plain.patient
        ? `${plain.patient.pat_no} - ${plain.patient.first_name} ${plain.patient.last_name}`
        : "Unknown Patient";
      const doctorLabel = plain.doctor
        ? `Dr. ${plain.doctor.first_name} ${plain.doctor.last_name}`
        : "No Doctor";
      const testNames = (plain.items || [])
        .map((i) => i.labTest?.name)
        .filter(Boolean)
        .join(", ");
      const dateLabel = plain.request_date
        ? new Date(plain.request_date).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          })
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

    return success(res, "✅ Lab Requests loaded", {
      records,
      pagination: {
        total: count,
        page: options.pagination.page,
        pageCount: Math.ceil(count / options.pagination.limit),
      },
    });
  } catch (err) {
    return error(res, "❌ Failed to load lab requests", err);
  }
};


/* ============================================================
   📌 GET ALL LAB REQUESTS LITE (supports patient_id + status + ?q=)
   ============================================================ */
export const getAllLabRequestsLite = async (req, res) => {
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module: MODULE_KEY,
      action: "read",
      res,
    });
    if (!allowed) return;

    const { q, patient_id, status } = req.query;
    const role = (req.user?.roleNames?.[0] || "").toLowerCase();

    const where = {};

    // 🔎 Status filter (default to pending)
    if (status) {
      const normalized = status.toUpperCase();
      where.status = LRS[normalized] || status;
    } else {
      where.status = LRS.PENDING;
    }

    // 🔎 Patient filter
    if (patient_id) where.patient_id = patient_id;

    // 🔎 Tenant scoping
    if (!isSuperAdmin(req.user)) {
      where.organization_id = req.user.organization_id;
      if (role === "facilityhead") where.facility_id = req.user.facility_id;
    } else {
      if (req.query.organization_id) where.organization_id = req.query.organization_id;
      if (req.query.facility_id) where.facility_id = req.query.facility_id;
    }

    // 🔎 Search filter
    if (q) {
      where[Op.or] = [
        { notes: { [Op.iLike]: `%${q}%` } },
        { "$patient.first_name$": { [Op.iLike]: `%${q}%` } },
        { "$patient.last_name$": { [Op.iLike]: `%${q}%` } },
        { "$items.labTest.name$": { [Op.iLike]: `%${q}%` } },
      ];
    }

    const requests = await LabRequest.findAll({
      where,
      distinct: true,
      attributes: ["id", "request_date", "notes", "is_emergency", "status"],
      include: [
        { model: Patient, as: "patient", attributes: ["id", "pat_no", "first_name", "last_name"] },
        { model: Employee, as: "doctor", attributes: ["id", "first_name", "last_name"] },
        { model: Department, as: "department", attributes: ["id", "name"] },
        { model: Consultation, as: "consultation", attributes: ["id", "consultation_date", "status"] },
        { model: RegistrationLog, as: "registrationLog", attributes: ["id", "registration_time", "log_status"] },
        {
          model: LabRequestItem,
          as: "items",
          attributes: ["id", "lab_test_id", "notes"],
          include: [{ model: BillableItem, as: "labTest", attributes: ["id", "name"] }],
        },
      ],
      order: [["request_date", "DESC"]],
      limit: Math.min(Number(req.query.limit) || 20, 50),
    });

    const result = requests.map(r => {
      const patientLabel = r.patient
        ? `${r.patient.pat_no} - ${r.patient.first_name} ${r.patient.last_name}`
        : "Unknown Patient";

      const doctorLabel = r.doctor
        ? `Dr. ${r.doctor.first_name} ${r.doctor.last_name}`
        : "No Doctor";

      const dateLabel = r.request_date
        ? new Date(r.request_date).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          })
        : "Unknown Date";

      const statusTxt = (r.status || "").toLowerCase();

      return {
        id: r.id,
        label: `${dateLabel} · ${statusTxt} · ${patientLabel}`, // ✅ user-friendly label
        patient_id: r.patient?.id || null,
        patient: patientLabel,
        doctor_id: r.doctor?.id || null,
        doctor_name: doctorLabel,
        consultation_id: r.consultation?.id || null,
        consultation_date: r.consultation?.consultation_date || null,
        registration_log_id: r.registrationLog?.id || null,
        registration_log_code: r.registrationLog?.log_status || null,
        department_id: r.department?.id || null,
        department_name: r.department?.name || null,
        items: r.items?.map(i => ({
          id: i.id,
          lab_test_id: i.lab_test_id,
          test: i.labTest?.name || "",
          notes: i.notes || "",
        })) || [],
        date: r.request_date,
        notes: r.notes || "",
        emergency: r.is_emergency,
        status: r.status,
      };
    });

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "list_lite_pending",
      details: { count: result.length, query: q || null, patient_id: patient_id || null, status: status || "pending" },
    });

    return success(res, "✅ Lab Requests loaded (lite)", { records: result });
  } catch (err) {
    return error(res, "❌ Failed to load lab requests (lite)", err);
  }
};

/* ============================================================
   📌 GET ALL LAB REQUEST ITEMS LITE (by lab_request_id)
   ============================================================ */
export const getAllLabRequestItemsLite = async (req, res) => {
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module: MODULE_KEY,
      action: "read",
      res,
    });
    if (!allowed) return;

    const { lab_request_id, status } = req.query;
    if (!lab_request_id) {
      return error(res, "lab_request_id is required", null, 400);
    }

    const where = { lab_request_id };
    if (status) where.status = status; // optional filter, e.g. "pending"

    const items = await LabRequestItem.findAll({
      where,
      attributes: ["id", "lab_request_id", "lab_test_id", "status", "notes"],
      include: [
        { model: BillableItem, as: "labTest", attributes: ["id", "name", "price"] },
      ],
      order: [["created_at", "ASC"]],
    });

    const result = items.map(i => {
      const testLabel = i.labTest?.name || "Unnamed Test";
      const statusTxt = (i.status || "").toLowerCase();
      return {
        id: i.id,
        label: `${testLabel} · ${statusTxt}`,   // ✅ friendly label for dropdowns
        lab_request_id: i.lab_request_id,
        lab_test_id: i.lab_test_id,
        test: testLabel,
        status: i.status,
        notes: i.notes || "",
      };
    });

    return success(res, "✅ Lab Request Items loaded (lite)", { records: result });
  } catch (err) {
    return error(res, "❌ Failed to load lab request items (lite)", err);
  }
};


/* ============================================================
   📌 ACTIVATE LAB REQUEST(S) (pending → in_progress)
   ============================================================ */
export const activateLabRequests = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module: MODULE_KEY,
      action: "update",
      res,
    });
    if (!allowed) return;

    const ids = Array.isArray(req.body?.ids) ? req.body.ids : [req.params.id];
    if (!ids?.length) {
      await t.rollback();
      return error(res, "❌ Must provide at least one Lab Request ID", null, 400);
    }

    // 🔒 Tenant scoping
    const role = (req.user?.roleNames?.[0] || "staff").toLowerCase();
    const where = { id: { [Op.in]: ids } };
    if (!isSuperAdmin(req.user)) {
      where.organization_id = req.user.organization_id;
      if (role === "facilityhead") where.facility_id = req.user.facility_id;
    } else {
      if (req.query.organization_id) where.organization_id = req.query.organization_id;
      if (req.query.facility_id) where.facility_id = req.query.facility_id;
    }

    const requests = await LabRequest.findAll({ where, transaction: t, lock: { level: t.LOCK.UPDATE, of: LabRequest } });
    if (!requests.length) {
      await t.rollback();
      return error(res, "❌ No Lab Requests found", null, 404);
    }

    const updated = [], skipped = [];

    for (const request of requests) {
      const oldStatus = request.status;
      if (oldStatus !== LRS.PENDING) {
        skipped.push({ id: request.id, reason: `Not pending (${oldStatus})` });
        continue;
      }

      let doctorId = resolveDoctorId(request, req.user);
      await request.update(
        { status: LRS.IN_PROGRESS, doctor_id: doctorId, updated_by_id: req.user?.id || null },
        { transaction: t }
      );

      if (shouldTriggerBilling(MODULE_KEY, LRS.IN_PROGRESS)) {
        await billingService.billLabRequestItems({
          labRequest: request,
          user: { ...req.user, organization_id: request.organization_id, facility_id: request.facility_id },
          transaction: t,
        });
      }

      updated.push({ request, from: oldStatus, to: LRS.IN_PROGRESS });
    }

    await t.commit();

    const full = updated.length
      ? await LabRequest.findAll({ where: { id: updated.map(u => u.request.id) }, include: LAB_REQUEST_INCLUDES })
      : [];

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: ids.length > 1 ? "bulk_activate" : "activate",
      details: { updated: updated.map(u => ({ id: u.request.id, from: u.from, to: u.to })), skipped },
    });

    return success(res, `✅ ${updated.length} activated, ⚠️ ${skipped.length} skipped`, { records: full, skipped });
  } catch (err) {
    await t.rollback();
    return error(res, "❌ Failed to activate lab request(s)", err);
  }
};

/* ============================================================
   📌 DELETE LAB REQUEST(S) (Soft Delete + Cascade Results + Rollback Billing)
   ============================================================ */
export const deleteLabRequests = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module: MODULE_KEY,
      action: "delete",
      res,
    });
    if (!allowed) return;

    const ids = Array.isArray(req.body?.ids) ? req.body.ids : [req.params.id];
    if (!ids?.length) {
      await t.rollback();
      return error(res, "❌ Must provide at least one Lab Request ID", null, 400);
    }

    // 🔒 Tenant scoping
    const role = (req.user?.roleNames?.[0] || "staff").toLowerCase();
    const where = { id: { [Op.in]: ids } };
    if (!isSuperAdmin(req.user)) {
      where.organization_id = req.user.organization_id;
      if (role === "facilityhead") where.facility_id = req.user.facility_id;
    } else {
      if (req.query.organization_id) where.organization_id = req.query.organization_id;
      if (req.query.facility_id) where.facility_id = req.query.facility_id;
    }

    const requests = await LabRequest.findAll({
      where,
      include: [{ model: LabRequestItem, as: "items" }],
      transaction: t,
      lock: { level: t.LOCK.UPDATE, of: LabRequest }
    });
    if (!requests.length) {
      await t.rollback();
      return error(res, "❌ No Lab Requests found", null, 404);
    }

    const deleted = [], skipped = [];

    for (const request of requests) {
      if ([LRS.COMPLETED, LRS.VERIFIED].includes(request.status)) {
        skipped.push({ id: request.id, reason: "Completed or verified cannot be deleted" });
        continue;
      }

      // ⚡ rollback billing for each child item
      for (const item of request.items || []) {
        await billingService.voidCharges({
          module: "lab_request_item",
          entityId: item.id,
          user: {
            ...req.user,
            organization_id: request.organization_id,
            facility_id: request.facility_id,
          },
          transaction: t,
        });
      }

      // Cascade results
      await LabResult.update(
        {
          status: "cancelled",
          updated_by_id: req.user?.id,
          deleted_by_id: req.user?.id,
          deleted_at: new Date(),
        },
        {
          where: {
            lab_request_id: request.id,
            status: { [Op.notIn]: ["verified", "voided"] },
          },
          transaction: t,
        }
      );

      // Cascade items
      await LabRequestItem.update(
        {
          status: "cancelled",
          updated_by_id: req.user?.id,
          deleted_by_id: req.user?.id,
          deleted_at: new Date(),
        },
        {
          where: {
            lab_request_id: request.id,
            status: { [Op.notIn]: ["verified", "voided"] },
          },
          transaction: t,
        }
      );

      // Soft delete parent
      await request.update({ deleted_by_id: req.user?.id }, { transaction: t });
      await request.destroy({ transaction: t });
      deleted.push(request);
    }

    await t.commit();

    const full = deleted.length
      ? await LabRequest.findAll({
          where: { id: deleted.map(r => r.id) },
          include: LAB_REQUEST_INCLUDES,
          paranoid: false,
        })
      : [];

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: ids.length > 1 ? "bulk_delete" : "delete",
      details: { deleted: deleted.length, skipped },
    });

    return success(res, `✅ ${deleted.length} deleted, ⚠️ ${skipped.length} skipped`, { records: full, skipped });
  } catch (err) {
    await t.rollback();
    return error(res, "❌ Failed to delete lab request(s)", err);
  }
};


/* ============================================================
   📌 COMPLETE LAB REQUEST(S) (in_progress → completed)
   ============================================================ */
export const completeLabRequests = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module: MODULE_KEY,
      action: "update",
      res,
    });
    if (!allowed) return;

    const ids = Array.isArray(req.body?.ids) ? req.body.ids : [req.params.id];
    if (!ids?.length) {
      await t.rollback();
      return error(res, "❌ Must provide at least one Lab Request ID", null, 400);
    }

    // 🔒 Tenant scoping
    const role = (req.user?.roleNames?.[0] || "staff").toLowerCase();
    const where = { id: { [Op.in]: ids } };
    if (!isSuperAdmin(req.user)) {
      where.organization_id = req.user.organization_id;
      if (role === "facilityhead") where.facility_id = req.user.facility_id;
    } else {
      if (req.query.organization_id) where.organization_id = req.query.organization_id;
      if (req.query.facility_id) where.facility_id = req.query.facility_id;
    }

    const requests = await LabRequest.findAll({ where, transaction: t, lock: { level: t.LOCK.UPDATE, of: LabRequest } });
    if (!requests.length) {
      await t.rollback();
      return error(res, "❌ No Lab Requests found", null, 404);
    }

    const updated = [], skipped = [];

    for (const request of requests) {
      const oldStatus = request.status;
      if (oldStatus !== LRS.IN_PROGRESS) {
        skipped.push({ id: request.id, reason: `Not in progress (${oldStatus})` });
        continue;
      }

      const resultCount = await LabResult.count({ where: { lab_request_id: request.id }, transaction: t });
      if (resultCount === 0) {
        skipped.push({ id: request.id, reason: "No results found" });
        continue;
      }

      let doctorId = resolveDoctorId(request, req.user);
      await request.update(
        { status: LRS.COMPLETED, doctor_id: doctorId, updated_by_id: req.user?.id || null },
        { transaction: t }
      );

      await LabRequestItem.update(
        { status: LRS.COMPLETED, updated_by_id: req.user?.id },
        { where: { lab_request_id: request.id }, transaction: t }
      );

      if (shouldTriggerBilling(MODULE_KEY, LRS.COMPLETED)) {
        await billingService.billLabRequestItems({
          labRequest: request,
          user: { ...req.user, organization_id: request.organization_id, facility_id: request.facility_id },
          transaction: t,
        });
      }

      updated.push({ request, from: oldStatus, to: LRS.COMPLETED });
    }

    await t.commit();

    const full = updated.length
      ? await LabRequest.findAll({ where: { id: updated.map(r => r.request.id) }, include: LAB_REQUEST_INCLUDES })
      : [];

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: ids.length > 1 ? "bulk_complete" : "complete",
      details: { updated: updated.map(u => ({ id: u.request.id, from: u.from, to: u.to })), skipped },
    });

    return success(res, `✅ ${updated.length} completed, ⚠️ ${skipped.length} skipped`, { records: full, skipped });
  } catch (err) {
    await t.rollback();
    return error(res, "❌ Failed to complete lab request(s)", err);
  }
};
/* ============================================================
   📌 CANCEL LAB REQUEST(S) (pending/in_progress → cancelled)
   ============================================================ */
export const cancelLabRequests = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module: MODULE_KEY,
      action: "update",
      res,
    });
    if (!allowed) return;

    const ids = Array.isArray(req.body?.ids) ? req.body.ids : [req.params.id];
    if (!ids?.length) {
      await t.rollback();
      return error(res, "❌ Must provide at least one Lab Request ID", null, 400);
    }

    /* 🔒 Tenant scoping */
    const role = (req.user?.roleNames?.[0] || "staff").toLowerCase();
    const where = { id: { [Op.in]: ids } };
    if (!isSuperAdmin(req.user)) {
      where.organization_id = req.user.organization_id;
      if (role === "facilityhead") where.facility_id = req.user.facility_id;
    } else {
      if (req.query.organization_id) where.organization_id = req.query.organization_id;
      if (req.query.facility_id) where.facility_id = req.query.facility_id;
    }

    const requests = await LabRequest.findAll({
      where,
      include: [{ model: LabRequestItem, as: "items" }],
      transaction: t,
      lock: { level: t.LOCK.UPDATE, of: LabRequest }
    });
    if (!requests.length) return error(res, "❌ No Lab Requests found", null, 404);

    const updated = [], skipped = [];

    for (const request of requests) {
      const oldStatus = request.status;
      if (![LRS.PENDING, LRS.IN_PROGRESS].includes(oldStatus)) {
        skipped.push({ id: request.id, reason: `Not cancellable (${oldStatus})` });
        continue;
      }

      let doctorId = resolveDoctorId(request, req.user);
      await request.update(
        { status: LRS.CANCELLED, doctor_id: doctorId, updated_by_id: req.user?.id || null },
        { transaction: t }
      );

      // rollback billing for each child item
      for (const item of request.items || []) {
        await billingService.voidCharges({
          module: "lab_request_item",
          entityId: item.id,
          user: {
            ...req.user,
            organization_id: request.organization_id,
            facility_id: request.facility_id,
          },
          transaction: t,
        });
      }

      // cascade results
      await LabResult.update(
        { status: "cancelled", updated_by_id: req.user?.id },
        { where: { lab_request_id: request.id, status: { [Op.notIn]: ["verified", "voided", "cancelled"] } }, transaction: t }
      );

      // cascade items
      await LabRequestItem.update(
        { status: "cancelled", updated_by_id: req.user?.id },
        { where: { lab_request_id: request.id, status: { [Op.notIn]: ["verified", "voided", "cancelled"] } }, transaction: t }
      );

      updated.push({ request, from: oldStatus, to: LRS.CANCELLED });
    }

    await t.commit();

    const full = updated.length
      ? await LabRequest.findAll({ where: { id: updated.map(u => u.request.id) }, include: LAB_REQUEST_INCLUDES })
      : [];

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: ids.length > 1 ? "bulk_cancel" : "cancel",
      details: { updated: updated.map(u => ({ id: u.request.id, from: u.from, to: u.to })), skipped },
    });

    return success(res, `✅ ${updated.length} cancelled, ⚠️ ${skipped.length} skipped`, { records: full, skipped });
  } catch (err) {
    await t.rollback();
    return error(res, "❌ Failed to cancel lab request(s)", err);
  }
};

/* ============================================================
   📌 VOID LAB REQUEST(S) (any → voided, admin/superadmin only)
   ============================================================ */
export const voidLabRequests = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const role = (req.user?.roleNames?.[0] || "").toLowerCase();
    if (!["admin", "superadmin"].includes(role)) {
      return error(res, "❌ Only admin/superadmin can void lab requests", null, 403);
    }

    const ids = Array.isArray(req.body?.ids) ? req.body.ids : [req.params.id];
    if (!ids?.length) {
      await t.rollback();
      return error(res, "❌ Must provide at least one Lab Request ID", null, 400);
    }

    const where = { id: { [Op.in]: ids } };
    if (!isSuperAdmin(req.user)) {
      where.organization_id = req.user.organization_id;
    } else {
      if (req.query.organization_id) where.organization_id = req.query.organization_id;
      if (req.query.facility_id) where.facility_id = req.query.facility_id;
    }

    const requests = await LabRequest.findAll({
      where,
      include: [{ model: LabRequestItem, as: "items" }],
      transaction: t,
      lock: { level: t.LOCK.UPDATE, of: LabRequest }
    });
    if (!requests.length) return error(res, "❌ No Lab Requests found", null, 404);

    const updated = [], skipped = [];

    for (const request of requests) {
      const oldStatus = request.status;
      if (oldStatus === LRS.VERIFIED) {
        skipped.push({ id: request.id, reason: "Verified cannot be voided" });
        continue;
      }

      let doctorId = resolveDoctorId(request, req.user);
      await request.update(
        { status: LRS.VOIDED, doctor_id: doctorId, updated_by_id: req.user?.id || null },
        { transaction: t }
      );

      // rollback billing for each child item
      for (const item of request.items || []) {
        await billingService.voidCharges({
          module: "lab_request_item",
          entityId: item.id,
          user: {
            ...req.user,
            organization_id: request.organization_id,
            facility_id: request.facility_id,
          },
          transaction: t,
        });
      }

      // cascade results
      await LabResult.update(
        { status: "voided", updated_by_id: req.user?.id },
        { where: { lab_request_id: request.id, status: { [Op.notIn]: ["verified", "voided"] } }, transaction: t }
      );

      // cascade items
      await LabRequestItem.update(
        { status: "voided", updated_by_id: req.user?.id },
        { where: { lab_request_id: request.id, status: { [Op.notIn]: ["verified", "voided"] } }, transaction: t }
      );

      updated.push({ request, from: oldStatus, to: LRS.VOIDED });
    }

    await t.commit();

    const full = updated.length
      ? await LabRequest.findAll({ where: { id: updated.map(u => u.request.id) }, include: LAB_REQUEST_INCLUDES })
      : [];

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: ids.length > 1 ? "bulk_void" : "void",
      details: { updated: updated.map(u => ({ id: u.request.id, from: u.from, to: u.to })), skipped },
    });

    return success(res, `✅ ${updated.length} voided, ⚠️ ${skipped.length} skipped`, { records: full, skipped });
  } catch (err) {
    await t.rollback();
    return error(res, "❌ Failed to void lab request(s)", err);
  }
};

/* ============================================================
   📌 SUBMIT LAB REQUEST(S) (draft → pending)
   ============================================================ */
export const submitLabRequests = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module: MODULE_KEY,
      action: "update",
      res,
    });
    if (!allowed) return;

    const ids = Array.isArray(req.body?.ids) ? req.body.ids : [req.params.id];
    if (!ids?.length) {
      await t.rollback();
      return error(res, "❌ Must provide at least one Lab Request ID", null, 400);
    }

    const role = (req.user?.roleNames?.[0] || "staff").toLowerCase();
    const where = { id: { [Op.in]: ids } };
    if (!isSuperAdmin(req.user)) {
      where.organization_id = req.user.organization_id;
      if (role === "facilityhead") where.facility_id = req.user.facility_id;
    } else {
      if (req.query.organization_id) where.organization_id = req.query.organization_id;
      if (req.query.facility_id) where.facility_id = req.query.facility_id;
    }

    const requests = await LabRequest.findAll({ where, transaction: t, lock: { level: t.LOCK.UPDATE, of: LabRequest } });
    if (!requests.length) return error(res, "❌ No Lab Requests found", null, 404);

    const updated = [], skipped = [];

    for (const request of requests) {
      const oldStatus = request.status;
      if (oldStatus !== LRS.DRAFT) {
        skipped.push({ id: request.id, reason: `Not in draft (${oldStatus})` });
        continue;
      }

      // check for duplicate
      const exists = await LabRequest.findOne({
        where: {
          organization_id: request.organization_id,
          facility_id: request.facility_id,
          patient_id: request.patient_id,
          request_date: request.request_date,
          id: { [Op.ne]: request.id },
          status: { [Op.notIn]: [LRS.CANCELLED, LRS.VOIDED] },
        },
        transaction: t,
        paranoid: false,
      });
      if (exists) {
        skipped.push({ id: request.id, reason: "Duplicate request on same date" });
        continue;
      }

      let doctorId = resolveDoctorId(request, req.user);
      await request.update(
        { status: LRS.PENDING, doctor_id: doctorId, updated_by_id: req.user?.id || null },
        { transaction: t }
      );

      await LabRequestItem.update(
        { status: LRS.PENDING, updated_by_id: req.user?.id },
        { where: { lab_request_id: request.id }, transaction: t }
      );

      if (shouldTriggerBilling(MODULE_KEY, LRS.PENDING)) {
        await billingService.billLabRequestItems({
          labRequest: request,
          user: { ...req.user, organization_id: request.organization_id, facility_id: request.facility_id },
          transaction: t,
        });
      }

      updated.push({ request, from: oldStatus, to: LRS.PENDING });
    }

    await t.commit();

    const full = updated.length
      ? await LabRequest.findAll({ where: { id: updated.map(u => u.request.id) }, include: LAB_REQUEST_INCLUDES })
      : [];

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: ids.length > 1 ? "bulk_submit" : "submit",
      details: { updated: updated.map(u => ({ id: u.request.id, from: u.from, to: u.to })), skipped },
    });

    return success(res, `✅ ${updated.length} submitted, ⚠️ ${skipped.length} skipped`, { records: full, skipped });
  } catch (err) {
    await t.rollback();
    return error(res, "❌ Failed to submit lab request(s)", err);
  }
};

/* ============================================================
   📌 VERIFY LAB REQUEST(S) (completed → verified)
   ============================================================ */
export const verifyLabRequests = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const role = (req.user?.roleNames?.[0] || "").toLowerCase();
    if (!["admin", "superadmin"].includes(role)) {
      return error(res, "❌ Only admin/superadmin can verify lab requests", null, 403);
    }

    const ids = Array.isArray(req.body?.ids) ? req.body.ids : [req.params.id];
    if (!ids?.length) {
      await t.rollback();
      return error(res, "❌ Must provide at least one Lab Request ID", null, 400);
    }

    const where = { id: { [Op.in]: ids } };
    if (!isSuperAdmin(req.user)) {
      where.organization_id = req.user.organization_id;
    } else {
      if (req.query.organization_id) where.organization_id = req.query.organization_id;
      if (req.query.facility_id) where.facility_id = req.query.facility_id;
    }

    const requests = await LabRequest.findAll({ where, transaction: t, lock: { level: t.LOCK.UPDATE, of: LabRequest } });
    if (!requests.length) return error(res, "❌ No Lab Requests found", null, 404);

    const updated = [], skipped = [];

    for (const request of requests) {
      const oldStatus = request.status;
      if (oldStatus !== LRS.COMPLETED) {
        skipped.push({ id: request.id, reason: `Not completed (${oldStatus})` });
        continue;
      }

      const unverified = await LabResult.count({
        where: { lab_request_id: request.id, status: { [Op.ne]: "verified" } },
        transaction: t,
      });
      if (unverified > 0) {
        skipped.push({ id: request.id, reason: "Unverified results remain" });
        continue;
      }

      let doctorId = resolveDoctorId(request, req.user);
      await request.update(
        { status: LRS.VERIFIED, doctor_id: doctorId, updated_by_id: req.user?.id || null },
        { transaction: t }
      );

      await LabRequestItem.update(
        { status: LRS.VERIFIED, updated_by_id: req.user?.id },
        { where: { lab_request_id: request.id }, transaction: t }
      );

      if (shouldTriggerBilling(MODULE_KEY, LRS.VERIFIED)) {
        await billingService.billLabRequestItems({
          labRequest: request,
          user: { ...req.user, organization_id: request.organization_id, facility_id: request.facility_id },
          transaction: t,
        });
      }

      updated.push({ request, from: oldStatus, to: LRS.VERIFIED });
    }

    await t.commit();

    const full = updated.length
      ? await LabRequest.findAll({ where: { id: updated.map(u => u.request.id) }, include: LAB_REQUEST_INCLUDES })
      : [];

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: ids.length > 1 ? "bulk_verify" : "verify",
      details: { updated: updated.map(u => ({ id: u.request.id, from: u.from, to: u.to })), skipped },
    });

    return success(res, `✅ ${updated.length} verified, ⚠️ ${skipped.length} skipped`, { records: full, skipped });
  } catch (err) {
    await t.rollback();
    return error(res, "❌ Failed to verify lab request(s)", err);
  }
};
