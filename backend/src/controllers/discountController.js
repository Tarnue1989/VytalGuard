// 📁 backend/src/controllers/discountController.js
// ============================================================================
// 💸 Discount Controller – Enterprise Master Pattern (v2.5 Aligned)
// ----------------------------------------------------------------------------
// 🔹 Unified permission, validation, and lifecycle logic
// 🔹 Automatically triggers invoice recalculation on finalize/void/restore
// 🔹 Full audit logging (create/update/toggle/finalize/void/restore/delete)
// 🔹 Includes dynamic lifecycle + aggregate summary
// 🔹 Fully tenant-safe (organization/facility scoped)
// ============================================================================

import Joi from "joi";
import { Op } from "sequelize";
import {
  sequelize,
  Discount,
  Organization,
  Facility,
  User,
  Invoice,
  InvoiceItem,
} from "../models/index.js";
import { success, error } from "../utils/response.js";
import { buildQueryOptions } from "../utils/queryHelper.js";
import { DISCOUNT_STATUS } from "../constants/enums.js";
import { authzService } from "../services/authzService.js";
import { auditService } from "../services/auditService.js";
import { financialService } from "../services/financialService.js";
import { recalcInvoice } from "../utils/invoiceUtil.js";
import { FIELD_VISIBILITY_DISCOUNT } from "../constants/fieldVisibility.js";
import { buildDynamicSummary } from "../utils/summaryHelper.js"; // 🧠 Summary Helper

const MODULE_KEY = "discounts";

// 🔖 Local enum map
const DS = {
  DRAFT: DISCOUNT_STATUS[0],
  ACTIVE: DISCOUNT_STATUS[1],
  INACTIVE: DISCOUNT_STATUS[2],
  FINALIZED: DISCOUNT_STATUS[3],
  VOIDED: DISCOUNT_STATUS[4],
};

/* ============================================================
   🔗 SHARED INCLUDES
============================================================ */
const DISCOUNT_INCLUDES = [
  { model: Organization, as: "organization", attributes: ["id", "name", "code"] },
  { model: Facility, as: "facility", attributes: ["id", "name", "code", "organization_id"] },
  { model: Invoice, as: "invoice", attributes: ["id", "invoice_number", "status", "total", "balance"] },
  { model: InvoiceItem, as: "invoiceItem", attributes: ["id", "description", "quantity", "unit_price", "total"] },
  { model: User, as: "createdBy", attributes: ["id", "first_name", "last_name"] },
  { model: User, as: "updatedBy", attributes: ["id", "first_name", "last_name"] },
  { model: User, as: "deletedBy", attributes: ["id", "first_name", "last_name"] },
  { model: User, as: "finalizedBy", attributes: ["id", "first_name", "last_name"] },
  { model: User, as: "voidedBy", attributes: ["id", "first_name", "last_name"] },
];

/* ============================================================
   📋 JOI SCHEMA
============================================================ */
function buildDiscountSchema(userRole, mode = "create") {
  const base = {
    invoice_id: Joi.string().uuid().allow(null),
    invoice_item_id: Joi.string().uuid().allow(null),
    discount_policy_id: Joi.string().uuid().allow(null),
    type: Joi.string().valid("percentage", "fixed").required(),
    value: Joi.number().positive().required(),
    reason: Joi.string().min(mode === "update" ? 5 : 3).required(),
    organization_id: Joi.string().uuid().allow(null),
    facility_id: Joi.string().uuid().allow(null),
    name: Joi.string().allow(null),
    status: Joi.string().valid(...DISCOUNT_STATUS).default(DS.DRAFT),
  };

  const schema = Joi.object(base).or("invoice_id", "invoice_item_id", "discount_policy_id");

  if (!["superadmin", "org_owner", "admin", "facility_head"].includes(userRole)) {
    schema.describe().keys.status = Joi.forbidden();
  }

  return schema;
}

