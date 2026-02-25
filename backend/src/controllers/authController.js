import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import Joi from "joi";
import { 
  sequelize, 
  User, 
  Department, 
  Role, Permission ,
  Employee, 
  RefreshToken, 
  UserFacility, 
  Facility, 
  Organization, 
  PasswordHistory         } from "../models/index.js";
import { USER_STATUS } from "../constants/enums.js";
import { Op } from "sequelize";
import { getRolePermissions } from "../services/authzService.js";
import { auditService } from "../services/auditService.js";
import { makeModuleLogger } from "../utils/debugLogger.js";
import { logger } from "../utils/logger.js";

/* ============================================================
   🔧 LOCAL DEBUG OVERRIDE (AUTH CONTROLLER)
============================================================ */
const DEBUG_OVERRIDE = false; // 👈 almost always OFF
const debug = makeModuleLogger("authController", DEBUG_OVERRIDE);

const SYSTEM_OWNER_EMAIL = "superadmin@vytalguard.com".toLowerCase();

// -------------------- Environment config --------------------
const ACCESS_TOKEN_SECRET = process.env.JWT_SECRET;
const REFRESH_TOKEN_SECRET = process.env.REFRESH_TOKEN_SECRET;
const ACCESS_TOKEN_TTL_MINUTES = parseInt(process.env.ACCESS_TOKEN_TTL_MINUTES || "15", 10);
const REFRESH_TOKEN_TTL_DAYS = parseInt(process.env.REFRESH_TOKEN_TTL_DAYS || "7", 10);

// Secure cookie settings
const cookieOptions = {
  httpOnly: true,
  secure: true,        // 🔴 REQUIRED on Render (HTTPS)
  sameSite: "none",    // 🔴 REQUIRED for cross-site cookies
  path: "/",
};



// -------------------- Validation Schemas --------------------
const registerSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string()
    .min(8)
    .pattern(/[A-Z]/, "uppercase")
    .pattern(/[a-z]/, "lowercase")
    .pattern(/[0-9]/, "number")
    .pattern(/[^a-zA-Z0-9]/, "special character")
    .required(),
  role_id: Joi.string().uuid().required(),
  organization_id: Joi.string().uuid().allow(null).optional(),  // ✅ NEW
  facility_id: Joi.string().uuid().allow(null).optional(),
  employee_id: Joi.string().uuid().allow(null).optional(),
  is_default: Joi.boolean().default(true).optional()
}).custom(async (value, helpers) => {
  const role = await Role.findByPk(value.role_id);
  if (!role) {
    return helpers.error("any.invalid", { message: "Invalid role" });
  }

  const roleName = (role.name || "").toLowerCase();

  if (roleName === "super admin") {
    // ✅ System-level: no org/facility
    value.organization_id = null;
    value.facility_id = null;
    value.is_default = false;

  } else if (roleName === "org owner") {
    // ✅ Org-level: must have organization, no facility
    if (!value.organization_id) {
      return helpers.error("any.required", { message: "organization_id is required for Org Owner" });
    }
    value.facility_id = null;

  } else {
    // ✅ Facility-level: must have both org + facility
    if (!value.organization_id) {
      return helpers.error("any.required", { message: "organization_id is required for facility-level roles" });
    }
    if (!value.facility_id) {
      return helpers.error("any.required", { message: "facility_id is required for facility-level roles" });
    }
  }

  return value;
});

// ✅ NEW: Login schema
const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required()
});

// ✅ NEW: Change password schema
const passwordChangeSchema = Joi.object({
  oldPassword: Joi.string().required(),
  newPassword: Joi.string()
    .min(8)
    .pattern(/[A-Z]/, "uppercase")
    .pattern(/[a-z]/, "lowercase")
    .pattern(/[0-9]/, "number")
    .pattern(/[^a-zA-Z0-9]/, "special character")
    .required()
});

