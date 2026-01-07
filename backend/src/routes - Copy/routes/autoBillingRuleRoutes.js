// 📁 routes/autoBillingRuleRoutes.js
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
import { verifyAuth } from "../middleware/verifyAuth.js";   // ✅ unified auth
import roleGuard from "../middleware/roleGuard.js";


const router = Router();

// 🆔 UUID regex for safe :id routes
const UUIDv4 =
  "[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}";

/* ============================================================
   📌 AUTO BILLING RULE ROUTES
   ============================================================ */

// 🔍 Full list (with filters + pagination)
router.get("/", verifyAuth,  getAllAutoBillingRules);

// ⚡ Lite endpoints (dropdowns/autocomplete) — must come before /:id
router.get("/lite", verifyAuth,  getAllAutoBillingRulesLite);       // alias
router.get("/lite/list", verifyAuth,  getAllAutoBillingRulesLite); // original

// 🔍 Single by ID (UUID only)
router.get(`/:id(${UUIDv4})`, verifyAuth,  getAutoBillingRuleById);

// ➕ Create
router.post(
  "/",
  verifyAuth,
  roleGuard(["admin", "superadmin"]),
  
  createAutoBillingRule
);

// ✏️ Update
router.put(
  `/:id(${UUIDv4})`,
  verifyAuth,
  roleGuard(["admin", "superadmin"]),
  
  updateAutoBillingRule
);

// 🗑️ Delete (soft)
router.delete(
  `/:id(${UUIDv4})`,
  verifyAuth,
  roleGuard(["admin", "superadmin"]),
  
  deleteAutoBillingRule
);

// 🔄 Toggle status (active/inactive)
router.patch(
  `/:id(${UUIDv4})/toggle-status`,
  verifyAuth,
  roleGuard(["admin", "superadmin"]),
  
  toggleAutoBillingRuleStatus
);

export default router;
