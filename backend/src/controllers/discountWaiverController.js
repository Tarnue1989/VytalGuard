// 📁 backend/src/controllers/discountWaiverController.js
// ============================================================================
// 🧾 Discount Waiver Controller – Enterprise Master Pattern (v2.5 Aligned)
// ----------------------------------------------------------------------------
// 🔹 Unified permission, validation, and lifecycle logic
// 🔹 Automatically triggers recalculation during finalize/void
// 🔹 Full audit logging (create/update/approve/reject/void/finalize/restore/delete)
// 🔹 Includes lifecycle + aggregate summary
// 🔹 Fully tenant-safe (organization/facility scoped)
// ============================================================================

import Joi from "joi";
import { Op } from "sequelize";
import {
  sequelize,
  DiscountWaiver,
  Invoice,
  Patient,
  Organization,
  Facility,
  User,
  Employee,
} from "../models/index.js";
import { success, error } from "../utils/response.js";
import { buildQueryOptions } from "../utils/queryHelper.js";
import { DISCOUNT_WAIVER_STATUS } from "../constants/enums.js";
import { authzService } from "../services/authzService.js";
import { auditService } from "../services/auditService.js";
import { FIELD_VISIBILITY_DISCOUNT_WAIVER } from "../constants/fieldVisibility.js";
import { financialService } from "../services/financialService.js";
import { buildDynamicSummary } from "../utils/summaryHelper.js"; // 🧠 Summary Helper

const MODULE_KEY = "discount_waiver";

// 🔖 Local enum map
const WS = {
  PENDING: DISCOUNT_WAIVER_STATUS[0],
  APPROVED: DISCOUNT_WAIVER_STATUS[1],
  APPLIED: DISCOUNT_WAIVER_STATUS[2],
  REJECTED: DISCOUNT_WAIVER_STATUS[3],
  VOIDED: DISCOUNT_WAIVER_STATUS[4],
  FINALIZED: DISCOUNT_WAIVER_STATUS[5],
};

/* ============================================================
   🔧 ROLE CHECK HELPER
============================================================ */
function isSuperAdmin(user) {
  if (!user) return false;
  const roles = Array.isArray(user.roleNames) ? user.roleNames : [user.role || ""];
  return roles.map((r) => r.toLowerCase()).includes("superadmin");
}

/* ============================================================
   🔗 SHARED INCLUDES
============================================================ */
const WAIVER_INCLUDES = [
  { model: Organization, as: "organization", attributes: ["id", "name", "code"] },
  { model: Facility, as: "facility", attributes: ["id", "name", "code", "organization_id"] },
  { model: Invoice, as: "invoice", attributes: ["id", "invoice_number", "status", "total", "balance"] },
  { model: Patient, as: "patient", attributes: ["id", "pat_no", "first_name", "last_name"] },
  { model: Employee, as: "approvedByEmployee", attributes: ["id", "first_name", "last_name"] },
  // Audit & Lifecycle
  { model: User, as: "createdBy", attributes: ["id", "first_name", "last_name"] },
  { model: User, as: "updatedBy", attributes: ["id", "first_name", "last_name"] },
  { model: User, as: "deletedBy", attributes: ["id", "first_name", "last_name"] },
  { model: User, as: "approvedBy", attributes: ["id", "first_name", "last_name"] },
  { model: User, as: "rejectedBy", attributes: ["id", "first_name", "last_name"] },
  { model: User, as: "voidedBy", attributes: ["id", "first_name", "last_name"] },
  { model: User, as: "finalizedBy", attributes: ["id", "first_name", "last_name"] },
];

/* ============================================================
   📋 JOI SCHEMA
============================================================ */
function buildWaiverSchema() {
  return Joi.object({
    invoice_id: Joi.string().uuid().required(),
    patient_id: Joi.string().uuid().required(),
    type: Joi.string().valid("percentage", "fixed").required(),
    reason: Joi.string().max(500).required(),
    percentage: Joi.when("type", {
      is: "percentage",
      then: Joi.number().min(0).max(100).required(),
      otherwise: Joi.forbidden(),
    }),
    amount: Joi.when("type", {
      is: "fixed",
      then: Joi.number().min(0).required(),
      otherwise: Joi.forbidden(),
    }),
    status: Joi.string().valid(...DISCOUNT_WAIVER_STATUS).default(WS.PENDING),
    organization_id: Joi.string().uuid().allow(null),
    facility_id: Joi.string().uuid().allow(null),
  });
}

