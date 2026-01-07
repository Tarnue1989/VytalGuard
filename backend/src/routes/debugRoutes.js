import { Router } from "express";
import { setDebug, isDebugEnabled } from "../utils/debugLogger.js";
import { verifyAuth } from "../middleware/verifyAuth.js";
import { isSuperAdmin } from "../utils/role-utils.js";

const router = Router();

/* ============================================================
   🛠 DEBUG CONTROL ROUTES
   ============================================================ */

// 🔥 Turn debug ON / OFF
router.post("/toggle", verifyAuth, (req, res) => {
  if (!isSuperAdmin(req.user)) {
    return res.status(403).json({ error: "Forbidden" });
  }

  setDebug(req.body.enabled);
  return res.json({ debug: isDebugEnabled() });
});

// 👀 Optional: check status
router.get("/status", verifyAuth, (req, res) => {
  return res.json({ debug: isDebugEnabled() });
});

/* ============================================================
   ✅ EXPORT
   ============================================================ */
export default router;
