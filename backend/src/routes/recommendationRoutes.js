// 📁 backend/src/routes/recommendationRoutes.js
import { Router } from "express";
import {
  getAllRecommendations,
  getRecommendationById,
  getAllRecommendationsLite,
  createRecommendation,
  updateRecommendation,
  deleteRecommendation,
  confirmRecommendation,
  declineRecommendation,
  voidRecommendation,
} from "../controllers/recommendationController.js";
import { verifyAuth } from "../middleware/verifyAuth.js";


const router = Router();

// 🆔 UUID regex for safe :id routes
const UUIDv4 =
  "[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}";

/* ============================================================
   📌 RECOMMENDATION ROUTES
   ============================================================ */

// 🔍 List & Lookup
router.get("/", verifyAuth,  getAllRecommendations);
router.get("/lite", verifyAuth,  getAllRecommendationsLite);
router.get(`/:id(${UUIDv4})`, verifyAuth,  getRecommendationById);

// ➕ Create / ✏️ Update / 🗑️ Delete
router.post("/", verifyAuth,  createRecommendation);
router.put(`/:id(${UUIDv4})`, verifyAuth,  updateRecommendation);
router.delete(`/:id(${UUIDv4})`, verifyAuth,  deleteRecommendation);

/* ============================================================
   📌 LIFECYCLE ROUTES
   ============================================================ */
router.patch(`/:id(${UUIDv4})/confirm`, verifyAuth,  confirmRecommendation);
router.patch(`/:id(${UUIDv4})/decline`, verifyAuth,  declineRecommendation);
router.patch(`/:id(${UUIDv4})/void`, verifyAuth,  voidRecommendation);

/* ============================================================
   ✅ EXPORT
   ============================================================ */
export default router;
