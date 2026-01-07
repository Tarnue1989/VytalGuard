/* -------------------- Verify Token Middleware -------------------- */
/* 🧠 Single-source logging via debugLogger (Global + File Override) */

import jwt from "jsonwebtoken";
import { User, Employee } from "../models/index.js";
import { makeModuleLogger } from "../utils/debugLogger.js";

/* ============================================================
   🔧 LOCAL DEBUG OVERRIDE (THIS FILE ONLY)
   true  = debug ON for verifyToken
   false = debug OFF for verifyToken
============================================================ */
const DEBUG_OVERRIDE = false; // 👈 usually OFF
const log = makeModuleLogger("verifyToken", DEBUG_OVERRIDE);

const SYSTEM_OWNER_EMAIL = "superadmin@vytalguard.com";

export default async function verifyToken(req, res, next) {
  try {
    /* ============================================================
       1️⃣ Extract Bearer token
    ============================================================ */
    const authHeader = req.headers.authorization;
    const token = authHeader?.split(" ")[1];

    if (!token) {
      log.warn("Access denied: no token provided");
      return res.status(401).json({
        message: "Access denied. No token provided.",
      });
    }

    /* ============================================================
       2️⃣ Verify + decode
    ============================================================ */
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      if (err.name === "TokenExpiredError") {
        log.warn("Access token expired");
        return res.status(401).json({
          message: "Access token expired",
        });
      }

      log.warn("Invalid access token");
      return res.status(403).json({
        message: "Invalid access token",
      });
    }

    if (!decoded?.id) {
      log.warn("Invalid token payload");
      return res.status(400).json({
        message: "Invalid token payload.",
      });
    }

    /* ============================================================
       3️⃣ Load user (token_version enforcement)
    ============================================================ */
    const user = await User.findByPk(decoded.id, {
      attributes: ["id", "email", "token_version", "status", "employee_id"],
      include: [{ model: Employee, as: "employee" }],
    });

    if (!user) {
      log.warn("User not found", { userId: decoded.id });
      return res.status(401).json({
        message: "User not found.",
      });
    }

    if (decoded.token_version !== user.token_version) {
      log.warn("Token version mismatch (forced logout)", {
        userId: user.id,
      });

      return res.status(401).json({
        message: "Token expired due to logout/reset. Please login again.",
      });
    }

    if (user.status?.toLowerCase() !== "active") {
      log.warn("Inactive user blocked", { userId: user.id });
      return res.status(403).json({
        message: "User inactive",
      });
    }

    /* ============================================================
       🔹 Normalize helper
    ============================================================ */
    const normalize = (str) =>
      String(str || "")
        .toLowerCase()
        .replace(/\s+/g, "");

    /* ============================================================
       4️⃣ Normalize roles from JWT
    ============================================================ */
    let roles = Array.isArray(decoded.roles)
      ? decoded.roles.map((r) => ({
          id: r.id ?? null,
          name: r.name || r.role_name,
          normalized: normalize(r.name || r.role_name),
          role_type: r.role_type || null,
        }))
      : [];

    /* ============================================================
       🛡️ Super Admin detection
    ============================================================ */
    const isSuperAdmin =
      roles.some((r) => r.normalized === "superadmin") ||
      user.email?.toLowerCase() === SYSTEM_OWNER_EMAIL;

    // ✅ SYSTEM ROLE — NO ID
    if (isSuperAdmin) {
      roles = [
        {
          id: null,
          name: "Super Admin",
          normalized: "superadmin",
          role_type: "system",
        },
      ];

      log.log("System role resolved: Super Admin", {
        userId: user.id,
      });
    }

    if (!roles.length) {
      log.warn("User has no roles", { userId: user.id });
      return res.status(403).json({
        message: "User has no roles.",
      });
    }

    /* ============================================================
       5️⃣ Attach SAFE user context
    ============================================================ */
    req.user = {
      id: user.id,
      email: user.email,

      employee_id: user.employee_id,
      full_name: user.employee?.full_name || null,

      facility_ids: Array.isArray(decoded.facility_ids)
        ? decoded.facility_ids.filter(
            (id) => typeof id === "string" && id.length === 36
          )
        : [],

      facility_id: null,

      organization_id:
        typeof decoded.organization_id === "string" &&
        decoded.organization_id.length === 36
          ? decoded.organization_id
          : null,

      roles,
      roleNames: roles.map((r) => r.normalized),
    };

    log.log("Token verified successfully", {
      userId: user.id,
      roles: req.user.roleNames,
    });

    next();
  } catch (err) {
    // 🚨 SYSTEM ERROR — ALWAYS LOG
    log.error("verifyToken middleware failure", err);

    return res.status(403).json({
      message: "Invalid or expired token.",
    });
  }
}
