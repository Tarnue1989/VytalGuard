// 📦 patient-insurances.js – Entry Point (Enterprise-Aligned MASTER Pattern)
// ============================================================================
// 🧭 Master Pattern: payments.js / deposits.js / consultation.js
// 🔹 Unified initialization entry for the Patient Insurance module
// 🔹 Handles safe boot, imports, constants, and error-guarded startup
// 🔹 NO direct action wiring here (handled internally by filter module)
// ============================================================================

/* ============================================================
   ✅ Imports
============================================================ */

// 🧭 Main module init (filters, table, card, pagination, summary, export)
import { initPatientInsuranceModule } from "./patient-insurance-filter-main.js";

// ⚙️ Lifecycle + action handlers (side-effect import, MASTER pattern)
import "./patient-insurance-actions.js";

// 🧩 Constants (kept for parity + future dynamic usage)
import {
  FIELD_LABELS_PATIENT_INSURANCE,
  FIELD_ORDER_PATIENT_INSURANCE,
  FIELD_DEFAULTS_PATIENT_INSURANCE,
} from "./patient-insurance-constants.js";

// 🛠 Utilities
import { showToast, hideLoading } from "../../utils/index.js";

/* ============================================================
   🚀 DOM-Ready Bootstrap
============================================================ */
document.addEventListener("DOMContentLoaded", async () => {
  try {
    // 🧩 Initialize only if form or list exists
    if (
      document.getElementById("patientInsuranceForm") ||
      document.getElementById("patientInsuranceList") ||
      document.getElementById("patientInsuranceTableBody")
    ) {
      await initPatientInsuranceModule();
    }

    // (Optional future expansion)
    // if (document.getElementById("patientInsuranceTableBody")) {
    //   await initPatientInsuranceListModule();
    // }

  } catch (err) {
    console.error("❌ Failed to initialize Patient Insurance module", err);
    hideLoading();
    showToast("❌ Failed to load Patient Insurance module");
  }
});