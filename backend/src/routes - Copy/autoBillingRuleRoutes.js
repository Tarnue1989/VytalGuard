// 📁 backend/src/routes/autoBillingRuleRoutes.js
import { Router } from "express";
import {
  getAllAutoBillingRules,
  getAutoBillingRuleById,
  createAutoBillingRule,
  updateAutoBillingRule,
  deleteAutoBillingRule,
  toggleAutoBillingRuleStatus,
  getAllAutoBillingRulesLite,
} from "../controllers/autoBillingRuleController.js";
import { verifyAuth } from "../middleware/verifyAuth.js";


const router = Router();

// 🆔 UUID regex for safe :id routes
const UUIDv4 =
  "[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}";

/* ============================================================
   📌 AUTO BILLING RULE ROUTES
   ============================================================ */

// 🔍 List & Lookup
router.get("/", verifyAuth,  getAllAutoBillingRules);
router.get("/lite", verifyAuth,  getAllAutoBillingRulesLite);
router.get(`/:id(${UUIDv4})`, verifyAuth,  getAutoBillingRuleById);

// ➕ Create / ✏️ Update / 🗑️ Delete
router.post("/", verifyAuth,  createAutoBillingRule);
router.put(`/:id(${UUIDv4})`, verifyAuth,  updateAutoBillingRule);
router.delete(`/:id(${UUIDv4})`, verifyAuth,  deleteAutoBillingRule);

// 🔄 Toggle active/inactive
router.patch(
  `/:id(${UUIDv4})/toggle-status`,
  verifyAuth,
  
  toggleAutoBillingRuleStatus
);

/* ============================================================
   ✅ EXPORT
   ============================================================ */
export default router;
