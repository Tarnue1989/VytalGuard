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
import { validatePaginationStrict } from "../utils/query-utils.js";
import { success, error } from "../utils/response.js";
import { buildQueryOptions } from "../utils/queryHelper.js";
import { normalizeDateRangeLocal } from "../utils/date-utils.js";
import { resolveOrgFacility } from "../utils/resolveOrgFacility.js";
import { validate } from "../utils/validation.js";
import {
  isSuperAdmin,
  isOrgLevelUser,
  isFacilityHead,
} from "../utils/role-utils.js";
import { makeModuleLogger } from "../utils/debugLogger.js";

import { DISCOUNT_STATUS } from "../constants/enums.js";
import { FIELD_VISIBILITY_DISCOUNT } from "../constants/fieldVisibility.js";

import { authzService } from "../services/authzService.js";
import { auditService } from "../services/auditService.js";
import { financialService } from "../services/financialService.js";
import { recalcInvoice } from "../utils/invoiceUtil.js";
import { buildDynamicSummary } from "../utils/summaryHelper.js";

/* ============================================================
   🔐 MODULE
============================================================ */
const MODULE_KEY = "discounts";

/* ============================================================
   🔧 LOCAL DEBUG OVERRIDE
============================================================ */
const DEBUG_OVERRIDE = false;
const debug = makeModuleLogger("discountController", DEBUG_OVERRIDE);

/* ============================================================
   🔖 STATUS MAP (ENUM SAFE)
============================================================ */
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
   📋 ROLE-AWARE JOI SCHEMA (MASTER PARITY)
============================================================ */
function buildDiscountSchema(userRole, mode = "create") {
  const base = {
    invoice_id: Joi.string().uuid().allow(null),
    invoice_item_id: Joi.string().uuid().allow(null),
    discount_policy_id: Joi.string().uuid().allow(null),

    type: Joi.string().valid("percentage", "fixed").required(),
    value: Joi.number().positive().required(),
    reason: Joi.string().min(mode === "update" ? 5 : 3).required(),
    name: Joi.string().allow(null, ""),

    status: Joi.forbidden(),
    organization_id: Joi.forbidden(),
    facility_id: Joi.forbidden(),
  };

  if (mode === "update") {
    Object.keys(base).forEach((k) => (base[k] = base[k].optional()));
    base.reason = Joi.string().min(5).required();
  }

  return Joi.object(base).or(
    "invoice_id",
    "invoice_item_id",
    "discount_policy_id"
  );
}

/* ============================================================
   📌 GET ALL DISCOUNTS (MASTER + SUMMARY – FIXED TENANT)
============================================================ */
export const getAllDiscounts = async (req, res) => {
  try {
    /* ========================================================
       🔐 AUTHORIZATION (MASTER)
    ======================================================== */
    const allowed = await authzService.checkPermission({
      user: req.user,
      module: MODULE_KEY,
      action: "read",
      res,
    });
    if (!allowed) return;

    /* ========================================================
       🔎 STRICT PAGINATION (MASTER)
    ======================================================== */
    const { limit, page, offset } = validatePaginationStrict(req, {
      limit: 25,
      maxLimit: 200,
    });

    const role = (req.user?.roleNames?.[0] || "staff").toLowerCase();
    const visibleFields =
      FIELD_VISIBILITY_DISCOUNT[role] || FIELD_VISIBILITY_DISCOUNT.staff;

    /* ========================================================
       🧹 STRIP UI-ONLY PARAMS (MASTER)
    ======================================================== */
    const { dateRange, ...safeQuery } = req.query;
    safeQuery.limit = limit;
    safeQuery.page = page;
    req.query = safeQuery;

    const options = buildQueryOptions(
      req,
      "created_at",
      "DESC",
      visibleFields
    );

    options.where = { [Op.and]: [] };

    /* ========================================================
       📅 DATE RANGE
    ======================================================== */
    if (dateRange) {
      const { start, end } = normalizeDateRangeLocal(dateRange);
      if (start && end) {
        options.where[Op.and].push({
          created_at: { [Op.between]: [start, end] },
        });
      }
    }

    /* ========================================================
       🔐 TENANT SCOPE (FIXED – MASTER PARITY)
    ======================================================== */
    if (!isSuperAdmin(req.user)) {
      // ✅ Org always enforced
      options.where[Op.and].push({
        organization_id: req.user.organization_id,
      });

      // ✅ FIX: multi-facility support
      if (
        Array.isArray(req.user.facility_ids) &&
        req.user.facility_ids.length > 0
      ) {
        options.where[Op.and].push({
          [Op.or]: [
            { facility_id: { [Op.in]: req.user.facility_ids } },
            { facility_id: null },
          ],
        });
      }

      // ✅ Org-level override (same as Payment)
      if (isOrgLevelUser(req.user) && req.query.facility_id) {
        options.where[Op.and].push({
          facility_id: req.query.facility_id,
        });
      }
    } else {
      // ✅ Superadmin filters
      if (req.query.organization_id) {
        options.where[Op.and].push({
          organization_id: req.query.organization_id,
        });
      }
      if (req.query.facility_id) {
        options.where[Op.and].push({
          facility_id: req.query.facility_id,
        });
      }
    }

    /* ========================================================
       🎯 FILTERS
    ======================================================== */
    if (req.query.status) {
      options.where[Op.and].push({ status: req.query.status });
    }

    if (req.query.type) {
      options.where[Op.and].push({ type: req.query.type });
    }

    /* ========================================================
       🔍 GLOBAL SEARCH
    ======================================================== */
    if (options.search) {
      options.where[Op.and].push({
        [Op.or]: [
          { reason: { [Op.iLike]: `%${options.search}%` } },
          { type: { [Op.iLike]: `%${options.search}%` } },
        ],
      });
    }

    /* ========================================================
       🗂️ MAIN QUERY
    ======================================================== */
    const { count, rows } = await Discount.findAndCountAll({
      where: options.where,
      include: DISCOUNT_INCLUDES,
      order: options.order,
      offset,
      limit,
      distinct: true,
    });

    /* ========================================================
       🔢 SUMMARY
    ======================================================== */
    const summary = { total: count };

    const statusCounts = await Discount.findAll({
      where: options.where,
      attributes: [
        "status",
        [sequelize.fn("COUNT", sequelize.col("id")), "count"],
      ],
      group: ["status"],
    });

    Object.values(DS).forEach((status) => {
      const found = statusCounts.find((s) => s.status === status);
      summary[status] = found ? Number(found.get("count")) : 0;
    });

    /* ========================================================
       🧾 AUDIT LOG
    ======================================================== */
    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "list",
      details: {
        query: safeQuery,
        returned: count,
        pagination: { page, limit },
      },
    });

    /* ========================================================
       ✅ RESPONSE
    ======================================================== */
    return success(res, "✅ Discounts loaded", {
      records: rows,
      summary,
      pagination: {
        total: count,
        page,
        limit,
        pageCount: Math.ceil(count / limit),
      },
    });
  } catch (err) {
    debug.error("getAllDiscounts → FAILED", err);
    if (err.statusCode === 400) {
      return error(res, err.message, null, 400);
    }
    return error(res, "❌ Failed to load discounts", err);
  }
};

