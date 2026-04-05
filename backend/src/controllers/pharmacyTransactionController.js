// 📁 controllers/pharmacyTransactionController.js
import Joi from "joi";
import { Op } from "sequelize";
import {
  sequelize,
  PharmacyTransaction,
  Patient,
  Employee,
  Department,
  Consultation,
  RegistrationLog,
  InvoiceItem,
  Organization,
  Facility,
  User,
  Prescription,
  PrescriptionItem,
} from "../models/index.js";
import { success, error } from "../utils/response.js";
import { buildQueryOptions } from "../utils/queryHelper.js";
import {
  PHARMACY_TRANSACTION_STATUS,
  PHARMACY_TRANSACTION_TYPE,
} from "../constants/enums.js";
import { authzService } from "../services/authzService.js";
import { auditService } from "../services/auditService.js";
import { pharmacyService } from "../services/pharmacyService.js";
import { buildDynamicSummary } from "../utils/summaryHelper.js";

import { billingService } from "../services/billingService.js";
import { shouldTriggerBilling } from "../constants/billing.js";

const MODULE_KEY = "pharmacy-transaction";

// 🔖 Local enum map (direct object, not index-based!)
const PS = PHARMACY_TRANSACTION_STATUS;

/* ============================================================
   🔧 HELPERS
============================================================ */
function isSuperAdmin(user) {
  if (!user) return false;
  const roles = Array.isArray(user.roleNames)
    ? user.roleNames
    : [user.role || ""];
  return roles.map((r) => r.toLowerCase()).includes("superadmin");
}

/* ============================================================
   🔗 SHARED INCLUDES
============================================================ */
const PHARMACY_TRANSACTION_INCLUDES = [
  { model: Patient, as: "patient", attributes: ["id", "pat_no", "first_name", "last_name"] },
  { model: Prescription, as: "prescription", attributes: ["id", "status"] },
  {
    model: PrescriptionItem,
    as: "prescriptionItem",
    attributes: ["id", "status", "quantity", "billable_item_id"],
    include: [
      {
        model: sequelize.models.BillableItem,
        as: "billableItem",
        attributes: ["id", "name", "price", "master_item_id"],
      },
    ],
  },
  { model: Employee, as: "doctor", attributes: ["id", "first_name", "last_name"] },
  { model: Employee, as: "fulfilledBy", attributes: ["id", "first_name", "last_name"] },
  { model: Employee, as: "voidedBy", attributes: ["id", "first_name", "last_name"] },
  { model: Department, as: "department", attributes: ["id", "name"] },
  { model: Consultation, as: "consultation", attributes: ["id", "consultation_date", "status"] },
  { model: RegistrationLog, as: "registrationLog", attributes: ["id", "registration_time", "log_status"] },
  {
    model: sequelize.models.DepartmentStock,
    as: "departmentStock",
    attributes: ["id", "quantity", "min_threshold", "max_threshold"],
  },
  {
    model: InvoiceItem,
    as: "invoiceItem",
    attributes: ["id", "unit_price", "quantity", "total_price", "net_amount", "status"],
  },
  { model: Organization, as: "organization", attributes: ["id", "name", "code"] },
  { model: Facility, as: "facility", attributes: ["id", "name", "code", "organization_id"] },
  { model: User, as: "createdBy", attributes: ["id", "first_name", "last_name"] },
  { model: User, as: "updatedBy", attributes: ["id", "first_name", "last_name"] },
  { model: User, as: "deletedBy", attributes: ["id", "first_name", "last_name"] },
];

/* ============================================================
   🔧 Helper: Resolve Live Department Stock
============================================================ */
async function getLiveDeptStock(orgId, facilityId, deptId, masterItemId) {
  if (!orgId || !facilityId || !deptId || !masterItemId) return null;

  const ds = await sequelize.models.DepartmentStock.findOne({
    where: {
      organization_id: orgId,
      facility_id: facilityId,
      department_id: deptId,
      master_item_id: masterItemId,
    },
    attributes: ["id", "quantity", "min_threshold", "max_threshold"],
  });

  return ds ? ds.get() : null;
}

/* ============================================================
   🔧 Helper: Resolve fulfilledBy safely (User → Employee fallback)
============================================================ */
async function resolveFulfilledBy(txns) {
  for (const txn of txns) {
    let resolved = null;

    // 1️⃣ Try Employee (normal pharmacist)
    if (!txn.fulfilledBy && txn.fulfilled_by_id) {
      resolved = await Employee.findOne({
        where: {
          [Op.or]: [
            { id: txn.fulfilled_by_id },
            { user_id: txn.fulfilled_by_id }, // legacy safety
          ],
        },
        attributes: ["id", "first_name", "last_name"],
      });

      if (resolved) {
        txn.setDataValue("fulfilledBy", resolved);
      }
    }

    // 2️⃣ Fallback to User (admin / superadmin / creator)
    if (!resolved && txn.fulfilled_by_id) {
      resolved = await User.findByPk(txn.fulfilled_by_id, {
        attributes: ["id", "first_name", "last_name"],
      });

      if (resolved) {
        txn.setDataValue("fulfilledBy", {
          id: resolved.id,
          first_name: resolved.first_name,
          last_name: resolved.last_name,
        });
      }
    }

    // 3️⃣ Always expose name to frontend
    txn.setDataValue(
      "fulfilled_by_name",
      resolved
        ? `${resolved.first_name} ${resolved.last_name}`
        : ""
    );
  }
}

/* ============================================================
   📋 ROLE-BASED JOI SCHEMA
============================================================ */
const itemSchema = Joi.object({
  prescription_item_id: Joi.string().uuid().required(),
  department_stock_id: Joi.string().uuid().required(),
  quantity_dispensed: Joi.number().min(1).required(),
  type: Joi.string().valid(...Object.values(PHARMACY_TRANSACTION_TYPE)).required(),
  notes: Joi.string().allow("", null),
});

/* ============================================================
   📋 ROLE-BASED JOI SCHEMA (FIXED)
============================================================ */
// Outer schema
function buildPharmacyTransactionSchema(userRole, mode = "create") {
  const base = {
    patient_id: Joi.string().uuid().required(),
    prescription_id: Joi.string().uuid().allow(null, ""),
    registration_log_id: Joi.string().uuid().allow(null, ""),
    consultation_id: Joi.string().uuid().allow(null, ""),
    department_id: Joi.string().uuid().allow(null, ""),
    doctor_id: Joi.string().uuid().allow(null, ""),
    invoice_item_id: Joi.string().uuid().allow(null, ""),
    notes: Joi.string().allow("", null),
    is_emergency: Joi.boolean().default(false),
    status: Joi.string()
      .valid(...Object.values(PHARMACY_TRANSACTION_STATUS))
      .default(PS.PENDING),

    // 🔐 pharmacist (backend authoritative)
    fulfilled_by_id: Joi.string().uuid().optional().strip(),

    // 🔹 Require items array
    items: Joi.array().items(itemSchema).min(1).required(),
  };

  if (mode === "update") {
    Object.keys(base).forEach((k) => {
      base[k] = base[k].optional();
    });
  }

  // role-specific org/facility rules
  switch (userRole) {
    case "superadmin":
      base.organization_id = Joi.string().uuid().required();
      base.facility_id = Joi.string().uuid().required();
      break;

    case "orgowner":
    case "admin":
      base.organization_id = Joi.forbidden();
      base.facility_id = Joi.string().uuid().required();
      break;

    default: // staff
      base.organization_id = Joi.string().uuid().optional().strip();
      base.facility_id = Joi.string().uuid().optional().strip();
  }

  return Joi.object(base);
}

