// 📁 controllers/prescriptionController.js
// ============================================================================
// 💊 Prescription Controller — ENTERPRISE MASTER–ALIGNED (Lab Request Parity)
// ----------------------------------------------------------------------------
// 🔹 NO billing constants / shouldTriggerBilling
// 🔹 NO inline role helpers
// 🔹 Uses role-utils + resolveOrgFacility
// 🔹 Billing handled ONLY via billingService (item-level)
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
  InvoiceItem,
  DepartmentStock,
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
   🔐 ROLE & ACCESS (MASTER — NO INLINE HELPERS)
============================================================ */
import {
  isSuperAdmin,
  isOrgLevelUser,
  isFacilityHead,
} from "../utils/role-utils.js";

/* ============================================================
   📜 CONSTANTS
============================================================ */
import {
  PRESCRIPTION_STATUS,
  PRESCRIPTION_ITEM_STATUS,
} from "../constants/enums.js";
import { FIELD_VISIBILITY_PRESCRIPTION } from "../constants/fieldVisibility.js";

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

const DEBUG_OVERRIDE = true;
const debug = makeModuleLogger("prescriptionController", DEBUG_OVERRIDE);

/* ============================================================
   🔐 MODULE
============================================================ */
const MODULE_KEY = "prescriptions"; // ✅ FIXED (plural — matches billing)

/* ============================================================
   🔖 STATUS MAP (ENUM-DRIVEN — MASTER)
============================================================ */
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

/* ============================================================
   🔗 PARENT → ITEM STATUS MAP (MASTER)
============================================================ */
const ITEM_STATUS_MAP = {
  [PS.DRAFT]: PIS.DRAFT,
  [PS.ISSUED]: PIS.ISSUED,
  [PS.DISPENSED]: PIS.PARTIALLY_DISPENSED, // 🔥 FIX HERE
  [PS.COMPLETED]: PIS.DISPENSED,
  [PS.CANCELLED]: PIS.CANCELLED,
  [PS.VOIDED]: PIS.VOIDED,
  [PS.VERIFIED]: PIS.DISPENSED,
};

/* ============================================================
   🔗 SHARED INCLUDES (MASTER PARITY)
============================================================ */
const PRESCRIPTION_INCLUDES = [
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
    model: PrescriptionItem,
    as: "items",
    required: false,
    where: {
      status: { [Op.notIn]: [PIS.CANCELLED, PIS.VOIDED] }, // ✅ match labRequest filtering
    },
    include: [
      {
        model: BillableItem,
        as: "billableItem",
        attributes: ["id", "name", "price"],
      },
    ],
  },
  { model: Invoice, as: "invoice", attributes: ["id", "invoice_number", "status", "total"] },
  { model: Organization, as: "organization", attributes: ["id", "name", "code"] },
  { model: Facility, as: "facility", attributes: ["id", "name", "code", "organization_id"] },
  { model: User, as: "createdBy", attributes: ["id", "first_name", "last_name"] },
  { model: User, as: "updatedBy", attributes: ["id", "first_name", "last_name"] },
  { model: User, as: "deletedBy", attributes: ["id", "first_name", "last_name"] },
];

