// 📁 backend/src/controllers/discountPolicyController.js
// ============================================================================
// 🏷️ Discount Policy Controller – Enterprise Master Pattern (PARITY)
// ----------------------------------------------------------------------------
// 🔹 Unified permission, validation, and lifecycle logic
// 🔹 Role-safe tenant resolution (no hardcoding)
// 🔹 Date-range filtering + search
// 🔹 Full audit logging (create/update/activate/deactivate/expire/delete/restore)
// 🔹 Dynamic lifecycle + aggregate summary
// ============================================================================

import Joi from "joi";
import { Op } from "sequelize";
import {
  sequelize,
  DiscountPolicy,
  Organization,
  Facility,
  User,
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

import {
  POLICY_STATUS,
  DISCOUNT_TYPE,
  POLICY_APPLIES_TO,
} from "../constants/enums.js";
import { FIELD_VISIBILITY_DISCOUNT_POLICY } from "../constants/fieldVisibility.js";

import { authzService } from "../services/authzService.js";
import { auditService } from "../services/auditService.js";
import { buildDynamicSummary } from "../utils/summaryHelper.js";

/* ============================================================
   🔐 MODULE
============================================================ */
const MODULE_KEY = "discountPolicy";

/* ============================================================
   🔧 LOCAL DEBUG OVERRIDE
============================================================ */
const DEBUG_OVERRIDE = false;
const debug = makeModuleLogger("discountPolicyController", DEBUG_OVERRIDE);

/* ============================================================
   🔖 STATUS MAP (ENUM SAFE)
============================================================ */
const PS = {
  ACTIVE: POLICY_STATUS[0],
  INACTIVE: POLICY_STATUS[1],
  EXPIRED: POLICY_STATUS[2],
};

/* ============================================================
   🔗 SHARED INCLUDES
============================================================ */
const POLICY_INCLUDES = [
  { model: Organization, as: "organization", attributes: ["id", "name", "code"] },
  { model: Facility, as: "facility", attributes: ["id", "name", "code", "organization_id"] },
  { model: User, as: "createdBy", attributes: ["id", "first_name", "last_name"] },
  { model: User, as: "updatedBy", attributes: ["id", "first_name", "last_name"] },
  { model: User, as: "deletedBy", attributes: ["id", "first_name", "last_name"] },
  { model: User, as: "activatedBy", attributes: ["id", "first_name", "last_name"] },
  { model: User, as: "deactivatedBy", attributes: ["id", "first_name", "last_name"] },
  { model: User, as: "expiredBy", attributes: ["id", "first_name", "last_name"] },
];

/* ============================================================
   📋 ROLE-AWARE JOI SCHEMA (MASTER PARITY)
============================================================ */
function buildPolicySchema(mode = "create") {
  const base = {
    code: Joi.string().max(50).required(),
    name: Joi.string().max(150).required(),
    description: Joi.string().allow(null, ""),
    discount_type: Joi.string().valid(...DISCOUNT_TYPE).required(),
    discount_value: Joi.number().min(0).required(),
    applies_to: Joi.string().valid(...POLICY_APPLIES_TO).default("all"),
    condition_json: Joi.object().unknown(true).allow(null),
    effective_from: Joi.date().allow(null),
    effective_to: Joi.date().allow(null),

    status: Joi.forbidden(),
    organization_id: Joi.forbidden(),
    facility_id: Joi.forbidden(),
  };

  if (mode === "update") {
    Object.keys(base).forEach((k) => (base[k] = base[k].optional()));
  }

  return Joi.object(base);
}

/* ============================================================
   📌 GET ALL POLICIES (MASTER + SUMMARY)
============================================================ */
export const getAllPolicies = async (req, res) => {
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
      FIELD_VISIBILITY_DISCOUNT_POLICY[role] ||
      FIELD_VISIBILITY_DISCOUNT_POLICY.staff;

    const options = buildQueryOptions(req, "created_at", "DESC", visibleFields);

    delete options.filters?.dateRange;
    options.where = { [Op.and]: [] };

    /* 📅 DATE RANGE */
    const dateRange = normalizeDateRangeLocal(req.query.dateRange);
    if (dateRange) {
      options.where[Op.and].push({
        created_at: { [Op.between]: [dateRange.start, dateRange.end] },
      });
    }

    /* 🔐 TENANT SCOPE */
    if (!isSuperAdmin(req.user)) {
      options.where[Op.and].push({
        organization_id: req.user.organization_id,
      });
      if (!isOrgLevelUser(req.user)) {
        options.where[Op.and].push({
          facility_id: req.user.facility_id,
        });
      }
    } else {
      if (req.query.organization_id)
        options.where[Op.and].push({ organization_id: req.query.organization_id });
      if (req.query.facility_id)
        options.where[Op.and].push({ facility_id: req.query.facility_id });
    }

    if (req.query.status)
      options.where[Op.and].push({ status: req.query.status });
    if (req.query.discount_type)
      options.where[Op.and].push({ discount_type: req.query.discount_type });

    if (options.search) {
      options.where[Op.and].push({
        [Op.or]: [
          { code: { [Op.iLike]: `%${options.search}%` } },
          { name: { [Op.iLike]: `%${options.search}%` } },
          { description: { [Op.iLike]: `%${options.search}%` } },
        ],
      });
    }

    const { count, rows } = await DiscountPolicy.findAndCountAll({
      where: options.where,
      include: POLICY_INCLUDES,
      order: options.order,
      offset: options.offset,
      limit: options.limit,
      distinct: true,
    });

    const summary = await buildDynamicSummary({
      model: DiscountPolicy,
      baseWhere: options.where,
      statusEnums: Object.values(PS),
    });

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "list",
      details: { query: req.query, returned: count },
    });

    return success(res, "✅ Policies loaded", {
      records: rows,
      summary,
      pagination: {
        total: count,
        page: options.pagination.page,
        pageCount: Math.ceil(count / options.pagination.limit),
      },
    });
  } catch (err) {
    debug.error("getAllPolicies → FAILED", err);
    return error(res, "❌ Failed to load policies", err);
  }
};

