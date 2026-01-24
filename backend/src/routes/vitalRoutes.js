// 📁 backend/src/routes/vitalRoutes.js
import { Router } from "express";
import {
  getAllVitals,
  getVitalById,
  getAllVitalsLite,
  createVital,
  updateVital,
  deleteVital,
  startVital,
  completeVital,
  verifyVital,
  finalizeVital,
  cancelVital,
  voidVital,
} from "../controllers/vitalController.js";
import { verifyAuth } from "../middleware/verifyAuth.js";

const router = Router();

// 🆔 UUID regex for safe :id routes
const UUIDv4 =
  "[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}";

/* ============================================================
   📌 VITAL ROUTES
============================================================ */

// 🔍 List & Lookup
router.get("/", verifyAuth, getAllVitals);
router.get("/lite", verifyAuth, getAllVitalsLite);
router.get(`/:id(${UUIDv4})`, verifyAuth, getVitalById);

// ➕ Create / ✏️ Update / 🗑️ Delete
router.post("/", verifyAuth, createVital);
router.put(`/:id(${UUIDv4})`, verifyAuth, updateVital);
router.delete(`/:id(${UUIDv4})`, verifyAuth, deleteVital);

/* ============================================================
   🔄 LIFECYCLE ROUTES (EXPLICIT STATE MACHINE)
============================================================ */
router.patch(`/:id(${UUIDv4})/start`, verifyAuth, startVital);
router.patch(`/:id(${UUIDv4})/complete`, verifyAuth, completeVital);
router.patch(`/:id(${UUIDv4})/verify`, verifyAuth, verifyVital);
router.patch(`/:id(${UUIDv4})/finalize`, verifyAuth, finalizeVital);
router.patch(`/:id(${UUIDv4})/cancel`, verifyAuth, cancelVital);
router.patch(`/:id(${UUIDv4})/void`, verifyAuth, voidVital);

/* ============================================================
   ✅ EXPORT
============================================================ */
export default router;
