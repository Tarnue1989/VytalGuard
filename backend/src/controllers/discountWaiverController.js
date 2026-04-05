// 📁 backend/src/controllers/discountWaiverController.js
// ============================================================================
// 🧾 Discount Waiver Controller – Enterprise Master Pattern (v2.5 Aligned)
// ----------------------------------------------------------------------------
// 🔹 Unified permission, validation, and lifecycle logic
// 🔹 Financial mutations delegated to financialService
// 🔹 Full audit logging
// 🔹 Dynamic lifecycle + aggregate summary
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

import { DISCOUNT_WAIVER_STATUS, CURRENCY } from "../constants/enums.js";
import { FIELD_VISIBILITY_DISCOUNT_WAIVER } from "../constants/fieldVisibility.js";

import { authzService } from "../services/authzService.js";
import { auditService } from "../services/auditService.js";
import { financialService } from "../services/financialService.js";
import { buildDynamicSummary } from "../utils/summaryHelper.js";

/* ============================================================
   🔐 MODULE
============================================================ */
const MODULE_KEY = "discount_waiver";

/* ============================================================
   🔧 DEBUG
============================================================ */
const DEBUG_OVERRIDE = false;
const debug = makeModuleLogger("discountWaiverController", DEBUG_OVERRIDE);

/* ============================================================
   🔖 STATUS MAP (ENUM SAFE)
============================================================ */
const WS = {
  PENDING: DISCOUNT_WAIVER_STATUS.PENDING,
  APPROVED: DISCOUNT_WAIVER_STATUS.APPROVED,
  APPLIED: DISCOUNT_WAIVER_STATUS.APPLIED,
  REJECTED: DISCOUNT_WAIVER_STATUS.REJECTED,
  VOIDED: DISCOUNT_WAIVER_STATUS.VOIDED,
  FINALIZED: DISCOUNT_WAIVER_STATUS.FINALIZED,
};

/* ============================================================
   🔗 SHARED INCLUDES
============================================================ */
const WAIVER_INCLUDES = [
  { model: Organization, as: "organization", attributes: ["id", "name", "code"] },
  { model: Facility, as: "facility", attributes: ["id", "name", "code", "organization_id"] },
  { model: Invoice, as: "invoice", attributes: ["id", "invoice_number", "status", "total", "balance"] },
  { model: Patient, as: "patient", attributes: ["id", "pat_no", "first_name", "last_name"] },
  { model: Employee, as: "approvedByEmployee", attributes: ["id", "first_name", "last_name"] },
  { model: User, as: "createdBy", attributes: ["id", "first_name", "last_name"] },
  { model: User, as: "updatedBy", attributes: ["id", "first_name", "last_name"] },
  { model: User, as: "deletedBy", attributes: ["id", "first_name", "last_name"] },
  { model: User, as: "approvedBy", attributes: ["id", "first_name", "last_name"] },
  { model: User, as: "rejectedBy", attributes: ["id", "first_name", "last_name"] },
  { model: User, as: "voidedBy", attributes: ["id", "first_name", "last_name"] },
  { model: User, as: "finalizedBy", attributes: ["id", "first_name", "last_name"] },
];

/* ============================================================
   📋 VALIDATION (MASTER PARITY — FIXED)
============================================================ */
function buildWaiverSchema(mode = "create") {
  const base = {
    invoice_id: Joi.string().uuid().required(),

    // 🔒 DERIVED — NEVER ACCEPT FROM CLIENT
    patient_id: Joi.forbidden(),
    currency: Joi.forbidden(), // 🔥 FIXED

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

    status: Joi.forbidden(),
    organization_id: Joi.forbidden(),
    facility_id: Joi.forbidden(),
  };

  if (mode === "update") {
    Object.keys(base).forEach((k) => (base[k] = base[k].optional()));
    base.reason = Joi.string().max(500).required();
  }

  return Joi.object(base);
}

/* ============================================================
   📌 CREATE WAIVER (MASTER PARITY WITH DISCOUNT)
============================================================ */
export const createWaiver = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    // 🔐 Validate request body (patient_id is FORBIDDEN here)
    const { value, errors } = validate(buildWaiverSchema("create"), req.body);
    if (errors) {
      await t.rollback();
      return error(res, "Validation failed", errors, 400);
    }

    // 🔐 Resolve tenant scope (org / facility)
    const { orgId, facilityId } = resolveOrgFacility({
      user: req.user,
      value,
      body: req.body,
    });

    // 💰 Delegate ALL financial logic to service
    // 🔥 patient_id is derived INSIDE the service from invoice_id
    const record = await financialService.createWaiver({
      ...value,
      organization_id: orgId,
      facility_id: facilityId,
      user: req.user,
      transaction: t,
    });

    await t.commit();

    // 🧾 Audit log (MASTER)
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
   📌 UPDATE / APPROVE / REJECT / VOID / FINALIZE / RESTORE / DELETE
   🔹 SERVICE CONTROLLED (MASTER PARITY)
============================================================ */