// -------------------- Helper: Token Generation --------------------
const generateTokens = (payload) => {
  const accessToken = jwt.sign(payload, ACCESS_TOKEN_SECRET, { expiresIn: `${ACCESS_TOKEN_TTL_MINUTES}m` });
  const refreshToken = jwt.sign(payload, REFRESH_TOKEN_SECRET, { expiresIn: `${REFRESH_TOKEN_TTL_DAYS}d` });
  return { accessToken, refreshToken };
};

const storeHashedRefreshToken = async (userId, facilityId, refreshToken, ip, userAgent) => {
  const hashedToken = await bcrypt.hash(refreshToken, 12);
  await RefreshToken.create({
    user_id: userId,
    facility_id: facilityId || null,
    token: hashedToken,
    ip_address: ip,
    user_agent: userAgent,
    expires_at: new Date(Date.now() + REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000)
  });
};

// -------------------- Register (with PasswordHistory + Org support) --------------------
export const register = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { error } = registerSchema.validate(req.body);
    if (error) {
      await t.rollback();
      return res.status(400).json({ error: error.details[0].message });
    }

    const {
      email,
      password,
      role_id,
      organization_id,
      facility_id,
      employee_id,
      is_default,
    } = req.body;

    const cleanEmail = email.trim().toLowerCase();

    // 🔎 Check existing user
    const existing = await User.findOne({ where: { email: cleanEmail } });
    if (existing) {
      await t.rollback();
      return res.status(400).json({ error: "Email already in use" });
    }

    const hash = await bcrypt.hash(password, 14);

    // 👤 Create user
    const newUser = await User.create(
      {
        email: cleanEmail,
        password_hash: hash,
        employee_id: employee_id || null,
        organization_id: organization_id || null,
        status: USER_STATUS[0],
        created_by_id: req.user?.id || null,
      },
      { transaction: t }
    );

    // 📌 Store initial password
    await PasswordHistory.create(
      { user_id: newUser.id, password_hash: hash },
      { transaction: t }
    );

    // 🔐 Validate role
    const role = await Role.findByPk(role_id, { transaction: t });
    if (!role) {
      await t.rollback();
      return res.status(400).json({ error: "Invalid role" });
    }

    const roleName = (role.name || "").toLowerCase();
    const isSuperAdmin = roleName === "super admin";

    // 🔗 ALWAYS create UserFacility (single source of truth)
    await UserFacility.create(
      {
        user_id: newUser.id,
        organization_id: isSuperAdmin ? null : organization_id || null,
        facility_id: isSuperAdmin ? null : facility_id || null,
        role_id,
        is_default: isSuperAdmin ? false : is_default ?? true,
        created_by_id: req.user?.id || null,
      },
      { transaction: t }
    );

    await t.commit();

    // 🔁 Reload full user context
    const fullUser = await User.findByPk(newUser.id, {
      include: [
        {
          model: Employee,
          as: "employee",
          required: false,
          include: [
            { model: Department, as: "department", attributes: ["id", "name"] },
          ],
        },
        {
          model: UserFacility,
          as: "facilityLinks",
          include: [
            { model: Role, as: "role", attributes: ["id", "name"] },
            {
              model: Facility,
              as: "facility",
              required: false,
              attributes: ["id", "name"],
              include: [
                {
                  model: Organization,
                  as: "organization",
                  attributes: ["id", "name", "code"],
                },
              ],
            },
          ],
        },
        {
          model: Organization,
          as: "organization",
          attributes: ["id", "name", "code"],
        },
      ],
    });

    const safeUser = {
      id: fullUser.id,
      email: fullUser.email,
      first_name: fullUser.first_name,
      last_name: fullUser.last_name,
      employee: fullUser.employee,
      facilityLinks: fullUser.facilityLinks,
      name: fullUser.full_name || "",
      role: role.name,
      department: fullUser.employee?.department?.name || "",
      organization: fullUser.organization?.name || "",
      organization_id: fullUser.organization?.id || null,
      organization_code: fullUser.organization?.code || "",
    };

    // ✅ Audit log
    await auditService.logAction({
      module: "user",
      action: "register",
      entityId: newUser.id,
      user: req.user || { id: newUser.id, email: newUser.email },
      details: {
        role: role.name,
        organization_id,
        facility_id,
      },
    });

    return res
      .status(201)
      .json({ message: "User registered successfully", user: safeUser });

  } catch (err) {
    await t.rollback();
    logger.error("[AUTH] Register error", {
      message: err.message,
      stack: err.stack,
      userId: req.user?.id,
    });

    await auditService.logError({
      module: "auth",
      action: "register",
      user: req.user,
      error: err,
    });

    return res.status(500).json({ error: "Server error" });
  }
};

