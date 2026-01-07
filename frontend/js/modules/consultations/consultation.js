// 📦 consultation.js – Entry Point (Master Pattern)

/* ============================================================
   ✅ Imports
============================================================ */

// 🧭 Main module init (handles form, filters, etc.)
import { initConsultationModule } from "./consultation-filter-main.js";

// ⚙️ Lifecycle + action handlers (view, edit, delete, start, complete, etc.)
import "./consultation-actions.js";

// 🧩 Constants (exportable for dynamic UI or column builders)
import {
  FIELD_LABELS_CONSULTATION,
  FIELD_ORDER_CONSULTATION,
  FIELD_DEFAULTS_CONSULTATION,
} from "./consultation-constants.js";

// 🛠 Utilities
import { showToast, hideLoading } from "../../utils/index.js";

/* ============================================================
   🚀 DOM-Ready Bootstrap
============================================================ */

document.addEventListener("DOMContentLoaded", async () => {
  try {
    // 🧩 Only initialize if the consultation form or list is present
    if (document.getElementById("consultationForm")) {
      await initConsultationModule();
    }

    // (Optional) you can later detect a list/table container here:
    // if (document.getElementById("consultationTableBody")) {
    //   await initConsultationListModule();
    // }

  } catch (err) {
    console.error("❌ Failed to initialize consultation module", err);
    hideLoading();
    showToast("❌ Failed to load consultation module");
  }
});
