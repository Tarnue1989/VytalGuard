// 📁 backend/src/routes/consultationRoutes.js
import { Router } from "express";
import {
  getAllConsultations,
  getConsultationById,
  createConsultation,
  updateConsultation,
  deleteConsultation,
  startConsultation,
  completeConsultation,
  verifyConsultation,
  cancelConsultation,
  voidConsultation,
  getAllConsultationsLite,
} from "../controllers/consultationController.js";
import { verifyAuth } from "../middleware/verifyAuth.js";


const router = Router();

// 🆔 UUID regex for safe :id routes
const UUIDv4 =
  "[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}";

/* ============================================================
   📌 CONSULTATION ROUTES
   ============================================================ */

// 🔍 List & Lookup
router.get("/", verifyAuth,  getAllConsultations);
router.get("/lite", verifyAuth,  getAllConsultationsLite);
router.get(`/:id(${UUIDv4})`, verifyAuth,  getConsultationById);

// ➕ Create / ✏️ Update / 🗑️ Delete
router.post("/", verifyAuth,  createConsultation);
router.put(`/:id(${UUIDv4})`, verifyAuth,  updateConsultation);
router.delete(`/:id(${UUIDv4})`, verifyAuth,  deleteConsultation);

/* ============================================================
   📌 LIFECYCLE ROUTES
   ============================================================ */
router.patch(`/:id(${UUIDv4})/start`, verifyAuth,  startConsultation);
router.patch(`/:id(${UUIDv4})/complete`, verifyAuth,  completeConsultation);
router.patch(`/:id(${UUIDv4})/verify`, verifyAuth,  verifyConsultation);
router.patch(`/:id(${UUIDv4})/cancel`, verifyAuth,  cancelConsultation);
router.patch(`/:id(${UUIDv4})/void`, verifyAuth,  voidConsultation);

/* ============================================================
   ✅ EXPORT
   ============================================================ */
export default router;