// -------------------- Login (org-aware payload with org fallback) --------------------
export const login = async (req, res) => {
  try {
    const { error } = loginSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const { email, password } = req.body;

    debug.log("LOGIN ATTEMPT", {
      email,
      ip: req.ip,
      agent: req.headers["user-agent"],
    });

    const user = await User.scope(null).findOne({
      where: { email: email.trim().toLowerCase() },
      attributes: {
        include: [
          "password_hash",
          "login_attempts",
          "locked_until",
          "must_reset_password",
          "token_version",
        ],
      },
      include: [
        {
          model: Employee,
          as: "employee",
          required: false,
          include: [
            {
              model: Department,
              as: "department",
              attributes: ["id", "name"],
            },
          ],
        },
        {
          model: UserFacility,
          as: "facilityLinks",
          required: false,
          attributes: ["id", "organization_id", "facility_id", "role_id"],
          include: [
            {
              model: Role,
              as: "role",
              required: true,
              paranoid: false,
              attributes: ["id", "name", "requires_facility"],
            },
            {
              model: Facility,
              as: "facility",
              required: false,
              attributes: ["id", "name", "organization_id"],
              include: [
                {
                  model: Organization,
                  as: "organization",
                  required: false,
                  attributes: ["id", "name", "code"],
                },
              ],
            },
          ],
        },
        {
          model: Organization,
          as: "organization",
          attributes: ["id", "name", "code"],
        },
      ],
    });

    if (!user) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    if (user.status?.toLowerCase() !== "active") {
      return res.status(401).json({ error: "User not active" });
    }

    if (user.locked_until && user.locked_until > new Date()) {
      return res.status(403).json({
        error: `Account locked until ${user.locked_until.toISOString()}`,
      });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    if (user.must_reset_password) {
      return res.status(403).json({
        error: "❌ You must reset your password before logging in",
      });
    }

    user.login_attempts = 0;
    user.locked_until = null;
    user.last_login_at = new Date();
    await user.save();

    const isSystemOwner =
      user.email?.toLowerCase() === SYSTEM_OWNER_EMAIL;

    const hasSuperAdminRole = user.facilityLinks?.some(
      (fl) =>
        fl.role?.name &&
        fl.role.name.toLowerCase().includes("super admin")
    );

    let payload;

    // ============================================================
    // 🛡️ SUPER ADMIN
    // ============================================================
    if (isSystemOwner || hasSuperAdminRole) {
      payload = {
        id: user.id,
        email: user.email,
        token_version: user.token_version,
        organization_id: null,
        facility_ids: [],
        roles: [
          {
            id: null,
            name: "Super Admin",
            normalized: "superadmin",
          },
        ],
      };
    }

    // ============================================================
    // 🏢 TENANT (ORG / FACILITY) — FIXED
    // ============================================================
    else {
      const links = user.facilityLinks || [];

      const facilityRoles = links.filter(
        (fl) =>
          fl.role &&
          fl.facility_id &&
          (fl.organization_id || fl.facility?.organization_id)
      );

      const orgRoles = links.filter(
        (fl) =>
          fl.role &&
          fl.facility_id === null &&
          fl.organization_id
      );

      const effectiveRoles =
        facilityRoles.length > 0 ? facilityRoles : orgRoles;

      if (links.length > 0 && effectiveRoles.length === 0) {
        return res.status(500).json({
          error: "User role assignment is invalid. Contact administrator.",
        });
      }

      // ===============================
      // ✅ FACILITY INJECTION (KEY FIX)
      // ===============================
      let facilityId = null;

      if (facilityRoles.length > 0) {
        facilityId = facilityRoles[0].facility_id;
      } else if (orgRoles.length > 0) {
        facilityId =
          user.facilityLinks?.find((fl) => fl.facility_id)?.facility_id ||
          null;
      }

      const primaryRole = effectiveRoles[0];

      const resolvedOrgId =
        primaryRole?.organization_id ||
        primaryRole?.facility?.organization_id ||
        user.organization_id ||
        null;

      payload = {
        id: user.id,
        email: user.email,
        token_version: user.token_version,
        organization_id: resolvedOrgId,
        facility_ids: facilityId ? [facilityId] : [],
        roles: effectiveRoles.map((fl) => ({
          id: fl.role.id,
          name: fl.role.name,
          normalized: (fl.role.name || "")
            .toLowerCase()
            .replace(/[\s_-]+/g, ""),
        })),
      };
    }

    // ============================================================
    // 🔐 PERMISSIONS
    // ============================================================
    const roleIds = payload.roles.map((r) => r.id).filter(Boolean);

    const permissions = await getRolePermissions(roleIds, {
      organization_id: payload.organization_id,
      facility_id: payload.facility_ids[0] || null,
    });

    payload.permissions = permissions || [];

    // ============================================================
    // 🔑 TOKENS
    // ============================================================
    const { accessToken, refreshToken } = generateTokens(payload);

    await storeHashedRefreshToken(
      user.id,
      null,
      refreshToken,
      req.ip,
      req.headers["user-agent"]
    );

    res.cookie("refreshToken", refreshToken, {
      ...cookieOptions,
      maxAge: REFRESH_TOKEN_TTL_DAYS * 86400000,
    });

    return res.json({
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.full_name || "",
        role: payload.roles?.[0]?.name || "staff",

        organization_id: payload.organization_id,

        // ✅ THIS IS THE MISSING PIECE
        facility_ids: payload.facility_ids,
        facility_id: payload.facility_ids?.[0] || null,

        permissions: payload.permissions,
      },
    });

  } catch (err) {
    logger.error("[AUTH] Login error", {
      message: err.message,
      stack: err.stack,
    });
    return res.status(500).json({ error: "Server error" });
  }
};

