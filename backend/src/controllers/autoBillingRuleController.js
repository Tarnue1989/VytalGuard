// 📁 controllers/autoBillingRuleController.js
import Joi from "joi";
import { Op } from "sequelize";
import {
  sequelize,
  AutoBillingRule,
  Facility,
  Organization,
  User,
  BillableItem,
  FeatureModule, // ✅ Added
} from "../models/index.js";
import { success, error } from "../utils/response.js";
import { buildQueryOptions } from "../utils/queryHelper.js";
import {
  AUTO_BILLING_RULE_STATUS,
  AUTO_BILLING_CHARGE_MODE,
} from "../constants/enums.js";
import { authzService } from "../services/authzService.js";
import { auditService } from "../services/auditService.js";
import { FIELD_VISIBILITY_AUTO_BILLING_RULE } from "../constants/fieldVisibility.js";

/* ============================================================
   🔧 HELPERS
============================================================ */
function isSuperAdmin(user) {
  if (!user) return false;
  const roles = Array.isArray(user.roleNames) ? user.roleNames : [user.role || ""];
  return roles.map((r) => r.toLowerCase().replace(/\s+/g, "")).includes("superadmin");
}

/* ============================================================
   🔗 SHARED INCLUDES
============================================================ */
const AUTOBILLINGRULE_INCLUDES = [
  { model: Organization, as: "organization", attributes: ["id", "name", "code"] },
  { model: Facility, as: "facility", attributes: ["id", "name", "code", "organization_id"] },
  { model: FeatureModule, as: "featureModule", attributes: ["id", "name", "key"] }, // ✅ Added
  { model: BillableItem, as: "billableItem", attributes: ["id", "name", "price", "status"] },
  { model: User, as: "createdBy", attributes: ["id", "first_name", "last_name"] },
  { model: User, as: "updatedBy", attributes: ["id", "first_name", "last_name"] },
  { model: User, as: "deletedBy", attributes: ["id", "first_name", "last_name"] },
];

/* ============================================================
   📋 JOI SCHEMA FACTORY
============================================================ */
function buildAutoBillingRuleSchema(userRole, mode = "create") {
  const base = {
    trigger_feature_module_id: Joi.string().uuid().allow(null), // ✅ Added
    trigger_module: Joi.string().max(100).required(),
    billable_item_id: Joi.string().uuid().required(),
    auto_generate: Joi.boolean().default(true),
    charge_mode: Joi.string().valid(...AUTO_BILLING_CHARGE_MODE).required(),
    default_price: Joi.number().precision(2).allow(null),
    status:
      mode === "create"
        ? Joi.forbidden().default(AUTO_BILLING_RULE_STATUS[0])
        : Joi.forbidden(),
  };

  if (userRole === "superadmin") {
    base.organization_id = Joi.string().uuid().optional();
    base.facility_id = Joi.string().uuid().optional();
  }

  if (mode === "update") {
    Object.keys(base).forEach((k) => {
      if (k !== "status") base[k] = base[k].optional();
    });
  }

  return Joi.object(base);
}

