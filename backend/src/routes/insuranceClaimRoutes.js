/* ============================================================
   📁 INSURANCE CLAIM ROUTES (MASTER PARITY)
============================================================ */

import { Router } from "express";
import {
  createInsuranceClaim,
  updateInsuranceClaim,
  getAllInsuranceClaims,
  getInsuranceClaimById,
  getAllInsuranceClaimsLite,
  deleteInsuranceClaim,

  // 🔥 STATUS ACTIONS
  submitInsuranceClaim,
  reviewInsuranceClaim,
  approveInsuranceClaim,
  partialApproveInsuranceClaim,
  rejectInsuranceClaim,
  processInsuranceClaimPayment,
  markInsuranceClaimPaid,
  reverseInsuranceClaimPayment,

} from "../controllers/insuranceClaimController.js";

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
   📌 INSURANCE CLAIM ROUTES
============================================================ */

/* =========================
   🔍 LIST / FILTER / SEARCH
========================= */
router.get("/", verifyAuth, getAllInsuranceClaims);

/* =========================
   ⚡ LITE (AUTOCOMPLETE)
========================= */
router.get("/lite/list", verifyAuth, getAllInsuranceClaimsLite);

/* =========================
   📄 GET BY ID
========================= */
router.get(`/:id(${UUIDv4})`, verifyAuth, getInsuranceClaimById);

/* =========================
   ➕ CREATE
========================= */
router.post("/", verifyAuth, createInsuranceClaim);

/* =========================
   ✏️ UPDATE
========================= */
router.put(`/:id(${UUIDv4})`, verifyAuth, updateInsuranceClaim);

/* =========================
   🗑️ DELETE (SOFT DELETE)
========================= */
router.delete(`/:id(${UUIDv4})`, verifyAuth, deleteInsuranceClaim);

/* ============================================================
   🔄 STATUS ACTIONS (ENTERPRISE FLOW)
============================================================ */

// 1️⃣ DRAFT → SUBMITTED
router.patch(`/:id(${UUIDv4})/submit`, verifyAuth, submitInsuranceClaim);

// 2️⃣ SUBMITTED → IN_REVIEW
router.patch(`/:id(${UUIDv4})/review`, verifyAuth, reviewInsuranceClaim);

// 3️⃣ IN_REVIEW → APPROVED
router.patch(`/:id(${UUIDv4})/approve`, verifyAuth, approveInsuranceClaim);

// 4️⃣ IN_REVIEW → PARTIAL APPROVED
router.patch(
  `/:id(${UUIDv4})/partial-approve`,
  verifyAuth,
  partialApproveInsuranceClaim
);

// 5️⃣ IN_REVIEW → REJECTED
router.patch(`/:id(${UUIDv4})/reject`, verifyAuth, rejectInsuranceClaim);

// 6️⃣ APPROVED → PROCESSING PAYMENT
router.patch(
  `/:id(${UUIDv4})/process-payment`,
  verifyAuth,
  processInsuranceClaimPayment
);

// 7️⃣ PROCESSING → PAID
router.patch(
  `/:id(${UUIDv4})/mark-paid`,
  verifyAuth,
  markInsuranceClaimPaid
);

// 8️⃣ PAID → REVERSED
router.patch(
  `/:id(${UUIDv4})/reverse-payment`, // 🔥 FIXED (was wrong before)
  verifyAuth,
  reverseInsuranceClaimPayment
);

/* ============================================================
   📤 EXPORT
============================================================ */
export default router;