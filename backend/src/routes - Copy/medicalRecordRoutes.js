// 📁 backend/src/routes/medicalRecordRoutes.js
import { Router } from "express";
import {
  getAllMedicalRecords,
  getAllMedicalRecordsLite,
  getMedicalRecordById,
  createMedicalRecord,
  updateMedicalRecord,
  deleteMedicalRecord,
  restoreMedicalRecord,
  reviewMedicalRecord,
  finalizeMedicalRecord,
  verifyMedicalRecord,
  voidMedicalRecord,
} from "../controllers/medicalRecordController.js";
import { verifyAuth } from "../middleware/verifyAuth.js";

import { uploadMedicalRecord } from "../middleware/upload.js";

const router = Router();

// 🆔 UUID regex for safe :id routes
const UUIDv4 =
  "[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}";

/* ============================================================
   📌 MEDICAL RECORD ROUTES
   ============================================================ */

// 🔍 List & Lookup
router.get("/", verifyAuth,  getAllMedicalRecords);
router.get("/lite", verifyAuth,  getAllMedicalRecordsLite);
router.get(`/:id(${UUIDv4})`, verifyAuth,  getMedicalRecordById);

// ➕ Create / ✏️ Update
router.post("/", verifyAuth,  uploadMedicalRecord, createMedicalRecord);
router.put(`/:id(${UUIDv4})`, verifyAuth,  uploadMedicalRecord, updateMedicalRecord);

// 🗑️ Delete / ♻️ Restore
router.delete(`/:id(${UUIDv4})`, verifyAuth,  deleteMedicalRecord);
router.patch(`/:id(${UUIDv4})/restore`, verifyAuth,  restoreMedicalRecord);

// 🔄 Lifecycle Actions
router.patch(`/:id(${UUIDv4})/review`, verifyAuth,  reviewMedicalRecord);
router.patch(`/:id(${UUIDv4})/finalize`, verifyAuth,  finalizeMedicalRecord);
router.patch(`/:id(${UUIDv4})/verify`, verifyAuth,  verifyMedicalRecord);
router.patch(`/:id(${UUIDv4})/void`, verifyAuth,  voidMedicalRecord);

/* ============================================================
   ✅ EXPORT
   ============================================================ */
export default router;
