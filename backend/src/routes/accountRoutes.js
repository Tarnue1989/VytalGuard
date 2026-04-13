import { Router } from "express";
import {
  getAllAccounts,
  getAccountById,
  createAccount,
  updateAccount,
  deleteAccount,
} from "../controllers/accountController.js";
import { verifyAuth } from "../middleware/verifyAuth.js";

const router = Router();

const UUID =
  "[0-9a-fA-F-]{36}";

router.get("/", verifyAuth, getAllAccounts);
router.get(`/:id(${UUID})`, verifyAuth, getAccountById);

router.post("/", verifyAuth, createAccount);
router.put(`/:id(${UUID})`, verifyAuth, updateAccount);
router.delete(`/:id(${UUID})`, verifyAuth, deleteAccount);

export default router;