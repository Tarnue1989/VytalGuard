// 📁 controllers/userController.js
import Joi from "joi";
import { Op } from "sequelize";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import {
  sequelize,
  User,
  Facility,
  Role,
  UserFacility,
  PasswordHistory,
  RefreshToken,
  Organization
} from "../models/index.js";
import { success, error } from "../utils/response.js";
import { buildQueryOptions } from "../utils/queryHelper.js";
import { USER_STATUS } from "../constants/enums.js";
import { FIELD_VISIBILITY_USER } from "../constants/fieldVisibility.js";
import { auditService } from "../services/auditService.js";
import crypto from "crypto";

/* ============================================================
   📌 HELPER: Resolve Scope
   ============================================================ */
function resolveScope(req) {
  if (req.user?.roleNames?.includes("superadmin")) {
    return { scope: "superadmin", facility_id: null, organization_id: null };
  }
  if (req.user?.organization_id) {
    return {
      scope: "organization",
      organization_id: req.user.organization_id,
      facility_id: null,
    };
  }
  if (req.user?.facility_id) {
    return {
      scope: "facility",
      facility_id: req.user.facility_id,
      organization_id: null,
    };
  }
  return { scope: "none", facility_id: null, organization_id: null };
}


/* ============================================================
   📌 CREATE USER (FULL TRACE LOGGING – VERIFIED)
============================================================ */
export const createUser = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    console.log("🧪 [CREATE USER] RAW BODY ↓↓↓");
    console.log(JSON.stringify(req.body, null, 2));

    const { scope, facility_id, organization_id } = resolveScope(req);
    console.log("🧪 [CREATE USER] RESOLVED SCOPE:", {
      scope,
      facility_id,
      organization_id,
    });

    let schema = Joi.object({
      username: Joi.string().max(80).required(),
      email: Joi.string().email().max(150).required(),
      password: Joi.string().min(6).required(),
      first_name: Joi.string().max(150).allow("", null),
      last_name: Joi.string().max(150).allow("", null),
      status: Joi.string().valid(...USER_STATUS).default("active"),

      assignments: Joi.array()
        .items(
          Joi.object({
            facility_id: Joi.string().uuid().allow(null),
            organization_id: Joi.string().uuid().allow(null),
            role_id: Joi.string().uuid().required(),
          }).xor("facility_id", "organization_id")
        )
        .default([]),
    });

    if (scope === "superadmin") {
      schema = schema.append({
        organization_id: Joi.string().uuid().optional(),
      });
    } else {
      schema = schema.append({
        organization_id: Joi.any().strip(),
      });
    }

    const { error: validationError, value } = schema.validate(req.body, {
      stripUnknown: true,
    });

    if (validationError) {
      console.error("❌ [CREATE USER] VALIDATION ERROR:", validationError.details);
      await t.rollback();
      return error(res, validationError.details[0].message, {}, 400);
    }

    console.log("🧪 [CREATE USER] VALIDATED PAYLOAD ↓↓↓");
    console.log(JSON.stringify(value, null, 2));

    if (!value.assignments.length) {
      await t.rollback();
      return error(res, "❌ User must have at least one role", {}, 400);
    }

    /* ---------------- SCOPE ENFORCEMENT ---------------- */
    if (scope === "facility") {
      console.log("🏥 [CREATE USER] FACILITY SCOPE FORCED:", facility_id);

      const fac = await Facility.findByPk(facility_id, { transaction: t });
      if (!fac) throw new Error("Facility not found");

      value.organization_id = fac.organization_id;
      value.assignments = value.assignments.map(a => ({
        ...a,
        facility_id,
        organization_id: null,
      }));
    }

    if (scope === "organization") {
      console.log("🏢 [CREATE USER] ORG SCOPE FORCED:", organization_id);

      value.organization_id = organization_id;
      value.assignments = value.assignments.map(a => ({
        ...a,
        organization_id,
        facility_id: null,
      }));
    }

    console.log("🧪 [CREATE USER] FINAL ASSIGNMENTS ↓↓↓");
    console.log(JSON.stringify(value.assignments, null, 2));

    /* ---------------- CREATE USER ---------------- */
    const password_hash = await bcrypt.hash(value.password, 10);
    delete value.password;

    const user = await User.create(
      {
        ...value,
        password_hash,
        created_by_id: req.user.id,
      },
      { transaction: t }
    );

    console.log("✅ [CREATE USER] USER ID:", user.id);

    for (const a of value.assignments) {
      console.log("➡️ [CREATE USERFACILITY]", {
        user_id: user.id,
        organization_id: a.organization_id || null,
        facility_id: a.facility_id || null,
        role_id: a.role_id,
      });

      await UserFacility.create(
        {
          user_id: user.id,
          organization_id: a.organization_id || null,
          facility_id: a.facility_id || null,
          role_id: a.role_id,
          created_by_id: req.user.id,
        },
        { transaction: t }
      );
    }

    await t.commit();

    const snapshot = await UserFacility.findAll({
      where: { user_id: user.id },
      raw: true,
    });

    console.log("🧪 [CREATE USER] FINAL USERFACILITY SNAPSHOT ↓↓↓");
    console.log(snapshot);

    return success(res, "✅ User created", user);
  } catch (err) {
    console.error("💥 [CREATE USER ERROR]", err);
    await t.rollback();
    return error(res, "❌ Failed to create user", err, 500);
  }
};


