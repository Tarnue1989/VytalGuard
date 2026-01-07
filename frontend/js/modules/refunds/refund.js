// 📦 refunds.js – Enterprise Master Pattern Aligned
// ============================================================================
// 🔹 Mirrors deposits.js for unified entry lifecycle & structure
// 🔹 Handles both form + list initialization seamlessly (Refund module)
// ============================================================================

/* ============================================================
   ✅ Imports
============================================================ */

// 🧭 Main module init (handles filters + table + pagination)
import { initRefundModule } from "./refund-filter-main.js";

// ⚙️ Lifecycle + action handlers (view, edit, verify, void, etc.)
import { setupActionHandlers } from "./refund-actions.js";

// 🧩 Constants (exportable for dynamic UI or column builders)
import {
  FIELD_LABELS_REFUND,
  FIELD_ORDER_REFUND,
  FIELD_DEFAULTS_REFUND,
} from "./refund-constants.js";

// 🛠️ Utilities
import { showToast, hideLoading } from "../../utils/index.js";

/* ============================================================
   🚀 Module Boot
============================================================ */
document.addEventListener("DOMContentLoaded", async () => {
  try {
    const hasForm = document.getElementById("refundForm");
    const hasList = document.getElementById("refundTableBody");

    // ✅ Initialize if form or list exists
    if (hasForm || hasList) await initRefundModule();

    // ✅ If list page → setup action handlers dynamically
    if (hasList) {
      const userRole = (localStorage.getItem("userRole") || "staff").toLowerCase();
      const perms = JSON.parse(localStorage.getItem("permissions") || "[]");
      const user = { role: userRole, permissions: perms };

      const token = localStorage.getItem("accessToken") || "";
      const sharedState = { currentEditIdRef: { value: null } };
      const currentPage = 1;
      const loadEntries = async () => {};
      const visibleFields =
        FIELD_DEFAULTS_REFUND[userRole] || FIELD_DEFAULTS_REFUND.staff;

      setupActionHandlers({
        entries: window.latestRefundEntries || [],
        token,
        currentPage,
        loadEntries,
        visibleFields,
        sharedState,
        user,
      });
    }
  } catch (err) {
    console.error("❌ Failed to initialize refund module", err);
    hideLoading();
    showToast("❌ Failed to load refund module");
  }
});
