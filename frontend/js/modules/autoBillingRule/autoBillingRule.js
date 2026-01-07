// 📦 autoBillingRule.js – Entry Point (Enterprise-Aligned Master Pattern)
// ============================================================================
// 🧭 Master Pattern: billableitem.js / department.js / role.js / vitals.js
// 🔹 Unified initialization entry for the Auto Billing Rule module
// 🔹 Handles form + list bootstrapping with full enterprise guards
// 🔹 Safe startup, consistent constants import, and robust error handling
// ============================================================================

/* ============================================================
   ✅ Imports
============================================================ */

// 🧭 Main module initializer (handles filters, table, card, etc.)
import { initAutoBillingRuleModule } from "./autoBillingRule-filter-main.js";

// ⚙️ Lifecycle + action handlers (view, edit, delete, toggle, etc.)
import "./autoBillingRule-actions.js";

// 🧩 Constants (exportable for field selector or dynamic column setup)
import {
  FIELD_LABELS_AUTO_BILLING_RULE,
  FIELD_ORDER_AUTO_BILLING_RULE,
  FIELD_DEFAULTS_AUTO_BILLING_RULE,
} from "./autoBillingRule-constants.js";

// 🛠 Utilities
import { showToast, hideLoading } from "../../utils/index.js";

/* ============================================================
   🚀 DOM-Ready Bootstrap
============================================================ */
document.addEventListener("DOMContentLoaded", async () => {
  try {
    // 🧩 Initialize module only if relevant form or list exists
    if (
      document.getElementById("autoBillingRuleForm") ||
      document.getElementById("autoBillingRuleList")
    ) {
      await initAutoBillingRuleModule();
    }

    // (Optional) Future enhancement:
    // if (document.getElementById("autoBillingRuleTableBody")) {
    //   await initAutoBillingRuleListModule();
    // }

  } catch (err) {
    console.error("❌ Failed to initialize Auto Billing Rule module", err);
    hideLoading();
    showToast("❌ Failed to load Auto Billing Rule module");
  }
});
