// 📁 backend/src/routes/roleRoutes.js
import { Router } from "express";
import {
  getAllRoles,
  getRoleById,
  getAllRolesLite,
  createRole,
  updateRole,
  deleteRole,
  toggleRoleStatus,
} from "../controllers/roleController.js";
import { verifyAuth } from "../middleware/verifyAuth.js";


const router = Router();

// 🆔 UUID regex for safe :id routes
const UUIDv4 =
  "[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}";

/* ============================================================
   📌 ROLE ROUTES
   ============================================================ */

// 🔍 List & Lookup
router.get("/", verifyAuth,  getAllRoles);
router.get("/lite/list", verifyAuth,  getAllRolesLite);
router.get(`/:id(${UUIDv4})`, verifyAuth,  getRoleById);

// ➕ Create / ✏️ Update / 🗑️ Delete
router.post("/", verifyAuth,  createRole);
router.put(`/:id(${UUIDv4})`, verifyAuth,  updateRole);
router.delete(`/:id(${UUIDv4})`, verifyAuth,  deleteRole);

// 🔄 Toggle active/inactive
router.patch(`/:id(${UUIDv4})/toggle-status`, verifyAuth,  toggleRoleStatus);

/* ============================================================
   ✅ EXPORT
   ============================================================ */
export default router;
