// 📦 consultation.js – Entry Point (Enterprise-Aligned Master Pattern)
// ============================================================================
// 🧭 Master Pattern: department.js / role.js / vitals.js
// 🔹 Unified initialization entry for the Consultation module
// 🔹 Handles module boot, imports, constants, and safe startup guard
// ============================================================================

/* ============================================================
   ✅ Imports
============================================================ */

// 🧭 Main module init (handles filter, table, card, form, etc.)
import { initConsultationModule } from "./consultation-filter-main.js";

// ⚙️ Lifecycle + action handlers (view, edit, delete, start, complete, etc.)
import "./consultation-actions.js";

// 🧩 Constants (exportable for dynamic field selector or columns)
import {
  FIELD_LABELS_CONSULTATION,
  FIELD_ORDER_CONSULTATION,
  FIELD_DEFAULTS_CONSULTATION,
} from "./consultation-constants.js";

// 🛠 Utilities
import { showToast, hideLoading } from "../../utils/index.js";

/* ============================================================
   🚀 DOM-Ready Bootstrap
============================================================ */
document.addEventListener("DOMContentLoaded", async () => {
  try {
    // 🧩 Initialize only if the consultation form or list container exists
    if (
      document.getElementById("consultationForm") ||
      document.getElementById("consultationList")
    ) {
      await initConsultationModule();
    }

    // (Optional) Future enhancement:
    // if (document.getElementById("consultationTableBody")) {
    //   await initConsultationListModule();
    // }

  } catch (err) {
    console.error("❌ Failed to initialize Consultation module", err);
    hideLoading();
    showToast("❌ Failed to load Consultation module");
  }
});