/* ============================================================
   📋 JOI SCHEMA (MASTER-ALIGNED — TENANT SAFE)
============================================================ */
function buildPrescriptionSchema(mode = "create") {
  const base = {
    patient_id: Joi.string().uuid().required(),
    doctor_id: Joi.string().uuid().allow(null, ""),
    department_id: Joi.string().uuid().allow(null, ""),
    consultation_id: Joi.string().uuid().allow(null, ""),
    registration_log_id: Joi.string().uuid().allow(null, ""),
    invoice_id: Joi.string().uuid().allow(null, ""),

    prescription_date: Joi.date().default(() => new Date()),
    notes: Joi.string().allow("", null),
    is_emergency: Joi.boolean().default(false),

    // 🔒 lifecycle-controlled (MASTER)
    status: Joi.forbidden(),
    organization_id: Joi.forbidden(),
    facility_id: Joi.forbidden(),

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
    Object.keys(base).forEach((k) => {
      base[k] = base[k].optional();
    });

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
   📌 CREATE PRESCRIPTIONS — MASTER PARITY (NO BILLING HERE)
============================================================ */
export const createPrescriptions = async (req, res) => {
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

    debug.log("createPrescriptions → RAW BODY", req.body);

    /* ================= PAYLOAD ================= */
    const payloads = Array.isArray(req.body) ? req.body : [req.body];
    if (!payloads.length) {
      await t.rollback();
      return error(res, "Payload must not be empty", null, 400);
    }

    const createdIds = [];
    const skipped = [];

    for (const [idx, payload] of payloads.entries()) {
      const { value, errors } = validate(
        buildPrescriptionSchema("create"),
        payload
      );

      if (errors) {
        skipped.push({ index: idx, reason: "Validation failed", errors });
        continue;
      }

      /* ---------- TENANT ---------- */
      const { orgId, facilityId } = await resolveOrgFacility({
        user: req.user,
        value,
        body: payload,
      });

      /* ---------- CLINICAL LINK ---------- */
      const resolved = await resolveClinicalLinks({
        value,
        user: req.user,
        orgId,
        facilityId,
        transaction: t,
      });

      /* ---------- DOCTOR ENFORCEMENT ---------- */
      if (!isSuperAdmin(req.user) && !resolved.doctor_id) {
        resolved.doctor_id = req.user.employee_id;
      }

      if (isSuperAdmin(req.user) && !resolved.doctor_id) {
        skipped.push({ index: idx, reason: "Doctor required for superadmin" });
        continue;
      }

      if (!resolved.registration_log_id) {
        skipped.push({ index: idx, reason: "No active registration log" });
        continue;
      }

      /* ================= CREATE ================= */
      const prescription = await Prescription.create(
        {
          patient_id: resolved.patient_id,
          doctor_id: resolved.doctor_id,
          department_id: resolved.department_id,
          consultation_id: resolved.consultation_id,
          registration_log_id: resolved.registration_log_id,
          prescription_date: resolved.prescription_date
            ? new Date(resolved.prescription_date).toISOString().split("T")[0]
            : new Date().toISOString().split("T")[0],
          notes: resolved.notes,
          is_emergency: resolved.is_emergency,
          status: PS.DRAFT,
          organization_id: orgId,
          facility_id: facilityId,
          created_by_id: req.user?.id || null,
        },
        { transaction: t }
      );

      /* ---------- ITEMS ---------- */
      const items = resolved.items.map((it) => ({
        prescription_id: prescription.id,
        medication_id: it.medication_id,
        billable_item_id: it.billable_item_id,
        dosage: it.dosage,
        route: it.route,
        duration: it.duration,
        quantity: it.quantity,
        dispensed_qty: 0,
        instructions: it.instructions,
        organization_id: orgId,
        facility_id: facilityId,
        created_by_id: req.user?.id || null,
        status: PIS.DRAFT,
      }));

      await PrescriptionItem.bulkCreate(items, {
        transaction: t,
        validate: true,
      });

      createdIds.push(prescription.id);
    }

    await t.commit();

    const records = createdIds.length
      ? await Prescription.findAll({
          where: { id: { [Op.in]: createdIds } },
          include: PRESCRIPTION_INCLUDES,
        })
      : [];

    await auditService.logAction({
      user: req.user,
      module_key: MODULE_KEY,
      action: createdIds.length > 1 ? "bulk_create" : "create",
      details: { created: createdIds.length, skipped: skipped.length },
    });

    return success(res, "✅ Prescriptions created", { records, skipped });
  } catch (err) {
    await t.rollback();
    debug.error("createPrescriptions → FAILED", err);
    return error(res, "❌ Failed to create prescriptions", err);
  }
};
/* ============================================================
   📌 UPDATE PRESCRIPTION — MASTER PARITY (FIXED LOCK ISSUE)
============================================================ */
export const updatePrescription = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module_key: MODULE_KEY,
      action: "update",
      res,
    });
    if (!allowed) return;

    debug.log("updatePrescription → RAW BODY", req.body);

    const { value, errors } = validate(
      buildPrescriptionSchema("update"),
      req.body
    );

    if (errors) {
      await t.rollback();
      return error(res, "Validation failed", errors, 400);
    }

    /* ================= TENANT ================= */
    const { orgId, facilityId } = await resolveOrgFacility({
      user: req.user,
      body: value,
    });

    /* ================= LOCK PARENT ONLY ================= */
    const record = await Prescription.findOne({
      where: {
        id: req.params.id,
        organization_id: orgId,
        ...(facilityId ? { facility_id: facilityId } : {}),
      },
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    if (!record) {
      await t.rollback();
      return error(res, "Prescription not found", null, 404);
    }

    /* ================= LOAD ITEMS SEPARATELY ================= */
    const existingItems = await PrescriptionItem.findAll({
      where: { prescription_id: record.id },
      transaction: t,
    });

    if (
      [PS.COMPLETED, PS.CANCELLED, PS.VOIDED, PS.VERIFIED].includes(
        record.status
      )
    ) {
      await t.rollback();
      return error(res, "Finalized prescription cannot be edited", null, 400);
    }

    /* ================= UPDATE ================= */
    const updatePayload = {
      updated_by_id: req.user?.id || null,
    };

    [
      "patient_id",
      "doctor_id",
      "department_id",
      "consultation_id",
      "registration_log_id",
      "notes",
      "is_emergency",
    ].forEach((f) => {
      if (value[f] !== undefined) updatePayload[f] = value[f];
    });

    if (value.prescription_date) {
      updatePayload.prescription_date =
        new Date(value.prescription_date).toISOString().split("T")[0];
    }

    await record.update(updatePayload, { transaction: t });

    /* ================= ITEMS SYNC ================= */
    if (Array.isArray(value.items)) {
      const existingMap = new Map(
        existingItems.map((i) => [i.billable_item_id, i])
      );

      const incoming = new Set();

      for (const it of value.items) {
        incoming.add(it.billable_item_id);

        const existing = existingMap.get(it.billable_item_id);

        if (existing) {
          if (it._delete) {
            await existing.update(
              {
                status: PIS.CANCELLED,
                deleted_by_id: req.user?.id,
                updated_by_id: req.user?.id,
              },
              { transaction: t }
            );

            await billingService.voidCharges({
              module_key: MODULE_KEY,
              entityId: existing.id,
              user: req.user,
              transaction: t,
            });

            continue;
          }

          await existing.update(
            {
              dosage: it.dosage ?? existing.dosage,
              quantity: it.quantity ?? existing.quantity,
              instructions: it.instructions ?? existing.instructions,
              updated_by_id: req.user?.id,
            },
            { transaction: t }
          );

          continue;
        }

        if (!it._delete) {
          await PrescriptionItem.create(
            {
              prescription_id: record.id,
              billable_item_id: it.billable_item_id,
              quantity: it.quantity || 1,
              status: ITEM_STATUS_MAP[record.status] || PIS.DRAFT,
              organization_id: record.organization_id,
              facility_id: record.facility_id,
              created_by_id: req.user?.id,
            },
            { transaction: t }
          );
        }
      }

      /* REMOVE MISSING */
      for (const existing of existingItems) {
        if (!incoming.has(existing.billable_item_id)) {
          await existing.update(
            {
              status: PIS.CANCELLED,
              deleted_by_id: req.user?.id,
            },
            { transaction: t }
          );

          await billingService.voidCharges({
            module_key: MODULE_KEY,
            entityId: existing.id,
            user: req.user,
            transaction: t,
          });
        }
      }
    }

    await t.commit();

    const full = await Prescription.findOne({
      where: { id: record.id },
      include: PRESCRIPTION_INCLUDES,
    });

    await auditService.logAction({
      user: req.user,
      module_key: MODULE_KEY,
      action: "update",
      entityId: record.id,
      entity: full,
    });

    return success(res, "✅ Prescription updated", full);
  } catch (err) {
    await t.rollback();
    debug.error("updatePrescription → FAILED", err);
    return error(res, "❌ Failed to update prescription", err);
  }
};

