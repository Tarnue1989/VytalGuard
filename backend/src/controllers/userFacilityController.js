// 📁 controllers/userFacilityController.js
import Joi from "joi";
import { Op } from "sequelize";
import { sequelize, UserFacility, User, Facility, Role } from "../models/index.js";
import { success, error } from "../utils/response.js";
import { buildQueryOptions } from "../utils/queryHelper.js";
import { USER_FACILITY_STATUS } from "../constants/enums.js";

/* ============================================================
   📌 HELPER: Resolve Scope
   ============================================================ */
function resolveScope(req) {
  if (req.user?.roleNames?.includes("superadmin")) return { scope: "superadmin" };
  if (req.user?.organization_id) return { scope: "organization", organization_id: req.user.organization_id };
  if (req.user?.facility_id) return { scope: "facility", facility_id: req.user.facility_id };
  return { scope: "none" };
}

/* ============================================================
   📌 GET ALL USER-FACILITY LINKS
   ============================================================ */
export const getAllUserFacilities = async (req, res) => {
  try {
    const { scope, facility_id, organization_id } = resolveScope(req);

    const options = buildQueryOptions(
      req,
      {
        user_id: { type: "exact", field: "user_id" },
        facility_id: { type: "exact", field: "facility_id" },
        role_id: { type: "exact", field: "role_id" },
        is_active: { type: "enum", field: "is_active" },
        is_default: { type: "boolean", field: "is_default" },
      },
      "created_at",
      "DESC"
    );

    options.where = options.where || {};

    if (options.search) {
      options.where[Op.or] = [
        { "$user.username$": { [Op.iLike]: `%${options.search}%` } },
        { "$user.email$": { [Op.iLike]: `%${options.search}%` } },
        { "$user.first_name$": { [Op.iLike]: `%${options.search}%` } },
        { "$user.last_name$": { [Op.iLike]: `%${options.search}%` } },
        { "$facility.name$": { [Op.iLike]: `%${options.search}%` } },
        { "$facility.code$": { [Op.iLike]: `%${options.search}%` } },
        { "$role.name$": { [Op.iLike]: `%${options.search}%` } },
      ];
    }

    // 🔒 Scope enforcement
    if (scope === "facility") {
      options.where.facility_id = facility_id;
    } else if (scope === "organization") {
      options.include = [
        {
          model: Facility,
          as: "facility",
          where: { organization_id },
          required: true,
        },
      ];
    }

    const { count, rows } = await UserFacility.findAndCountAll({
      where: options.where,
      include: [
        { model: User, as: "user", attributes: ["id", "username", "email", "first_name", "last_name", "full_name"] },
        { model: Facility, as: "facility", attributes: ["id", "name", "code", "organization_id"] },
        { model: Role, as: "role", attributes: ["id", "name"] },
        ...(options.include || []),
      ],
      order: options.order,
      offset: options.offset,
      limit: options.limit,
    });

    return success(res, "✅ User-Facility links loaded", {
      records: rows,
      pagination: {
        total: count,
        page: options.pagination.page,
        pageCount: Math.ceil(count / options.pagination.limit),
      },
    });
  } catch (err) {
    console.error("❌ getAllUserFacilities error:", err);
    return error(res, "❌ Failed to load user-facility links", err);
  }
};

/* ============================================================
   📌 GET USER-FACILITY BY ID
   ============================================================ */
export const getUserFacilityById = async (req, res) => {
  try {
    const { scope, facility_id, organization_id } = resolveScope(req);
    const { id } = req.params;

    const link = await UserFacility.findByPk(id, {
      include: [
        { model: User, as: "user", attributes: ["id", "username", "email", "first_name", "last_name", "full_name"] },
        { model: Facility, as: "facility", attributes: ["id", "name", "code", "organization_id"] },
        { model: Role, as: "role", attributes: ["id", "name"] },
      ],
    });

    if (!link) return error(res, "❌ User-Facility link not found", {}, 404);

    // 🔒 Scope enforcement
    if (scope === "facility" && link.facility_id !== facility_id) {
      return error(res, "❌ Not authorized", {}, 403);
    }
    if (scope === "organization" && link.facility.organization_id !== organization_id) {
      return error(res, "❌ Not authorized", {}, 403);
    }

    return success(res, "✅ User-Facility link loaded", link);
  } catch (err) {
    console.error("❌ getUserFacilityById error:", err);
    return error(res, "❌ Failed to load user-facility link", err);
  }
};

