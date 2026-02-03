// 📦 payments.js – Entry Point (Enterprise-Aligned MASTER Pattern)
// ============================================================================
// 🧭 Master Pattern: deposits.js / consultation.js / department.js
// 🔹 Unified initialization entry for the Payment module
// 🔹 Handles safe boot, imports, constants, and error-guarded startup
// 🔹 NO direct action wiring here (handled internally by filter module)
// ============================================================================

/* ============================================================
   ✅ Imports
============================================================ */

// 🧭 Main module init (filters, table, card, pagination, summary, export)
import { initPaymentModule } from "./payment-filter-main.js";

// ⚙️ Lifecycle + action handlers (side-effect import, MASTER pattern)
import "./payment-actions.js";

// 🧩 Constants (kept for parity + future dynamic usage)
import {
  FIELD_LABELS_PAYMENT,
  FIELD_ORDER_PAYMENT,
  FIELD_DEFAULTS_PAYMENT,
} from "./payment-constants.js";

// 🛠 Utilities
import { showToast, hideLoading } from "../../utils/index.js";

/* ============================================================
   🚀 DOM-Ready Bootstrap
============================================================ */
document.addEventListener("DOMContentLoaded", async () => {
  try {
    // 🧩 Initialize only if payment form or list container exists
    if (
      document.getElementById("paymentForm") ||
      document.getElementById("paymentList") ||
      document.getElementById("paymentTableBody")
    ) {
      await initPaymentModule();
    }

    // (Optional future expansion – list-only init hook)
    // if (document.getElementById("paymentTableBody")) {
    //   await initPaymentListModule();
    // }

  } catch (err) {
    console.error("❌ Failed to initialize Payment module", err);
    hideLoading();
    showToast("❌ Failed to load Payment module");
  }
});
