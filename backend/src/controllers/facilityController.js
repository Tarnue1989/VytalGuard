// 📁 controllers/facilityController.js
import Joi from "joi";
import { Op } from "sequelize";
import { sequelize, Facility, Organization, User, Department, Employee } from "../models/index.js";
import { success, error } from "../utils/response.js";
import { buildQueryOptions } from "../utils/queryHelper.js";
import { FACILITY_STATUS } from "../constants/enums.js";
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

const FACILITY_INCLUDES = [
  { model: Organization, as: "organization", attributes: ["id", "name", "code"], required: false },
  { model: User, as: "createdBy", attributes: ["id", "first_name", "last_name"], required: false },
  { model: User, as: "updatedBy", attributes: ["id", "first_name", "last_name"], required: false },
  { model: User, as: "deletedBy", attributes: ["id", "first_name", "last_name"], required: false },
];

/* ============================================================
   📋 ROLE-BASED JOI SCHEMA FACTORY
   ============================================================ */
function buildFacilitySchema(userRole, mode = "create") {
  const base = {
    organization_id: Joi.string().uuid().required(),
    name: Joi.string().max(255).required(),
    code: Joi.string().max(50).required(),
    address: Joi.string().max(255).allow(null, ""),
    phone: Joi.string().max(50).allow(null, ""),
    email: Joi.string().email().max(120).allow(null, ""),
    status: Joi.string().valid(...FACILITY_STATUS).default(FACILITY_STATUS[0]),
  };

  if (mode === "update") {
    Object.keys(base).forEach(k => { base[k] = base[k].optional(); });
  }

  if (userRole !== "superadmin") {
    base.organization_id = Joi.forbidden(); // only superadmin can assign org
    base.code = Joi.forbidden();            // only superadmin can set code
  }

  return Joi.object(base);
}

/* ============================================================
   📌 GET ALL FACILITIES
   ============================================================ */
export const getAllFacilities = async (req, res) => {
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module: "facility",
      action: "read",
      res,
    });
    if (!allowed) return;

    const role = (req.user?.roleNames?.[0] || "staff").toLowerCase();
    const options = buildQueryOptions(req, "name", "ASC");

    options.where = options.where || {};
    if (!isSuperAdmin(req.user)) {
      if (req.user.facility_id) options.where.id = req.user.facility_id;
      else if (req.user.organization_id) options.where.organization_id = req.user.organization_id;
    }

    if (options.search) {
      options.where = {
        ...options.where,
        [Op.or]: [
          { name: { [Op.iLike]: `%${options.search}%` } },
          { code: { [Op.iLike]: `%${options.search}%` } },
        ]
      };
    }

    const { count, rows } = await Facility.findAndCountAll({
      where: options.where,
      include: FACILITY_INCLUDES,
      order: options.order,
      offset: options.offset,
      limit: options.limit,
    });

    await auditService.logAction({
      user: req.user,
      module: "facility",
      action: "list",
      details: { query: req.query, returned: count },
    });

    return success(res, "✅ Facilities loaded", {
      records: rows,
      pagination: {
        total: count,
        page: options.pagination.page,
        pageCount: Math.ceil(count / options.pagination.limit),
      },
    });
  } catch (err) {
    return error(res, "❌ Failed to load facilities", err);
  }
};

/* ============================================================
   📌 GET FACILITY BY ID
   ============================================================ */
export const getFacilityById = async (req, res) => {
  try {
    const allowed = await authzService.checkPermission({
      user: req.user,
      module: "facility",
      action: "read",
      res,
    });
    if (!allowed) return;

    const { id } = req.params;
    const where = !isSuperAdmin(req.user)
      ? (req.user.facility_id ? { id: req.user.facility_id } : { organization_id: req.user.organization_id })
      : { id };

    const facility = await Facility.findOne({ where, include: FACILITY_INCLUDES });
    if (!facility) return error(res, "❌ Facility not found", null, 404);

    await auditService.logAction({
      user: req.user,
      module: "facility",
      action: "view",
      entityId: id,
      entity: facility,
    });

    return success(res, "✅ Facility loaded", facility);
  } catch (err) {
    return error(res, "❌ Failed to load facility", err);
  }
};

/* ============================================================
   📌 CREATE FACILITY
   ============================================================ */
export const createFacility = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const role = (req.user?.roleNames?.[0] || "").toLowerCase();
    const schema = buildFacilitySchema(role, "create");
    const { error: validationError, value } = schema.validate(req.body, { stripUnknown: true });
    if (validationError) {
      await t.rollback();
      return error(res, "Validation failed", validationError, 400);
    }

    if (!isSuperAdmin(req.user) && !req.user.organization_id) {
      await t.rollback();
      return error(res, "❌ Missing organization assignment", null, 403);
    }

    const targetOrgId = isSuperAdmin(req.user) ? value.organization_id : req.user.organization_id;
    const exists = await Facility.findOne({ where: { code: value.code }, paranoid: false, transaction: t });
    if (exists) {
      await t.rollback();
      return error(res, "❌ Facility code already exists", null, 400);
    }

    const created = await Facility.create(
      { ...value, organization_id: targetOrgId, created_by_id: req.user?.id || null },
      { transaction: t }
    );
    await t.commit();

    const full = await Facility.findOne({ where: { id: created.id }, include: FACILITY_INCLUDES });
    await auditService.logAction({
      user: req.user,
      module: "facility",
      action: "create",
      entityId: created.id,
      entity: full,
      details: value,
    });

    return success(res, "✅ Facility created", full);
  } catch (err) {
    await t.rollback();
    return error(res, "❌ Failed to create facility", err);
  }
};

