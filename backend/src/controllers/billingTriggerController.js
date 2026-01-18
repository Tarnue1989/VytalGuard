// 📁 controllers/billingTriggerController.js
import Joi from "joi";
import { Op } from "sequelize";
import { sequelize, BillingTrigger } from "../models/index.js";
import { success, error } from "../utils/response.js";
import { buildQueryOptions } from "../utils/queryHelper.js";
import { authzService } from "../services/authzService.js";
import { auditService } from "../services/auditService.js";
import { resolveOrgFacility } from "../utils/resolveOrgFacility.js";
import { makeModuleLogger } from "../utils/debugLogger.js";
import { validate } from "../utils/validation.js";
import { normalizeDateRangeLocal } from "../utils/date-utils.js";
import {
  isSuperAdmin,
  isFacilityHead,
} from "../utils/role-utils.js";
import { FIELD_VISIBILITY_BILLING_TRIGGER } from "../constants/fieldVisibility.js";

/* ============================================================
   🔑 MODULE KEY (MASTER LOCK)
============================================================ */
const MODULE_KEY = "billingTrigger";

/* ============================================================
   🔧 LOCAL DEBUG OVERRIDE
============================================================ */
const DEBUG_OVERRIDE = true;
const debug = makeModuleLogger("billingTriggerController", DEBUG_OVERRIDE);

/* ============================================================
   📋 ROLE-AWARE JOI SCHEMA (MASTER PARITY)
============================================================ */
function buildBillingTriggerSchema(user, mode = "create") {
  const base = {
    module_key: Joi.string().max(100).required(),
    trigger_status: Joi.string().max(50).required(),
    is_active: Joi.boolean().default(true),

    // 🔒 tenant fields controlled by backend
    organization_id: Joi.forbidden(),
    facility_id: Joi.forbidden(),
  };

  if (isSuperAdmin(user)) {
    base.organization_id = Joi.string().uuid().required();
    base.facility_id = Joi.string().uuid().allow(null, "");
  }

  if (mode === "update") {
    Object.keys(base).forEach((k) => {
      if (base[k] !== Joi.forbidden()) {
        base[k] = base[k].optional();
      }
    });
  }

  return Joi.object(base);
}

/* ============================================================
   ➕ CREATE
============================================================ */
export const createBillingTrigger = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module: MODULE_KEY,
      action: "create",
      res,
    });
    if (!allowed) return;

    const { value, errors } = validate(
      buildBillingTriggerSchema(req.user, "create"),
      req.body
    );
    if (errors) {
      await t.rollback();
      return res.status(400).json({ success: false, errors });
    }

    const { orgId, facilityId } = resolveOrgFacility({
      user: req.user,
      value,
      body: req.body,
    });

    if (!orgId) {
      await t.rollback();
      return error(res, "Organization is required", null, 400);
    }

    const trigger = await BillingTrigger.create(
      {
        ...value,
        organization_id: orgId,
        facility_id: facilityId,
        created_by_id: req.user?.id || null,
      },
      { transaction: t }
    );

    await t.commit();

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "create",
      entityId: trigger.id,
      entity: trigger,
      details: value,
    });

    return success(res, "✅ Billing trigger created", trigger);
  } catch (err) {
    await t.rollback();
    debug.error("create → FAILED", err);
    return error(res, "❌ Failed to create billing trigger", err);
  }
};

/* ============================================================
   ✏️ UPDATE
============================================================ */
export const updateBillingTrigger = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module: MODULE_KEY,
      action: "update",
      res,
    });
    if (!allowed) return;

    const { value, errors } = validate(
      buildBillingTriggerSchema(req.user, "update"),
      req.body
    );
    if (errors) {
      await t.rollback();
      return res.status(400).json({ success: false, errors });
    }

    const where = { id: req.params.id };

    if (!isSuperAdmin(req.user)) {
      where.organization_id = req.user.organization_id;
      if (isFacilityHead(req.user)) {
        where.facility_id = req.user.facility_id;
      }
    }

    const trigger = await BillingTrigger.findOne({ where, transaction: t });
    if (!trigger) {
      await t.rollback();
      return error(res, "Billing trigger not found", null, 404);
    }

    await trigger.update(
      {
        ...value,
        updated_by_id: req.user?.id || null,
      },
      { transaction: t }
    );

    await t.commit();

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "update",
      entityId: trigger.id,
      entity: trigger,
      details: value,
    });

    return success(res, "✅ Billing trigger updated", trigger);
  } catch (err) {
    await t.rollback();
    debug.error("update → FAILED", err);
    return error(res, "❌ Failed to update billing trigger", err);
  }
};