// -------------------- Me --------------------
export const me = async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id, {
      attributes: { exclude: ["password_hash"] },
      include: [
        {
          model: Employee,
          as: "employee",
          required: false,
          include: [{ model: Department, as: "department", attributes: ["id", "name"] }],
        },
        {
          model: UserFacility,
          as: "facilityLinks",
          include: [
            { model: Role, as: "role", attributes: ["id", "name"] },
            {
              model: Facility,
              as: "facility",
              attributes: ["id", "name", "organization_id"],
              include: [{ model: Organization, as: "organization", attributes: ["id", "name", "code"] }],
            },
          ],
        },
        { model: Organization, as: "organization", attributes: ["id", "name", "code"] },
      ],
    });

    if (!user) {
      await auditService.logAction({
        module: "auth",
        action: "failed_me_query",
        user: req.user,
        details: { reason: "User not found" },
      });
      return res.status(404).json({ error: "User not found" });
    }

    const orgId =
      user.organization_id ||
      user.facilityLinks?.[0]?.organization_id ||
      user.facilityLinks?.[0]?.facility?.organization_id ||
      null;

    const orgName =
      user.organization?.name || user.facilityLinks?.[0]?.facility?.organization?.name || "";
    const orgCode =
      user.organization?.code || user.facilityLinks?.[0]?.facility?.organization?.code || "";

    let roleName = "User";
    let normalizedRole = "user";
    if (req.user.roles?.some((r) => r.normalized === "superadmin")) {
      roleName = "Super Admin";
      normalizedRole = "superadmin";
    } else if (req.user.roles?.length) {
      roleName = req.user.roles[0].name;
      normalizedRole = req.user.roles[0].normalized || roleName.toLowerCase();
    }

    const roleIds = req.user.roles?.map((r) => r.id) || [];
    const permissions = await getRolePermissions(roleIds, {
      organization_id: orgId,
      facility_id: user.facilityLinks?.[0]?.facility_id || null,
    });

    const safeUser = {
      id: user.id,
      email: user.email,
      first_name: user.first_name,
      last_name: user.last_name,
      employee: user.employee,
      facilityLinks: user.facilityLinks,
      name: user.full_name || "",
      role: roleName,
      department: user.employee?.department?.name || "",
      organization: orgName,
      organization_id: orgId,
      organization_code: orgCode,
      permissions,
    };

    // ✅ Audit success
    await auditService.logAction({
      module: "auth",
      action: "fetch_me",
      user: req.user,
      details: { ip: req.ip, agent: req.headers["user-agent"] },
    });

    res.json(safeUser);
  } catch (err) {
    logger.error("[AUTH] Fetch me error", {
      message: err.message,
      stack: err.stack,
      userId: req.user?.id,
    });
    await auditService.logError({
      module: "auth",
      action: "fetch_me",
      user: req.user,
      error: err,
    });
    res.status(500).json({ error: "Server error" });
  }
};

