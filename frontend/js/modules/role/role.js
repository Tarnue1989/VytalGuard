// 📦 role.js – Entry Point (Enterprise-Aligned Master Pattern)
// ============================================================================
// 🧭 Master Pattern: vitals.js
// 🔹 Unified initialization entry for the Role module
// 🔹 Handles module boot, imports, constants, and safe startup guard
// ============================================================================

/* ============================================================
   ✅ Imports
============================================================ */

// 🧭 Main module init (handles filter, table, card, etc.)
import { initRoleModule } from "./role-filter-main.js";

// ⚙️ Lifecycle + action handlers (view, edit, delete, toggle, etc.)
import "./role-actions.js";

// 🧩 Constants (exportable for dynamic field selector or columns)
import {
  FIELD_LABELS_ROLE,
  FIELD_ORDER_ROLE,
  FIELD_DEFAULTS_ROLE,
} from "./role-constants.js";

// 🛠 Utilities
import { showToast, hideLoading } from "../../utils/index.js";

/* ============================================================
   🚀 DOM-Ready Bootstrap
============================================================ */

document.addEventListener("DOMContentLoaded", async () => {
  try {
    // 🧩 Initialize only if the role form or list container exists
    if (document.getElementById("roleForm") || document.getElementById("roleList")) {
      await initRoleModule();
    }

    // (Optional) Future enhancement:
    // if (document.getElementById("roleTableBody")) {
    //   await initRoleListModule();
    // }

  } catch (err) {
    console.error("❌ Failed to initialize Role module", err);
    hideLoading();
    showToast("❌ Failed to load Role module");
  }
});
