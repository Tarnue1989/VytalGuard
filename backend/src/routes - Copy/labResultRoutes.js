// 📁 backend/src/routes/labResultRoutes.js
// ============================================================
// 💉 Lab Result Routes – Enterprise Aligned (Consultation Master Pattern)
// Handles all lifecycle transitions and secure facility scoping
// ============================================================

import { Router } from "express";
import {
  getAllLabResults,
  getLabResultById,
  createLabResults, // ✅ plural for bulk/single creation
  updateLabResult,
  deleteLabResult,
  toggleLabResultStatus,
  submitLabResult,
  startLabResult,       // ✅ added (Pending → In Progress)
  completeLabResult,
  reviewLabResult,
  verifyLabResult,
  cancelLabResult,
  voidLabResult,
} from "../controllers/labResultController.js";
import { verifyAuth } from "../middleware/verifyAuth.js";

import { uploadLabResult } from "../middleware/upload.js";

const router = Router();

// 🆔 UUID regex for safe :id routes
const UUIDv4 =
  "[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}";

/* ============================================================
   📌 LAB RESULT ROUTES
============================================================ */

// 🔍 Full list
router.get("/", verifyAuth,  getAllLabResults);

// 🔍 Single by ID
router.get(`/:id(${UUIDv4})`, verifyAuth,  getLabResultById);

// ➕ Create (bulk or single, with file upload)
router.post("/", verifyAuth,  uploadLabResult, createLabResults);

// ✏️ Update (with file upload)
router.put(`/:id(${UUIDv4})`, verifyAuth,  uploadLabResult, updateLabResult);

// 🗑️ Delete
router.delete(`/:id(${UUIDv4})`, verifyAuth,  deleteLabResult);

// 🔄 Toggle status
router.patch(`/:id(${UUIDv4})/toggle-status`, verifyAuth,  toggleLabResultStatus);

/* ============================================================
   📌 LIFECYCLE ROUTES
============================================================ */

// Draft → Pending
router.patch(`/:id(${UUIDv4})/submit`, verifyAuth,  submitLabResult);

// Pending → In Progress
router.patch(`/:id(${UUIDv4})/start`, verifyAuth,  startLabResult); // ✅ new route

// In Progress → Completed
router.patch(`/:id(${UUIDv4})/complete`, verifyAuth,  completeLabResult);

// Completed → Reviewed
router.patch(`/:id(${UUIDv4})/review`, verifyAuth,  reviewLabResult);

// Reviewed → Verified (restricted)
router.patch(`/:id(${UUIDv4})/verify`, verifyAuth,  verifyLabResult);

// Pending/Completed → Cancelled
router.patch(`/:id(${UUIDv4})/cancel`, verifyAuth,  cancelLabResult);

// Any → Voided (restricted)
router.patch(`/:id(${UUIDv4})/void`, verifyAuth,  voidLabResult);

/* ============================================================
   ✅ EXPORT
============================================================ */
export default router;
