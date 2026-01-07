// 📁 backend/src/routes/centralStockRoutes.js
import { Router } from "express";
import {
  getAllStocks,
  getStockById,
  getAllStocksLite,
  createStock,
  updateStock,
  bulkUpdateStocks,
  deleteStock,
  bulkDeleteStocks,
  restoreStock,
  bulkRestoreStocks,
  toggleStockStatus,
  bulkToggleStockStatus,
  lockStock,
  unlockStock,
} from "../controllers/centralStockController.js";
import { verifyAuth } from "../middleware/verifyAuth.js";


const router = Router();

// 🆔 UUID regex for safe :id routes
const UUIDv4 =
  "[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}";

/* ============================================================
   📌 CENTRAL STOCK ROUTES
   ============================================================ */

// 🔍 List & Lookup
router.get("/", verifyAuth,  getAllStocks);
router.get("/lite", verifyAuth,  getAllStocksLite);
router.get("/lite/list", verifyAuth,  getAllStocksLite);

// 🔄 Bulk Operations
router.put("/bulk", verifyAuth,  bulkUpdateStocks);
router.patch("/bulk/toggle-status", verifyAuth,  bulkToggleStockStatus);
router.delete("/bulk", verifyAuth,  bulkDeleteStocks);
router.patch("/bulk/restore", verifyAuth,  bulkRestoreStocks);

// 🔄 Lifecycle / State Actions
router.patch(`/:id(${UUIDv4})/toggle-status`, verifyAuth,  toggleStockStatus);
router.patch(`/:id(${UUIDv4})/restore`, verifyAuth,  restoreStock);

// 🔒 Lock / Unlock Controls
router.post(`/:id(${UUIDv4})/lock`, verifyAuth,  lockStock);
router.post(`/:id(${UUIDv4})/unlock`, verifyAuth,  unlockStock);

// 🧾 Single Item CRUD
router.get(`/:id(${UUIDv4})`, verifyAuth,  getStockById);
router.post("/", verifyAuth,  createStock);
router.put(`/:id(${UUIDv4})`, verifyAuth,  updateStock);
router.delete(`/:id(${UUIDv4})`, verifyAuth,  deleteStock);

/* ============================================================
   ✅ EXPORT
   ============================================================ */
export default router;
