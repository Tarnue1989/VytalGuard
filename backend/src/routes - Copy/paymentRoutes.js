// 📁 backend/src/routes/paymentRoutes.js
import { Router } from "express";
import {
  getAllPayments,
  getAllPaymentsLite,
  getPaymentById,
  createPayment,
  updatePayment,
  togglePaymentStatus,
  completePayment,
  verifyPayment,
  voidPayment,
  restorePayment,
  reversePayment,
  deletePayment,
} from "../controllers/paymentController.js";
import { verifyAuth } from "../middleware/verifyAuth.js";


const router = Router();

// 🆔 UUID regex
const UUIDv4 =
  "[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}";

/* ============================================================
   📌 PAYMENT ROUTES
============================================================ */

// 🔍 List & Lookup
router.get("/", verifyAuth,  getAllPayments);
router.get("/lite", verifyAuth,  getAllPaymentsLite);
router.get(`/:id(${UUIDv4})`, verifyAuth,  getPaymentById);

// ➕ Create
router.post("/", verifyAuth,  createPayment);

// ✏️ Update
router.put(`/:id(${UUIDv4})`, verifyAuth,  updatePayment);

// 🔄 Toggle
router.patch(`/:id(${UUIDv4})/toggle-status`, verifyAuth,  togglePaymentStatus);

// ✅ Complete / Verify / Void / Restore
router.patch(`/:id(${UUIDv4})/complete`, verifyAuth,  completePayment);
router.patch(`/:id(${UUIDv4})/verify`, verifyAuth,  verifyPayment);
router.patch(`/:id(${UUIDv4})/void`, verifyAuth,  voidPayment);
router.patch(`/:id(${UUIDv4})/restore`, verifyAuth,  restorePayment);

// 🔁 Reverse
router.patch(`/:id(${UUIDv4})/reverse`, verifyAuth,  reversePayment);

// 🗑️ Delete (soft)
router.delete(`/:id(${UUIDv4})`, verifyAuth,  deletePayment);

/* ============================================================
   ✅ EXPORT
============================================================ */
export default router;
