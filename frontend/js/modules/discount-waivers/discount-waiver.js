// 📦 discount-waivers.js – Entry Point (Enterprise-Aligned MASTER Pattern)
// ============================================================================
// 🧭 Master Pattern: deposits.js / consultation.js / department.js / role.js
// 🔹 Unified initialization entry for the Discount Waiver module
// 🔹 Handles module boot, imports, constants, and safe startup guard
// 🔹 STRICT parity with deposits.js (NO extra logic, NO manual action wiring)
// ============================================================================

/* ============================================================
   ✅ Imports
============================================================ */

// 🧭 Main module init (handles filter, table, card, pagination, summary, export)
import { initDiscountWaiverModule } from "./discount-waiver-filter-main.js";

// ⚙️ Lifecycle + action handlers (side-effect import, MASTER style)
import "./discount-waiver-actions.js";

// 🧩 Constants (kept for enterprise parity & future extensibility)
import {
  FIELD_LABELS_DISCOUNT_WAIVER,
  FIELD_ORDER_DISCOUNT_WAIVER,
  FIELD_DEFAULTS_DISCOUNT_WAIVER,
} from "./discount-waiver-constants.js";

// 🛠 Utilities
import { showToast, hideLoading } from "../../utils/index.js";

/* ============================================================
   🚀 DOM-Ready Bootstrap (MASTER SAFE GUARD)
============================================================ */
document.addEventListener("DOMContentLoaded", async () => {
  try {
    // 🧩 Initialize only if the waiver form or list container exists
    if (
      document.getElementById("discountWaiverForm") ||
      document.getElementById("discountWaiverList") ||
      document.getElementById("discountWaiverTableBody")
    ) {
      await initDiscountWaiverModule();
    }

    // (Optional future expansion – list-only init hook)
    // if (document.getElementById("discountWaiverTableBody")) {
    //   await initDiscountWaiverListModule();
    // }

  } catch (err) {
    console.error("❌ Failed to initialize Discount Waiver module", err);
    hideLoading();
    showToast("❌ Failed to load Discount Waiver module");
  }
});
