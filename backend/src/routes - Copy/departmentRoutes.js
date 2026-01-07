// 📁 backend/src/routes/departmentRoutes.js
import { Router } from "express";
import {
  getAllDepartments,
  getDepartmentById,
  createDepartment,
  updateDepartment,
  deleteDepartment,
  toggleDepartmentStatus,
  getAllDepartmentsLite,
} from "../controllers/departmentController.js";
import { verifyAuth } from "../middleware/verifyAuth.js";


const router = Router();

// 🆔 UUID regex for safe :id routes
const UUIDv4 =
  "[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}";

/* ============================================================
   📌 DEPARTMENT ROUTES
   ============================================================ */

// 🔍 List & Lookup
router.get("/", verifyAuth,  getAllDepartments);
router.get("/lite", verifyAuth,  getAllDepartmentsLite);
router.get("/lite/list", verifyAuth,  getAllDepartmentsLite);
router.get(`/:id(${UUIDv4})`, verifyAuth,  getDepartmentById);

// ➕ Create / ✏️ Update / 🗑️ Delete
router.post("/", verifyAuth,  createDepartment);
router.put(`/:id(${UUIDv4})`, verifyAuth,  updateDepartment);
router.delete(`/:id(${UUIDv4})`, verifyAuth,  deleteDepartment);

// 🔄 Toggle status (active ↔ inactive)
router.patch(`/:id(${UUIDv4})/toggle-status`, verifyAuth,  toggleDepartmentStatus);

/* ============================================================
   ✅ EXPORT
   ============================================================ */
export default router;
