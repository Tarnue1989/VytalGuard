// 📁 backend/src/routes/stockRequestRoutes.js
import { Router } from "express";
import {
  getAllRequests,
  getAllRequestsLite,
  getRequestById,
  createRequest,
  updateRequest,
  deleteRequest,
  restoreRequest,
  submitRequest,
  approveRequest,
  rejectRequest,
  issueRequest,
  fulfillRequest,
  cancelRequest,
  voidRequest,              // ✅ MISSING IMPORT (ADD)
  approveRequestItem,
  rejectRequestItem,
  issueRequestItem,
  fulfillRequestItem,
  getItemAvailability,
  getItemAvailabilityLite,
} from "../controllers/stockRequestController.js";
import { verifyAuth } from "../middleware/verifyAuth.js";


const router = Router();

// 🆔 UUID regex for safe :id routes
const UUIDv4 =
  "[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}";

/* ============================================================
   📋 CORE CRUD ROUTES
============================================================ */
router.get("/", verifyAuth,  getAllRequests);
router.get("/lite", verifyAuth,  getAllRequestsLite);
router.get("/lite/list", verifyAuth,  getAllRequestsLite);

router.get("/availability", verifyAuth,  getItemAvailability);
router.get("/availability/lite", verifyAuth,  getItemAvailabilityLite);

router.get(`/:id(${UUIDv4})`, verifyAuth,  getRequestById);

router.post("/", verifyAuth,  createRequest);
router.put(`/:id(${UUIDv4})`, verifyAuth,  updateRequest);
router.delete(`/:id(${UUIDv4})`, verifyAuth,  deleteRequest);
router.put(`/:id(${UUIDv4})/restore`, verifyAuth,  restoreRequest);

/* ============================================================
   🚀 REQUEST LIFECYCLE ACTIONS
============================================================ */
router.route(`/:id(${UUIDv4})/submit`)
  .put(verifyAuth,  submitRequest)
  .patch(verifyAuth,  submitRequest);

router.route(`/:id(${UUIDv4})/approve`)
  .put(verifyAuth,  approveRequest)
  .patch(verifyAuth,  approveRequest);

router.route(`/:id(${UUIDv4})/reject`)
  .put(verifyAuth,  rejectRequest)
  .patch(verifyAuth,  rejectRequest);

router.route(`/:id(${UUIDv4})/issue`)
  .put(verifyAuth,  issueRequest)
  .patch(verifyAuth,  issueRequest);

router.route(`/:id(${UUIDv4})/fulfill`)
  .put(verifyAuth,  fulfillRequest)
  .patch(verifyAuth,  fulfillRequest);

router.route(`/:id(${UUIDv4})/cancel`)
  .put(verifyAuth,  cancelRequest)
  .patch(verifyAuth,  cancelRequest);

/* ============================================================
   🔄 VOID (ISSUED → PENDING, STOCK REVERSAL)
============================================================ */
router.route(`/:id(${UUIDv4})/void`)
  .put(verifyAuth,  voidRequest)
  .patch(verifyAuth,  voidRequest);

/* ============================================================
   📦 ITEM-LEVEL ACTIONS
============================================================ */
router.route(`/items/:id(${UUIDv4})/approve`)
  .put(verifyAuth,  approveRequestItem)
  .patch(verifyAuth,  approveRequestItem);

router.route(`/items/:id(${UUIDv4})/reject`)
  .put(verifyAuth,  rejectRequestItem)
  .patch(verifyAuth,  rejectRequestItem);

router.route(`/items/:id(${UUIDv4})/issue`)
  .put(verifyAuth,  issueRequestItem)
  .patch(verifyAuth,  issueRequestItem);

router.route(`/items/:id(${UUIDv4})/fulfill`)
  .put(verifyAuth,  fulfillRequestItem)
  .patch(verifyAuth,  fulfillRequestItem);

/* ============================================================
   ✅ EXPORT
============================================================ */
export default router;