/* ============================================================
   📌 ACTIVATE PRESCRIPTIONS — MASTER SAFE (NO JOIN LOCK)
============================================================ */
export const activatePrescriptions = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module_key: MODULE_KEY,
      action: "update",
      res,
    });
    if (!allowed) return;

    const ids = Array.isArray(req.body?.ids)
      ? req.body.ids
      : [req.params.id];

    if (!ids.length) {
      await t.rollback();
      return error(res, "No prescription IDs provided", null, 400);
    }

    const { orgId, facilityId } = await resolveOrgFacility({
      user: req.user,
      query: req.query,
    });

    /* ================= LOCK PARENT ONLY ================= */
    const records = await Prescription.findAll({
      where: {
        id: { [Op.in]: ids },
        organization_id: orgId,
        ...(facilityId ? { facility_id: facilityId } : {}),
        status: PS.ISSUED,
      },
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    if (!records.length) {
      await t.rollback();
      return error(res, "No issued prescriptions found", null, 404);
    }

    /* ================= LOAD ITEMS ================= */
    const recordIds = records.map(r => r.id);

    const items = await PrescriptionItem.findAll({
      where: {
        prescription_id: { [Op.in]: recordIds },
        status: { [Op.notIn]: [PIS.CANCELLED, PIS.VOIDED] },
      },
      include: [
        {
          model: BillableItem,
          as: "billableItem",
          attributes: ["id", "name", "master_item_id"],
        },
      ],
      transaction: t,
    });

    /* ================= GROUP ITEMS ================= */
    const itemsMap = new Map();
    for (const item of items) {
      if (!itemsMap.has(item.prescription_id)) {
        itemsMap.set(item.prescription_id, []);
      }
      itemsMap.get(item.prescription_id).push(item);
    }

    for (const r of records) {
      r.setDataValue("items", itemsMap.get(r.id) || []);
    }

    /* ================= STOCK VALIDATION ================= */
    for (const r of records) {
      for (const item of r.items || []) {
        const masterItemId = item.billableItem?.master_item_id;
        if (!masterItemId) continue;

        const stock = await DepartmentStock.findOne({
          where: {
            department_id: r.department_id,
            master_item_id: masterItemId,
          },
          transaction: t,
          lock: t.LOCK.UPDATE,
        });

        if (!stock) {
          await t.rollback();
          return error(res, `No stock found for ${item.billableItem?.name}`, null, 400);
        }

        if ((stock.quantity || 0) < item.quantity) {
          await t.rollback();
          return error(
            res,
            `Insufficient stock for ${item.billableItem?.name}. Available: ${stock.quantity}, Required: ${item.quantity}`,
            null,
            400
          );
        }
      }
    }

    /* ================= STOCK DEDUCTION ================= */
    for (const r of records) {
      for (const item of r.items || []) {
        const masterItemId = item.billableItem?.master_item_id;
        if (!masterItemId) continue;

        const stock = await DepartmentStock.findOne({
          where: {
            department_id: r.department_id,
            master_item_id: masterItemId,
          },
          transaction: t,
          lock: t.LOCK.UPDATE,
        });

        await stock.update(
          {
            quantity: (stock.quantity || 0) - item.quantity,
            updated_by_id: req.user.id,
          },
          { transaction: t }
        );

        await item.update(
          {
            dispensed_qty: item.quantity,
            updated_by_id: req.user.id,
          },
          { transaction: t }
        );
      }
    }

    /* ================= STATUS UPDATE ================= */
    for (const r of records) {
      await r.update(
        {
          status: PS.DISPENSED,
          updated_by_id: req.user.id,
        },
        { transaction: t }
      );
    }

    await PrescriptionItem.update(
      {
        status: PIS.PARTIALLY_DISPENSED,
        updated_by_id: req.user.id,
      },
      {
        where: {
          prescription_id: { [Op.in]: recordIds },
          status: { [Op.notIn]: [PIS.CANCELLED, PIS.VOIDED] },
        },
        transaction: t,
      }
    );

    await t.commit();

    return success(res, "✅ Prescriptions activated (stock safe)");
  } catch (err) {
    await t.rollback();
    return error(res, "Failed to activate prescriptions", err);
  }
};
/* ============================================================
   📌 SUBMIT PRESCRIPTIONS — MASTER PARITY (LAB EXACT)
============================================================ */
export const submitPrescriptions = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module_key: MODULE_KEY,
      action: "update",
      res,
    });
    if (!allowed) return;

    const ids = Array.isArray(req.body?.ids)
      ? req.body.ids
      : [req.params.id];

    if (!ids.length) {
      await t.rollback();
      return error(res, "Must provide at least one Prescription ID", null, 400);
    }

    const { orgId, facilityId } = await resolveOrgFacility({
      user: req.user,
      query: req.query,
    });

    /* ================= LOCK PARENT ONLY ================= */
    const records = await Prescription.findAll({
      where: {
        id: { [Op.in]: ids },
        organization_id: orgId,
        ...(facilityId ? { facility_id: facilityId } : {}),
        status: PS.DRAFT,
      },
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    if (!records.length) {
      await t.rollback();
      return error(res, "No draft prescriptions found", null, 404);
    }

    /* ================= LOAD ITEMS ================= */
    const recordIds = records.map((r) => r.id);

    const items = await PrescriptionItem.findAll({
      where: {
        prescription_id: { [Op.in]: recordIds },
        status: { [Op.notIn]: [PIS.CANCELLED, PIS.VOIDED] },
      },
      transaction: t,
    });

    /* ================= GROUP ITEMS ================= */
    const itemsMap = new Map();
    for (const item of items) {
      if (!itemsMap.has(item.prescription_id)) {
        itemsMap.set(item.prescription_id, []);
      }
      itemsMap.get(item.prescription_id).push(item);
    }

    for (const r of records) {
      r.setDataValue("items", itemsMap.get(r.id) || []);
    }

    const updated = [];
    const skipped = [];

    for (const r of records) {
      const rItems = r.items || [];

      /* ================= DUPLICATE CHECK ================= */
      const duplicate = await Prescription.findOne({
        where: {
          organization_id: r.organization_id,
          facility_id: r.facility_id,
          patient_id: r.patient_id,
          prescription_date: r.prescription_date,
          id: { [Op.ne]: r.id },
          status: {
            [Op.in]: [PS.ISSUED, PS.DISPENSED, PS.COMPLETED, PS.VERIFIED],
          },
        },
        include: [
          {
            model: PrescriptionItem,
            as: "items",
            required: true,
            where: {
              billable_item_id: {
                [Op.in]: rItems.map((i) => i.billable_item_id),
              },
              status: { [Op.notIn]: [PIS.CANCELLED, PIS.VOIDED] },
            },
          },
        ],
        transaction: t,
      });

      if (duplicate) {
        skipped.push({ id: r.id, reason: "Duplicate active prescription" });
        continue;
      }

      /* ================= STATUS UPDATE ================= */
      await r.update(
        {
          status: PS.ISSUED,
          updated_by_id: req.user.id,
        },
        { transaction: t }
      );

      await PrescriptionItem.update(
        {
          status: PIS.ISSUED,
          updated_by_id: req.user.id,
        },
        {
          where: { prescription_id: r.id },
          transaction: t,
        }
      );

      /* ================= 🔥 BILLING (MASTER PARITY) ================= */
      await billingService.billPrescriptionItems({
        prescription: r,
        user: {
          ...req.user,
          organization_id: orgId,
          facility_id: facilityId,
        },
        transaction: t,
      });

      updated.push(r.id);
    }

    if (!updated.length) {
      await t.rollback();
      return error(res, "No prescriptions submitted", { skipped }, 409);
    }

    await t.commit();

    const full = await Prescription.findAll({
      where: { id: { [Op.in]: updated } },
      include: PRESCRIPTION_INCLUDES,
    });

    await auditService.logAction({
      user: req.user,
      module_key: MODULE_KEY,
      action: ids.length > 1 ? "bulk_submit" : "submit",
      details: { ids: updated, skipped },
    });

    return success(res, "✅ Prescriptions submitted (MASTER billing)", {
      records: full,
      skipped,
    });

  } catch (err) {
    await t.rollback();
    return error(res, "Failed to submit prescriptions", err);
  }
};
/* ============================================================
   📌 COMPLETE PRESCRIPTIONS — MASTER SAFE (NO JOIN LOCK)
============================================================ */
export const completePrescriptions = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module_key: MODULE_KEY,
      action: "update",
      res,
    });
    if (!allowed) return;

    const ids = Array.isArray(req.body?.ids)
      ? req.body.ids
      : [req.params.id];

    if (!ids.length) {
      await t.rollback();
      return error(res, "Must provide at least one Prescription ID", null, 400);
    }

    const { orgId, facilityId } = await resolveOrgFacility({
      user: req.user,
      query: req.query,
    });

    /* ================= LOCK PARENT ONLY ================= */
    const records = await Prescription.findAll({
      where: {
        id: { [Op.in]: ids },
        organization_id: orgId,
        ...(facilityId ? { facility_id: facilityId } : {}),
        status: PS.DISPENSED,
      },
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    if (!records.length) {
      await t.rollback();
      return error(res, "No dispensed prescriptions found", null, 404);
    }

    const recordIds = records.map(r => r.id);

    /* ================= STATUS UPDATE ================= */
    for (const r of records) {
      await r.update(
        {
          status: PS.COMPLETED,
          updated_by_id: req.user.id,
        },
        { transaction: t }
      );
    }

    await PrescriptionItem.update(
      {
        status: PIS.DISPENSED,
        updated_by_id: req.user.id,
      },
      {
        where: { prescription_id: { [Op.in]: recordIds } },
        transaction: t,
      }
    );

    await t.commit();

    const full = await Prescription.findAll({
      where: { id: { [Op.in]: recordIds } },
      include: PRESCRIPTION_INCLUDES,
    });

    await auditService.logAction({
      user: req.user,
      module_key: MODULE_KEY,
      action: ids.length > 1 ? "bulk_complete" : "complete",
      details: { ids: recordIds },
    });

    return success(res, "✅ Prescriptions completed", full);
  } catch (err) {
    await t.rollback();
    return error(res, "Failed to complete prescriptions", err);
  }
};

