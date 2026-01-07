// 📁 backend/src/routes/surgeryRoutes.js
import { Router } from "express";
import {
  createSurgery,
  updateSurgery,
  startSurgery,
  completeSurgery,
  cancelSurgery,
  voidSurgery,
  verifySurgery,
  finalizeSurgery,
  deleteSurgery,
  getAllSurgeriesLite,
  getAllSurgeries,
  getSurgeryById,
} from "../controllers/surgeryController.js";
import { verifyAuth } from "../middleware/verifyAuth.js";


const router = Router();

// 🆔 UUID regex for safe :id routes
const UUIDv4 =
  "[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}";

/* ============================================================
   📌 SURGERY ROUTES
   ============================================================ */

// ➕ Create / ✏️ Update / 🗑️ Delete
router.post("/", verifyAuth,  createSurgery);
router.put(`/:id(${UUIDv4})`, verifyAuth,  updateSurgery);
router.delete(`/:id(${UUIDv4})`, verifyAuth,  deleteSurgery);

// 🔍 List & Lookup
router.get("/lite", verifyAuth,  getAllSurgeriesLite);
router.get("/", verifyAuth,  getAllSurgeries);
router.get(`/:id(${UUIDv4})`, verifyAuth,  getSurgeryById);

/* ============================================================
   📌 LIFECYCLE ROUTES
   ============================================================ */
router.patch(`/:id(${UUIDv4})/start`, verifyAuth,  startSurgery);
router.patch(`/:id(${UUIDv4})/complete`, verifyAuth,  completeSurgery);
router.patch(`/:id(${UUIDv4})/cancel`, verifyAuth,  cancelSurgery);
router.patch(`/:id(${UUIDv4})/void`, verifyAuth,  voidSurgery);
router.patch(`/:id(${UUIDv4})/verify`, verifyAuth,  verifySurgery);
router.patch(`/:id(${UUIDv4})/finalize`, verifyAuth,  finalizeSurgery);

/* ============================================================
   ✅ EXPORT
   ============================================================ */
export default router;