// -------------------- Refresh Token (🔥 FIXED) --------------------
export const refresh = async (req, res) => {
  try {
    const token = req.cookies?.refreshToken || req.body?.refreshToken;
    if (!token) return res.status(401).json({ error: "Missing refresh token" });

    let decoded;
    try {
      decoded = jwt.verify(token, REFRESH_TOKEN_SECRET);
    } catch {
      return res.status(403).json({ error: "Invalid or expired token" });
    }

    const storedTokens = await RefreshToken.findAll({ where: { user_id: decoded.id } });
    const matchedToken = storedTokens.find((st) => bcrypt.compareSync(token, st.token));
    if (!matchedToken) {
      return res.status(403).json({ error: "Invalid refresh token" });
    }

    // 🔒 SANITIZE ORG ID (CRITICAL FIX)
    const safeOrgId =
      decoded.organization_id && decoded.organization_id !== "super"
        ? decoded.organization_id
        : null;

    const roleIds = decoded.roles?.map((r) => r.id) || [];
    const permissions = await getRolePermissions(roleIds, {
      organization_id: safeOrgId,
      facility_id: decoded.facility_ids?.[0] || null,
    });

    await RefreshToken.destroy({ where: { id: matchedToken.id } });

    // 🔁 Re-issue tokens with SAFE org id
    const newPayload = {
      ...decoded,
      organization_id: safeOrgId,
      permissions,
    };

    const { accessToken, refreshToken: newRefreshToken } = generateTokens(newPayload);
    await storeHashedRefreshToken(decoded.id, null, newRefreshToken, req.ip, req.headers["user-agent"]);

    res.cookie("refreshToken", newRefreshToken, {
      ...cookieOptions,
      maxAge: REFRESH_TOKEN_TTL_DAYS * 86400000,
    });

    res.json({ accessToken });

  } catch (err) {
    logger.error("[AUTH] Refresh token error", {
      message: err.message,
      stack: err.stack,
    });
    res.status(500).json({ error: "Server error" });
  }
};