/* ============================================================
   📌 GET ALL DISCOUNTS (with Dynamic Summary)
============================================================ */
export const getAllDiscounts = async (req, res) => {
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
      FIELD_VISIBILITY_DISCOUNT[role] || FIELD_VISIBILITY_DISCOUNT.staff;

    const options = buildQueryOptions(req, "created_at", "DESC", visibleFields);
    options.where = options.where || {};

    // 🏢 Tenant scoping
    if (!req.user.roleNames?.includes("superadmin")) {
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

    // 🔍 Filters
    if (req.query.status) options.where.status = req.query.status;
    if (req.query.type) options.where.type = req.query.type;

    // 🔎 Search
    if (options.search) {
      const term = `%${options.search}%`;
      options.where[Op.or] = [
        { reason: { [Op.iLike]: term } },
        { type: { [Op.iLike]: term } },
      ];
    }

    // 📦 Fetch records
    const { count, rows } = await Discount.findAndCountAll({
      where: options.where,
      include: DISCOUNT_INCLUDES,
      order: options.order,
      offset: options.offset,
      limit: options.limit,
      distinct: true,
    });

    // 🧠 Lifecycle + Aggregate Summary
    const summary = await buildDynamicSummary({
      model: Discount,
      options,
      statusEnums: Object.values(DISCOUNT_STATUS),
    });

    // 🧾 Audit Trail
    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "list",
      details: { query: req.query, returned: count },
    });

    // ✅ Unified Response
    return success(res, "✅ Discounts loaded", {
      records: rows,
      pagination: {
        total: count,
        page: options.pagination.page,
        pageCount: Math.ceil(count / options.pagination.limit),
      },
      summary, // 🧠 Enterprise Summary
    });
  } catch (err) {
    return error(res, "❌ Failed to load discounts", err);
  }
};

/* ============================================================
   📌 GET DISCOUNT BY ID
============================================================ */
export const getDiscountById = async (req, res) => {
  try {
    const where = { id: req.params.id };
    if (!req.user.roleNames?.includes("superadmin")) {
      where.organization_id = req.user.organization_id;
    }

    const record = await Discount.findOne({
      where,
      include: DISCOUNT_INCLUDES,
    });
    if (!record) return error(res, "❌ Discount not found", null, 404);

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "view",
      entityId: req.params.id,
      entity: record,
    });

    return success(res, "✅ Discount loaded", record);
  } catch (err) {
    return error(res, "❌ Failed to load discount", err);
  }
};

/* ============================================================
   📌 GET ALL DISCOUNTS (Lite)
   🔹 For dropdowns/suggestions
============================================================ */
export const getAllDiscountsLite = async (req, res) => {
  try {
    const { q } = req.query;
    const where = {};

    if (q) {
      where[Op.or] = [
        { reason: { [Op.iLike]: `%${q}%` } },
        { type: { [Op.iLike]: `%${q}%` } },
      ];
    }

    if (!req.user.roleNames?.includes("superadmin")) {
      where.organization_id = req.user.organization_id;
      const role = (req.user?.roleNames?.[0] || "").toLowerCase();
      if (role === "facility_head") where.facility_id = req.user.facility_id;
    }

    const records = await Discount.findAll({
      where,
      attributes: ["id", "type", "value", "reason", "status"],
      order: [["created_at", "DESC"]],
      limit: 20,
    });

    return success(res, "✅ Discounts loaded (lite)", { records });
  } catch (err) {
    return error(res, "❌ Failed to load discounts (lite)", err);
  }
};

/* ============================================================
   📌 CREATE DISCOUNT
============================================================ */
export const createDiscount = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const role = (req.user?.roleNames?.[0] || "").toLowerCase();
    const schema = buildDiscountSchema(role, "create");
    const { error: validationError, value } = schema.validate(req.body, {
      stripUnknown: true,
    });

    if (validationError) {
      await t.rollback();
      return error(res, "Validation failed", validationError, 400);
    }

    const record = await financialService.createDiscount({
      ...value,
      user: req.user,
      transaction: t,
    });

    await t.commit();

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "create",
      entityId: record.id,
      entity: record,
      details: value,
    });

    return success(res, "✅ Discount created", record);
  } catch (err) {
    if (t && !t.finished) await t.rollback();
    return error(res, err.message || "❌ Failed to create discount", err);
  }
};