/* ============================================================
   📌 GET POLICY BY ID
============================================================ */
export const getPolicyById = async (req, res) => {
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

    const record = await DiscountPolicy.findOne({
      where,
      include: POLICY_INCLUDES,
    });

    if (!record) return error(res, "❌ Policy not found", null, 404);

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "view",
      entityId: record.id,
      entity: record,
    });

    return success(res, "✅ Policy loaded", record);
  } catch (err) {
    return error(res, "❌ Failed to load policy", err);
  }
};

/* ============================================================
   📌 CREATE POLICY
============================================================ */
export const createPolicy = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { value, errors } = validate(
      buildPolicySchema("create"),
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

    const record = await DiscountPolicy.create(
      {
        ...value,
        organization_id: orgId,
        facility_id: facilityId,
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

    return success(res, "✅ Policy created", record);
  } catch (err) {
    if (t && !t.finished) await t.rollback();
    return error(res, "❌ Failed to create policy", err);
  }
};

/* ============================================================
   📌 UPDATE / ACTIVATE / DEACTIVATE / EXPIRE / DELETE / RESTORE
============================================================ */

export const updatePolicy = async (req, res) => {
  try {
    const record = await DiscountPolicy.findByPk(req.params.id);
    if (!record) return error(res, "❌ Policy not found", null, 404);

    await record.update({
      ...req.body,
      updated_by_id: req.user?.id || null,
    });

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "update",
      entityId: record.id,
      entity: record,
    });

    return success(res, "✅ Policy updated", record);
  } catch (err) {
    return error(res, "❌ Failed to update policy", err);
  }
};

