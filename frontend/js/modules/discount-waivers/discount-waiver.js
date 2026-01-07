// 📦 discount-waivers.js – Enterprise Entry Point (Master Pattern Aligned)
// ============================================================================
// 🔹 Mirrors discounts.js for unified lifecycle, RBAC, and safe boot logic
// 🔹 Handles both form + list initialization dynamically
// 🔹 Preserves all existing DOM IDs and API references
// ============================================================================

/* ============================================================
   ✅ Imports
============================================================ */

// 🧭 Main module init (filters + table + pagination)
import { initDiscountWaiverModule } from "./discount-waiver-filter-main.js";

// ⚙️ Lifecycle + action handlers (view, edit, delete, toggle, approve, void, etc.)
import { setupActionHandlers } from "./discount-waiver-actions.js";

// 🧩 Constants (exportable for global UI usage)
import {
  FIELD_LABELS_DISCOUNT_WAIVER,
  FIELD_ORDER_DISCOUNT_WAIVER,
  FIELD_DEFAULTS_DISCOUNT_WAIVER,
} from "./discount-waiver-constants.js";

// 🛠️ Utilities
import { showToast, hideLoading } from "../../utils/index.js";

/* ============================================================
   🚀 Module Boot
============================================================ */
document.addEventListener("DOMContentLoaded", async () => {
  try {
    const hasForm = document.getElementById("discountWaiverForm");
    const hasList = document.getElementById("discountWaiverTableBody");

    // ✅ Initialize only when form or list exists
    if (hasForm || hasList) await initDiscountWaiverModule();

    // ✅ Setup action handlers if list view is active
    if (hasList) {
      const userRole = (localStorage.getItem("userRole") || "staff").toLowerCase();
      const permsRaw = localStorage.getItem("permissions") || "[]";
      const parsedPerms = Array.isArray(JSON.parse(permsRaw))
        ? JSON.parse(permsRaw)
        : [];
      const user = { role: userRole, permissions: parsedPerms };

      const token = localStorage.getItem("accessToken") || "";
      const sharedState = { currentEditIdRef: { value: null } };
      const currentPage = 1;
      const loadEntries = async () => {};
      const visibleFields =
        FIELD_DEFAULTS_DISCOUNT_WAIVER[userRole] ||
        FIELD_DEFAULTS_DISCOUNT_WAIVER.staff;

      setupActionHandlers({
        entries: window.latestDiscountWaiverEntries || [],
        token,
        currentPage,
        loadEntries,
        visibleFields,
        sharedState,
        user,
      });
    }
  } catch (err) {
    console.error("❌ Failed to initialize discount waiver module", err);
    hideLoading();
    showToast("❌ Failed to load discount waiver module");
  }
});
