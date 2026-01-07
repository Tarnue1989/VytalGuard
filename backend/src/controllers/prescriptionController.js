// 📁 controllers/prescriptionController.js
import Joi from "joi";
import { Op } from "sequelize";
import {
  sequelize,
  Prescription,
  PrescriptionItem,
  Patient,
  Employee,
  Department,
  Consultation,
  RegistrationLog,
  BillableItem,
  Organization,
  Facility,
  User,
  Invoice,
  DepartmentStock 
} from "../models/index.js";
import { success, error } from "../utils/response.js";
import { buildQueryOptions } from "../utils/queryHelper.js";
import { PRESCRIPTION_STATUS, PRESCRIPTION_ITEM_STATUS } from "../constants/enums.js";
import { authzService } from "../services/authzService.js";
import { auditService } from "../services/auditService.js";
import { FIELD_VISIBILITY_PRESCRIPTION } from "../constants/fieldVisibility.js";
import { billingService } from "../services/billingService.js";
import { shouldTriggerBilling } from "../constants/billing.js";
import { resolveClinicalLinks } from "../utils/autoLinkHelpers.js";

const MODULE_KEY = "prescription";

const PS = {
  DRAFT: PRESCRIPTION_STATUS[0],
  ISSUED: PRESCRIPTION_STATUS[1],
  DISPENSED: PRESCRIPTION_STATUS[2],
  COMPLETED: PRESCRIPTION_STATUS[3],
  CANCELLED: PRESCRIPTION_STATUS[4],
  VOIDED: PRESCRIPTION_STATUS[5],
  VERIFIED: PRESCRIPTION_STATUS[6],
};

const PIS = {
  DRAFT: PRESCRIPTION_ITEM_STATUS[0],
  ISSUED: PRESCRIPTION_ITEM_STATUS[1],
  DISPENSED: PRESCRIPTION_ITEM_STATUS[2],
  PARTIALLY_DISPENSED: PRESCRIPTION_ITEM_STATUS[3],
  CANCELLED: PRESCRIPTION_ITEM_STATUS[4],
  VOIDED: PRESCRIPTION_ITEM_STATUS[5],
};

const ITEM_STATUS_MAP = {
  [PS.DRAFT]: PIS.DRAFT,
  [PS.ISSUED]: PIS.ISSUED,
  [PS.DISPENSED]: PIS.DISPENSED,
  [PS.COMPLETED]: PIS.DISPENSED,
  [PS.CANCELLED]: PIS.CANCELLED,
  [PS.VOIDED]: PIS.VOIDED,
  [PS.VERIFIED]: PIS.DISPENSED,
};

function isSuperAdmin(user) {
  if (!user) return false;
  const roles = Array.isArray(user.roleNames) ? user.roleNames : [user.role || ""];
  return roles.map(r => r.toLowerCase()).includes("superadmin");
}

const PRESCRIPTION_INCLUDES = [
  { model: Patient, as: "patient", attributes: ["id", "pat_no", "first_name", "last_name"] },
  { model: Employee.unscoped(), as: "doctor", attributes: ["id", "first_name", "last_name"] },
  { model: Department, as: "department", attributes: ["id", "name"] },
  { model: Consultation, as: "consultation", attributes: ["id", "consultation_date", "status"] },
  { model: RegistrationLog, as: "registrationLog", attributes: ["id", "registration_time", "log_status"] },
  { model: Invoice, as: "invoice", attributes: ["id", "invoice_number", "status", "total"] },
  {
    model: PrescriptionItem,
    as: "items",
    required: false,
    include: [{ model: BillableItem, as: "billableItem", attributes: ["id", "name", "price"] }],
  },
  { model: Organization, as: "organization", attributes: ["id", "name", "code"] },
  { model: Facility, as: "facility", attributes: ["id", "name", "code", "organization_id"] },
  { model: User, as: "createdBy", attributes: ["id", "first_name", "last_name"] },
  { model: User, as: "updatedBy", attributes: ["id", "first_name", "last_name"] },
  { model: User, as: "deletedBy", attributes: ["id", "first_name", "last_name"] },
];

/* ============================================================
   📋 ROLE-BASED JOI SCHEMA
============================================================ */
function buildPrescriptionSchema(userRole, mode = "create") {
  const base = {
    patient_id: Joi.string().uuid().required(),
    doctor_id: Joi.string().uuid().allow(null, ""),
    department_id: Joi.string().uuid().allow(null, ""),
    consultation_id: Joi.string().uuid().allow(null, ""),
    registration_log_id: Joi.string().uuid().allow(null, ""),
    invoice_id: Joi.string().uuid().allow(null, ""),
    organization_id: Joi.string().uuid().allow(null, ""),   // ✅ always allowed
    facility_id: Joi.string().uuid().allow(null, ""),       // ✅ always allowed
    prescription_date: Joi.date().iso().required(),
    notes: Joi.string().allow("", null),
    is_emergency: Joi.boolean().default(false),
    status: Joi.string().valid(...PRESCRIPTION_STATUS).default(PS.DRAFT),
    items: Joi.array()
      .items(
        Joi.object({
          medication_id: Joi.string().uuid().optional(),
          billable_item_id: Joi.string().uuid().required(),
          dosage: Joi.string().allow("", null),
          route: Joi.string().allow("", null),
          duration: Joi.string().allow("", null),
          quantity: Joi.number().min(1).required(),
          instructions: Joi.string().allow("", null),
        })
      )
      .min(1)
      .required(),
  };

  if (mode === "update") {
    Object.keys(base).forEach((k) => (base[k] = base[k].optional()));
    base.items = Joi.array()
      .items(
        Joi.object({
          id: Joi.string().uuid().optional(),
          medication_id: Joi.string().uuid().optional(),
          billable_item_id: Joi.string().uuid().optional(),
          dosage: Joi.string().allow("", null),
          route: Joi.string().allow("", null),
          duration: Joi.string().allow("", null),
          quantity: Joi.number().optional(),
          instructions: Joi.string().allow("", null),
          _delete: Joi.boolean().optional().default(false),
        })
      )
      .optional();
  }

  return Joi.object(base);
}


