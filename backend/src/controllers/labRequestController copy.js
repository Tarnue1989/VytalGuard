// 📁 controllers/labRequestController.js
import Joi from "joi";
import { Op } from "sequelize";
import {
  sequelize,
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
  InvoiceItem,
} from "../models/index.js";
import { success, error } from "../utils/response.js";
import { buildQueryOptions } from "../utils/queryHelper.js";
import { LAB_REQUEST_STATUS } from "../constants/enums.js";
import { authzService } from "../services/authzService.js";
import { auditService } from "../services/auditService.js";
import { FIELD_VISIBILITY_LAB_REQUEST } from "../constants/fieldVisibility.js";
import { billingService } from "../services/billingService.js";
import { shouldTriggerBilling } from "../constants/billing.js";

const MODULE_KEY = "lab_request";

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
const LAB_REQUEST_INCLUDES = [
  { model: Patient, as: "patient", attributes: ["id", "pat_no", "first_name", "last_name"] },
  { model: Employee.unscoped(), as: "doctor", attributes: ["id", "first_name", "last_name"] },
  { model: Department, as: "department", attributes: ["id", "name"] },
  { model: Consultation, as: "consultation", attributes: ["id", "consultation_date", "status"] },
  { model: RegistrationLog, as: "registrationLog", attributes: ["id", "registration_time", "log_status"] },
  { model: BillableItem, as: "labTest", attributes: ["id", "name", "price"] },
  { model: Organization, as: "organization", attributes: ["id", "name", "code"] },
  { model: Facility, as: "facility", attributes: ["id", "name", "code", "organization_id"] },
  { model: User, as: "createdBy", attributes: ["id", "first_name", "last_name"] },
  { model: User, as: "updatedBy", attributes: ["id", "first_name", "last_name"] },
  { model: User, as: "deletedBy", attributes: ["id", "first_name", "last_name"] },
];

/* ============================================================
   📋 ROLE-BASED JOI SCHEMA FACTORY
   ============================================================ */
function buildLabRequestSchema(userRole, mode = "create") {
  const base = {
    patient_id: Joi.string().uuid().required(),
    department_id: Joi.string().uuid().allow(null),
    consultation_id: Joi.string().uuid().allow(null),
    registration_log_id: Joi.string().uuid().allow(null),
    lab_test_id: Joi.string().uuid().required(),
    request_date: Joi.date().default(() => new Date()),
    notes: Joi.string().allow("", null),
    is_emergency: Joi.boolean().default(false),
    status: Joi.string().valid(...LAB_REQUEST_STATUS).default(LRS.DRAFT),
  };

  // doctor_id rules
  if (["superadmin", "orgowner", "admin"].includes(userRole)) {
    base.doctor_id = Joi.string().uuid().required();
  } else {
    base.doctor_id = Joi.string().uuid().optional().allow(null, "");
  }

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
    default: // staff
      base.organization_id = Joi.forbidden();
      base.facility_id = Joi.forbidden();
  }

  return Joi.object(base);
}
/* ============================================================
   📌 CREATE LAB REQUEST(S)
   ============================================================ */
