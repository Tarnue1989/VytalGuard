import Joi from "joi";
import { Op } from "sequelize";
import {
  sequelize,
  AutoBillingRule,
  Facility,
  Organization,
  User,
  BillableItem,
  FeatureModule,
} from "../models/index.js";
import { buildQueryOptions } from "../utils/queryHelper.js";
import { success, error } from "../utils/response.js";
import { authzService } from "../services/authzService.js";
import { auditService } from "../services/auditService.js";
import { resolveOrgFacility } from "../utils/resolveOrgFacility.js";
import { makeModuleLogger } from "../utils/debugLogger.js";
import { validate } from "../utils/validation.js";
import {
  AUTO_BILLING_RULE_STATUS,
  AUTO_BILLING_CHARGE_MODE,
} from "../constants/enums.js";
import {
  isSuperAdmin,
  isOrgLevelUser,
  isFacilityHead,
} from "../utils/role-utils.js";
import { normalizeDateRangeLocal } from "../utils/date-utils.js";

/* ============================================================
   🔧 LOCAL DEBUG OVERRIDE (Auto Billing Rule)
============================================================ */
const DEBUG_OVERRIDE = true; // 👈 turn OFF in prod
const debug = makeModuleLogger("autoBillingRuleController", DEBUG_OVERRIDE);

/* ============================================================
   🔗 SHARED INCLUDES
============================================================ */
const AUTOBILLINGRULE_INCLUDES = [
  { model: Organization, as: "organization", attributes: ["id", "name", "code"] },
  { model: Facility, as: "facility", attributes: ["id", "name", "code", "organization_id"] },
  { model: FeatureModule, as: "featureModule", attributes: ["id", "name", "key"] },
  { model: BillableItem, as: "billableItem", attributes: ["id", "name", "price", "status"] },
  { model: User, as: "createdBy", attributes: ["id", "first_name", "last_name"] },
  { model: User, as: "updatedBy", attributes: ["id", "first_name", "last_name"] },
  { model: User, as: "deletedBy", attributes: ["id", "first_name", "last_name"] },
];

/* ============================================================
   📋 ROLE-AWARE JOI SCHEMA (FK-DRIVEN | ENTERPRISE FINAL)
============================================================ */
function buildAutoBillingRuleSchema(user, mode = "create") {
  const base = {
    trigger_feature_module_id: Joi.string().uuid().required(),
    billable_item_id: Joi.string().uuid().required(),
    auto_generate: Joi.boolean().default(true),

    charge_mode: Joi.string()
      .valid(...AUTO_BILLING_CHARGE_MODE)
      .required(),

    default_price: Joi.number().precision(2).allow(null),

    // 🔒 backend controlled
    status: Joi.forbidden(),

    // ✅ ALLOW (MASTER PATTERN)
    organization_id: Joi.string().uuid().allow(null, ""),
    facility_id: Joi.string().uuid().allow(null, ""),
  };

  if (isSuperAdmin(user)) {
    base.organization_id = Joi.string().uuid().required();
    base.facility_id = Joi.string().uuid().allow(null, "");
  }

  if (mode === "update") {
    Object.keys(base).forEach((k) => {
      if (base[k] !== Joi.forbidden()) base[k] = base[k].optional();
    });
  }

  return Joi.object(base);
}

