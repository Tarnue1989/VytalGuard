// 📁 controllers/ultrasoundRecordController.js
import Joi from "joi";
import { Op } from "sequelize";
import {
  sequelize,
  UltrasoundRecord,
  Patient,
  Employee,
  Consultation,
  MaternityVisit,
  RegistrationLog,
  Invoice,
  BillableItem,
  User,
  Organization,
  Facility,
  Department,
} from "../models/index.js";
import { success, error } from "../utils/response.js";
import { buildQueryOptions } from "../utils/queryHelper.js";
import { ULTRASOUND_STATUS } from "../constants/enums.js";
import { authzService } from "../services/authzService.js";
import { auditService } from "../services/auditService.js";
import { FIELD_VISIBILITY_ULTRASOUND_RECORD } from "../constants/fieldVisibility.js";
import { billingService } from "../services/billingService.js";
import { shouldTriggerBilling } from "../constants/billing.js";
import { validatePaginationStrict } from "../utils/query-utils.js";
import { resolveClinicalLinks } from "../utils/autoLinkHelpers.js";
import { isSuperAdmin, hasRole, getUserRoles } from "../utils/role-utils.js";

// 🔖 Local enum map for readability
const USS = {
  PENDING: ULTRASOUND_STATUS[0],
  IN_PROGRESS: ULTRASOUND_STATUS[1],
  COMPLETED: ULTRASOUND_STATUS[2],
  VERIFIED: ULTRASOUND_STATUS[3],
  FINALIZED: ULTRASOUND_STATUS[4], // ✅ newly added
  CANCELLED: ULTRASOUND_STATUS[5],
  VOIDED: ULTRASOUND_STATUS[6],
};

const MODULE_KEY = "ultrasound-record";

/* ============================================================
   🧭  Full Audit Relations (for verified/finalized/voided)
   ============================================================ */
const ULTRASOUND_INCLUDES = [
  { model: Patient, as: "patient", attributes: ["id", "pat_no", "first_name", "last_name"] },
  { model: Employee.unscoped(), as: "technician", attributes: ["id", "first_name", "last_name"] },
  { model: Consultation, as: "consultation", attributes: ["id", "consultation_date", "status"] },
  { model: MaternityVisit, as: "maternityVisit", attributes: ["id", "visit_date", "status"] },
  { model: RegistrationLog, as: "registrationLog", attributes: ["id", "registration_time", "log_status"] },
  { model: Invoice, as: "invoice", attributes: ["id", "invoice_number", "status", "total"] },
  { model: BillableItem, as: "billableItem", attributes: ["id", "name", "price"] },
  { model: Department, as: "department", attributes: ["id", "name", "code"] },
  { model: Organization, as: "organization", attributes: ["id", "name", "code"] },
  { model: Facility, as: "facility", attributes: ["id", "name", "code", "organization_id"] },

  // 👇 Add these
  { model: User, as: "verifiedBy", attributes: ["id", "first_name", "last_name"] },
  { model: User, as: "finalizedBy", attributes: ["id", "first_name", "last_name"] },
  { model: User, as: "voidedBy", attributes: ["id", "first_name", "last_name"] },

  // Already existing
  { model: User, as: "createdBy", attributes: ["id", "first_name", "last_name"] },
  { model: User, as: "updatedBy", attributes: ["id", "first_name", "last_name"] },
  { model: User, as: "deletedBy", attributes: ["id", "first_name", "last_name"] },
];