export const createLabRequests = async (req, res) => {
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
    const schema = buildLabRequestSchema(role, "create");

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

      // 🔒 Org/Facility resolution
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
        skipped.push({ index: idx, reason: "Missing organization assignment" });
        continue;
      }

      // 👨‍⚕️ Doctor resolution
      let doctorId = value.doctor_id || null;
      if (!doctorId && req.user?.employee_id) {
        doctorId = req.user.employee_id;
      }

      // 📝 Encounter / Consultation auto-fill
      let registrationLogId =
        value.registration_log_id || payload.registration_log_id || req.query.registration_log_id || null;
      let consultationId =
        value.consultation_id || payload.consultation_id || req.query.consultation_id || null;

      if (consultationId && !registrationLogId) {
        const consult = await Consultation.findByPk(consultationId);
        if (consult) registrationLogId = consult.registration_log_id;
      }

      if (!consultationId && registrationLogId) {
        const consult = await Consultation.findOne({
          where: { registration_log_id: registrationLogId },
          order: [["consultation_date", "DESC"]],
        });
        if (consult) consultationId = consult.id;
      }

      if (!registrationLogId && !consultationId) {
        const regLog = await RegistrationLog.findOne({
          where: {
            patient_id: value.patient_id,
            organization_id: orgId,
            facility_id: facilityId,
            log_status: "active",
          },
          order: [["registration_time", "DESC"]],
        });
        if (regLog) {
          registrationLogId = regLog.id;
          const consult = await Consultation.findOne({
            where: { registration_log_id: regLog.id },
            order: [["consultation_date", "DESC"]],
          });
          if (consult) consultationId = consult.id;
        }
      }

      // ✅ Consistency check
      if (consultationId && registrationLogId) {
        const consult = await Consultation.findByPk(consultationId);
        if (consult && consult.registration_log_id && consult.registration_log_id !== registrationLogId) {
          skipped.push({ index: idx, reason: "Consultation does not belong to the given Registration Log" });
          continue;
        }
      }

      // 🔎 Prevent duplicate same-day request for same patient/test
      const exists = await LabRequest.findOne({
        where: {
          organization_id: orgId,
          facility_id: facilityId,
          patient_id: value.patient_id,
          lab_test_id: value.lab_test_id,
          request_date: value.request_date,
          status: { [Op.notIn]: [LRS.CANCELLED, LRS.VOIDED] },
        },
        paranoid: false,
        include: LAB_REQUEST_INCLUDES,
      });
      if (exists) {
        skipped.push({
          index: idx,
          reason: `Duplicate: Patient already has a '${exists.labTest?.name || "lab test"}' request on ${exists.request_date}`,
          existing: exists,
        });
        continue;
      }

      prepared.push({
        ...value,
        doctor_id: doctorId,
        registration_log_id: registrationLogId,
        consultation_id: consultationId,
        organization_id: orgId,
        facility_id: facilityId,
        created_by_id: req.user?.id || null,
      });
    }

    let created = [];
    if (prepared.length > 0) {
      try {
        created = await LabRequest.bulkCreate(prepared, { transaction: t });
        for (const r of created) {
          if (shouldTriggerBilling("lab-request", r.status)) {
            await billingService.handleAutoBilling("lab-request", r, { transaction: t });
          }
        }
      } catch (err) {
        if (err.name === "SequelizeUniqueConstraintError") {
          await t.rollback();
          return error(
            res,
            "❌ Duplicate lab request detected (patient/test/date must be unique per day)",
            err,
            409
          );
        }
        throw err;
      }
    }

    await t.commit();

    const full = created.length
      ? await LabRequest.findAll({
          where: { id: { [Op.in]: created.map(c => c.id) } },
          include: LAB_REQUEST_INCLUDES,
        })
      : [];

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: payloads.length > 1 ? "bulk_create" : "create",
      details: { saved: created.length, skipped: skipped.length },
    });

    return success(res, {
      message: `✅ ${created.length} created, ⚠️ ${skipped.length} skipped`,
      records: full,
      skipped,
    });
  } catch (err) {
    if (t && !t.finished) await t.rollback();
    return error(res, "❌ Failed to create lab request(s)", err);
  }
};


/* ============================================================
   📌 UPDATE LAB REQUEST
   ============================================================ */
