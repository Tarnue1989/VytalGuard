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

import { DISCOUNT_WAIVER_STATUS } from "../constants/enums.js";
import { FIELD_VISIBILITY_DISCOUNT_WAIVER } from "../constants/fieldVisibility.js";

import { authzService } from "../services/authzService.js";
import { auditService } from "../services/auditService.js";
import { financialService } from "../services/financialService.js";
import { buildDynamicSummary } from "../utils/summaryHelper.js";

/* ============================================================
   🔐 MODULE
============================================================ */
const MODULE_KEY = "discountWaiver";

/* ============================================================
   🔧 DEBUG
============================================================ */
const DEBUG_OVERRIDE = false;
const debug = makeModuleLogger("discountWaiverController", DEBUG_OVERRIDE);

/* ============================================================
   🔖 STATUS MAP (ENUM SAFE)
============================================================ */
const WS = {
  PENDING: DISCOUNT_WAIVER_STATUS[0],
  APPROVED: DISCOUNT_WAIVER_STATUS[1],
  APPLIED: DISCOUNT_WAIVER_STATUS[2],
  REJECTED: DISCOUNT_WAIVER_STATUS[3],
  VOIDED: DISCOUNT_WAIVER_STATUS[4],
  FINALIZED: DISCOUNT_WAIVER_STATUS[5],
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
   📋 VALIDATION (MASTER PARITY)
============================================================ */
function buildWaiverSchema(mode = "create") {
  const base = {
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
   📌 GET ALL WAIVERS (MASTER + SUMMARY)
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
      FIELD_VISIBILITY_DISCOUNT_WAIVER[role] ||
      FIELD_VISIBILITY_DISCOUNT_WAIVER.staff;

    const options = buildQueryOptions(req, "created_at", "DESC", visibleFields);

    delete options.filters?.dateRange;

    options.where = { [Op.and]: [] };

    const dateRange = normalizeDateRangeLocal(req.query.dateRange);
    if (dateRange) {
      options.where[Op.and].push({
        created_at: { [Op.between]: [dateRange.start, dateRange.end] },
      });
    }

    if (!isSuperAdmin(req.user)) {
      options.where[Op.and].push({ organization_id: req.user.organization_id });
      if (!isOrgLevelUser(req.user)) {
        options.where[Op.and].push({ facility_id: req.user.facility_id });
      }
    } else {
      if (req.query.organization_id)
        options.where[Op.and].push({ organization_id: req.query.organization_id });
      if (req.query.facility_id)
        options.where[Op.and].push({ facility_id: req.query.facility_id });
    }

    if (req.query.status)
      options.where[Op.and].push({ status: req.query.status });

    if (options.search) {
      options.where[Op.and].push({
        reason: { [Op.iLike]: `%${options.search}%` },
      });
    }

    const { count, rows } = await DiscountWaiver.findAndCountAll({
      where: options.where,
      include: WAIVER_INCLUDES,
      order: options.order,
      offset: options.offset,
      limit: options.limit,
      distinct: true,
    });

    const summary = await buildDynamicSummary({
      model: DiscountWaiver,
      baseWhere: options.where,
      statusEnums: Object.values(WS),
    });

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "list",
      details: { query: req.query, returned: count },
    });

    return success(res, "✅ Waivers loaded", {
      records: rows,
      summary,
      pagination: {
        total: count,
        page: options.pagination.page,
        pageCount: Math.ceil(count / options.pagination.limit),
      },
    });
  } catch (err) {
    debug.error("getAllWaivers → FAILED", err);
    return error(res, "❌ Failed to load waivers", err);
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

/* ============================================================
   📌 CREATE
============================================================ */
export const createWaiver = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { value, errors } = validate(buildWaiverSchema("create"), req.body);
    if (errors) {
      await t.rollback();
      return error(res, "Validation failed", errors, 400);
    }

    const { orgId, facilityId } = resolveOrgFacility({
      user: req.user,
      value,
      body: req.body,
    });

    const record = await financialService.createWaiver({
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
      ],
      order: [["created_at", "DESC"]],
      limit: 20,
    });

    return success(res, "✅ Waivers loaded (lite)", { records });
  } catch (err) {
    return error(res, "❌ Failed to load waivers (lite)", err);
  }
};