/* ============================================================
   📌 CREATE PHARMACY TRANSACTION(S) — FINAL FIX
============================================================ */
export const createPharmacyTransactions = async (req, res) => {
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
    const schema = buildPharmacyTransactionSchema(role, "create");

    const payloads = Array.isArray(req.body) ? req.body : [req.body];
    if (!payloads.length) {
      await t.rollback();
      return error(res, "Payload must be an object or non-empty array", null, 400);
    }

    const prepared = [];
    const skipped = [];

    for (const [idx, payload] of payloads.entries()) {
      const { error: validationError, value } = schema.validate(payload, {
        stripUnknown: true,
      });

      if (validationError) {
        skipped.push({
          index: idx,
          reason: "Validation failed",
          details: validationError.details,
        });
        continue;
      }

      let orgId = req.user.organization_id;
      let facilityId = req.user.facility_id || null;

      if (isSuperAdmin(req.user)) {
        orgId = value.organization_id;
        facilityId = value.facility_id;
      }

      if (!orgId || !facilityId) {
        skipped.push({ index: idx, reason: "Missing org/facility assignment" });
        continue;
      }

      for (const item of value.items || []) {
        prepared.push({
          patient_id: value.patient_id,
          prescription_id: value.prescription_id,
          registration_log_id: value.registration_log_id,
          consultation_id: value.consultation_id,
          department_id: value.department_id,
          doctor_id: value.doctor_id,
          invoice_item_id: value.invoice_item_id,
          notes: item.notes || value.notes || "",
          is_emergency: value.is_emergency ?? false,
          status: value.status || PS.PENDING,

          organization_id: orgId,
          facility_id: facilityId,

          fulfilled_by_id: isSuperAdmin(req.user)
            ? value.fulfilled_by_id || req.user.id
            : req.user.id,

          fulfillment_date: new Date(),
          created_by_id: req.user.id,

          prescription_item_id: item.prescription_item_id,
          department_stock_id: item.department_stock_id,
          quantity_dispensed: item.quantity_dispensed,
          type: item.type,
        });
      }
    }

    const createdTransactions = [];

    for (const entry of prepared) {
      let txn;

      if ([PS.DISPENSED, PS.PARTIALLY_DISPENSED].includes(entry.status)) {
        // 🔥 SINGLE SOURCE OF TRUTH
        await pharmacyService.dispenseItem(
          entry.prescription_item_id,
          entry.quantity_dispensed,
          entry.fulfilled_by_id,
          t,
          entry.department_stock_id
        );

        // 🔄 Reload final transaction
        txn = await PharmacyTransaction.findOne({
          where: {
            prescription_item_id: entry.prescription_item_id,
            status: { [Op.ne]: PS.VOIDED },
          },
          transaction: t,
        });
      } else {
        txn = await PharmacyTransaction.create(entry, { transaction: t });
      }

      const shouldBill = shouldTriggerBilling(
        "pharmacy-transaction",
        txn.status
      );

      if (shouldBill) {
        await billingService.billPharmacyTransaction({
          transaction: txn,
          user: req.user,
          sequelizeTransaction: t,
        });
      }

      createdTransactions.push(txn);
    }

    await t.commit();

    return success(res, {
      message: `✅ ${createdTransactions.length} created, ⚠️ ${skipped.length} skipped`,
      records: createdTransactions,
      skipped,
    });
  } catch (err) {
    if (t && !t.finished) await t.rollback();
    return error(res, "❌ Failed to create pharmacy transaction(s)", err);
  }
};


/* ============================================================
   📌 UPDATE PHARMACY TRANSACTION — ALIGNED
============================================================ */
export const updatePharmacyTransaction = async (req, res) => {
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
    const schema = buildPharmacyTransactionSchema(role, "update");

    const { error, value } = schema.validate(req.body, { stripUnknown: true });
    if (error) {
      await t.rollback();
      return error(res, "Validation failed", error, 400);
    }

    const txn = await PharmacyTransaction.findByPk(id, {
      transaction: t,
      lock: t.LOCK.UPDATE,
    });

    if (!txn) {
      await t.rollback();
      return error(res, "Pharmacy Transaction not found", null, 404);
    }

    // 🔐 Fulfilled-by authority
    const fulfilledById = isSuperAdmin(req.user) && value.fulfilled_by_id
      ? value.fulfilled_by_id
      : req.user.id;

    await txn.update(
      {
        ...value,
        fulfilled_by_id: fulfilledById,
        fulfillment_date: new Date(),
        updated_by_id: req.user.id,
      },
      { transaction: t }
    );

    await t.commit();

    return success(res, "✅ Pharmacy Transaction updated", txn);
  } catch (err) {
    if (t && !t.finished) await t.rollback();
    return error(res, "❌ Failed to update pharmacy transaction", err);
  }
};


