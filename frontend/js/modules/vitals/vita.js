// 📦 vitals.js – Entry Point (Enterprise-Aligned Master Pattern)
// ============================================================================
// 🧭 Master Pattern: registrationLog.js / department.js / ekg-record.js
// 🔹 Unified initialization entry for the Vital module
// 🔹 Handles module boot, imports, constants, and safe startup guard
// 🔹 NO business logic, NO API calls here
// ============================================================================

/* ============================================================
   ✅ Imports
============================================================ */

// 🧭 Main module init (handles filters, table, card, pagination, etc.)
import { initVitalModule } from "./vital-filter-main.js";

// ⚙️ Lifecycle + action handlers (side-effect import only)
import "./vital-actions.js";

// 🧩 Constants (exportable for dynamic field selector or columns)
import {
  FIELD_LABELS_VITAL,
  FIELD_ORDER_VITAL,
  FIELD_DEFAULTS_VITAL,
} from "./vital-constants.js";

// 🛠 Utilities
import { showToast, hideLoading } from "../../utils/index.js";

/* ============================================================
   🚀 DOM-Ready Bootstrap
============================================================ */

document.addEventListener("DOMContentLoaded", async () => {
  try {
    // 🧩 Initialize ONLY if Vital form or list exists
    if (
      document.getElementById("vitalForm") ||
      document.getElementById("vitalList") ||
      document.getElementById("vitalTableBody")
    ) {
      await initVitalModule();
    }
  } catch (err) {
    console.error("❌ Failed to initialize Vital module", err);
    hideLoading();
    showToast("❌ Failed to load Vital module");
  }
});
