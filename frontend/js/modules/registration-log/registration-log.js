// 📦 registrationLog.js – Entry Point (Enterprise-Aligned Master Pattern)
// ============================================================================
// 🧭 Master Pattern: department.js / role.js / vitals.js
// 🔹 Unified initialization entry for the Registration Log module
// 🔹 Handles module boot, imports, constants, and safe startup guard
// 🔹 NO business logic, NO API calls here
// ============================================================================

/* ============================================================
   ✅ Imports
============================================================ */

// 🧭 Main module init (handles filters, table, card, pagination, etc.)
import { initRegistrationLogModule } from "./registrationLog-filter-main.js";

// ⚙️ Lifecycle + action handlers (view, edit, delete, toggle, workflow)
import "./registration-log-actions.js";

// 🧩 Constants (exportable for dynamic field selector or columns)
import {
  FIELD_LABELS_REGISTRATION_LOG,
  FIELD_ORDER_REGISTRATION_LOG,
  FIELD_DEFAULTS_REGISTRATION_LOG,
} from "./registration-log-constants.js";

// 🛠 Utilities
import { showToast, hideLoading } from "../../utils/index.js";

/* ============================================================
   🚀 DOM-Ready Bootstrap
============================================================ */

document.addEventListener("DOMContentLoaded", async () => {
  try {
    // 🧩 Initialize ONLY if registration log form or list exists
    if (
      document.getElementById("registrationLogForm") ||
      document.getElementById("registrationLogList") ||
      document.getElementById("registrationLogTableBody")
    ) {
      await initRegistrationLogModule();
    }

    // (Optional future enhancement)
    // if (document.getElementById("registrationLogTableBody")) {
    //   await initRegistrationLogListModule();
    // }

  } catch (err) {
    console.error("❌ Failed to initialize Registration Log module", err);
    hideLoading();
    showToast("❌ Failed to load Registration Log module");
  }
});
