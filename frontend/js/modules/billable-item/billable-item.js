// 📦 billable-item.js – Entry Point (ENTERPRISE MASTER PARITY)
// ============================================================================
// 🧭 Master Pattern: labrequest.js / consultation.js / deposits.js
// 🔹 Unified initialization entry for the Billable Item module
// 🔹 Handles module boot, imports, constants, and safe startup guard
// 🔹 FULL parity with prescription.js MASTER
// ============================================================================

/* ============================================================
   ✅ Imports
============================================================ */

// 🧭 Main module init (handles filter, table, card, pagination, export)
import { initBillableItemModule } from "./billable-item-filter-main.js";

// ⚙️ Lifecycle + action handlers (view, edit, delete, toggle-status, restore)
import "./billable-item-actions.js";

// 🧩 Constants (exportable for dynamic field selector or columns)
import {
  FIELD_LABELS_BILLABLE_ITEM,
  FIELD_ORDER_BILLABLE_ITEM,
  FIELD_DEFAULTS_BILLABLE_ITEM,
} from "./billable-item-constants.js";

// 🛠 Utilities
import { showToast, hideLoading } from "../../utils/index.js";

/* ============================================================
   🚀 DOM-Ready Bootstrap
============================================================ */
document.addEventListener("DOMContentLoaded", async () => {
  try {
    // 🧩 Initialize only if form OR list/table container exists
    if (
      document.getElementById("billableItemForm") ||
      document.getElementById("billableItemList") ||
      document.getElementById("billableItemTableBody")
    ) {
      await initBillableItemModule();
    }

    // (Optional future expansion – list-only init hook)
    // if (document.getElementById("billableItemTableBody")) {
    //   await initBillableItemListModule();
    // }

  } catch (err) {
    console.error("❌ Failed to initialize Billable Item module", err);
    hideLoading();
    showToast("❌ Failed to load Billable Item module");
  }
});