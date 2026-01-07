// 📦 payments.js – Enterprise Entry Point (Full Upgrade)
// ============================================================================
// 🔹 Mirrors deposits.js / discounts.js for unified lifecycle & permissions
// 🔹 Initializes both form + list contexts with safe async startup
// 🔹 Maintains all DOM IDs, event handlers, and API integration intact
// ============================================================================

/* ============================================================
   ✅ Imports
============================================================ */

// 🧭 Main module initialization (handles filters, table, pagination)
import { initPaymentModule } from "./payments-main.js";

// ⚙️ Lifecycle + action handlers (view, edit, delete, toggle, reverse, etc.)
import { setupPaymentActionHandlers } from "./payments-actions.js";

// 🧩 Constants (exportable for dynamic UI or column builders)
import {
  FIELD_LABELS_PAYMENT,
  FIELD_ORDER_PAYMENT,
  FIELD_DEFAULTS_PAYMENT,
} from "./payments-constants.js";

// 🛠️ Utilities
import { showToast, hideLoading } from "../../../utils/index.js";

/* ============================================================
   🚀 Module Boot
============================================================ */
document.addEventListener("DOMContentLoaded", async () => {
  try {
    const hasForm = document.getElementById("paymentForm");
    const hasList =
      document.getElementById("paymentTableBody") ||
      document.getElementById("paymentList");

    // ✅ Initialize Payment Module (form or list)
    if (hasForm || hasList) {
      await initPaymentModule();
    }

    // ✅ Bind enterprise action handlers when list/table present
    if (hasList) {
      const userRoleRaw = localStorage.getItem("userRole") || "staff";
      let userRole = userRoleRaw.trim().toLowerCase();
      if (userRole.includes("super") && userRole.includes("admin"))
        userRole = "superadmin";
      else if (userRole.includes("admin")) userRole = "admin";
      else userRole = "staff";

      // Normalize permissions
      let permissions = [];
      try {
        const raw = localStorage.getItem("permissions");
        const parsed = JSON.parse(raw || "[]");
        permissions = Array.isArray(parsed)
          ? parsed.map((p) => String(p.key || p).toLowerCase().trim())
          : [];
      } catch {
        permissions = [];
      }

      const user = { role: userRole, permissions };
      const token = localStorage.getItem("accessToken") || "";
      const sharedState = { currentEditIdRef: { value: null } };
      const currentPage = 1;
      const loadEntries = async () => {};
      const visibleFields =
        FIELD_DEFAULTS_PAYMENT[userRole] || FIELD_DEFAULTS_PAYMENT.staff;

      // Attach enterprise-standard handlers
      setupPaymentActionHandlers({
        entries: window.latestPaymentEntries || [],
        token,
        currentPage,
        loadEntries,
        visibleFields,
        sharedState,
        user,
      });
    }
  } catch (err) {
    console.error("❌ Failed to initialize payment module", err);
    hideLoading();
    showToast("❌ Failed to load payment module");
  }
});
