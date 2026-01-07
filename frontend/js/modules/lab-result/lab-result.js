// 📦 lab-result.js – Entry Point (Enterprise-Aligned Master Pattern)
// ============================================================
// 🧭 Unified Entry Loader for Lab Results (Aligned with Consultation Module)
// ============================================================

/* ============================================================
   ✅ Imports
============================================================ */

// 🧭 Main module initializer (handles form logic)
import { initLabResultModule } from "./lab-result-main.js";

// ⚙️ Lifecycle + action handlers (view, edit, delete, approve, verify, etc.)
import "./lab-result-actions.js";

// 🧩 Constants (exportable for field visibility, exports, or UI)
import {
  FIELD_LABELS_LAB_RESULT,
  FIELD_ORDER_LAB_RESULT,
  FIELD_DEFAULTS_LAB_RESULT,
} from "./lab-result-constants.js";

// 🛠 Utilities
import { showToast, hideLoading } from "../../utils/index.js";

/* ============================================================
   🔑 Optional Global Exposure
============================================================ */
window.LAB_RESULT_CONSTANTS = {
  FIELD_LABELS_LAB_RESULT,
  FIELD_ORDER_LAB_RESULT,
  FIELD_DEFAULTS_LAB_RESULT,
};

/* ============================================================
   🚀 DOM-Ready Bootstrap
============================================================ */
document.addEventListener("DOMContentLoaded", async () => {
  try {
    // 🧩 Initialize only if Lab Result Form is present
    if (document.getElementById("labResultForm")) {
      await initLabResultModule();
    }

    // 🧱 (Future Extension)
    // if (document.getElementById("labResultTableBody")) {
    //   await initLabResultListModule();
    // }

  } catch (err) {
    console.error("❌ Failed to initialize Lab Result module", err);
    hideLoading(); // prevent spinner hang
    showToast("❌ Failed to load Lab Result module");
  }
});
