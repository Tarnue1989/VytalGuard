// 📦 refunds.js – Enterprise MASTER–ALIGNED Entry Point
// ============================================================================
// 🧭 MASTER Parity: refund-deposits.js / deposits.js / consultation.js
// 🔹 Unified initialization entry for the Refund module
// 🔹 Safe boot guard (form OR list)
// 🔹 NO duplicate action wiring
// 🔹 ALL logic delegated to filter-main + actions modules
// ============================================================================

/* ============================================================
   ✅ Imports
============================================================ */

// 🧭 Main module init (filters, table, card, pagination, summary, export)
import { initRefundModule } from "./refund-filter-main.js";

// ⚙️ Lifecycle + action handlers (side-effect import, MASTER pattern)
import "./refund-actions.js";

// 🧩 Constants (exportable context for field selector / UI builders)
import {
  FIELD_LABELS_REFUND,
  FIELD_ORDER_REFUND,
  FIELD_DEFAULTS_REFUND,
} from "./refund-constants.js";

// 🛠 Utilities
import { showToast, hideLoading } from "../../utils/index.js";

/* ============================================================
   🚀 DOM-Ready Bootstrap (MASTER GUARD)
============================================================ */
document.addEventListener("DOMContentLoaded", async () => {
  try {
    // 🧩 Initialize only if refund form or list container exists
    if (
      document.getElementById("refundForm") ||
      document.getElementById("refundList") ||
      document.getElementById("refundTableBody")
    ) {
      await initRefundModule();
    }

    // (Optional future expansion – list-only init hook)
    // if (document.getElementById("refundTableBody")) {
    //   await initRefundListModule();
    // }

  } catch (err) {
    console.error("❌ Failed to initialize Refund module", err);
    hideLoading();
    showToast("❌ Failed to load Refund module");
  }
});
