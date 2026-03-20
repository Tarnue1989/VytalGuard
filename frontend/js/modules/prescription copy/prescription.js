// 📦 prescription.js – Entry Point (Master Pattern Aligned)
// ============================================================
// 🧭 Enterprise-standard entrypoint structure
// Aligned with labrequest.js (form + filter unified bootstrap)
// ============================================================

/* ============================================================
   ✅ Imports
============================================================ */

// 🧭 Main module init (handles filters + form view)
import { initPrescriptionModule } from "./prescription-filter-main.js";

// ⚙️ Lifecycle and action handlers (view/edit/delete/verify/etc.)
import "./prescription-actions.js";

// 🧩 Constants (exportable for dynamic UI or external integration)
import {
  FIELD_LABELS_PRESCRIPTION,
  FIELD_ORDER_PRESCRIPTION,
  FIELD_DEFAULTS_PRESCRIPTION,
} from "./prescription-constants.js";

// 🛠 Utilities
import { showToast, hideLoading } from "../../utils/index.js";

/* ============================================================
   🚀 DOM-Ready Bootstrap
============================================================ */
document.addEventListener("DOMContentLoaded", async () => {
  try {
    // 🧩 Initialize only if prescription form or list exists
    if (document.getElementById("prescriptionForm")) {
      await initPrescriptionModule(); // unified (form page)
    }

    // (Optional) future expansion:
    // if (document.getElementById("prescriptionTableBody")) {
    //   await initPrescriptionListModule();
    // }

  } catch (err) {
    console.error("❌ Failed to initialize Prescription module", err);
    hideLoading();
    showToast("❌ Failed to load Prescription module");
  }
});

/* ============================================================
   📦 Re-exports
============================================================ */
export {
  FIELD_LABELS_PRESCRIPTION,
  FIELD_ORDER_PRESCRIPTION,
  FIELD_DEFAULTS_PRESCRIPTION,
};
