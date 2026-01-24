// 📦 ultrasound-record.js – Entry Point (Enterprise-Aligned Master Pattern)
// ============================================================================
// 🧭 Master Pattern: delivery-record.js / ekg-record.js / registrationLog.js
// 🔹 Unified initialization entry for the Ultrasound Record module
// 🔹 Handles module boot, imports, constants, and safe startup guard
// 🔹 NO business logic
// 🔹 NO API calls
// ============================================================================

/* ============================================================
   ✅ Imports
============================================================ */

// 🧭 Main module init (filters, table, card, pagination, etc.)
import { initUltrasoundModule } from "./ultrasoundRecord-filter-main.js";

// ⚙️ Lifecycle + action handlers (side-effect import only)
import "./ultrasound-record-actions.js";

// 🧩 Constants (exportable for dynamic field selector or columns)
import {
  FIELD_LABELS_ULTRASOUND_RECORD,
  FIELD_ORDER_ULTRASOUND_RECORD,
  FIELD_DEFAULTS_ULTRASOUND_RECORD,
} from "./ultrasound-record-constants.js";

// 🛠 Utilities
import { showToast, hideLoading } from "../../utils/index.js";

/* ============================================================
   🚀 DOM-Ready Bootstrap
============================================================ */

document.addEventListener("DOMContentLoaded", async () => {
  try {
    // 🧩 Initialize ONLY if ultrasound record form or list exists
    if (
      document.getElementById("ultrasoundRecordForm") ||
      document.getElementById("ultrasoundRecordList") ||
      document.getElementById("ultrasoundRecordTableBody")
    ) {
      await initUltrasoundModule();
    }
  } catch (err) {
    console.error("❌ Failed to initialize Ultrasound Record module", err);
    hideLoading();
    showToast("❌ Failed to load Ultrasound Record module");
  }
});
