// 📁 backend/src/routes/patientChartRoutes.js
// -----------------------------------------------------------------------------
// Enterprise Patient Chart Routes
// Provides unified endpoints for full chart retrieval, cache control, notes,
// and timeline — fully aligned with enterprise HMS caching & audit standards.
// -----------------------------------------------------------------------------

import { Router } from "express";
import { verifyAuth } from "../middleware/verifyAuth.js";

import { patientChartController } from "../controllers/patientChartController.js";

const router = Router();

// 🆔 UUID regex for safe :id routes
const UUIDv4 =
  "[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}";

/* ============================================================
   📋 PATIENT CHART CACHE LIST
   → Used by patientchart-filter-main.js
   🔐 Permission: patient_charts:view
============================================================ */
router.get(
  `/`,
  verifyAuth,
  
  patientChartController.listCachedCharts
);

/* ============================================================
   🧠 PATIENT CHART (Full Chart + Summary + Timeline)
============================================================ */

// 🔍 Fetch full or partial chart (auto-cache + audit)
router.get(
  `/patient/:patient_id(${UUIDv4})`,
  verifyAuth,
  
  patientChartController.getPatientChart
);

// 📄 Lightweight patient summary (dashboard cards)
router.get(
  `/patient/:patient_id(${UUIDv4})/summary`,
  verifyAuth,
  
  patientChartController.getPatientSummary
);

// 🕒 Unified chronological timeline
router.get(
  `/patient/:patient_id(${UUIDv4})/timeline`,
  verifyAuth,
  
  patientChartController.getPatientTimeline
);

/* ============================================================
   🧩 CACHE MANAGEMENT
============================================================ */

// 🚫 Invalidate patient chart cache manually
router.post(
  `/patient/:patient_id(${UUIDv4})/cache/invalidate`,
  verifyAuth,
  
  patientChartController.invalidateCache
);

/* ============================================================
   👁️ VIEW LOGS (Audit trail of chart access)
   🔐 Permission: patient_chart_logs:view
============================================================ */
router.get(
  `/patient/:patient_id(${UUIDv4})/view-logs`,
  verifyAuth,
  
  patientChartController.getViewLogs
);

/* ============================================================
   🗒️ NOTES MANAGEMENT
============================================================ */

// 📄 Global list of all notes (filterable)
router.get(
  `/notes`,
  verifyAuth,
  
  patientChartController.listAllNotes
);

// 📋 List all notes for a patient
router.get(
  `/patient/:patient_id(${UUIDv4})/notes`,
  verifyAuth,
  
  patientChartController.listNotes
);

// ➕ Create a new note
router.post(
  `/patient/:patient_id(${UUIDv4})/notes`,
  verifyAuth,
  
  patientChartController.createNote
);

// ✏️ Update existing note
router.put(
  `/notes/:note_id(${UUIDv4})`,
  verifyAuth,
  
  patientChartController.updateNote
);

// 🗑️ Soft delete a note
router.delete(
  `/notes/:note_id(${UUIDv4})`,
  verifyAuth,
  
  patientChartController.deleteNote
);

// 🧾 Review or verify note (query: ?mode=review|verify)
router.post(
  `/notes/:note_id(${UUIDv4})/review`,
  verifyAuth,
  
  patientChartController.verifyOrReviewNote
);

/* ============================================================
   ✅ EXPORT
============================================================ */
export default router;