/* ============================================================
   📌 CREATE AUTO BILLING RULE
   ✅ Multi-module allowed
   ✅ Unique billable item per facility/org
============================================================ */
export const createAutoBillingRule = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module: "auto_billing_rule",
      action: "create",
      res,
    });
    if (!allowed) return;

    const { value, errors } = validate(
      buildAutoBillingRuleSchema(req.user, "create"),
      req.body
    );

    if (errors) {
      await t.rollback();
      return res.status(400).json({ success: false, errors });
    }

    /* ========================================================
       🧭 ROLE PATTERN (MASTER ALIGN)
    ======================================================== */
    let orgId = null;
    let facilityId = null;

    if (isSuperAdmin(req.user)) {
      orgId = value.organization_id ?? null;
      facilityId = value.facility_id ?? null;

    } else if (isOrgLevelUser(req.user)) {
      orgId = req.user.organization_id;

      if (value.facility_id) {
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

    /* ========================================================
       🔒 NORMALIZE (VERY IMPORTANT)
    ======================================================== */
    facilityId = facilityId || null;

    if (!orgId) {
      await t.rollback();
      return error(res, "Organization is required", null, 400);
    }

    if (!facilityId) {
      await t.rollback();
      return error(res, "Facility is required", null, 400);
    }

/* ========================================================
   🔒 DUPLICATE CHECK (WITH FULL DEBUG)
======================================================== */
const moduleId = String(value.trigger_feature_module_id || "").trim();
const billableId = String(value.billable_item_id || "").trim();
const facId = facilityId || null;

console.log("🧪 DUP CHECK INPUT:", {
  orgId,
  facId,
  moduleId,
  billableId,
});

const exists = await AutoBillingRule.findOne({
  where: {
    organization_id: orgId,
    facility_id: facId,
    trigger_feature_module_id: moduleId,
    billable_item_id: billableId,
  },
  attributes: ["id", "billable_item_id", "trigger_feature_module_id", "facility_id"],
  paranoid: false,
  transaction: t,
});

console.log("🧪 DUP CHECK RESULT:", exists);

if (exists) {
  console.log("🚨 DUPLICATE FOUND:", {
    found_id: exists.id,
    found_billable: exists.billable_item_id,
    found_module: exists.trigger_feature_module_id,
    found_facility: exists.facility_id,
  });

  await t.rollback();
  return error(
    res,
    "⚠️ This billable item is already assigned to this module in this facility.",
    exists,
    400
  );
}

    /* ========================================================
       ➕ CREATE
    ======================================================== */
    const created = await AutoBillingRule.create(
      {
        trigger_feature_module_id: value.trigger_feature_module_id,
        billable_item_id: value.billable_item_id,
        auto_generate: value.auto_generate,
        charge_mode: value.charge_mode,
        default_price: value.default_price,
        organization_id: orgId,
        facility_id: facilityId,
        status: AUTO_BILLING_RULE_STATUS[0],
        created_by_id: req.user?.id || null,
      },
      { transaction: t }
    );

    await t.commit();

    const full = await AutoBillingRule.findOne({
      where: { id: created.id },
      include: AUTOBILLINGRULE_INCLUDES,
    });

    await auditService.logAction({
      user: req.user,
      module: "auto_billing_rule",
      action: "create",
      entityId: created.id,
      entity: full,
    });

    return success(res, "✅ Auto Billing Rule created", full);

  } catch (err) {
    await t.rollback();

    if (err.name === "SequelizeUniqueConstraintError") {
      return error(
        res,
        "⚠️ This billable item is already assigned to this module in this facility.",
        null,
        400
      );
    }

    return error(res, "❌ Failed to create auto billing rule", err);
  }
};
/* ============================================================
   📌 UPDATE AUTO BILLING RULE (FINAL — UNIQUE BILLABLE ENFORCED)
============================================================ */
export const updateAutoBillingRule = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module: "auto_billing_rule",
      action: "update",
      res,
    });
    if (!allowed) return;

    const { id } = req.params;

    const { value, errors } = validate(
      buildAutoBillingRuleSchema(req.user, "update"),
      req.body
    );

    if (errors) {
      await t.rollback();
      return res.status(400).json({ success: false, errors });
    }

    /* ========================================================
       🔒 TENANT-SAFE FETCH
    ======================================================== */
    const where = { id };

    if (!isSuperAdmin(req.user)) {
      where.organization_id = req.user.organization_id;
      where.facility_id = req.user.facility_id || null;
    }

    const rule = await AutoBillingRule.findOne({
      where,
      transaction: t,
    });

    if (!rule) {
      await t.rollback();
      return error(res, "Auto Billing Rule not found", null, 404);
    }

    /* ========================================================
       🧭 ROLE PATTERN (MASTER ALIGN)
    ======================================================== */
    let orgId = rule.organization_id;
    let facilityId = rule.facility_id;

    if (isSuperAdmin(req.user)) {
      if ("organization_id" in value) orgId = value.organization_id;
      if ("facility_id" in value) facilityId = value.facility_id;

    } else if (isOrgLevelUser(req.user)) {
      orgId = req.user.organization_id;

      if (value.facility_id) {
        facilityId = value.facility_id;
      } else if (rule.facility_id) {
        facilityId = rule.facility_id;
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
      facilityId = req.user.facility_id ?? rule.facility_id;
    }

    if (!orgId) {
      await t.rollback();
      return error(res, "Organization is required", null, 400);
    }

    if (!facilityId) {
      await t.rollback();
      return error(res, "Facility is required", null, 400);
    }

    /* ========================================================
       🔒 DUPLICATE CHECK (MODULE + BILLABLE)
    ======================================================== */
    const newModule =
      value.trigger_feature_module_id || rule.trigger_feature_module_id;

    const newBillable =
      value.billable_item_id || rule.billable_item_id;

    const exists = await AutoBillingRule.findOne({
      where: {
        organization_id: orgId,
        facility_id: facilityId,
        trigger_feature_module_id: newModule,
        billable_item_id: newBillable,
        id: { [Op.ne]: id },
      },
      transaction: t,
    });

    if (exists) {
      await t.rollback();
      return error(
        res,
        "⚠️ This rule already exists for this module + billable item.",
        null,
        400
      );
    }

    /* ========================================================
       ✏️ UPDATE
    ======================================================== */
    await rule.update(
      {
        ...(value.trigger_feature_module_id && {
          trigger_feature_module_id: value.trigger_feature_module_id,
        }),
        ...(value.billable_item_id && {
          billable_item_id: value.billable_item_id,
        }),
        ...(value.charge_mode && {
          charge_mode: value.charge_mode,
        }),
        ...(value.default_price !== undefined && {
          default_price: value.default_price,
        }),
        ...(value.auto_generate !== undefined && {
          auto_generate: value.auto_generate,
        }),

        organization_id: orgId,
        facility_id: facilityId,
        updated_by_id: req.user?.id || null,
      },
      { transaction: t }
    );

    await t.commit();

    const full = await AutoBillingRule.findOne({
      where: { id },
      include: AUTOBILLINGRULE_INCLUDES,
    });

    await auditService.logAction({
      user: req.user,
      module: "auto_billing_rule",
      action: "update",
      entityId: id,
      entity: full,
    });

    return success(res, "✅ Auto Billing Rule updated", full);

  } catch (err) {
    await t.rollback();

    if (err.name === "SequelizeUniqueConstraintError") {
      return error(
        res,
        "⚠️ This rule already exists for this module + billable item.",
        null,
        400
      );
    }

    return error(res, "❌ Failed to update auto billing rule", err);
  }
};
/* ============================================================
   📌 GET ALL AUTO BILLING RULES — MASTER PARITY (FINAL CLEAN)
============================================================ */
export const getAllAutoBillingRules = async (req, res) => {
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module: "auto_billing_rule",
      action: "read",
      res,
    });
    if (!allowed) return;

    /* ============================================================
       🧱 BASE QUERY OPTIONS
    ============================================================ */
    const options = buildQueryOptions(req, {
      defaultSort: ["created_at", "DESC"],
    });

    options.search = req.query.search || "";

    const mainWhere = [];
    const summaryWhere = [];

    /* ============================================================
       📅 DATE RANGE
    ============================================================ */
    if (req.query.dateRange) {
      const { start, end } = normalizeDateRangeLocal(req.query.dateRange);
      if (start && end) {
        const cond = {
          created_at: { [Op.between]: [start, end] },
        };
        mainWhere.push(cond);
        summaryWhere.push(cond);
      }
    }

    /* ============================================================
       🔒 TENANT SCOPE
    ============================================================ */
    const orgCond = { organization_id: req.user.organization_id };
    mainWhere.push(orgCond);
    summaryWhere.push(orgCond);

    if (!isSuperAdmin(req.user)) {
      if (req.user.facility_id) {
        const facCond = { facility_id: req.user.facility_id };
        mainWhere.push(facCond);
        summaryWhere.push(facCond);
      } else if (req.query.facility_id) {
        const facCond = { facility_id: req.query.facility_id };
        mainWhere.push(facCond);
        summaryWhere.push(facCond);
      }
    } else {
      if (req.query.organization_id) {
        const cond = { organization_id: req.query.organization_id };
        mainWhere.push(cond);
        summaryWhere.push(cond);
      }
      if (req.query.facility_id) {
        const cond = { facility_id: req.query.facility_id };
        mainWhere.push(cond);
        summaryWhere.push(cond);
      }
    }

    /* ============================================================
       🔍 GLOBAL SEARCH (SAFE — NO ENUM)
    ============================================================ */
    if (options.search && options.search.trim()) {
      mainWhere.push({
        [Op.or]: [
          { "$featureModule.key$": { [Op.iLike]: `%${options.search}%` } },
          { "$billableItem.name$": { [Op.iLike]: `%${options.search}%` } },
        ],
      });
    }

    /* ============================================================
       🔎 FILTERS
    ============================================================ */

    // 🔥 Trigger module (ID priority)
    if (req.query.trigger_feature_module_id) {
      const cond = {
        trigger_feature_module_id: req.query.trigger_feature_module_id,
      };
      mainWhere.push(cond);
      summaryWhere.push(cond);
    } else if (req.query.trigger_module) {
      mainWhere.push({
        "$featureModule.key$": {
          [Op.iLike]: `%${req.query.trigger_module}%`,
        },
      });
      // ❌ DO NOT add to summaryWhere (JOIN FIELD)
    }

    if (req.query.billable_item_id) {
      const cond = { billable_item_id: req.query.billable_item_id };
      mainWhere.push(cond);
      summaryWhere.push(cond);
    }

    if (req.query.charge_mode) {
      const cond = { charge_mode: req.query.charge_mode };
      mainWhere.push(cond);
      summaryWhere.push(cond);
    }

    if (req.query.status) {
      const cond = { status: req.query.status };
      mainWhere.push(cond);
      summaryWhere.push(cond);
    }

    /* ============================================================
       🧱 FINAL WHERE
    ============================================================ */
    options.where = { [Op.and]: mainWhere };

    const summaryWhereFinal = { [Op.and]: summaryWhere };

    /* ============================================================
       📦 MAIN QUERY
    ============================================================ */
    const { count, rows } = await AutoBillingRule.findAndCountAll({
      where: options.where,
      include: AUTOBILLINGRULE_INCLUDES,
      order: options.order,
      offset: options.offset,
      limit: options.limit,
      distinct: true,
      subQuery: false,
    });

    /* ============================================================
       📊 SUMMARY (SAFE + CLEAN)
    ============================================================ */
    const summary = { total: count };

    const statusCounts = await AutoBillingRule.findAll({
      where: summaryWhereFinal,
      attributes: [
        "status",
        [sequelize.fn("COUNT", sequelize.col("id")), "count"],
      ],
      group: ["status"],
      raw: true,
    });

    AUTO_BILLING_RULE_STATUS.forEach((s) => {
      const found = statusCounts.find((r) => r.status === s);
      summary[s] = found ? Number(found.count) : 0;
    });

    /* ============================================================
       🧾 AUDIT
    ============================================================ */
    await auditService.logAction({
      user: req.user,
      module: "auto_billing_rule",
      action: "list",
      details: {
        query: req.query,
        returned: count,
      },
    });

    /* ============================================================
       📤 RESPONSE
    ============================================================ */
    return success(res, "✅ Auto Billing Rules loaded", {
      records: rows,
      summary,
      pagination: {
        total: count,
        page: options.pagination.page,
        pageCount: Math.ceil(count / options.pagination.limit),
      },
    });

  } catch (err) {
    console.error("AUTO BILLING RULE LIST FAILED:", err);
    return error(res, "❌ Failed to load auto billing rules", err);
  }
};
/* ============================================================
   📌 GET AUTO BILLING RULE BY ID
============================================================ */
export const getAutoBillingRuleById = async (req, res) => {
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module: "auto_billing_rule",
      action: "read",
      res,
    });
    if (!allowed) return;

    const { id } = req.params;

    const where = { id };

    if (!isSuperAdmin(req.user)) {
      where.organization_id = req.user.organization_id;
      where.facility_id = req.user.facility_id || null;
    } else {
      if (req.query.organization_id)
        where.organization_id = req.query.organization_id;
      if (req.query.facility_id)
        where.facility_id = req.query.facility_id;
    }

    const rule = await AutoBillingRule.findOne({
      where,
      include: AUTOBILLINGRULE_INCLUDES,
    });

    if (!rule) {
      return error(res, "❌ Auto Billing Rule not found", null, 404);
    }

    await auditService.logAction({
      user: req.user,
      module: "auto_billing_rule",
      action: "view",
      entityId: id,
      entity: rule,
    });

    return success(res, "✅ Auto Billing Rule loaded", rule);
  } catch (err) {
    return error(res, "❌ Failed to load auto billing rule", err);
  }
};