export const updateLabRequest = async (req, res) => {
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
    const role = (req.user?.roleNames?.[0] || "").toLowerCase();
    const schema = buildLabRequestSchema(role, "update");
    const { error: validationError, value } = schema.validate(req.body, { stripUnknown: true });
    if (validationError) {
      await t.rollback();
      return error(res, "Validation failed", validationError, 400);
    }

    // 🔒 Org/Facility resolution
    let orgId = req.user.organization_id || null;
    let facilityId = null;
    if (isSuperAdmin(req.user)) {
      orgId = value.organization_id || req.body.organization_id || req.query.organization_id || null;
      facilityId = value.facility_id || req.body.facility_id || req.query.facility_id || null;
    } else if (role === "org_owner") {
      orgId = req.user.organization_id;
      facilityId = value.facility_id || req.body.facility_id || null;
    } else if (role === "admin") {
      orgId = req.user.organization_id;
      facilityId = value.facility_id || req.body.facility_id || null;
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

    const request = await LabRequest.findOne({
      where: { id, organization_id: orgId },
      transaction: t,
      lock: t.LOCK.UPDATE, // 🔒 ensure row-level lock
    });
    if (!request) {
      await t.rollback();
      return error(res, "Lab Request not found", null, 404);
    }

    const oldSnapshot = { ...request.get() };

    // 👨‍⚕️ Doctor resolution (restricted auto-assign)
    let doctorId = value.doctor_id || request.doctor_id || null;
    if (!doctorId && req.user?.employee_id) {
      const roleName = (req.user?.roleNames?.[0] || "").toLowerCase();
      if (["doctor", "admin", "superadmin"].includes(roleName)) {
        doctorId = req.user.employee_id;
      }
    }

    // 📝 Encounter / Consultation auto-fill
    let registrationLogId =
      value.registration_log_id || req.body.registration_log_id || req.query.registration_log_id || request.registration_log_id || null;
    let consultationId =
      value.consultation_id || req.body.consultation_id || req.query.consultation_id || request.consultation_id || null;

    if (consultationId && !registrationLogId) {
      const consult = await Consultation.findByPk(consultationId);
      if (consult) registrationLogId = consult.registration_log_id;
    }

    if (!consultationId && registrationLogId) {
      const consult = await Consultation.findOne({
        where: { registration_log_id: registrationLogId },
        order: [["consultation_date", "DESC"]],
      });
      if (consult) consultationId = consult.id;
    }

    if (!registrationLogId && !consultationId) {
      const regLog = await RegistrationLog.findOne({
        where: {
          patient_id: value.patient_id || request.patient_id,
          organization_id: orgId,
          facility_id: facilityId,
          log_status: "active",
        },
        order: [["registration_time", "DESC"]],
      });
      if (regLog) {
        registrationLogId = regLog.id;
        const consult = await Consultation.findOne({
          where: { registration_log_id: regLog.id },
          order: [["consultation_date", "DESC"]],
        });
        if (consult) consultationId = consult.id;
      }
    }

    // ✅ Consistency check
    if (consultationId && registrationLogId) {
      const consult = await Consultation.findByPk(consultationId);
      if (consult && consult.registration_log_id && consult.registration_log_id !== registrationLogId) {
        await t.rollback();
        return error(res, "Consultation does not belong to the given Registration Log", null, 400);
      }
    }

    // 🔎 Duplicate check (skip cancelled/voided)
    if (value.patient_id || value.lab_test_id || value.request_date) {
      const exists = await LabRequest.findOne({
        where: {
          organization_id: orgId,
          facility_id: facilityId,
          patient_id: value.patient_id || request.patient_id,
          lab_test_id: value.lab_test_id || request.lab_test_id,
          request_date: value.request_date || request.request_date,
          id: { [Op.ne]: request.id }, // exclude current record
          status: { [Op.notIn]: [LRS.CANCELLED, LRS.VOIDED] },
        },
        paranoid: false,
        include: LAB_REQUEST_INCLUDES,
      });
      if (exists) {
        await t.rollback();
        return error(
          res,
          `❌ Duplicate lab request detected: Patient already has '${exists.labTest?.name || "lab test"}' on ${exists.request_date}`,
          { existing: exists },
          409
        );
      }
    }

    await request.update(
      {
        ...value,
        doctor_id: doctorId,
        registration_log_id: registrationLogId,
        consultation_id: consultationId,
        organization_id: orgId,
        facility_id: facilityId,
        updated_by_id: req.user?.id || null,
      },
      { transaction: t }
    );

    // ⚡ Billing hook
    if (oldSnapshot.status !== request.status && shouldTriggerBilling(MODULE_KEY, request.status)) {
      await billingService.triggerAutoBilling({
        module: MODULE_KEY,
        entity: request,
        user: { ...req.user, organization_id: orgId, facility_id: facilityId },
        transaction: t,
      });
    }

    await t.commit();

    const full = await LabRequest.findOne({
      where: { id },
      include: LAB_REQUEST_INCLUDES,
    });

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
    if (t && !t.finished) await t.rollback();
    return error(res, "❌ Failed to update lab request", err);
  }
};


