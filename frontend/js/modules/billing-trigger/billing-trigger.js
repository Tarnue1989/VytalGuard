// 📦 billing-trigger.js – Enterprise Entry Point (Master Pattern Aligned)
// ============================================================================
// 🔹 Converted 1:1 from patient.js
// 🔹 Handles Billing Trigger form + lifecycle safely
// 🔹 Aligned with BillingTrigger controller, routes, and loaders
// 🔹 NO explanation, NO extra logic
// ============================================================================

/* ============================================================
   ✅ Imports
============================================================ */

// 🧭 Main module init (handles billing trigger form & related logic)
import { initBillingTriggerModule } from "./billing-trigger-main.js";

// ⚙️ Lifecycle + action handlers (view, edit, delete, toggle, etc.)
import "./billing-trigger-actions.js";

// 🧩 Constants (exportable for dynamic column builders or UI setups)
import {
  FIELD_LABELS_BILLING_TRIGGER,
  FIELD_ORDER_BILLING_TRIGGER,
  FIELD_DEFAULTS_BILLING_TRIGGER,
} from "./billing-trigger-constants.js";

// 🛠️ Utilities
import { showToast, hideLoading } from "../../utils/index.js";

/* ============================================================
   🚀 DOM-Ready Bootstrap
============================================================ */
document.addEventListener("DOMContentLoaded", async () => {
  try {
    // 🧩 Initialize if form exists
    if (document.getElementById("billingTriggerForm")) {
      await initBillingTriggerModule();
    }

    // 🧩 (Optional future expansion – list view)
    // if (document.getElementById("billingTriggerTableBody")) {
    //   await initBillingTriggerListModule();
    // }

  } catch (err) {
    console.error("❌ Failed to initialize billing trigger module:", err);
    hideLoading(); // prevent stuck loader
    showToast("❌ Failed to load Billing Trigger module");
  }
});