/* ============================================================
   📋 JOI SCHEMA – Auto-Handled `scan_type` (no longer required)
============================================================ */
function buildUltrasoundSchema(mode = "create") {
  const base = {
    patient_id: Joi.string().uuid().required(),
    consultation_id: Joi.string().uuid().allow(null, ""),
    maternity_visit_id: Joi.string().uuid().allow(null, ""),
    registration_log_id: Joi.string().uuid().allow(null, ""),
    department_id: Joi.string().uuid().allow(null, ""),
    invoice_id: Joi.string().uuid().allow(null, ""),
    billable_item_id: Joi.string().uuid().allow(null, ""),
    technician_id: Joi.string().uuid().allow(null, ""),

    scan_type: Joi.string().allow("", null),
    scan_date: Joi.date().required(),
    scan_location: Joi.string().allow("", null),
    ultra_findings: Joi.string().allow("", null),
    note: Joi.string().allow("", null),

    number_of_fetus: Joi.number().allow(null),
    biparietal_diameter: Joi.number().precision(2).allow(null),
    presentation: Joi.string().allow("", null),
    lie: Joi.string().allow("", null),
    position: Joi.string().allow("", null),
    amniotic_volume: Joi.number().precision(2).allow(null),
    fetal_heart_rate: Joi.number().allow(null),
    gender: Joi.string().valid("male", "female").allow(null),

    previous_cesarean: Joi.boolean().default(false),
    prev_ces_date: Joi.date().allow(null),
    prev_ces_location: Joi.string().allow("", null),
    cesarean_date: Joi.date().allow(null),
    indication: Joi.string().allow("", null),
    next_of_kin: Joi.string().allow("", null),

    is_emergency: Joi.boolean().default(false),
    void_reason: Joi.string().allow("", null),
    source: Joi.string().allow("", null),
    file_path: Joi.string().allow("", null),

    organization_id: Joi.string().uuid().allow(null),
    facility_id: Joi.string().uuid().allow(null),
  };

  if (mode === "update") {
    Object.keys(base).forEach(k => (base[k] = base[k].optional()));
  }
  return Joi.object(base);
}


/* ============================================================
   📌 CREATE ULTRASOUND RECORD – Auto-Fill scan_type
   (Enterprise-grade: full audit meta + model parity)
============================================================ */
export const createUltrasoundRecord = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module: MODULE_KEY,
      action: "create",
      res,
    });
    if (!allowed) return;

    const schema = buildUltrasoundSchema("create");
    const { error: validationError, value } = schema.validate(req.body, { stripUnknown: true });
    if (validationError) {
      await t.rollback();
      return error(res, "Validation failed", validationError, 400);
    }

    // 🧩 Auto-derive scan_type from Billable Item if not provided
    if (!value.scan_type && value.billable_item_id) {
      const billable = await BillableItem.findByPk(value.billable_item_id);
      if (billable?.name) value.scan_type = billable.name;
    }

    // 🏢 Determine tenant context
    let orgId, facilityId;
    if (isSuperAdmin(req.user)) {
      orgId = value.organization_id;
      facilityId = value.facility_id;
      if (!orgId || !facilityId) {
        await t.rollback();
        return error(res, "Organization and Facility required for superadmin", null, 400);
      }
    } else {
      orgId = req.user.organization_id;
      facilityId = req.user.facility_id;
      value.organization_id = orgId;
      value.facility_id = facilityId;
    }

    // 🔗 Resolve related links (consultation, patient, maternity, etc.)
    value._currentUser = req.user;
    await resolveClinicalLinks(value, orgId, facilityId, t);

    // 🧾 Create record
    const created = await UltrasoundRecord.create(
      {
        ...value,
        status: USS.PENDING,
        organization_id: orgId,
        facility_id: facilityId,
        created_by_id: req.user?.id || null,
      },
      { transaction: t }
    );

    await t.commit();

    // 🔍 Reload with associations for full response
    const full = await UltrasoundRecord.findOne({
      where: { id: created.id },
      include: ULTRASOUND_INCLUDES,
    });

    // 🧠 Audit creation with meta scope
    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "create",
      entityId: created.id,
      entity: created,
      details: { ...value, status: USS.PENDING },
      meta: {
        scope_org: orgId,
        scope_fac: facilityId,
        outcome: "success",
      },
    });

    return success(res, "✅ Ultrasound record created", full);
  } catch (err) {
    await t.rollback();

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "create",
      details: { outcome: "failed", error: err.message },
    });

    return error(res, "❌ Failed to create ultrasound record", err);
  }
};