/* ============================================================
   📌 TOGGLE AUTO BILLING RULE STATUS
============================================================ */
export const toggleAutoBillingRuleStatus = async (req, res) => {
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module: "auto_billing_rule",
      action: "update",
      res,
    });
    if (!allowed) return;

    const { id } = req.params;

    const where = { id };

    if (!isSuperAdmin(req.user)) {
      where.organization_id = req.user.organization_id;
      where.facility_id = req.user.facility_id || null;
    } else {
      if (req.query.organization_id)
        where.organization_id = req.query.organization_id;
      if (req.query.facility_id)
        where.facility_id = req.query.facility_id;
    }

    const rule = await AutoBillingRule.findOne({ where });
    if (!rule) {
      return error(res, "❌ Auto Billing Rule not found", null, 404);
    }

    const [ACTIVE, INACTIVE] = AUTO_BILLING_RULE_STATUS;
    const newStatus = rule.status === ACTIVE ? INACTIVE : ACTIVE;

    await rule.update({
      status: newStatus,
      updated_by_id: req.user?.id || null,
    });

    const full = await AutoBillingRule.findOne({
      where: { id },
      include: AUTOBILLINGRULE_INCLUDES,
    });

    await auditService.logAction({
      user: req.user,
      module: "auto_billing_rule",
      action: "toggle_status",
      entityId: id,
      entity: full,
      details: { from: rule.status, to: newStatus },
    });

    return success(
      res,
      `✅ Auto Billing Rule status set to ${newStatus}`,
      full
    );
  } catch (err) {
    return error(res, "❌ Failed to toggle auto billing rule status", err);
  }
};

