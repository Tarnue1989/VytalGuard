// 📁 backend/src/routes/masterItemCategoryRoutes.js
import { Router } from "express";
import {
  getAllCategories,
  getCategoryById,
  getAllCategoriesLite,
  createCategory,
  updateCategory,
  deleteCategory,
  toggleCategoryStatus,
} from "../controllers/masterItemCategoryController.js";
import { verifyAuth } from "../middleware/verifyAuth.js";


const router = Router();

// 🆔 UUID regex for safe :id routes
const UUIDv4 =
  "[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}";

/* ============================================================
   📌 MASTER ITEM CATEGORY ROUTES
   ============================================================ */

// 🔍 List & Lookup
router.get("/", verifyAuth,  getAllCategories);
router.get("/lite", verifyAuth,  getAllCategoriesLite);
router.get("/lite/list", verifyAuth,  getAllCategoriesLite);
router.get(`/:id(${UUIDv4})`, verifyAuth,  getCategoryById);

// ➕ Create / ✏️ Update / 🗑️ Delete
router.post("/", verifyAuth,  createCategory);
router.put(`/:id(${UUIDv4})`, verifyAuth,  updateCategory);
router.delete(`/:id(${UUIDv4})`, verifyAuth,  deleteCategory);

// 🔄 Toggle status (active ↔ inactive)
router.patch(`/:id(${UUIDv4})/toggle-status`, verifyAuth,  toggleCategoryStatus);

/* ============================================================
   ✅ EXPORT
   ============================================================ */
export default router;