/* ============================================================
   📌 VERIFY PRESCRIPTIONS — MASTER SAFE (NO BILLING)
============================================================ */
export const verifyPrescriptions = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module_key: MODULE_KEY,
      action: "update",
      res,
    });
    if (!allowed) return;

    const ids = Array.isArray(req.body?.ids)
      ? req.body.ids
      : [req.params.id];

    if (!ids.length) {
      await t.rollback();
      return error(res, "Must provide at least one Prescription ID", null, 400);
    }

    const { orgId, facilityId } = await resolveOrgFacility({
      user: req.user,
      query: req.query,
    });

    const records = await Prescription.findAll({
      where: {
        id: { [Op.in]: ids },
        organization_id: orgId,
        ...(facilityId ? { facility_id: facilityId } : {}),
        status: PS.COMPLETED,
      },
      include: [{ model: PrescriptionItem, as: "items" }],
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    if (!records.length) {
      await t.rollback();
      return error(res, "No completed prescriptions found", null, 404);
    }

    const updated = [];

    for (const r of records) {
      await r.update(
        { status: PS.VERIFIED, updated_by_id: req.user.id },
        { transaction: t }
      );

      await PrescriptionItem.update(
        { status: PIS.DISPENSED, updated_by_id: req.user.id },
        { where: { prescription_id: r.id }, transaction: t }
      );

      updated.push(r.id);
    }

    await t.commit();

    await auditService.logAction({
      user: req.user,
      module_key: MODULE_KEY,
      action: ids.length > 1 ? "bulk_verify" : "verify",
      details: { ids: updated },
    });

    return success(res, "✅ Prescriptions verified", { ids: updated });
  } catch (err) {
    await t.rollback();
    return error(res, "Failed to verify prescriptions", err);
  }
};

