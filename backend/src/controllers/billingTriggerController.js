// 📁 controllers/billingTriggerController.js
import Joi from "joi";
import { Op } from "sequelize";
import { 
  sequelize, 
  BillingTrigger, 
  Organization, 
  Facility,
FeatureModule  } from "../models/index.js";
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
  isOrgLevelUser,
} from "../utils/role-utils.js";
import { FIELD_VISIBILITY_BILLING_TRIGGER } from "../constants/fieldVisibility.js";

/* ============================================================
   🔑 MODULE KEY (MASTER LOCK)
============================================================ */
const MODULE_KEY = "billing_triggers";

/* ============================================================
   🔧 LOCAL DEBUG OVERRIDE
============================================================ */
const DEBUG_OVERRIDE = true;
const debug = makeModuleLogger("billingTriggerController", DEBUG_OVERRIDE);

/* ============================================================
   🔗 SHARED INCLUDES (MASTER PARITY)
============================================================ */
const BILLING_TRIGGER_INCLUDES = [
  {
    model: Organization,
    as: "organization",
    attributes: ["id", "name", "code"], // ✅ FIXED
  },
  {
    model: Facility,
    as: "facility",
    attributes: ["id", "name", "code"], // ✅ FIXED
    required: false,
  },
  {
    model: FeatureModule,
    as: "featureModule",
    attributes: ["id", "name", "key"], // ✅ already correct
  },
];

