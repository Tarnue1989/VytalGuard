// 📦 discounts.js – Enterprise Entry Point (Master Pattern Aligned)
// ============================================================================
// 🔹 Mirrors deposits.js for unified structure, lifecycle, and RBAC consistency
// 🔹 Handles both form + list initialization seamlessly and safely
// ============================================================================

/* ============================================================
   ✅ Imports
============================================================ */

// 🧭 Main module init (handles filters + table + pagination)
import { initDiscountModule } from "./discount-filter-main.js";

// ⚙️ Lifecycle + action handlers (view, edit, delete, toggle, etc.)
import { setupActionHandlers } from "./discount-actions.js";

// 🧩 Constants (exportable for dynamic UI or column builders)
import {
  FIELD_LABELS_DISCOUNT,
  FIELD_ORDER_DISCOUNT,
  FIELD_DEFAULTS_DISCOUNT,
} from "./discount-constants.js";

// 🛠️ Utilities
import { showToast, hideLoading } from "../../utils/index.js";

/* ============================================================
   🚀 Module Boot
============================================================ */
document.addEventListener("DOMContentLoaded", async () => {
  try {
    const hasForm = document.getElementById("discountForm");
    const hasList = document.getElementById("discountTableBody");

    // ✅ Initialize if form or list exists
    if (hasForm || hasList) await initDiscountModule();

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
        FIELD_DEFAULTS_DISCOUNT[userRole] || FIELD_DEFAULTS_DISCOUNT.staff;

      setupActionHandlers({
        entries: window.latestDiscountEntries || [],
        token,
        currentPage,
        loadEntries,
        visibleFields,
        sharedState,
        user,
      });
    }
  } catch (err) {
    console.error("❌ Failed to initialize discount module", err);
    hideLoading();
    showToast("❌ Failed to load discount module");
  }
});