/* ============================================================
   📌 TOGGLE PRESCRIPTION STATUS — MASTER SAFE
============================================================ */
export const togglePrescriptionStatus = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module_key: MODULE_KEY,
      action: "update",
      res,
    });
    if (!allowed) return;

    const { status } = req.body;
    if (!status || !PRESCRIPTION_STATUS.includes(status)) {
      await t.rollback();
      return error(res, "Invalid status", null, 400);
    }

    const { orgId, facilityId } = await resolveOrgFacility({
      user: req.user,
      query: req.query,
    });

    const record = await Prescription.findOne({
      where: {
        id: req.params.id,
        organization_id: orgId,
        ...(facilityId ? { facility_id: facilityId } : {}),
      },
      include: [{ model: PrescriptionItem, as: "items" }],
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    if (!record) {
      await t.rollback();
      return error(res, "Prescription not found", null, 404);
    }

    // 🚫 restrict illegal transitions (VERY IMPORTANT)
    const allowedTransitions = {
      [PS.DRAFT]: [PS.ISSUED],
      [PS.ISSUED]: [PS.DISPENSED, PS.CANCELLED],
      [PS.DISPENSED]: [PS.COMPLETED, PS.CANCELLED],
      [PS.COMPLETED]: [PS.VERIFIED],
    };

    if (
      allowedTransitions[record.status] &&
      !allowedTransitions[record.status].includes(status)
    ) {
      await t.rollback();
      return error(res, "Invalid status transition", null, 400);
    }

    await record.update(
      { status, updated_by_id: req.user.id },
      { transaction: t }
    );

    await PrescriptionItem.update(
      {
        status: ITEM_STATUS_MAP[status] || PIS.DRAFT,
        updated_by_id: req.user.id,
      },
      { where: { prescription_id: record.id }, transaction: t }
    );

    // 🔥 ONLY handle VOID / CANCEL billing
    if (status === PS.CANCELLED || status === PS.VOIDED) {
      for (const item of record.items || []) {
        await billingService.voidCharges({
          module_key: MODULE_KEY,
          entityId: item.id,
          user: req.user,
          transaction: t,
        });
      }
    }

    await t.commit();

    return success(res, "Status updated safely", record);
  } catch (err) {
    await t.rollback();
    return error(res, "Failed to update status", err);
  }
};

/* ============================================================
   📌 DELETE PRESCRIPTIONS — MASTER PARITY (SOFT DELETE)
============================================================ */
export const deletePrescriptions = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module_key: MODULE_KEY,
      action: "delete",
      res,
    });
    if (!allowed) return;

    const ids = Array.isArray(req.body?.ids)
      ? req.body.ids
      : [req.params.id];

    const { orgId, facilityId } = await resolveOrgFacility({
      user: req.user,
      query: req.query,
    });

    const records = await Prescription.findAll({
      where: {
        id: { [Op.in]: ids },
        organization_id: orgId,
        ...(facilityId ? { facility_id: facilityId } : {}),
      },
      include: [{ model: PrescriptionItem, as: "items" }],
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    if (!records.length) {
      await t.rollback();
      return error(res, "No prescriptions found", null, 404);
    }

    const deleted = [];
    const skipped = [];

    for (const r of records) {
      if ([PS.COMPLETED, PS.VERIFIED].includes(r.status)) {
        skipped.push({ id: r.id, reason: "Finalized prescription cannot be deleted" });
        continue;
      }

      // 🔥 VOID BILLING FIRST
      for (const item of r.items || []) {
        await billingService.voidCharges({
          module_key: MODULE_KEY,
          entityId: item.id,
          user: req.user,
          transaction: t,
        });
      }

      await PrescriptionItem.update(
        {
          status: PIS.CANCELLED,
          deleted_by_id: req.user.id,
          deleted_at: new Date(),
        },
        {
          where: {
            prescription_id: r.id,
            status: { [Op.notIn]: [PIS.CANCELLED, PIS.VOIDED] },
          },
          transaction: t,
        }
      );

      await r.update({ deleted_by_id: req.user.id }, { transaction: t });
      await r.destroy({ transaction: t });

      deleted.push(r.id);
    }

    await t.commit();

    const full = await Prescription.findAll({
      where: { id: { [Op.in]: deleted } },
      include: PRESCRIPTION_INCLUDES,
      paranoid: false,
    });

    await auditService.logAction({
      user: req.user,
      module_key: MODULE_KEY,
      action: ids.length > 1 ? "bulk_delete" : "delete",
      details: { ids: deleted, skipped },
    });

    return success(res, "✅ Prescriptions deleted", { records: full, skipped });
  } catch (err) {
    await t.rollback();
    return error(res, "Failed to delete prescriptions", err);
  }
};

