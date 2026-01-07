// 📦 master-item-category.js – Entry Point (Enterprise-Aligned Master Pattern)
// ============================================================================
// 🧭 Master Pattern: role.js / vitals.js
// 🔹 Unified initialization entry for the Master Item Category module
// 🔹 Handles module boot, imports, constants, and safe startup guard
// ============================================================================

/* ============================================================
   ✅ Imports
============================================================ */

// 🧭 Main module init (handles filter, table, card, etc.)
import { initMasterItemCategoryModule } from "./master-item-category-filter-main.js";

// ⚙️ Lifecycle + action handlers (view, edit, delete, toggle, etc.)
import "./master-item-category-actions.js";

// 🧩 Constants (exportable for dynamic field selector or columns)
import {
  FIELD_LABELS_MASTER_ITEM_CATEGORY,
  FIELD_ORDER_MASTER_ITEM_CATEGORY,
  FIELD_DEFAULTS_MASTER_ITEM_CATEGORY,
} from "./master-item-category-constants.js";

// 🛠 Utilities
import { showToast, hideLoading } from "../../utils/index.js";

/* ============================================================
   🚀 DOM-Ready Bootstrap
============================================================ */

document.addEventListener("DOMContentLoaded", async () => {
  try {
    // 🧩 Initialize only if the master item category form or list container exists
    if (
      document.getElementById("masterItemCategoryForm") ||
      document.getElementById("masterItemCategoryList")
    ) {
      await initMasterItemCategoryModule();
    }

    // (Optional) Future enhancement:
    // if (document.getElementById("masterItemCategoryTableBody")) {
    //   await initMasterItemCategoryListModule();
    // }

  } catch (err) {
    console.error("❌ Failed to initialize Master Item Category module", err);
    hideLoading();
    showToast("❌ Failed to load Master Item Category module");
  }
});
