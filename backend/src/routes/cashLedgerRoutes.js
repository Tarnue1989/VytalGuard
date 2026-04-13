import { Router } from "express";
import {
  getAllLedgerEntries,
  getLedgerEntryById,
} from "../controllers/cashLedgerController.js";
import { verifyAuth } from "../middleware/verifyAuth.js";

const router = Router();

const UUID =
  "[0-9a-fA-F-]{36}";

router.get("/", verifyAuth, getAllLedgerEntries);
router.get(`/:id(${UUID})`, verifyAuth, getLedgerEntryById);

export default router;