// 📦 accounts.js – Entry Point (Enterprise-Aligned Master Pattern)
// ============================================================================
// 🧭 Master Pattern: consultation.js / department.js / role.js
// 🔹 Unified initialization entry for the Accounts module
// 🔹 Handles module boot, imports, constants, and safe startup guard
// ============================================================================

/* ============================================================
   ✅ Imports
============================================================ */

// 🧭 Main module init (filters, table/card, pagination, export)
import { initAccountModule } from "./accounts-filter-main.js";

// ⚙️ Actions (view, edit, delete)
import "./accounts-actions.js";

// 🧩 Constants (for field selector / columns)
import {
  FIELD_LABELS_ACCOUNT,
  FIELD_ORDER_ACCOUNT,
  FIELD_DEFAULTS_ACCOUNT,
} from "./accounts-constants.js";

// 🛠 Utilities
import { showToast, hideLoading } from "../../utils/index.js";

/* ============================================================
   🚀 DOM-Ready Bootstrap
============================================================ */
document.addEventListener("DOMContentLoaded", async () => {
  try {
    // 🧩 Initialize only if Accounts UI exists
    if (
      document.getElementById("accountList") ||
      document.getElementById("accountTableBody")
    ) {
      await initAccountModule();
    }

  } catch (err) {
    console.error("❌ Failed to initialize Accounts module", err);
    hideLoading();
    showToast("❌ Failed to load Accounts module");
  }
});