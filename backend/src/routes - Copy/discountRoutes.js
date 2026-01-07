// 📁 backend/src/routes/discountRoutes.js
// ============================================================================
// 🧾 Discount Routes – Enterprise Master Pattern
// ----------------------------------------------------------------------------
// 🔹 Mirrors depositRoutes.js for full lifecycle alignment
// 🔹 Includes: list, create, update, toggle, finalize, void, delete, restore
// 🔹 Scoped by organization/facility, with UUID-safe routing
// ============================================================================

import { Router } from "express";
import {
  getAllDiscounts,
  getAllDiscountsLite,
  getDiscountById,
  createDiscount,
  updateDiscount,
  toggleDiscountStatus,
  finalizeDiscount,
  voidDiscount,
  deleteDiscount,
  restoreDiscount, // ✅ Added restore
} from "../controllers/discountController.js";
import { verifyAuth } from "../middleware/verifyAuth.js";


const router = Router();

// 🆔 UUID regex for safe :id routes
const UUIDv4 =
  "[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}";

/* ============================================================
   📋 DISCOUNT ROUTES
============================================================ */

// 🔍 List & Lookup
router.get("/", verifyAuth,  getAllDiscounts);
router.get("/lite", verifyAuth,  getAllDiscountsLite);
router.get(`/:id(${UUIDv4})`, verifyAuth,  getDiscountById);

// ➕ Create / ✏️ Update / 🗑️ Delete
router.post("/", verifyAuth,  createDiscount);
router.put(`/:id(${UUIDv4})`, verifyAuth,  updateDiscount);
router.delete(`/:id(${UUIDv4})`, verifyAuth,  deleteDiscount);

// 🔄 Lifecycle & Status
router.patch(
  `/:id(${UUIDv4})/toggle-status`,
  verifyAuth,
  
  toggleDiscountStatus
);
router.patch(
  `/:id(${UUIDv4})/finalize`,
  verifyAuth,
  
  finalizeDiscount
);
router.patch(
  `/:id(${UUIDv4})/void`,
  verifyAuth,
  
  voidDiscount
);
router.patch(
  `/:id(${UUIDv4})/restore`,
  verifyAuth,
  
  restoreDiscount // ✅ Added
);

/* ============================================================
   ✅ EXPORT
============================================================ */
export default router;
