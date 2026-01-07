// 📁 backend/src/routes/organizationRoutes.js
import { Router } from "express";
import {
  getAllOrganizations,
  getOrganizationById,
  getAllOrganizationsLite,
  createOrganization,
  updateOrganization,
  deleteOrganization,
  toggleOrganizationStatus,
} from "../controllers/organizationController.js";
import { verifyAuth } from "../middleware/verifyAuth.js";

const router = Router();

// 🆔 UUID regex for safe :id routes
const UUIDv4 =
  "[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}";

/* ============================================================
   📌 ORGANIZATION ROUTES
   ============================================================ */

// ⚡ Lite endpoints (dropdowns / autocomplete)
router.get("/lite", verifyAuth, getAllOrganizationsLite);
router.get("/lite/list", verifyAuth, getAllOrganizationsLite);

// 🔍 Full list (with filters)
router.get("/", verifyAuth, getAllOrganizations);

// 🔍 Single organization by ID
router.get(`/:id(${UUIDv4})`, verifyAuth, getOrganizationById);

// ➕ Create
router.post("/", verifyAuth, createOrganization);

// ✏️ Update
router.put(`/:id(${UUIDv4})`, verifyAuth, updateOrganization);

// 🗑️ Delete
router.delete(`/:id(${UUIDv4})`, verifyAuth, deleteOrganization);

// 🔄 Toggle status (activate/deactivate)
router.patch(`/:id(${UUIDv4})/toggle-status`, verifyAuth, toggleOrganizationStatus);

/* ============================================================
   ✅ EXPORT
   ============================================================ */
export default router;
