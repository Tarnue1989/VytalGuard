// 📁 backend/src/routes/newbornRecordRoutes.js
import { Router } from "express";
import {
  getAllNewbornRecords,
  getAllNewbornRecordsLite,
  getNewbornRecordById,
  createNewbornRecord,
  updateNewbornRecord,
  deleteNewbornRecord,
  markDeceasedNewbornRecord,
  transferNewbornRecord,
  voidNewbornRecord,
} from "../controllers/newbornRecordController.js";
import { verifyAuth } from "../middleware/verifyAuth.js";


const router = Router();

// 🆔 UUID regex for safe :id routes
const UUIDv4 =
  "[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}";

/* ============================================================
   📌 NEWBORN RECORD ROUTES
   ============================================================ */

// 🔍 List & Lookup
router.get("/", verifyAuth,  getAllNewbornRecords);
router.get("/lite", verifyAuth,  getAllNewbornRecordsLite);
router.get(`/:id(${UUIDv4})`, verifyAuth,  getNewbornRecordById);

// ➕ Create / ✏️ Update / 🗑️ Delete
router.post("/", verifyAuth,  createNewbornRecord);
router.put(`/:id(${UUIDv4})`, verifyAuth,  updateNewbornRecord);
router.delete(`/:id(${UUIDv4})`, verifyAuth,  deleteNewbornRecord);

// ⚰️ Lifecycle & Administrative Actions
router.patch(`/:id(${UUIDv4})/deceased`, verifyAuth,  markDeceasedNewbornRecord);
router.patch(`/:id(${UUIDv4})/transfer`, verifyAuth,  transferNewbornRecord);
router.patch(`/:id(${UUIDv4})/void`, verifyAuth,  voidNewbornRecord);

/* ============================================================
   ✅ EXPORT
   ============================================================ */
export default router;
