// 📦 discounts.js – Entry Point (Enterprise-Aligned MASTER Pattern)
// ============================================================================
// 🧭 Master Pattern: deposits.js / consultation.js / department.js / role.js
// 🔹 Unified initialization entry for the Discount module
// 🔹 Handles module boot, imports, constants, and safe startup guard
// 🔹 NO lifecycle logic, NO manual wiring, NO API calls
// ============================================================================

/* ============================================================
   ✅ Imports
============================================================ */

// 🧭 Main module init (handles filter, table, card, pagination, summary, export)
import { initDiscountModule } from "./discount-filter-main.js";

// ⚙️ Lifecycle + action handlers (side-effect registration ONLY)
import "./discount-actions.js";

// 🧩 Constants (exportable for dynamic field selector or columns)
import {
  FIELD_LABELS_DISCOUNT,
  FIELD_ORDER_DISCOUNT,
  FIELD_DEFAULTS_DISCOUNT,
} from "./discount-constants.js";

// 🛠 Utilities
import { showToast, hideLoading } from "../../utils/index.js";

/* ============================================================
   🚀 DOM-Ready Bootstrap (MASTER SAFE GUARD)
============================================================ */
document.addEventListener("DOMContentLoaded", async () => {
  try {
    // 🧩 Initialize only if a Discount form or list container exists
    if (
      document.getElementById("discountForm") ||
      document.getElementById("discountList") ||
      document.getElementById("discountTableBody")
    ) {
      await initDiscountModule();
    }

    // (Optional future expansion – list-only init hook)
    // if (document.getElementById("discountTableBody")) {
    //   await initDiscountListModule();
    // }

  } catch (err) {
    console.error("❌ Failed to initialize Discount module", err);
    hideLoading();
    showToast("❌ Failed to load Discount module");
  }
});
