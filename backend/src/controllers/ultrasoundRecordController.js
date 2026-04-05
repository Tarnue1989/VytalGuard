// 📁 controllers/ultrasoundRecordController.js

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

/* ============================================================
   🧰 CORE UTILITIES
============================================================ */
import { success, error } from "../utils/response.js";
import { buildQueryOptions } from "../utils/queryHelper.js";
import { validate } from "../utils/validation.js";
import { normalizeDateRangeLocal } from "../utils/date-utils.js";

/* ============================================================
   🔐 AUTH / ROLE
============================================================ */
import { authzService } from "../services/authzService.js";
import { isSuperAdmin } from "../utils/role-utils.js";

/* ============================================================
   📊 ENUMS / FIELD VISIBILITY
============================================================ */
import { ULTRASOUND_STATUS } from "../constants/enums.js";
import { FIELD_VISIBILITY_ULTRASOUND_RECORD } from "../constants/fieldVisibility.js";

/* ============================================================
   🧾 SERVICES
============================================================ */
import { auditService } from "../services/auditService.js";
import { billingService } from "../services/billingService.js";

/* ============================================================
   🔗 HELPERS
============================================================ */
import { resolveClinicalLinks } from "../utils/autoLinkHelpers.js";

// 🔖 Local enum map for readability
const USS = {
  PENDING: ULTRASOUND_STATUS.PENDING,
  IN_PROGRESS: ULTRASOUND_STATUS.IN_PROGRESS,
  COMPLETED: ULTRASOUND_STATUS.COMPLETED,
  VERIFIED: ULTRASOUND_STATUS.VERIFIED,
  FINALIZED: ULTRASOUND_STATUS.FINALIZED,
  CANCELLED: ULTRASOUND_STATUS.CANCELLED,
  VOIDED: ULTRASOUND_STATUS.VOIDED,
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
  { model: User, as: "cancelledBy", attributes: ["id", "first_name", "last_name"] },

];

/* ============================================================
   📋 JOI SCHEMA – Auto-Handled `scan_type` (no longer required)
============================================================ */
function buildUltrasoundSchema(user, mode = "create") {
  const base = {
    patient_id: Joi.string().uuid().required(),

    consultation_id: Joi.string().uuid().allow("", null),
    maternity_visit_id: Joi.string().uuid().allow("", null),
    registration_log_id: Joi.string().uuid().allow("", null),
    department_id: Joi.string().uuid().allow("", null),
    invoice_id: Joi.string().uuid().allow("", null),
    billable_item_id: Joi.string().uuid().allow("", null),
    technician_id: Joi.string().uuid().allow("", null),

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
    gender: Joi.string().valid("male", "female").allow("", null),

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

    // 🔒 default: derived from session
    organization_id: Joi.forbidden(),
    facility_id: Joi.forbidden(),
  };

  /* 🔓 SUPERADMIN OVERRIDE (PATIENT PARITY) */
  if (isSuperAdmin(user)) {
    base.organization_id = Joi.string().uuid().allow("", null);
    base.facility_id = Joi.string().uuid().allow("", null);
  }

  if (mode === "update") {
    Object.keys(base).forEach((k) => {
      base[k] = base[k].optional();
    });
  }

  return Joi.object(base);
}


