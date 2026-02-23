// 📦 labrequest.js – Entry Point (Enterprise-Aligned MASTER Pattern)
// ============================================================================
// 🧭 Master Pattern: deposits.js / consultation.js / department.js
// 🔹 Unified initialization entry for the Lab Request module
// 🔹 Handles module boot, imports, constants, and safe startup guard
// 🔹 FULL parity with consultation.js MASTER
// ============================================================================

/* ============================================================
   ✅ Imports
============================================================ */

// 🧭 Main module init (handles filter, table, card, pagination, export)
import { initLabRequestModule } from "./lab-request-filter-main.js";

// ⚙️ Lifecycle + action handlers (view, edit, delete, submit, complete, cancel, void)
import "./lab-request-actions.js";

// 🧩 Constants (exportable for dynamic field selector or columns)
import {
  FIELD_LABELS_LAB_REQUEST,
  FIELD_ORDER_LAB_REQUEST,
  FIELD_DEFAULTS_LAB_REQUEST,
} from "./lab-request-constants.js";

// 🛠 Utilities
import { showToast, hideLoading } from "../../utils/index.js";

/* ============================================================
   🚀 DOM-Ready Bootstrap
============================================================ */
document.addEventListener("DOMContentLoaded", async () => {
  try {
    // 🧩 Initialize only if Lab Request form OR list/table container exists
    if (
      document.getElementById("labRequestForm") ||
      document.getElementById("labRequestList") ||
      document.getElementById("labRequestTableBody")
    ) {
      await initLabRequestModule();
    }

    // (Optional future expansion – list-only init hook)
    // if (document.getElementById("labRequestTableBody")) {
    //   await initLabRequestListModule();
    // }

  } catch (err) {
    console.error("❌ Failed to initialize Lab Request module", err);
    hideLoading();
    showToast("❌ Failed to load Lab Request module");
  }
});
