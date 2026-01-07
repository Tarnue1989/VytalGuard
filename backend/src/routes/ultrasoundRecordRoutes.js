// 📁 backend/src/routes/ultrasoundRecordRoutes.js
import { Router } from "express";
import {
  getAllUltrasounds,
  getAllUltrasoundsLite,
  getUltrasoundById,
  createUltrasoundRecord,
  updateUltrasoundRecord,
  deleteUltrasound,
  startUltrasound,
  completeUltrasound,
  cancelUltrasound,
  voidUltrasound,
  verifyUltrasound,
  finalizeUltrasound,
} from "../controllers/ultrasoundRecordController.js";
import { verifyAuth } from "../middleware/verifyAuth.js";

import { uploadUltrasound } from "../middleware/upload.js";

const router = Router();

// 🆔 UUID regex for safe :id routes
const UUIDv4 =
  "[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}";

/* ============================================================
   📌 ULTRASOUND RECORD ROUTES
   ============================================================ */

// 🔍 List & Lookup
router.get("/", verifyAuth,  getAllUltrasounds);
router.get("/lite", verifyAuth,  getAllUltrasoundsLite);
router.get(`/:id(${UUIDv4})`, verifyAuth,  getUltrasoundById);

// ➕ Create / ✏️ Update / 🗑️ Delete
router.post("/", verifyAuth,  uploadUltrasound, createUltrasoundRecord);
router.put(`/:id(${UUIDv4})`, verifyAuth,  uploadUltrasound, updateUltrasoundRecord);
router.delete(`/:id(${UUIDv4})`, verifyAuth,  deleteUltrasound);

/* ============================================================
   📌 LIFECYCLE ROUTES
   ============================================================ */
router.patch(`/:id(${UUIDv4})/start`, verifyAuth,  startUltrasound);
router.patch(`/:id(${UUIDv4})/complete`, verifyAuth,  completeUltrasound);
router.patch(`/:id(${UUIDv4})/cancel`, verifyAuth,  cancelUltrasound);
router.patch(`/:id(${UUIDv4})/void`, verifyAuth,  voidUltrasound);
router.patch(`/:id(${UUIDv4})/verify`, verifyAuth,  verifyUltrasound);
router.patch(`/:id(${UUIDv4})/finalize`, verifyAuth,  finalizeUltrasound);

/* ============================================================
   ✅ EXPORT
   ============================================================ */
export default router;