/* ============================================================
   📌 GET LAB REQUEST BY ID
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
      if (role === "facility_head") where.facility_id = req.user.facility_id;
    } else {
      if (req.query.organization_id) where.organization_id = req.query.organization_id;
      if (req.query.facility_id) where.facility_id = req.query.facility_id;
    }

    const request = await LabRequest.findOne({ where, include: LAB_REQUEST_INCLUDES });
    if (!request) return error(res, "❌ Lab Request not found", null, 404);

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "view",
      entityId: id,
      entity: request,
    });

    return success(res, "✅ Lab Request loaded", request);
  } catch (err) {
    return error(res, "❌ Failed to load lab request", err);
  }
};
/* ============================================================
   📌 GET ALL LAB REQUESTS
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
    const visibleFields = FIELD_VISIBILITY_LAB_REQUEST[role] || FIELD_VISIBILITY_LAB_REQUEST.staff;

    const options = buildQueryOptions(req, "request_date", "DESC", visibleFields);
    options.where = options.where || {};

    if (!isSuperAdmin(req.user)) {
      options.where.organization_id = req.user.organization_id;
      if (role === "facility_head") options.where.facility_id = req.user.facility_id;
    } else {
      if (req.query.organization_id) options.where.organization_id = req.query.organization_id;
      if (req.query.facility_id) options.where.facility_id = req.query.facility_id;
    }

    if (options.search) {
      options.where[Op.or] = [
        { notes: { [Op.iLike]: `%${options.search}%` } },
      ];
    }

    // ⚡ Enterprise: add lite mode to reduce payload
    const liteMode = req.query.lite === "true";

    const { count, rows } = await LabRequest.findAndCountAll({
      where: options.where,
      include: liteMode ? [] : [...LAB_REQUEST_INCLUDES, ...(options.include || [])],
      order: options.order,
      offset: options.offset,
      limit: Math.min(options.limit, 50), // hard cap for performance
    });

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "list",
      details: { query: req.query, returned: count, liteMode },
    });

    return success(res, "✅ Lab Requests loaded", {
      records: rows,
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
   📌 TOGGLE LAB REQUEST STATUS
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

    const request = await LabRequest.findOne({
      where,
      transaction: t,
      lock: t.LOCK.UPDATE,
    });
    if (!request) {
      await t.rollback();
      return error(res, "❌ Lab Request not found", null, 404);
    }

    const oldStatus = request.status;
    let newStatus;

    // ⚡ Enterprise: allow explicit override
    if (req.body?.status && LAB_REQUEST_STATUS.includes(req.body.status)) {
      newStatus = req.body.status;
    } else if (request.status === LRS.IN_PROGRESS) {
      newStatus = LRS.CANCELLED;
    } else if (request.status === LRS.CANCELLED) {
      newStatus = LRS.IN_PROGRESS;
    } else {
      newStatus = request.status;
    }

    if (oldStatus === newStatus) {
      await t.rollback();
      return error(res, "No status change performed", null, 400);
    }

    // 🔑 Ensure doctor_id
    let doctorId = request.doctor_id || null;
    if (!doctorId && req.user?.employee_id) {
      const roleName = (req.user?.roleNames?.[0] || "").toLowerCase();
      if (["doctor", "admin", "superadmin"].includes(roleName)) {
        doctorId = req.user.employee_id;
      }
    }

    // 🔎 Duplicate safety check when re-activating
    if ([LRS.IN_PROGRESS, LRS.PENDING].includes(newStatus)) {
      const exists = await LabRequest.findOne({
        where: {
          organization_id: request.organization_id,
          facility_id: request.facility_id,
          patient_id: request.patient_id,
          lab_test_id: request.lab_test_id,
          request_date: request.request_date,
          id: { [Op.ne]: request.id },
          status: { [Op.notIn]: [LRS.CANCELLED, LRS.VOIDED] },
        },
        paranoid: false,
        include: LAB_REQUEST_INCLUDES,
      });
      if (exists) {
        await t.rollback();
        return error(
          res,
          `❌ Duplicate lab request detected: Patient already has '${exists.labTest?.name || "lab test"}' on ${exists.request_date}`,
          { existing: exists },
          409
        );
      }
    }

    await request.update(
      { status: newStatus, doctor_id: doctorId, updated_by_id: req.user?.id || null },
      { transaction: t }
    );

    // ✅ Billing hook
    if (shouldTriggerBilling(MODULE_KEY, newStatus)) {
      const existing = await InvoiceItem.findOne({
        where: { module: MODULE_KEY, entity_id: request.id, status: "applied" },
        transaction: t,
      });
      if (!existing) {
        await billingService.triggerAutoBilling({
          module: MODULE_KEY,
          entity: request,
          user: { ...req.user, organization_id: request.organization_id, facility_id: request.facility_id },
          transaction: t,
        });
      }
    }

    // ❌ Cascade cancel
    if (newStatus === LRS.CANCELLED) {
      await billingService.voidCharges({
        module: MODULE_KEY,
        entityId: request.id,
        user: { ...req.user, organization_id: request.organization_id, facility_id: request.facility_id },
        transaction: t,
      });

      await LabResult.update(
        { status: "cancelled", updated_by_id: req.user?.id },
        {
          where: {
            lab_request_id: request.id,
            status: { [Op.notIn]: ["verified", "voided", "cancelled"] },
          },
          transaction: t,
        }
      );
    }

    await t.commit();

    const full = await LabRequest.findOne({ where: { id }, include: LAB_REQUEST_INCLUDES });

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "toggle_status",
      entityId: id,
      entity: full,
      details: { from: oldStatus, to: newStatus, before: request.get(), after: full.get() },
    });

    return success(res, `✅ Lab Request status set to ${newStatus}`, full);
  } catch (err) {
    await t.rollback();
    return error(res, "❌ Failed to toggle lab request status", err);
  }
};


/* ============================================================
   📌 ACTIVATE LAB REQUEST (pending → in_progress)
   ============================================================ */