/* ============================================================
   📌 GET USER-FACILITIES LITE (with ?q= support)
   ============================================================ */
export const getUserFacilitiesLite = async (req, res) => {
  try {
    const { scope, facility_id, organization_id } = resolveScope(req);
    const { q } = req.query;

    const where = { is_active: "active" };
    if (scope === "facility") where.facility_id = facility_id;
    if (scope === "organization") where["$facility.organization_id$"] = organization_id;

    // 🔎 Optional search filter (user name, email, facility, role)
    if (q) {
      where[Op.or] = [
        { "$user.first_name$": { [Op.iLike]: `%${q}%` } },
        { "$user.last_name$": { [Op.iLike]: `%${q}%` } },
        { "$user.username$": { [Op.iLike]: `%${q}%` } },
        { "$user.email$": { [Op.iLike]: `%${q}%` } },
        { "$facility.name$": { [Op.iLike]: `%${q}%` } },
        { "$role.name$": { [Op.iLike]: `%${q}%` } },
      ];
    }

    const records = await UserFacility.findAll({
      where,
      attributes: ["id", "user_id", "facility_id", "role_id", "is_default"],
      include: [
        { model: User, as: "user", attributes: ["id", "first_name", "last_name", "username", "email"] },
        { model: Facility, as: "facility", attributes: ["id", "name", "code", "organization_id"] },
        { model: Role, as: "role", attributes: ["id", "name"] },
      ],
      order: [["created_at", "DESC"]],
      limit: 20, // 👈 autocomplete cap
    });

    const result = records.map((r) => ({
      id: r.id,
      user_id: r.user_id,
      user_name:
        [r.user?.first_name, r.user?.last_name].filter(Boolean).join(" ") ||
        r.user?.username ||
        "",
      email: r.user?.email || "",
      facility_id: r.facility_id,
      facility_name: r.facility?.name || "",
      role_id: r.role_id,
      role_name: r.role?.name || "",
      is_default: r.is_default,
    }));

    await auditService.logAction({
      user: req.user,
      module: "userFacility",
      action: "list_lite",
      details: { count: result.length, query: q || null },
    });

    return success(res, "✅ User-Facilities loaded (lite)", { records: result });
  } catch (err) {
    console.error("❌ getUserFacilitiesLite error:", err);
    return error(res, "❌ Failed to load user-facility lite list", err);
  }
};

/* ============================================================
   📌 CREATE
   ============================================================ */
export const createUserFacility = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { scope, facility_id, organization_id } = resolveScope(req);

    const schema = Joi.object({
      user_id: Joi.string().uuid().required(),
      facility_id: Joi.string().uuid().required(),
      role_id: Joi.string().uuid().allow("", null),
      is_default: Joi.boolean().default(false),
      is_active: Joi.string().valid(...USER_FACILITY_STATUS).default("active"),
    });

    const { error: validationError, value } = schema.validate(req.body);
    if (validationError) {
      await t.rollback();
      return error(res, validationError.details[0].message);
    }

    // 🔒 Scope enforcement
    if (scope === "facility" && value.facility_id !== facility_id) {
      await t.rollback();
      return error(res, "❌ Cannot assign outside your facility", {}, 403);
    }

    if (scope === "organization") {
      const targetFacility = await Facility.findByPk(value.facility_id);
      if (!targetFacility || targetFacility.organization_id !== organization_id) {
        await t.rollback();
        return error(res, "❌ Facility not in your organization", {}, 403);
      }
    }

    const exists = await UserFacility.findOne({
      where: { user_id: value.user_id, facility_id: value.facility_id },
      paranoid: false,
    });
    if (exists) {
      await t.rollback();
      return error(res, "❌ This user is already linked to the facility");
    }

    if (value.is_default) {
      await UserFacility.update(
        { is_default: false },
        { where: { user_id: value.user_id }, transaction: t }
      );
    }

    const created = await UserFacility.create(
      { ...value, created_by_id: req.user?.id || null },
      { transaction: t }
    );

    await t.commit();
    return success(res, "✅ User-Facility link created", created);
  } catch (err) {
    await t.rollback();
    console.error("❌ createUserFacility error:", err);
    return error(res, "❌ Failed to create user-facility link", err);
  }
};