/* ============================================================
   📌 TOGGLE PHARMACY TRANSACTION STATUS (single + bulk)
============================================================ */
export const togglePharmacyTransactionStatus = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const allowed = await authzService.checkPermission({ user: req.user, module: MODULE_KEY, action: "update", res });
    if (!allowed) return;

    const ids = Array.isArray(req.body?.ids) ? req.body.ids : [req.params.id];
    if (!ids?.length) { await t.rollback(); return error(res, "❌ Must provide at least one Transaction ID", null, 400); }

    const role = (req.user?.roleNames?.[0] || "staff").toLowerCase();
    const where = { id: { [Op.in]: ids } };
    if (!isSuperAdmin(req.user)) {
      where.organization_id = req.user.organization_id;
      if (role === "facilityhead") where.facility_id = req.user.facility_id;
    } else {
      if (req.query.organization_id) where.organization_id = req.query.organization_id;
      if (req.query.facility_id) where.facility_id = req.query.facility_id;
    }

    const txns = await PharmacyTransaction.findAll({ where, transaction: t, lock: { level: t.LOCK.UPDATE, of: PharmacyTransaction } });
    if (!txns.length) { await t.rollback(); return error(res, "❌ No Pharmacy Transactions found", null, 404); }

    const updated = [], skipped = [];

    for (const txn of txns) {
      const oldStatus = txn.status;
      let newStatus = oldStatus;

      if (req.body?.status && Object.values(PHARMACY_TRANSACTION_STATUS).includes(req.body.status)) {
        newStatus = req.body.status;
      } else if (oldStatus === PS.PENDING) {
        newStatus = PS.CANCELLED;
      } else if (oldStatus === PS.CANCELLED) {
        newStatus = PS.PENDING;
      }

      if (oldStatus === newStatus) {
        skipped.push({ id: txn.id, reason: "No status change" });
        continue;
      }

      await txn.update({ status: newStatus, updated_by_id: req.user?.id || null }, { transaction: t });

      if (newStatus === PS.CANCELLED && txn.invoice_item_id) {
        await billingService.voidCharges({
          module: MODULE_KEY,
          entityId: txn.id,
          user: { ...req.user, organization_id: txn.organization_id, facility_id: txn.facility_id },
          transaction: t,
        });
      } else {
        const shouldBill = shouldTriggerBilling("pharmacy-transaction", newStatus);
        if (shouldBill) {
          console.log(`[billingHook] module=${MODULE_KEY} | status=${newStatus} | id=${txn.id}`);
          await billingService.billPharmacyTransaction({
            transaction: txn,
            user: req.user,
            sequelizeTransaction: t,
          });
        }
      }

      updated.push({ id: txn.id, from: oldStatus, to: newStatus });
    }

    await t.commit();

    const full = updated.length
      ? await PharmacyTransaction.findAll({ where: { id: updated.map(u => u.id) }, include: PHARMACY_TRANSACTION_INCLUDES })
      : [];

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: ids.length > 1 ? "bulk_toggle_status" : "toggle_status",
      details: { updated, skipped },
    });

    return success(res, `✅ ${updated.length} toggled, ⚠️ ${skipped.length} skipped`, { records: full, skipped });
  } catch (err) {
    if (t && !t.finished) await t.rollback();
    return error(res, "❌ Failed to toggle pharmacy transaction status", err);
  }
};

/* ============================================================
   📌 SUBMIT PHARMACY TRANSACTION(S)
   ✅ Controller NEVER recalculates status
============================================================ */
export const submitPharmacyTransactions = async (req, res) => {
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
    if (!ids.length) {
      await t.rollback();
      return error(res, "❌ Must provide at least one Transaction ID", null, 400);
    }

    const role = (req.user?.roleNames?.[0] || "staff").toLowerCase();
    const where = { id: { [Op.in]: ids } };

    if (!isSuperAdmin(req.user)) {
      where.organization_id = req.user.organization_id;
      if (role === "facilityhead") where.facility_id = req.user.facility_id;
    }

    const txns = await PharmacyTransaction.findAll({
      where,
      transaction: t,
      lock: { level: t.LOCK.UPDATE, of: PharmacyTransaction },
    });

    if (!txns.length) {
      await t.rollback();
      return error(res, "❌ No Pharmacy Transactions found", null, 404);
    }

    const updated = [];
    const skipped = [];

    for (const txn of txns) {
      if (txn.status !== PS.PENDING) {
        skipped.push({ id: txn.id, reason: `Not pending (${txn.status})` });
        continue;
      }

      try {
        const qty =
          typeof req.body?.quantity_dispensed === "number"
            ? req.body.quantity_dispensed
            : txn.quantity_dispensed;

        if (!qty || qty <= 0) {
          skipped.push({ id: txn.id, reason: "Invalid dispense quantity" });
          continue;
        }

        // 🔥 SINGLE SOURCE OF TRUTH
        await pharmacyService.dispenseItem(
          txn.prescription_item_id,
          qty,
          req.user.id,
          t,
          txn.department_stock_id
        );

        // 🔄 Reload FINAL transaction
        const freshTxn = await PharmacyTransaction.findByPk(txn.id, {
          transaction: t,
        });

        const shouldBill = shouldTriggerBilling(
          "pharmacy-transaction",
          freshTxn.status
        );

        if (shouldBill) {
          await billingService.billPharmacyTransaction({
            transaction: freshTxn,
            user: req.user,
            sequelizeTransaction: t,
          });
        }

        updated.push({
          id: txn.id,
          from: PS.PENDING,
          to: freshTxn.status,
        });
      } catch (err) {
        skipped.push({ id: txn.id, reason: err.message });
      }
    }

    await t.commit();

    const full = updated.length
      ? await PharmacyTransaction.findAll({
          where: { id: updated.map(u => u.id) },
          include: PHARMACY_TRANSACTION_INCLUDES,
        })
      : [];

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: ids.length > 1 ? "bulk_submit" : "submit",
      details: { updated, skipped },
    });

    return success(
      res,
      `✅ ${updated.length} submitted, ⚠️ ${skipped.length} skipped`,
      { records: full, skipped }
    );
  } catch (err) {
    if (t && !t.finished) await t.rollback();
    return error(res, "❌ Failed to submit pharmacy transaction(s)", err);
  }
};

/* ============================================================
   🔎 DEBUG LOGGER (LOCAL)
============================================================ */
const logBillingDecision = (label, payload) => {
  console.log(`\n🔎 [${label}]`);
  Object.entries(payload).forEach(([k, v]) =>
    console.log(`   ${k}:`, v)
  );
};