/* ============================================================
   📌 GET ALL AUTO BILLING RULES LITE (FK-DRIVEN | FIXED)
============================================================ */
export const getAllAutoBillingRulesLite = async (req, res) => {
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module: "auto_billing_rule",
      action: "read",
      res,
    });
    if (!allowed) return;

    const { q } = req.query;

    const where = {
      status: AUTO_BILLING_RULE_STATUS[0], // active
    };

    /* 🔒 Tenant scope */
    if (!isSuperAdmin(req.user)) {
      where.organization_id = req.user.organization_id;
      where.facility_id = req.user.facility_id || null;
    } else {
      if (req.query.organization_id)
        where.organization_id = req.query.organization_id;
      if (req.query.facility_id)
        where.facility_id = req.query.facility_id;
    }

    /* 🔍 SEARCH (FEATURE MODULE KEY) */
    if (q) {
      where[Op.or] = [
        { "$featureModule.key$": { [Op.iLike]: `%${q}%` } },
      ];
    }

    const rules = await AutoBillingRule.findAll({
      where,
      attributes: ["id", "charge_mode"],
      include: [
        {
          model: FeatureModule,
          as: "featureModule",
          attributes: ["key"],
        },
        {
          model: BillableItem,
          as: "billableItem",
          attributes: ["id", "name", "price"],
        },
      ],
      subQuery: false,
      order: [
        [{ model: FeatureModule, as: "featureModule" }, "key", "ASC"],
      ],
      limit: 20,
    });

    const records = rules.map((r) => ({
      id: r.id,
      trigger_module: r.featureModule?.key || "", // 👈 derived, not stored
      billable_item: r.billableItem?.name || "",
      charge_mode: r.charge_mode,
    }));

    await auditService.logAction({
      user: req.user,
      module: "auto_billing_rule",
      action: "list_lite",
      details: { count: records.length, q: q || null },
    });

    return success(res, "✅ Auto Billing Rules loaded (lite)", {
      records,
    });
  } catch (err) {
    return error(res, "❌ Failed to load auto billing rules (lite)", err);
  }
};