/* ============================================================
   📌 CANCEL PRESCRIPTIONS — MASTER + STOCK + BILLING (FINAL)
============================================================ */
export const cancelPrescriptions = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module_key: MODULE_KEY,
      action: "update",
      res,
    });
    if (!allowed) return;

    const ids = Array.isArray(req.body?.ids)
      ? req.body.ids
      : [req.params.id];

    if (!ids.length) {
      await t.rollback();
      return error(res, "No prescription IDs provided", null, 400);
    }

    const { orgId, facilityId } = await resolveOrgFacility({
      user: req.user,
      query: req.query,
    });

    const records = await Prescription.findAll({
      where: {
        id: { [Op.in]: ids },
        organization_id: orgId,
        ...(facilityId ? { facility_id: facilityId } : {}),
        status: { [Op.in]: [PS.ISSUED, PS.DISPENSED] },
      },
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    if (!records.length) {
      await t.rollback();
      return error(res, "No cancellable prescriptions found", null, 404);
    }

    const recordIds = records.map((r) => r.id);

    /* 🔥 FIX: include soft-deleted items */
    const items = await PrescriptionItem.findAll({
      where: {
        prescription_id: { [Op.in]: recordIds },
      },
      paranoid: false, // ✅ CRITICAL FIX
      include: [
        {
          model: BillableItem,
          as: "billableItem",
          attributes: ["id", "name", "master_item_id"],
        },
      ],
      transaction: t,
    });

    const itemsMap = new Map();
    for (const item of items) {
      if (!itemsMap.has(item.prescription_id)) {
        itemsMap.set(item.prescription_id, []);
      }
      itemsMap.get(item.prescription_id).push(item);
    }

    for (const r of records) {
      const rItems = itemsMap.get(r.id) || [];

      console.log("==== CANCEL PRES DEBUG ====");
      console.log("Prescription:", r.id);
      console.log("Items count:", rItems.length);

      /* ================= STOCK REVERSAL ================= */
      for (const item of rItems) {
        const masterItemId = item.billableItem?.master_item_id;

        if (!masterItemId) continue;
        if (!item.dispensed_qty || item.dispensed_qty <= 0) continue;

        const stock = await DepartmentStock.findOne({
          where: {
            department_id: r.department_id,
            master_item_id: masterItemId,
          },
          transaction: t,
          lock: t.LOCK.UPDATE,
        });

        if (stock) {
          await stock.update(
            {
              quantity: (stock.quantity || 0) + item.dispensed_qty,
              updated_by_id: req.user.id,
            },
            { transaction: t }
          );
        }

        await item.update(
          {
            dispensed_qty: 0,
            updated_by_id: req.user.id,
          },
          { transaction: t }
        );
      }

      /* 🔥 VOID BILLING */
      for (const item of rItems) {
        console.log("VOIDING ITEM:", item.id);

        await billingService.voidCharges({
          module_key: MODULE_KEY,
          entityId: item.id,
          user: req.user,
          transaction: t,
        });
      }

      /* ================= STATUS ================= */
      await r.update(
        {
          status: PS.CANCELLED,
          updated_by_id: req.user.id,
        },
        { transaction: t }
      );

      await PrescriptionItem.update(
        {
          status: PIS.CANCELLED,
          updated_by_id: req.user.id,
        },
        {
          where: {
            prescription_id: r.id,
          },
          transaction: t,
        }
      );
    }

    await t.commit();

    return success(
      res,
      "✅ Prescriptions cancelled (stock + billing reversed correctly)"
    );
  } catch (err) {
    await t.rollback();
    return error(res, "Failed to cancel prescriptions", err);
  }
};