/* ============================================================
   📌 PARTIALLY DISPENSE PHARMACY TRANSACTION(S)
   🔒 SAFE: Never completes full quantity
   🔒 SAFE: Never bills full amount
============================================================ */
export const partiallyDispensePharmacyTransactions = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module: MODULE_KEY,
      action: "update",
      res,
    });
    if (!allowed) return;

    const ids = Array.isArray(req.body?.ids)
      ? req.body.ids
      : [req.params.id];

    if (!ids.length) {
      await t.rollback();
      return error(res, "❌ Must provide at least one Transaction ID", null, 400);
    }

    const where = { id: { [Op.in]: ids } };
    if (!isSuperAdmin(req.user)) {
      where.organization_id = req.user.organization_id;
    }

    const txns = await PharmacyTransaction.findAll({
      where,
      include: [
        {
          model: PrescriptionItem,
          as: "prescriptionItem",
          attributes: ["id", "quantity", "dispensed_qty"],
        },
      ],
      transaction: t,
      lock: { level: t.LOCK.UPDATE, of: PharmacyTransaction },
    });

    const updated = [];
    const skipped = [];

    for (const txn of txns) {
      if (![PS.PENDING, PS.PARTIALLY_DISPENSED].includes(txn.status)) {
        skipped.push({ id: txn.id, reason: `Invalid state (${txn.status})` });
        continue;
      }

      const qty = Number(req.body?.quantity_dispensed);
      if (!qty || qty <= 0) {
        skipped.push({ id: txn.id, reason: "Invalid partial quantity" });
        continue;
      }

      const prescribedQty = Number(txn.prescriptionItem?.quantity || 0);
      const alreadyDispensed = Number(txn.prescriptionItem?.dispensed_qty || 0);
      const remainingQty = prescribedQty - alreadyDispensed;

      logBillingDecision("PARTIAL-DISPENSE", {
        txn_id: txn.id,
        prescribed_qty: prescribedQty,
        already_dispensed: alreadyDispensed,
        requested_partial: qty,
        remaining_before: remainingQty,
        status_before: txn.status,
      });

      if (qty >= remainingQty) {
        skipped.push({
          id: txn.id,
          reason: "Partial dispense cannot complete full quantity. Use DISPENSE.",
        });
        continue;
      }

      try {
        await pharmacyService.dispenseItem(
          txn.prescription_item_id,
          qty,
          req.user.id,
          t,
          txn.department_stock_id
        );

        const freshTxn = await PharmacyTransaction.findByPk(txn.id, {
          transaction: t,
        });

        logBillingDecision("PARTIAL-RESULT", {
          txn_id: txn.id,
          status_after: freshTxn.status,
          total_dispensed: freshTxn.quantity_dispensed,
        });

        const shouldBill = shouldTriggerBilling(
          "pharmacy-transaction",
          freshTxn.status
        );

        logBillingDecision("BILLING-CHECK", {
          txn_id: txn.id,
          module: "pharmacy-transaction",
          status: freshTxn.status,
          qualifies: shouldBill,
          bill_delta_qty: qty,
        });

        if (shouldBill) {
          logBillingDecision("BILLING-TRIGGERED", {
            txn_id: txn.id,
            bill_qty: qty,
            reason: "status_match",
          });

          await billingService.billPharmacyTransaction({
            transaction: freshTxn,
            user: req.user,
            sequelizeTransaction: t,
          });
        } else {
          logBillingDecision("BILLING-SKIPPED", {
            txn_id: txn.id,
            status: freshTxn.status,
            reason: "status_not_billable",
          });
        }

        updated.push({
          id: txn.id,
          from: txn.status,
          to: freshTxn.status,
          dispensed_now: qty,
        });
      } catch (err) {
        skipped.push({ id: txn.id, reason: err.message });
      }
    }

    await t.commit();
    return success(res, `✅ ${updated.length} partially dispensed`, {
      updated,
      skipped,
    });
  } catch (err) {
    if (t && !t.finished) await t.rollback();
    return error(res, "❌ Failed to partially dispense", err);
  }
};

/* ============================================================
   📌 DISPENSE PHARMACY TRANSACTION(S)
   🔒 IDEMPOTENT — DOUBLE-PROOF
============================================================ */
export const dispensePharmacyTransactions = async (req, res) => {
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
    if (!ids.length) {
      await t.rollback();
      return error(res, "❌ Must provide at least one Transaction ID", null, 400);
    }

    const role = (req.user?.roleNames?.[0] || "staff").toLowerCase();
    const where = { id: { [Op.in]: ids } };

    if (!isSuperAdmin(req.user)) {
      where.organization_id = req.user.organization_id;
      if (role === "facilityhead") where.facility_id = req.user.facility_id;
    }

    const txns = await PharmacyTransaction.findAll({
      where,
      include: [
        {
          model: PrescriptionItem,
          as: "prescriptionItem",
          attributes: ["id", "quantity", "dispensed_qty", "status"],
        },
      ],
      transaction: t,
      lock: { level: t.LOCK.UPDATE, of: PharmacyTransaction },
    });

    if (!txns.length) {
      await t.rollback();
      return error(res, "❌ No Pharmacy Transactions found", null, 404);
    }

    const updated = [];
    const skipped = [];

    for (const txn of txns) {
      const item = txn.prescriptionItem;
      if (!item) {
        skipped.push({ id: txn.id, reason: "Missing prescription item" });
        continue;
      }

      if (txn.status === PS.DISPENSED) {
        skipped.push({ id: txn.id, reason: "Already dispensed" });
        continue;
      }

      const prescribedQty = Number(item.quantity || 0);
      const alreadyDispensed = Number(item.dispensed_qty || 0);
      const remainingQty = prescribedQty - alreadyDispensed;

      logBillingDecision("FULL-DISPENSE", {
        txn_id: txn.id,
        prescribed_qty: prescribedQty,
        already_dispensed: alreadyDispensed,
        remaining_to_dispense: remainingQty,
        status_before: txn.status,
      });

      if (remainingQty <= 0) {
        skipped.push({ id: txn.id, reason: "No remaining quantity" });
        continue;
      }

      try {
        await pharmacyService.dispenseItem(
          txn.prescription_item_id,
          remainingQty,
          req.user.id,
          t,
          txn.department_stock_id
        );

        const freshTxn = await PharmacyTransaction.findByPk(txn.id, {
          transaction: t,
        });

        logBillingDecision("FULL-RESULT", {
          txn_id: txn.id,
          status_after: freshTxn.status,
          dispensed_now: remainingQty,
        });

        const shouldBill = shouldTriggerBilling(
          "pharmacy-transaction",
          freshTxn.status
        );

        logBillingDecision("BILLING-CHECK", {
          txn_id: txn.id,
          status: freshTxn.status,
          qualifies: shouldBill,
          bill_qty: remainingQty,
        });

        if (shouldBill) {
          logBillingDecision("BILLING-TRIGGERED", {
            txn_id: txn.id,
            bill_qty: remainingQty,
            reason: "status_match",
          });

          await billingService.billPharmacyTransaction({
            transaction: freshTxn,
            user: req.user,
            sequelizeTransaction: t,
          });
        }

        updated.push({
          id: txn.id,
          from: txn.status,
          to: freshTxn.status,
          dispensed: remainingQty,
        });
      } catch (err) {
        skipped.push({ id: txn.id, reason: err.message });
      }
    }

    await t.commit();

    const full = updated.length
      ? await PharmacyTransaction.findAll({
          where: { id: updated.map((u) => u.id) },
          include: PHARMACY_TRANSACTION_INCLUDES,
        })
      : [];

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: ids.length > 1 ? "bulk_dispense" : "dispense",
      details: { updated, skipped },
    });

    return success(
      res,
      `✅ ${updated.length} dispensed, ⚠️ ${skipped.length} skipped`,
      { records: full, skipped }
    );
  } catch (err) {
    if (t && !t.finished) await t.rollback();
    return error(res, "❌ Failed to dispense pharmacy transaction(s)", err);
  }
};

