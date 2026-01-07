// 📁 backend/src/routes/refundRoutes.js
import { Router } from "express";
import {
  getAllRefunds,
  getAllRefundsLite,
  getRefundById,
  createRefund,
  updateRefund,
  approveRefund,
  rejectRefund,
  cancelRefund,
  processRefund,
  reverseRefund,
  deleteRefund,
  voidRefund,      // 🆕 Add this
  restoreRefund,   // 🆕 Add this
} from "../controllers/refundController.js";
import { verifyAuth } from "../middleware/verifyAuth.js";


const router = Router();
const UUIDv4 =
  "[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}";

/* ============================================================
   📌 REFUND ROUTES
============================================================ */
router.get("/", verifyAuth,  getAllRefunds);
router.get("/lite", verifyAuth,  getAllRefundsLite);
router.get(`/:id(${UUIDv4})`, verifyAuth,  getRefundById);

router.post("/", verifyAuth,  createRefund);
router.put(`/:id(${UUIDv4})`, verifyAuth,  updateRefund);
router.delete(`/:id(${UUIDv4})`, verifyAuth,  deleteRefund);

/* ============================================================
   📌 LIFECYCLE ROUTES
============================================================ */
router.patch(`/:id(${UUIDv4})/approve`, verifyAuth,  approveRefund);
router.patch(`/:id(${UUIDv4})/reject`, verifyAuth,  rejectRefund);
router.patch(`/:id(${UUIDv4})/cancel`, verifyAuth,  cancelRefund);
router.patch(`/:id(${UUIDv4})/process`, verifyAuth,  processRefund);
router.patch(`/:id(${UUIDv4})/reverse`, verifyAuth,  reverseRefund);
router.patch(`/:id(${UUIDv4})/void`, verifyAuth,  voidRefund);       // 🆕
router.patch(`/:id(${UUIDv4})/restore`, verifyAuth,  restoreRefund); // 🆕

/* ============================================================
   ✅ EXPORT
============================================================ */
export default router;