/* ============================================================
   📌 GET DISCOUNT BY ID
============================================================ */
export const getDiscountById = async (req, res) => {
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module: MODULE_KEY,
      action: "read",
      res,
    });
    if (!allowed) return;

    const where = { id: req.params.id };

    if (!isSuperAdmin(req.user)) {
      where.organization_id = req.user.organization_id;
      if (isFacilityHead(req.user)) {
        where.facility_id = req.user.facility_id;
      }
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
      entityId: record.id,
      entity: record,
    });

    return success(res, "✅ Discount loaded", record);
  } catch (err) {
    return error(res, "❌ Failed to load discount", err);
  }
};

/* ============================================================
   📌 CREATE DISCOUNT
============================================================ */
export const createDiscount = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const role = (req.user?.roleNames?.[0] || "").toLowerCase();

    const { value, errors } = validate(
      buildDiscountSchema(role, "create"),
      req.body
    );

    if (errors) {
      await t.rollback();
      return error(res, "Validation failed", errors, 400);
    }

    const { orgId, facilityId } = resolveOrgFacility({
      user: req.user,
      value,
      body: req.body,
    });

    const record = await financialService.createDiscount({
      ...value,
      organization_id: orgId,
      facility_id: facilityId,
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
    });

    return success(res, "✅ Discount created", record);
  } catch (err) {
    if (t && !t.finished) await t.rollback();
    return error(res, "❌ Failed to create discount", err);
  }
};

/* ============================================================
   📌 UPDATE / TOGGLE / FINALIZE / VOID / RESTORE / DELETE
   🔹 SERVICE CONTROLLED (PARITY SAFE)
============================================================ */

export const updateDiscount = async (req, res) => {
  try {
    const record = await financialService.updateDiscount({
      id: req.params.id,
      payload: req.body,
      user: req.user,
    });

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "update",
      entityId: record.id,
      entity: record,
    });

    return success(res, "✅ Discount updated", record);
  } catch (err) {
    return error(res, "❌ Failed to update discount", err);
  }
};

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
      entityId: record.id,
      entity: record,
    });

    return success(res, `✅ Discount status set to ${record.status}`, record);
  } catch (err) {
    return error(res, "❌ Failed to toggle discount status", err);
  }
};

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
      entityId: record.id,
      entity: record,
    });

    return success(res, "✅ Discount finalized", record);
  } catch (err) {
    if (t && !t.finished) await t.rollback();
    return error(res, "❌ Failed to finalize discount", err);
  }
};

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
      entityId: record.id,
      entity: record,
    });

    return success(res, "✅ Discount voided", record);
  } catch (err) {
    if (t && !t.finished) await t.rollback();
    return error(res, "❌ Failed to void discount", err);
  }
};

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
      entityId: record.id,
      entity: record,
    });

    return success(res, "✅ Discount restored", record);
  } catch (err) {
    if (t && !t.finished) await t.rollback();
    return error(res, "❌ Failed to restore discount", err);
  }
};

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
      entityId: record.id,
      entity: record,
    });

    return success(res, "✅ Discount deleted", record);
  } catch (err) {
    return error(res, "❌ Failed to delete discount", err);
  }
};
/* ============================================================
   📌 GET ALL DISCOUNTS (LITE)
============================================================ */
export const getAllDiscountsLite = async (req, res) => {
  try {
    const where = {};

    if (req.query.q) {
      where.reason = { [Op.iLike]: `%${req.query.q}%` };
    }

    if (!isSuperAdmin(req.user)) {
      where.organization_id = req.user.organization_id;
      if (isFacilityHead(req.user)) {
        where.facility_id = req.user.facility_id;
      }
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