/* ============================================================
   🔁 TOGGLE STATUS
============================================================ */
export const toggleBillingTrigger = async (req, res) => {
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module: MODULE_KEY,
      action: "update",
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

    const trigger = await BillingTrigger.findOne({ where });
    if (!trigger) {
      return error(res, "Billing trigger not found", null, 404);
    }

    const newState = !trigger.is_active;

    await trigger.update({
      is_active: newState,
      updated_by_id: req.user?.id || null,
    });

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "toggle_status",
      entityId: trigger.id,
      details: { is_active: newState },
    });

    return success(
      res,
      `✅ Billing trigger ${newState ? "activated" : "deactivated"}`,
      trigger
    );
  } catch (err) {
    debug.error("toggle → FAILED", err);
    return error(res, "❌ Failed to toggle billing trigger", err);
  }
};

/* ============================================================
   📋 LIST (STRICT MASTER PARITY)
============================================================ */
export const getAllBillingTriggers = async (req, res) => {
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module: MODULE_KEY,
      action: "read",
      res,
    });
    if (!allowed) return;

    const roleKey = (req.user?.roleNames?.[0] || "staff").toLowerCase();
    const visibleFields =
      FIELD_VISIBILITY_BILLING_TRIGGER[roleKey] ||
      FIELD_VISIBILITY_BILLING_TRIGGER.staff;

    const options = buildQueryOptions(
      req,
      "module_key",
      "ASC",
      visibleFields
    );

    /* ========================================================
       🧹 STRIP UI-ONLY FILTERS (MASTER RULE)
    ======================================================== */
    delete options.filters?.dateRange;
    delete options.filters?.light;

    options.where = { [Op.and]: [] };

    /* ========================================================
       📅 DATE RANGE (UTIL-OWNED)
    ======================================================== */
    const dateRange = normalizeDateRangeLocal(req.query.dateRange);
    if (dateRange) {
      options.where[Op.and].push({
        created_at: {
          [Op.between]: [dateRange.start, dateRange.end],
        },
      });
    }

    /* ========================================================
       🔐 ORG / FACILITY SCOPE
    ======================================================== */
    if (!isSuperAdmin(req.user)) {
      options.where[Op.and].push({
        organization_id: req.user.organization_id,
      });

      if (isFacilityHead(req.user)) {
        options.where[Op.and].push({
          facility_id: req.user.facility_id,
        });
      }
    }

    /* ========================================================
       🔎 SEARCH
    ======================================================== */
    if (options.search) {
      options.where[Op.and].push({
        [Op.or]: [
          { module_key: { [Op.iLike]: `%${options.search}%` } },
          { trigger_status: { [Op.iLike]: `%${options.search}%` } },
        ],
      });
    }

    const { count, rows } = await BillingTrigger.findAndCountAll({
      where: options.where,
      attributes: Array.from(
        new Set(["id", ...(options.attributes || [])])
      ),
      order: options.order,
      offset: options.offset,
      limit: options.limit,
      distinct: true,
    });

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "list",
      details: { returned: count },
    });

    return success(res, "✅ Billing triggers loaded", {
      records: rows,
      pagination: {
        total: count,
        page: options.pagination.page,
        pageCount: Math.ceil(count / options.pagination.limit),
      },
    });
  } catch (err) {
    debug.error("list → FAILED", err);
    return error(res, "❌ Failed to load billing triggers", err);
  }
};

/* ============================================================
   📌 LITE LIST
============================================================ */
export const getAllBillingTriggersLite = async (req, res) => {
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module: MODULE_KEY,
      action: "read",
      res,
    });
    if (!allowed) return;

    const where = { is_active: true };

    if (!isSuperAdmin(req.user)) {
      where.organization_id = req.user.organization_id;
      if (isFacilityHead(req.user)) {
        where.facility_id = req.user.facility_id;
      }
    }

    const triggers = await BillingTrigger.findAll({
      where,
      attributes: ["id", "module_key", "trigger_status"],
      order: [["module_key", "ASC"]],
      limit: 50,
    });

    return success(res, "✅ Billing triggers loaded (lite)", {
      records: triggers,
    });
  } catch (err) {
    debug.error("lite → FAILED", err);
    return error(res, "❌ Failed to load billing triggers (lite)", err);
  }
};

/* ============================================================
   🗑️ DELETE (HARD)
============================================================ */
export const deleteBillingTrigger = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module: MODULE_KEY,
      action: "delete",
      res,
    });
    if (!allowed) return;

    const where = { id: req.params.id };
    if (!isSuperAdmin(req.user)) {
      where.organization_id = req.user.organization_id;
    }

    const trigger = await BillingTrigger.findOne({ where, transaction: t });
    if (!trigger) {
      await t.rollback();
      return error(res, "Billing trigger not found", null, 404);
    }

    await trigger.destroy({ transaction: t });
    await t.commit();

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "delete",
      entityId: trigger.id,
      entity: trigger,
    });

    return success(res, "✅ Billing trigger deleted", trigger);
  } catch (err) {
    await t.rollback();
    debug.error("delete → FAILED", err);
    return error(res, "❌ Failed to delete billing trigger", err);
  }
};
