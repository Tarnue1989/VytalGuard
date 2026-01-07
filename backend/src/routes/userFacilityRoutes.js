// 📁 backend/src/routes/userFacilityRoutes.js
import { Router } from "express";
import {
  getAllUserFacilities,
  getUserFacilityById,
  getUserFacilitiesLite,
  createUserFacility,
  updateUserFacility,
  deleteUserFacility,
  toggleUserFacilityStatus,
} from "../controllers/userFacilityController.js";
import { verifyAuth } from "../middleware/verifyAuth.js";


const router = Router();

// 🆔 UUID regex for safe :id routes
const UUIDv4 =
  "[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}";

/* ============================================================
   📌 USER–FACILITY ROUTES
   ============================================================ */

// 🔍 List & Lookup
router.get("/", verifyAuth,  getAllUserFacilities);
router.get("/lite", verifyAuth,  getUserFacilitiesLite);
router.get(`/:id(${UUIDv4})`, verifyAuth,  getUserFacilityById);

// ➕ Create / ✏️ Update / 🗑️ Delete
router.post("/", verifyAuth,  createUserFacility);
router.put(`/:id(${UUIDv4})`, verifyAuth,  updateUserFacility);
router.delete(`/:id(${UUIDv4})`, verifyAuth,  deleteUserFacility);

// 🔄 Toggle Active/Inactive
router.patch(`/:id(${UUIDv4})/toggle-status`, verifyAuth,  toggleUserFacilityStatus);

/* ============================================================
   ✅ EXPORT
   ============================================================ */
export default router;
