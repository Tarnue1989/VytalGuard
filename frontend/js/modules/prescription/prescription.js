// 📦 prescription.js – Entry Point (ENTERPRISE MASTER PARITY)
// ============================================================================
// 🧭 Master Pattern: labrequest.js / consultation.js / deposits.js
// 🔹 Unified initialization entry for the Prescription module
// 🔹 Handles module boot, imports, constants, and safe startup guard
// 🔹 FULL parity with labrequest.js MASTER
// ============================================================================

/* ============================================================
   ✅ Imports
============================================================ */

// 🧭 Main module init (handles filter, table, card, pagination, export)
import { initPrescriptionModule } from "./prescription-filter-main.js";

// ⚙️ Lifecycle + action handlers (view, edit, delete, verify, cancel, void)
import "./prescription-actions.js";

// 🧩 Constants (exportable for dynamic field selector or columns)
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
    // 🧩 Initialize only if Prescription form OR list/table container exists
    if (
      document.getElementById("prescriptionForm") ||
      document.getElementById("prescriptionList") ||
      document.getElementById("prescriptionTableBody")
    ) {
      await initPrescriptionModule();
    }

    // (Optional future expansion – list-only init hook)
    // if (document.getElementById("prescriptionTableBody")) {
    //   await initPrescriptionListModule();
    // }

  } catch (err) {
    console.error("❌ Failed to initialize Prescription module", err);
    hideLoading();
    showToast("❌ Failed to load Prescription module");
  }
});