export const activateLabRequest = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { id } = req.params;
    const request = await LabRequest.findByPk(id, { transaction: t, lock: t.LOCK.UPDATE });
    if (!request) return error(res, "❌ Lab Request not found", null, 404);

    if (request.status !== LRS.PENDING) {
      await t.rollback();
      return error(res, `❌ Only ${LRS.PENDING} requests can be activated`, null, 400);
    }

    const oldStatus = request.status;

    // 🔑 Ensure doctor_id
    let doctorId = request.doctor_id || null;
    if (!doctorId && req.user?.employee_id) {
      doctorId = req.user.employee_id;
    }

    // 🔎 Duplicate safety check before activation
    const exists = await LabRequest.findOne({
      where: {
        organization_id: request.organization_id,
        facility_id: request.facility_id,
        patient_id: request.patient_id,
        lab_test_id: request.lab_test_id,
        request_date: request.request_date,
        id: { [Op.ne]: request.id },
        status: { [Op.notIn]: [LRS.CANCELLED, LRS.VOIDED] },
      },
      paranoid: false,
      include: LAB_REQUEST_INCLUDES,
    });
    if (exists) {
      await t.rollback();
      return error(
        res,
        `❌ Duplicate lab request detected: Patient already has '${exists.labTest?.name || "lab test"}' on ${exists.request_date}`,
        { existing: exists },
        409
      );
    }

    await request.update(
      { status: LRS.IN_PROGRESS, doctor_id: doctorId, updated_by_id: req.user?.id || null },
      { transaction: t }
    );

    // ✅ Billing hook
    if (shouldTriggerBilling(MODULE_KEY, LRS.IN_PROGRESS)) {
      const existing = await InvoiceItem.findOne({
        where: { module: MODULE_KEY, entity_id: request.id, status: "applied" },
        transaction: t,
      });
      if (!existing) {
        await billingService.triggerAutoBilling({
          module: MODULE_KEY,
          entity: request,
          user: { ...req.user, organization_id: request.organization_id, facility_id: request.facility_id },
          transaction: t,
        });
      }
    }

    await t.commit();

    const full = await LabRequest.findOne({ where: { id }, include: LAB_REQUEST_INCLUDES });

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "activate",
      entityId: id,
      entity: full,
      details: { from: oldStatus, to: LRS.IN_PROGRESS },
    });

    return success(res, "✅ Lab Request activated", full);
  } catch (err) {
    await t.rollback();
    return error(res, "❌ Failed to activate lab request", err);
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

    // 🔎 Status filter (default to pending if not specified)
    if (status) {
      where.status = status.toLowerCase() === "pending" ? LRS.PENDING : status;
    } else {
      where.status = LRS.PENDING;
    }

    // 🔎 Patient filter
    if (patient_id) {
      where.patient_id = patient_id;
    }

    // 🔎 Tenant scoping
    if (!isSuperAdmin(req.user)) {
      where.organization_id = req.user.organization_id;
      if (role === "facility_head") where.facility_id = req.user.facility_id;
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
        { "$labTest.name$": { [Op.iLike]: `%${q}%` } },
      ];
    }

    const requests = await LabRequest.findAll({
      where,
      attributes: ["id", "request_date", "notes", "is_emergency", "status"], // ✅ use notes
      include: [
        { model: Patient, as: "patient", attributes: ["id", "pat_no", "first_name", "last_name"] },
        { model: Employee, as: "doctor", attributes: ["id", "first_name", "last_name"] },
        { model: Department, as: "department", attributes: ["id", "name"] },
        { model: Consultation, as: "consultation", attributes: ["id", "consultation_date", "status"] },
        { model: RegistrationLog, as: "registrationLog", attributes: ["id", "registration_time", "log_status"] },
        { model: BillableItem, as: "labTest", attributes: ["id", "name"] },
      ],
      order: [["request_date", "DESC"]],
      limit: 20,
    });

    const result = requests.map((r) => ({
      id: r.id,
      patient_id: r.patient?.id || null,
      patient: r.patient
        ? `${r.patient.pat_no} - ${r.patient.first_name} ${r.patient.last_name}`
        : "",
      doctor_id: r.doctor?.id || null,
      doctor_name: r.doctor ? `${r.doctor.first_name} ${r.doctor.last_name}` : "",
      consultation_id: r.consultation?.id || null,
      consultation_date: r.consultation?.consultation_date || null,
      registration_log_id: r.registrationLog?.id || null,
      registration_log_code: r.registrationLog?.log_status || null,
      department_id: r.department?.id || null,
      department_name: r.department?.name || null,
      test_id: r.labTest?.id || null,
      test: r.labTest?.name || "",
      date: r.request_date,
      notes: r.notes || "",   // ✅ correct field
      emergency: r.is_emergency,
      status: r.status,
    }));

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "list_lite_pending",
      details: {
        count: result.length,
        query: q || null,
        patient_id: patient_id || null,
        status: status || "pending",
      },
    });

    return success(res, "✅ Lab Requests loaded (lite)", { records: result });
  } catch (err) {
    return error(res, "❌ Failed to load lab requests (lite)", err);
  }
};