/* ============================================================
   📌 CREATE PRESCRIPTIONS (Enterprise-Aligned)
============================================================ */
export const createPrescriptions = async (req, res) => {
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
    const schema = buildPrescriptionSchema(role, "create");
    const payloads = Array.isArray(req.body) ? req.body : [req.body];
    if (payloads.length === 0) {
      await t.rollback();
      return error(res, "Payload must be a non-empty object or array", null, 400);
    }

    const prepared = [];
    const skipped = [];

    for (const [idx, payload] of payloads.entries()) {
      const { error: validationError, value } = schema.validate(payload, { stripUnknown: true });
      if (validationError) {
        skipped.push({ index: idx, reason: "Validation failed", details: validationError.details });
        continue;
      }

      let orgId = req.user.organization_id || null;
      let facilityId = req.user.facility_id || null;

      if (isSuperAdmin(req.user)) {
        if (req.query.organization_id) orgId = req.query.organization_id;
        if (req.query.facility_id) facilityId = req.query.facility_id;
        orgId = value.organization_id || orgId;
        facilityId = value.facility_id || facilityId;
      }

      // 🔗 Auto clinical link resolution
      value._currentUser = req.user;
      await resolveClinicalLinks(value, orgId, facilityId, t);

      orgId = orgId || value.organization_id || value.consultation?.organization_id || null;
      facilityId = facilityId || value.facility_id || value.consultation?.facility_id || null;

      if (!orgId) {
        skipped.push({ index: idx, reason: "Unable to resolve organization_id" });
        continue;
      }

      prepared.push({
        prescription: {
          ...value,
          doctor_id: value.doctor_id || req.user.employee_id || null,
          organization_id: orgId,
          facility_id: facilityId,
          created_by_id: req.user?.id || null,
        },
        items: value.items,
      });
    }

    const createdPrescriptions = [];
    for (const entry of prepared) {
      const prescription = await Prescription.create(entry.prescription, { transaction: t });

      const items = entry.items.map((it) => ({
        prescription_id: prescription.id,
        medication_id: it.medication_id,
        billable_item_id: it.billable_item_id,
        dosage: it.dosage,
        route: it.route,
        duration: it.duration,
        quantity: it.quantity,
        dispensed_qty: 0,
        instructions: it.instructions,
        organization_id: prescription.organization_id,
        facility_id: prescription.facility_id,
        created_by_id: req.user?.id || null,
        status: ITEM_STATUS_MAP[prescription.status] || PIS.DRAFT,
      }));
      await PrescriptionItem.bulkCreate(items, { transaction: t });

      // 💵 Billing Hook
      try {
        if (shouldTriggerBilling(MODULE_KEY, prescription.status)) {
          await billingService.triggerAutoBilling({
            module: MODULE_KEY,
            entity: prescription,
            user: req.user,
            transaction: t,
          });
        }
      } catch (billErr) {
        console.warn("⚠️ Billing service failed:", billErr);
      }

      createdPrescriptions.push(prescription);
    }

    await t.commit();

    const full = createdPrescriptions.length
      ? await Prescription.findAll({
          where: { id: { [Op.in]: createdPrescriptions.map((c) => c.id) } },
          include: PRESCRIPTION_INCLUDES,
        })
      : [];

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: payloads.length > 1 ? "bulk_create" : "create",
      details: { saved: createdPrescriptions.length, skipped: skipped.length },
    });

    return success(res, {
      message: `✅ ${createdPrescriptions.length} created, ⚠️ ${skipped.length} skipped`,
      records: full,
      skipped,
    });
  } catch (err) {
    console.error("❌ createPrescriptions error:", err);
    if (t && !t.finished) await t.rollback();
    return error(res, "❌ Failed to create prescription(s)", err);
  }
};

