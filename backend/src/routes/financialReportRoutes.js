// 📁 backend/src/routes/financialReportRoutes.js
import { Router } from "express";
import { verifyAuth } from "../middleware/verifyAuth.js";

import { financialReportController } from "../controllers/financialReportController.js";

const router = Router();

/* ============================================================
   📊 FINANCIAL REPORT ROUTES (READ-ONLY)
   ------------------------------------------------------------
   🔐 Auth: verifyAuth
   🏥 Scope: facility
   ❌ No writes
============================================================ */

/* ============================================================
   🔹 OVERALL FINANCIAL SUMMARY
============================================================ */
router.get(
  "/summary",
  verifyAuth,
  
  financialReportController.summary
);

/* ============================================================
   🔹 REVENUE BY SERVICE / MODULE
============================================================ */
router.get(
  "/services",
  verifyAuth,
  
  financialReportController.services
);

/* ============================================================
   🔹 PAYMENTS BY METHOD (CASH INFLOW)
============================================================ */
router.get(
  "/payments",
  verifyAuth,
  
  financialReportController.payments
);

/* ============================================================
   🔹 PAYMENT REFUNDS (REVENUE REVERSALS ONLY)
   ------------------------------------------------------------
   ⚠️ IMPORTANT:
     - PAYMENT refunds only
     - Deposit refunds are NOT included here
============================================================ */
router.get(
  "/refunds/payments",
  verifyAuth,
  
  financialReportController.paymentRefunds
);

/* ============================================================
   🔹 DEPOSIT OVERVIEW (LIABILITY VIEW)
   ------------------------------------------------------------
   Includes:
     - collected
     - applied
     - deposit_refunded
     - remaining
============================================================ */
router.get(
  "/deposits",
  verifyAuth,
  
  financialReportController.deposits
);

/* ============================================================
   ✅ EXPORT
============================================================ */
export default router;
