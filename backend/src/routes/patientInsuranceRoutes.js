/* ============================================================
   📁 PATIENT INSURANCE ROUTES (MASTER PARITY)
============================================================ */

import { Router } from "express";
import {
  createPatientInsurance,
  updatePatientInsurance,
  getAllPatientInsurances,
  getPatientInsuranceById,
  getAllPatientInsurancesLite,
  togglePatientInsuranceStatus,
  deletePatientInsurance,
} from "../controllers/patientInsuranceController.js";

import { verifyAuth } from "../middleware/verifyAuth.js";

/* ============================================================
   🔧 INIT
============================================================ */
const router = Router();

/* ============================================================
   🔐 SAFE PARAM (UUID)
============================================================ */
const UUIDv4 =
  "[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}";

/* ============================================================
   📌 PATIENT INSURANCE ROUTES
============================================================ */

/* =========================
   🔍 LIST / FILTER / SEARCH
========================= */
router.get("/", verifyAuth, getAllPatientInsurances);

/* =========================
   ⚡ LITE (AUTOCOMPLETE)
========================= */
router.get("/lite/list", verifyAuth, getAllPatientInsurancesLite);

/* =========================
   📄 GET BY ID
========================= */
router.get(`/:id(${UUIDv4})`, verifyAuth, getPatientInsuranceById);

/* =========================
   ➕ CREATE
========================= */
router.post("/", verifyAuth, createPatientInsurance);

/* =========================
   ✏️ UPDATE
========================= */
router.put(`/:id(${UUIDv4})`, verifyAuth, updatePatientInsurance);

/* =========================
   🗑️ DELETE (SOFT DELETE)
========================= */
router.delete(`/:id(${UUIDv4})`, verifyAuth, deletePatientInsurance);

/* =========================
   🔄 TOGGLE STATUS
========================= */
router.patch(
  `/:id(${UUIDv4})/toggle-status`,
  verifyAuth,
  togglePatientInsuranceStatus
);

/* ============================================================
   📤 EXPORT
============================================================ */
export default router;