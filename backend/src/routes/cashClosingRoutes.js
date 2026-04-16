// 📁 backend/src/routes/cashClosingRoutes.js
// ============================================================================
// 💰 Cash Closing Routes – Enterprise Master Pattern (Deposit-Aligned)
// ----------------------------------------------------------------------------
// 🔹 Covers lifecycle: close → view → list → reopen
// 🔹 Includes lite list, filters, and scoped tenant safety
// ============================================================================

import { Router } from "express";
import {
  getAllClosings,
  getClosingById,
  closeCashDay,
  reopenClosing,
} from "../controllers/cashClosingController.js";

import { verifyAuth } from "../middleware/verifyAuth.js";

const router = Router();

/* ============================================================ */
const UUIDv4 =
  "[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}";

/* ============================================================
   📌 CASH CLOSING ROUTES
============================================================ */

// 🔍 List & Lookup
router.get("/", verifyAuth, getAllClosings);
router.get(`/:id(${UUIDv4})`, verifyAuth, getClosingById);

// ➕ Close Cash Day
router.post("/", verifyAuth, closeCashDay);

// 🔄 Lifecycle
router.patch(`/:id(${UUIDv4})/reopen`, verifyAuth, reopenClosing);

/* ============================================================
   ✅ EXPORT
============================================================ */
export default router;