/* ============================================================
   📌 UPDATE USER (FULL TRACE + ORG ADMIN FIX)
============================================================ */
export const updateUser = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    console.log("🧪 [UPDATE USER] RAW BODY ↓↓↓");
    console.log(JSON.stringify(req.body, null, 2));
    console.log("🧪 [UPDATE USER] PARAM ID:", req.params.id);

    const { scope, organization_id } = resolveScope(req);
    console.log("🧪 [UPDATE USER] RESOLVED SCOPE:", { scope, organization_id });

    let schema = Joi.object({
      username: Joi.string().optional(),
      email: Joi.string().email().optional(),
      password: Joi.string().min(6).allow("", null).optional(),
      first_name: Joi.string().allow("", null).optional(),
      last_name: Joi.string().allow("", null).optional(),
      status: Joi.string().valid(...USER_STATUS).optional(),

      assignments: Joi.array()
        .items(
          Joi.object({
            facility_id: Joi.string().uuid().allow(null),
            organization_id: Joi.string().uuid().allow(null),
            role_id: Joi.string().uuid().required(),
          }).xor("facility_id", "organization_id")
        )
        .optional(),
    });

    if (scope === "superadmin") {
      schema = schema.append({
        organization_id: Joi.string().uuid().optional(),
      });
    } else {
      schema = schema.append({
        organization_id: Joi.any().strip(),
      });
    }

    const { error: validationError, value } = schema.validate(req.body, {
      stripUnknown: true,
    });

    if (validationError) {
      console.error("❌ [UPDATE USER] VALIDATION ERROR:", validationError.details);
      await t.rollback();
      return error(res, validationError.details[0].message, {}, 400);
    }

    console.log("🧪 [UPDATE USER] VALIDATED VALUE ↓↓↓");
    console.log(JSON.stringify(value, null, 2));

    const user = await User.findByPk(req.params.id, { transaction: t });
    if (!user) {
      await t.rollback();
      return error(res, "❌ User not found", {}, 404);
    }

    /* ---------------- FORCE ORG SCOPE FOR ORG ADMINS ---------------- */
    if (scope === "organization" && value.assignments) {
      console.log("🔒 [UPDATE USER] FORCING ORG INTO ASSIGNMENTS:", organization_id);

      value.assignments = value.assignments.map(a => ({
        ...a,
        organization_id: a.facility_id ? null : organization_id,
      }));
    }

    console.log("🧪 [UPDATE USER] FINAL ASSIGNMENTS ↓↓↓");
    console.log(JSON.stringify(value.assignments, null, 2));

    if (value.password) {
      value.password_hash = await bcrypt.hash(value.password, 10);
      delete value.password;
    }

    await user.update(
      { ...value, updated_by_id: req.user.id },
      { transaction: t }
    );

    if (value.assignments) {
      console.log("🧨 [UPDATE USER] CLEARING OLD USERFACILITY");
      await UserFacility.destroy({
        where: { user_id: user.id },
        force: true,
        transaction: t,
      });

      for (const a of value.assignments) {
        console.log("➡️ [RECREATE USERFACILITY]", {
          user_id: user.id,
          organization_id: a.organization_id || null,
          facility_id: a.facility_id || null,
          role_id: a.role_id,
        });

        await UserFacility.create(
          {
            user_id: user.id,
            organization_id: a.organization_id || null,
            facility_id: a.facility_id || null,
            role_id: a.role_id,
            created_by_id: req.user.id,
          },
          { transaction: t }
        );
      }
    }

    await t.commit();

    const snapshot = await UserFacility.findAll({
      where: { user_id: user.id },
      raw: true,
    });

    console.log("🧪 [UPDATE USER] FINAL USERFACILITY SNAPSHOT ↓↓↓");
    console.log(snapshot);

    return success(res, "✅ User updated", user);
  } catch (err) {
    console.error("💥 [UPDATE USER ERROR]", err);
    await t.rollback();
    return error(res, "❌ Failed to update user", err, 500);
  }
};


/* ============================================================
   📌 GET ALL USERS (Advanced filter + pagination + scoping)
   ============================================================ */