/* ============================================================
   📌 UPDATE PRESCRIPTION (Enterprise-Aligned)
============================================================ */
export const updatePrescription = async (req, res) => {
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
    const schema = buildPrescriptionSchema(role, "update");
    const { error: validationError, value } = schema.validate(req.body, { stripUnknown: true });
    if (validationError) {
      await t.rollback();
      return error(res, "Validation failed", validationError, 400);
    }

    let orgId = req.user.organization_id || null;
    let facilityId = req.user.facility_id || null;
    if (isSuperAdmin(req.user)) {
      orgId = value.organization_id || req.query.organization_id || orgId;
      facilityId = value.facility_id || req.query.facility_id || facilityId;
    }

    const prescription = await Prescription.findOne({
      where: { id },
      include: [{ model: PrescriptionItem, as: "items" }],
      transaction: t,
      lock: { level: t.LOCK.UPDATE, of: Prescription },
    });
    if (!prescription) {
      await t.rollback();
      return error(res, "Prescription not found", null, 404);
    }

    const currentStatus = prescription.status;
    const oldSnapshot = { ...prescription.get() };
    if ([PS.COMPLETED, PS.CANCELLED, PS.VOIDED].includes(currentStatus)) {
      await t.rollback();
      return error(res, `Cannot update Prescription in status ${currentStatus}`, null, 400);
    }

    // 🔗 Auto clinical re-link
    value._currentUser = req.user;
    await resolveClinicalLinks(value, orgId, facilityId, t);

    await prescription.update(
      {
        patient_id: value.patient_id || prescription.patient_id,
        doctor_id: value.doctor_id || prescription.doctor_id,
        department_id: value.department_id ?? prescription.department_id,
        registration_log_id: value.registration_log_id ?? prescription.registration_log_id,
        consultation_id: value.consultation_id ?? prescription.consultation_id,
        invoice_id: value.invoice_id ?? prescription.invoice_id,
        prescription_date: value.prescription_date ?? prescription.prescription_date,
        notes: value.notes ?? prescription.notes,
        is_emergency: value.is_emergency ?? prescription.is_emergency,
        status: value.status || prescription.status,
        organization_id: orgId,
        facility_id: facilityId || prescription.facility_id,
        updated_by_id: req.user?.id || null,
      },
      { transaction: t }
    );

    if (Array.isArray(value.items)) {
      const existingItems = prescription.items || [];
      const existingById = new Map(existingItems.map((e) => [e.id, e]));
      const touched = new Set();

      for (const it of value.items) {
        if (!it.billable_item_id && !it.id) continue;

        // DELETE
        if (it._delete && it.id && existingById.has(it.id)) {
          const existing = existingById.get(it.id);
          await existing.update(
            {
              status: PIS.CANCELLED,
              deleted_at: new Date(),
              deleted_by_id: req.user?.id || null,
              updated_by_id: req.user?.id || null,
            },
            { transaction: t }
          );
          await billingService.voidCharges({
            module: "prescription_item",
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
              medication_id: it.medication_id || existing.medication_id,
              billable_item_id: it.billable_item_id || existing.billable_item_id,
              dosage: it.dosage ?? existing.dosage,
              route: it.route ?? existing.route,
              duration: it.duration ?? existing.duration,
              quantity: it.quantity ?? existing.quantity,
              dispensed_qty: it.dispensed_qty ?? existing.dispensed_qty,
              instructions: it.instructions ?? existing.instructions,
              status: ITEM_STATUS_MAP[prescription.status] || existing.status,
              updated_by_id: req.user?.id || null,
            },
            { transaction: t }
          );
          touched.add(existing.id);
          continue;
        }

        // CREATE / REACTIVATE
        const dup = await PrescriptionItem.findOne({
          where: { prescription_id: prescription.id, billable_item_id: it.billable_item_id },
          transaction: t,
        });

        if (dup) {
          if ([PIS.CANCELLED, PIS.VOIDED].includes(dup.status)) {
            await dup.update(
              {
                status: ITEM_STATUS_MAP[prescription.status] || dup.status,
                dosage: it.dosage || dup.dosage,
                route: it.route || dup.route,
                duration: it.duration || dup.duration,
                quantity: it.quantity || dup.quantity,
                instructions: it.instructions || dup.instructions,
                deleted_at: null,
                deleted_by_id: null,
                updated_by_id: req.user?.id || null,
              },
              { transaction: t }
            );
            touched.add(dup.id);
          } else touched.add(dup.id);
        } else {
          const newItem = await PrescriptionItem.create(
            {
              prescription_id: prescription.id,
              medication_id: it.medication_id,
              billable_item_id: it.billable_item_id,
              dosage: it.dosage || null,
              route: it.route || null,
              duration: it.duration || null,
              quantity: it.quantity || 1,
              instructions: it.instructions || null,
              status: ITEM_STATUS_MAP[prescription.status] || PIS.DRAFT,
              organization_id: prescription.organization_id,
              facility_id: prescription.facility_id,
              created_by_id: req.user?.id || null,
            },
            { transaction: t }
          );
          touched.add(newItem.id);
        }
      }

      if (currentStatus === PS.DRAFT) {
        for (const existing of existingItems) {
          if (!touched.has(existing.id)) {
            await existing.update(
              {
                status: PIS.CANCELLED,
                deleted_at: new Date(),
                deleted_by_id: req.user?.id || null,
                updated_by_id: req.user?.id || null,
              },
              { transaction: t }
            );
            await billingService.voidCharges({
              module: "prescription_item",
              entityId: existing.id,
              user: req.user,
              transaction: t,
            });
          }
        }
      }
    }

    if (oldSnapshot.status !== prescription.status && shouldTriggerBilling(MODULE_KEY, prescription.status)) {
      await billingService.triggerAutoBilling({
        module: MODULE_KEY,
        entity: prescription,
        user: req.user,
        transaction: t,
      });
    }

    await t.commit();

    const full = await Prescription.findOne({ where: { id }, include: PRESCRIPTION_INCLUDES });

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "update",
      entityId: id,
      entity: full,
      details: { before: oldSnapshot, after: full.get() },
    });

    return success(res, "✅ Prescription updated", full);
  } catch (err) {
    console.error("❌ updatePrescription error:", err);
    if (t && !t.finished) await t.rollback();
    return error(res, "❌ Failed to update prescription", err);
  }
};

/* ============================================================
   📌 ACTIVATE PRESCRIPTION(S) (issued → dispensed/partial)
   ============================================================ */
export const activatePrescriptions = async (req, res) => {
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
      return error(res, "❌ Must provide at least one Prescription ID", null, 400);
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

    const prescriptions = await Prescription.findAll({
      where,
      include: [{ model: PrescriptionItem, as: "items" }],
      transaction: t,
      lock: { level: t.LOCK.UPDATE, of: Prescription },
    });

    if (!prescriptions.length) {
      await t.rollback();
      return error(res, "❌ No Prescriptions found", null, 404);
    }

    const updated = [], skipped = [];

    for (const prescription of prescriptions) {
      const oldStatus = prescription.status;

      if (oldStatus !== PS.ISSUED) {
        skipped.push({ id: prescription.id, reason: `Not issued (${oldStatus})` });
        continue;
      }

      // 🔹 Parent moves to DISPENSED state
      await prescription.update(
        { status: PS.DISPENSED, updated_by_id: req.user?.id || null },
        { transaction: t }
      );

      // 🔹 Items go PARTIALLY_DISPENSED (until pharmacy fulfills them)
      await PrescriptionItem.update(
        { status: PIS.PARTIALLY_DISPENSED, updated_by_id: req.user?.id },
        { where: { prescription_id: prescription.id }, transaction: t }
      );

      // 💰 Billing — still bill at activation stage
      if (shouldTriggerBilling(MODULE_KEY, PS.DISPENSED)) {
        await billingService.billPrescriptionItems({
          prescription,
          user: {
            ...req.user,
            organization_id: prescription.organization_id,
            facility_id: prescription.facility_id,
          },
          transaction: t,
        });
      }

      updated.push({ prescription, from: oldStatus, to: PS.DISPENSED });
    }

    await t.commit();

    const full = updated.length
      ? await Prescription.findAll({
          where: { id: updated.map(u => u.prescription.id) },
          include: PRESCRIPTION_INCLUDES,
        })
      : [];

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: ids.length > 1 ? "bulk_activate" : "activate",
      details: {
        updated: updated.map(u => ({ id: u.prescription.id, from: u.from, to: u.to })),
        skipped,
      },
    });

    return success(
      res,
      `✅ ${updated.length} activated (parent dispensed, items partial), ⚠️ ${skipped.length} skipped`,
      { records: full, skipped }
    );
  } catch (err) {
    await t.rollback();
    return error(res, "❌ Failed to activate/dispense prescription(s)", err);
  }
};

