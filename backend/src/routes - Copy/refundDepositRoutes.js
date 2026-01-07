// 📁 backend/src/routes/refundDepositRoutes.js
// ============================================================================
// ⚡ ENTERPRISE-GRADE DEPOSIT REFUND ROUTER
// Full lifecycle support:
// pending → review → approve → process → reverse → restore
//          ↘ reject → restore
//          ↘ cancel → restore
//          ↘ void → restore
// ============================================================================

import { Router } from "express";
import { verifyAuth } from "../middleware/verifyAuth.js";


import {
  createRefundDeposit,
  updateRefundDeposit,
  deleteRefundDeposit,

  reviewRefundDeposit,
  approveRefundDeposit,
  processRefundDeposit,
  reverseRefundDeposit,
  voidRefundDeposit,
  restoreRefundDeposit,

  rejectRefundDeposit,
  cancelRefundDeposit,

  getAllRefundDeposits,
  getAllRefundDepositsLite,
  getRefundDepositById,
} from "../controllers/refundDepositController.js";

const router = Router();

// UUID v4 validator (RFC-4122 strict)
const UUIDv4 =
  "[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}";

/* ============================================================================
   📌 READ / QUERY ROUTES
============================================================================ */
router.get("/", verifyAuth,  getAllRefundDeposits);
router.get("/lite", verifyAuth,  getAllRefundDepositsLite);
router.get(`/:id(${UUIDv4})`, verifyAuth,  getRefundDepositById);

/* ============================================================================
   📌 CREATE / UPDATE / DELETE
============================================================================ */
router.post("/", verifyAuth,  createRefundDeposit);
router.put(`/:id(${UUIDv4})`, verifyAuth,  updateRefundDeposit);
router.delete(`/:id(${UUIDv4})`, verifyAuth,  deleteRefundDeposit);

/* ============================================================================
   📌 LIFECYCLE ROUTES — ENTERPRISE STATE MACHINE
============================================================================ */
// Standard lifecycle
router.patch(`/:id(${UUIDv4})/review`,   verifyAuth,  reviewRefundDeposit);
router.patch(`/:id(${UUIDv4})/approve`,  verifyAuth,  approveRefundDeposit);
router.patch(`/:id(${UUIDv4})/process`,  verifyAuth,  processRefundDeposit);
router.patch(`/:id(${UUIDv4})/reverse`,  verifyAuth,  reverseRefundDeposit);
router.patch(`/:id(${UUIDv4})/void`,     verifyAuth,  voidRefundDeposit);
router.patch(`/:id(${UUIDv4})/restore`,  verifyAuth,  restoreRefundDeposit);

// ⭐ REQUIRED FOR FRONTEND — Fixes infinite spinner
router.patch(`/:id(${UUIDv4})/reject`,   verifyAuth,  rejectRefundDeposit);
router.patch(`/:id(${UUIDv4})/cancel`,   verifyAuth,  cancelRefundDeposit);

/* ============================================================================
   📌 EXPORT ROUTER
============================================================================ */
export default router;