export const getAllUsers = async (req, res) => {
  try {
    console.log("🧪 [getAllUsers] RAW QUERY:", JSON.stringify(req.query, null, 2));

    for (const key of Object.keys(req.query)) {
      if (key.includes("$") || key.includes(".")) {
        console.warn("🛡️ [getAllUsers] STRIPPED UNSAFE QUERY KEY:", key);
        delete req.query[key];
      }
    }

    console.log("🧼 [getAllUsers] SANITIZED QUERY:", JSON.stringify(req.query, null, 2));

    const { scope, facility_id, organization_id } = resolveScope(req);
    console.log("🧪 [getAllUsers] RESOLVED SCOPE:", {
      scope,
      facility_id,
      organization_id,
    });

    const role = (req.user?.roleNames?.[0] || "staff")
      .toLowerCase()
      .replace(/\s+/g, "");

    console.log("🧪 [getAllUsers] NORMALIZED ROLE:", role);

    const visibleFields =
      FIELD_VISIBILITY_USER[role] || FIELD_VISIBILITY_USER.staff;

    const options = buildQueryOptions(req, "username", "ASC", visibleFields);
    options.where = options.where || {};

    if (options.search) {
      console.log("🔍 [getAllUsers] SEARCH TERM:", options.search);
      options.where = {
        [Op.and]: [
          options.where,
          {
            [Op.or]: [
              { username: { [Op.iLike]: `%${options.search}%` } },
              { email: { [Op.iLike]: `%${options.search}%` } },
              { first_name: { [Op.iLike]: `%${options.search}%` } },
              { last_name: { [Op.iLike]: `%${options.search}%` } },
            ],
          },
        ],
      };
    }

    const facilityInclude = {
      model: Facility,
      as: "facilities",
      attributes: ["id", "name", "code", "organization_id"],
      through: { attributes: [] },
      required: false,
    };

    const roleInclude = {
      model: Role,
      as: "roles",
      attributes: ["id", "name", "requires_facility"],
      through: { attributes: [] },
      required: false,
    };

    if (scope === "facility") {
      facilityInclude.where = { id: facility_id };
      facilityInclude.required = true;
    }

    if (scope === "organization") {
      options.where.organization_id = organization_id;
      facilityInclude.where = { organization_id };
      facilityInclude.required = false;
    }

    console.log("🧪 [getAllUsers] FINAL WHERE:", options.where);

    const { count, rows } = await User.findAndCountAll({
      where: options.where,
      attributes: options.attributes
        ? [...new Set(["id", ...options.attributes])]
        : undefined,
      include: [
        facilityInclude,
        roleInclude,
        { model: Organization, as: "organization", attributes: ["id", "name", "code"] },
        { model: User, as: "createdByUser", attributes: ["id", "first_name", "last_name", "username"] },
        { model: User, as: "updatedByUser", attributes: ["id", "first_name", "last_name", "username"] },
        { model: User, as: "deletedByUser", attributes: ["id", "first_name", "last_name", "username"] },
      ],
      order: options.order,
      offset: options.offset,
      limit: options.limit,
    });

    console.log("🧪 [getAllUsers] RESULT COUNT:", count);

    await auditService.logAction({
      user: req.user,
      module: "user",
      action: "list",
      details: { returned: count, query: req.query },
    });

    return success(res, "✅ Users loaded", {
      records: rows,
      pagination: {
        total: count,
        page: options.pagination.page,
        pageCount: Math.ceil(count / options.pagination.limit),
      },
    });
  } catch (err) {
    console.error("💥 [getAllUsers ERROR]", err);
    return error(res, "❌ Failed to load users", err, 500);
  }
};


/* ============================================================
   📌 GET ALL USERS (Lite, with ?q= support)
   ============================================================ */