/* ============================================================
   📌 COMPLETE PRESCRIPTION(S) (dispensed → completed)
   ============================================================ */
export const completePrescriptions = async (req, res) => {
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
      return error(res, "❌ Must provide at least one Prescription ID", null, 400);
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

    const prescriptions = await Prescription.findAll({
      where,
      include: [{ model: PrescriptionItem, as: "items" }],
      transaction: t,
      lock: { level: t.LOCK.UPDATE, of: Prescription },
    });
    if (!prescriptions.length) {
      await t.rollback();
      return error(res, "❌ No Prescriptions found", null, 404);
    }

    const updated = [], skipped = [];

    for (const prescription of prescriptions) {
      const oldStatus = prescription.status;
      if (oldStatus !== PS.DISPENSED) {
        skipped.push({ id: prescription.id, reason: `Not dispensed (${oldStatus})` });
        continue;
      }

      await prescription.update(
        { status: PS.COMPLETED, updated_by_id: req.user?.id || null },
        { transaction: t }
      );

      // ✅ Items remain dispensed — do NOT force to completed
      await PrescriptionItem.update(
        { status: PIS.DISPENSED, updated_by_id: req.user?.id },
        { where: { prescription_id: prescription.id }, transaction: t }
      );

      if (shouldTriggerBilling(MODULE_KEY, PS.COMPLETED)) {
        await billingService.billPrescriptionItems({
          prescription,
          user: { ...req.user, organization_id: prescription.organization_id, facility_id: prescription.facility_id },
          transaction: t,
        });
      }

      updated.push({ prescription, from: oldStatus, to: PS.COMPLETED });
    }

    await t.commit();

    const full = updated.length
      ? await Prescription.findAll({
          where: { id: updated.map(r => r.prescription.id) },
          include: PRESCRIPTION_INCLUDES,
        })
      : [];

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: ids.length > 1 ? "bulk_complete" : "complete",
      details: { updated: updated.map(u => ({ id: u.prescription.id, from: u.from, to: u.to })), skipped },
    });

    return success(res, `✅ ${updated.length} completed, ⚠️ ${skipped.length} skipped`, { records: full, skipped });
  } catch (err) {
    await t.rollback();
    return error(res, "❌ Failed to complete prescription(s)", err);
  }
};


/* ============================================================
   📌 CANCEL PRESCRIPTION(S) (issued/dispensed → cancelled)
   ============================================================ */
export const cancelPrescriptions = async (req, res) => {
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
      return error(res, "❌ Must provide at least one Prescription ID", null, 400);
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

    const prescriptions = await Prescription.findAll({
      where,
      include: [{ model: PrescriptionItem, as: "items" }],
      transaction: t,
      lock: { level: t.LOCK.UPDATE, of: Prescription },
    });
    if (!prescriptions.length) return error(res, "❌ No Prescriptions found", null, 404);

    const updated = [], skipped = [];

    for (const prescription of prescriptions) {
      const oldStatus = prescription.status;
      if (![PS.ISSUED, PS.DISPENSED].includes(oldStatus)) {
        skipped.push({ id: prescription.id, reason: `Not cancellable (${oldStatus})` });
        continue;
      }

      await prescription.update(
        { status: PS.CANCELLED, updated_by_id: req.user?.id || null },
        { transaction: t }
      );

      // ✅ Items cancelled
      await PrescriptionItem.update(
        { status: PIS.CANCELLED, updated_by_id: req.user?.id },
        {
          where: {
            prescription_id: prescription.id,
            status: { [Op.notIn]: [PIS.VOIDED, PIS.CANCELLED] },
          },
          transaction: t,
        }
      );

      // Void billing for each item
      for (const item of prescription.items || []) {
        await billingService.voidCharges({
          module: "prescription_item",
          entityId: item.id,
          user: { ...req.user, organization_id: prescription.organization_id, facility_id: prescription.facility_id },
          transaction: t,
        });
      }

      updated.push({ prescription, from: oldStatus, to: PS.CANCELLED });
    }

    await t.commit();

    const full = updated.length
      ? await Prescription.findAll({
          where: { id: updated.map(u => u.prescription.id) },
          include: PRESCRIPTION_INCLUDES,
        })
      : [];

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: ids.length > 1 ? "bulk_cancel" : "cancel",
      details: { updated: updated.map(u => ({ id: u.prescription.id, from: u.from, to: u.to })), skipped },
    });

    return success(res, `✅ ${updated.length} cancelled, ⚠️ ${skipped.length} skipped`, { records: full, skipped });
  } catch (err) {
    await t.rollback();
    return error(res, "❌ Failed to cancel prescription(s)", err);
  }
};
/* ============================================================
   📌 TOGGLE PRESCRIPTION STATUS (single + bulk)
   ============================================================ */
