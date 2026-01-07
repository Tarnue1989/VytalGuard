// 📁 backend/src/routes/masterItemRoutes.js
import { Router } from "express";
import {
  getAllItems,
  getItemById,
  getAllItemsLite,
  createItem,
  updateItem,
  deleteItem,
  toggleItemStatus,
} from "../controllers/masterItemController.js";
import { verifyAuth } from "../middleware/verifyAuth.js";


const router = Router();

/* ============================================================
   📌 MASTER ITEM ROUTES
   ============================================================ */

// 🔍 Full list (with filters + pagination)
router.get("/", verifyAuth,  getAllItems);

// ⚡ Lite list (autocomplete/dropdown) — before /:id
router.get("/lite/list", verifyAuth,  getAllItemsLite);

// 🔍 Single by ID
router.get("/:id", verifyAuth,  getItemById);

// ➕ Create
router.post("/", verifyAuth,  createItem);

// ✏️ Update
router.put("/:id", verifyAuth,  updateItem);

// 🔄 Toggle status (active/inactive)
router.patch("/:id/toggle-status", verifyAuth,  toggleItemStatus);

// 🗑️ Delete (soft)
router.delete("/:id", verifyAuth,  deleteItem);

/* ============================================================
   ✅ EXPORT
   ============================================================ */
export default router;