/* ============================================================
   📌 UPDATE ULTRASOUND RECORD – Auto-Fill scan_type
   (Enterprise-grade: full audit meta + model parity)
============================================================ */
export const updateUltrasoundRecord = async (req, res) => {
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
    const schema = buildUltrasoundSchema("update");
    const { error: validationError, value } = schema.validate(req.body, { stripUnknown: true });
    if (validationError) {
      await t.rollback();
      return error(res, "Validation failed", validationError, 400);
    }

    const record = await UltrasoundRecord.findOne({ where: { id }, transaction: t });
    if (!record) {
      await t.rollback();
      return error(res, "Ultrasound record not found", null, 404);
    }

    // 🧩 Auto-derive scan_type if missing
    if (!value.scan_type && value.billable_item_id) {
      const billable = await BillableItem.findByPk(value.billable_item_id);
      if (billable?.name) value.scan_type = billable.name;
    }

    // 🏢 Ensure tenant scope integrity
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

    // 🔗 Resolve any clinical link consistency
    value._currentUser = req.user;
    await resolveClinicalLinks(value, orgId, facilityId, t);

    // 🧾 Perform update
    await record.update({ ...value, updated_by_id: req.user?.id || null }, { transaction: t });
    await t.commit();

    // 🔍 Reload for full output
    const full = await UltrasoundRecord.findOne({
      where: { id },
      include: ULTRASOUND_INCLUDES,
    });

    // 🧠 Audit log with full meta scope
    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "update",
      entityId: id,
      entity: full,
      details: value,
      meta: {
        scope_org: record.organization_id,
        scope_fac: record.facility_id,
        outcome: "success",
      },
    });

    return success(res, "✅ Ultrasound record updated", full);
  } catch (err) {
    await t.rollback();

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "update",
      entityId: req.params.id,
      details: { outcome: "failed", error: err.message },
    });

    return error(res, "❌ Failed to update ultrasound record", err);
  }
};


/* ============================================================
   🧠 ULTRASOUND LIFECYCLE HANDLERS (Audit-Consistent)
   ============================================================ */

/* ============================================================
   1️⃣ START ULTRASOUND (pending → in_progress)
   ============================================================ */
export const startUltrasound = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { id } = req.params;
    const user = req.user;

    const rec = await UltrasoundRecord.findOne({ where: { id }, transaction: t });
    if (!rec) return error(res, "❌ Ultrasound record not found", null, 404);

    if (rec.status !== USS.PENDING) {
      await t.rollback();
      return error(res, "❌ Only pending ultrasounds can be started", null, 400);
    }

    const oldStatus = rec.status;
    await rec.update(
      { status: USS.IN_PROGRESS, updated_by_id: user?.id || null },
      { transaction: t }
    );
    await t.commit();

    await auditService.logAction({
      user,
      module: MODULE_KEY,
      action: "start",
      entityId: id,
      entity: rec,
      details: { from: oldStatus, to: USS.IN_PROGRESS },
      meta: {
        scope_org: rec.organization_id,
        scope_fac: rec.facility_id,
        outcome: "success",
      },
    });

    return success(res, "✅ Ultrasound started (in-progress)", rec);
  } catch (err) {
    await t.rollback();
    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "start",
      entityId: req.params.id,
      details: { outcome: "failed", error: err.message },
    });
    return error(res, "❌ Failed to start ultrasound", err);
  }
};

/* ============================================================
   2️⃣ COMPLETE ULTRASOUND (in_progress → completed)
   ============================================================ */
