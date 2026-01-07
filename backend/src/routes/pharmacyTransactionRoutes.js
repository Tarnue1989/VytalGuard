// 📁 backend/src/routes/pharmacyTransactionRoutes.js
import { Router } from "express";
import {
  getAllPharmacyTransactions,
  getAllPharmacyTransactionsLite,
  getAllPharmacyTransactionItemsLite,
  getPharmacyTransactionById,
  createPharmacyTransactions,
  updatePharmacyTransaction,
  deletePharmacyTransactions,
  togglePharmacyTransactionStatus,
  submitPharmacyTransactions,
  dispensePharmacyTransactions,
  partiallyDispensePharmacyTransactions,
  cancelPharmacyTransactions,
  voidPharmacyTransactions,
  verifyPharmacyTransactions,
  getPharmacyTransactionSummary,   // ✅ NEW: summary endpoint
} from "../controllers/pharmacyTransactionController.js";

import { verifyAuth } from "../middleware/verifyAuth.js";


const router = Router();

// 🆔 UUID regex for safe :id routes
const UUIDv4 =
  "[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}";

/* ============================================================
   📌 PHARMACY TRANSACTION ROUTES
   ============================================================ */

// 🔍 List & Lookup
router.get("/", verifyAuth,  getAllPharmacyTransactions);
router.get("/lite", verifyAuth,  getAllPharmacyTransactionsLite);
router.get("/items/lite", verifyAuth,  getAllPharmacyTransactionItemsLite);
router.get(`/summary`, verifyAuth,  getPharmacyTransactionSummary); // ✅ NEW SUMMARY ROUTE
router.get(`/:id(${UUIDv4})`, verifyAuth,  getPharmacyTransactionById);

// ➕ Create / ✏️ Update / 🗑️ Delete
router.post("/", verifyAuth,  createPharmacyTransactions);
router.put(`/:id(${UUIDv4})`, verifyAuth,  updatePharmacyTransaction);
router.delete(`/:id(${UUIDv4})`, verifyAuth,  deletePharmacyTransactions);

// 🔄 Toggle status
router.patch(`/:id(${UUIDv4})/toggle-status`, verifyAuth,  togglePharmacyTransactionStatus);

/* ============================================================
   📌 LIFECYCLE ROUTES
   ============================================================ */
router.patch(`/:id(${UUIDv4})/submit`, verifyAuth,  submitPharmacyTransactions);
router.patch(`/:id(${UUIDv4})/dispense`, verifyAuth,  dispensePharmacyTransactions);
router.patch(`/:id(${UUIDv4})/partial-dispense`, verifyAuth,  partiallyDispensePharmacyTransactions);
router.patch(`/partial-dispense`, verifyAuth,  partiallyDispensePharmacyTransactions);
router.patch(`/:id(${UUIDv4})/cancel`, verifyAuth,  cancelPharmacyTransactions);
router.patch(`/:id(${UUIDv4})/void`, verifyAuth,  voidPharmacyTransactions);
router.patch(`/:id(${UUIDv4})/verify`, verifyAuth,  verifyPharmacyTransactions);

/* ============================================================
   ✅ EXPORT
   ============================================================ */
export default router;
