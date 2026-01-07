/* -------------------- Role Guard Middleware -------------------- */
/* 🧠 Single-source logging via debugLogger (Global + File Override) */

import { makeModuleLogger } from "../utils/debugLogger.js";

/* ============================================================
   🔧 LOCAL DEBUG OVERRIDE (THIS FILE ONLY)
   true  = debug ON for roleGuard
   false = debug OFF for roleGuard
============================================================ */
const DEBUG_OVERRIDE = false; // 👈 usually OFF
const log = makeModuleLogger("roleGuard", DEBUG_OVERRIDE);

export default function roleGuard(allowedRoles = []) {
  // ✅ Always normalize allowedRoles into an array
  if (!Array.isArray(allowedRoles)) {
    allowedRoles = [allowedRoles];
  }

  return (req, res, next) => {
    try {
      /* ============================================================
         1️⃣ Ensure user is authenticated
      ============================================================ */
      if (!req.user) {
        // 🚨 SECURITY LOG (intentional)
        log.warn("Access denied: user not authenticated");

        return res.status(401).json({
          success: false,
          message: "Access denied: User not authenticated.",
        });
      }

      /* ============================================================
         🔹 Helper — normalize role names
      ============================================================ */
      const normalize = (str) =>
        String(str || "")
          .toLowerCase()
          .replace(/[\s_-]+/g, "");

      /* ============================================================
         2️⃣ Normalize allowed roles
      ============================================================ */
      const allowed = allowedRoles.map((r) => normalize(r));

      /* ============================================================
         3️⃣ Extract and normalize user roles
      ============================================================ */
      const userRoles = Array.isArray(req.user.roles)
        ? req.user.roles.map((r) =>
            normalize(r.name || r.normalized || r)
          )
        : [normalize(req.user.role || "")];

      log.log("ROLE CHECK → context", {
        userId: req.user.id,
        userRoles,
        allowedRoles: allowed,
      });

      /* ============================================================
         🧩 Ensure user has roles
      ============================================================ */
      if (!userRoles.length) {
        log.warn("Access denied: no roles assigned", {
          userId: req.user.id,
        });

        return res.status(403).json({
          success: false,
          message: "Access denied: No roles assigned to user.",
        });
      }

      /* ============================================================
         🛡️ Super Admin / Elevated Role Bypass
      ============================================================ */
      const elevatedRoles = [
        "superadmin",
        "superadministrator",
        "superadminuser",
        "orgowner",
        "organizationowner",
        "organizationadmin",
        "orgadmin",
        "orgadministrator",
      ];

      if (userRoles.some((r) => elevatedRoles.includes(r))) {
        log.log("Bypass granted (elevated role)", {
          userId: req.user.id,
          roles: userRoles,
        });
        return next();
      }

      /* ============================================================
         4️⃣ Check role match
      ============================================================ */
      const hasAccess = userRoles.some((r) => allowed.includes(r));

      if (!hasAccess) {
        log.warn("Access denied: role mismatch", {
          userId: req.user.id,
          userRoles,
          requiredRoles: allowed,
        });

        return res.status(403).json({
          success: false,
          message: `Access denied: Requires one of [${allowed.join(", ")}]`,
          userRoles,
        });
      }

      /* ============================================================
         ✅ Access granted
      ============================================================ */
      log.log("Access granted", {
        userId: req.user.id,
        role: userRoles.find((r) => allowed.includes(r)),
      });

      next();
    } catch (err) {
      // 🚨 SYSTEM ERROR — ALWAYS LOG
      log.error("RoleGuard middleware error", err);

      return res.status(500).json({
        success: false,
        message: "Internal error in role guard middleware",
      });
    }
  };
}
