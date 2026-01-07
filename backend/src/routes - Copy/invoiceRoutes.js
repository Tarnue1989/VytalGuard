// 📁 backend/src/routes/invoiceRoutes.js
import { Router } from "express";
import {
  getAllInvoices,
  getInvoiceById,
  getAllInvoicesLite,
  updateInvoice,
  toggleInvoiceStatus,
  applyPayment,
  applyRefund,
  applyDeposit,
  applyWaiver,
  reverseTransaction,
} from "../controllers/invoiceController.js";
import { verifyAuth } from "../middleware/verifyAuth.js";


const router = Router();

// 🆔 UUID regex for safe :id routes
const UUIDv4 =
  "[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}";

/* ============================================================
   📌 INVOICE ROUTES
   ============================================================ */

// 🔍 List & Lookup
router.get("/", verifyAuth,  getAllInvoices);
router.get("/lite", verifyAuth,  getAllInvoicesLite);
router.get(`/:id(${UUIDv4})`, verifyAuth,  getInvoiceById);

// ✏️ Update / 🔄 Toggle
router.put(`/:id(${UUIDv4})`, verifyAuth,  updateInvoice);
router.patch(`/:id(${UUIDv4})/toggle-status`, verifyAuth,  toggleInvoiceStatus);

/* ============================================================
   📌 FINANCIAL ROUTES
   ============================================================ */

// 💵 Apply payment
router.post("/apply-payment", verifyAuth,  applyPayment);

// 💰 Apply deposit
router.post("/apply-deposit", verifyAuth,  applyDeposit);

// 🔄 Apply refund
router.post("/apply-refund", verifyAuth,  applyRefund);

// 🎟️ Apply waiver
router.post("/apply-waiver", verifyAuth,  applyWaiver);

// ❌ Reverse transaction (any type)
router.post("/reverse-transaction", verifyAuth,  reverseTransaction);

/* ============================================================
   ✅ EXPORT
   ============================================================ */
export default router;