export const getAllUsersLite = async (req, res) => {
  try {
    /* ------------------------------------------------------------
       🧪 DEBUG + 🛡️ FINAL QUERY GUARD
    ------------------------------------------------------------ */
    console.log("🧪 [getAllUsersLite] RAW req.query:", JSON.stringify(req.query, null, 2));

    for (const key of Object.keys(req.query)) {
      if (key.includes("$") || key.includes(".")) {
        console.warn("🛡️ [getAllUsersLite] Stripped unsafe query key:", key);
        delete req.query[key];
      }
    }

    console.log("🧼 [getAllUsersLite] SANITIZED req.query:", JSON.stringify(req.query, null, 2));

    const { scope, facility_id, organization_id } = resolveScope(req);
    const { q } = req.query;

    const baseAttrs = ["id", "username", "email", "first_name", "last_name"];

    let where = { status: "active" };

    if (q) {
      where[Op.or] = [
        { username: { [Op.iLike]: `%${q}%` } },
        { email: { [Op.iLike]: `%${q}%` } },
        { first_name: { [Op.iLike]: `%${q}%` } },
        { last_name: { [Op.iLike]: `%${q}%` } },
      ];
    }

    let users;

    if (scope === "superadmin") {
      users = await User.findAll({
        where,
        attributes: baseAttrs,
        include: [
          {
            model: Facility,
            as: "facilities",
            attributes: ["id", "organization_id"],
            required: false,
            through: { attributes: [] },
          },
          { model: Role, as: "roles", attributes: ["id", "name"], through: { attributes: [] } },
          { model: Organization, as: "organization", attributes: ["id", "name", "code"] },
        ],
        order: [["username", "ASC"]],
        limit: 20,
      });

    } else if (scope === "organization") {
      users = await User.findAll({
        where: { ...where, organization_id },
        attributes: baseAttrs,
        include: [
          {
            model: Facility,
            as: "facilities",
            attributes: ["id", "organization_id"],
            where: { organization_id },
            required: false,
            through: { attributes: [] },
          },
          { model: Role, as: "roles", attributes: ["id", "name"], through: { attributes: [] } },
          { model: Organization, as: "organization", attributes: ["id", "name", "code"] },
        ],
        order: [["username", "ASC"]],
        limit: 20,
      });

    } else if (scope === "facility") {
      users = await User.findAll({
        where,
        attributes: baseAttrs,
        include: [
          {
            model: Facility,
            as: "facilities",
            where: { id: facility_id },
            required: true,
            through: { attributes: [] },
          },
          { model: Role, as: "roles", attributes: ["id", "name"], through: { attributes: [] } },
          { model: Organization, as: "organization", attributes: ["id", "name", "code"] },
        ],
        order: [["username", "ASC"]],
        limit: 20,
      });

    } else {
      return error(res, "❌ Not authorized to load users (lite)", {}, 403);
    }

    const result = users.map(u => ({
      id: u.id,
      username: u.username,
      email: u.email || "",
      full_name: [u.first_name, u.last_name].filter(Boolean).join(" ").trim(),
    }));

    await auditService.logAction({
      user: req.user,
      module: "user",
      action: "list_lite",
      details: { count: result.length, query: q || null },
    });

    return success(res, "✅ Users loaded (lite)", { records: result });
  } catch (err) {
    console.error("❌ getAllUsersLite error:", err);
    return error(res, "❌ Failed to load users (lite)", err, 500);
  }
};


/* ============================================================
   📌 GET USER BY ID
   ============================================================ */
export const getUserById = async (req, res) => {
  try {
    const { scope, facility_id, organization_id } = resolveScope(req);
    const { id } = req.params;

    // 🔑 Normalize role name → lowercase + no spaces
    const role = (req.user?.roleNames?.[0] || "staff")
      .toLowerCase()
      .replace(/\s+/g, "");
    const visibleFields =
      FIELD_VISIBILITY_USER[role] || FIELD_VISIBILITY_USER.staff;

    const user = await User.findByPk(id, {
      attributes: visibleFields,
      include: [
        { model: Facility, as: "facilities", attributes: ["id", "name", "code", "organization_id"], through: { attributes: [] } },
        { model: Role, as: "roles", attributes: ["id", "name", "requires_facility"], through: { attributes: [] } },
        { model: Organization, as: "organization", attributes: ["id", "name", "code"] },
        { model: User, as: "createdByUser", attributes: ["id", "username", "first_name", "last_name"] },
        { model: User, as: "updatedByUser", attributes: ["id", "username", "first_name", "last_name"] },
        { model: User, as: "deletedByUser", attributes: ["id", "username", "first_name", "last_name"] },
      ],
    });

    if (!user) return error(res, "❌ User not found", {}, 404);

    // Scope enforcement
    if (scope === "facility") {
      const inFacility = user.facilities.some((f) => f.id === facility_id);
      if (!inFacility) return error(res, "❌ Not authorized", {}, 403);
    } else if (scope === "organization") {
      const inOrg =
        user.organization_id === organization_id ||
        user.facilities.some((f) => f.organization_id === organization_id);
      if (!inOrg) return error(res, "❌ Not authorized", {}, 403);
    }

    await auditService.logAction({
      user: req.user,
      module: "user",
      action: "view",
      entityId: id,
      entity: user,
    });

    return success(res, "✅ User loaded", user);
  } catch (err) {
    return error(res, "❌ Failed to load user", err, 500);
  }
};

/* ============================================================
   📌 TOGGLE USER STATUS
   ============================================================ */
