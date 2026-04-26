import { Router } from "express";
import { convertCurrency } from "../controllers/fxController.js";
import { verifyAuth } from "../middleware/verifyAuth.js";

const router = Router();

/* ============================================================
   📌 FX ROUTES
============================================================ */

router.post("/convert", verifyAuth, convertCurrency);

/* ============================================================
   ✅ EXPORT
============================================================ */
export default router;