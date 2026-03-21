// 📦 autoBillingRule.js – Entry Point (ENTERPRISE MASTER ALIGNED)
// ============================================================================
// 🧭 Mirrors registrationLog.js EXACTLY
// 🔹 Unified bootstrap entry for Auto Billing Rule module
// 🔹 Safe DOM-based initialization guard
// 🔹 Imports module + actions + constants
// 🔹 NO business logic, NO API calls
// ============================================================================

/* ============================================================
   ✅ Imports
============================================================ */

// 🧭 Main module init (form + filters + table if present)
import { initAutoBillingRuleModule } from "./autoBillingRule-main.js";

// ⚙️ Lifecycle / action handlers (view, edit, delete, toggle, etc.)
import "./autoBillingRule-actions.js";

// 🧩 Constants (ensures availability for dynamic UI systems)
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
    // ✅ Safe init guard (ONLY run if module exists on page)
    if (
      document.getElementById("autoBillingRuleForm") ||
      document.getElementById("autoBillingRuleList") ||
      document.getElementById("autoBillingRuleTableBody")
    ) {
      await initAutoBillingRuleModule();
    }

    // (Future split support)
    // if (document.getElementById("autoBillingRuleTableBody")) {
    //   await initAutoBillingRuleListModule();
    // }

  } catch (err) {
    console.error("❌ Failed to initialize Auto Billing Rule module", err);
    hideLoading();
    showToast("❌ Failed to load Auto Billing Rule module");
  }
});