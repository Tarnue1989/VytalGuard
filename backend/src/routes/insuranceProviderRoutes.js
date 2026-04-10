/* ============================================================
   📁 INSURANCE PROVIDER ROUTES (MASTER PARITY)
============================================================ */

import { Router } from "express";
import {
  createInsuranceProvider,
  updateInsuranceProvider,
  getAllInsuranceProviders,
  getInsuranceProviderById,
  getAllInsuranceProvidersLite,
  toggleInsuranceProviderStatus,
  deleteInsuranceProvider,
} from "../controllers/insuranceProviderController.js";

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
   📌 INSURANCE PROVIDER ROUTES
============================================================ */

/* =========================
   🔍 LIST / FILTER / SEARCH
========================= */
router.get("/", verifyAuth, getAllInsuranceProviders);

/* =========================
   ⚡ LITE (AUTOCOMPLETE)
========================= */
router.get("/lite/list", verifyAuth, getAllInsuranceProvidersLite);

/* =========================
   📄 GET BY ID
========================= */
router.get(`/:id(${UUIDv4})`, verifyAuth, getInsuranceProviderById);

/* =========================
   ➕ CREATE
========================= */
router.post("/", verifyAuth, createInsuranceProvider);

/* =========================
   ✏️ UPDATE
========================= */
router.put(`/:id(${UUIDv4})`, verifyAuth, updateInsuranceProvider);

/* =========================
   🗑️ DELETE (SOFT DELETE)
========================= */
router.delete(`/:id(${UUIDv4})`, verifyAuth, deleteInsuranceProvider);

/* =========================
   🔄 TOGGLE STATUS
========================= */
router.patch(
  `/:id(${UUIDv4})/toggle-status`,
  verifyAuth,
  toggleInsuranceProviderStatus
);

/* ============================================================
   📤 EXPORT
============================================================ */
export default router;