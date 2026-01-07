// 📦 discount-policies.js – Entry point

// ✅ Main module init
import { initDiscountPolicyModule } from "./discount-policy-filter-main.js";

// ✅ Load action handlers (view, edit, delete, lifecycle)
import "./discount-policy-actions.js";

// ✅ Constants (exported if needed globally)
import {
  FIELD_LABELS_DISCOUNT_POLICY,
  FIELD_ORDER_DISCOUNT_POLICY,
  FIELD_DEFAULTS_DISCOUNT_POLICY,
} from "./discount-policy-constants.js";

// 🛠️ Utilities
import { showToast, hideLoading } from "../../utils/index.js";

// ✅ Async-safe startup
document.addEventListener("DOMContentLoaded", async () => {
  try {
    if (
      document.getElementById("discountPolicyForm") ||
      document.getElementById("discountPolicyTableBody")
    ) {
      // Ensure form or list exists before init (prevents errors on wrong page)
      await initDiscountPolicyModule();
    }
  } catch (err) {
    console.error("❌ Failed to initialize discount policy module", err);
    hideLoading();
    showToast("❌ Failed to load discount policy module");
  }
});