/* ============================================================
   📌 VOID PRESCRIPTIONS — MASTER + BILLING (FINAL)
============================================================ */
export const voidPrescriptions = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module_key: MODULE_KEY,
      action: "delete",
      res,
    });
    if (!allowed) return;

    const ids = Array.isArray(req.body?.ids)
      ? req.body.ids
      : [req.params.id];

    if (!ids.length) {
      await t.rollback();
      return error(res, "No prescription IDs provided", null, 400);
    }

    const { orgId, facilityId } = await resolveOrgFacility({
      user: req.user,
      query: req.query,
    });

    const records = await Prescription.findAll({
      where: {
        id: { [Op.in]: ids },
        organization_id: orgId,
        ...(facilityId ? { facility_id: facilityId } : {}),
      },
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    if (!records.length) {
      await t.rollback();
      return error(res, "No prescriptions found", null, 404);
    }

    const recordIds = records.map((r) => r.id);

    /* 🔥 FIX: include soft-deleted items */
    const items = await PrescriptionItem.findAll({
      where: {
        prescription_id: { [Op.in]: recordIds },
      },
      paranoid: false, // ✅ CRITICAL FIX
      transaction: t,
    });

    const itemsMap = new Map();
    for (const item of items) {
      if (!itemsMap.has(item.prescription_id)) {
        itemsMap.set(item.prescription_id, []);
      }
      itemsMap.get(item.prescription_id).push(item);
    }

    const updated = [];

    for (const r of records) {
      const rItems = itemsMap.get(r.id) || [];

      console.log("==== VOID PRES DEBUG ====");
      console.log("Prescription:", r.id);
      console.log("Items count:", rItems.length);

      /* 🔥 VOID BILLING FIRST */
      for (const item of rItems) {
        console.log("VOIDING ITEM:", item.id);

        await billingService.voidCharges({
          module_key: MODULE_KEY,
          entityId: item.id,
          user: req.user,
          transaction: t,
        });
      }

      /* ================= STATUS ================= */
      await r.update(
        {
          status: PS.VOIDED,
          updated_by_id: req.user.id,
        },
        { transaction: t }
      );

      await PrescriptionItem.update(
        {
          status: PIS.VOIDED,
          deleted_by_id: req.user.id,
          deleted_at: new Date(),
        },
        {
          where: { prescription_id: r.id },
          transaction: t,
        }
      );

      updated.push(r.id);
    }

    await t.commit();

    return success(res, "✅ Prescriptions voided (billing reversed correctly)", {
      ids: updated,
    });
  } catch (err) {
    await t.rollback();
    return error(res, "Failed to void prescriptions", err);
  }
};

/* ============================================================
   📌 RESTORE PRESCRIPTION — MASTER PARITY
============================================================ */
export const restorePrescription = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module_key: MODULE_KEY,
      action: "update",
      res,
    });
    if (!allowed) return;

    const { orgId, facilityId } = await resolveOrgFacility({
      user: req.user,
      query: req.query,
    });

    const record = await Prescription.findOne({
      where: {
        id: req.params.id,
        organization_id: orgId,
        ...(facilityId ? { facility_id: facilityId } : {}),
      },
      include: [{ model: PrescriptionItem, as: "items", paranoid: false }],
      paranoid: false,
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    if (!record || !record.deleted_at) {
      await t.rollback();
      return error(res, "Prescription not found or not deleted", null, 404);
    }

    /* ================= RESTORE ================= */
    await record.restore({ transaction: t });

    await record.update(
      {
        deleted_at: null,
        deleted_by_id: null,
        updated_by_id: req.user.id,
      },
      { transaction: t }
    );

    await PrescriptionItem.restore({
      where: { prescription_id: record.id },
      transaction: t,
    });

    const itemStatus = ITEM_STATUS_MAP[record.status] || PIS.DRAFT;

    await PrescriptionItem.update(
      {
        status: itemStatus,
        deleted_at: null,
        deleted_by_id: null,
        updated_by_id: req.user.id,
      },
      { where: { prescription_id: record.id }, transaction: t }
    );

    await t.commit();

    const full = await Prescription.findOne({
      where: { id: record.id },
      include: PRESCRIPTION_INCLUDES,
    });

    await auditService.logAction({
      user: req.user,
      module_key: MODULE_KEY,
      action: "restore",
      entityId: record.id,
      entity: full,
    });

    return success(res, "✅ Prescription restored", full);
  } catch (err) {
    await t.rollback();
    return error(res, "Failed to restore prescription", err);
  }
};

