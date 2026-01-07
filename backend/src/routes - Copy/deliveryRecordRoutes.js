// 📁 backend/src/routes/deliveryRecordRoutes.js
import { Router } from "express";
import {
  getAllDeliveryRecords,
  getDeliveryRecordById,
  createDeliveryRecord,
  updateDeliveryRecord,
  deleteDeliveryRecord,
  startDeliveryRecord,
  completeDeliveryRecord,
  cancelDeliveryRecord,
  voidDeliveryRecord,
  verifyDeliveryRecord,
  finalizeDeliveryRecord,
} from "../controllers/deliveryRecordController.js";
import { verifyAuth } from "../middleware/verifyAuth.js";


const router = Router();

// 🆔 UUID regex for safe :id routes
const UUIDv4 =
  "[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}";

/* ============================================================
   📌 DELIVERY RECORD ROUTES
   ============================================================ */

// 🔍 List & Single
router.get("/", verifyAuth,  getAllDeliveryRecords);
router.get(`/:id(${UUIDv4})`, verifyAuth,  getDeliveryRecordById);

// ➕ Create / ✏️ Update / 🗑️ Delete
router.post("/", verifyAuth,  createDeliveryRecord);
router.put(`/:id(${UUIDv4})`, verifyAuth,  updateDeliveryRecord);
router.delete(`/:id(${UUIDv4})`, verifyAuth,  deleteDeliveryRecord);

/* ============================================================
   📌 LIFECYCLE ROUTES
   ============================================================ */
router.patch(`/:id(${UUIDv4})/start`, verifyAuth,  startDeliveryRecord);
router.patch(`/:id(${UUIDv4})/complete`, verifyAuth,  completeDeliveryRecord);
router.patch(`/:id(${UUIDv4})/cancel`, verifyAuth,  cancelDeliveryRecord);
router.patch(`/:id(${UUIDv4})/void`, verifyAuth,  voidDeliveryRecord);
router.patch(`/:id(${UUIDv4})/verify`, verifyAuth,  verifyDeliveryRecord);
router.patch(`/:id(${UUIDv4})/finalize`, verifyAuth,  finalizeDeliveryRecord);

/* ============================================================
   ✅ EXPORT
   ============================================================ */
export default router;