/* ============================================================
   📌 DELETE AUTO BILLING RULE (Soft Delete)
============================================================ */
export const deleteAutoBillingRule = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module: "auto_billing_rule",
      action: "delete",
      res,
    });
    if (!allowed) return;

    const { id } = req.params;

    const where = { id };

    if (!isSuperAdmin(req.user)) {
      where.organization_id = req.user.organization_id;
      where.facility_id = req.user.facility_id || null;
    } else {
      if (req.query.organization_id)
        where.organization_id = req.query.organization_id;
      if (req.query.facility_id)
        where.facility_id = req.query.facility_id;
    }

    const rule = await AutoBillingRule.findOne({ where, transaction: t });
    if (!rule) {
      await t.rollback();
      return error(res, "❌ Auto Billing Rule not found", null, 404);
    }

    await rule.update(
      { deleted_by_id: req.user?.id || null },
      { transaction: t }
    );
    await rule.destroy({ transaction: t });

    await t.commit();

    const full = await AutoBillingRule.findOne({
      where: { id },
      include: AUTOBILLINGRULE_INCLUDES,
      paranoid: false,
    });

    await auditService.logAction({
      user: req.user,
      module: "auto_billing_rule",
      action: "delete",
      entityId: id,
      entity: full,
    });

    return success(res, "✅ Auto Billing Rule deleted", full);
  } catch (err) {
    await t.rollback();
    return error(res, "❌ Failed to delete auto billing rule", err);
  }
};