export const toggleUserStatus = async (req, res) => {
  try {
    const { id } = req.params;
    if (req.user.id === id) {
      return error(res, "❌ Cannot disable your own account", {}, 403);
    }

    const user = await User.findByPk(id, {
      paranoid: false,
      include: [
        { model: Facility, as: "facilities", attributes: ["id", "organization_id"], required: false },
        { model: Role, as: "roles", attributes: ["id", "name"], through: { attributes: [] }, required: false },
      ],
    });

    if (!user) return error(res, `❌ User not found for ID ${id}`, {}, 404);

    // Protect critical accounts
    if (user.is_system) return error(res, "❌ Cannot change status of system accounts", {}, 403);
    if (user.roles?.some((r) => r.name.toLowerCase().includes("superadmin"))) {
      return error(res, "❌ Cannot change status of superadmin accounts", {}, 403);
    }

    // Scope enforcement
    const { scope, facility_id, organization_id } = resolveScope(req);
    if (scope === "facility") {
      const inFacility = user.facilities.some((f) => f.id === facility_id);
      if (!inFacility) return error(res, "❌ Not authorized", {}, 403);
    } else if (scope === "organization") {
      const inOrg =
        user.organization_id === organization_id ||
        user.facilities.some((f) => f.organization_id === organization_id);
      if (!inOrg) return error(res, "❌ Not authorized", {}, 403);
    }

    // Toggle status
    const [ACTIVE, INACTIVE] = USER_STATUS;
    const newStatus = user.status === ACTIVE ? INACTIVE : ACTIVE;
    const oldStatus = user.status;

    await user.update(
      { status: newStatus, updated_by_id: req.user.id },
      { returning: true }
    );

    await auditService.logAction({
      user: req.user,
      module: "user",
      action: "toggle_status",
      entityId: id,
      details: { from: oldStatus, to: newStatus },
    });

    return success(res, `✅ User ${newStatus}`, { id: user.id, status: newStatus });
  } catch (err) {
    return error(res, "❌ Failed to toggle status", err, 500);
  }
};


/* ============================================================
   📌 DELETE USER (Soft delete)
   ============================================================ */
export const deleteUser = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { scope, facility_id, organization_id } = resolveScope(req);
    const { id } = req.params;

    if (req.user.id === id) {
      await t.rollback();
      return error(res, "❌ Cannot delete your own account", {}, 403);
    }

    const user = await User.findByPk(id, {
      paranoid: false,
      include: [
        { model: Facility, as: "facilities", attributes: ["id", "organization_id"], required: false },
        { model: Role, as: "roles", attributes: ["id", "name"], through: { attributes: [] }, required: false },
      ],
    });
    if (!user) {
      await t.rollback();
      return error(res, `❌ User not found for ID ${id}`, {}, 404);
    }

    if (user.is_system) {
      await t.rollback();
      return error(res, "❌ Cannot delete system accounts", {}, 403);
    }
    if (user.roles?.some((r) => r.name.toLowerCase().includes("superadmin"))) {
      await t.rollback();
      return error(res, "❌ Cannot delete superadmin accounts", {}, 403);
    }

    // Scope checks
    if (scope === "facility") {
      const inFacility = user.facilities.some((f) => f.id === facility_id);
      if (!inFacility) {
        await t.rollback();
        return error(res, "❌ Not authorized to delete this user", {}, 403);
      }
    } else if (scope === "organization") {
      const inOrg =
        user.organization_id === organization_id ||
        user.facilities.some((f) => f.organization_id === organization_id);
      if (!inOrg) {
        await t.rollback();
        return error(res, "❌ Not authorized to delete this user", {}, 403);
      }
    }

    await user.update({ deleted_by_id: req.user?.id || null }, { transaction: t });
    await user.destroy({ transaction: t });

    await t.commit();

    await auditService.logAction({
      user: req.user,
      module: "user",
      action: "delete",
      entityId: id,
      entity: user,
    });

    return success(res, "✅ User deleted", { id });
  } catch (err) {
    await t.rollback();
    return error(res, "❌ Failed to delete user", err, 500);
  }
};

/* ============================================================
   📌 RESET PASSWORD TO DEFAULT (with PasswordHistory)
   ============================================================ */
export const resetUserPassword = async (req, res) => {
  try {
    const { scope, facility_id, organization_id } = resolveScope(req);
    const { id } = req.params;

    const user = await User.findByPk(id, {
      paranoid: false,
      attributes: ["id", "organization_id"],
      include: [
        { model: Facility, as: "facilities", attributes: ["id", "organization_id"], required: false },
      ],
    });
    if (!user) return error(res, `❌ User not found for ID ${id}`, {}, 404);

    // Scope enforcement
    if (scope === "facility") {
      if (!user.facilities.some((f) => f.id === facility_id)) {
        return error(res, "❌ Not authorized", {}, 403);
      }
    } else if (scope === "organization") {
      const inOrg = user.organization_id === organization_id ||
                    user.facilities.some((f) => f.organization_id === organization_id);
      if (!inOrg) return error(res, "❌ Not authorized", {}, 403);
    }

    const newPassword = `Temp-${crypto.randomBytes(4).toString("hex")}`;
    const newHash = await bcrypt.hash(newPassword, 10);

    await user.update({
      password_hash: newHash,
      password_reset_token: null,
      password_reset_expiry: null,
      must_reset_password: true,
      login_attempts: 0,
      locked_until: null,
      updated_by_id: req.user?.id || null,
    });

    await PasswordHistory.create({ user_id: user.id, password_hash: newHash });

    await auditService.logAction({
      user: req.user,
      module: "user",
      action: "reset_password",
      entityId: id,
      details: { tempPassword: true },
    });

    return success(res, "✅ Password reset to temporary and account unlocked", { id: user.id, tempPassword: newPassword });
  } catch (err) {
    return error(res, "❌ Failed to reset password", err, 500);
  }
};

