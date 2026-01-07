// 📦 deposits.js – Enterprise Entry Point (Master Pattern Aligned)
// ============================================================================
// 🔹 Mirrors appointments.js for unified structure, lifecycle, and safety
// 🔹 Handles both form + list initialization seamlessly
// ============================================================================

/* ============================================================
   ✅ Imports
============================================================ */

// 🧭 Main module init (handles filters + table + pagination)
import { initDepositModule } from "./deposit-filter-main.js";

// ⚙️ Lifecycle + action handlers (view, edit, delete, toggle, etc.)
import { setupActionHandlers } from "./deposit-actions.js";

// 🧩 Constants (exportable for dynamic UI or column builders)
import {
  FIELD_LABELS_DEPOSIT,
  FIELD_ORDER_DEPOSIT,
  FIELD_DEFAULTS_DEPOSIT,
} from "./deposit-constants.js";

// 🛠️ Utilities
import { showToast, hideLoading } from "../../utils/index.js";

/* ============================================================
   🚀 Module Boot
============================================================ */
document.addEventListener("DOMContentLoaded", async () => {
  try {
    const hasForm = document.getElementById("depositForm");
    const hasList = document.getElementById("depositTableBody");

    // ✅ Initialize if form or list exists
    if (hasForm || hasList) await initDepositModule();

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
        FIELD_DEFAULTS_DEPOSIT[userRole] || FIELD_DEFAULTS_DEPOSIT.staff;

      setupActionHandlers({
        entries: window.latestDepositEntries || [],
        token,
        currentPage,
        loadEntries,
        visibleFields,
        sharedState,
        user,
      });
    }
  } catch (err) {
    console.error("❌ Failed to initialize deposit module", err);
    hideLoading();
    showToast("❌ Failed to load deposit module");
  }
});