export const completeUltrasound = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { id } = req.params;
    const user = req.user;

    const rec = await UltrasoundRecord.findOne({ where: { id }, transaction: t });
    if (!rec) return error(res, "❌ Ultrasound record not found", null, 404);

    if (rec.status !== USS.IN_PROGRESS) {
      await t.rollback();
      return error(res, "❌ Only in-progress ultrasounds can be completed", null, 400);
    }

    const oldStatus = rec.status;
    await rec.update(
      { status: USS.COMPLETED, updated_by_id: user?.id || null },
      { transaction: t }
    );

    if (shouldTriggerBilling(MODULE_KEY, USS.COMPLETED)) {
      await billingService.triggerAutoBilling({
        module: MODULE_KEY,
        entity: rec,
        user: {
          ...user,
          organization_id: rec.organization_id,
          facility_id: rec.facility_id,
        },
        transaction: t,
      });
    }

    await t.commit();
    await auditService.logAction({
      user,
      module: MODULE_KEY,
      action: "complete",
      entityId: id,
      entity: rec,
      details: { from: oldStatus, to: USS.COMPLETED },
      meta: {
        scope_org: rec.organization_id,
        scope_fac: rec.facility_id,
        outcome: "success",
      },
    });

    return success(res, "✅ Ultrasound marked as completed", rec);
  } catch (err) {
    await t.rollback();
    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "complete",
      entityId: req.params.id,
      details: { outcome: "failed", error: err.message },
    });
    return error(res, "❌ Failed to complete ultrasound", err);
  }
};

/* ============================================================
   3️⃣ CANCEL ULTRASOUND (pending/in_progress → cancelled)
   ============================================================ */
export const cancelUltrasound = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const user = req.user;
    const role = (user?.roleNames?.[0] || "staff").toLowerCase();

    const where = { id };
    if (!isSuperAdmin(user)) {
      where.organization_id = user.organization_id;
      if (role === "facility_head") where.facility_id = user.facility_id;
    }

    const rec = await UltrasoundRecord.findOne({ where, transaction: t });
    if (!rec) return error(res, "❌ Ultrasound record not found", null, 404);

    if (![USS.PENDING, USS.IN_PROGRESS].includes(rec.status)) {
      await t.rollback();
      return error(res, "❌ Only pending or in-progress ultrasounds can be cancelled", null, 400);
    }

    const oldStatus = rec.status;
    await rec.update(
      {
        status: USS.CANCELLED,
        void_reason: reason || null,
        voided_by_id: user?.id || null,
        updated_by_id: user?.id || null,
      },
      { transaction: t }
    );

    await billingService.voidCharges({
      module: MODULE_KEY,
      entityId: rec.id,
      user,
      transaction: t,
    });

    await t.commit();
    await auditService.logAction({
      user,
      module: MODULE_KEY,
      action: "cancel",
      entityId: id,
      entity: rec,
      details: { from: oldStatus, to: USS.CANCELLED, reason: reason || null },
      meta: {
        scope_org: rec.organization_id,
        scope_fac: rec.facility_id,
        outcome: "success",
      },
    });

    return success(res, "✅ Ultrasound cancelled & charges voided", rec);
  } catch (err) {
    await t.rollback();
    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "cancel",
      entityId: req.params.id,
      details: { outcome: "failed", error: err.message },
    });
    return error(res, "❌ Failed to cancel ultrasound", err);
  }
};

/* ============================================================
   4️⃣ VERIFY ULTRASOUND (completed → verified)
   ============================================================ */
export const verifyUltrasound = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { id } = req.params;
    const user = req.user;
    const role = (user?.roleNames?.[0] || "staff").toLowerCase();

    const where = { id };
    if (!isSuperAdmin(user)) {
      where.organization_id = user.organization_id;
      if (role === "facility_head") where.facility_id = user.facility_id;
    }

    const rec = await UltrasoundRecord.findOne({ where, transaction: t });
    if (!rec) return error(res, "❌ Ultrasound record not found", null, 404);

    if (rec.status !== USS.COMPLETED) {
      await t.rollback();
      return error(res, "❌ Only completed ultrasounds can be verified", null, 400);
    }

    const oldStatus = rec.status;
    await rec.update(
      { status: USS.VERIFIED, verified_by_id: user?.id || null, verified_at: new Date() },
      { transaction: t }
    );

    if (shouldTriggerBilling(MODULE_KEY, USS.VERIFIED)) {
      await billingService.triggerAutoBilling({
        module: MODULE_KEY,
        entity: rec,
        user: {
          ...user,
          organization_id: rec.organization_id,
          facility_id: rec.facility_id,
        },
        transaction: t,
      });
    }

    await t.commit();
    await auditService.logAction({
      user,
      module: MODULE_KEY,
      action: "verify",
      entityId: id,
      entity: rec,
      details: { from: oldStatus, to: USS.VERIFIED },
      meta: {
        scope_org: rec.organization_id,
        scope_fac: rec.facility_id,
        outcome: "success",
      },
    });

    return success(res, "✅ Ultrasound verified", rec);
  } catch (err) {
    await t.rollback();
    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "verify",
      entityId: req.params.id,
      details: { outcome: "failed", error: err.message },
    });
    return error(res, "❌ Failed to verify ultrasound", err);
  }
};