/* ============================================================
   📌 GET ALL WAIVERS (with Dynamic Summary)
============================================================ */
export const getAllWaivers = async (req, res) => {
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
      FIELD_VISIBILITY_DISCOUNT_WAIVER[role] || FIELD_VISIBILITY_DISCOUNT_WAIVER.staff;

    const options = buildQueryOptions(req, "created_at", "DESC", visibleFields);
    options.where = options.where || {};

    // 🏢 Tenant scope
    if (!isSuperAdmin(req.user)) {
      options.where.organization_id = req.user.organization_id;
      if (role === "facility_head") options.where.facility_id = req.user.facility_id;
    } else {
      if (req.query.organization_id) options.where.organization_id = req.query.organization_id;
      if (req.query.facility_id) options.where.facility_id = req.query.facility_id;
    }

    // 🔍 Filters
    if (req.query.status) options.where.status = req.query.status;
    if (req.query.type) options.where.type = req.query.type;

    // 🔎 Search
    if (options.search) {
      const term = `%${options.search}%`;
      options.where[Op.or] = [{ reason: { [Op.iLike]: term } }];
    }

    // 📦 Fetch data
    const { count, rows } = await DiscountWaiver.findAndCountAll({
      where: options.where,
      include: WAIVER_INCLUDES,
      order: options.order,
      offset: options.offset,
      limit: options.limit,
      distinct: true,
    });

    // 🧠 Lifecycle + Aggregate Summary
    const summary = await buildDynamicSummary({
      model: DiscountWaiver,
      options,
      statusEnums: Object.values(DISCOUNT_WAIVER_STATUS),
    });

    // 🧾 Audit
    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "list",
      details: { query: req.query, returned: count },
    });

    // ✅ Unified Response
    return success(res, "✅ Waivers loaded", {
      records: rows,
      pagination: {
        total: count,
        page: options.pagination.page,
        pageCount: Math.ceil(count / options.pagination.limit),
      },
      summary,
    });
  } catch (err) {
    return error(res, "❌ Failed to load waivers", err);
  }
};

/* ============================================================
   📌 GET WAIVER BY ID
============================================================ */
export const getWaiverById = async (req, res) => {
  try {
    const where = { id: req.params.id };
    if (!isSuperAdmin(req.user)) where.organization_id = req.user.organization_id;

    const record = await DiscountWaiver.findOne({ where, include: WAIVER_INCLUDES });
    if (!record) return error(res, "❌ Waiver not found", null, 404);

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "view",
      entityId: req.params.id,
      entity: record,
    });

    return success(res, "✅ Waiver loaded", record);
  } catch (err) {
    return error(res, "❌ Failed to load waiver", err);
  }
};

/* ============================================================
   📌 CREATE WAIVER
============================================================ */
export const createWaiver = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const schema = buildWaiverSchema();
    const { error: validationError, value } = schema.validate(req.body, { stripUnknown: true });
    if (validationError) {
      await t.rollback();
      return error(res, "Validation failed", validationError, 400);
    }

    const invoice = await Invoice.findByPk(value.invoice_id, { transaction: t });
    if (!invoice) {
      await t.rollback();
      return error(res, "❌ Invoice not found", null, 404);
    }

    const baseTotal = parseFloat(invoice.total) || 0;
    const appliedTotal =
      value.type === "percentage"
        ? (baseTotal * (parseFloat(value.percentage) || 0)) / 100
        : parseFloat(value.amount) || 0;

    const balance = parseFloat(invoice.balance || 0);
    if (appliedTotal > balance) {
      await t.rollback();
      return error(res, "❌ Waiver exceeds invoice balance", null, 400);
    }

    const record = await DiscountWaiver.create(
      {
        ...value,
        applied_total: appliedTotal.toFixed(2),
        organization_id: value.organization_id || req.user.organization_id,
        facility_id: value.facility_id || req.user.facility_id,
        created_by_id: req.user.id,
      },
      { transaction: t }
    );

    await t.commit();
    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "create",
      entityId: record.id,
      entity: record,
    });

    return success(res, "✅ Waiver created", record);
  } catch (err) {
    if (t && !t.finished) await t.rollback();
    return error(res, "❌ Failed to create waiver", err);
  }
};