/* ============================================================
   📌 GET PRESCRIPTION BY ID — MASTER PARITY
============================================================ */
export const getPrescriptionById = async (req, res) => {
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

    const record = await Prescription.findOne({
      where: {
        id: req.params.id,
        organization_id: orgId,
        ...(facilityId ? { facility_id: facilityId } : {}),
      },
      include: PRESCRIPTION_INCLUDES,
    });

    if (!record) {
      return error(res, "Prescription not found", null, 404);
    }

    const meds = (record.items || [])
      .map((it) => it.billableItem?.name)
      .filter(Boolean)
      .join(", ");

    const patientLabel = record.patient
      ? `${record.patient.pat_no} - ${record.patient.first_name} ${record.patient.last_name}`
      : "Unknown Patient";

    const doctorLabel = record.doctor
      ? `Dr. ${record.doctor.first_name} ${record.doctor.last_name}`
      : "No Doctor";

    const dateLabel = record.prescription_date
      ? new Date(record.prescription_date).toLocaleDateString()
      : "Unknown Date";

    const result = {
      ...record.get({ plain: true }),
      label: `${dateLabel} · ${patientLabel} · ${meds || "No meds"} · ${record.status}`,
      patient_label: patientLabel,
      doctor_label: doctorLabel,
    };

    await auditService.logAction({
      user: req.user,
      module_key: MODULE_KEY,
      action: "view",
      entityId: record.id,
      entity: result,
    });

    return success(res, "✅ Prescription loaded", result);
  } catch (err) {
    return error(res, "Failed to load prescription", err);
  }
};
/* ============================================================
   📌 GET ALL PRESCRIPTIONS — MASTER PARITY
============================================================ */
export const getAllPrescriptions = async (req, res) => {
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module_key: MODULE_KEY,
      action: "read",
      res,
    });
    if (!allowed) return;

    const role = (req.user?.roleNames?.[0] || "staff").toLowerCase();
    const visibleFields =
      FIELD_VISIBILITY_PRESCRIPTION[role] ||
      FIELD_VISIBILITY_PRESCRIPTION.staff;

    /* ================= STRIP UI PARAMS ================= */
    const {
      dateRange,
      status,
      patient_id,
      doctor_id,
      department_id,
      consultation_id,
      facility_id,
      ...safeQuery
    } = req.query;

    req.query = safeQuery;

    /* ================= QUERY OPTIONS ================= */
    const options = buildQueryOptions(
      req,
      "prescription_date",
      "DESC",
      visibleFields
    );

    options.where = { [Op.and]: [] };

    /* ================= DATE RANGE ================= */
    if (dateRange) {
      const { start, end } = normalizeDateRangeLocal(dateRange);
      if (start && end) {
        options.where[Op.and].push({
          prescription_date: { [Op.between]: [start, end] },
        });
      }
    }

    /* ================= FILTERS ================= */
    if (patient_id) options.where[Op.and].push({ patient_id });
    if (doctor_id) options.where[Op.and].push({ doctor_id });
    if (department_id) options.where[Op.and].push({ department_id });
    if (consultation_id) options.where[Op.and].push({ consultation_id });

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

    /* ================= TENANT ================= */
    if (!isSuperAdmin(req.user)) {
      options.where[Op.and].push({
        organization_id: req.user.organization_id,
      });

      if (isFacilityHead(req.user)) {
        options.where[Op.and].push({
          facility_id: req.user.facility_id,
        });
      } else if (facility_id) {
        options.where[Op.and].push({ facility_id });
      }
    } else {
      if (req.query.organization_id) {
        options.where[Op.and].push({
          organization_id: req.query.organization_id,
        });
      }
      if (facility_id) {
        options.where[Op.and].push({ facility_id });
      }
    }

    const liteMode = req.query.lite === "true";

    const { count, rows } = await Prescription.findAndCountAll({
      where: options.where,
      include: liteMode ? [] : PRESCRIPTION_INCLUDES,
      order: options.order,
      offset: options.offset,
      limit: Math.min(options.limit, 50),
      distinct: true,
    });

    /* ================= LABEL BUILD ================= */
    const result = rows.map((p) => {
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
        ? new Date(p.prescription_date).toLocaleDateString()
        : "Unknown Date";

      return {
        ...p.get({ plain: true }),
        label: `${dateLabel} · ${patientLabel} · ${meds || "No meds"} · ${p.status}`,
        patient_label: patientLabel,
        doctor_label: doctorLabel,
      };
    });

    /* ================= SUMMARY (MATCH LAB REQUEST) ================= */
    const summary = { total: count };

    const statusCounts = await Prescription.findAll({
      where: options.where,
      attributes: [
        "status",
        [sequelize.fn("COUNT", sequelize.col("id")), "count"],
      ],
      group: ["status"],
    });

    PRESCRIPTION_STATUS.forEach((s) => {
      const found = statusCounts.find((r) => r.status === s);
      summary[s] = found ? Number(found.get("count")) : 0;
    });

    await auditService.logAction({
      user: req.user,
      module_key: MODULE_KEY,
      action: "list",
      details: { count },
    });

    return success(res, "✅ Prescriptions loaded", {
      records: result,
      summary,
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
   📌 GET ALL PRESCRIPTIONS LITE — MASTER PARITY
============================================================ */
export const getAllPrescriptionsLite = async (req, res) => {
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

    const where = {
      organization_id: orgId,
      ...(facilityId ? { facility_id: facilityId } : {}),
    };

    if (req.query.patient_id) where.patient_id = req.query.patient_id;

    if (req.query.status) {
      const statuses = req.query.status.includes(",")
        ? req.query.status.split(",")
        : [req.query.status];
      where.status = { [Op.in]: statuses };
    }

    const rows = await Prescription.findAll({
      where,
      attributes: [
        "id",
        "patient_id",
        "doctor_id",
        "status",
        "notes",
        "prescription_date",
      ],
      include: [
        { model: Patient, as: "patient", attributes: ["pat_no", "first_name", "last_name"] },
        { model: Employee, as: "doctor", attributes: ["first_name", "last_name"] },
      ],
      order: [["created_at", "DESC"]],
    });

    const result = rows.map((p) => {
      const patientLabel = p.patient
        ? `${p.patient.pat_no} - ${p.patient.first_name} ${p.patient.last_name}`
        : "Unknown";

      return {
        id: p.id,
        label: `${patientLabel} · ${p.status}`,
      };
    });

    return success(res, "✅ Prescriptions (lite)", { records: result });
  } catch (err) {
    return error(res, "❌ Failed to load prescriptions (lite)", err);
  }
};

/* ============================================================
   📌 GET ALL PRESCRIPTION ITEMS LITE — MASTER PARITY
============================================================ */
export const getAllPrescriptionItemsLite = async (req, res) => {
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module_key: MODULE_KEY,
      action: "read",
      res,
    });
    if (!allowed) return;

    const { prescription_id, department_id } = req.query;
    if (!prescription_id) {
      return error(res, "prescription_id is required", null, 400);
    }

    const items = await PrescriptionItem.findAll({
      where: { prescription_id },
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
      let stockAvailable = null;

      if (department_id && i.billableItem?.master_item_id) {
        const stocks = await DepartmentStock.findAll({
          where: {
            department_id,
            master_item_id: i.billableItem.master_item_id,
          },
        });

        stockAvailable = stocks.reduce((sum, s) => sum + (s.quantity || 0), 0);
      }

      result.push({
        id: i.id,
        medication: i.billableItem?.name,
        quantity: i.quantity,
        dispensed: i.dispensed_qty,
        stock_available: stockAvailable,
        status: i.status,
      });
    }

    return success(res, "✅ Prescription items (lite)", { records: result });
  } catch (err) {
    return error(res, "❌ Failed to load items", err);
  }
};