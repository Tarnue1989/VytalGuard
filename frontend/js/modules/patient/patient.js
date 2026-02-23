// 📦 patient.js – Enterprise Entry Point (Master Pattern Aligned)
// ============================================================================
// 🧭 Mirrors consultation.js & employee.js for unified lifecycle and reliability
// 🔹 Handles initialization for patient form and action lifecycle
// 🔹 Safe boot pattern with error fallback and spinner release
// 🔹 NO business logic, NO loaders, NO RBAC branching
// ============================================================================

/* ============================================================
   ✅ Imports
============================================================ */

// 🧭 Main module init (handles patient form logic)
import { initPatientModule } from "./patient-main.js";

// ⚙️ Lifecycle + action handlers (view, edit, delete, toggle, restore)
import "./patient-actions.js";

// 🧩 Constants (exportable for dynamic field selectors / UI builders)
import {
  FIELD_LABELS_PATIENT,
  FIELD_ORDER_PATIENT,
  FIELD_DEFAULTS_PATIENT,
} from "./patient-constants.js";

// 🛠 Utilities
import { showToast, hideLoading } from "../../utils/index.js";

/* ============================================================
   🚀 DOM-Ready Bootstrap (MASTER SAFE BOOT)
============================================================ */
document.addEventListener("DOMContentLoaded", async () => {
  try {
    // 🧩 Initialize ONLY if patient UI exists (form or list)
    if (
      document.getElementById("patientForm") ||
      document.getElementById("patientList") ||
      document.getElementById("patientTableBody")
    ) {
      await initPatientModule();
    }

    // (Optional future expansion – list-only init hook)
    // if (document.getElementById("patientTableBody")) {
    //   await initPatientListModule();
    // }

  } catch (err) {
    console.error("❌ Failed to initialize Patient module", err);
    hideLoading(); // prevent spinner lock
    showToast("❌ Failed to load Patient module");
  }
});