/* ============================================================
   📌 ADMIN GENERATE RESET TOKEN
   ============================================================ */
export const adminGenerateResetToken = async (req, res) => {
  try {
    const { scope, facility_id, organization_id } = resolveScope(req);
    const { user_id } = req.body;
    if (!user_id) return error(res, "❌ User ID is required", {}, 400);

    const user = await User.findByPk(user_id, {
      paranoid: false,
      attributes: ["id", "organization_id", "password_reset_token", "password_reset_expiry"],
      include: [
        { model: Facility, as: "facilities", attributes: ["id", "organization_id"], required: false },
      ],
    });
    if (!user) return error(res, `❌ User not found for ID ${user_id}`, {}, 404);

    // Scope enforcement
    if (scope === "facility") {
      if (!user.facilities.some((f) => f.id === facility_id)) return error(res, "❌ Not authorized", {}, 403);
    } else if (scope === "organization") {
      const inOrg = user.organization_id === organization_id ||
                    user.facilities.some((f) => f.organization_id === organization_id);
      if (!inOrg) return error(res, "❌ Not authorized", {}, 403);
    }

    const resetSecret = process.env.JWT_RESET_SECRET || process.env.JWT_SECRET;
    if (!resetSecret) return error(res, "❌ Reset token secret not configured", {}, 500);

    if (user.password_reset_token && user.password_reset_expiry > new Date()) {
      return error(res, "❌ Reset token already active. Wait until expiry or reset manually.", {}, 429);
    }

    const payload = { id: user.id, type: "password_reset" };
    const resetToken = jwt.sign(payload, resetSecret, { expiresIn: "30m" });

    await user.update({
      password_reset_token: resetToken,
      password_reset_expiry: new Date(Date.now() + 30 * 60 * 1000),
      updated_by_id: req.user?.id || null,
    });

    await auditService.logAction({
      user: req.user,
      module: "user",
      action: "generate_reset_token",
      entityId: user.id,
      details: { expiry: user.password_reset_expiry },
    });

    return success(res, "✅ Reset token generated", { id: user.id, token: resetToken, exp: user.password_reset_expiry });
  } catch (err) {
    return error(res, "❌ Failed to generate reset token", err, 500);
  }
};

/* ============================================================
   📌 MANUAL PASSWORD RESET VIA TOKEN (with PasswordHistory)
   ============================================================ */
export const manualResetPassword = async (req, res) => {
  try {
    const { email, token, newPassword } = req.body;
    if (!email || !token || !newPassword) {
      return error(res, "❌ All fields are required", {}, 400);
    }

    const resetSecret = process.env.JWT_RESET_SECRET || process.env.JWT_SECRET;
    if (!resetSecret) return error(res, "❌ Reset token secret not configured", {}, 500);

    let decoded;
    try {
      decoded = jwt.verify(token, resetSecret);
    } catch {
      return error(res, "❌ Invalid or expired reset token", {}, 401);
    }

    const user = await User.findOne({
      where: {
        email,
        id: decoded.id,
        password_reset_token: token,
        password_reset_expiry: { [Op.gt]: new Date() },
      },
      paranoid: false,
    });
    if (!user) return error(res, "❌ Invalid or expired reset request", {}, 401);

    const lastHashes = await PasswordHistory.findAll({
      where: { user_id: user.id },
      order: [["created_at", "DESC"]],
      limit: 5,
    });
    for (const ph of lastHashes) {
      if (await bcrypt.compare(newPassword, ph.password_hash)) {
        return error(res, "❌ Cannot reuse one of your last 5 passwords", {}, 400);
      }
    }

    const newHash = await bcrypt.hash(newPassword, 10);
    await user.update({
      password_hash: newHash,
      password_reset_token: null,
      password_reset_expiry: null,
      must_reset_password: false,
      login_attempts: 0,
      locked_until: null,
      updated_by_id: req.user?.id || null,
    });

    await PasswordHistory.create({ user_id: user.id, password_hash: newHash });

    await auditService.logAction({
      user: req.user,
      module: "user",
      action: "manual_reset_password",
      entityId: user.id,
      details: { email },
    });

    return success(res, "✅ Password reset successful", { id: user.id });
  } catch (err) {
    return error(res, "❌ Failed to reset password", err, 500);
  }
};


/* ============================================================
   📌 TOGGLE USER ROLE STATUS (via UserFacility)
   ============================================================ */
