// 📁 backend/src/routes/organizationBrandingRoutes.js

import { Router } from "express";
import {
  getBranding,
  upsertBranding,
} from "../controllers/organizationBrandingController.js";

import { verifyAuth } from "../middleware/verifyAuth.js";

// 🔥 THIS IS THE MISSING PIECE
import { uploadBranding } from "../middleware/upload.js";

const router = Router();

/* ============================================================
   📌 ORGANIZATION BRANDING ROUTES
============================================================ */

// 🔍 Get branding (single per org)
router.get("/", verifyAuth, getBranding);

// ➕ Create / ✏️ Update (UPSERT)
// 🔥 FIXED: Added uploadBranding
router.post("/", verifyAuth, uploadBranding, upsertBranding);

/* ============================================================
   ✅ EXPORT
============================================================ */
export default router;