export const togglePrescriptionStatus = async (req, res) => {
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
      return error(res, "❌ Must provide at least one Prescription ID", null, 400);
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

    const prescriptions = await Prescription.findAll({
      where,
      include: [{ model: PrescriptionItem, as: "items" }],
      transaction: t,
      lock: { level: t.LOCK.UPDATE, of: Prescription },
    });
    if (!prescriptions.length) {
      await t.rollback();
      return error(res, "❌ No Prescriptions found", null, 404);
    }

    const updated = [], skipped = [];

    for (const prescription of prescriptions) {
      const oldStatus = prescription.status;
      let newStatus = oldStatus;

      if (req.body?.status && PRESCRIPTION_STATUS.includes(req.body.status)) {
        newStatus = req.body.status;
      } else if (oldStatus === PS.ISSUED) {
        newStatus = PS.CANCELLED;
      } else if (oldStatus === PS.CANCELLED) {
        newStatus = PS.ISSUED;
      }

      if (oldStatus === newStatus) {
        skipped.push({ id: prescription.id, reason: "No status change" });
        continue;
      }

      await prescription.update(
        { status: newStatus, updated_by_id: req.user?.id || null },
        { transaction: t }
      );

      // ✅ Cascade items safely
      if (newStatus === PS.CANCELLED) {
        await PrescriptionItem.update(
          { status: PIS.CANCELLED, updated_by_id: req.user?.id },
          { where: { prescription_id: prescription.id, status: { [Op.notIn]: [PIS.VOIDED, PIS.CANCELLED] } }, transaction: t }
        );

        for (const item of prescription.items || []) {
          await billingService.voidCharges({
            module: "prescription_item",
            entityId: item.id,
            user: { ...req.user, organization_id: prescription.organization_id, facility_id: prescription.facility_id },
            transaction: t,
          });
        }
      } else if (newStatus === PS.ISSUED) {
        await PrescriptionItem.update(
          { status: PIS.ISSUED, updated_by_id: req.user?.id },
          { where: { prescription_id: prescription.id }, transaction: t }
        );
      }

      // billing trigger
      if (shouldTriggerBilling(MODULE_KEY, newStatus)) {
        await billingService.triggerAutoBilling({
          module: MODULE_KEY,
          entity: prescription,
          user: { ...req.user, organization_id: prescription.organization_id, facility_id: prescription.facility_id },
          transaction: t,
        });
      }

      updated.push({ prescription, from: oldStatus, to: newStatus });
    }

    await t.commit();

    const full = updated.length
      ? await Prescription.findAll({ where: { id: updated.map(u => u.prescription.id) }, include: PRESCRIPTION_INCLUDES })
      : [];

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: ids.length > 1 ? "bulk_toggle_status" : "toggle_status",
      details: { updated: updated.map(u => ({ id: u.prescription.id, from: u.from, to: u.to })), skipped },
    });

    return success(res, `✅ ${updated.length} toggled, ⚠️ ${skipped.length} skipped`, { records: full, skipped });
  } catch (err) {
    if (t) await t.rollback();
    return error(res, "❌ Failed to toggle prescription status", err);
  }
};


/* ============================================================
   📌 SUBMIT PRESCRIPTION(S) (draft → issued)
   Enterprise-Aligned: Duplicate-aware, status-safe, item-specific
============================================================ */
export const submitPrescriptions = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    // 🔐 Permission check
    const allowed = await authzService.checkPermission({
      user: req.user,
      module: MODULE_KEY,
      action: "update",
      res,
    });
    if (!allowed) return;

    // 🔹 Collect IDs
    const ids = Array.isArray(req.body?.ids) ? req.body.ids : [req.params.id];
    if (!ids?.length) {
      await t.rollback();
      return error(res, "❌ Must provide at least one Prescription ID", null, 400);
    }

    // 🔹 Role/org/facility scope
    const role = (req.user?.roleNames?.[0] || "staff").toLowerCase();
    const where = { id: { [Op.in]: ids } };
    if (!isSuperAdmin(req.user)) {
      where.organization_id = req.user.organization_id;
      if (role === "facilityhead") where.facility_id = req.user.facility_id;
    } else {
      if (req.query.organization_id) where.organization_id = req.query.organization_id;
      if (req.query.facility_id) where.facility_id = req.query.facility_id;
    }

    // 🔒 Lock prescriptions
    const prescriptions = await Prescription.findAll({
      where,
      include: [{ model: PrescriptionItem, as: "items" }],
      transaction: t,
      lock: { level: t.LOCK.UPDATE, of: Prescription },
    });
    if (!prescriptions.length) {
      await t.rollback();
      return error(res, "❌ No Prescriptions found", null, 404);
    }

    const updated = [];
    const skipped = [];

    for (const prescription of prescriptions) {
      const oldStatus = prescription.status;

      // 🚫 Only draft can be submitted
      if (oldStatus !== PS.DRAFT) {
        skipped.push({ id: prescription.id, reason: `Not in draft (${oldStatus})` });
        continue;
      }

      /* ============================================================
         🧠 Smarter Duplicate Check (Enterprise-Aligned)
         - Allows voided, cancelled, soft-deleted
         - Blocks only active (issued → verified)
         - Considers same patient, date, and overlapping items
      ============================================================ */
      const existingSameItem = await Prescription.findOne({
        where: {
          organization_id: prescription.organization_id,
          facility_id: prescription.facility_id,
          patient_id: prescription.patient_id,
          prescription_date: prescription.prescription_date,
          id: { [Op.ne]: prescription.id },
          status: {
            [Op.in]: [PS.ISSUED, PS.DISPENSED, PS.COMPLETED, PS.VERIFIED],
          },
        },
        include: [
          {
            model: PrescriptionItem,
            as: "items",
            where: {
              medication_id: { [Op.in]: prescription.items.map(i => i.medication_id) },
              status: { [Op.notIn]: [PIS.CANCELLED, PIS.VOIDED] },
            },
            required: true,
          },
        ],
        transaction: t,
        paranoid: false,
      });

      if (existingSameItem) {
        skipped.push({
          id: prescription.id,
          reason: "Duplicate active prescription for same medication(s) on same date",
        });
        continue;
      }

      // ✅ Update parent prescription
      await prescription.update(
        { status: PS.ISSUED, updated_by_id: req.user?.id || null },
        { transaction: t }
      );

      // ✅ Activate child items
      await PrescriptionItem.update(
        { status: PIS.ISSUED, updated_by_id: req.user?.id },
        { where: { prescription_id: prescription.id }, transaction: t }
      );

      // ⚡ Auto-billing
      if (shouldTriggerBilling(MODULE_KEY, PS.ISSUED)) {
        await billingService.billPrescriptionItems({
          prescription,
          user: {
            ...req.user,
            organization_id: prescription.organization_id,
            facility_id: prescription.facility_id,
          },
          transaction: t,
        });
      }

      updated.push({ prescription, from: oldStatus, to: PS.ISSUED });
    }

    // 🚨 No updates
    if (!updated.length) {
      await t.rollback();
      return error(res, "⚠️ No prescriptions submitted", { skipped }, 409);
    }

    await t.commit();

    // 🔄 Reload updated prescriptions
    const full = await Prescription.findAll({
      where: { id: updated.map(u => u.prescription.id) },
      include: PRESCRIPTION_INCLUDES,
    });

    // 🧾 Audit trail
    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: ids.length > 1 ? "bulk_submit" : "submit",
      details: {
        updated: updated.map(u => ({
          id: u.prescription.id,
          from: u.from,
          to: u.to,
        })),
        skipped,
      },
    });

    // ✅ Response
    return success(
      res,
      `✅ ${updated.length} submitted${skipped.length ? `, ⚠️ ${skipped.length} skipped` : ""}`,
      { records: full, skipped }
    );
  } catch (err) {
    if (t && !t.finished) await t.rollback();
    return error(res, "❌ Failed to submit prescription(s)", err);
  }
};