export const activatePolicy = async (req, res) => {
  try {
    const record = await DiscountPolicy.findByPk(req.params.id);
    if (!record) return error(res, "❌ Policy not found", null, 404);

    await record.update({
      status: PS.ACTIVE,
      activated_by_id: req.user?.id || null,
      activated_at: new Date(),
    });

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "activate",
      entityId: record.id,
      entity: record,
    });

    return success(res, "✅ Policy activated", record);
  } catch (err) {
    return error(res, "❌ Failed to activate policy", err);
  }
};

export const deactivatePolicy = async (req, res) => {
  try {
    const record = await DiscountPolicy.findByPk(req.params.id);
    if (!record) return error(res, "❌ Policy not found", null, 404);

    await record.update({
      status: PS.INACTIVE,
      deactivated_by_id: req.user?.id || null,
      deactivated_at: new Date(),
    });

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "deactivate",
      entityId: record.id,
      entity: record,
    });

    return success(res, "✅ Policy deactivated", record);
  } catch (err) {
    return error(res, "❌ Failed to deactivate policy", err);
  }
};

export const expirePolicy = async (req, res) => {
  try {
    const record = await DiscountPolicy.findByPk(req.params.id);
    if (!record) return error(res, "❌ Policy not found", null, 404);

    await record.update({
      status: PS.EXPIRED,
      expired_by_id: req.user?.id || null,
      expired_at: new Date(),
    });

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "expire",
      entityId: record.id,
      entity: record,
    });

    return success(res, "✅ Policy expired", record);
  } catch (err) {
    return error(res, "❌ Failed to expire policy", err);
  }
};

export const deletePolicy = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const record = await DiscountPolicy.findByPk(req.params.id, { transaction: t });
    if (!record) {
      await t.rollback();
      return error(res, "❌ Policy not found", null, 404);
    }

    await record.update({ deleted_by_id: req.user?.id || null }, { transaction: t });
    await record.destroy({ transaction: t });
    await t.commit();

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "delete",
      entityId: record.id,
      entity: record,
    });

    return success(res, "✅ Policy deleted", record);
  } catch (err) {
    if (t && !t.finished) await t.rollback();
    return error(res, "❌ Failed to delete policy", err);
  }
};

export const restorePolicy = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const record = await DiscountPolicy.findOne({
      where: { id: req.params.id },
      paranoid: false,
      transaction: t,
    });

    if (!record) {
      await t.rollback();
      return error(res, "❌ Policy not found", null, 404);
    }

    await record.restore({ transaction: t });
    await record.update({ updated_by_id: req.user?.id || null }, { transaction: t });
    await t.commit();

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "restore",
      entityId: record.id,
      entity: record,
    });

    return success(res, "✅ Policy restored", record);
  } catch (err) {
    if (t && !t.finished) await t.rollback();
    return error(res, "❌ Failed to restore policy", err);
  }
};

/* ============================================================
   📌 LITE FETCH (AUTOCOMPLETE)
============================================================ */
export const getAllPoliciesLite = async (req, res) => {
  try {
    const { q } = req.query;
    const where = { [Op.and]: [] };

    if (q) {
      where[Op.and].push({
        [Op.or]: [
          { code: { [Op.iLike]: `%${q}%` } },
          { name: { [Op.iLike]: `%${q}%` } },
        ],
      });
    }

    if (!isSuperAdmin(req.user)) {
      where[Op.and].push({ organization_id: req.user.organization_id });
      if (isFacilityHead(req.user)) {
        where[Op.and].push({ facility_id: req.user.facility_id });
      }
    }

    const records = await DiscountPolicy.findAll({
      where,
      attributes: ["id", "code", "name", "status", "discount_type", "discount_value"],
      order: [["created_at", "DESC"]],
      limit: 20,
    });

    return success(res, "✅ Policies loaded (lite)", { records });
  } catch (err) {
    return error(res, "❌ Failed to load policies (lite)", err);
  }
};
