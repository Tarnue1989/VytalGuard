// 📁 backend/src/routes/facilityRoutes.js
import { Router } from "express";
import {
  getAllFacilities,
  getFacilityById,
  getAllFacilitiesLite,
  createFacility,
  updateFacility,
  deleteFacility,
  toggleFacilityStatus,
} from "../controllers/facilityController.js";
import { verifyAuth } from "../middleware/verifyAuth.js";

const router = Router();

/* ============================================================
   📌 FACILITY ROUTES
   ============================================================ */

// 🔍 Full list (with filters + pagination)
router.get("/", verifyAuth, getAllFacilities);

// ⚡ Lite endpoints (dropdown/autocomplete)
router.get("/lite/list", verifyAuth, getAllFacilitiesLite);
router.get("/lite", verifyAuth, getAllFacilitiesLite);

// 🔍 Single by ID
router.get("/:id", verifyAuth, getFacilityById);

// ➕ Create
router.post("/", verifyAuth, createFacility);

// ✏️ Update
router.put("/:id", verifyAuth, updateFacility);

// 🔄 Toggle status
router.patch("/:id/toggle-status", verifyAuth, toggleFacilityStatus);

// 🗑️ Delete (soft)
router.delete("/:id", verifyAuth, deleteFacility);

/* ============================================================
   ✅ EXPORT
   ============================================================ */
export default router;
