// 📁 backend/src/routes/rolePermissionRoutes.js
import { Router } from "express";
import {
  getAllRolePermissions,
  getRolePermissionById,
  getLiteRolePermissions,
  createRolePermission,
  replaceRolePermissions,
  deleteRolePermission,
} from "../controllers/rolePermissionController.js";
import { verifyAuth } from "../middleware/verifyAuth.js";


const router = Router();

// 🆔 UUID regex for safe :id routes
const UUIDv4 =
  "[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}";

/* ============================================================
   📌 ROLE PERMISSION ROUTES
   ============================================================ */

// 🔍 List & Lookup
router.get("/", verifyAuth,  getAllRolePermissions);
router.get("/lite", verifyAuth,  getLiteRolePermissions);
router.get(`/:id(${UUIDv4})`, verifyAuth,  getRolePermissionById);

// ➕ Create single / 🔁 Replace all / 🗑️ Delete
router.post("/", verifyAuth,  createRolePermission);
router.put(`/by-role/:role_id(${UUIDv4})`, verifyAuth,  replaceRolePermissions);
router.delete(`/:id(${UUIDv4})`, verifyAuth,  deleteRolePermission);

/* ============================================================
   ✅ EXPORT
   ============================================================ */
export default router;
