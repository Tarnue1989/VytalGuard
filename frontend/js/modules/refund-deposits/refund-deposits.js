// 📦 refundDeposits.js – Enterprise Master Pattern Aligned
// ============================================================================
// 🔹 Mirrors deposits.js for unified lifecycle & module boot
// 🔹 Handles BOTH: list page + add/edit form page
// 🔹 Works ONLY for DEPOSIT REFUNDS (refundDeposit module)
// ============================================================================

/* ============================================================
   ✅ Imports
============================================================ */

// 🧭 Main module init (filter + pagination + table render)
import { initRefundDepositModule } from "./refund-deposits-filter-main.js";

// ⚙️ Lifecycle + action handlers (view, edit, void, restore)
import { setupRefundDepositActionHandlers } from "./refund-deposits-actions.js";

// 🧩 Constants (used for UI configs)
import {
  FIELD_LABELS_REFUND_DEPOSIT,
  FIELD_ORDER_REFUND_DEPOSIT,
  FIELD_DEFAULTS_REFUND_DEPOSIT,
} from "./refund-deposits-constants.js";

// 🛠️ Utilities
import { showToast, hideLoading } from "../../utils/index.js";


/* ============================================================
   🚀 MODULE BOOTSTRAP
============================================================ */
document.addEventListener("DOMContentLoaded", async () => {
  try {
    const hasForm = document.getElementById("refundDepositForm");
    const hasList = document.getElementById("refundDepositTableBody");

    // ------------------------------------------------------------
    // INIT MODULE (filters + list + table headers + pagination)
    // ------------------------------------------------------------
    if (hasForm || hasList) {
      await initRefundDepositModule();
    }

    // ------------------------------------------------------------
    // LIST PAGE: Attach Action Buttons (Edit, View, Void, etc.)
    // ------------------------------------------------------------
    if (hasList) {
      const userRole = (localStorage.getItem("userRole") || "staff").toLowerCase();
      const perms = JSON.parse(localStorage.getItem("permissions") || "[]");

      const user = {
        role: userRole,
        permissions: perms.map((p) =>
          typeof p === "string" ? p : p.key?.toLowerCase()
        ),
      };

      const token = localStorage.getItem("accessToken") || "";
      const sharedState = { currentEditIdRef: { value: null } };
      const currentPage = 1;

      const loadEntries = async () => {}; // placeholder, overridden by module
      const visibleFields =
        FIELD_DEFAULTS_REFUND_DEPOSIT[userRole] ||
        FIELD_DEFAULTS_REFUND_DEPOSIT.staff;

      setupRefundDepositActionHandlers({
        entries: window.latestRefundDepositEntries || [],
        token,
        currentPage,
        loadEntries,
        visibleFields,
        sharedState,
        user,
      });
    }
  } catch (err) {
    console.error("❌ Failed to initialize refund-deposit module", err);
    hideLoading();
    showToast("❌ Failed to load refund deposit module");
  }
});