/* ============================================================
   📌 UPDATE WAIVER
============================================================ */
export const updateWaiver = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const record = await DiscountWaiver.findByPk(req.params.id, { transaction: t });
    if (!record) {
      await t.rollback();
      return error(res, "❌ Waiver not found", null, 404);
    }

    const schema = buildWaiverSchema();
    const { error: validationError, value } = schema.validate(req.body, { stripUnknown: true });
    if (validationError) {
      await t.rollback();
      return error(res, "Validation failed", validationError, 400);
    }

    const invoice = await Invoice.findByPk(record.invoice_id, { transaction: t });
    if (!invoice) {
      await t.rollback();
      return error(res, "❌ Invoice not found for waiver", null, 404);
    }

    const baseTotal = parseFloat(invoice.total) || 0;
    const appliedTotal =
      value.type === "percentage"
        ? (baseTotal * (parseFloat(value.percentage) || 0)) / 100
        : parseFloat(value.amount) || 0;

    const balance = parseFloat(invoice.balance || 0);
    if (appliedTotal > balance) {
      await t.rollback();
      return error(res, "❌ Waiver exceeds invoice balance", null, 400);
    }

    await record.update(
      {
        ...value,
        applied_total: appliedTotal.toFixed(2),
        updated_by_id: req.user.id,
      },
      { transaction: t }
    );

    await t.commit();
    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "update",
      entityId: req.params.id,
      entity: record,
    });

    return success(res, "✅ Waiver updated", record);
  } catch (err) {
    if (t && !t.finished) await t.rollback();
    return error(res, "❌ Failed to update waiver", err);
  }
};

/* ============================================================
   📌 LIFECYCLE ACTIONS – APPROVE / REJECT / VOID / FINALIZE
============================================================ */
export const approveWaiver = async (req, res) => {
  try {
    const record = await DiscountWaiver.findByPk(req.params.id);
    if (!record) return error(res, "❌ Waiver not found", null, 404);

    await record.update({
      status: WS.APPROVED,
      approved_by_id: req.user.id,
      approved_at: new Date(),
    });

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "approve",
      entityId: record.id,
      entity: record,
    });

    return success(res, "✅ Waiver approved", record);
  } catch (err) {
    return error(res, "❌ Failed to approve waiver", err);
  }
};

export const rejectWaiver = async (req, res) => {
  try {
    const record = await DiscountWaiver.findByPk(req.params.id);
    if (!record) return error(res, "❌ Waiver not found", null, 404);

    await record.update({
      status: WS.REJECTED,
      rejected_by_id: req.user.id,
      rejected_at: new Date(),
    });

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "reject",
      entityId: record.id,
      entity: record,
    });

    return success(res, "✅ Waiver rejected", record);
  } catch (err) {
    return error(res, "❌ Failed to reject waiver", err);
  }
};

export const voidWaiver = async (req, res) => {
  try {
    const record = await DiscountWaiver.findByPk(req.params.id);
    if (!record) return error(res, "❌ Waiver not found", null, 404);

    await record.update({
      status: WS.VOIDED,
      voided_by_id: req.user.id,
      voided_at: new Date(),
      void_reason: req.body?.void_reason || null,
    });

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "void",
      entityId: record.id,
      entity: record,
    });

    return success(res, "✅ Waiver voided", record);
  } catch (err) {
    return error(res, "❌ Failed to void waiver", err);
  }
};

export const finalizeWaiver = async (req, res) => {
  try {
    const { waiver, invoice } = await financialService.finalizeWaiver(req.params.id, req.user);

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "finalize",
      entityId: waiver.id,
      entity: waiver,
    });

    return success(res, "✅ Waiver finalized & applied", { waiver, invoice });
  } catch (err) {
    return error(res, "❌ Failed to finalize waiver", err);
  }
};