/* ============================================================
   📌 CREATE ULTRASOUND RECORD – Auto-Fill scan_type
   (Enterprise-grade: Patient-Parity Validation)
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

    /* ================= VALIDATION ================= */
    const { value, errors } = validate(
      buildUltrasoundSchema(req.user, "create"),
      req.body
    );

    if (errors) {
      await t.rollback();
      return res.status(400).json({ success: false, errors });
    }

    /* ================= NORMALIZE EMPTY STRINGS ================= */
    [
      "consultation_id",
      "maternity_visit_id",
      "registration_log_id",
      "department_id",
      "invoice_id",
      "billable_item_id",
      "technician_id",
      "organization_id",
      "facility_id",
      "number_of_fetus",
      "biparietal_diameter",
      "amniotic_volume",
      "fetal_heart_rate",
    ].forEach((f) => {
      if (value[f] === "") value[f] = null;
    });

    /* ================= AUTO SCAN TYPE ================= */
    if (!value.scan_type && value.billable_item_id) {
      const billable = await BillableItem.findByPk(value.billable_item_id);
      if (billable?.name) value.scan_type = billable.name;
    }

    /* ================= SCAN TYPE SAFETY ================= */
    if (!value.scan_type) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        errors: [{ field: "scan_type", message: "Scan type is required" }],
      });
    }

    /* ================= ORG / FACILITY ================= */
    let orgId, facilityId;
    if (isSuperAdmin(req.user)) {
      orgId = value.organization_id;
      facilityId = value.facility_id;

      if (!orgId || !facilityId) {
        await t.rollback();
        return res.status(400).json({
          success: false,
          errors: [
            { field: "organization_id", message: "Organization is required" },
            { field: "facility_id", message: "Facility is required" },
          ],
        });
      }
    } else {
      orgId = req.user.organization_id;
      facilityId = req.user.facility_id;
      value.organization_id = orgId;
      value.facility_id = facilityId;
    }

    /* ================= CLINICAL LINKS ================= */
    value._currentUser = req.user;
    await resolveClinicalLinks(value, orgId, facilityId, t);

    /* ================= CREATE ================= */
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

    const full = await UltrasoundRecord.findOne({
      where: { id: created.id },
      include: ULTRASOUND_INCLUDES,
    });

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "create",
      entityId: created.id,
      entity: full,
    });

    return success(res, "✅ Ultrasound record created", full);
  } catch (err) {
    await t.rollback();
    return error(res, "❌ Failed to create ultrasound record", err);
  }
};



/* ============================================================
   📌 UPDATE ULTRASOUND RECORD – Auto-Fill scan_type
   (Enterprise-grade: Patient-Parity Validation)
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

    /* ================= VALIDATION ================= */
    const { value, errors } = validate(
      buildUltrasoundSchema(req.user, "update"),
      req.body
    );

    if (errors) {
      await t.rollback();
      return res.status(400).json({ success: false, errors });
    }

    /* ================= NORMALIZE EMPTY STRINGS ================= */
    [
      "consultation_id",
      "maternity_visit_id",
      "registration_log_id",
      "department_id",
      "invoice_id",
      "billable_item_id",
      "technician_id",
      "organization_id",
      "facility_id",
      "number_of_fetus",
      "biparietal_diameter",
      "amniotic_volume",
      "fetal_heart_rate",
    ].forEach((f) => {
      if (value[f] === "") value[f] = null;
    });

    const record = await UltrasoundRecord.findOne({
      where: { id },
      transaction: t,
    });
    if (!record) {
      await t.rollback();
      return error(res, "Ultrasound record not found", null, 404);
    }

    /* ================= FILE LOCK ================= */
    if ([USS.FINALIZED, USS.VOIDED].includes(record.status)) {
      if ("file_path" in value || "source" in value) {
        await t.rollback();
        return error(
          res,
          "Finalized or voided ultrasound records cannot modify file attachments",
          null,
          400
        );
      }
    }

    /* ================= AUTO SCAN TYPE ================= */
    if (!value.scan_type && value.billable_item_id) {
      const billable = await BillableItem.findByPk(value.billable_item_id);
      if (billable?.name) value.scan_type = billable.name;
    }

    /* ================= SCAN TYPE SAFETY ================= */
    if (!value.scan_type && record.scan_type) {
      value.scan_type = record.scan_type;
    }

    if (!value.scan_type) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        errors: [{ field: "scan_type", message: "Scan type is required" }],
      });
    }

    /* ================= ORG / FACILITY ================= */
    let orgId, facilityId;
    if (isSuperAdmin(req.user)) {
      orgId = value.organization_id ?? record.organization_id;
      facilityId = value.facility_id ?? record.facility_id;
    } else {
      orgId = req.user.organization_id;
      facilityId = req.user.facility_id;
      value.organization_id = orgId;
      value.facility_id = facilityId;
    }

    /* ================= CLINICAL LINKS ================= */
    value._currentUser = req.user;
    await resolveClinicalLinks(value, orgId, facilityId, t);

    /* ================= UPDATE ================= */
    await record.update(
      {
        ...value,
        updated_by_id: req.user?.id || null,
      },
      { transaction: t }
    );

    await t.commit();

    const full = await UltrasoundRecord.findOne({
      where: { id },
      include: ULTRASOUND_INCLUDES,
    });

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "update",
      entityId: id,
      entity: full,
    });

    return success(res, "✅ Ultrasound record updated", full);
  } catch (err) {
    await t.rollback();
    return error(res, "❌ Failed to update ultrasound record", err);
  }
};


/* ============================================================
   🧠 ULTRASOUND LIFECYCLE HANDLERS (Audit-Consistent)
   ============================================================ */

