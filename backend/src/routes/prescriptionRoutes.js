// 📁 backend/src/routes/prescriptionRoutes.js
import { Router } from "express";
import {
  getAllPrescriptions,
  getAllPrescriptionsLite,
  getAllPrescriptionItemsLite,
  getPrescriptionById,
  createPrescriptions,
  updatePrescription,
  deletePrescriptions,
  restorePrescription,
  togglePrescriptionStatus,
  submitPrescriptions,
  activatePrescriptions,
  completePrescriptions,
  cancelPrescriptions,
  voidPrescriptions,
  verifyPrescriptions,
} from "../controllers/prescriptionController.js";
import { verifyAuth } from "../middleware/verifyAuth.js";


const router = Router();

// 🆔 UUID regex for safe :id routes
const UUIDv4 =
  "[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}";

/* ============================================================
   📌 PRESCRIPTION ROUTES
   ============================================================ */

// 🔍 List & Lookup
router.get("/", verifyAuth,  getAllPrescriptions);
router.get("/lite", verifyAuth,  getAllPrescriptionsLite);
router.get("/items/lite", verifyAuth,  getAllPrescriptionItemsLite);
router.get(`/:id(${UUIDv4})`, verifyAuth,  getPrescriptionById);

// ➕ Create / ✏️ Update / 🗑️ Delete / ♻️ Restore
router.post("/", verifyAuth,  createPrescriptions);
router.put(`/:id(${UUIDv4})`, verifyAuth,  updatePrescription);
router.delete(`/:id(${UUIDv4})`, verifyAuth,  deletePrescriptions);
router.patch(`/:id(${UUIDv4})/restore`, verifyAuth,  restorePrescription);

// 🔄 Toggle active/inactive
router.patch(`/:id(${UUIDv4})/toggle-status`, verifyAuth,  togglePrescriptionStatus);

/* ============================================================
   📌 LIFECYCLE ROUTES
   ============================================================ */
router.patch(`/:id(${UUIDv4})/submit`, verifyAuth,  submitPrescriptions);
router.patch(`/:id(${UUIDv4})/activate`, verifyAuth,  activatePrescriptions);
router.patch(`/:id(${UUIDv4})/complete`, verifyAuth,  completePrescriptions);
router.patch(`/:id(${UUIDv4})/cancel`, verifyAuth,  cancelPrescriptions);
router.patch(`/:id(${UUIDv4})/void`, verifyAuth,  voidPrescriptions);
router.patch(`/:id(${UUIDv4})/verify`, verifyAuth,  verifyPrescriptions);

/* ============================================================
   ✅ EXPORT
   ============================================================ */
export default router;
