// 📦 master-item.js – Entry Point (Enterprise-Aligned Master Pattern)
// ============================================================================
// 🧭 Master Pattern: master-item-category.js / role.js / vitals.js
// 🔹 Unified initialization entry for the Master Item module
// 🔹 Handles module boot, imports, constants, and safe startup guard
// ============================================================================

/* ============================================================
   ✅ Imports
============================================================ */

// 🧭 Main module init (handles filter, table, card, etc.)
import { initMasterItemModule } from "./master-item-filter-main.js";

// ⚙️ Lifecycle + action handlers (view, edit, delete, toggle, etc.)
import "./master-item-actions.js";

// 🧩 Constants (exportable for dynamic field selector or columns)
import {
  FIELD_LABELS_MASTER_ITEM,
  FIELD_ORDER_MASTER_ITEM,
  FIELD_DEFAULTS_MASTER_ITEM,
} from "./master-item-constants.js";

// 🛠 Utilities
import { showToast, hideLoading } from "../../utils/index.js";

/* ============================================================
   🚀 DOM-Ready Bootstrap
============================================================ */

document.addEventListener("DOMContentLoaded", async () => {
  try {
    // 🧩 Initialize only if the Master Item form or list container exists
    if (
      document.getElementById("masterItemForm") ||
      document.getElementById("masterItemList") ||
      document.getElementById("masterItemTableBody")
    ) {
      await initMasterItemModule();
    }

    // (Optional) Future enhancement:
    // if (document.getElementById("masterItemTableBody")) {
    //   await initMasterItemListModule();
    // }

  } catch (err) {
    console.error("❌ Failed to initialize Master Item module", err);
    hideLoading(); // ensure spinner doesn’t hang
    showToast("❌ Failed to load Master Item module");
  }
});
