// 📁 backend/src/controllers/discountPolicyController.js
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
import { POLICY_STATUS, DISCOUNT_TYPE, POLICY_APPLIES_TO } from "../constants/enums.js";
import { authzService } from "../services/authzService.js";
import { auditService } from "../services/auditService.js";
import { FIELD_VISIBILITY_DISCOUNT_POLICY } from "../constants/fieldVisibility.js";

const MODULE_KEY = "discount_policy";

// 🔖 Local enum map
const PS = {
  ACTIVE: POLICY_STATUS[0],
  INACTIVE: POLICY_STATUS[1],
  EXPIRED: POLICY_STATUS[2],
};

/* ============================================================
   🔧 HELPERS
============================================================ */
function isSuperAdmin(user) {
  if (!user) return false;
  const roles = Array.isArray(user.roleNames) ? user.roleNames : [user.role || ""];
  return roles.map((r) => r.toLowerCase()).includes("superadmin");
}

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
   📋 JOI SCHEMA FACTORY
============================================================ */
function buildPolicySchema(mode = "create") {
  return Joi.object({
    code: Joi.string().max(50).required(),
    name: Joi.string().max(150).required(),
    description: Joi.string().allow(null, ""),
    discount_type: Joi.string().valid(...DISCOUNT_TYPE).required(),
    discount_value: Joi.number().min(0).required(),
    applies_to: Joi.string().valid(...POLICY_APPLIES_TO).default("all"),
    condition_json: Joi.object().unknown(true).allow(null),
    effective_from: Joi.date().allow(null),
    effective_to: Joi.date().allow(null),
    status: Joi.string().valid(...POLICY_STATUS).default(PS.ACTIVE),
    organization_id: Joi.string().uuid().allow(null),
    facility_id: Joi.string().uuid().allow(null),
  });
}

/* ============================================================
   📌 GET ALL POLICIES
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
      FIELD_VISIBILITY_DISCOUNT_POLICY[role] || FIELD_VISIBILITY_DISCOUNT_POLICY.staff;

    const options = buildQueryOptions(req, "created_at", "DESC", visibleFields);
    options.where = options.where || {};

    if (!isSuperAdmin(req.user)) {
      options.where.organization_id = req.user.organization_id;
      if (role === "facility_head") options.where.facility_id = req.user.facility_id;
    } else {
      if (req.query.organization_id) options.where.organization_id = req.query.organization_id;
      if (req.query.facility_id) options.where.facility_id = req.query.facility_id;
    }

    if (req.query.status) options.where.status = req.query.status;
    if (req.query.discount_type) options.where.discount_type = req.query.discount_type;

    if (options.search) {
      const term = `%${options.search}%`;
      options.where[Op.or] = [
        { code: { [Op.iLike]: term } },
        { name: { [Op.iLike]: term } },
        { description: { [Op.iLike]: term } },
      ];
    }

    const { count, rows } = await DiscountPolicy.findAndCountAll({
      where: options.where,
      include: POLICY_INCLUDES,
      order: options.order,
      offset: options.offset,
      limit: options.limit,
      distinct: true,
    });

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "list",
      details: { query: req.query, returned: count },
    });

    return success(res, "✅ Policies loaded", {
      records: rows,
      pagination: {
        total: count,
        page: options.pagination.page,
        pageCount: Math.ceil(count / options.pagination.limit),
      },
    });
  } catch (err) {
    return error(res, "❌ Failed to load policies", err);
  }
};

/* ============================================================
   📌 GET POLICY BY ID
============================================================ */
export const getPolicyById = async (req, res) => {
  try {
    const where = { id: req.params.id };
    if (!isSuperAdmin(req.user)) {
      where.organization_id = req.user.organization_id;
    }

    const record = await DiscountPolicy.findOne({ where, include: POLICY_INCLUDES });
    if (!record) return error(res, "❌ Policy not found", null, 404);

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "view",
      entityId: req.params.id,
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
    const schema = buildPolicySchema("create");
    const { error: validationError, value } = schema.validate(req.body, {
      stripUnknown: true,
    });

    if (validationError) {
      await t.rollback();
      return error(res, "Validation failed", validationError, 400);
    }

    const record = await DiscountPolicy.create(
      {
        ...value,
        organization_id: value.organization_id || req.user.organization_id,
        facility_id: value.facility_id || req.user.facility_id,
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
   📌 UPDATE POLICY
============================================================ */
export const updatePolicy = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const record = await DiscountPolicy.findByPk(req.params.id, { transaction: t });
    if (!record) {
      await t.rollback();
      return error(res, "❌ Policy not found", null, 404);
    }

    const schema = buildPolicySchema("update");
    const { error: validationError, value } = schema.validate(req.body, {
      stripUnknown: true,
    });

    if (validationError) {
      await t.rollback();
      return error(res, "Validation failed", validationError, 400);
    }

    await record.update(
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
      entityId: req.params.id,
      entity: record,
    });

    return success(res, "✅ Policy updated", record);
  } catch (err) {
    if (t && !t.finished) await t.rollback();
    return error(res, "❌ Failed to update policy", err);
  }
};

/* ============================================================
   📌 ACTIVATE / DEACTIVATE / EXPIRE
============================================================ */
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
      entityId: req.params.id,
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
      entityId: req.params.id,
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
      entityId: req.params.id,
      entity: record,
    });

    return success(res, "✅ Policy expired", record);
  } catch (err) {
    return error(res, "❌ Failed to expire policy", err);
  }
};

/* ============================================================
   📌 DELETE (Soft Delete) & RESTORE
============================================================ */
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
      entityId: req.params.id,
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
    if (!record.deleted_at) {
      await t.rollback();
      return error(res, "❌ Policy is not deleted", null, 400);
    }

    await record.restore({ transaction: t });
    await record.update({ updated_by_id: req.user?.id || null }, { transaction: t });
    await t.commit();

    await auditService.logAction({
      user: req.user,
      module: MODULE_KEY,
      action: "restore",
      entityId: req.params.id,
      entity: record,
    });

    return success(res, "✅ Policy restored", record);
  } catch (err) {
    if (t && !t.finished) await t.rollback();
    return error(res, "❌ Failed to restore policy", err);
  }
};

/* ============================================================
   📌 LITE FETCH (for dropdowns/search)
============================================================ */
export const getAllPoliciesLite = async (req, res) => {
  try {
    const { q } = req.query;
    const where = {};
    if (q)
      where[Op.or] = [
        { code: { [Op.iLike]: `%${q}%` } },
        { name: { [Op.iLike]: `%${q}%` } },
      ];

    if (!isSuperAdmin(req.user)) {
      where.organization_id = req.user.organization_id;
      const role = (req.user?.roleNames?.[0] || "").toLowerCase();
      if (role === "facility_head") where.facility_id = req.user.facility_id;
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
