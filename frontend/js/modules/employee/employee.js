// 📦 patient.js – Enterprise Entry Point (Master Pattern Aligned)
// ============================================================================
// 🔹 Mirrors consultation.js for unified structure, lifecycle, and safety
// 🔹 Fully compatible with patient-main.js + patient-actions.js
// ============================================================================

/* ============================================================
   ✅ Imports
============================================================ */

// 🧭 Main module init (handles form, filters, etc.)
import { initPatientModule } from "./patient-main.js";

// ⚙️ Lifecycle + action handlers (view, edit, delete, toggle, etc.)
import "./patient-actions.js";

// 🧩 Constants (exportable for dynamic UI or column builders)
import {
  FIELD_LABELS_PATIENT,
  FIELD_ORDER_PATIENT,
  FIELD_DEFAULTS_PATIENT,
} from "./patient-constants.js";

// 🛠 Utilities
import { showToast, hideLoading } from "../../utils/index.js";

/* ============================================================
   🚀 DOM-Ready Bootstrap
============================================================ */
document.addEventListener("DOMContentLoaded", async () => {
  try {
    // 🧩 Initialize only if relevant form or list exists
    if (document.getElementById("patientForm")) {
      await initPatientModule();
    }

    // 🧩 (Optional future extension)
    // if (document.getElementById("patientTableBody")) {
    //   await initPatientListModule();
    // }

  } catch (err) {
    console.error("❌ Failed to initialize patient module", err);
    hideLoading(); // ensure spinner doesn’t hang
    showToast("❌ Failed to load patient module");
  }
});
