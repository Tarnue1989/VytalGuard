// 📁 backend/src/routes/maternityVisitRoutes.js
import { Router } from "express";
import {
  createMaternityVisit,
  updateMaternityVisit,
  startMaternityVisit,
  completeMaternityVisit,
  cancelMaternityVisit,
  voidMaternityVisit,
  verifyMaternityVisit,
  deleteMaternityVisit,
  getAllMaternityVisitsLite,
  getAllMaternityVisits,
  getMaternityVisitById,
} from "../controllers/maternityVisitController.js";
import { verifyAuth } from "../middleware/verifyAuth.js";


const router = Router();

// 🆔 UUID regex for safe :id routes
const UUIDv4 =
  "[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}";

/* ============================================================
   📌 MATERNITY VISIT ROUTES
   ============================================================ */

// ➕ Create & Update
router.post("/", verifyAuth,  createMaternityVisit);
router.put(`/:id(${UUIDv4})`, verifyAuth,  updateMaternityVisit);

/* ============================================================
   📌 LIFECYCLE ROUTES
   ============================================================ */

// Start visit
router.patch(`/:id(${UUIDv4})/start`, verifyAuth,  startMaternityVisit);

// Complete visit
router.patch(`/:id(${UUIDv4})/complete`, verifyAuth,  completeMaternityVisit);

// Cancel visit
router.patch(`/:id(${UUIDv4})/cancel`, verifyAuth,  cancelMaternityVisit);

// Void visit (restricted)
router.patch(`/:id(${UUIDv4})/void`, verifyAuth,  voidMaternityVisit);

// Verify visit (restricted)
router.patch(`/:id(${UUIDv4})/verify`, verifyAuth,  verifyMaternityVisit);

/* ============================================================
   📌 DELETE & READ ROUTES
   ============================================================ */

// 🗑️ Delete
router.delete(`/:id(${UUIDv4})`, verifyAuth,  deleteMaternityVisit);

// 📖 Read (Lite + Full + Single)
router.get("/lite", verifyAuth,  getAllMaternityVisitsLite);
router.get("/", verifyAuth,  getAllMaternityVisits);
router.get(`/:id(${UUIDv4})`, verifyAuth,  getMaternityVisitById);

/* ============================================================
   ✅ EXPORT
   ============================================================ */
export default router;