/* ============================================================
   📌 DELETE PRESCRIPTION(S) (Soft Delete + Cascade Items + Rollback Billing)
   ============================================================ */
export const deletePrescriptions = async (req, res) => {
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
      return error(res, "❌ Must provide at least one Prescription ID", null, 400);
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

    const prescriptions = await Prescription.findAll({
      where,
      include: [{ model: PrescriptionItem, as: "items" }],
      transaction: t,
      lock: { level: t.LOCK.UPDATE, of: Prescription }
    });
    if (!prescriptions.length) {
      await t.rollback();
      return error(res, "❌ No Prescriptions found", null, 404);
    }

    const deleted = [], skipped = [];

    for (const prescription of prescriptions) {
      // ⛔ Block deletion if already completed
      if ([PS.COMPLETED].includes(prescription.status)) {
        skipped.push({ id: prescription.id, reason: "Completed prescriptions cannot be deleted" });
        continue;
      }

      // Void billing for each item
      for (const item of prescription.items || []) {
        await billingService.voidCharges({
          module: "prescription_item",
          entityId: item.id,
          user: { ...req.user, organization_id: prescription.organization_id, facility_id: prescription.facility_id },
          transaction: t,
        });
      }

      // Mark items as cancelled
      await PrescriptionItem.update(
        {
          status: PIS.CANCELLED,
          updated_by_id: req.user?.id,
          deleted_by_id: req.user?.id,
          deleted_at: new Date(),
        },
        {
          where: {
            prescription_id: prescription.id,
            status: { [Op.notIn]: [PIS.VOIDED, PIS.CANCELLED] }
          },
          transaction: t,
        }
      );

      // Soft delete parent prescription
      await prescription.update({ deleted_by_id: req.user?.id }, { transaction: t });
      await prescription.destroy({ transaction: t });
      deleted.push(prescription);
    }

    await t.commit();

    const full = deleted.length
      ? await Prescription.findAll({
          where: { id: deleted.map(r => r.id) },
          include: PRESCRIPTION_INCLUDES,
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
    return error(res, "❌ Failed to delete prescription(s)", err);
  }
};
/* ============================================================
   📌 VOID PRESCRIPTION(S) (any → voided)
   ============================================================ */
export const voidPrescriptions = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module: MODULE_KEY,
      action: "delete", // treat as destructive
      res,
    });
    if (!allowed) return;

    const ids = Array.isArray(req.body?.ids) ? req.body.ids : [req.params.id];
    if (!ids?.length) {
      await t.rollback();
      return error(res, "❌ Must provide at least one Prescription ID", null, 400);
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

    const prescriptions = await Prescription.findAll({
      where,
      include: [{ model: PrescriptionItem, as: "items" }],
      transaction: t,
      lock: { level: t.LOCK.UPDATE, of: Prescription },
    });
    if (!prescriptions.length) {
      await t.rollback();
      return error(res, "❌ No Prescriptions found", null, 404);
    }

    const updated = [];
    for (const prescription of prescriptions) {
      const oldStatus = prescription.status;

      await prescription.update(
        { status: PS.VOIDED, updated_by_id: req.user?.id || null },
        { transaction: t }
      );

      // ✅ Child items = voided
      await PrescriptionItem.update(
        {
          status: PIS.VOIDED,
          updated_by_id: req.user?.id,
          deleted_by_id: req.user?.id,
          deleted_at: new Date(),
        },
        { where: { prescription_id: prescription.id }, transaction: t }
      );

      // Void billing
      for (const item of prescription.items || []) {
        await billingService.voidCharges({
          module: "prescription_item",
          entityId: item.id,
          user: { ...req.user, organization_id: prescription.organization_id, facility_id: prescription.facility_id },
          transaction: t,
        });
      }

      updated.push({ id: prescription.id, from: oldStatus, to: PS.VOIDED });
    }

    await t.commit();

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: ids.length > 1 ? "bulk_void" : "void",
      details: { updated },
    });

    return success(res, `✅ ${updated.length} voided`, { updated });
  } catch (err) {
    if (t && !t.finished) await t.rollback();
    return error(res, "❌ Failed to void prescription(s)", err);
  }
};


/* ============================================================
   📌 VERIFY PRESCRIPTION(S) (completed → verified)
   ============================================================ */
export const verifyPrescriptions = async (req, res) => {
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
      return error(res, "❌ Must provide at least one Prescription ID", null, 400);
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

    const prescriptions = await Prescription.findAll({
      where,
      include: [{ model: PrescriptionItem, as: "items" }],
      transaction: t,
      lock: { level: t.LOCK.UPDATE, of: Prescription },
    });
    if (!prescriptions.length) {
      await t.rollback();
      return error(res, "❌ No Prescriptions found", null, 404);
    }

    const updated = [], skipped = [];
    for (const prescription of prescriptions) {
      const oldStatus = prescription.status;

      if (oldStatus !== PS.COMPLETED) {
        skipped.push({ id: prescription.id, reason: `Not completed (${oldStatus})` });
        continue;
      }

      await prescription.update(
        { status: PS.VERIFIED, updated_by_id: req.user?.id || null },
        { transaction: t }
      );

      // ✅ Keep child items at dispensed
      await PrescriptionItem.update(
        { status: PIS.DISPENSED, updated_by_id: req.user?.id },
        { where: { prescription_id: prescription.id }, transaction: t }
      );

      updated.push({ id: prescription.id, from: oldStatus, to: PS.VERIFIED });
    }

    await t.commit();

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: ids.length > 1 ? "bulk_verify" : "verify",
      details: { updated, skipped },
    });

    return success(res, `✅ ${updated.length} verified, ⚠️ ${skipped.length} skipped`, { updated, skipped });
  } catch (err) {
    if (t && !t.finished) await t.rollback();
    return error(res, "❌ Failed to verify prescription(s)", err);
  }
};

