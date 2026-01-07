// 📦 pharmacy-transaction.js – Enterprise Entry Point (Master Pattern Aligned)
// ============================================================================
// 🔹 Mirrors payments.js for unified lifecycle, permissions, and safety
// 🔹 Handles both form + list initialization seamlessly
// 🔹 Preserves all working logic, DOM IDs, and API endpoints
// ============================================================================

/* ============================================================
   ✅ Imports
============================================================ */

// 🧭 Main module inits (Filter/List + Form modes)
import { initPharmacyTransactionModule as initListModule } from "./pharmacy-transaction-filter-main.js";
import { initPharmacyTransactionModule as initFormModule } from "./pharmacy-transaction-main.js";

// ⚙️ Lifecycle + action handlers (view/edit/delete/toggle)
import { setupActionHandlers } from "./pharmacy-transaction-actions.js";

// 🧩 Constants (exportable for dynamic UI / table builders)
import {
  FIELD_LABELS_PHARMACY_TRANSACTION,
  FIELD_ORDER_PHARMACY_TRANSACTION,
  FIELD_DEFAULTS_PHARMACY_TRANSACTION,
} from "./pharmacy-transaction-constants.js";

// 🛠️ Utilities
import { showToast, hideLoading } from "../../utils/index.js";

/* ============================================================
   🚀 Module Boot
============================================================ */
document.addEventListener("DOMContentLoaded", async () => {
  try {
    const hasForm = document.getElementById("pharmacyTransactionForm");
    const hasList = document.getElementById("pharmacyTransactionTableBody");

    // ✅ Initialize form or list as needed
    if (hasForm || hasList) {
      if (hasForm) await initFormModule();
      else await initListModule();
    }

    // ✅ Setup action handlers dynamically when list present
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
        FIELD_DEFAULTS_PHARMACY_TRANSACTION[userRole] ||
        FIELD_DEFAULTS_PHARMACY_TRANSACTION.staff;

      setupActionHandlers({
        entries: window.latestPharmacyEntries || [],
        token,
        currentPage,
        loadEntries,
        visibleFields,
        sharedState,
        user,
      });
    }
  } catch (err) {
    console.error("❌ Failed to initialize pharmacy transaction module", err);
    hideLoading();
    showToast("❌ Failed to load pharmacy transaction module");
  }
});

/* ============================================================
   🧩 Exports (for other modules if needed)
============================================================ */
export {
  FIELD_LABELS_PHARMACY_TRANSACTION,
  FIELD_ORDER_PHARMACY_TRANSACTION,
  FIELD_DEFAULTS_PHARMACY_TRANSACTION,
};
