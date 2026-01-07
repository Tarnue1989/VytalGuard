// 📁 backend/src/routes/depositRoutes.js
// ============================================================================
// 💰 Deposit Routes – Enterprise Master Pattern (Aligned with Appointments)
// ----------------------------------------------------------------------------
// 🔹 Covers full lifecycle: create → clear → apply → verify → void → reverse → restore
// 🔹 Includes lite list, toggle, cancel, delete, and scoped filters
// ============================================================================

import { Router } from "express";
import {
  getAllDeposits,
  getDepositById,
  getAllDepositsLite,
  createDeposit,
  updateDeposit,
  toggleDepositStatus,
  applyDepositToInvoice,
  reverseDeposit,
  cancelDeposit,
  deleteDeposit,
  // 🆕 Extended lifecycle actions
  verifyDeposit,
  voidDeposit,
  restoreDeposit, // ✅ Added for full lifecycle restore
} from "../controllers/depositController.js";
import { verifyAuth } from "../middleware/verifyAuth.js";


const router = Router();

// 🆔 UUID regex for safe :id routes
const UUIDv4 =
  "[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}";

/* ============================================================
   📌 DEPOSIT ROUTES
============================================================ */

// 🔍 List & Lookup
router.get("/", verifyAuth,  getAllDeposits);
router.get("/lite", verifyAuth,  getAllDepositsLite);
router.get(`/:id(${UUIDv4})`, verifyAuth,  getDepositById);

// ➕ Create / ✏️ Update / 🗑️ Delete
router.post("/", verifyAuth,  createDeposit);
router.put(`/:id(${UUIDv4})`, verifyAuth,  updateDeposit);
router.delete(`/:id(${UUIDv4})`, verifyAuth,  deleteDeposit);

// 🔄 Lifecycle & Financial Actions
router.patch(`/:id(${UUIDv4})/toggle-status`, verifyAuth,  toggleDepositStatus);
router.patch(`/:id(${UUIDv4})/reverse`, verifyAuth,  reverseDeposit);
router.patch(`/:id(${UUIDv4})/cancel`, verifyAuth,  cancelDeposit);
router.post(`/:id(${UUIDv4})/apply-to-invoice`, verifyAuth,  applyDepositToInvoice);

// 🆕 Extended Admin / Audit Lifecycle
router.patch(`/:id(${UUIDv4})/verify`, verifyAuth,  verifyDeposit);
router.patch(`/:id(${UUIDv4})/void`, verifyAuth,  voidDeposit);
router.patch(`/:id(${UUIDv4})/restore`, verifyAuth,  restoreDeposit); // ✅ Added

/* ============================================================
   ✅ EXPORT
============================================================ */
export default router;
