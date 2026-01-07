import Joi from "joi";
import { Op } from "sequelize";
import { sequelize, Organization, Facility, User } from "../models/index.js";
import { success, error } from "../utils/response.js";
import { buildQueryOptions } from "../utils/queryHelper.js";
import { ORG_STATUS } from "../constants/enums.js";
import { authzService } from "../services/authzService.js";
import { auditService } from "../services/auditService.js";

/* ============================================================
   🔧 HELPERS
   ============================================================ */
function isSuperAdmin(user) {
  if (!user) return false;
  const roles = Array.isArray(user.roleNames) ? user.roleNames : [user.role || ""];
  return roles.map(r => r.toLowerCase()).includes("superadmin");
}

/* ============================================================
   🔗 SHARED INCLUDES
   ============================================================ */
const ORG_INCLUDES = [
  { model: Facility, as: "facilities", attributes: ["id", "name", "code", "status"], required: false },
  { model: User, as: "createdBy", attributes: ["id", "first_name", "last_name"], required: false },
  { model: User, as: "updatedBy", attributes: ["id", "first_name", "last_name"], required: false },
  { model: User, as: "deletedBy", attributes: ["id", "first_name", "last_name"], required: false },
];

/* ============================================================
   📋 ROLE-BASED JOI SCHEMA FACTORY
   ============================================================ */
function buildOrganizationSchema(userRole, mode = "create") {
  const base = {
    name: Joi.string().max(255).required(),
    code: Joi.string().max(50).required(),
    status: Joi.string().valid(...ORG_STATUS).default(ORG_STATUS[0]),
  };

  if (mode === "update") {
    Object.keys(base).forEach(k => { base[k] = base[k].optional(); });
  }

  if (userRole !== "superadmin") {
    base.code = Joi.forbidden(); // only superadmins can set/change code
  }

  return Joi.object(base);
}

/* ============================================================
   📌 GET ALL ORGANIZATIONS
   ============================================================ */
export const getAllOrganizations = async (req, res) => {
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module: "organization",
      action: "read",
      res,
    });
    if (!allowed) return;

    const role = (req.user?.roleNames?.[0] || "staff").toLowerCase();
    const options = buildQueryOptions(req, "name", "ASC");

    options.where = options.where || {};
    if (!isSuperAdmin(req.user)) {
      options.where.id = req.user.organization_id || null;
    }

    if (options.search) {
      options.where[Op.or] = [
        { name: { [Op.iLike]: `%${options.search}%` } },
        { code: { [Op.iLike]: `%${options.search}%` } },
      ];
    }

    const { count, rows } = await Organization.findAndCountAll({
      where: options.where,
      include: ORG_INCLUDES,
      order: options.order,
      offset: options.offset,
      limit: options.limit,
    });

    await auditService.logAction({
      user: req.user,
      module: "organization",
      action: "list",
      details: { query: req.query, returned: count },
    });

    return success(res, "✅ Organizations loaded", {
      records: rows,
      pagination: {
        total: count,
        page: options.pagination.page,
        pageCount: Math.ceil(count / options.pagination.limit),
      },
    });
  } catch (err) {
    return error(res, "❌ Failed to load organizations", err);
  }
};

/* ============================================================
   📌 GET ORGANIZATION BY ID
   ============================================================ */
export const getOrganizationById = async (req, res) => {
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module: "organization",
      action: "read",
      res,
    });
    if (!allowed) return;

    const { id } = req.params;
    const where = !isSuperAdmin(req.user) ? { id: req.user.organization_id } : { id };

    const org = await Organization.findOne({ where, include: ORG_INCLUDES });
    if (!org) return error(res, "❌ Organization not found", null, 404);

    await auditService.logAction({
      user: req.user,
      module: "organization",
      action: "view",
      entityId: id,
      entity: org,
    });

    return success(res, "✅ Organization loaded", org);
  } catch (err) {
    return error(res, "❌ Failed to load organization", err);
  }
};

/* ============================================================
   📌 GET ALL ORGANIZATIONS LITE (with ?q= support)
   ============================================================ */
export const getAllOrganizationsLite = async (req, res) => {
  try {
    const { q } = req.query;

    // 🔎 Base scope
    let where = { status: ORG_STATUS[0] };

    if (!isSuperAdmin(req.user)) {
      where.id = req.user.organization_id;
    }

    // 🔎 Apply search filter
    if (q) {
      where[Op.or] = [
        { name: { [Op.iLike]: `%${q}%` } },
        { code: { [Op.iLike]: `%${q}%` } },
      ];
    }

    const orgs = await Organization.findAll({
      where,
      attributes: ["id", "name", "code"],
      order: [["name", "ASC"]],
      limit: 20, // 👈 cap results for autocomplete
    });

    await auditService.logAction({
      user: req.user,
      module: "organization",
      action: "list_lite",
      details: { count: orgs.length, query: q || null },
    });

    return success(res, "✅ Organizations loaded (lite)", {
      records: orgs,   // ✅ wrapped for consistency
    });
  } catch (err) {
    return error(res, "❌ Failed to load organizations (lite)", err);
  }
};