/* ============================================================
   5️⃣ FINALIZE ULTRASOUND (verified → finalized)
   ============================================================ */
export const finalizeUltrasound = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const user = req.user;
    const role = (user?.roleNames?.[0] || "").toLowerCase();
    if (!["admin", "superadmin"].includes(role)) {
      return error(res, "❌ Only admin/superadmin can finalize ultrasounds", null, 403);
    }

    const { id } = req.params;
    const rec = await UltrasoundRecord.findOne({ where: { id }, transaction: t });
    if (!rec) return error(res, "❌ Ultrasound record not found", null, 404);

    if (rec.status !== USS.VERIFIED) {
      await t.rollback();
      return error(res, "❌ Only verified ultrasounds can be finalized", null, 400);
    }

    const oldStatus = rec.status;
    await rec.update(
      {
        status: USS.FINALIZED,
        finalized_by_id: user?.id || null,
        finalized_at: new Date(),
        updated_by_id: user?.id || null,
      },
      { transaction: t }
    );

    await t.commit();
    await auditService.logAction({
      user,
      module: MODULE_KEY,
      action: "finalize",
      entityId: id,
      entity: rec,
      details: { from: oldStatus, to: USS.FINALIZED },
      meta: {
        scope_org: rec.organization_id,
        scope_fac: rec.facility_id,
        outcome: "success",
      },
    });

    return success(res, "✅ Ultrasound finalized (locked)", rec);
  } catch (err) {
    await t.rollback();
    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "finalize",
      entityId: req.params.id,
      details: { outcome: "failed", error: err.message },
    });
    return error(res, "❌ Failed to finalize ultrasound", err);
  }
};

/* ============================================================
   6️⃣ VOID ULTRASOUND (any → voided)
   ============================================================ */
export const voidUltrasound = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const user = req.user;
    const role = (user?.roleNames?.[0] || "").toLowerCase();

    // 🔐 Only Admin/SuperAdmin can void
    if (!["admin", "superadmin"].includes(role)) {
      return error(res, "❌ Only admin/superadmin can void ultrasounds", null, 403);
    }

    const { id } = req.params;
    const { reason } = req.body;

    // 🧭 Scope filter (multi-tenant safe)
    const where = { id };
    if (!isSuperAdmin(user)) {
      where.organization_id = user.organization_id;
      if (role === "facility_head") where.facility_id = user.facility_id;
    }

    const rec = await UltrasoundRecord.findOne({ where, transaction: t });
    if (!rec) return error(res, "❌ Ultrasound record not found", null, 404);

    // 🔄 Status update + audit metadata
    const oldStatus = rec.status;
    const now = new Date();

    await rec.update(
      {
        status: USS.VOIDED,
        void_reason: reason || null,
        voided_by_id: user?.id || null,
        voided_at: now,                 // ✅ Timestamp properly set
        updated_by_id: user?.id || null,
      },
      { transaction: t }
    );

    // 💳 Roll back related billing
    await billingService.voidCharges({
      module: MODULE_KEY,
      entityId: rec.id,
      user,
      transaction: t,
    });

    await t.commit();

    // 🧾 Audit Log (detailed trace)
    await auditService.logAction({
      user,
      module: MODULE_KEY,
      action: "void",
      entityId: id,
      entity: rec,
      details: {
        from: oldStatus,
        to: USS.VOIDED,
        reason: reason || null,
        voided_at: now.toISOString(),  // ✅ Explicit timestamp log
      },
      meta: {
        scope_org: rec.organization_id,
        scope_fac: rec.facility_id,
        outcome: "success",
      },
    });

    return success(res, "✅ Ultrasound voided & charges rolled back", rec);
  } catch (err) {
    await t.rollback();

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "void",
      entityId: req.params.id,
      details: { outcome: "failed", error: err.message },
    });

    return error(res, "❌ Failed to void ultrasound", err);
  }
};