/* ============================================================
   📌 RESTORE PRESCRIPTION (soft delete rollback)
   ============================================================ */
export const restorePrescription = async (req, res) => {
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

    // 🔒 Tenant scoping
    const where = { id };
    if (!isSuperAdmin(req.user)) {
      where.organization_id = req.user.organization_id;
      if (role === "facilityhead") where.facility_id = req.user.facility_id;
    } else {
      if (req.query.organization_id) where.organization_id = req.query.organization_id;
      if (req.query.facility_id) where.facility_id = req.query.facility_id;
    }

    // 🔎 Find soft-deleted prescription
    const prescription = await Prescription.findOne({
      where,
      include: [{ model: PrescriptionItem, as: "items", paranoid: false }],
      transaction: t,
      paranoid: false, // include soft-deleted
      lock: { level: t.LOCK.UPDATE, of: Prescription },
    });

    if (!prescription || !prescription.deleted_at) {
      await t.rollback();
      return error(res, "❌ Prescription not found or not deleted", null, 404);
    }

    // ♻️ Restore parent
    await prescription.restore({ transaction: t });
    await prescription.update(
      { deleted_at: null, deleted_by_id: null, updated_by_id: req.user?.id || null },
      { transaction: t }
    );

    // ♻️ Restore items (soft delete rollback)
    await PrescriptionItem.restore({
      where: { prescription_id: id },
      transaction: t,
    });

    // ✅ Use centralized ITEM_STATUS_MAP
    const itemStatus = ITEM_STATUS_MAP[prescription.status] || PIS.DRAFT;

    await PrescriptionItem.update(
      {
        status: itemStatus,
        deleted_at: null,
        deleted_by_id: null,
        updated_by_id: req.user?.id || null,
      },
      { where: { prescription_id: id }, transaction: t }
    );

    await t.commit();

    const full = await Prescription.findOne({
      where: { id },
      include: PRESCRIPTION_INCLUDES,
    });

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "restore",
      entityId: id,
      entity: full,
    });

    return success(res, "✅ Prescription restored", full);
  } catch (err) {
    if (t && !t.finished) await t.rollback();
    return error(res, "❌ Failed to restore prescription", err);
  }
};

/* ============================================================
   📌 GET PRESCRIPTION BY ID
   ============================================================ */
export const getPrescriptionById = async (req, res) => {
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

    const prescription = await Prescription.findOne({
      where,
      attributes: { include: ["prescription_date", "fulfilled_by_id", "fulfilled_at"] }, // ✅ include new fields
      include: PRESCRIPTION_INCLUDES,
    });

    if (!prescription) return error(res, "❌ Prescription not found", null, 404);

    // 🏷️ Build friendly label
    const meds = (prescription.items || [])
      .map(it => it.billableItem?.name)
      .filter(Boolean)
      .join(", ");

    const patientLabel = prescription.patient
      ? `${prescription.patient.pat_no} - ${prescription.patient.first_name} ${prescription.patient.last_name}`
      : "Unknown Patient";

    const doctorLabel = prescription.doctor
      ? `Dr. ${prescription.doctor.first_name} ${prescription.doctor.last_name}`
      : "No Doctor";

    const dateLabel = prescription.prescription_date
      ? new Date(prescription.prescription_date).toLocaleDateString("en-US", {
          month: "short", day: "numeric", year: "numeric",
        })
      : "Unknown Date";

    const withLabel = {
      ...prescription.get({ plain: true }),
      label: `${dateLabel} · ${patientLabel} · ${meds || "No meds"} · ${prescription.status}`,
      patient_label: patientLabel,
      doctor_label: doctorLabel,
    };

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "view",
      entityId: id,
      entity: withLabel,
    });

    return success(res, "✅ Prescription loaded", withLabel);
  } catch (err) {
    return error(res, "❌ Failed to load prescription", err);
  }
};


/* ============================================================
   📌 GET ALL PRESCRIPTIONS
   ============================================================ */
