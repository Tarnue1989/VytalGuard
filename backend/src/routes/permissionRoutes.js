// 📁 backend/src/routes/permissionRoutes.js
import { Router } from "express";
import {
  getAllPermissions,
  getPermissionById,
  getLitePermissions,
  getPermissionsByModule,
  createPermission,
  updatePermission,
  deletePermission,
} from "../controllers/permissionController.js";
import { verifyAuth } from "../middleware/verifyAuth.js";

const router = Router();

// 🆔 UUID regex for safe :id routes
const UUIDv4 =
  "[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}";

/* ============================================================
   📌 PERMISSION ROUTES
   ============================================================ */

// 🔍 List & Lookup
router.get("/", verifyAuth, getAllPermissions);
router.get("/lite", verifyAuth, getLitePermissions);
router.get("/by-module", verifyAuth, getPermissionsByModule);
router.get(`/:id(${UUIDv4})`, verifyAuth, getPermissionById);

// ➕ Create / ✏️ Update / 🗑️ Delete
router.post("/", verifyAuth, createPermission);
router.put(`/:id(${UUIDv4})`, verifyAuth, updatePermission);
router.delete(`/:id(${UUIDv4})`, verifyAuth, deletePermission);

/* ============================================================
   ✅ EXPORT
   ============================================================ */
export default router;
