// 📁 backend/src/routes/currencyRateRoutes.js

import { Router } from "express";
import {
  getAllCurrencyRates,
  getCurrencyRateById,
  getAllCurrencyRatesLite,
  createCurrencyRate,
  updateCurrencyRate,
  deleteCurrencyRate,
  toggleCurrencyRateStatus,
} from "../controllers/currencyRateController.js";

import { verifyAuth } from "../middleware/verifyAuth.js";

const router = Router();

// 🆔 UUID regex for safe :id routes
const UUIDv4 =
  "[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}";

/* ============================================================
   📌 CURRENCY RATE ROUTES
   ============================================================ */

// 🔍 List & Lookup
router.get("/", verifyAuth, getAllCurrencyRates);
router.get("/lite/list", verifyAuth, getAllCurrencyRatesLite);
router.get(`/:id(${UUIDv4})`, verifyAuth, getCurrencyRateById);

// ➕ Create / ✏️ Update / 🗑️ Delete
router.post("/", verifyAuth, createCurrencyRate);
router.put(`/:id(${UUIDv4})`, verifyAuth, updateCurrencyRate);
router.delete(`/:id(${UUIDv4})`, verifyAuth, deleteCurrencyRate);

// 🔄 Toggle active/inactive
router.patch(
  `/:id(${UUIDv4})/toggle-status`,
  verifyAuth,
  toggleCurrencyRateStatus
);

/* ============================================================
   ✅ EXPORT
   ============================================================ */
export default router;