// 📦 cash-activity.js – Entry Point (Enterprise MASTER Pattern)
// ============================================================================
// 🧭 Mirrors payments.js / deposits.js
// 🔹 Initializes Cash Activity (Ledger) module
// 🔹 Safe boot + error handling
// 🔹 NO direct logic here
// ============================================================================

/* ============================================================
   ✅ Imports
============================================================ */

// 🧭 Main module init (filters, table, card, pagination, summary)
import { initCashActivityModule } from "./cash-activity-filter-main.js";

// ⚙️ (No actions import — READ ONLY module)

// 🧩 Constants (for parity / future use)
import {
  FIELD_LABELS_CASH_ACTIVITY,
  FIELD_ORDER_CASH_ACTIVITY,
  FIELD_DEFAULTS_CASH_ACTIVITY,
} from "./cash-activity-constants.js";

// 🛠 Utilities
import { showToast, hideLoading } from "../../utils/index.js";

/* ============================================================
   🚀 DOM-Ready Bootstrap
============================================================ */
document.addEventListener("DOMContentLoaded", async () => {
  try {
    // 🔐 Only initialize if page has ledger UI
    if (
      document.getElementById("cashActivityList") ||
      document.getElementById("cashActivityTableBody")
    ) {
      await initCashActivityModule();
    }

  } catch (err) {
    console.error("❌ Failed to initialize Cash Activity module", err);
    hideLoading();
    showToast("❌ Failed to load Cash Activity");
  }
});