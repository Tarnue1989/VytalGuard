// 📁 backend/src/routes/expenseRoutes.js
// ============================================================================
// 💸 Expense Routes – Enterprise MASTER (FINAL CLEAN)
// ============================================================================

import { Router } from "express";
import {
  getAllExpenses,
  getExpenseById,
  getAllExpensesLite,
  createExpense,
  updateExpense,
  deleteExpense,

  approveExpense,
  postExpense,
  voidExpense,

  reverseExpense,
  restoreExpense,
  cancelExpense,
  submitExpense,
} from "../controllers/expenseController.js";

import { verifyAuth } from "../middleware/verifyAuth.js";

const router = Router();

/* ============================================================ */
const UUIDv4 =
  "[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}";

/* ============================================================
   📌 ROUTES
============================================================ */

// 🔍 List
router.get("/", verifyAuth, getAllExpenses);
router.get("/lite", verifyAuth, getAllExpensesLite);
router.get(`/:id(${UUIDv4})`, verifyAuth, getExpenseById);

// ➕ CRUD
router.post("/", verifyAuth, createExpense);
router.put(`/:id(${UUIDv4})`, verifyAuth, updateExpense);
router.delete(`/:id(${UUIDv4})`, verifyAuth, deleteExpense);

// 🔄 Lifecycle
router.patch(`/:id(${UUIDv4})/submit`, verifyAuth, submitExpense);
router.patch(`/:id(${UUIDv4})/approve`, verifyAuth, approveExpense);
router.patch(`/:id(${UUIDv4})/post`, verifyAuth, postExpense);
router.patch(`/:id(${UUIDv4})/void`, verifyAuth, voidExpense);
router.patch(`/:id(${UUIDv4})/cancel`, verifyAuth, cancelExpense);

// 🔥 Enterprise
router.patch(`/:id(${UUIDv4})/reverse`, verifyAuth, reverseExpense);
router.patch(`/:id(${UUIDv4})/restore`, verifyAuth, restoreExpense);

/* ============================================================ */
export default router;