/* ============================================================
   1️⃣ START ULTRASOUND (pending → in_progress)
   🔥 MASTER PARITY (BILLING POINT)
============================================================ */
export const startUltrasound = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { id } = req.params;
    const user = req.user;

    const rec = await UltrasoundRecord.findOne({
      where: { id },
      transaction: t,
    });

    if (!rec) {
      await t.rollback();
      return error(res, "❌ Ultrasound record not found", null, 404);
    }

    if (rec.status !== USS.PENDING) {
      await t.rollback();
      return error(res, "❌ Only pending ultrasounds can be started", null, 400);
    }

    const oldStatus = rec.status;

    /* ================= UPDATE ================= */
    await rec.update(
      {
        status: USS.IN_PROGRESS,
        updated_by_id: user?.id || null,
      },
      { transaction: t }
    );

    /* 🔥 CRITICAL — ENSURE UPDATED STATE */
    await rec.reload({ transaction: t });

    /* 🔥 MASTER BILLING (EARLY — SAME AS EKG) */
    await billingService.triggerAutoBilling({
      module: MODULE_KEY,
      entity: {
        ...rec.toJSON(),
        billable_item_id: rec.billable_item_id,
      },
      user: {
        ...user,
        organization_id: rec.organization_id,
        facility_id: rec.facility_id,
      },
      transaction: t,
    });

    await t.commit();

    /* ================= AUDIT ================= */
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

    return success(res, "✅ Ultrasound started", rec);
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
   (NO BILLING — billing happens at START)
