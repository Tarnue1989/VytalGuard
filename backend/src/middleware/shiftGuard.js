/* -------------------- Shift Access Guard Middleware -------------------- */
/* 🧠 Single-source logging via debugLogger (Global + File Override) */

import { checkShiftForEmployee } from "../utils/shiftUtils.js";
import { makeModuleLogger } from "../utils/debugLogger.js";

/* ============================================================
   🔧 LOCAL DEBUG OVERRIDE (THIS FILE ONLY)
   true  = debug ON for shiftGuard
   false = debug OFF for shiftGuard
============================================================ */
const DEBUG_OVERRIDE = false; // 👈 usually OFF
const log = makeModuleLogger("shiftGuard", DEBUG_OVERRIDE);

export default async function shiftGuard(req, res, next) {
  try {
    const userId = req.user?.id;

    /* ============================================================
       🔐 Ensure user context exists
    ============================================================ */
    if (!userId) {
      log.warn("Shift access denied: missing user context");

      return res.status(401).json({
        message: "Unauthorized",
      });
    }

    /* ============================================================
       🕒 Check shift status
    ============================================================ */
    const inShift = await checkShiftForEmployee(userId);

    log.log("SHIFT CHECK RESULT", {
      userId,
      inShift,
      roles: req.user?.roleNames,
    });

    /* ============================================================
       🚫 Block access if outside shift (except admin/system)
    ============================================================ */
    const elevatedRoles = ["admin", "superadmin"];

    const isElevated =
      Array.isArray(req.user?.roleNames) &&
      req.user.roleNames.some((r) =>
        elevatedRoles.includes(String(r).toLowerCase())
      );

    if (!inShift && !isElevated) {
      log.warn("Shift access denied", {
        userId,
        roles: req.user?.roleNames,
      });

      return res.status(403).json({
        message: "Access denied: outside your shift",
      });
    }

    /* ============================================================
       ✅ Access granted
    ============================================================ */
    log.log("Shift access granted", {
      userId,
      inShift,
      bypassed: isElevated,
    });

    next();
  } catch (err) {
    // 🚨 SYSTEM ERROR — ALWAYS LOG
    log.error("shiftGuard middleware failure", err);

    return res.status(500).json({
      message: "Internal error in shift guard middleware",
    });
  }
}