/* ============================================================
   📌 VERIFY PHARMACY TRANSACTION(S) (dispensed → verified)
============================================================ */
export const verifyPharmacyTransactions = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const allowed = await authzService.checkPermission({ user: req.user, module: MODULE_KEY, action: "update", res });
    if (!allowed) return;

    const ids = Array.isArray(req.body?.ids) ? req.body.ids : [req.params.id];
    if (!ids?.length) { await t.rollback(); return error(res, "❌ Must provide at least one Transaction ID", null, 400); }

    const role = (req.user?.roleNames?.[0] || "staff").toLowerCase();
    const where = { id: { [Op.in]: ids } };
    if (!isSuperAdmin(req.user)) {
      where.organization_id = req.user.organization_id;
      if (role === "facilityhead") where.facility_id = req.user.facility_id;
    } else {
      if (req.query.organization_id) where.organization_id = req.query.organization_id;
      if (req.query.facility_id) where.facility_id = req.query.facility_id;
    }

    const txns = await PharmacyTransaction.findAll({ where, transaction: t, lock: { level: t.LOCK.UPDATE, of: PharmacyTransaction } });
    if (!txns.length) { await t.rollback(); return error(res, "❌ No Pharmacy Transactions found", null, 404); }

    const updated = [], skipped = [];

    for (const txn of txns) {
      const oldStatus = txn.status;
      if (![PS.DISPENSED, PS.PARTIALLY_DISPENSED].includes(oldStatus)) {
        skipped.push({ id: txn.id, reason: `Not dispensed (${oldStatus})` });
        continue;
      }

      await txn.update({ status: PS.VERIFIED, updated_by_id: req.user?.id || null }, { transaction: t });
      updated.push({ id: txn.id, from: oldStatus, to: PS.VERIFIED });
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
    return error(res, "❌ Failed to verify pharmacy transaction(s)", err);
  }
};
/* ============================================================
   📌 VOID PHARMACY TRANSACTION(S) (any → voided)
============================================================ */
export const voidPharmacyTransactions = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module: MODULE_KEY,
      action: "delete",
      res
    });
    if (!allowed) return;

    const ids = Array.isArray(req.body?.ids) ? req.body.ids : [req.params.id];
    if (!ids?.length) {
      await t.rollback();
      return error(res, "❌ Must provide at least one Transaction ID", null, 400);
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

    const txns = await PharmacyTransaction.findAll({ where, transaction: t, lock: { level: t.LOCK.UPDATE, of: PharmacyTransaction } });
    if (!txns.length) {
      await t.rollback();
      return error(res, "❌ No Pharmacy Transactions found", null, 404);
    }

    const updated = [], skipped = [];

    for (const txn of txns) {
      try {
        await pharmacyService.voidTransaction(txn.id, req.body?.reason || "Voided by user", req.user?.id, t);

        if (txn.invoice_item_id) {
          await billingService.voidCharges({
            module: "pharmacy-transaction",
            entityId: txn.id,
            user: { ...req.user, organization_id: txn.organization_id, facility_id: txn.facility_id },
            transaction: t,
          });
        }

        updated.push({ id: txn.id, from: txn.status, to: PS.VOIDED });
      } catch (err) {
        skipped.push({ id: txn.id, reason: err.message });
      }
    }

    await t.commit();

    const full = updated.length
      ? await PharmacyTransaction.findAll({ where: { id: updated.map(u => u.id) }, include: PHARMACY_TRANSACTION_INCLUDES })
      : [];

    // 🔹 Enrich live stock
    for (const txn of full) {
      if (txn?.department_id && txn?.prescriptionItem?.billableItem?.master_item_id) {
        const liveStock = await getLiveDeptStock(
          txn.organization_id,
          txn.facility_id,
          txn.department_id,
          txn.prescriptionItem.billableItem.master_item_id
        );
        if (liveStock) {
          txn.setDataValue("dept_stock_qty", liveStock.quantity);
          txn.setDataValue("min_threshold", liveStock.min_threshold);
          txn.setDataValue("max_threshold", liveStock.max_threshold);
        }
      }
    }

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: ids.length > 1 ? "bulk_void" : "void",
      details: { updated, skipped },
    });

    return success(res, `✅ ${updated.length} voided, ⚠️ ${skipped.length} skipped`, { records: full, skipped });
  } catch (err) {
    if (t && !t.finished) await t.rollback();
    return error(res, "❌ Failed to void pharmacy transaction(s)", err);
  }
};

/* ============================================================
   📌 CANCEL PHARMACY TRANSACTION(S) (pending/dispensed → cancelled)
============================================================ */
export const cancelPharmacyTransactions = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module: MODULE_KEY,
      action: "update",
      res
    });
    if (!allowed) return;

    const ids = Array.isArray(req.body?.ids) ? req.body.ids : [req.params.id];
    if (!ids?.length) {
      await t.rollback();
      return error(res, "❌ Must provide at least one Transaction ID", null, 400);
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

    const txns = await PharmacyTransaction.findAll({
      where,
      transaction: t,
      lock: { level: t.LOCK.UPDATE, of: PharmacyTransaction }
    });
    if (!txns.length) return error(res, "❌ No Pharmacy Transactions found", null, 404);

    const updated = [], skipped = [];

    for (const txn of txns) {
      if (![PS.PENDING, PS.DISPENSED, PS.PARTIALLY_DISPENSED].includes(txn.status)) {
        skipped.push({ id: txn.id, reason: `Not cancellable (${txn.status})` });
        continue;
      }

      try {
        // 🟢 Explicitly set status to CANCELLED instead of reusing void logic
        await txn.update(
          { status: PS.CANCELLED, updated_by_id: req.user?.id || null },
          { transaction: t }
        );

        if (txn.invoice_item_id) {
          await billingService.voidCharges({
            module: "pharmacy-transaction",
            entityId: txn.id,
            user: { ...req.user, organization_id: txn.organization_id, facility_id: txn.facility_id },
            transaction: t
          });
        }

        updated.push({ id: txn.id, from: txn.status, to: PS.CANCELLED });
      } catch (err) {
        skipped.push({ id: txn.id, reason: err.message });
      }
    }

    await t.commit();

    const full = updated.length
      ? await PharmacyTransaction.findAll({
          where: { id: updated.map(u => u.id) },
          include: PHARMACY_TRANSACTION_INCLUDES
        })
      : [];

    // 🔹 Enrich live stock (use master_item_id consistently)
    for (const txn of full) {
      const masterItemId = txn?.prescriptionItem?.billableItem?.master_item_id;
      if (txn?.department_id && masterItemId) {
        const liveStock = await getLiveDeptStock(
          txn.organization_id,
          txn.facility_id,
          txn.department_id,
          masterItemId
        );
        if (liveStock) {
          txn.setDataValue("dept_stock_qty", liveStock.quantity);
          txn.setDataValue("min_threshold", liveStock.min_threshold);
          txn.setDataValue("max_threshold", liveStock.max_threshold);
        }
      }
    }

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: ids.length > 1 ? "bulk_cancel" : "cancel",
      details: { updated, skipped }
    });

    return success(res, `✅ ${updated.length} cancelled, ⚠️ ${skipped.length} skipped`, { records: full, skipped });
  } catch (err) {
    if (t && !t.finished) await t.rollback();
    return error(res, "❌ Failed to cancel pharmacy transaction(s)", err);
  }
};