export const updateWaiver = async (req, res) => {
  try {
    const record = await financialService.updateWaiver({
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

    return success(res, "✅ Waiver updated", record);
  } catch (err) {
    return error(res, "❌ Failed to update waiver", err);
  }
};

/* ============================================================
   📌 GET ALL WAIVERS (MASTER + SUMMARY — FIXED TENANT)
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

    const { limit, page, offset } = validatePaginationStrict(req, {
      limit: 25,
      maxLimit: 200,
    });

    const role = (req.user?.roleNames?.[0] || "staff").toLowerCase();
    const visibleFields =
      FIELD_VISIBILITY_DISCOUNT_WAIVER[role] ||
      FIELD_VISIBILITY_DISCOUNT_WAIVER.staff;

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

    if (dateRange) {
      const { start, end } = normalizeDateRangeLocal(dateRange);
      if (start && end) {
        options.where[Op.and].push({
          created_at: { [Op.between]: [start, end] },
        });
      }
    }

    if (!isSuperAdmin(req.user)) {
      options.where[Op.and].push({
        organization_id: req.user.organization_id,
      });

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

      if (isOrgLevelUser(req.user) && req.query.facility_id) {
        options.where[Op.and].push({
          facility_id: req.query.facility_id,
        });
      }
    } else {
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

    if (req.query.status) {
      const status =
        DISCOUNT_WAIVER_STATUS[req.query.status?.toUpperCase()] ||
        req.query.status;

      options.where[Op.and].push({ status });
    }

    if (req.query.type) {
      options.where[Op.and].push({ type: req.query.type });
    }

    // 🔥 ADD THIS (currency filter)
    if (req.query.currency) {
      options.where[Op.and].push({
        currency: req.query.currency,
      });
    }

    if (options.search) {
      options.where[Op.and].push({
        [Op.or]: [
          { reason: { [Op.iLike]: `%${options.search}%` } },
        ],
      });
    }

    const { count, rows } = await DiscountWaiver.findAndCountAll({
      where: options.where,
      include: WAIVER_INCLUDES,
      order: options.order,
      offset,
      limit,
      distinct: true,
    });

    const summary = { total: count };

    const statusCounts = await DiscountWaiver.findAll({
      where: options.where,
      attributes: [
        "status",
        [sequelize.fn("COUNT", sequelize.col("id")), "count"],
      ],
      group: ["status"],
    });

    Object.values(WS).forEach((status) => {
      const found = statusCounts.find((s) => s.status === status);
      summary[status] = found ? Number(found.get("count")) : 0;
    });

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

    return success(res, "✅ Waivers loaded", {
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
    debug.error("getAllWaivers → FAILED", err);
    if (err.statusCode === 400) {
      return error(res, err.message, null, 400);
    }
    return error(res, "❌ Failed to load waivers", err);
  }
};


/* ============================================================
   📌 LITE FETCH
============================================================ */
export const getAllWaiversLite = async (req, res) => {
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

    const records = await DiscountWaiver.findAll({
      where,
      attributes: [
        "id",
        "invoice_id",
        "patient_id",
        "status",
        "type",
        "percentage",
        "amount",
        "applied_total",
        "currency", // 🔥 ADD THIS
      ],
      order: [["created_at", "DESC"]],
      limit: 20,
    });

    return success(res, "✅ Waivers loaded (lite)", { records });
  } catch (err) {
    return error(res, "❌ Failed to load waivers (lite)", err);
  }
};

/* ============================================================
   📌 GET BY ID
============================================================ */
export const getWaiverById = async (req, res) => {
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

    const record = await DiscountWaiver.findOne({
      where,
      include: WAIVER_INCLUDES,
    });

    if (!record) return error(res, "❌ Waiver not found", null, 404);

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "view",
      entityId: record.id,
      entity: record,
    });

    return success(res, "✅ Waiver loaded", record);
  } catch (err) {
    return error(res, "❌ Failed to load waiver", err);
  }
};




export const approveWaiver = async (req, res) => {
  try {
    const record = await financialService.approveWaiver({
      id: req.params.id,
      user: req.user,
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
    const record = await financialService.rejectWaiver({
      id: req.params.id,
      user: req.user,
      reason: req.body?.reason,
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
    const record = await financialService.voidWaiver({
      id: req.params.id,
      reason: req.body?.void_reason,
      user: req.user,
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
    const result = await financialService.finalizeWaiver(
      req.params.id,
      req.user
    );

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "finalize",
      entityId: result.waiver.id,
      entity: result.waiver,
    });

    return success(res, "✅ Waiver finalized", result);
  } catch (err) {
    return error(res, "❌ Failed to finalize waiver", err);
  }
};

export const restoreWaiver = async (req, res) => {
  try {
    const record = await financialService.restoreWaiver({
      id: req.params.id,
      user: req.user,
    });

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "restore",
      entityId: record.id,
      entity: record,
    });

    return success(res, "✅ Waiver restored", record);
  } catch (err) {
    return error(res, "❌ Failed to restore waiver", err);
  }
};

export const deleteWaiver = async (req, res) => {
  try {
    const record = await financialService.deleteWaiver({
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

    return success(res, "✅ Waiver deleted", record);
  } catch (err) {
    return error(res, "❌ Failed to delete waiver", err);
  }
};