/* ============================================================
   📌 UPDATE DISCOUNT
============================================================ */
export const updateDiscount = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const role = (req.user?.roleNames?.[0] || "").toLowerCase();
    const schema = buildDiscountSchema(role, "update");
    const { error: validationError, value } = schema.validate(req.body, {
      stripUnknown: true,
    });

    if (validationError) {
      await t.rollback();
      return error(res, "Validation failed", validationError, 400);
    }

    const record = await financialService.updateDiscount({
      id: req.params.id,
      payload: value,
      user: req.user,
      transaction: t,
    });

    await t.commit();

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "update",
      entityId: record.id,
      entity: record,
      details: value,
    });

    return success(res, "✅ Discount updated", record);
  } catch (err) {
    if (t && !t.finished) await t.rollback();
    return error(res, err.message || "❌ Failed to update discount", err);
  }
};

/* ============================================================
   📌 TOGGLE DISCOUNT STATUS
============================================================ */
export const toggleDiscountStatus = async (req, res) => {
  try {
    const record = await financialService.toggleDiscountStatus({
      id: req.params.id,
      user: req.user,
    });

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "toggle_status",
      entityId: req.params.id,
      entity: record,
      details: { status: record.status },
    });

    return success(res, `✅ Discount status set to ${record.status}`, record);
  } catch (err) {
    return error(res, err.message || "❌ Failed to toggle status", err);
  }
};

/* ============================================================
   📌 FINALIZE DISCOUNT (Auto Recalc Invoice)
============================================================ */
export const finalizeDiscount = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const record = await financialService.finalizeDiscount({
      id: req.params.id,
      user: req.user,
      transaction: t,
    });

    if (record.invoice_id) await recalcInvoice(record.invoice_id, t);

    await t.commit();

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "finalize",
      entityId: req.params.id,
      entity: record,
    });

    return success(res, "✅ Discount finalized & invoice recalculated", record);
  } catch (err) {
    if (t && !t.finished) await t.rollback();
    return error(res, err.message || "❌ Failed to finalize discount", err);
  }
};

/* ============================================================
   📌 VOID DISCOUNT (Auto Recalc Invoice)
============================================================ */
export const voidDiscount = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const record = await financialService.voidDiscount({
      id: req.params.id,
      reason: req.body?.reason,
      user: req.user,
      transaction: t,
    });

    if (record.invoice_id) await recalcInvoice(record.invoice_id, t);

    await t.commit();

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "void",
      entityId: req.params.id,
      entity: record,
      details: { reason: req.body?.reason },
    });

    return success(res, "✅ Discount voided & invoice recalculated", record);
  } catch (err) {
    if (t && !t.finished) await t.rollback();
    return error(res, err.message || "❌ Failed to void discount", err);
  }
};

/* ============================================================
   📌 RESTORE DISCOUNT (Auto Recalc Invoice)
============================================================ */
export const restoreDiscount = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const record = await financialService.restoreDiscount({
      id: req.params.id,
      user: req.user,
      transaction: t,
    });

    if (record.invoice_id) await recalcInvoice(record.invoice_id, t);

    await t.commit();

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "restore",
      entityId: req.params.id,
      entity: record,
    });

    return success(res, "✅ Discount restored & invoice recalculated", record);
  } catch (err) {
    if (t && !t.finished) await t.rollback();
    return error(res, err.message || "❌ Failed to restore discount", err);
  }
};

/* ============================================================
   📌 DELETE DISCOUNT
============================================================ */
export const deleteDiscount = async (req, res) => {
  try {
    const record = await financialService.deleteDiscount({
      id: req.params.id,
      user: req.user,
    });

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "delete",
      entityId: req.params.id,
      entity: record,
    });

    return success(res, "✅ Discount deleted", record);
  } catch (err) {
    return error(res, err.message || "❌ Failed to delete discount", err);
  }
};