/* ============================================================
   📌 CREATE ORGANIZATION
   ============================================================ */
export const createOrganization = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const role = (req.user?.roleNames?.[0] || "").toLowerCase();
    const schema = buildOrganizationSchema(role, "create");
    const { error: validationError, value } = schema.validate(req.body, { stripUnknown: true });
    if (validationError) {
      await t.rollback();
      return error(res, "Validation failed", validationError, 400);
    }

    if (!isSuperAdmin(req.user)) {
      await t.rollback();
      return error(res, "❌ Only Super Admin can create organizations", null, 403);
    }

    const exists = await Organization.findOne({
      where: { code: value.code },
      paranoid: false,
      transaction: t,
    });
    if (exists) {
      await t.rollback();
      return error(res, "Organization code already exists", null, 400);
    }

    const created = await Organization.create(
      { ...value, created_by_id: req.user?.id || null },
      { transaction: t }
    );
    await t.commit();

    const full = await Organization.findOne({ where: { id: created.id }, include: ORG_INCLUDES });
    await auditService.logAction({
      user: req.user,
      module: "organization",
      action: "create",
      entityId: created.id,
      entity: full,
      details: value,
    });

    return success(res, "✅ Organization created", full);
  } catch (err) {
    await t.rollback();
    return error(res, "❌ Failed to create organization", err);
  }
};

/* ============================================================
   📌 UPDATE ORGANIZATION
   ============================================================ */
export const updateOrganization = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { id } = req.params;
    const role = (req.user?.roleNames?.[0] || "").toLowerCase();
    const schema = buildOrganizationSchema(role, "update");
    const { error: validationError, value } = schema.validate(req.body, { stripUnknown: true });
    if (validationError) {
      await t.rollback();
      return error(res, "Validation failed", validationError, 400);
    }

    const where = !isSuperAdmin(req.user) ? { id: req.user.organization_id } : { id };
    const org = await Organization.findOne({ where, transaction: t });
    if (!org) {
      await t.rollback();
      return error(res, "Organization not found", null, 404);
    }

    if (value.code) {
      const exists = await Organization.findOne({
        where: { code: value.code, id: { [Op.ne]: id } },
        paranoid: false,
        transaction: t,
      });
      if (exists) {
        await t.rollback();
        return error(res, "Organization code already in use", null, 400);
      }
    }

    await org.update({ ...value, updated_by_id: req.user?.id || null }, { transaction: t });
    await t.commit();

    const full = await Organization.findOne({ where: { id }, include: ORG_INCLUDES });
    await auditService.logAction({
      user: req.user,
      module: "organization",
      action: "update",
      entityId: id,
      entity: full,
      details: value,
    });

    return success(res, "✅ Organization updated", full);
  } catch (err) {
    await t.rollback();
    return error(res, "❌ Failed to update organization", err);
  }
};

/* ============================================================
   📌 TOGGLE ORGANIZATION STATUS
   ============================================================ */
export const toggleOrganizationStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const where = !isSuperAdmin(req.user) ? { id: req.user.organization_id } : { id };

    const org = await Organization.findOne({ where });
    if (!org) return error(res, "❌ Organization not found", null, 404);

    const [ACTIVE, INACTIVE] = ORG_STATUS;
    const newStatus = org.status === ACTIVE ? INACTIVE : ACTIVE;

    await org.update({ status: newStatus, updated_by_id: req.user?.id || null });
    const full = await Organization.findOne({ where: { id }, include: ORG_INCLUDES });

    await auditService.logAction({
      user: req.user,
      module: "organization",
      action: "toggle-status",   // 👈 matches your route
      entityId: id,
      entity: full,
      details: { from: org.status, to: newStatus },
    });

    return success(res, `✅ Organization status toggled to ${newStatus}`, full);
  } catch (err) {
    return error(res, "❌ Failed to toggle organization status", err);
  }
};


/* ============================================================
   📌 DELETE ORGANIZATION (Soft Delete with Audit)
   ============================================================ */
export const deleteOrganization = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { id } = req.params;
    if (!isSuperAdmin(req.user)) {
      await t.rollback();
      return error(res, "❌ Only Super Admin can delete organizations", null, 403);
    }

    const org = await Organization.findOne({ where: { id }, transaction: t });
    if (!org) {
      await t.rollback();
      return error(res, "❌ Organization not found", null, 404);
    }

    await org.update({ deleted_by_id: req.user?.id || null }, { transaction: t });
    await org.destroy({ transaction: t });
    await t.commit();

    const full = await Organization.findOne({ where: { id }, include: ORG_INCLUDES, paranoid: false });
    await auditService.logAction({
      user: req.user,
      module: "organization",
      action: "delete",
      entityId: id,
      entity: full,
    });

    return success(res, "✅ Organization deleted", full);
  } catch (err) {
    await t.rollback();
    return error(res, "❌ Failed to delete organization", err);
  }
};
