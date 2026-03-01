// 📦 lab-result.js – Enterprise Entry Point (Master Pattern Aligned)
// ============================================================================
// 🧭 Mirrors patient.js / consultation.js for unified lifecycle and reliability
// 🔹 Handles initialization for lab result form + list lifecycle
// 🔹 Safe boot pattern with error fallback and spinner release
// 🔹 NO business logic, NO loaders, NO RBAC branching
// ============================================================================

/* ============================================================
   ✅ Imports
============================================================ */

// 🧭 Main module init (handles lab result form + list logic)
import { initLabResultModule } from "./lab-result-main.js";

// ⚙️ Lifecycle + action handlers (view, edit, delete, submit, verify, etc.)
import "./lab-result-actions.js";

// 🧩 Constants (exportable for dynamic field selectors / UI builders)
import {
  FIELD_LABELS_LAB_RESULT,
  FIELD_ORDER_LAB_RESULT,
  FIELD_DEFAULTS_LAB_RESULT,
} from "./lab-result-constants.js";

// 🛠 Utilities
import { showToast, hideLoading } from "../../utils/index.js";

/* ============================================================
   🌍 Optional Global Exposure (Parity with other modules)
============================================================ */
window.LAB_RESULT_CONSTANTS = {
  FIELD_LABELS_LAB_RESULT,
  FIELD_ORDER_LAB_RESULT,
  FIELD_DEFAULTS_LAB_RESULT,
};

/* ============================================================
   🚀 DOM-Ready Bootstrap (MASTER SAFE BOOT)
============================================================ */
document.addEventListener("DOMContentLoaded", async () => {
  try {
    // 🧩 Initialize ONLY if Lab Result UI exists (form or list)
    if (
      document.getElementById("labResultForm") ||
      document.getElementById("labResultList") ||
      document.getElementById("labResultTableBody")
    ) {
      await initLabResultModule();
    }

    // (Optional future expansion – list-only init hook)
    // if (document.getElementById("labResultTableBody")) {
    //   await initLabResultListModule();
    // }

  } catch (err) {
    console.error("❌ Failed to initialize Lab Result module", err);
    hideLoading(); // prevent spinner lock
    showToast("❌ Failed to load Lab Result module");
  }
});