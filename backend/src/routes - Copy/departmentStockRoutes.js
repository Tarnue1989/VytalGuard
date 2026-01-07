// 📁 backend/src/routes/departmentStockRoutes.js
import { Router } from "express";
import {
  getAllDepartmentStocks,
  getDepartmentStockById,
  getAllDepartmentStocksLite,
  createDepartmentStock,
  updateDepartmentStock,
  deleteDepartmentStock,
  toggleDepartmentStockStatus,
  bulkUpdateDepartmentStocks,
  bulkDeleteDepartmentStocks,
  bulkToggleDepartmentStockStatus,
} from "../controllers/departmentStockController.js";
import { verifyAuth } from "../middleware/verifyAuth.js";


const router = Router();

// 🆔 UUID regex for safe :id routes
const UUIDv4 =
  "[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}";

/* ============================================================
   📌 DEPARTMENT STOCK ROUTES
   ============================================================ */

// 🔍 List & Lookup
router.get("/", verifyAuth,  getAllDepartmentStocks);
router.get("/lite", verifyAuth,  getAllDepartmentStocksLite);
router.get("/lite/list", verifyAuth,  getAllDepartmentStocksLite);
router.get(`/:id(${UUIDv4})`, verifyAuth,  getDepartmentStockById);

// 🔄 Bulk Operations
router.put("/bulk", verifyAuth,  bulkUpdateDepartmentStocks);
router.patch("/bulk/toggle-status", verifyAuth,  bulkToggleDepartmentStockStatus);
router.delete("/bulk", verifyAuth,  bulkDeleteDepartmentStocks);

// 🧾 Single CRUD & Lifecycle
router.post("/", verifyAuth,  createDepartmentStock);
router.put(`/:id(${UUIDv4})`, verifyAuth,  updateDepartmentStock);
router.delete(`/:id(${UUIDv4})`, verifyAuth,  deleteDepartmentStock);
router.patch(`/:id(${UUIDv4})/toggle-status`, verifyAuth,  toggleDepartmentStockStatus);

/* ============================================================
   ✅ EXPORT
   ============================================================ */
export default router;
