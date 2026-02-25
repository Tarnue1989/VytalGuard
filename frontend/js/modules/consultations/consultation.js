// 📦 consultation.js – Entry Point (Enterprise-Aligned MASTER Pattern)
// ============================================================================
// 🧭 Master Pattern: deposits.js / consultation.js / department.js
// 🔹 Unified initialization entry for the Consultation module
// 🔹 Handles module boot, imports, constants, and safe startup guard
// 🔹 FULL parity with deposits.js MASTER
// ============================================================================

/* ============================================================
   ✅ Imports
============================================================ */

// 🧭 Main module init (handles filter, table, card, pagination, summary, export)
import { initConsultationModule } from "./consultation-filter-main.js";

// ⚙️ Lifecycle + action handlers (view, edit, delete, start, complete, verify, cancel, void)
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
    // 🧩 Initialize only if consultation form or list/table container exists
    if (
      document.getElementById("consultationForm") ||
      document.getElementById("consultationList") ||
      document.getElementById("consultationTableBody")
    ) {
      await initConsultationModule();
    }

    // (Optional future expansion – list-only init hook)
    // if (document.getElementById("consultationTableBody")) {
    //   await initConsultationListModule();
    // }

  } catch (err) {
    console.error("❌ Failed to initialize Consultation module", err);
    hideLoading();
    showToast("❌ Failed to load Consultation module");
  }
});
