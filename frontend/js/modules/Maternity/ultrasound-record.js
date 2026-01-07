// 📦 ultrasoundRecord.js – Entry Point (Master Pattern Aligned)

/* ============================================================
   ✅ Imports
============================================================ */

// 🧭 Main module init (handles form, filters, etc.)
import { initUltrasoundModule } from "./ultrasound-record-filter-main.js";

// ⚙️ Lifecycle + action handlers (view, edit, delete, start, verify, etc.)
import "./ultrasound-record-actions.js";

// 🧩 Constants (exportable for dynamic UI or column builders)
import {
  FIELD_LABELS_ULTRASOUND_RECORD,
  FIELD_ORDER_ULTRASOUND_RECORD,
  FIELD_DEFAULTS_ULTRASOUND_RECORD,
} from "./ultrasound-record-constants.js";

// 🛠 Utilities
import { showToast, hideLoading } from "../../utils/index.js";

/* ============================================================
   🚀 DOM-Ready Bootstrap
============================================================ */

document.addEventListener("DOMContentLoaded", async () => {
  try {
    // 🧩 Only initialize if the ultrasound form or list is present
    if (document.getElementById("ultrasoundRecordForm")) {
      await initUltrasoundModule();
    }

    // (Optional) future expansion:
    // if (document.getElementById("ultrasoundRecordTableBody")) {
    //   await initUltrasoundListModule();
    // }

  } catch (err) {
    console.error("❌ Failed to initialize ultrasound module", err);
    hideLoading();
    showToast("❌ Failed to load ultrasound module");
  }
});
