// 📦 deposits.js – Entry Point (Enterprise-Aligned Master Pattern)
// ============================================================================
// 🧭 Master Pattern: consultation.js / department.js / role.js
// 🔹 Unified initialization entry for the Deposit module
// 🔹 Handles module boot, imports, constants, and safe startup guard
// ============================================================================

/* ============================================================
   ✅ Imports
============================================================ */

// 🧭 Main module init (handles filter, table, card, pagination, summary, export)
import { initDepositModule } from "./deposit-filter-main.js";

// ⚙️ Lifecycle + action handlers (view, edit, delete, apply, verify, cancel, etc.)
import "./deposit-actions.js";

// 🧩 Constants (exportable for dynamic field selector or columns)
import {
  FIELD_LABELS_DEPOSIT,
  FIELD_ORDER_DEPOSIT,
  FIELD_DEFAULTS_DEPOSIT,
} from "./deposit-constants.js";

// 🛠 Utilities
import { showToast, hideLoading } from "../../utils/index.js";

/* ============================================================
   🚀 DOM-Ready Bootstrap
============================================================ */
document.addEventListener("DOMContentLoaded", async () => {
  try {
    // 🧩 Initialize only if the deposit form or list container exists
    if (
      document.getElementById("depositForm") ||
      document.getElementById("depositList") ||
      document.getElementById("depositTableBody")
    ) {
      await initDepositModule();
    }

    // (Optional future expansion – list-only init hook)
    // if (document.getElementById("depositTableBody")) {
    //   await initDepositListModule();
    // }

  } catch (err) {
    console.error("❌ Failed to initialize Deposit module", err);
    hideLoading();
    showToast("❌ Failed to load Deposit module");
  }
});
