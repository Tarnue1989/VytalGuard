// 📦 labrequest.js – Entry Point (Master Pattern Aligned)

/* ============================================================
   ✅ Imports
============================================================ */

// 🧭 Main module init (handles form + filters)
import { initLabRequestModule } from "./lab-request-filter-main.js";

// ⚙️ Lifecycle + action handlers (view, edit, delete, verify, etc.)
import "./lab-request-actions.js";

// 🧩 Constants (exportable for dynamic UI or column builders)
import {
  FIELD_LABELS_LAB_REQUEST,
  FIELD_ORDER_LAB_REQUEST,
  FIELD_DEFAULTS_LAB_REQUEST,
} from "./lab-request-constants.js";

// 🛠 Utilities
import { showToast, hideLoading } from "../../utils/index.js";

/* ============================================================
   🚀 DOM-Ready Bootstrap
============================================================ */

document.addEventListener("DOMContentLoaded", async () => {
  try {
    // 🧩 Only initialize if the Lab Request form or list is present
    if (document.getElementById("labRequestForm")) {
      await initLabRequestModule(); // form page or unified
    }

    // (Optional) future expansion:
    // if (document.getElementById("labRequestTableBody")) {
    //   await initLabRequestListModule();
    // }

  } catch (err) {
    console.error("❌ Failed to initialize Lab Request module", err);
    hideLoading();
    showToast("❌ Failed to load Lab Request module");
  }
});