/* ============================================================
   📌 DELETE & RESTORE
============================================================ */
export const deleteWaiver = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const record = await DiscountWaiver.findByPk(req.params.id, { transaction: t });
    if (!record) {
      await t.rollback();
      return error(res, "❌ Waiver not found", null, 404);
    }

    await record.update({ deleted_by_id: req.user.id }, { transaction: t });
    await record.destroy({ transaction: t });
    await t.commit();

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "delete",
      entityId: req.params.id,
      entity: record,
    });

    return success(res, "✅ Waiver deleted", record);
  } catch (err) {
    if (t && !t.finished) await t.rollback();
    return error(res, "❌ Failed to delete waiver", err);
  }
};

/* ============================================================
   📌 RESTORE WAIVER (supports both deleted + voided)
============================================================ */
export const restoreWaiver = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const record = await DiscountWaiver.findOne({
      where: { id: req.params.id },
      paranoid: false, // include soft-deleted
      transaction: t,
    });

    if (!record) {
      await t.rollback();
      return error(res, "❌ Waiver not found", null, 404);
    }

    // 🧠 CASE 1: Soft-deleted
    if (record.deleted_at) {
      await record.restore({ transaction: t });
      await record.update(
        {
          status: WS.PENDING, // re-open for review
          updated_by_id: req.user.id,
        },
        { transaction: t }
      );
      await t.commit();

      await auditService.logAction({
        user: req.user,
        module: MODULE_KEY,
        action: "restore",
        entityId: record.id,
        entity: record,
        details: { source: "deleted" },
      });

      return success(res, "✅ Waiver restored from deleted state", record);
    }

    // 🧠 CASE 2: Voided
    if (record.status === WS.VOIDED) {
      await record.update(
        {
          status: WS.PENDING, // back to pending or "approved" if preferred
          voided_at: null,
          voided_by_id: null,
          void_reason: null,
          updated_by_id: req.user.id,
        },
        { transaction: t }
      );
      await t.commit();

      await auditService.logAction({
        user: req.user,
        module: MODULE_KEY,
        action: "restore",
        entityId: record.id,
        entity: record,
        details: { source: "voided" },
      });

      return success(res, "✅ Voided waiver restored", record);
    }

    // 🧠 CASE 3: Rejected (optional)
    if (record.status === WS.REJECTED) {
      await record.update(
        {
          status: WS.PENDING,
          rejected_at: null,
          rejected_by_id: null,
          updated_by_id: req.user.id,
        },
        { transaction: t }
      );
      await t.commit();

      await auditService.logAction({
        user: req.user,
        module: MODULE_KEY,
        action: "restore",
        entityId: record.id,
        entity: record,
        details: { source: "rejected" },
      });

      return success(res, "✅ Rejected waiver restored", record);
    }

    // ❌ none matched
    await t.rollback();
    return error(res, "⚠️ Waiver is not deleted, voided, or rejected", null, 400);
  } catch (err) {
    if (t && !t.finished) await t.rollback();
    return error(res, "❌ Failed to restore waiver", err);
  }
};


/* ============================================================
   📌 LITE FETCH
============================================================ */
export const getAllWaiversLite = async (req, res) => {
  try {
    const { q } = req.query;
    const where = {};
    if (q) where.reason = { [Op.iLike]: `%${q}%` };

    if (!isSuperAdmin(req.user)) {
      where.organization_id = req.user.organization_id;
      const role = (req.user?.roleNames?.[0] || "").toLowerCase();
      if (role === "facility_head") where.facility_id = req.user.facility_id;
    }

    const records = await DiscountWaiver.findAll({
      where,
      attributes: ["id", "invoice_id", "patient_id", "status", "type", "percentage", "amount", "applied_total"],
      order: [["created_at", "DESC"]],
      limit: 20,
    });

    return success(res, "✅ Waivers loaded (lite)", { records });
  } catch (err) {
    return error(res, "❌ Failed to load waivers (lite)", err);
  }
};
