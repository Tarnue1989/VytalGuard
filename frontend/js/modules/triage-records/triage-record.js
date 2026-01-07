// 📦 triage-record.js – Entry Point (Enterprise-Aligned Master Pattern)
// ============================================================================
// 🧭 Master Pattern: vitals.js
// 🔹 Unified initialization entry for the Triage Record module
// 🔹 Handles module boot, imports, constants, and safe startup guard
// ============================================================================

/* ============================================================
   ✅ Imports
============================================================ */

// 🧭 Main module init (handles form, filter, table, etc.)
import { initTriageRecordModule } from "./triage-record-filter-main.js";

// ⚙️ Lifecycle + action handlers (view, edit, delete, verify, void, etc.)
import "./triage-record-actions.js";

// 🧩 Constants (for dynamic field selector or column rendering)
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
    // 🧩 Initialize if this is a form page
    if (document.getElementById("triageRecordForm")) {
      await initTriageRecordModule();
    }

    // (Optional) Future enhancement:
    // if (document.getElementById("triageRecordTableBody")) {
    //   await initTriageRecordListModule();
    // }

  } catch (err) {
    console.error("❌ Failed to initialize Triage Record module", err);
    hideLoading();
    showToast("❌ Failed to load Triage Record module");
  }
});