/* ============================================================
   📌 DELETE PHARMACY TRANSACTION(S) (Soft Delete + Rollback Billing)
============================================================ */
export const deletePharmacyTransactions = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const allowed = await authzService.checkPermission({ user: req.user, module: MODULE_KEY, action: "delete", res });
    if (!allowed) return;

    const ids = Array.isArray(req.body?.ids) ? req.body.ids : [req.params.id];
    if (!ids?.length) { await t.rollback(); return error(res, "❌ Must provide at least one Transaction ID", null, 400); }

    const role = (req.user?.roleNames?.[0] || "staff").toLowerCase();
    const where = { id: { [Op.in]: ids } };
    if (!isSuperAdmin(req.user)) {
      where.organization_id = req.user.organization_id;
      if (role === "facilityhead") where.facility_id = req.user.facility_id;
    } else {
      if (req.query.organization_id) where.organization_id = req.query.organization_id;
      if (req.query.facility_id) where.facility_id = req.query.facility_id;
    }

    const txns = await PharmacyTransaction.findAll({ where, transaction: t, lock: { level: t.LOCK.UPDATE, of: PharmacyTransaction } });
    if (!txns.length) { await t.rollback(); return error(res, "❌ No Pharmacy Transactions found", null, 404); }

    const deleted = [], skipped = [];

    for (const txn of txns) {
      if (txn.status === PS.VERIFIED) {
        skipped.push({ id: txn.id, reason: "Verified transactions cannot be deleted" });
        continue;
      }

      if (txn.invoice_item_id) {
        await billingService.voidCharges({
          module: MODULE_KEY,
          entityId: txn.id,
          user: { ...req.user, organization_id: txn.organization_id, facility_id: txn.facility_id },
          transaction: t,
        });
      }

      await txn.update({ deleted_by_id: req.user?.id }, { transaction: t });
      await txn.destroy({ transaction: t });
      deleted.push(txn);
    }

    await t.commit();

    const full = deleted.length
      ? await PharmacyTransaction.findAll({
          where: { id: deleted.map(r => r.id) },
          include: PHARMACY_TRANSACTION_INCLUDES,
          paranoid: false,
        })
      : [];

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: ids.length > 1 ? "bulk_delete" : "delete",
      details: { deleted: deleted.map(r => r.id), skipped },
    });

    return success(res, `✅ ${deleted.length} deleted, ⚠️ ${skipped.length} skipped`, { records: full, skipped });
  } catch (err) {
    if (t && !t.finished) await t.rollback();
    return error(res, "❌ Failed to delete pharmacy transaction(s)", err);
  }
};

/* ============================================================
   📌 GET PHARMACY TRANSACTION BY ID (Fixed)
============================================================ */
export const getPharmacyTransactionById = async (req, res) => {
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

    // 🔒 Tenant scoping
    const where = { id };
    if (!isSuperAdmin(req.user)) {
      where.organization_id = req.user.organization_id;
      if (role === "facilityhead") where.facility_id = req.user.facility_id;
    } else {
      if (req.query.organization_id)
        where.organization_id = req.query.organization_id;
      if (req.query.facility_id)
        where.facility_id = req.query.facility_id;
    }

    const txn = await PharmacyTransaction.findOne({
      where,
      include: PHARMACY_TRANSACTION_INCLUDES,
      attributes: { include: ["id"] }, // ✅ hard guarantee
    });

    if (!txn)
      return error(res, "❌ Pharmacy Transaction not found", null, 404);

    // ✅ Resolve pharmacist safely
    await resolveFulfilledBy([txn]);

    // 🔹 Enrich live stock
    const masterItemId = txn?.prescriptionItem?.billableItem?.master_item_id;
    if (txn?.department_id && masterItemId) {
      const liveStock = await getLiveDeptStock(
        txn.organization_id,
        txn.facility_id,
        txn.department_id,
        masterItemId
      );
      if (liveStock) {
        txn.setDataValue("dept_stock_qty", liveStock.quantity);
        txn.setDataValue("min_threshold", liveStock.min_threshold);
        txn.setDataValue("max_threshold", liveStock.max_threshold);
      }
    }

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "view",
      entityId: id,
      entity: txn,
    });

    return success(res, "✅ Pharmacy Transaction loaded", txn);
  } catch (err) {
    return error(res, "❌ Failed to load pharmacy transaction", err);
  }
};


/* ============================================================
   📌 GET ALL PHARMACY TRANSACTIONS (with Dynamic Summary – FIXED)
============================================================ */
export const getAllPharmacyTransactions = async (req, res) => {
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module: MODULE_KEY,
      action: "read",
      res,
    });
    if (!allowed) return;

    const role = (req.user?.roleNames?.[0] || "staff").toLowerCase();

    const ALLOWED_FIELDS = [
      "id","organization_id","facility_id","patient_id","doctor_id","department_id",
      "consultation_id","registration_log_id","prescription_id","prescription_item_id",
      "department_stock_id","quantity_dispensed","type","notes","is_emergency","status",
      "fulfillment_date","fulfilled_by_id","void_reason","voided_by_id","voided_at",
      "created_by_id","created_at","updated_by_id","updated_at","deleted_by_id","deleted_at"
    ];

    const requestedFields = (req.query.fields || "")
      .split(",")
      .map(f => f.trim())
      .filter(Boolean);

    let safeVisibleFields = requestedFields.filter(f =>
      ALLOWED_FIELDS.includes(f)
    );

    // ✅ GUARANTEE id ALWAYS EXISTS
    if (!safeVisibleFields.includes("id")) safeVisibleFields.unshift("id");

    const options = buildQueryOptions(
      req,
      "created_at",
      "DESC",
      safeVisibleFields.length ? safeVisibleFields : undefined
    );

    options.where = options.where || {};

    // 🔒 FINAL SAFETY NET (prevents undefined IDs forever)
    if (!options.attributes || !options.attributes.includes("id")) {
      options.attributes = ["id", ...(options.attributes || [])];
    }

    /* 📅 Date range */
    if (req.query.created_from || req.query.created_to) {
      const range = {};
      if (req.query.created_from)
        range[Op.gte] = new Date(req.query.created_from);
      if (req.query.created_to) {
        const end = new Date(req.query.created_to);
        if (!isNaN(end)) end.setDate(end.getDate() + 1);
        range[Op.lt] = end;
      }
      options.where.created_at = range;
    }

    /* 🏢 Tenant scoping */
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

    /* 🎯 Filters */
    if (req.query.patient_id) options.where.patient_id = req.query.patient_id;
    if (req.query.status) options.where.status = req.query.status;
    if (req.query.type) options.where.type = req.query.type;
    if (req.query.department_id)
      options.where.department_id = req.query.department_id;
    if (req.query.doctor_id) options.where.doctor_id = req.query.doctor_id;

    /* 🔍 Search */
    if (options.search) {
      const term = `%${options.search}%`;
      options.where[Op.or] = [
        { notes: { [Op.iLike]: term } },
        { "$patient.first_name$": { [Op.iLike]: term } },
        { "$patient.last_name$": { [Op.iLike]: term } },
      ];
    }

    const liteMode = req.query.lite === "true";

    const { count, rows } = await PharmacyTransaction.findAndCountAll({
      where: options.where,
      include: liteMode ? [] : PHARMACY_TRANSACTION_INCLUDES,
      attributes: options.attributes, // ✅ ALWAYS has id
      order: options.order,
      offset: options.offset,
      limit: Math.min(options.limit, 50),
      distinct: true,
    });

    // ✅ Resolve pharmacist for ALL rows
    await resolveFulfilledBy(rows);

    /* 💊 Enrich live stock */
    for (const txn of rows) {
      const masterItemId = txn?.prescriptionItem?.billableItem?.master_item_id;
      if (txn?.department_id && masterItemId) {
        const liveStock = await getLiveDeptStock(
          txn.organization_id,
          txn.facility_id,
          txn.department_id,
          masterItemId
        );
        if (liveStock) {
          txn.setDataValue("dept_stock_qty", liveStock.quantity);
          txn.setDataValue("min_threshold", liveStock.min_threshold);
          txn.setDataValue("max_threshold", liveStock.max_threshold);
        }
      }
    }

    const summary = await buildDynamicSummary({
      model: PharmacyTransaction,
      options,
      statusEnums: Object.values(PHARMACY_TRANSACTION_STATUS),
      includeGender: true,
      genderJoin: { model: Patient, as: "patient" },
    });

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "list",
      details: { query: req.query, returned: count, liteMode },
    });

    return success(res, "✅ Pharmacy Transactions loaded", {
      records: rows,
      pagination: {
        total: count,
        page: options.pagination.page,
        pageCount: Math.ceil(count / options.pagination.limit),
      },
      summary,
    });
  } catch (err) {
    return error(res, "❌ Failed to load pharmacy transactions", err);
  }
};