/* ============================================================
   📌 DELETE LAB REQUEST (Soft Delete + Cascade Results + Rollback Billing)
   ============================================================ */
export const deleteLabRequest = async (req, res) => {
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

    const request = await LabRequest.findOne({ where, transaction: t, lock: t.LOCK.UPDATE });
    if (!request) {
      await t.rollback();
      return error(res, "❌ Lab Request not found", null, 404);
    }

    // ⚡ Prevent deletion of completed or verified requests
    if ([LRS.COMPLETED, LRS.VERIFIED].includes(request.status)) {
      await t.rollback();
      return error(res, "❌ Completed or verified lab requests cannot be deleted", null, 403);
    }

    const oldSnapshot = { ...request.get() };

    // ⚡ Rollback billing
    await billingService.voidCharges({
      module: MODULE_KEY,
      entityId: request.id,
      user: { ...req.user, organization_id: request.organization_id, facility_id: request.facility_id },
      transaction: t,
    });

    // 🔄 Cascade: soft delete linked LabResults (if not already voided/verified)
    await LabResult.update(
      { status: "cancelled", updated_by_id: req.user?.id, deleted_by_id: req.user?.id, deleted_at: new Date() },
      {
        where: {
          lab_request_id: request.id,
          status: { [Op.notIn]: ["verified", "voided"] },
        },
        transaction: t,
      }
    );

    // Soft delete the LabRequest itself
    await request.update({ deleted_by_id: req.user?.id || null }, { transaction: t });
    await request.destroy({ transaction: t });

    await t.commit();

    const full = await LabRequest.findOne({
      where: { id },
      include: LAB_REQUEST_INCLUDES,
      paranoid: false,
    });

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "delete",
      entityId: id,
      entity: full,
      details: {
        reason: "Soft delete with rollback billing + cascade results",
        before: oldSnapshot,
        after: full?.get?.() || null,
      },
    });

    return success(res, "✅ Lab Request deleted (cascade results + billing rollback)", full);
  } catch (err) {
    await t.rollback();
    return error(res, "❌ Failed to delete lab request", err);
  }
};

/* ============================================================
   📌 COMPLETE LAB REQUEST (in_progress → completed)
   ============================================================ */
export const completeLabRequest = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { id } = req.params;
    const request = await LabRequest.findByPk(id, { transaction: t, lock: t.LOCK.UPDATE });
    if (!request) return error(res, "❌ Lab Request not found", null, 404);

    if (request.status !== LRS.IN_PROGRESS) {
      await t.rollback();
      return error(res, `❌ Only ${LRS.IN_PROGRESS} requests can be completed`, null, 400);
    }

    // 🔎 Ensure at least one result exists before completing
    const resultCount = await LabResult.count({
      where: { lab_request_id: request.id },
      transaction: t,
    });
    if (resultCount === 0) {
      await t.rollback();
      return error(res, "❌ Cannot complete request without at least one Lab Result", null, 400);
    }

    const oldSnapshot = { ...request.get() };

    // 🔑 Ensure doctor_id is set (restricted auto-assign)
    let doctorId = request.doctor_id || null;
    if (!doctorId && req.user?.employee_id) {
      const roleName = (req.user?.roleNames?.[0] || "").toLowerCase();
      if (["doctor", "admin", "superadmin"].includes(roleName)) {
        doctorId = req.user.employee_id;
      }
    }

    await request.update(
      { status: LRS.COMPLETED, doctor_id: doctorId, updated_by_id: req.user?.id || null },
      { transaction: t }
    );

    // ✅ Billing hook
    if (shouldTriggerBilling(MODULE_KEY, LRS.COMPLETED)) {
      const existing = await InvoiceItem.findOne({
        where: { module: MODULE_KEY, entity_id: request.id, status: "applied" },
        transaction: t,
      });
      if (!existing) {
        await billingService.triggerAutoBilling({
          module: MODULE_KEY,
          entity: request,
          user: { ...req.user, organization_id: request.organization_id, facility_id: request.facility_id },
          transaction: t,
        });
      }
    }

    await t.commit();

    const full = await LabRequest.findOne({ where: { id }, include: LAB_REQUEST_INCLUDES });

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "complete",
      entityId: id,
      entity: full,
      details: { from: oldSnapshot.status, to: LRS.COMPLETED, before: oldSnapshot, after: full.get() },
    });

    return success(res, "✅ Lab Request marked as completed", full);
  } catch (err) {
    await t.rollback();
    return error(res, "❌ Failed to complete lab request", err);
  }
};