export const toggleUserRoleStatus = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { scope, facility_id, organization_id } = resolveScope(req);
    const { userId, facilityId, roleId } = req.params;

    const user = await User.findByPk(userId, {
      include: [
        { model: Facility, as: "facilities", attributes: ["id", "organization_id"] },
        { model: Role, as: "roles", attributes: ["id", "name"], through: { attributes: [] } },
      ],
      transaction: t,
    });
    if (!user) return error(res, "❌ User not found", {}, 404);

    const role = await Role.findByPk(roleId);
    if (!role) return error(res, "❌ Role not found", {}, 404);

    if (user.is_system) return error(res, "❌ Cannot modify system accounts", {}, 403);
    if (user.roles?.some(r => r.name.toLowerCase().includes("superadmin"))) {
      return error(res, "❌ Cannot modify roles for superadmin accounts", {}, 403);
    }

    if (role.requires_facility && !facilityId) {
      return error(res, "❌ This role requires a facility assignment", {}, 400);
    }
    if (!role.requires_facility && facilityId) {
      return error(res, "❌ This role cannot be tied to a facility", {}, 400);
    }

    if (scope === "facility" && facilityId !== facility_id) {
      return error(res, "❌ Not authorized to change roles in this facility", {}, 403);
    } else if (scope === "organization") {
      if (facilityId) {
        const facility = await Facility.findByPk(facilityId);
        if (!facility || facility.organization_id !== organization_id) {
          return error(res, "❌ Not authorized", {}, 403);
        }
      } else if (user.organization_id !== organization_id) {
        return error(res, "❌ Not authorized", {}, 403);
      }
    }

    const existing = await UserFacility.findOne({
      where: { user_id: userId, facility_id: facilityId || null, role_id: roleId },
      transaction: t,
    });

    let result;
    if (existing) {
      await existing.destroy({ transaction: t });
      result = { removed: role.id };
      await auditService.logAction({
        user: req.user,
        module: "user",
        action: "role_removed",
        entityId: userId,
        details: { role: role.name, facilityId },
      });
    } else {
      await UserFacility.create(
        { user_id: userId, facility_id: facilityId || null, role_id: roleId, created_by_id: req.user?.id || null },
        { transaction: t }
      );
      result = { added: role.id };
      await auditService.logAction({
        user: req.user,
        module: "user",
        action: "role_added",
        entityId: userId,
        details: { role: role.name, facilityId },
      });
    }

    await t.commit();
    return success(res, "✅ Role toggled", result);
  } catch (err) {
    if (!t.finished) await t.rollback();
    return error(res, "❌ Failed to toggle role status", err, 500);
  }
};

/* ============================================================
   📌 LOGIN (with account lockout + must_reset_password check)
   ============================================================ */
export const login = async (req, res) => {
  try {
    const { usernameOrEmail, password } = req.body;

    const user = await User.findOne({
      where: { [Op.or]: [{ username: usernameOrEmail }, { email: usernameOrEmail }] },
      include: [
        { model: Role, as: "roles", attributes: ["id", "name", "requires_facility"], through: { attributes: [] } },
        { model: Facility, as: "facilities", attributes: ["id", "name", "organization_id"], through: { attributes: [] } },
      ],
    });
    if (!user) return error(res, "❌ Invalid credentials", { code: "INVALID_CREDENTIALS" }, 401);

    if (user.is_system) return error(res, "❌ System accounts cannot login", { code: "SYSTEM_ACCOUNT_LOGIN_FORBIDDEN" }, 403);
    if (user.roles?.some((r) => r.name.toLowerCase().includes("superadmin"))) {
      return error(res, "❌ Superadmin accounts cannot login directly", { code: "SUPERADMIN_LOGIN_FORBIDDEN" }, 403);
    }

    if (user.locked_until && user.locked_until > new Date()) {
      return error(res, `❌ Account locked until ${user.locked_until.toLocaleString()}`, { code: "ACCOUNT_LOCKED", locked_until: user.locked_until }, 403);
    }

    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      user.login_attempts += 1;
      if (user.login_attempts >= 5) {
        user.locked_until = new Date(Date.now() + 15 * 60 * 1000);
        await user.save();
        await auditService.logAction({ user, module: "auth", action: "login_failed_locked", entityId: user.id });
        return error(res, "❌ Account locked for 15 minutes due to failed attempts", { code: "ACCOUNT_TEMP_LOCKED" }, 403);
      }
      await user.save();
      await auditService.logAction({ user, module: "auth", action: "login_failed", entityId: user.id });
      return error(res, "❌ Invalid credentials", { code: "INVALID_CREDENTIALS" }, 401);
    }

    if (user.must_reset_password) {
      return error(res, "❌ You must reset your password before logging in", { code: "PASSWORD_RESET_REQUIRED", userId: user.id, email: user.email }, 403);
    }

    user.login_attempts = 0;
    user.locked_until = null;
    user.last_login_at = new Date();
    await user.save();

    const payload = {
      id: user.id,
      organization_id: user.organization_id,
      roles: user.roles.map((r) => ({ id: r.id, name: r.name, requires_facility: r.requires_facility })),
      facilities: user.facilities.map((f) => ({ id: f.id, name: f.name, org: f.organization_id })),
    };
    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: "1h" });

    await auditService.logAction({ user, module: "auth", action: "login_success", entityId: user.id });

    return success(res, "✅ Login successful", { token, user: payload });
  } catch (err) {
    return error(res, "❌ Failed to login", { code: "LOGIN_ERROR", err }, 500);
  }
};

