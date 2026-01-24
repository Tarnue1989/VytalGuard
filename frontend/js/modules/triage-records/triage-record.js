// 📦 triage-record.js – Entry Point (Enterprise-Aligned Master Pattern)
// ============================================================================
// 🧭 Master Pattern: vitals.js
// 🔹 Unified initialization entry for the Triage Record module
// 🔹 Handles module boot, imports, constants, and safe startup guard
// 🔹 NO business logic, NO API calls
// ============================================================================

/* ============================================================
   ✅ Imports
============================================================ */

// 🧭 Main module init (handles filters, table, card, pagination, etc.)
import { initTriageRecordModule } from "./triage-record-filter-main.js";

// ⚙️ Lifecycle + action handlers (side-effect import only)
import "./triage-record-actions.js";

// 🧩 Constants (exportable for dynamic field selector or columns)
import {
  FIELD_LABELS_TRIAGE_RECORD,
  FIELD_ORDER_TRIAGE_RECORD,
  FIELD_DEFAULTS_TRIAGE_RECORD,
} from "./triage-record-constants.js";

// 🛠 Utilities
import { showToast, hideLoading } from "../../utils/index.js";

/* ============================================================
   🚀 DOM-Ready Bootstrap
============================================================ */

document.addEventListener("DOMContentLoaded", async () => {
  try {
    // 🧩 Initialize ONLY if triage form or list exists
    if (
      document.getElementById("triageRecordForm") ||
      document.getElementById("triageRecordList") ||
      document.getElementById("triageRecordTableBody")
    ) {
      await initTriageRecordModule();
    }
  } catch (err) {
    console.error("❌ Failed to initialize Triage Record module", err);
    hideLoading();
    showToast("❌ Failed to load Triage Record module");
  }
});
