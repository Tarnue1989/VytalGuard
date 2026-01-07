// 📁 backend/src/routes/featureRoutes.js
import { Router } from "express";
import {
  getAllFeatureModules,
  getFeatureModuleById,
  getLiteFeatureModules,
  createFeatureModule,
  updateFeatureModule,
  deleteFeatureModule,
  toggleFeatureModuleEnabled,
  toggleFeatureModuleStatus,
  getAllFeatureAccesses,
  getFeatureAccessById,
  createFeatureAccess,
  updateFeatureAccess,
  replaceFeatureAccessByRole,
  deleteFeatureAccess,
  toggleFeatureAccessStatus,
  getAvailableModules,
} from "../controllers/featureController.js";

import { verifyAuth } from "../middleware/verifyAuth.js";


const router = Router();

/* ============================================================
   📌 FEATURE MODULE ROUTES (GLOBAL / SYSTEM-LEVEL)
   These define WHAT modules exist in the system
============================================================ */

// 🔍 List all feature modules
router.get("/feature-modules", verifyAuth, getAllFeatureModules);

// 🔍 Lite list (autocomplete / dropdown)
router.get("/feature-modules/list", verifyAuth, getLiteFeatureModules);

// 🔍 Single by ID
router.get("/feature-modules/:id", verifyAuth, getFeatureModuleById);

// ➕ Create
router.post("/feature-modules", verifyAuth, createFeatureModule);

// ✏️ Update
router.put("/feature-modules/:id", verifyAuth, updateFeatureModule);

// 🗑️ Delete
router.delete("/feature-modules/:id", verifyAuth, deleteFeatureModule);

// 🔄 Toggle enabled / status
router.patch(
  "/feature-modules/:id/toggle-enabled",
  verifyAuth,
  toggleFeatureModuleEnabled
);

router.patch(
  "/feature-modules/:id/toggle-status",
  verifyAuth,
  toggleFeatureModuleStatus
);

/* ============================================================
   📌 FEATURE ACCESS ROUTES (FACILITY-SCOPED)
   These control which facility can use which module
============================================================ */

// 🔍 List all feature accesses
router.get("/feature-access", verifyAuth,  getAllFeatureAccesses);

// 🔍 Single by ID
router.get("/feature-access/:id", verifyAuth,  getFeatureAccessById);

// ➕ Create
router.post("/feature-access", verifyAuth,  createFeatureAccess);

// ✏️ Update
router.put("/feature-access/:id", verifyAuth,  updateFeatureAccess);

// 🔄 Toggle status
router.patch(
  "/feature-access/:id/toggle-status",
  verifyAuth,
  
  toggleFeatureAccessStatus
);

// 🔁 Replace all by role
router.put(
  "/feature-access/by-role/:role_id",
  verifyAuth,
  
  replaceFeatureAccessByRole
);

// 🗑️ Delete
router.delete(
  "/feature-access/:id",
  verifyAuth,
  
  deleteFeatureAccess
);

/* ============================================================
   📌 AVAILABLE MODULES (ORG-LEVEL)
   Used by Modules & Settings tab
   ❌ NO facility required
============================================================ */

router.get(
  "/available-modules",
  verifyAuth,
  getAvailableModules
);

/* ============================================================
   ✅ EXPORT
============================================================ */
export default router;