// -------------------- Logout --------------------
export const logout = async (req, res) => {
  try {
    const token = req.cookies?.refreshToken;
    if (token && req.user?.id) {
      const storedTokens = await RefreshToken.findAll({
        where: { user_id: req.user.id },
      });

      // match only the one refresh token for this device
      for (const st of storedTokens) {
        if (bcrypt.compareSync(token, st.token)) {
          await RefreshToken.destroy({ where: { id: st.id } });
          break; // ✅ only remove this device's token
        }
      }
    }

    // ✅ Audit log
    await auditService.logAction({
      module: "auth",
      action: "logout",
      user: req.user,
      details: { ip: req.ip, agent: req.headers["user-agent"] },
    });

    // clear cookie from client
    res.clearCookie("refreshToken", cookieOptions);
    res.sendStatus(204);
  } catch (err) {
    logger.error("[AUTH] Logout error", {
      message: err.message,
      stack: err.stack,
      userId: req.user?.id,
    });
    await auditService.logError({
      module: "auth",
      action: "logout",
      user: req.user,
      error: err,
    });
    res.status(500).json({ error: "Server error" });
  }
};

// -------------------- Logout All Devices --------------------
export const logoutAll = async (req, res) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    // ✅ Destroy all refresh tokens for this user
    await RefreshToken.destroy({ where: { user_id: req.user.id } });

    // ✅ Bump token_version to invalidate all existing access tokens
    await User.update(
      { token_version: sequelize.literal('"token_version" + 1') },
      { where: { id: req.user.id } }
    );

    // ✅ Audit log
    await auditService.logAction({
      module: "auth",
      action: "logout_all",
      user: req.user,
      details: { ip: req.ip, agent: req.headers["user-agent"] },
    });

    // ✅ Clear cookie
    res.clearCookie("refreshToken", { ...cookieOptions, maxAge: 0 });
    res.json({ message: "✅ Logged out from all devices" });
  } catch (err) {
    logger.error("[AUTH] Logout all error", {
      message: err.message,
      stack: err.stack,
      userId: req.user?.id,
    });
    await auditService.logError({
      module: "auth",
      action: "logout_all",
      user: req.user,
      error: err,
    });
    res.status(500).json({ error: "Server error" });
  }
};

// -------------------- Change Password (with PasswordHistory) --------------------
export const changePassword = async (req, res) => {
  try {
    const { error } = passwordChangeSchema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });

    const { oldPassword, newPassword } = req.body;
    const user = await User.findByPk(req.user.id);
    if (!user) return res.status(404).json({ error: "User not found" });

    const isMatch = await bcrypt.compare(oldPassword, user.password_hash);
    if (!isMatch) {
      await auditService.logAction({
        module: "auth",
        action: "failed_password_change",
        user,
        details: { reason: "Incorrect old password" },
      });
      return res.status(400).json({ error: "Old password is incorrect" });
    }

    // Prevent reuse of last 5
    const lastHashes = await PasswordHistory.findAll({
      where: { user_id: user.id },
      order: [["created_at", "DESC"]],
      limit: 5,
    });

    for (const ph of lastHashes) {
      if (await bcrypt.compare(newPassword, ph.password_hash)) {
        await auditService.logAction({
          module: "auth",
          action: "failed_password_change",
          user,
          details: { reason: "Password reuse attempt" },
        });
        return res.status(400).json({ error: "❌ Cannot reuse a recent password" });
      }
    }

    // Hash and update
    const newHash = await bcrypt.hash(newPassword, 14);
    user.password_hash = newHash;
    user.updated_by_id = req.user.id;
    user.must_reset_password = false;
    await user.save();

    // Record in history
    await PasswordHistory.create({ user_id: user.id, password_hash: newHash });

    // ✅ Audit log
    await auditService.logAction({
      module: "auth",
      action: "password_change",
      user,
      details: { ip: req.ip, agent: req.headers["user-agent"] },
    });

    res.json({ message: "✅ Password changed successfully" });
  } catch (err) {
    logger.error("[AUTH] Change password error", {
      message: err.message,
      stack: err.stack,
      userId: req.user?.id,
    });
    await auditService.logError({
      module: "auth",
      action: "password_change",
      user: req.user,
      error: err,
    });
    res.status(500).json({ error: "Server error" });
  }
};

