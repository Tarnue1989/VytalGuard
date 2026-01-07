// ============================================================================
// 💸 Deposit Refund Routes – Enterprise Master Pattern (Aligned with Deposits)
// ----------------------------------------------------------------------------
// 🔹 Full lifecycle: create refund → reverse refund
// 🔹 UUID-safe routing + tenant-scoped + audit-ready
// ============================================================================

import { Router } from "express";
import {
  createRefundDeposit,
  reverseRefundDeposit,
} from "../controllers/refundDepositController.js";
import { verifyAuth } from "../middleware/verifyAuth.js";


const router = Router();

// 🆔 UUID regex for safe :id routes
const UUIDv4 =
  "[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}";

/* ============================================================
   📌 DEPOSIT REFUND ROUTES
============================================================ */

// ➕ Create a refund
router.post("/", verifyAuth,  createRefundDeposit);

// ♻️ Reverse refund
router.patch(
  `/:id(${UUIDv4})/reverse`,
  verifyAuth,
  
  reverseRefundDeposit
);

/* ============================================================
   ✅ EXPORT
============================================================ */
export default router;