/* ============================================================
   📌 UPDATE FACILITY
   ============================================================ */
export const updateFacility = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { id } = req.params;
    const role = (req.user?.roleNames?.[0] || "").toLowerCase();
    const schema = buildFacilitySchema(role, "update");
    const { error: validationError, value } = schema.validate(req.body, { stripUnknown: true });
    if (validationError) {
      await t.rollback();
      return error(res, "Validation failed", validationError, 400);
    }

    const where = !isSuperAdmin(req.user)
      ? (req.user.facility_id ? { id: req.user.facility_id } : { organization_id: req.user.organization_id })
      : { id };

    const facility = await Facility.findOne({ where, transaction: t });
    if (!facility) {
      await t.rollback();
      return error(res, "❌ Facility not found", null, 404);
    }

    if (value.code) {
      const exists = await Facility.findOne({
        where: { code: value.code, id: { [Op.ne]: id } },
        paranoid: false,
        transaction: t,
      });
      if (exists) {
        await t.rollback();
        return error(res, "❌ Facility code already in use", null, 400);
      }
    }

    await facility.update({ ...value, updated_by_id: req.user?.id || null }, { transaction: t });
    await t.commit();

    const full = await Facility.findOne({ where: { id }, include: FACILITY_INCLUDES });
    await auditService.logAction({
      user: req.user,
      module: "facility",
      action: "update",
      entityId: id,
      entity: full,
      details: value,
    });

    return success(res, "✅ Facility updated", full);
  } catch (err) {
    await t.rollback();
    return error(res, "❌ Failed to update facility", err);
  }
};

/* ============================================================
   📌 TOGGLE FACILITY STATUS
   ============================================================ */
export const toggleFacilityStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const where = !isSuperAdmin(req.user)
      ? (req.user.facility_id ? { id: req.user.facility_id } : { organization_id: req.user.organization_id })
      : { id };

    const facility = await Facility.findOne({ where });
    if (!facility) return error(res, "❌ Facility not found", null, 404);

    const [ACTIVE, INACTIVE] = FACILITY_STATUS;
    const newStatus = facility.status === ACTIVE ? INACTIVE : ACTIVE;

    await facility.update({ status: newStatus, updated_by_id: req.user?.id || null });
    const full = await Facility.findOne({ where: { id }, include: FACILITY_INCLUDES });

    await auditService.logAction({
      user: req.user,
      module: "facility",
      action: "toggle-status",
      entityId: id,
      entity: full,
      details: { from: facility.status, to: newStatus },
    });

    return success(res, `✅ Facility status toggled to ${newStatus}`, full);
  } catch (err) {
    return error(res, "❌ Failed to toggle facility status", err);
  }
};

/* ============================================================
   📌 GET ALL FACILITIES LITE (with ?q= support)
   ============================================================ */
export const getAllFacilitiesLite = async (req, res) => {
  try {
    const { q } = req.query;

    // 🔎 Base scope
    let where = { status: FACILITY_STATUS[0] }; // active only

    if (!isSuperAdmin(req.user)) {
      if (req.user.facility_id) {
        where.id = req.user.facility_id;
      } else if (req.user.organization_id) {
        where.organization_id = req.user.organization_id;
      }
    }

    // 🔎 Apply search filter
    if (q) {
      where[Op.or] = [
        { name: { [Op.iLike]: `%${q}%` } },
        { code: { [Op.iLike]: `%${q}%` } },
      ];
    }

    const facilities = await Facility.findAll({
      where,
      attributes: ["id", "name", "code"],
      order: [["name", "ASC"]],
      limit: 20, // 👈 cap results for autocomplete
    });

    await auditService.logAction({
      user: req.user,
      module: "facility",
      action: "list_lite",
      details: { count: facilities.length, query: q || null },
    });

    return success(res, "✅ Facilities loaded (lite)", {
      records: facilities,   // ✅ wrapped for consistency
    });
  } catch (err) {
    return error(res, "❌ Failed to load facilities (lite)", err);
  }
};

/* ============================================================
   📌 DELETE FACILITY (Soft Delete with Audit + Dependency Check)
   ============================================================ */
export const deleteFacility = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { id } = req.params;
    if (!isSuperAdmin(req.user)) {
      await t.rollback();
      return error(res, "❌ Only Super Admin can delete facilities", null, 403);
    }

    const facility = await Facility.findOne({ where: { id }, transaction: t });
    if (!facility) {
      await t.rollback();
      return error(res, "❌ Facility not found", null, 404);
    }

    const linkedDepartments = await Department.count({ where: { facility_id: id }, transaction: t });
    const linkedEmployees = await Employee.count({ where: { facility_id: id }, transaction: t });
    if (linkedDepartments > 0 || linkedEmployees > 0) {
      await t.rollback();
      return error(res, "❌ Cannot delete — facility has linked departments or employees", null, 400);
    }

    await facility.update({ deleted_by_id: req.user?.id || null }, { transaction: t });
    await facility.destroy({ transaction: t });
    await t.commit();

    const full = await Facility.findOne({ where: { id }, include: FACILITY_INCLUDES, paranoid: false });
    await auditService.logAction({
      user: req.user,
      module: "facility",
      action: "delete",
      entityId: id,
      entity: full,
    });

    return success(res, "✅ Facility deleted", full);
  } catch (err) {
    await t.rollback();
    return error(res, "❌ Failed to delete facility", err);
  }
};
