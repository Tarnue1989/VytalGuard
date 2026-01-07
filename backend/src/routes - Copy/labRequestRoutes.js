// 📁 backend/src/routes/labRequestRoutes.js
import { Router } from "express";
import {
  getAllLabRequests,
  getLabRequestById,
  createLabRequests,
  updateLabRequest,
  deleteLabRequests,
  toggleLabRequestStatus,
  submitLabRequests,
  activateLabRequests,
  completeLabRequests,
  cancelLabRequests,
  voidLabRequests,
  verifyLabRequests,
} from "../controllers/labRequestController.js";
import { verifyAuth } from "../middleware/verifyAuth.js";


const router = Router();

// 🆔 UUID regex for safe :id routes
const UUIDv4 =
  "[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}";

/* ============================================================
   📌 LAB REQUEST ROUTES
   ============================================================ */

// 🔍 List & Single
router.get("/", verifyAuth,  getAllLabRequests);
router.get(`/:id(${UUIDv4})`, verifyAuth,  getLabRequestById);

// ➕ Create / ✏️ Update / 🗑️ Delete
router.post("/", verifyAuth,  createLabRequests);
router.put(`/:id(${UUIDv4})`, verifyAuth,  updateLabRequest);
router.delete(`/:id(${UUIDv4})`, verifyAuth,  deleteLabRequests);

// 🔄 Toggle status
router.patch(`/:id(${UUIDv4})/toggle-status`, verifyAuth,  toggleLabRequestStatus);

/* ============================================================
   📌 LIFECYCLE ROUTES
   ============================================================ */
router.patch(`/:id(${UUIDv4})/submit`, verifyAuth,  submitLabRequests);
router.patch(`/:id(${UUIDv4})/activate`, verifyAuth,  activateLabRequests);
router.patch(`/:id(${UUIDv4})/complete`, verifyAuth,  completeLabRequests);
router.patch(`/:id(${UUIDv4})/cancel`, verifyAuth,  cancelLabRequests);
router.patch(`/:id(${UUIDv4})/void`, verifyAuth,  voidLabRequests);
router.patch(`/:id(${UUIDv4})/verify`, verifyAuth,  verifyLabRequests);

/* ============================================================
   ✅ EXPORT
   ============================================================ */
export default router;
