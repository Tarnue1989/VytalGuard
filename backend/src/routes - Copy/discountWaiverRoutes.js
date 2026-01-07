// 📁 backend/src/routes/discountWaiverRoutes.js
// ============================================================================
// 🧾 Discount Waiver Routes – Enterprise Master Pattern (v2.5 Aligned)
// ----------------------------------------------------------------------------
// 🔹 Mirrors discountRoutes.js for unified lifecycle & tenant-safe design
// 🔹 Supports approve / reject / void / finalize / restore
// 🔹 Includes lite route for autocomplete dropdowns
// ============================================================================

import { Router } from "express";
import {
  getAllWaivers,
  getWaiverById,
  getAllWaiversLite,
  createWaiver,
  updateWaiver,
  approveWaiver,
  rejectWaiver,
  voidWaiver,
  finalizeWaiver,
  deleteWaiver,
  restoreWaiver,
  // applyWaiver, // (optional future addition)
} from "../controllers/discountWaiverController.js";
import { verifyAuth } from "../middleware/verifyAuth.js";


const router = Router();

// 🆔 UUID regex for safe :id routes
const UUIDv4 =
  "[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}";

/* ============================================================
   📌 DISCOUNT WAIVER ROUTES
   ============================================================ */

// 🔍 List & Lookup
router.get("/", verifyAuth,  getAllWaivers);
router.get("/lite", verifyAuth,  getAllWaiversLite);
router.get(`/:id(${UUIDv4})`, verifyAuth,  getWaiverById);

// ➕ Create / ✏️ Update
router.post("/", verifyAuth,  createWaiver);
router.put(`/:id(${UUIDv4})`, verifyAuth,  updateWaiver);

// 🔄 Lifecycle Actions
router.patch(`/:id(${UUIDv4})/approve`, verifyAuth,  approveWaiver);
router.patch(`/:id(${UUIDv4})/reject`, verifyAuth,  rejectWaiver);
router.patch(`/:id(${UUIDv4})/void`, verifyAuth,  voidWaiver);
router.patch(`/:id(${UUIDv4})/finalize`, verifyAuth,  finalizeWaiver);
// router.patch(`/:id(${UUIDv4})/apply`, verifyAuth,  applyWaiver); // optional

// 🗑️ Delete (soft)
router.delete(`/:id(${UUIDv4})`, verifyAuth,  deleteWaiver);

// 🔁 Restore
router.patch(`/:id(${UUIDv4})/restore`, verifyAuth,  restoreWaiver);

/* ============================================================
   ✅ EXPORT
   ============================================================ */
export default router;
