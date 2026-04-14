// 📁 backend/src/routes/expenseRoutes.js
// ============================================================================
// 💸 Expense Routes – Enterprise Master Pattern
// ----------------------------------------------------------------------------
// 🔹 Lifecycle: create → approve → post → void → delete
// 🔹 Includes lite list + full CRUD
// ============================================================================

import { Router } from "express";
import {
  getAllExpenses,
  getExpenseById,
  getAllExpensesLite,
  createExpense,
  updateExpense,
  deleteExpense,

  // 🔄 Lifecycle
  approveExpense,
  postExpense,
  voidExpense,
} from "../controllers/expenseController.js";

import { verifyAuth } from "../middleware/verifyAuth.js";

const router = Router();

/* ============================================================ */
const UUIDv4 =
  "[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}";

/* ============================================================
   📌 EXPENSE ROUTES
============================================================ */

// 🔍 List & Lookup
router.get("/", verifyAuth, getAllExpenses);
router.get("/lite", verifyAuth, getAllExpensesLite);
router.get(`/:id(${UUIDv4})`, verifyAuth, getExpenseById);

// ➕ Create / ✏️ Update / 🗑️ Delete
router.post("/", verifyAuth, createExpense);
router.put(`/:id(${UUIDv4})`, verifyAuth, updateExpense);
router.delete(`/:id(${UUIDv4})`, verifyAuth, deleteExpense);

// 🔄 Lifecycle
router.patch(`/:id(${UUIDv4})/approve`, verifyAuth, approveExpense);
router.patch(`/:id(${UUIDv4})/post`, verifyAuth, postExpense);
router.patch(`/:id(${UUIDv4})/void`, verifyAuth, voidExpense);

/* ============================================================ */
export default router;