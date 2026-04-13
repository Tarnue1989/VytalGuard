import { Router } from "express";
import {
  closeDay,
  getAllClosings,
  getClosingById,
} from "../controllers/cashClosingController.js";
import { verifyAuth } from "../middleware/verifyAuth.js";

const router = Router();

const UUID =
  "[0-9a-fA-F-]{36}";

router.post("/close", verifyAuth, closeDay);

router.get("/", verifyAuth, getAllClosings);
router.get(`/:id(${UUID})`, verifyAuth, getClosingById);

export default router;