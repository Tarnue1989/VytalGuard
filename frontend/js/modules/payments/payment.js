// 📦 payments.js – Enterprise Entry Point (Master Pattern Aligned)
// ============================================================================
// 🔹 Mirrors deposits.js for unified lifecycle, permissions, and safety
// 🔹 Handles both form + list initialization seamlessly
// ============================================================================

/* ============================================================
   ✅ Imports
============================================================ */

// 🧭 Main module init (handles filters + table + pagination)
import { initPaymentModule } from "./payment-filter-main.js";

// ⚙️ Lifecycle + action handlers (view, edit, delete, toggle, etc.)
import { setupActionHandlers } from "./payment-actions.js";

// 🧩 Constants (exportable for dynamic UI or column builders)
import {
  FIELD_LABELS_PAYMENT,
  FIELD_ORDER_PAYMENT,
  FIELD_DEFAULTS_PAYMENT,
} from "./payment-constants.js";

// 🛠️ Utilities
import { showToast, hideLoading } from "../../utils/index.js";

/* ============================================================
   🚀 Module Boot
============================================================ */
document.addEventListener("DOMContentLoaded", async () => {
  try {
    const hasForm = document.getElementById("paymentForm");
    const hasList = document.getElementById("paymentTableBody");

    // ✅ Initialize if form or list exists
    if (hasForm || hasList) await initPaymentModule();

    // ✅ If list page → setup action handlers dynamically
    if (hasList) {
      const userRole = (localStorage.getItem("userRole") || "staff").toLowerCase();
      let perms = [];
      try {
        const rawPerms = JSON.parse(localStorage.getItem("permissions") || "[]");
        perms = Array.isArray(rawPerms)
          ? rawPerms.map((p) => String(p.key || p).toLowerCase().trim())
          : [];
      } catch {
        perms = [];
      }

      const user = { role: userRole, permissions: perms };
      const token = localStorage.getItem("accessToken") || "";
      const sharedState = { currentEditIdRef: { value: null } };
      const currentPage = 1;
      const loadEntries = async () => {};
      const visibleFields =
        FIELD_DEFAULTS_PAYMENT[userRole] || FIELD_DEFAULTS_PAYMENT.staff;

      setupActionHandlers({
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
