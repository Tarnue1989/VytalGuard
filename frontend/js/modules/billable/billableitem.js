// 📦 billableitem.js – Entry Point (Enterprise-Aligned Master Pattern)
// ============================================================================
// 🧭 Master Pattern: department.js / role.js / vitals.js
// 🔹 Unified initialization entry for the Billable Item module
// 🔹 Handles form + list bootstrapping with full enterprise guards
// 🔹 Safe startup, consistent constants import, and robust error handling
// ============================================================================

/* ============================================================
   ✅ Imports
============================================================ */

// 🧭 Main module initializer (handles filters, table, card, etc.)
import { initBillableItemModule } from "./billableitem-filter-main.js";

// ⚙️ Lifecycle + action handlers (view, edit, delete, toggle, etc.)
import "./billableitem-actions.js";

// 🧩 Constants (exportable for field selector or dynamic column setup)
import {
  FIELD_LABELS_BILLABLE_ITEM,
  FIELD_ORDER_BILLABLE_ITEM,
  FIELD_DEFAULTS_BILLABLE_ITEM,
} from "./billableitem-constants.js";

// 🛠 Utilities
import { showToast, hideLoading } from "../../utils/index.js";

/* ============================================================
   🚀 DOM-Ready Bootstrap
============================================================ */
document.addEventListener("DOMContentLoaded", async () => {
  try {
    // 🧩 Initialize module only if relevant form or list exists
    if (
      document.getElementById("billableItemForm") ||
      document.getElementById("billableItemList")
    ) {
      await initBillableItemModule();
    }

    // (Optional) Future enhancement:
    // if (document.getElementById("billableItemTableBody")) {
    //   await initBillableItemListModule();
    // }

  } catch (err) {
    console.error("❌ Failed to initialize Billable Item module", err);
    hideLoading();
    showToast("❌ Failed to load Billable Item module");
  }
});
