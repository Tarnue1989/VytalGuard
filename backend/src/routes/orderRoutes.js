// 📁 backend/src/routes/orderRoutes.js
// ============================================================================
// 🧾 Order Routes — ENTERPRISE MASTER–ALIGNED
// ----------------------------------------------------------------------------
// 🔹 Explicit lifecycle routes (NO toggle-status)
// 🔹 Bulk + single supported via controller logic
// 🔹 Lite + Full list routes included
// 🔹 UUID-safe
// ============================================================================

import { Router } from "express";
import { verifyAuth } from "../middleware/verifyAuth.js";

import {
  // 📋 READ
  getAllOrders,
  getOrderById,
  getAllOrdersLite,
  getAllOrderItemsLite,

  // ✏️ WRITE
  createOrders,
  updateOrder,
  deleteOrders,

  // 🔄 LIFECYCLE
  submitOrders,
  activateOrders,
  completeOrders,
  cancelOrders,
  voidOrders,
  verifyOrders,
} from "../controllers/orderController.js";

const router = Router();

/* ============================================================
   🆔 UUID v4 REGEX (SAFE ROUTES)
============================================================ */
const UUIDv4 =
  "[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}";

/* ============================================================
   📋 READ ROUTES
============================================================ */

// 🔍 Full list (filters + pagination)
router.get("/", verifyAuth, getAllOrders);

// 🔎 Single record
router.get(`/:id(${UUIDv4})`, verifyAuth, getOrderById);

// 🔹 Lite lists
router.get("/lite/all", verifyAuth, getAllOrdersLite);
router.get("/lite/items", verifyAuth, getAllOrderItemsLite);

/* ============================================================
   ✏️ WRITE ROUTES
============================================================ */

// ➕ Create (single or bulk)
router.post("/", verifyAuth, createOrders);

// ✏️ Update
router.put(`/:id(${UUIDv4})`, verifyAuth, updateOrder);

// 🗑️ Delete (soft delete, single or bulk)
router.delete(`/:id(${UUIDv4})`, verifyAuth, deleteOrders);

/* ============================================================
   🔄 LIFECYCLE ROUTES (EXPLICIT — MASTER)
============================================================ */

// 📝 Draft → Pending
router.patch(`/:id(${UUIDv4})/submit`, verifyAuth, submitOrders);

// ⏳ Pending → In Progress
router.patch(`/:id(${UUIDv4})/activate`, verifyAuth, activateOrders);

// ✅ In Progress → Completed
router.patch(`/:id(${UUIDv4})/complete`, verifyAuth, completeOrders);

// ❌ Pending / In Progress → Cancelled
router.patch(`/:id(${UUIDv4})/cancel`, verifyAuth, cancelOrders);

// 🚫 Any → Voided (Admin only)
router.patch(`/:id(${UUIDv4})/void`, verifyAuth, voidOrders);

// ✔ Completed → Verified (Admin only)
router.patch(`/:id(${UUIDv4})/verify`, verifyAuth, verifyOrders);

/* ============================================================
   ✅ EXPORT
============================================================ */
export default router;