/* ============================================================
   📌 ADMIN UNLOCK USER (manual unlock)
   ============================================================ */
export const unlockUser = async (req, res) => {
  try {
    const { id } = req.params;
    if (req.user.id === id) return error(res, "❌ Cannot unlock your own account", {}, 403);

    const user = await User.findByPk(id, {
      include: [{ model: Role, as: "roles", attributes: ["id", "name"], through: { attributes: [] } }],
    });
    if (!user) return error(res, "❌ User not found", {}, 404);
    if (user.is_system) return error(res, "❌ Cannot unlock system accounts", {}, 403);
    if (user.roles?.some(r => r.name.toLowerCase().includes("superadmin"))) {
      return error(res, "❌ Cannot unlock superadmin accounts", {}, 403);
    }

    await user.update({ login_attempts: 0, locked_until: null, updated_by_id: req.user?.id || null });

    await auditService.logAction({ user: req.user, module: "user", action: "unlock_account", entityId: user.id });

    return success(res, "✅ User account unlocked", { id: user.id });
  } catch (err) {
    return error(res, "❌ Failed to unlock user", err, 500);
  }
};

/* ============================================================
   📌 ADMIN REQUIRE PASSWORD RESET
   ============================================================ */
export const requirePasswordReset = async (req, res) => {
  try {
    const { id } = req.params;

    const user = await User.findByPk(id, {
      include: [{ model: Role, as: "roles", attributes: ["id", "name"], through: { attributes: [] } }],
    });
    if (!user) return error(res, "❌ User not found", {}, 404);
    if (user.is_system) return error(res, "❌ Cannot modify system accounts", {}, 403);
    if (user.roles?.some(r => r.name.toLowerCase().includes("superadmin"))) {
      return error(res, "❌ Cannot force password reset on superadmin accounts", {}, 403);
    }

    await user.update({ must_reset_password: true, updated_by_id: req.user?.id || null });

    await auditService.logAction({ user: req.user, module: "user", action: "require_password_reset", entityId: user.id });

    return success(res, "✅ User must reset password on next login", { id: user.id });
  } catch (err) {
    return error(res, "❌ Failed to require password reset", err, 500);
  }
};

/* ============================================================
   📌 ADMIN REVOKE USER SESSIONS (logout all devices)
   ============================================================ */
export const revokeUserSessions = async (req, res) => {
  try {
    const { id } = req.params;

    if (req.user.id === id) {
      return error(res, "❌ Cannot revoke your own sessions here (use logoutAll)", {}, 403);
    }

    const user = await User.findByPk(id);
    if (!user) return error(res, "❌ User not found", {}, 404);
    if (user.is_system) return error(res, "❌ Cannot revoke sessions for system accounts", {}, 403);

    await RefreshToken.destroy({ where: { user_id: id } });

    await auditService.logAction({
      user: req.user,
      module: "auth",
      action: "revoke_sessions",
      entityId: user.id,
      details: { revokedBy: req.user.id },
    });

    return success(res, "✅ All sessions revoked for this user", { id });
  } catch (err) {
    return error(res, "❌ Failed to revoke user sessions", err, 500);
  }
};

/* ============================================================
   📌 HARD DELETE USER (permanent purge)
   ============================================================ */
export const purgeUser = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { id } = req.params;

    const user = await User.findByPk(id, {
      paranoid: false,
      include: [
        { model: Role, as: "roles", attributes: ["id", "name"], through: { attributes: [] } },
      ],
    });

    if (!user) return error(res, "❌ User not found", {}, 404);
    if (user.is_system) return error(res, "❌ Cannot purge system accounts", {}, 403);
    if (user.roles?.some(r => r.name.toLowerCase().includes("superadmin"))) {
      return error(res, "❌ Cannot purge superadmin accounts", {}, 403);
    }

    await UserFacility.destroy({ where: { user_id: id }, transaction: t });
    await user.destroy({ force: true, transaction: t }); // 🔥 hard delete
    await t.commit();

    await auditService.logAction({
      user: req.user,
      module: "user",
      action: "purge",
      entityId: user.id,
      details: { purgedBy: req.user.id },
    });

    return success(res, "✅ User permanently deleted", { id });
  } catch (err) {
    if (!t.finished) await t.rollback();
    return error(res, "❌ Failed to purge user", err, 500);
  }
};