/* ============================================================
   📌 CANCEL LAB REQUEST (pending/in_progress → cancelled)
   ============================================================ */
export const cancelLabRequest = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { id } = req.params;
    const request = await LabRequest.findByPk(id, { transaction: t, lock: t.LOCK.UPDATE });
    if (!request) return error(res, "❌ Lab Request not found", null, 404);

    if (![LRS.PENDING, LRS.IN_PROGRESS].includes(request.status)) {
      await t.rollback();
      return error(res, `❌ Only ${LRS.PENDING} or ${LRS.IN_PROGRESS} requests can be cancelled`, null, 400);
    }

    const oldSnapshot = { ...request.get() };

    // 🔑 Ensure doctor_id is set (restricted auto-assign)
    let doctorId = request.doctor_id || null;
    if (!doctorId && req.user?.employee_id) {
      const roleName = (req.user?.roleNames?.[0] || "").toLowerCase();
      if (["doctor", "admin", "superadmin"].includes(roleName)) {
        doctorId = req.user.employee_id;
      }
    }

    await request.update(
      { status: LRS.CANCELLED, doctor_id: doctorId, updated_by_id: req.user?.id || null },
      { transaction: t }
    );

    // ⚡ Rollback billing if charges exist
    await billingService.voidCharges({
      module: MODULE_KEY,
      entityId: request.id,
      user: { ...req.user, organization_id: request.organization_id, facility_id: request.facility_id },
      transaction: t,
    });

    // 🔄 Cascade cancel to linked LabResults
    await LabResult.update(
      { status: "cancelled", updated_by_id: req.user?.id },
      {
        where: {
          lab_request_id: request.id,
          status: { [Op.notIn]: ["verified", "voided", "cancelled"] },
        },
        transaction: t,
      }
    );

    await t.commit();

    const full = await LabRequest.findOne({ where: { id }, include: LAB_REQUEST_INCLUDES });

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "cancel",
      entityId: id,
      entity: full,
      details: { from: oldSnapshot.status, to: LRS.CANCELLED, before: oldSnapshot, after: full.get() },
    });

    return success(res, "✅ Lab Request cancelled, charges voided, and results cancelled", full);
  } catch (err) {
    await t.rollback();
    return error(res, "❌ Failed to cancel lab request", err);
  }
};


/* ============================================================
   📌 VOID LAB REQUEST (any → voided, admin/superadmin only)
   ============================================================ */
export const voidLabRequest = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const role = (req.user?.roleNames?.[0] || "").toLowerCase();
    if (!["admin", "superadmin"].includes(role)) {
      return error(res, "❌ Only admin/superadmin can void lab requests", null, 403);
    }

    const { id } = req.params;
    const request = await LabRequest.findByPk(id, { transaction: t, lock: t.LOCK.UPDATE });
    if (!request) return error(res, "❌ Lab Request not found", null, 404);

    // ⚡ Prevent voiding verified requests
    if (request.status === LRS.VERIFIED) {
      await t.rollback();
      return error(res, "❌ Verified lab requests cannot be voided", null, 403);
    }

    const oldSnapshot = { ...request.get() };

    // 🔑 Ensure doctor_id is set (restricted auto-assign)
    let doctorId = request.doctor_id || null;
    if (!doctorId && req.user?.employee_id) {
      const roleName = (req.user?.roleNames?.[0] || "").toLowerCase();
      if (["doctor", "admin", "superadmin"].includes(roleName)) {
        doctorId = req.user.employee_id;
      }
    }

    await request.update(
      { status: LRS.VOIDED, doctor_id: doctorId, updated_by_id: req.user?.id || null },
      { transaction: t }
    );

    // ⚡ Rollback billing
    await billingService.voidCharges({
      module: MODULE_KEY,
      entityId: request.id,
      user: { ...req.user, organization_id: request.organization_id, facility_id: request.facility_id },
      transaction: t,
    });

    // 🔄 Cascade void to linked LabResults
    await LabResult.update(
      { status: "voided", updated_by_id: req.user?.id },
      {
        where: {
          lab_request_id: request.id,
          status: { [Op.notIn]: ["verified", "voided"] },
        },
        transaction: t,
      }
    );

    await t.commit();

    const full = await LabRequest.findOne({ where: { id }, include: LAB_REQUEST_INCLUDES });

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "void",
      entityId: id,
      entity: full,
      details: { from: oldSnapshot.status, to: LRS.VOIDED, before: oldSnapshot, after: full.get() },
    });

    return success(res, "✅ Lab Request voided, charges voided, and results voided", full);
  } catch (err) {
    await t.rollback();
    return error(res, "❌ Failed to void lab request", err);
  }
};

