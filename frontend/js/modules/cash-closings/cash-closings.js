// 📦 cash-closings.js – Entry Point (Enterprise-Aligned Master Pattern)
// ============================================================================
// 🧭 Master Pattern: consultation.js / department.js / role.js
// 🔹 Unified initialization entry for the Cash Closing module
// 🔹 Handles module boot, imports, constants, and safe startup guard
// ============================================================================

/* ============================================================
   ✅ Imports
============================================================ */

// 🧭 Main module init (filter, table, card, pagination, export)
import { initCashClosingModule } from "./cash-closing-filter-main.js";

// ⚙️ Lifecycle + action handlers (view, reopen)
import "./cash-closing-actions.js";

// 🧩 Constants
import {
  FIELD_LABELS_CASH_CLOSING,
  FIELD_ORDER_CASH_CLOSING,
  FIELD_DEFAULTS_CASH_CLOSING,
} from "./cash-closing-constants.js";

// 🛠 Utilities
import { showToast, hideLoading } from "../../utils/index.js";

/* ============================================================
   🚀 DOM-Ready Bootstrap
============================================================ */
document.addEventListener("DOMContentLoaded", async () => {
  try {
    // 🧩 Initialize only if relevant DOM exists
    if (
      document.getElementById("cashClosingForm") ||
      document.getElementById("cashClosingList") ||
      document.getElementById("cashClosingTableBody")
    ) {
      await initCashClosingModule();
    }

    // (Optional future expansion)
    // if (document.getElementById("cashClosingTableBody")) {
    //   await initCashClosingListModule();
    // }

  } catch (err) {
    console.error("❌ Failed to initialize Cash Closing module", err);
    hideLoading();
    showToast("❌ Failed to load Cash Closing module");
  }
});