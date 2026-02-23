// 📁 backend/src/routes/labRequestRoutes.js
// ============================================================================
// 🧪 Lab Request Routes — ENTERPRISE MASTER–ALIGNED
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
  getAllLabRequests,
  getLabRequestById,
  getAllLabRequestsLite,
  getAllLabRequestItemsLite,

  // ✏️ WRITE
  createLabRequests,
  updateLabRequest,
  deleteLabRequests,

  // 🔄 LIFECYCLE
  submitLabRequests,
  activateLabRequests,
  completeLabRequests,
  cancelLabRequests,
  voidLabRequests,
  verifyLabRequests,
} from "../controllers/labRequestController.js";

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
router.get("/", verifyAuth, getAllLabRequests);

// 🔎 Single record
router.get(`/:id(${UUIDv4})`, verifyAuth, getLabRequestById);

// 🔹 Lite lists
router.get("/lite/all", verifyAuth, getAllLabRequestsLite);
router.get("/lite/items", verifyAuth, getAllLabRequestItemsLite);

/* ============================================================
   ✏️ WRITE ROUTES
============================================================ */

// ➕ Create (single or bulk)
router.post("/", verifyAuth, createLabRequests);

// ✏️ Update
router.put(`/:id(${UUIDv4})`, verifyAuth, updateLabRequest);

// 🗑️ Delete (soft delete, single or bulk)
router.delete(`/:id(${UUIDv4})`, verifyAuth, deleteLabRequests);

/* ============================================================
   🔄 LIFECYCLE ROUTES (EXPLICIT — MASTER)
============================================================ */

// 📝 Draft → Pending
router.patch(`/:id(${UUIDv4})/submit`, verifyAuth, submitLabRequests);

// ⏳ Pending → In Progress
router.patch(`/:id(${UUIDv4})/activate`, verifyAuth, activateLabRequests);

// ✅ In Progress → Completed
router.patch(`/:id(${UUIDv4})/complete`, verifyAuth, completeLabRequests);

// ❌ Pending / In Progress → Cancelled
router.patch(`/:id(${UUIDv4})/cancel`, verifyAuth, cancelLabRequests);

// 🚫 Any → Voided (Admin only)
router.patch(`/:id(${UUIDv4})/void`, verifyAuth, voidLabRequests);

// ✔ Completed → Verified (Admin only)
router.patch(`/:id(${UUIDv4})/verify`, verifyAuth, verifyLabRequests);

/* ============================================================
   ✅ EXPORT
============================================================ */
export default router;