/* ============================================================
   📌 SUBMIT LAB REQUEST (draft → pending)
   ============================================================ */
export const submitLabRequest = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { id } = req.params;
    const request = await LabRequest.findByPk(id, { transaction: t, lock: t.LOCK.UPDATE });
    if (!request) {
      await t.rollback();
      return error(res, "❌ Lab Request not found", null, 404);
    }

    if (request.status !== LRS.DRAFT) {
      await t.rollback();
      return error(res, `❌ Only ${LRS.DRAFT} requests can be submitted`, null, 400);
    }

    // 🔎 Duplicate safety check before moving to pending
    const exists = await LabRequest.findOne({
      where: {
        organization_id: request.organization_id,
        facility_id: request.facility_id,
        patient_id: request.patient_id,
        lab_test_id: request.lab_test_id,
        request_date: request.request_date,
        id: { [Op.ne]: request.id }, // exclude current draft
        status: { [Op.notIn]: [LRS.CANCELLED, LRS.VOIDED] },
      },
      paranoid: false,
      include: LAB_REQUEST_INCLUDES,
    });
    if (exists) {
      await t.rollback();
      return error(
        res,
        `❌ Duplicate lab request detected: Patient already has '${exists.labTest?.name || "lab test"}' on ${exists.request_date}`,
        { existing: exists },
        409
      );
    }

    const oldSnapshot = { ...request.get() };

    // 🔑 Ensure doctor_id is set (restricted auto-assign)
    let doctorId = request.doctor_id || null;
    if (!doctorId && req.user?.employee_id) {
      const roleName = (req.user?.roleNames?.[0] || "").toLowerCase();
      if (["doctor", "admin", "superadmin"].includes(roleName)) {
        doctorId = req.user.employee_id;
      }
    }

    await request.update(
      { status: LRS.PENDING, doctor_id: doctorId, updated_by_id: req.user?.id || null },
      { transaction: t }
    );

    await t.commit();

    const full = await LabRequest.findOne({ where: { id }, include: LAB_REQUEST_INCLUDES });

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "submit",
      entityId: id,
      entity: full,
      details: { from: oldSnapshot.status, to: LRS.PENDING, before: oldSnapshot, after: full.get() },
    });

    return success(res, `✅ Lab Request submitted (${LRS.PENDING})`, full);
  } catch (err) {
    await t.rollback();
    return error(res, "❌ Failed to submit lab request", err);
  }
};


/* ============================================================
   📌 VERIFY LAB REQUEST (completed → verified)
   ============================================================ */
export const verifyLabRequest = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const role = (req.user?.roleNames?.[0] || "").toLowerCase();
    if (!["admin", "superadmin"].includes(role)) {
      return error(res, "❌ Only admin/superadmin can verify lab requests", null, 403);
    }

    const { id } = req.params;
    const request = await LabRequest.findByPk(id, { transaction: t, lock: t.LOCK.UPDATE });
    if (!request) return error(res, "❌ Lab Request not found", null, 404);

    if (request.status !== LRS.COMPLETED) {
      await t.rollback();
      return error(res, `❌ Only ${LRS.COMPLETED} requests can be verified`, null, 400);
    }

    // 🔎 Ensure all linked results are verified before request can be verified
    const unverifiedResults = await LabResult.count({
      where: {
        lab_request_id: request.id,
        status: { [Op.ne]: "verified" },
      },
      transaction: t,
    });
    if (unverifiedResults > 0) {
      await t.rollback();
      return error(
        res,
        "❌ Cannot verify Lab Request until all linked Lab Results are verified",
        null,
        400
      );
    }

    const oldSnapshot = { ...request.get() };

    // 🔑 Ensure doctor_id is set (restricted auto-assign)
    let doctorId = request.doctor_id || null;
    if (!doctorId && req.user?.employee_id) {
      const roleName = (req.user?.roleNames?.[0] || "").toLowerCase();
      if (["doctor", "admin", "superadmin"].includes(roleName)) {
        doctorId = req.user.employee_id;
      }
    }

    await request.update(
      { status: LRS.VERIFIED, doctor_id: doctorId, updated_by_id: req.user?.id || null },
      { transaction: t }
    );

    await t.commit();

    const full = await LabRequest.findOne({ where: { id }, include: LAB_REQUEST_INCLUDES });

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "verify",
      entityId: id,
      entity: full,
      details: { from: oldSnapshot.status, to: LRS.VERIFIED, before: oldSnapshot, after: full.get() },
    });

    return success(res, "✅ Lab Request verified (all results verified)", full);
  } catch (err) {
    await t.rollback();
    return error(res, "❌ Failed to verify lab request", err);
  }
};
