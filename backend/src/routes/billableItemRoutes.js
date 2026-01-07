// 📁 backend/src/routes/billableItemRoutes.js
import { Router } from "express";
import {
  getAllBillableItems,
  getBillableItemById,
  getAllBillableItemsLite,
  createBillableItems,
  updateBillableItem,
  bulkUpdateBillableItems,
  deleteBillableItem,
  bulkDeleteBillableItems,
  restoreBillableItem,
  toggleBillableItemStatus,
  getHistoryByBillableItemId,
} from "../controllers/billableItemController.js";
import { verifyAuth } from "../middleware/verifyAuth.js";


const router = Router();

// 🆔 UUID regex for safe :id routes
const UUIDv4 =
  "[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}";

/* ============================================================
   📌 BILLABLE ITEM ROUTES
   ============================================================ */

// 🔍 List & Lookup
router.get("/", verifyAuth,  getAllBillableItems);
router.get("/lite", verifyAuth,  getAllBillableItemsLite);
router.get("/lite/list", verifyAuth,  getAllBillableItemsLite);
router.get(`/:id(${UUIDv4})`, verifyAuth,  getBillableItemById);

// 📜 History
router.get(`/:id(${UUIDv4})/history`, verifyAuth,  getHistoryByBillableItemId);

/* ============================================================
   📌 BULK OPERATIONS
   ============================================================ */
router.put("/bulk", verifyAuth,  bulkUpdateBillableItems);
router.delete("/bulk", verifyAuth,  bulkDeleteBillableItems);

/* ============================================================
   📌 LIFECYCLE ACTIONS
   ============================================================ */
router.patch(`/:id(${UUIDv4})/toggle-status`, verifyAuth,  toggleBillableItemStatus);
router.patch(`/:id(${UUIDv4})/restore`, verifyAuth,  restoreBillableItem);

/* ============================================================
   📌 CRUD ROUTES
   ============================================================ */
router.post("/", verifyAuth,  createBillableItems);
router.put(`/:id(${UUIDv4})`, verifyAuth,  updateBillableItem);
router.delete(`/:id(${UUIDv4})`, verifyAuth,  deleteBillableItem);

/* ============================================================
   ✅ EXPORT
   ============================================================ */
export default router;
