import { Router } from "express";
import {
  getAllExpenses,
  getExpenseById,
  createExpense,
  deleteExpense,
} from "../controllers/expenseController.js";
import { verifyAuth } from "../middleware/verifyAuth.js";

const router = Router();

const UUID =
  "[0-9a-fA-F-]{36}";

router.get("/", verifyAuth, getAllExpenses);
router.get(`/:id(${UUID})`, verifyAuth, getExpenseById);

router.post("/", verifyAuth, createExpense);
router.delete(`/:id(${UUID})`, verifyAuth, deleteExpense);

export default router;