// 📁 backend/src/routes/employeeRoutes.js
import { Router } from "express";
import {
  getAllEmployees,
  getEmployeeById,
  createEmployee,
  updateEmployee,
  deleteEmployee,
  toggleEmployeeStatus,
  getAllEmployeesLite,
  getAllEmployeesLiteWithEmail,
} from "../controllers/employeeController.js";
import { verifyAuth } from "../middleware/verifyAuth.js";

import { uploadEmployee } from "../middleware/upload.js";

const router = Router();

/* ============================================================
   📌 EMPLOYEE ROUTES
   ============================================================ */

// ⚡ Lite endpoints (must come BEFORE /:id)
router.get("/lite/list", verifyAuth,  getAllEmployeesLite);
router.get("/lite/list-with-email", verifyAuth,  getAllEmployeesLiteWithEmail);

// 🔍 Full list (with filters + pagination)
router.get("/", verifyAuth,  getAllEmployees);

// 🔍 Single by ID
router.get("/:id", verifyAuth,  getEmployeeById);

// ➕ Create (with file upload)
router.post("/", verifyAuth,  uploadEmployee, createEmployee);

// ✏️ Update (with file upload)
router.put("/:id", verifyAuth,  uploadEmployee, updateEmployee);

// 🗑️ Delete (soft)
router.delete("/:id", verifyAuth,  deleteEmployee);

// 🔄 Toggle status
router.patch("/:id/toggle-status", verifyAuth,  toggleEmployeeStatus);

/* ============================================================
   ✅ EXPORT
   ============================================================ */
export default router;