/* ============================================================
   📌 DELETE ULTRASOUND (Soft Delete + Billing Rollback)
   (Upgraded: adds audit meta + failure logging)
============================================================ */
export const deleteUltrasound = async (req, res) => {
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

    const rec = await UltrasoundRecord.findOne({ where, transaction: t });
    if (!rec) {
      await t.rollback();
      return error(res, "❌ Ultrasound record not found", null, 404);
    }

    // 🧾 Roll back any billing charges
    await billingService.voidCharges({
      module: MODULE_KEY,
      entityId: rec.id,
      user: { ...req.user, organization_id: rec.organization_id, facility_id: rec.facility_id },
      transaction: t,
    });

    // 🗑️ Soft delete + audit flag
    await rec.update({ deleted_by_id: req.user?.id || null }, { transaction: t });
    await rec.destroy({ transaction: t });

    await t.commit();

    const full = await UltrasoundRecord.findOne({
      where: { id },
      include: ULTRASOUND_INCLUDES,
      paranoid: false,
    });

    // 🧠 Audit meta for traceability
    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "delete",
      entityId: id,
      entity: full,
      details: { outcome: "success" },
      meta: {
        scope_org: rec.organization_id,
        scope_fac: rec.facility_id,
        outcome: "success",
      },
    });

    return success(res, "✅ Ultrasound deleted (with billing rollback)", full);
  } catch (err) {
    await t.rollback();

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "delete",
      entityId: req.params.id,
      details: { outcome: "failed", error: err.message },
    });

    return error(res, "❌ Failed to delete ultrasound", err);
  }
};

/* ============================================================
   📌 GET ALL ULTRASOUNDS LITE (with ?q= + ?status= support)
   (Upgraded: adds audit meta + org/fac scope)
============================================================ */
export const getAllUltrasoundsLite = async (req, res) => {
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

    let statusFilter = [USS.PENDING, USS.IN_PROGRESS];
    if (status) {
      const statuses = Array.isArray(status) ? status : [status];
      statusFilter = statuses;
    }
    const where = { status: { [Op.in]: statusFilter } };

    if (!isSuperAdmin(req.user)) {
      where.organization_id = req.user.organization_id;
      if (role === "facility_head") where.facility_id = req.user.facility_id;
    } else {
      if (req.query.organization_id) where.organization_id = req.query.organization_id;
      if (req.query.facility_id) where.facility_id = req.query.facility_id;
    }

    if (q) {
      where[Op.or] = [
        { scan_type: { [Op.iLike]: `%${q}%` } },
        { ultra_findings: { [Op.iLike]: `%${q}%` } },
        { note: { [Op.iLike]: `%${q}%` } },
      ];
    }

    if (req.query.patient_id) where.patient_id = req.query.patient_id;
    if (req.query.technician_id) where.technician_id = req.query.technician_id;
    if (req.query.consultation_id) where.consultation_id = req.query.consultation_id;

    const scans = await UltrasoundRecord.findAll({
      where,
      attributes: ["id", "scan_date", "scan_type", "status"],
      include: [
        { model: Patient, as: "patient", attributes: ["id", "pat_no", "first_name", "last_name"] },
        { model: Employee.unscoped(), as: "technician", attributes: ["id", "first_name", "last_name"] },
      ],
      order: [["scan_date", "DESC"]],
      limit: 20,
    });

    const result = scans.map(s => ({
      id: s.id,
      patient: s.patient ? `${s.patient.pat_no} - ${s.patient.first_name} ${s.patient.last_name}` : "",
      technician: s.technician ? `${s.technician.first_name} ${s.technician.last_name}` : "",
      scan_type: s.scan_type || "",
      date: s.scan_date,
      status: s.status,
    }));

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "list_lite",
      details: { query: q || null, returned: result.length },
      meta: {
        scope_org: req.user.organization_id,
        scope_fac: req.user.facility_id,
        outcome: "success",
      },
    });

    return success(res, "✅ Ultrasounds loaded (lite)", { records: result });
  } catch (err) {
    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "list_lite",
      details: { outcome: "failed", error: err.message },
    });

    return error(res, "❌ Failed to load ultrasounds (lite)", err);
  }
};

