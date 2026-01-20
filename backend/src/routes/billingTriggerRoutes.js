import { Router } from "express";
import {
  getAllBillingTriggers,
  getBillingTriggerById,        // ✅ ADD THIS
  createBillingTrigger,
  updateBillingTrigger,
  deleteBillingTrigger,
  toggleBillingTrigger,
} from "../controllers/billingTriggerController.js";
import { verifyAuth } from "../middleware/verifyAuth.js";

const router = Router();

// 🆔 UUID regex for safe :id routes
const UUIDv4 =
  "[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}";

/* ============================================================
   📌 BILLING TRIGGER ROUTES
============================================================ */

// 🔍 List
router.get("/", verifyAuth, getAllBillingTriggers);

// 🔎 Get by ID (EDIT / VIEW)
router.get(`/:id(${UUIDv4})`, verifyAuth, getBillingTriggerById);

// ➕ Create
router.post("/", verifyAuth, createBillingTrigger);

// ✏️ Update
router.put(`/:id(${UUIDv4})`, verifyAuth, updateBillingTrigger);

// 🔄 Toggle active/inactive
router.patch(
  `/:id(${UUIDv4})/toggle`,
  verifyAuth,
  toggleBillingTrigger
);

// 🗑️ Delete
router.delete(`/:id(${UUIDv4})`, verifyAuth, deleteBillingTrigger);

/* ============================================================
   ✅ EXPORT
============================================================ */
export default router;