============================================================ */
export const completeUltrasound = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { id } = req.params;
    const user = req.user;

    const rec = await UltrasoundRecord.findOne({
      where: { id },
      transaction: t,
    });

    if (!rec) {
      await t.rollback();
      return error(res, "❌ Ultrasound record not found", null, 404);
    }

    if (rec.status !== USS.IN_PROGRESS) {
      await t.rollback();
      return error(res, "❌ Only in-progress ultrasounds can be completed", null, 400);
    }

    const oldStatus = rec.status;

    /* ================= UPDATE ================= */
    await rec.update(
      {
        status: USS.COMPLETED,
        updated_by_id: user?.id || null,
      },
      { transaction: t }
    );

    await t.commit();

    /* ================= AUDIT ================= */
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
      return error(
        res,
        "❌ Only pending or in-progress ultrasounds can be cancelled",
        null,
        400
      );
    }

    const oldStatus = rec.status;

    /* ================= CANCEL (NOT VOID) ================= */
    await rec.update(
      {
        status: USS.CANCELLED,
        void_reason: reason || null,        // shared reason field (OK)
        cancelled_by_id: user?.id || null,  // ✅ correct field
        cancelled_at: new Date(),            // ✅ correct timestamp
        updated_by_id: user?.id || null,
      },
      { transaction: t }
    );

    /* ================= BILLING ROLLBACK ================= */
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
   (NO BILLING — billing happens at START)
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
      if (role === "facility_head") {
        where.facility_id = user.facility_id;
      }
    }

    const rec = await UltrasoundRecord.findOne({
      where,
      transaction: t,
    });

    if (!rec) {
      await t.rollback();
      return error(res, "❌ Ultrasound record not found", null, 404);
    }

    if (rec.status !== USS.COMPLETED) {
      await t.rollback();
      return error(res, "❌ Only completed ultrasounds can be verified", null, 400);
    }

    const oldStatus = rec.status;

    /* ================= UPDATE ================= */
    await rec.update(
      {
        status: USS.VERIFIED,
        verified_by_id: user?.id || null,
        verified_at: new Date(),
        updated_by_id: user?.id || null,
      },
      { transaction: t }
    );

    await t.commit();

    /* ================= AUDIT ================= */
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
/* ============================================================
   6️⃣ VOID ULTRASOUND (any → voided) — REASON REQUIRED
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

    // ❗ HARD REQUIRE VOID REASON
    if (!reason || !reason.trim()) {
      await t.rollback();
      return error(res, "Void reason is required", null, 400);
    }

    // 🧭 Tenant scope
    const where = { id };
    if (!isSuperAdmin(user)) {
      where.organization_id = user.organization_id;
      if (role === "facility_head") where.facility_id = user.facility_id;
    }

    const rec = await UltrasoundRecord.findOne({ where, transaction: t });
    if (!rec) {
      await t.rollback();
      return error(res, "❌ Ultrasound record not found", null, 404);
    }

    const oldStatus = rec.status;
    const now = new Date();

    // 🔄 Update record
    await rec.update(
      {
        status: USS.VOIDED,
        void_reason: reason.trim(),
        voided_by_id: user?.id || null,
        voided_at: now,
        updated_by_id: user?.id || null,
      },
      { transaction: t }
    );

    // 💳 Roll back billing
    await billingService.voidCharges({
      module: MODULE_KEY,
      entityId: rec.id,
      user,
      transaction: t,
    });

    await t.commit();

    // 🧾 Audit log
    await auditService.logAction({
      user,
      module: MODULE_KEY,
      action: "void",
      entityId: id,
      entity: rec,
      details: {
        from: oldStatus,
        to: USS.VOIDED,
        reason: reason.trim(),
        voided_at: now.toISOString(),
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
   (MASTER-ALIGNED: audit meta + org/fac scope + UI dateRange safe)
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
      FIELD_VISIBILITY_ULTRASOUND_RECORD[role] ||
      FIELD_VISIBILITY_ULTRASOUND_RECORD.staff;

    const FRONTEND_ONLY_FIELDS = ["actions"];
    const safeFields = visibleFields.filter(
      (f) => !FRONTEND_ONLY_FIELDS.includes(f)
    );

    const options = buildQueryOptions(req, "scan_date", "DESC", safeFields);
    options.where = options.where || {};

    /* ================= DATE RANGE ================= */
    const { dateRange } = req.query;
    if (dateRange) {
      const { startDate, endDate } = normalizeDateRangeLocal(dateRange);
      if (startDate && endDate) {
        options.where.scan_date = { [Op.between]: [startDate, endDate] };
      }
    }
    delete options.where.dateRange;

    /* ================= TENANT SCOPE ================= */
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

    /* ================= SEARCH ================= */
    if (options.search) {
      options.where[Op.or] = [
        { scan_type: { [Op.iLike]: `%${options.search}%` } },
        { ultra_findings: { [Op.iLike]: `%${options.search}%` } },
        { note: { [Op.iLike]: `%${options.search}%` } },
        { void_reason: { [Op.iLike]: `%${options.search}%` } },
      ];
    }

    /* ================= STATUS FILTER ================= */
    if (req.query.status) {
      const statuses = (Array.isArray(req.query.status)
        ? req.query.status
        : [req.query.status]
      ).filter((s) => Object.values(ULTRASOUND_STATUS).includes(s));
      if (statuses.length) {
        options.where.status = { [Op.in]: statuses };
      }
    }

    /* ================= QUERY ================= */
    const { count, rows } = await UltrasoundRecord.findAndCountAll({
      where: options.where,
      include: ULTRASOUND_INCLUDES,
      order: options.order,
      offset: options.offset,
      limit: options.limit,
    });

    /* ================= SUMMARY ================= */
    const summary = {
      total: count,
      pending: 0,
      in_progress: 0,
      completed: 0,
      verified: 0,
      finalized: 0,
      cancelled: 0,
      voided: 0,
      emergency: 0,
      withConsultation: 0,
      withRegistration: 0,
    };

    rows.forEach((r) => {
      if (summary[r.status] !== undefined) summary[r.status]++;
      if (r.is_emergency) summary.emergency++;
      if (r.consultation_id) summary.withConsultation++;
      if (r.registration_log_id) summary.withRegistration++;
    });

    /* ================= CARD-SAFE FLATTENING ================= */
    const records = rows.map((r) => ({
      ...r.toJSON(),

      patient_name: r.patient
        ? `${r.patient.first_name} ${r.patient.last_name}`
        : "—",
      patient_no: r.patient?.pat_no ?? "—",

      technician_name: r.technician
        ? `${r.technician.first_name} ${r.technician.last_name}`
        : "—",

      department_name: r.department?.name ?? "—",

      billable_name: r.billableItem?.name ?? r.scan_type,
      billable_price: r.billableItem?.price ?? null,

      registration_status: r.registrationLog?.log_status ?? null,

      created_by_name: r.createdBy
        ? `${r.createdBy.first_name} ${r.createdBy.last_name}`
        : "—",
    }));

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "list",
      details: { returned: count },
      meta: {
        scope_org: req.user.organization_id,
        scope_fac: req.user.facility_id,
        outcome: "success",
      },
    });

    return success(res, "✅ Ultrasound records loaded", {
      summary,
      records,
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
