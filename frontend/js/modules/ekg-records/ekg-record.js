// 📦 ekg-record.js – Entry Point (Enterprise-Aligned Master Pattern)
// ============================================================================
// 🧭 Master Pattern: registrationLog.js / department.js / vitals.js
// 🔹 Unified initialization entry for the EKG Record module
// 🔹 Handles module boot, imports, constants, and safe startup guard
// 🔹 NO business logic, NO API calls here
// ============================================================================

/* ============================================================
   ✅ Imports
============================================================ */

// 🧭 Main module init (handles filters, table, card, pagination, etc.)
import { initEKGRecordModule } from "./ekg-record-filter-main.js";

// ⚙️ Lifecycle + action handlers (side-effect import only)
import "./ekg-record-actions.js";

// 🧩 Constants (exportable for dynamic field selector or columns)
import {
  FIELD_LABELS_EKG_RECORD,
  FIELD_ORDER_EKG_RECORD,
  FIELD_DEFAULTS_EKG_RECORD,
} from "./ekg-record-constants.js";

// 🛠 Utilities
import { showToast, hideLoading } from "../../utils/index.js";

/* ============================================================
   🚀 DOM-Ready Bootstrap
============================================================ */

document.addEventListener("DOMContentLoaded", async () => {
  try {
    // 🧩 Initialize ONLY if EKG record form or list exists
    if (
      document.getElementById("ekgRecordForm") ||
      document.getElementById("ekgRecordList") ||
      document.getElementById("ekgRecordTableBody")
    ) {
      await initEKGRecordModule();
    }

  } catch (err) {
    console.error("❌ Failed to initialize EKG Record module", err);
    hideLoading();
    showToast("❌ Failed to load EKG Record module");
  }
});