/* ============================================================
   📌 GET ALL ULTRASOUND RECORDS (with ?status= support)
   (Upgraded: audit meta + org/fac meta for trace)
============================================================ */
export const getAllUltrasounds = async (req, res) => {
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
      FIELD_VISIBILITY_ULTRASOUND_RECORD[role] || FIELD_VISIBILITY_ULTRASOUND_RECORD.staff;

    const FRONTEND_ONLY_FIELDS = ["actions"];
    const safeFields = visibleFields.filter(f => !FRONTEND_ONLY_FIELDS.includes(f));

    const options = buildQueryOptions(req, "scan_date", "DESC", safeFields);
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
        { scan_type: { [Op.iLike]: `%${options.search}%` } },
        { ultra_findings: { [Op.iLike]: `%${options.search}%` } },
        { note: { [Op.iLike]: `%${options.search}%` } },
      ];
    }

    if (req.query.patient_id) options.where.patient_id = req.query.patient_id;
    if (req.query.technician_id) options.where.technician_id = req.query.technician_id;
    if (req.query.consultation_id) options.where.consultation_id = req.query.consultation_id;
    if (req.query.maternity_visit_id) options.where.maternity_visit_id = req.query.maternity_visit_id;

    if (req.query.status) {
      const statuses = Array.isArray(req.query.status)
        ? req.query.status
        : [req.query.status];
      options.where.status = { [Op.in]: statuses };
    }

    const { count, rows } = await UltrasoundRecord.findAndCountAll({
      where: options.where,
      include: [...ULTRASOUND_INCLUDES, ...(options.include || [])],
      order: options.order,
      offset: options.offset,
      limit: options.limit,
    });

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "list",
      details: { query: req.query, returned: count },
      meta: {
        scope_org: req.user.organization_id,
        scope_fac: req.user.facility_id,
        outcome: "success",
      },
    });

    return success(res, "✅ Ultrasound records loaded", {
      records: rows,
      pagination: {
        total: count,
        page: options.pagination.page,
        pageCount: Math.ceil(count / options.pagination.limit),
      },
    });
  } catch (err) {
    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "list",
      details: { outcome: "failed", error: err.message },
    });

    return error(res, "❌ Failed to load ultrasounds", err);
  }
};

/* ============================================================
   📌 GET ULTRASOUND RECORD BY ID
   (Upgraded: audit meta scope)
============================================================ */
export const getUltrasoundById = async (req, res) => {
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

    const record = await UltrasoundRecord.findOne({
      where,
      include: ULTRASOUND_INCLUDES,
    });
    if (!record) return error(res, "❌ Ultrasound record not found", null, 404);

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "view",
      entityId: id,
      entity: record,
      meta: {
        scope_org: record.organization_id,
        scope_fac: record.facility_id,
        outcome: "success",
      },
    });

    return success(res, "✅ Ultrasound record loaded", record);
  } catch (err) {
    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "view",
      entityId: req.params.id,
      details: { outcome: "failed", error: err.message },
    });

    return error(res, "❌ Failed to load ultrasound", err);
  }
};