/* ============================================================
   📌 CREATE AUTO BILLING RULE
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

    const roleName = (req.user?.roleNames?.[0] || "").toLowerCase().replace(/\s+/g, "");
    const schema = buildAutoBillingRuleSchema(roleName, "create");
    const { error: validationError, value } = schema.validate(req.body, { stripUnknown: true });
    if (validationError) {
      await t.rollback();
      return error(res, "Validation failed", validationError, 400);
    }

    let orgId = req.user.organization_id || null;
    let facilityId = req.user.facility_id || null;
    if (isSuperAdmin(req.user)) {
      orgId = value.organization_id || req.body.organization_id || orgId;
      facilityId = value.facility_id || req.body.facility_id || facilityId;
    }
    if (!orgId) {
      await t.rollback();
      return error(res, "Missing organization assignment", null, 400);
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
      await t.rollback();
      return error(res, "Auto Billing Rule for this module/item already exists in this scope", null, 400);
    }

    const newRule = await AutoBillingRule.create(
      {
        ...value, // ✅ includes trigger_feature_module_id if provided
        organization_id: orgId,
        facility_id: facilityId,
        created_by_id: req.user?.id || null,
      },
      { transaction: t }
    );

    await t.commit();
    const full = await AutoBillingRule.findOne({ where: { id: newRule.id }, include: AUTOBILLINGRULE_INCLUDES });

    await auditService.logAction({
      user: req.user,
      module: "auto_billing_rule",
      action: "create",
      entityId: newRule.id,
      entity: full,
      details: value,
    });

    return success(res, "✅ Auto Billing Rule created", full);
  } catch (err) {
    await t.rollback();
    return error(res, "❌ Failed to create auto billing rule", err);
  }
};

/* ============================================================
   📌 UPDATE AUTO BILLING RULE
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
    const roleName = (req.user?.roleNames?.[0] || "").toLowerCase().replace(/\s+/g, "");
    const schema = buildAutoBillingRuleSchema(roleName, "update");
    const { error: validationError, value } = schema.validate(req.body, { stripUnknown: true });
    if (validationError) {
      await t.rollback();
      return error(res, "Validation failed", validationError, 400);
    }

    let orgId = req.user.organization_id || null;
    let facilityId = req.user.facility_id || null;
    if (isSuperAdmin(req.user)) {
      orgId = value.organization_id || req.query.organization_id || orgId;
      facilityId = value.facility_id || req.query.facility_id || facilityId;
    }
    if (!orgId) {
      await t.rollback();
      return error(res, "Missing organization assignment", null, 400);
    }

    const rule = await AutoBillingRule.findOne({ where: { id, organization_id: orgId, facility_id: facilityId }, transaction: t });
    if (!rule) {
      await t.rollback();
      return error(res, "Auto Billing Rule not found", null, 404);
    }

    if (value.trigger_module || value.billable_item_id) {
      const exists = await AutoBillingRule.findOne({
        where: {
          organization_id: orgId,
          facility_id: facilityId,
          trigger_module: value.trigger_module || rule.trigger_module,
          billable_item_id: value.billable_item_id || rule.billable_item_id,
          id: { [Op.ne]: id },
        },
        paranoid: false,
      });
      if (exists) {
        await t.rollback();
        return error(res, "Auto Billing Rule for this module/item already exists in this scope", null, 400);
      }
    }

    await rule.update(
      {
        ...value, // ✅ includes trigger_feature_module_id if changed
        organization_id: orgId,
        facility_id: facilityId,
        updated_by_id: req.user?.id || null,
      },
      { transaction: t }
    );

    await t.commit();
    const full = await AutoBillingRule.findOne({ where: { id }, include: AUTOBILLINGRULE_INCLUDES });

    await auditService.logAction({
      user: req.user,
      module: "auto_billing_rule",
      action: "update",
      entityId: id,
      entity: full,
      details: value,
    });

    return success(res, "✅ Auto Billing Rule updated", full);
  } catch (err) {
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

    const role = (req.user?.roleNames?.[0] || "staff").toLowerCase();
    const visibleFields = FIELD_VISIBILITY_AUTO_BILLING_RULE[role] || FIELD_VISIBILITY_AUTO_BILLING_RULE.staff;

    const options = buildQueryOptions(req, {
      model: AutoBillingRule,
      defaultSort: ["trigger_module", "ASC"],
      allowedFilters: [
        "organization_id",
        "facility_id",
        "trigger_feature_module_id", // ✅ Added
        "trigger_module",
        "billable_item_id",
        "charge_mode",
        "status",
        "created_at",
      ],
      allowedSearchFields: ["trigger_module"],
      include: AUTOBILLINGRULE_INCLUDES,
      fields: visibleFields,
    });

    options.where = options.where || {};
    if (!isSuperAdmin(req.user)) {
      options.where.organization_id = req.user.organization_id;
      if (role === "facility_head") options.where.facility_id = req.user.facility_id;
    } else {
      if (req.query.organization_id) options.where.organization_id = req.query.organization_id;
      if (req.query.facility_id) options.where.facility_id = req.query.facility_id;
    }

    if (options.search) {
      options.where[Op.or] = [{ trigger_module: { [Op.iLike]: `%${options.search}%` } }];
    }

    const { count, rows } = await AutoBillingRule.findAndCountAll({
      where: options.where,
      include: options.include,
      order: options.order,
      offset: options.offset,
      limit: options.limit,
    });

    await auditService.logAction({
      user: req.user,
      module: "auto_billing_rule",
      action: "list",
      details: { query: req.query, returned: count },
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
    const role = (req.user?.roleNames?.[0] || "staff").toLowerCase();

    const where = { id };
    if (!isSuperAdmin(req.user)) {
      where.organization_id = req.user.organization_id;
      if (role === "facility_head") {
        where.facility_id = req.user.facility_id;
      }
    } else {
      if (req.query.organization_id) where.organization_id = req.query.organization_id;
      if (req.query.facility_id) where.facility_id = req.query.facility_id;
    }

    const rule = await AutoBillingRule.findOne({ where, include: AUTOBILLINGRULE_INCLUDES });
    if (!rule) return error(res, "❌ Auto Billing Rule not found", null, 404);

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
    const role = (req.user?.roleNames?.[0] || "").toLowerCase();

    const where = { id };
    if (!isSuperAdmin(req.user)) {
      where.organization_id = req.user.organization_id;
      if (role === "facility_head") where.facility_id = req.user.facility_id;
    } else {
      if (req.query.organization_id) where.organization_id = req.query.organization_id;
      if (req.query.facility_id) where.facility_id = req.query.facility_id;
    }

    const rule = await AutoBillingRule.findOne({ where });
    if (!rule) return error(res, "❌ Auto Billing Rule not found", null, 404);

    const [ACTIVE, INACTIVE] = AUTO_BILLING_RULE_STATUS;
    const newStatus = rule.status === ACTIVE ? INACTIVE : ACTIVE;

    await rule.update({ status: newStatus, updated_by_id: req.user?.id || null });

    const full = await AutoBillingRule.findOne({ where: { id }, include: AUTOBILLINGRULE_INCLUDES });

    await auditService.logAction({
      user: req.user,
      module: "auto_billing_rule",
      action: "toggle_status",
      entityId: id,
      entity: full,
      details: { from: rule.status, to: newStatus },
    });

    return success(res, `✅ Auto Billing Rule status set to ${newStatus}`, full);
  } catch (err) {
    return error(res, "❌ Failed to toggle auto billing rule status", err);
  }
};

/* ============================================================
   📌 GET ALL AUTO BILLING RULES LITE (with ?q= support)
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
    const role = (req.user?.roleNames?.[0] || "").toLowerCase();

    const where = { status: AUTO_BILLING_RULE_STATUS[0] }; // active only

    if (!isSuperAdmin(req.user)) {
      where.organization_id = req.user.organization_id;
      if (role === "facility_head") {
        where.facility_id = req.user.facility_id;
      }
    } else {
      if (req.query.organization_id) where.organization_id = req.query.organization_id;
      if (req.query.facility_id) where.facility_id = req.query.facility_id;
    }

    if (q) {
      where[Op.or] = [
        { trigger_module: { [Op.iLike]: `%${q}%` } },
      ];
    }

    const rules = await AutoBillingRule.findAll({
      where,
      attributes: ["id", "trigger_module", "billable_item_id", "charge_mode"],
      include: [{ model: BillableItem, as: "billableItem", attributes: ["id", "name", "price"] }],
      order: [["trigger_module", "ASC"]],
      limit: 20,
    });

    const result = rules.map(r => ({
      id: r.id,
      trigger_module: r.trigger_module,
      billable_item: r.billableItem ? r.billableItem.name : "",
      charge_mode: r.charge_mode,
    }));

    await auditService.logAction({
      user: req.user,
      module: "auto_billing_rule",
      action: "list_lite",
      details: { count: result.length, query: q || null },
    });

    return success(res, "✅ Auto Billing Rules loaded (lite)", { records: result });
  } catch (err) {
    return error(res, "❌ Failed to load auto billing rules (lite)", err);
  }
};

/* ============================================================
   📌 DELETE AUTO BILLING RULE (Soft Delete with Audit)
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
    const role = (req.user?.roleNames?.[0] || "").toLowerCase();

    const where = { id };
    if (!isSuperAdmin(req.user)) {
      where.organization_id = req.user.organization_id;
      if (role === "facility_head") where.facility_id = req.user.facility_id;
    } else {
      if (req.query.organization_id) where.organization_id = req.query.organization_id;
      if (req.query.facility_id) where.facility_id = req.query.facility_id;
    }

    const rule = await AutoBillingRule.findOne({ where, transaction: t });
    if (!rule) {
      await t.rollback();
      return error(res, "❌ Auto Billing Rule not found", null, 404);
    }

    await rule.update({ deleted_by_id: req.user?.id || null }, { transaction: t });
    await rule.destroy({ transaction: t });
    await t.commit();

    const full = await AutoBillingRule.findOne({ where: { id }, include: AUTOBILLINGRULE_INCLUDES, paranoid: false });

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