/* ============================================================
   📌 GET ALL PHARMACY TRANSACTIONS LITE (FIXED)
============================================================ */
export const getAllPharmacyTransactionsLite = async (req, res) => {
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module: MODULE_KEY,
      action: "read",
      res,
    });
    if (!allowed) return;

    const { q, patient_id } = req.query;
    const role = (req.user?.roleNames?.[0] || "").toLowerCase();

    const rawStatus = req.query.status
      ? String(req.query.status).toLowerCase()
      : null;

    const where = {};
    where.status =
      rawStatus && Object.values(PS).includes(rawStatus)
        ? rawStatus
        : PS.PENDING;

    if (patient_id) where.patient_id = patient_id;

    if (!isSuperAdmin(req.user)) {
      where.organization_id = req.user.organization_id;
      if (role === "facilityhead") where.facility_id = req.user.facility_id;
    } else {
      if (req.query.organization_id)
        where.organization_id = req.query.organization_id;
      if (req.query.facility_id)
        where.facility_id = req.query.facility_id;
    }

    if (q) {
      where[Op.or] = [
        { notes: { [Op.iLike]: `%${q}%` } },
        { "$patient.first_name$": { [Op.iLike]: `%${q}%` } },
        { "$patient.last_name$": { [Op.iLike]: `%${q}%` } },
        { "$departmentStock.name$": { [Op.iLike]: `%${q}%` } },
      ];
    }

    const txns = await PharmacyTransaction.findAll({
      where,
      distinct: true,
      attributes: [
        "id",
        "quantity_dispensed",
        "type",
        "status",
        "is_emergency",
        "notes",
        "fulfilled_by_id", // ✅ REQUIRED for resolver
        "fulfillment_date",
        "created_at",
        "updated_at",
      ],
      include: [
        { model: Patient, as: "patient", attributes: ["id", "pat_no", "first_name", "last_name"] },
        { model: Employee, as: "doctor", attributes: ["id", "first_name", "last_name"] },
        { model: Employee, as: "fulfilledBy", attributes: ["id", "first_name", "last_name"] },
        { model: sequelize.models.DepartmentStock, as: "departmentStock", attributes: ["id", "name", "quantity", "min_threshold", "max_threshold"] },
        { model: Department, as: "department", attributes: ["id", "name"] },
        { model: Consultation, as: "consultation", attributes: ["id", "consultation_date", "status"] },
        { model: RegistrationLog, as: "registrationLog", attributes: ["id", "registration_time", "log_status"] },
      ],
      order: [["created_at", "DESC"]],
      limit: Math.min(Number(req.query.limit) || 20, 50),
    });

    // ✅ FIX: resolve pharmacist reliably
    await resolveFulfilledBy(txns);

    const result = txns.map((t) => {
      const patientLabel = t.patient
        ? `${t.patient.pat_no} - ${t.patient.first_name} ${t.patient.last_name}`
        : "Unknown Patient";

      const stockLabel = t.departmentStock?.name || "No Stock Linked";

      return {
        id: t.id,
        name: `${patientLabel} | ${stockLabel} | ${t.status || "—"}`,
        patient_id: t.patient?.id || null,
        patient: patientLabel,
        doctor_id: t.doctor?.id || null,
        doctor_name: t.doctor
          ? `${t.doctor.first_name} ${t.doctor.last_name}`
          : "",
        pharmacist_id: t.fulfilledBy?.id || null,
        pharmacist_name: t.fulfilled_by_name || "",
        department_stock_id: t.departmentStock?.id || null,
        department_stock_name: stockLabel,
        dept_stock_qty: t.departmentStock?.quantity ?? null,
        dept_stock_qty_live: null,
        quantity_dispensed: t.quantity_dispensed,
        type: t.type,
        status: t.status,
        department: t.department?.name || "",
        consultation_date: t.consultation?.consultation_date || null,
        registration_log_id: t.registrationLog?.id || null,
        registration_log_code: t.registrationLog?.log_status || null,
        emergency: t.is_emergency,
        notes: t.notes || "",
        fulfillment_date: t.fulfillment_date,
        created_at: t.created_at,
        updated_at: t.updated_at,
      };
    });

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "list_lite",
      details: {
        count: result.length,
        query: q || null,
        patient_id: patient_id || null,
        status: where.status,
      },
    });

    return success(res, "✅ Pharmacy Transactions loaded (lite)", {
      records: result,
    });
  } catch (err) {
    return error(res, "❌ Failed to load pharmacy transactions (lite)", err);
  }
};

