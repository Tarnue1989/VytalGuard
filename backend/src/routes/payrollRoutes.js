// 📁 backend/src/routes/payrollRoutes.js
// ============================================================================
// 💰 Payroll Routes – Enterprise Master Pattern (FINAL)
// ----------------------------------------------------------------------------
// ✔ Lifecycle: create → approve → pay → void → delete → restore
// ✔ Pay triggers Expense via model hooks (NOT controller)
// ✔ Fully aligned with controller + permissions
// ============================================================================

import { Router } from "express";
import {
  getAllPayrolls,
  getPayrollById,
  getAllPayrollsLite,
  createPayroll,
  updatePayroll,
  deletePayroll,

  // 🔄 Lifecycle
  approvePayroll,
  payPayroll,
  voidPayroll,

  // ♻️ Optional (if implemented in controller)
  restorePayroll,
} from "../controllers/payrollController.js";

import { verifyAuth } from "../middleware/verifyAuth.js";

const router = Router();

/* ============================================================ */
const UUIDv4 =
  "[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}";

/* ============================================================
   📌 PAYROLL ROUTES
============================================================ */

// 🔍 List & Lookup
router.get("/", verifyAuth, getAllPayrolls);
router.get("/lite", verifyAuth, getAllPayrollsLite);
router.get(`/:id(${UUIDv4})`, verifyAuth, getPayrollById);

// ➕ Create / ✏️ Update / 🗑️ Delete
router.post("/", verifyAuth, createPayroll);
router.put(`/:id(${UUIDv4})`, verifyAuth, updatePayroll);
router.delete(`/:id(${UUIDv4})`, verifyAuth, deletePayroll);

// 🔄 Lifecycle (status-driven)
router.patch(`/:id(${UUIDv4})/approve`, verifyAuth, approvePayroll);
router.patch(`/:id(${UUIDv4})/pay`, verifyAuth, payPayroll);
router.patch(`/:id(${UUIDv4})/void`, verifyAuth, voidPayroll);

// ♻️ Restore (ONLY if controller supports it)
router.patch(`/:id(${UUIDv4})/restore`, verifyAuth, restorePayroll);

/* ============================================================ */
export default router;