export const getAllPrescriptions = async (req, res) => {
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
      FIELD_VISIBILITY_PRESCRIPTION[role] || FIELD_VISIBILITY_PRESCRIPTION.staff;

    const options = buildQueryOptions(req, "prescription_date", "DESC", visibleFields);
    options.where = options.where || {};

    if (!isSuperAdmin(req.user)) {
      options.where.organization_id = req.user.organization_id;
      if (role === "facilityhead") options.where.facility_id = req.user.facility_id;
    } else {
      if (req.query.organization_id) options.where.organization_id = req.query.organization_id;
      if (req.query.facility_id) options.where.facility_id = req.query.facility_id;
    }

    if (options.search) {
      options.where[Op.or] = [{ notes: { [Op.iLike]: `%${options.search}%` } }];
    }

    const liteMode = req.query.lite === "true";

    const { count, rows } = await Prescription.findAndCountAll({
      where: options.where,
      distinct: true,
      attributes: { include: ["prescription_date", "fulfilled_by_id", "fulfilled_at"] }, // ✅ include
      include: liteMode ? [] : [...PRESCRIPTION_INCLUDES, ...(options.include || [])],
      order: options.order,
      offset: options.offset,
      limit: Math.min(options.limit, 50),
    });

    const result = rows.map(p => {
      const meds = (p.items || [])
        .map(it => it.billableItem?.name)
        .filter(Boolean)
        .join(", ");

      const patientLabel = p.patient
        ? `${p.patient.pat_no} - ${p.patient.first_name} ${p.patient.last_name}`
        : "Unknown Patient";

      const doctorLabel = p.doctor
        ? `Dr. ${p.doctor.first_name} ${p.doctor.last_name}`
        : "No Doctor";

      const dateLabel = p.prescription_date
        ? new Date(p.prescription_date).toLocaleDateString("en-US", {
            month: "short", day: "numeric", year: "numeric",
          })
        : "Unknown Date";

      return {
        ...p.get({ plain: true }),
        label: `${dateLabel} · ${patientLabel} · ${meds || "No meds"} · ${p.status}`,
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

    return success(res, "✅ Prescriptions loaded", {
      records: result,
      pagination: {
        total: count,
        page: options.pagination.page,
        pageCount: Math.ceil(count / options.pagination.limit),
      },
    });
  } catch (err) {
    return error(res, "❌ Failed to load prescriptions", err);
  }
};


/* ============================================================
   📌 GET ALL PRESCRIPTIONS LITE (for dropdowns)
============================================================ */
export const getAllPrescriptionsLite = async (req, res) => {
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module: MODULE_KEY,
      action: "read",
      res,
    });
    if (!allowed) return;

    const { patient_id, facility_id, organization_id, status } = req.query;
    const where = {};
    if (patient_id) where.patient_id = patient_id;
    if (facility_id) where.facility_id = facility_id;
    if (organization_id) where.organization_id = organization_id;
    if (status) {
    if (status === "open") {
        // allow still-actionable prescriptions
        where.status = { [Op.in]: ["issued", "partially_dispensed"] };
      } else if (Array.isArray(status)) {
        where.status = { [Op.in]: status };
      } else {
        where.status = status;
      }
    }

    const items = await Prescription.findAll({
      where,
      attributes: [
        "id",
        "patient_id",
        "doctor_id",
        "status",
        "notes",
        "is_emergency",
        "prescription_date",
        "fulfilled_by_id",
        "fulfilled_at",
      ],
      include: [
        { model: Patient, as: "patient", attributes: ["id", "pat_no", "first_name", "last_name"] },
        { model: Employee, as: "doctor", attributes: ["id", "first_name", "last_name"] },
        {
          model: PrescriptionItem,
          as: "items",
          attributes: ["id", "quantity", "dispensed_qty"],
          include: [{ model: BillableItem, as: "billableItem", attributes: ["id", "name"] }],
        },
      ],
      order: [["created_at", "DESC"]],
    });

    const result = items.map((p) => {
      const meds = (p.items || [])
        .map((it) => it.billableItem?.name)
        .filter(Boolean)
        .join(", ");

      const patientLabel = p.patient
        ? `${p.patient.pat_no} - ${p.patient.first_name} ${p.patient.last_name}`
        : "Unknown Patient";

      const doctorLabel = p.doctor
        ? `Dr. ${p.doctor.first_name} ${p.doctor.last_name}`
        : "No Doctor";

      const dateLabel = p.prescription_date
        ? new Date(p.prescription_date).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          })
        : "Unknown Date";

      return {
        id: p.id,
        patient_id: p.patient_id,
        doctor_id: p.doctor_id,
        prescription_date: p.prescription_date,
        status: p.status,
        is_emergency: p.is_emergency,
        notes: p.notes,
        fulfilled_by_id: p.fulfilled_by_id,
        fulfilled_at: p.fulfilled_at,
        // ✅ Friendly label
        label: `${dateLabel} · ${patientLabel} · ${meds || "No meds"} · ${p.status.toLowerCase()}`,
        display_name: `RX-${String(p.id).slice(0, 8)} | ${meds || p.notes || "No meds"} | ${dateLabel}`,
      };
    });

    return success(res, "✅ Prescriptions loaded (lite)", { records: result });
  } catch (err) {
    return error(res, "❌ Failed to load prescriptions (lite)", err);
  }
};

/* ============================================================
   📌 GET ALL PRESCRIPTION ITEMS LITE (by prescription_id)
============================================================ */
export const getAllPrescriptionItemsLite = async (req, res) => {
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module: MODULE_KEY,
      action: "read",
      res,
    });
    if (!allowed) return;

    const { prescription_id, status, department_id } = req.query;
    if (!prescription_id) {
      return error(res, "❌ prescription_id is required", null, 400);
    }

    const where = { prescription_id };

    // 🔹 Handle status filter (single or comma-separated)
    if (status) {
      if (status.includes(",")) {
        where.status = { [Op.in]: status.split(",").map((s) => s.trim()) };
      } else {
        where.status = status;
      }
    }

    const items = await PrescriptionItem.findAll({
      where,
      attributes: [
        "id", "prescription_id", "billable_item_id",
        "dosage", "quantity", "dispensed_qty",
        "instructions", "status"
      ],
      include: [
        {
          model: BillableItem,
          as: "billableItem",
          attributes: ["id", "name", "price", "master_item_id"],
        },
      ],
      order: [["created_at", "ASC"]],
    });

    const result = [];
    for (const i of items) {
      let deptStocks = [];
      let stockAvailable = null;

      if (department_id && i.billableItem?.master_item_id) {
        deptStocks = await DepartmentStock.findAll({
          where: { department_id, master_item_id: i.billableItem.master_item_id },
          attributes: ["id", "quantity", "min_threshold", "max_threshold"],
          order: [["created_at", "ASC"]],
        });

        stockAvailable = deptStocks.reduce((sum, s) => sum + (s.quantity || 0), 0);
      }

      const autoDeptStockId = deptStocks.length === 1 ? deptStocks[0].id : null;

      result.push({
        prescription_item_id: i.id,
        medication_name: i.billableItem?.name || "—",
        prescribed_qty: i.quantity,
        dispensed_qty: i.dispensed_qty || 0,
        already_dispensed: i.dispensed_qty || 0,
        dosage: i.dosage,
        instructions: i.instructions || "",
        stock_available: stockAvailable,
        stocks: deptStocks.map((s) => ({
          id: s.id,
          balance: s.quantity,
          min_threshold: s.min_threshold,
          max_threshold: s.max_threshold,
        })),
        department_stock_id: autoDeptStockId,
        dispense_now: 0,
        notes: "",
        status: i.status,
        label: `${i.billableItem?.name || "Unnamed"} · ${i.quantity} units · ${i.status.toLowerCase()}`,
      });
    }

    return success(res, "✅ Prescription Items loaded (lite)", { records: result });
  } catch (err) {
    return error(res, "❌ Failed to load prescription items (lite)", err);
  }
};