/* ============================================================
   📌 UPDATE
   ============================================================ */
export const updateUserFacility = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { scope, facility_id, organization_id } = resolveScope(req);
    const { id } = req.params;

    const schema = Joi.object({
      role_id: Joi.string().uuid().allow("", null),
      is_default: Joi.boolean(),
      is_active: Joi.string().valid(...USER_FACILITY_STATUS),
    });

    const { error: validationError, value } = schema.validate(req.body);
    if (validationError) {
      await t.rollback();
      return error(res, validationError.details[0].message);
    }

    const link = await UserFacility.findByPk(id, {
      include: [{ model: Facility, as: "facility" }],
      transaction: t,
    });
    if (!link) {
      await t.rollback();
      return error(res, "❌ User-Facility link not found", {}, 404);
    }

    // 🔒 Scope enforcement
    if (scope === "facility" && link.facility_id !== facility_id) {
      await t.rollback();
      return error(res, "❌ Not authorized", {}, 403);
    }
    if (scope === "organization" && link.facility.organization_id !== organization_id) {
      await t.rollback();
      return error(res, "❌ Not authorized", {}, 403);
    }

    if (value.is_default) {
      await UserFacility.update(
        { is_default: false },
        { where: { user_id: link.user_id, id: { [Op.ne]: id } }, transaction: t }
      );
    }

    await link.update({ ...value, updated_by_id: req.user?.id || null }, { transaction: t });

    await t.commit();
    return success(res, "✅ User-Facility link updated", link);
  } catch (err) {
    await t.rollback();
    console.error("❌ updateUserFacility error:", err);
    return error(res, "❌ Failed to update user-facility link", err);
  }
};

/* ============================================================
   📌 DELETE
   ============================================================ */
export const deleteUserFacility = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { scope, facility_id, organization_id } = resolveScope(req);
    const { id } = req.params;

    const link = await UserFacility.findByPk(id, {
      include: [{ model: Facility, as: "facility" }],
      transaction: t,
    });
    if (!link) {
      await t.rollback();
      return error(res, "❌ User-Facility link not found", {}, 404);
    }

    // 🔒 Scope enforcement
    if (scope === "facility" && link.facility_id !== facility_id) {
      await t.rollback();
      return error(res, "❌ Not authorized", {}, 403);
    }
    if (scope === "organization" && link.facility.organization_id !== organization_id) {
      await t.rollback();
      return error(res, "❌ Not authorized", {}, 403);
    }

    await link.update({ deleted_by_id: req.user?.id || null }, { transaction: t });
    await link.destroy({ transaction: t });

    await t.commit();
    return success(res, "✅ User-Facility link deleted");
  } catch (err) {
    await t.rollback();
    console.error("❌ deleteUserFacility error:", err);
    return error(res, "❌ Failed to delete user-facility link", err);
  }
};

/* ============================================================
   📌 TOGGLE STATUS
   ============================================================ */
export const toggleUserFacilityStatus = async (req, res) => {
  try {
    const { scope, facility_id, organization_id } = resolveScope(req);
    const { id } = req.params;

    const link = await UserFacility.findByPk(id, {
      include: [{ model: Facility, as: "facility" }],
    });
    if (!link) return error(res, "❌ User-Facility link not found", {}, 404);

    // 🔒 Scope enforcement
    if (scope === "facility" && link.facility_id !== facility_id) {
      return error(res, "❌ Not authorized", {}, 403);
    }
    if (scope === "organization" && link.facility.organization_id !== organization_id) {
      return error(res, "❌ Not authorized", {}, 403);
    }

    const newStatus = link.is_active === "active" ? "inactive" : "active";
    await link.update({ is_active: newStatus, updated_by_id: req.user?.id || null });

    return success(res, `✅ User-Facility ${newStatus}`, { is_active: newStatus });
  } catch (err) {
    console.error("❌ toggleUserFacilityStatus error:", err);
    return error(res, "❌ Failed to toggle status", err);
  }
};
