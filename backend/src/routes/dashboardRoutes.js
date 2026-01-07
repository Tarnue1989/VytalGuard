// 📁 backend/src/routes/dashboardRoutes.js
import { Router } from "express";
import { getDashboardData } from "../controllers/dashboardController.js";
import { verifyAuth } from "../middleware/verifyAuth.js";


const router = Router();

/* ============================================================
   📊 DASHBOARD ROUTES (Enterprise Standard)
   ============================================================ */

// 🔍 Main Dashboard Data
// Uses verifyAuth for authentication + scopeFacility to inject org/facility context
router.get("/", verifyAuth,  getDashboardData);

/* ============================================================
   ✅ EXPORT
   ============================================================ */
export default router;