/* ============================================================
   📌 GET ALL PHARMACY TRANSACTION ITEMS LITE (by prescription_id)
============================================================ */
export const getAllPharmacyTransactionItemsLite = async (req, res) => {
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module: MODULE_KEY,
      action: "read",
      res,
    });
    if (!allowed) return;

    const { prescription_id } = req.query;
    if (!prescription_id) {
      return error(res, "❌ prescription_id is required", null, 400);
    }

    const items = await PharmacyTransaction.findAll({
      where: { prescription_id },
      attributes: [
        "id",
        "prescription_item_id",
        "department_stock_id",
        "patient_id",
        "quantity_dispensed",
        "type",
        "status",
        "notes",
        "fulfillment_date",
        "created_at",
        "updated_at",
      ],
      include: [
        {
          model: DepartmentStock,
          as: "departmentStock",
          attributes: [
            "id",
            "batch_no",
            "quantity",
            "min_threshold",
            "max_threshold",
          ],
        },
        {
          model: Patient,
          as: "patient",
          attributes: ["id", "pat_no", "first_name", "last_name"],
        },
      ],
      order: [["created_at", "ASC"]],
    });

    const result = items.map((t) => {
      const patientLabel = t.patient
        ? `${t.patient.pat_no} - ${t.patient.first_name} ${t.patient.last_name}`
        : "Unknown Patient";

      const stockLabel = t.departmentStock
        ? `${t.departmentStock.batch_no || "Batch"} (bal: ${t.departmentStock.quantity})`
        : "No Stock Linked";

      return {
        id: t.id,
        prescription_item_id: t.prescription_item_id,
        patient_id: t.patient?.id || null,
        patient: patientLabel,
        department_stock_id: t.departmentStock?.id || null,
        department_stock_name: stockLabel,
        dept_stock_qty: t.departmentStock?.quantity ?? null,
        dept_stock_qty_live: null,
        quantity_dispensed: t.quantity_dispensed,
        type: t.type,
        status: t.status,
        notes: t.notes || "",
        fulfillment_date: t.fulfillment_date,
        created_at: t.created_at,
        updated_at: t.updated_at,
      };
    });

    return success(res, "✅ Pharmacy Transaction Items loaded (lite)", {
      records: result,
    });
  } catch (err) {
    return error(res, "❌ Failed to load pharmacy transaction items (lite)", err);
  }
};

/* ============================================================
   💊 Pharmacy Transaction Summary (Rich + Filter-Aware)
   ============================================================ */
export const getPharmacyTransactionSummary = async (req, res) => {
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module: MODULE_KEY,
      action: "read",
      res,
    });
    if (!allowed) return;

    const role = (req.user?.roleNames?.[0] || "staff").toLowerCase();
    const options = buildQueryOptions(req, "created_at", "DESC");
    options.where = options.where || {};

    // 🔒 Tenant scoping
    if (!isSuperAdmin(req.user)) {
      options.where.organization_id = req.user.organization_id;
      if (role === "facilityhead") options.where.facility_id = req.user.facility_id;
    } else {
      if (req.query.organization_id)
        options.where.organization_id = req.query.organization_id;
      if (req.query.facility_id)
        options.where.facility_id = req.query.facility_id;
    }

    // 🗓 Date filters
    if (req.query["created_at[gte]"]) {
      options.where.created_at = { [Op.gte]: new Date(req.query["created_at[gte]"]) };
    }
    if (req.query["created_at[lte]"]) {
      options.where.created_at = {
        ...(options.where.created_at || {}),
        [Op.lte]: new Date(req.query["created_at[lte]"]),
      };
    }

    // 🧮 Rich summary aggregation
    const records = await PharmacyTransaction.findAll({
      where: options.where,
      include: [
        {
          model: PrescriptionItem,
          as: "prescriptionItem",
          attributes: [],
          include: [
            {
              model: sequelize.models.BillableItem,
              as: "billableItem",
              attributes: [],
            },
          ],
        },
      ],
      attributes: [
        [sequelize.col("prescriptionItem->billableItem.name"), "medication_name"],
        [sequelize.fn("SUM", sequelize.col("prescriptionItem.quantity")), "total_requested"],
        [sequelize.fn("SUM", sequelize.col("PharmacyTransaction.quantity_dispensed")), "total_dispensed"],
        [
          sequelize.fn(
            "SUM",
            sequelize.literal(`CASE WHEN "PharmacyTransaction"."status" = 'pending' THEN 1 ELSE 0 END`)
          ),
          "pending_count",
        ],
        [
          sequelize.fn(
            "SUM",
            sequelize.literal(`CASE WHEN "PharmacyTransaction"."status" = 'partially_dispensed' THEN 1 ELSE 0 END`)
          ),
          "partial_count",
        ],
        [
          sequelize.fn(
            "SUM",
            sequelize.literal(`CASE WHEN "PharmacyTransaction"."status" = 'dispensed' THEN 1 ELSE 0 END`)
          ),
          "dispensed_count",
        ],
        [
          sequelize.fn(
            "SUM",
            sequelize.literal(`CASE WHEN "PharmacyTransaction"."status" = 'verified' THEN 1 ELSE 0 END`)
          ),
          "verified_count",
        ],
        [
          sequelize.fn(
            "SUM",
            sequelize.literal(`CASE WHEN "PharmacyTransaction"."status" = 'returned' THEN 1 ELSE 0 END`)
          ),
          "returned_count",
        ],
        [
          sequelize.fn(
            "SUM",
            sequelize.literal(`CASE WHEN "PharmacyTransaction"."status" = 'voided' THEN 1 ELSE 0 END`)
          ),
          "voided_count",
        ],
        [
          sequelize.literal(
            `SUM(CAST("prescriptionItem->billableItem"."price" AS NUMERIC) * "PharmacyTransaction"."quantity_dispensed")`
          ),
          "total_value",
        ],
        [sequelize.fn("COUNT", sequelize.col("PharmacyTransaction.id")), "transaction_count"],
      ],
      group: [sequelize.col("prescriptionItem->billableItem.name")],
      order: [[sequelize.literal("total_dispensed"), "DESC"]],
      raw: true,
    });

    // 🧾 Add Grand Total row
    const grandTotals = records.reduce(
      (acc, r) => {
        acc.total_requested += parseFloat(r.total_requested || 0);
        acc.total_dispensed += parseFloat(r.total_dispensed || 0);
        acc.pending_count += parseInt(r.pending_count || 0);
        acc.partial_count += parseInt(r.partial_count || 0);
        acc.dispensed_count += parseInt(r.dispensed_count || 0);
        acc.verified_count += parseInt(r.verified_count || 0);
        acc.returned_count += parseInt(r.returned_count || 0);
        acc.voided_count += parseInt(r.voided_count || 0);
        acc.total_value += parseFloat(r.total_value || 0);
        acc.transaction_count += parseInt(r.transaction_count || 0);
        return acc;
      },
      {
        medication_name: "GRAND TOTAL",
        total_requested: 0,
        total_dispensed: 0,
        pending_count: 0,
        partial_count: 0,
        dispensed_count: 0,
        verified_count: 0,
        returned_count: 0,
        voided_count: 0,
        total_value: 0,
        transaction_count: 0,
      }
    );

    records.push(grandTotals);

    return success(res, "✅ Pharmacy Summary loaded", records);
  } catch (err) {
    console.error("❌ getPharmacyTransactionSummary failed:", err);
    return error(res, "❌ Failed to load pharmacy summary", err);
  }
};
