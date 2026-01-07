// 📦 medicalRecord.js – Entry Point (Enterprise-Aligned)
// ============================================================================
// 🧭 Master Pattern: consultation.js
// Handles bootstrapping, module initialization, and error safety.
// ============================================================================

/* ============================================================
   ✅ Imports
============================================================ */

// 🧭 Main module init (handles filters, list, or form setup)
import { initMedicalRecordModule } from "./medical-record-filter-main.js";

// ⚙️ Lifecycle & action handlers (view, edit, delete, verify, etc.)
import "./medical-record-actions.js";

// 🧩 Constants (exportable for UI builders or reports)
import {
  FIELD_LABELS_MEDICAL_RECORD,
  FIELD_ORDER_MEDICAL_RECORD,
  FIELD_DEFAULTS_MEDICAL_RECORD,
} from "./medical-record-constants.js";

// 🛠 Utilities
import { showToast, hideLoading } from "../../utils/index.js";

/* ============================================================
   🚀 DOM-Ready Bootstrap
============================================================ */

document.addEventListener("DOMContentLoaded", async () => {
  try {
    // 🧩 Initialize only if form or list container is found
    if (document.getElementById("medicalRecordForm")) {
      await initMedicalRecordModule();
    }

    // (Optional) Future support:
    // if (document.getElementById("medicalRecordTableBody")) {
    //   await initMedicalRecordListModule();
    // }

  } catch (err) {
    console.error("❌ Failed to initialize Medical Record module", err);
    hideLoading();
    showToast("❌ Failed to load Medical Record module");
  }
});