// -------------------- Manual Password Reset via Token (with PasswordHistory) --------------------
export const manualResetPassword = async (req, res) => {
  try {
    const { email, token, newPassword } = req.body;
    if (!email || !token || !newPassword) {
      return res.status(400).json({ error: "All fields required" });
    }

    const user = await User.findOne({
      where: {
        email: email.toLowerCase(),
        password_reset_token: token,
        password_reset_expiry: { [Op.gt]: new Date() },
      },
    });
    if (!user) {
      await auditService.logAction({
        module: "auth",
        action: "failed_password_reset",
        details: { email, reason: "Invalid or expired token" },
      });
      return res.status(400).json({ error: "Invalid or expired token" });
    }

    // Prevent reuse of last 5
    const lastHashes = await PasswordHistory.findAll({
      where: { user_id: user.id },
      order: [["created_at", "DESC"]],
      limit: 5,
    });

    for (const ph of lastHashes) {
      if (await bcrypt.compare(newPassword, ph.password_hash)) {
        await auditService.logAction({
          module: "auth",
          action: "failed_password_reset",
          user,
          details: { reason: "Password reuse attempt" },
        });
        return res.status(400).json({ error: "❌ Cannot reuse a recent password" });
      }
    }

    const newHash = await bcrypt.hash(newPassword, 14);
    user.password_hash = newHash;
    user.password_reset_token = null;
    user.password_reset_expiry = null;
    user.must_reset_password = false;
    user.login_attempts = 0;
    user.locked_until = null;
    user.updated_by_id = req.user?.id || null;
    await user.save();

    await PasswordHistory.create({ user_id: user.id, password_hash: newHash });

    // ✅ Audit log
    await auditService.logAction({
      module: "auth",
      action: "password_reset",
      user,
      details: { ip: req.ip, agent: req.headers["user-agent"] },
    });

    res.json({ message: "✅ Password reset successful" });
  } catch (err) {
    logger.error("[AUTH] Manual password reset error", {
      message: err.message,
      stack: err.stack,
    });
    await auditService.logError({
      module: "auth",
      action: "password_reset",
      error: err,
    });
    res.status(500).json({ error: "Server error" });
  }
};
// -------------------- Force Password Reset (NO AUTH) --------------------
export const forceResetPassword = async (req, res) => {
  try {
    const { email, newPassword } = req.body;

    if (!email || !newPassword) {
      return res.status(400).json({ error: "Email and new password required" });
    }

    // Reuse same strength rules as changePassword
    const { error } = Joi.object({
      newPassword: passwordChangeSchema.extract("newPassword"),
    }).validate({ newPassword });

    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const user = await User.findOne({
      where: { email: email.toLowerCase() },
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // 🔐 CRITICAL SECURITY CHECK
    if (!user.must_reset_password) {
      return res.status(403).json({
        error: "Password reset not permitted for this account",
      });
    }

    // Prevent reuse of last 5 passwords
    const lastHashes = await PasswordHistory.findAll({
      where: { user_id: user.id },
      order: [["created_at", "DESC"]],
      limit: 5,
    });

    for (const ph of lastHashes) {
      if (await bcrypt.compare(newPassword, ph.password_hash)) {
        return res.status(400).json({
          error: "❌ Cannot reuse a recent password",
        });
      }
    }

    // Update password
    const newHash = await bcrypt.hash(newPassword, 14);
    user.password_hash = newHash;
    user.must_reset_password = false;
    user.login_attempts = 0;
    user.locked_until = null;
    user.updated_by_id = null; // unauth reset
    await user.save();

    await PasswordHistory.create({
      user_id: user.id,
      password_hash: newHash,
    });

    // ✅ Audit log
    await auditService.logAction({
      module: "auth",
      action: "force_password_reset",
      user,
      details: { email },
    });

    return res.json({ message: "✅ Password updated successfully" });

  } catch (err) {
    logger.error("[AUTH] Force password reset error", {
      message: err.message,
      stack: err.stack,
    });
    await auditService.logError({
      module: "auth",
      action: "force_password_reset",
      error: err,
    });
    return res.status(500).json({ error: "Server error" });
  }
};
