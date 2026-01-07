// 📁 backend/src/utils/security-utils.js
import { authzService } from "../services/authzService.js";
import { logger } from "./logger.js";

/* ============================================================
   🛡️ ENFORCE FEATURE + PERMISSION
   Unified enterprise-grade precheck for all controllers
   ============================================================ */
/**
 * Ensures both the feature module is enabled and
 * the user has permission to perform the given action.
 *
 * @param {Object} req - Express request object (with req.user)
 * @param {Object} res - Express response
 * @param {String} module - Module key, e.g. "lab_request"
 * @param {String} action - Action key, e.g. "create", "update", "read"
 * @returns {Boolean} - true if allowed, false if blocked
 */
export async function enforceFeatureAndPermission(req, res, module, action) {
  try {
    // 🔹 Feature check (module enabled for org/facility)
    const featureAllowed = await authzService.checkFeature({
      user: req.user,
      module,
      res,
    });
    if (!featureAllowed) {
      logger.warn(`🚫 Feature disabled → ${module}`);
      return false;
    }

    // 🔹 Permission check (user authorized for action)
    const allowed = await authzService.checkPermission({
      user: req.user,
      module,
      action,
      res,
    });
    if (!allowed) {
      logger.warn(`🚫 Permission denied → ${module}:${action}`);
      return false;
    }

    // ✅ All good
    logger.info(`✅ [security-utils] Authorized → ${module}:${action}`);
    return true;
  } catch (err) {
    logger.error(`❌ [security-utils] Enforcement failed for ${module}:${action}:`, err);
    if (res) res.status(500).json({ message: "Authorization error", error: err.message });
    return false;
  }
}

/* ============================================================
   🧩 OPTIONAL: SUPERADMIN BYPASS HELPER
   ============================================================ */
export function isSuperAdmin(user) {
  if (!user) return false;
  const roles = Array.isArray(user.roleNames)
    ? user.roleNames.map((r) => r.toLowerCase())
    : [user.role?.toLowerCase() || ""];
  return (
    roles.includes("superadmin") ||
    roles.includes("system admin") ||
    roles.includes("root") ||
    roles.some((r) => r.includes("super") && r.includes("admin"))
  );
}
