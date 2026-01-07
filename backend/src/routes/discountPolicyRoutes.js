// 📁 backend/src/routes/discountPolicyRoutes.js
import { Router } from "express";
import {
  getAllPolicies,
  getPolicyById,
  getAllPoliciesLite,
  createPolicy,
  updatePolicy,
  activatePolicy,
  deactivatePolicy,
  expirePolicy,
  deletePolicy,
  restorePolicy,
} from "../controllers/discountPolicyController.js";
import { verifyAuth } from "../middleware/verifyAuth.js";


const router = Router();

// 🆔 UUID regex for safe :id routes
const UUIDv4 =
  "[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}";

/* ============================================================
   📌 DISCOUNT POLICY ROUTES
   ============================================================ */

// 🔍 List & Lookup
router.get("/", verifyAuth,  getAllPolicies);
router.get("/lite", verifyAuth,  getAllPoliciesLite);
router.get(`/:id(${UUIDv4})`, verifyAuth,  getPolicyById);

// ➕ Create / ✏️ Update / 🗑️ Delete
router.post("/", verifyAuth,  createPolicy);
router.put(`/:id(${UUIDv4})`, verifyAuth,  updatePolicy);
router.delete(`/:id(${UUIDv4})`, verifyAuth,  deletePolicy);

// 🔄 Lifecycle Actions
router.patch(`/:id(${UUIDv4})/activate`, verifyAuth,  activatePolicy);
router.patch(`/:id(${UUIDv4})/deactivate`, verifyAuth,  deactivatePolicy);
router.patch(`/:id(${UUIDv4})/expire`, verifyAuth,  expirePolicy);
router.post(`/:id(${UUIDv4})/restore`, verifyAuth,  restorePolicy);

/* ============================================================
   ✅ EXPORT
   ============================================================ */
export default router;
