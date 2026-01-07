import { Router } from "express";
import { generateReport } from "../controllers/reportController.js";
import { verifyAuth } from "../middleware/verifyAuth.js";

import { authzService } from "../services/authzService.js";

// 🆕 Finance report routes
import financialReportRoutes from "./financialReportRoutes.js";

const router = Router();

/* ============================================================
   📊 REPORT ROUTES (Enterprise Analytics Engine)
   Aligned with: consultationRoutes, deliveryRecordRoutes, etc.
   ------------------------------------------------------------
   Permissions:
     - reports:view
     - reports:export (future)
============================================================ */

/* ============================================================
   🔍 GENERIC / CUSTOM ANALYTICS
============================================================ */

// 🔍 Generate analytics report
router.get(
  "/generate",
  verifyAuth,
  
  async (req, res, next) => {
    try {
      // 🧩 Verify role/permission centrally
      const allowed = await authzService.checkPermission({
        user: req.user,
        module: "reports",
        action: "view",
        res,
      });
      if (!allowed) return;
      next();
    } catch (err) {
      next(err);
    }
  },
  generateReport
);

/* ============================================================
   🧾 EXPORT (Future: Excel / PDF / Saved Reports)
============================================================ */

router.get(
  "/export",
  verifyAuth,
  
  async (req, res, next) => {
    try {
      const allowed = await authzService.checkPermission({
        user: req.user,
        module: "reports",
        action: "export",
        res,
      });
      if (!allowed) return;
      next();
    } catch (err) {
      next(err);
    }
  },
  (req, res) => {
    res.status(501).json({
      success: false,
      message: "Report export feature not yet implemented.",
    });
  }
);

/* ============================================================
   💰 FINANCE REPORTS (READ-ONLY)
   Base path: /api/reports/finance/*
   Permissions:
     - reports:view
============================================================ */

router.use(
  "/finance",
  verifyAuth,
  
  async (req, res, next) => {
    try {
      const allowed = await authzService.checkPermission({
        user: req.user,
        module: "reports",
        action: "view",
        res,
      });
      if (!allowed) return;
      next();
    } catch (err) {
      next(err);
    }
  },
  financialReportRoutes
);

/* ============================================================
   ✅ EXPORT
============================================================ */
export default router;
