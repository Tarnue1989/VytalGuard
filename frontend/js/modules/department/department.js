// 📦 department.js – Entry Point (Enterprise-Aligned Master Pattern)
// ============================================================================
// 🧭 Master Pattern: role.js / vitals.js
// 🔹 Unified initialization entry for the Department module
// 🔹 Handles module boot, imports, constants, and safe startup guard
// ============================================================================

/* ============================================================
   ✅ Imports
============================================================ */

// 🧭 Main module init (handles filter, table, card, etc.)
import { initDepartmentModule } from "./department-filter-main.js";

// ⚙️ Lifecycle + action handlers (view, edit, delete, toggle, etc.)
import "./department-actions.js";

// 🧩 Constants (exportable for dynamic field selector or columns)
import {
  FIELD_LABELS_DEPARTMENT,
  FIELD_ORDER_DEPARTMENT,
  FIELD_DEFAULTS_DEPARTMENT,
} from "./department-constants.js";

// 🛠 Utilities
import { showToast, hideLoading } from "../../utils/index.js";

/* ============================================================
   🚀 DOM-Ready Bootstrap
============================================================ */

document.addEventListener("DOMContentLoaded", async () => {
  try {
    // 🧩 Initialize only if the department form or list container exists
    if (
      document.getElementById("departmentForm") ||
      document.getElementById("departmentList")
    ) {
      await initDepartmentModule();
    }

    // (Optional) Future enhancement:
    // if (document.getElementById("departmentTableBody")) {
    //   await initDepartmentListModule();
    // }

  } catch (err) {
    console.error("❌ Failed to initialize Department module", err);
    hideLoading();
    showToast("❌ Failed to load Department module");
  }
});
