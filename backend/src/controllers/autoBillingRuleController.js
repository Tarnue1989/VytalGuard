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
import { isSuperAdmin } from "../utils/role-utils.js";

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
   📋 ROLE-AWARE JOI SCHEMA (Patient-Parity)
============================================================ */
function buildAutoBillingRuleSchema(user, mode = "create") {
  const base = {
    trigger_feature_module_id: Joi.string().uuid().allow("", null),
    trigger_module: Joi.string().max(100).required(),
    billable_item_id: Joi.string().uuid().required(),

    auto_generate: Joi.boolean().default(true),
    charge_mode: Joi.string()
      .valid(...AUTO_BILLING_CHARGE_MODE)
      .required(),
    default_price: Joi.number().precision(2).allow(null),

    // 🔒 backend controlled
    status: Joi.forbidden(),

    organization_id: Joi.forbidden(),
    facility_id: Joi.string().uuid().allow("", null),
  };

  /* 🔓 SUPER ADMIN OVERRIDE */
  if (isSuperAdmin(user)) {
    base.organization_id = Joi.string().uuid().required();
    base.facility_id = Joi.string().uuid().allow("", null);
  }

  /* ✏️ UPDATE MODE */
  if (mode === "update") {
    Object.keys(base).forEach((k) => {
      base[k] = base[k].optional();
    });
  }

  return Joi.object(base);
}

/* ============================================================
   📌 CREATE AUTO BILLING RULE (DEBUG-ALIGNED)
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

    debug.log("PERMISSION CHECK", {
      module: "auto_billing_rule",
      action: "create",
      allowed,
      userId: req.user?.id,
      roles: req.user?.roleNames,
    });

    if (!allowed) return;

    debug.log("create → incoming body", req.body);

    const { value, errors } = validate(
      buildAutoBillingRuleSchema(req.user, "create"),
      req.body
    );

    if (errors) {
      debug.warn("create → validation failed", errors);
      await t.rollback();
      return res.status(400).json({ success: false, errors });
    }

    debug.log("create → validated payload", value);

    const { orgId, facilityId } = resolveOrgFacility({
      user: req.user,
      value,
      body: req.body,
    });

    debug.log("create → resolved scope", { orgId, facilityId });

    if (!orgId) {
      debug.warn("create → missing organization");
      await t.rollback();
      return error(res, "Organization is required", null, 400);
    }

    const exists = await AutoBillingRule.findOne({
      where: {
        organization_id: orgId,
        facility_id: facilityId,
        trigger_module: value.trigger_module,
        billable_item_id: value.billable_item_id,
      },
      paranoid: false,
      transaction: t,
    });

    if (exists) {
      debug.warn("create → duplicate detected", {
        existingId: exists.id,
      });
      await t.rollback();
      return error(
        res,
        "Auto Billing Rule already exists for this module and item",
        null,
        400
      );
    }

    const created = await AutoBillingRule.create(
      {
        ...value,
        organization_id: orgId,
        facility_id: facilityId,
        status: AUTO_BILLING_RULE_STATUS[0],
        created_by_id: req.user?.id || null,
      },
      { transaction: t }
    );

    debug.log("create → created record", created.toJSON());

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
    debug.error("create → FAILED", err);
    await t.rollback();
    return error(res, "❌ Failed to create auto billing rule", err);
  }
};


/* ============================================================
   📌 UPDATE AUTO BILLING RULE (DEBUG-ALIGNED)
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

    debug.log("PERMISSION CHECK", {
      module: "auto_billing_rule",
      action: "update",
      allowed,
      userId: req.user?.id,
      roles: req.user?.roleNames,
    });

    if (!allowed) return;

    const { id } = req.params;

    debug.log("update → incoming body", req.body);

    const { value, errors } = validate(
      buildAutoBillingRuleSchema(req.user, "update"),
      req.body
    );

    if (errors) {
      debug.warn("update → validation failed", errors);
      await t.rollback();
      return res.status(400).json({ success: false, errors });
    }

    const where = { id };
    if (!isSuperAdmin(req.user)) {
      where.organization_id = req.user.organization_id;
      where.facility_id = req.user.facility_id || null;
    }

    const rule = await AutoBillingRule.findOne({ where, transaction: t });
    if (!rule) {
      debug.warn("update → rule not found", { id });
      await t.rollback();
      return error(res, "Auto Billing Rule not found", null, 404);
    }

    debug.log("update → before", rule.toJSON());

    if (value.trigger_module || value.billable_item_id) {
      const exists = await AutoBillingRule.findOne({
        where: {
          organization_id: rule.organization_id,
          facility_id: rule.facility_id,
          trigger_module: value.trigger_module || rule.trigger_module,
          billable_item_id: value.billable_item_id || rule.billable_item_id,
          id: { [Op.ne]: id },
        },
        paranoid: false,
      });

      if (exists) {
        debug.warn("update → duplicate detected", {
          existingId: exists.id,
        });
        await t.rollback();
        return error(
          res,
          "Another Auto Billing Rule already exists for this module and item",
          null,
          400
        );
      }
    }

    const { orgId, facilityId } = resolveOrgFacility({
      user: req.user,
      value,
      body: req.body,
    });

    await rule.update(
      {
        ...value,
        organization_id: orgId,
        facility_id: facilityId,
        updated_by_id: req.user?.id || null,
      },
      { transaction: t }
    );

    debug.log("update → after", rule.toJSON());

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
    debug.error("update → FAILED", err);
    await t.rollback();
    return error(res, "❌ Failed to update auto billing rule", err);
  }
};

/* ============================================================
   📌 GET ALL AUTO BILLING RULES
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

    const options = buildQueryOptions(
      req,
      "trigger_module",
      "ASC"
    );

    options.where = options.where || {};

    // 🔒 Tenant scope
    if (!isSuperAdmin(req.user)) {
      options.where.organization_id = req.user.organization_id;
      options.where.facility_id = req.user.facility_id || null;
    } else {
      if (req.query.organization_id)
        options.where.organization_id = req.query.organization_id;
      if (req.query.facility_id)
        options.where.facility_id = req.query.facility_id;
    }

    // 🔍 Search
    if (options.search) {
      options.where[Op.or] = [
        { trigger_module: { [Op.iLike]: `%${options.search}%` } },
      ];
    }

    const { count, rows } = await AutoBillingRule.findAndCountAll({
      where: options.where,
      include: AUTOBILLINGRULE_INCLUDES, // associations handled here
      order: options.order,
      offset: options.offset,
      limit: options.limit,
      distinct: true,
    });

    return success(res, "✅ Auto Billing Rules loaded", {
      records: rows,
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
   📌 GET ALL AUTO BILLING RULES LITE
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

    if (!isSuperAdmin(req.user)) {
      where.organization_id = req.user.organization_id;
      where.facility_id = req.user.facility_id || null;
    } else {
      if (req.query.organization_id)
        where.organization_id = req.query.organization_id;
      if (req.query.facility_id)
        where.facility_id = req.query.facility_id;
    }

    if (q) {
      where[Op.or] = [
        { trigger_module: { [Op.iLike]: `%${q}%` } },
      ];
    }

    const rules = await AutoBillingRule.findAll({
      where,
      attributes: ["id", "trigger_module", "charge_mode"],
      include: [
        {
          model: BillableItem,
          as: "billableItem",
          attributes: ["id", "name", "price"],
        },
      ],
      order: [["trigger_module", "ASC"]],
      limit: 20,
    });

    const records = rules.map((r) => ({
      id: r.id,
      trigger_module: r.trigger_module,
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
