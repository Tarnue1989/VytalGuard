// 📁 backend/src/routes/triageRecordRoutes.js
import { Router } from "express";
import {
  getAllTriageRecords,
  getTriageRecordById,
  getAllTriageRecordsLite,
  createTriageRecord,
  updateTriageRecord,
  deleteTriageRecord,
  startTriageRecord,
  completeTriageRecord,
  verifyTriageRecord,
  cancelTriageRecord,
  voidTriageRecord,
} from "../controllers/triageRecordController.js";
import { verifyAuth } from "../middleware/verifyAuth.js";


const router = Router();

// 🆔 UUID regex for safe :id routes
const UUIDv4 =
  "[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}";

/* ============================================================
   📌 TRIAGE RECORD ROUTES
   ============================================================ */

// 🔍 List & Lookup
router.get("/", verifyAuth,  getAllTriageRecords);
router.get("/lite", verifyAuth,  getAllTriageRecordsLite);
router.get(`/:id(${UUIDv4})`, verifyAuth,  getTriageRecordById);

// ➕ Create / ✏️ Update / 🗑️ Delete
router.post("/", verifyAuth,  createTriageRecord);
router.put(`/:id(${UUIDv4})`, verifyAuth,  updateTriageRecord);
router.delete(`/:id(${UUIDv4})`, verifyAuth,  deleteTriageRecord);

/* ============================================================
   📌 LIFECYCLE ROUTES
   ============================================================ */
router.patch(`/:id(${UUIDv4})/start`, verifyAuth,  startTriageRecord);
router.patch(`/:id(${UUIDv4})/complete`, verifyAuth,  completeTriageRecord);
router.patch(`/:id(${UUIDv4})/verify`, verifyAuth,  verifyTriageRecord);
router.patch(`/:id(${UUIDv4})/cancel`, verifyAuth,  cancelTriageRecord);
router.patch(`/:id(${UUIDv4})/void`, verifyAuth,  voidTriageRecord);

/* ============================================================
   ✅ EXPORT
   ============================================================ */
export default router;
