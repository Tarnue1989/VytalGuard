// 📦 vitals.js – Entry Point (Enterprise-Aligned Master Pattern)
// ============================================================================
// 🧭 Master Pattern: consultation.js
// 🔹 Unified initialization entry for the Vital module
// 🔹 Handles module boot, imports, constants, and safe startup guard
// ============================================================================

/* ============================================================
   ✅ Imports
============================================================ */

// 🧭 Main module init (handles filter, table, card, etc.)
import { initVitalModule } from "./vital-filter-main.js";

// ⚙️ Lifecycle + action handlers (view, edit, delete, verify, void, etc.)
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
    // 🧩 Only initialize if the vital form or list container exists
    if (document.getElementById("vitalForm")) {
      await initVitalModule();
    }

    // (Optional) Future enhancement:
    // if (document.getElementById("vitalTableBody")) {
    //   await initVitalListModule();
    // }

  } catch (err) {
    console.error("❌ Failed to initialize Vital module", err);
    hideLoading();
    showToast("❌ Failed to load Vital module");
  }
});
