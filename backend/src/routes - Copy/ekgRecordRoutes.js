// 📁 backend/src/routes/ekgRecordRoutes.js
import { Router } from "express";
import {
  getAllEKGRecords,
  getAllEKGRecordsLite,
  getEKGRecordById,
  createEKGRecord,
  updateEKGRecord,
  deleteEKGRecord,
  startEKGRecord,       // ✅ NEW: added import
  completeEKGRecord,
  cancelEKGRecord,
  voidEKGRecord,
  verifyEKGRecord,
  finalizeEKGRecord,
} from "../controllers/ekgRecordController.js";
import { verifyAuth } from "../middleware/verifyAuth.js";

import { uploadEKG } from "../middleware/upload.js";

const router = Router();

// 🆔 UUID regex for safe :id routes
const UUIDv4 =
  "[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}";

/* ============================================================
   📌 EKG RECORD ROUTES
============================================================ */

// 🔍 List & Lookup
router.get("/lite", verifyAuth,  getAllEKGRecordsLite);
router.get("/lite/list", verifyAuth,  getAllEKGRecordsLite);
router.get("/", verifyAuth,  getAllEKGRecords);
router.get(`/:id(${UUIDv4})`, verifyAuth,  getEKGRecordById);

// ➕ Create / ✏️ Update / 🗑️ Delete
router.post("/", verifyAuth,  uploadEKG, createEKGRecord);
router.put(`/:id(${UUIDv4})`, verifyAuth,  uploadEKG, updateEKGRecord);
router.delete(`/:id(${UUIDv4})`, verifyAuth,  deleteEKGRecord);

// 🔄 Lifecycle & Verification
router.patch(`/:id(${UUIDv4})/start`, verifyAuth,  startEKGRecord);      // ✅ NEW
router.patch(`/:id(${UUIDv4})/complete`, verifyAuth,  completeEKGRecord);
router.patch(`/:id(${UUIDv4})/verify`, verifyAuth,  verifyEKGRecord);
router.patch(`/:id(${UUIDv4})/finalize`, verifyAuth,  finalizeEKGRecord);
router.patch(`/:id(${UUIDv4})/cancel`, verifyAuth,  cancelEKGRecord);
router.patch(`/:id(${UUIDv4})/void`, verifyAuth,  voidEKGRecord);

/* ============================================================
   ✅ EXPORT
============================================================ */
export default router;
