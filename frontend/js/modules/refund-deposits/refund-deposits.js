// 📦 refund-deposits.js – Entry Point (Enterprise-Aligned MASTER Pattern)
// ============================================================================
// 🧭 Master Pattern: deposits.js / consultation.js / department.js
// 🔹 Unified initialization entry for the Refund Deposit module
// 🔹 Handles module boot, imports, constants, and safe startup guard
// ============================================================================

/* ============================================================
   ✅ Imports
============================================================ */

// 🧭 Main module init (handles filter, table, card, pagination, summary, export)
import { initRefundDepositModule } from "./refund-deposits-filter-main.js";

// ⚙️ Lifecycle + action handlers (view, edit, delete, approve, process, reverse, void, restore)
import "./refund-deposits-actions.js";

// 🧩 Constants (exportable for dynamic field selector or columns)
import {
  FIELD_LABELS_REFUND_DEPOSIT,
  FIELD_ORDER_REFUND_DEPOSIT,
  FIELD_DEFAULTS_REFUND_DEPOSIT,
} from "./refund-deposits-constants.js";

// 🛠 Utilities
import { showToast, hideLoading } from "../../utils/index.js";

/* ============================================================
   🚀 DOM-Ready Bootstrap
============================================================ */
document.addEventListener("DOMContentLoaded", async () => {
  try {
    // 🧩 Initialize only if the refund-deposit form or list container exists
    if (
      document.getElementById("refundDepositForm") ||
      document.getElementById("refundDepositList") ||
      document.getElementById("refundDepositTableBody")
    ) {
      await initRefundDepositModule();
    }

    // (Optional future expansion – list-only init hook)
    // if (document.getElementById("refundDepositTableBody")) {
    //   await initRefundDepositListModule();
    // }

  } catch (err) {
    console.error("❌ Failed to initialize Refund Deposit module", err);
    hideLoading();
    showToast("❌ Failed to load Refund Deposit module");
  }
});
