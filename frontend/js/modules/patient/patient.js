// 📦 patient.js – Enterprise Entry Point (Master Pattern Aligned)
// ============================================================================
// 🔹 Mirrors consultation.js & employee.js for unified lifecycle and reliability
// 🔹 Handles initialization for patient form and action lifecycle
// 🔹 Safe boot pattern with error fallback and spinner release
// ============================================================================

/* ============================================================
   ✅ Imports
============================================================ */

// 🧭 Main module init (handles patient form & related logic)
import { initPatientModule } from "./patient-main.js";

// ⚙️ Lifecycle + action handlers (view, edit, delete, toggle, etc.)
import "./patient-actions.js";

// 🧩 Constants (exportable for dynamic column builders or UI setups)
import {
  FIELD_LABELS_PATIENT,
  FIELD_ORDER_PATIENT,
  FIELD_DEFAULTS_PATIENT,
} from "./patient-constants.js";

// 🛠️ Utilities
import { showToast, hideLoading } from "../../utils/index.js";

/* ============================================================
   🚀 DOM-Ready Bootstrap
============================================================ */
document.addEventListener("DOMContentLoaded", async () => {
  try {
    // 🧩 Initialize if form exists
    if (document.getElementById("patientForm")) {
      await initPatientModule();
    }

    // 🧩 (Optional: future expansion – list view)
    // if (document.getElementById("patientTableBody")) {
    //   await initPatientListModule();
    // }

  } catch (err) {
    console.error("❌ Failed to initialize patient module:", err);
    hideLoading(); // prevent stuck loader
    showToast("❌ Failed to load Patient module");
  }
});