/* ============================================================
   📋 ROLE-AWARE JOI SCHEMA (MASTER PARITY | FK-DRIVEN | FIXED)
============================================================ */
function buildBillingTriggerSchema(user, mode = "create") {
  const base = {
    // 🔑 LOGIC KEY (FK ONLY)
    feature_module_id: Joi.string().uuid().required(),

    // 🧾 DISPLAY / SEARCH ONLY
    module_key: Joi.string().max(100).required(),

    trigger_status: Joi.string().max(50).required(),
    is_active: Joi.boolean().default(true),

    // 🔒 tenant fields (default locked)
    organization_id: Joi.forbidden(),
    facility_id: Joi.forbidden(),
  };

  /* ============================================================
     🔐 ROLE CONTROL
  ============================================================ */

  // ✅ SUPERADMIN → full control
  if (isSuperAdmin(user)) {
    base.organization_id = Joi.string().uuid().required();
    base.facility_id = Joi.string().uuid().allow(null, "");
  }

  // ✅ ORG ADMIN → can choose facility
  else if (isOrgLevelUser(user)) {
    base.facility_id = Joi.string().uuid().allow(null, "");
  }

  // ✅ FACILITY HEAD → locked to their facility (no override)
  else if (isFacilityHead(user)) {
    base.facility_id = Joi.forbidden();
  }

  /* ============================================================
     🔄 UPDATE MODE (optional fields)
  ============================================================ */
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
   ➕ CREATE (MASTER PARITY – ROLE SAFE | FIXED)
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

    /* ================= ROLE-AWARE ORG / FAC ================= */
    let orgId = null;
    let facilityId = null;

    if (isSuperAdmin(req.user)) {
      orgId = value.organization_id ?? null;
      facilityId = value.facility_id ?? null;

    } else if (isOrgLevelUser(req.user)) {
      orgId = req.user.organization_id;

      if (value.facility_id !== undefined) {
        facilityId = value.facility_id;
      } else if (req.user.facility_id) {
        facilityId = req.user.facility_id;
      } else {
        facilityId = null;
      }

    } else if (isFacilityHead(req.user)) {
      orgId = req.user.organization_id;
      facilityId = req.user.facility_id;

    } else {
      orgId = req.user.organization_id;
      facilityId = req.user.facility_id ?? null;
    }

    /* ================= FINAL SAFETY ================= */
    if (!orgId) {
      await t.rollback();
      return error(res, "Missing organization assignment", null, 400);
    }

    /* ================= CREATE ================= */
    const trigger = await BillingTrigger.create(
      {
        feature_module_id: value.feature_module_id,
        module_key: value.module_key,
        trigger_status: value.trigger_status,
        is_active: value.is_active,

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
   ✏️ UPDATE (MASTER PARITY – SAFE | FIXED)
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

    /* ================= TENANT SCOPE ================= */
    if (!isSuperAdmin(req.user)) {
      where.organization_id = req.user.organization_id;

      if (isFacilityHead(req.user)) {
        where.facility_id = req.user.facility_id;
      }
    }

    const trigger = await BillingTrigger.findOne({
      where,
      transaction: t,
    });

    if (!trigger) {
      await t.rollback();
      return error(res, "Billing trigger not found", null, 404);
    }

    /* ================= ORG / FAC RESOLUTION ================= */
    const resolvedOrgId =
      trigger.organization_id || req.user.organization_id;

    const resolvedFacilityId =
      value.facility_id !== undefined
        ? value.facility_id
        : trigger.facility_id ?? req.user.facility_id ?? null;

    /* ================= UPDATE ================= */
    await trigger.update(
      {
        ...(value.feature_module_id !== undefined && {
          feature_module_id: value.feature_module_id,
        }),
        ...(value.module_key !== undefined && {
          module_key: value.module_key,
        }),
        ...(value.trigger_status !== undefined && {
          trigger_status: value.trigger_status,
        }),
        ...(value.is_active !== undefined && {
          is_active: value.is_active,
        }),

        organization_id: resolvedOrgId,
        facility_id: resolvedFacilityId,

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
   📋 LIST (STRICT MASTER PARITY + SUMMARY + ORG/FAC)
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

    /* ========================================================
       🧱 BASE WHERE (LIST + SUMMARY)
    ======================================================== */
    const baseWhere = { [Op.and]: [] };

    /* ---------------- Date Range ---------------- */
    const dateRange = normalizeDateRangeLocal(req.query.dateRange);
    if (dateRange) {
      baseWhere[Op.and].push({
        created_at: {
          [Op.between]: [dateRange.start, dateRange.end],
        },
      });
    }

    /* ---------------- Tenant Scope ---------------- */
    if (!isSuperAdmin(req.user)) {
      baseWhere[Op.and].push({
        organization_id: req.user.organization_id,
      });

      if (isFacilityHead(req.user)) {
        baseWhere[Op.and].push({
          facility_id: req.user.facility_id,
        });
      }
    } else {
      if (req.query.organization_id) {
        baseWhere[Op.and].push({
          organization_id: req.query.organization_id,
        });
      }
      if (req.query.facility_id) {
        baseWhere[Op.and].push({
          facility_id: req.query.facility_id,
        });
      }
    }

    /* ---------------- Active Filter ---------------- */
    if (req.query.is_active !== undefined) {
      baseWhere[Op.and].push({
        is_active: req.query.is_active === "true",
      });
    }

    /* ========================================================
       🔎 LIST WHERE (BASE + SEARCH)
    ======================================================== */
    const listWhere = {
      [Op.and]: [...baseWhere[Op.and]],
    };

    if (options.search) {
      listWhere[Op.and].push({
        [Op.or]: [
          { module_key: { [Op.iLike]: `%${options.search}%` } },
          { trigger_status: { [Op.iLike]: `%${options.search}%` } },
          { "$featureModule.name$": { [Op.iLike]: `%${options.search}%` } },
        ],
      });
    }

    /* ========================================================
       📄 MAIN LIST QUERY (USING SHARED INCLUDES)
    ======================================================== */
    const { count, rows } = await BillingTrigger.findAndCountAll({
      where: listWhere,
      include: BILLING_TRIGGER_INCLUDES, // ✅ CLEAN MASTER USE
      attributes: Array.from(
        new Set([
          "id",
          "organization_id",
          "facility_id",
          ...(options.attributes || []),
        ])
      ),
      order: options.order,
      offset: options.offset,
      limit: options.limit,
      distinct: true,
    });

    /* ========================================================
       📊 SUMMARY (BASE WHERE ONLY)
    ======================================================== */
    const statusAgg = await BillingTrigger.findAll({
      where: baseWhere,
      attributes: [
        "is_active",
        [sequelize.fn("COUNT", sequelize.col("id")), "count"],
      ],
      group: ["is_active"],
      raw: true,
    });

    const summary = {
      total: count,
      active: 0,
      inactive: 0,
    };

    statusAgg.forEach((r) => {
      if (r.is_active === true || r.is_active === "true") {
        summary.active = Number(r.count);
      } else {
        summary.inactive = Number(r.count);
      }
    });

    if (dateRange) {
      summary.dateRange = {
        start: dateRange.start,
        end: dateRange.end,
      };
    }

    /* ========================================================
       🧾 AUDIT
    ======================================================== */
    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "list",
      details: { returned: count, query: req.query },
    });

    /* ========================================================
       ✅ RESPONSE
    ======================================================== */
    return success(res, "✅ Billing triggers loaded", {
      records: rows,
      summary,
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
   📌 GET BILLING TRIGGER BY ID (MASTER PARITY + ORG/FAC)
============================================================ */
export const getBillingTriggerById = async (req, res) => {
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module: MODULE_KEY,
      action: "read",
      res,
    });
    if (!allowed) return;

    const { id } = req.params;

    const where = { id };

    /* ---------------- Tenant Scope ---------------- */
    if (!isSuperAdmin(req.user)) {
      where.organization_id = req.user.organization_id;

      if (isFacilityHead(req.user)) {
        where.facility_id = req.user.facility_id;
      }
    } else {
      if (req.query.organization_id)
        where.organization_id = req.query.organization_id;
      if (req.query.facility_id)
        where.facility_id = req.query.facility_id;
    }

    const trigger = await BillingTrigger.findOne({
      where,
      include: BILLING_TRIGGER_INCLUDES, // ✅ SAME SHARED INCLUDE
    });

    if (!trigger) {
      return error(res, "❌ Billing trigger not found", null, 404);
    }

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "view",
      entityId: id,
      entity: trigger,
    });

    return success(res, "✅ Billing trigger loaded", trigger);
  } catch (err) {
    debug.error("getById → FAILED", err);
    return error(res, "❌ Failed to load billing trigger", err);
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
