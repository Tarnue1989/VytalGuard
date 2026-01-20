// 📦 billableitem.js – Entry Point (Enterprise-Aligned Master Pattern)
// ============================================================================
// 🧭 Master Pattern: department.js / role.js / vitals.js
// 🔹 Unified initialization entry for the Billable Item module
// 🔹 Handles form + filter/list bootstrapping safely
// 🔹 Enterprise-grade startup guard, constants exposure, and error handling
// ============================================================================

/* ============================================================
   ✅ Imports
============================================================ */

// 🧭 Main module init (filters, table, card, pagination, summary)
import { initBillableItemModule } from "./billableitem-filter-main.js";

// ⚙️ Lifecycle + action handlers (edit, delete, toggle, view)
import "./billableitem-actions.js";

// 🧩 Constants (exportable for field selector / dynamic UI)
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
    // 🧩 Initialize only if billable item form or list is present
    if (
      document.getElementById("billableItemForm") ||
      document.getElementById("billableItemList")
    ) {
      await initBillableItemModule();
    }

    // (Reserved – future split initializers)
    // if (document.getElementById("billableItemTableBody")) {
    //   await initBillableItemListModule();
    // }

  } catch (err) {
    console.error("❌ Failed to initialize Billable Item module", err);
    hideLoading();
    showToast("❌ Failed to load Billable Item module");
  }
});
