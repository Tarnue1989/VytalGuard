// 📁 backend/src/routes/patientRoutes.js
import { Router } from "express";
import {
  getAllPatients,
  getAllPatientsLite,
  getAllPatientsLiteWithContact,
  getPatientById,
  createPatient,
  updatePatient,
  deletePatient,
  togglePatientStatus,
} from "../controllers/patientController.js";
import { verifyAuth } from "../middleware/verifyAuth.js";

import { uploadPatient } from "../middleware/upload.js";

const router = Router();

// 🆔 UUID regex for safe :id routes
const UUIDv4 =
  "[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}";

/* ============================================================
   📌 PATIENT ROUTES
   ============================================================ */

// 🔍 List & Lookup
router.get("/", verifyAuth,  getAllPatients);
router.get("/lite", verifyAuth,  getAllPatientsLite);
router.get("/lite/list", verifyAuth,  getAllPatientsLite);
router.get(
  "/lite/list-with-contact",
  verifyAuth,
  
  getAllPatientsLiteWithContact
);
router.get(`/:id(${UUIDv4})`, verifyAuth,  getPatientById);

// ➕ Create
router.post("/", verifyAuth,  uploadPatient, createPatient);

// ✏️ Update
router.put(`/:id(${UUIDv4})`, verifyAuth,  uploadPatient, updatePatient);

// 🗑️ Delete
router.delete(`/:id(${UUIDv4})`, verifyAuth,  deletePatient);

// 🔄 Toggle active/inactive
router.patch(`/:id(${UUIDv4})/toggle-status`, verifyAuth,  togglePatientStatus);

/* ============================================================
   ✅ EXPORT
   ============================================================ */
export default router;
