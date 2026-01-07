// 📦 invoices.js – Enterprise Entry Point (Master Pattern Aligned)
// ============================================================================
// 🔹 Mirrors payments.js for unified lifecycle, permissions, and safety
// 🔹 Handles list initialization seamlessly (invoices have no manual form)
// ============================================================================

/* ============================================================
   ✅ Imports
============================================================ */

// 🧭 Main module init (handles filters, table, pagination)
import { initInvoiceModule } from "./invoice-main.js";

// ⚙️ Lifecycle + action handlers (view, toggle, financial actions)
import { setupActionHandlers } from "./invoice-actions.js";

// 🧩 Constants (exportable for dynamic UI or column builders)
import {
  FIELD_LABELS_INVOICE,
  FIELD_ORDER_INVOICE,
  FIELD_DEFAULTS_INVOICE,
} from "./invoice-constants.js";

// 🛠️ Utilities
import { showToast, hideLoading } from "../../../utils/index.js";

/* ============================================================
   🚀 Module Boot
============================================================ */
document.addEventListener("DOMContentLoaded", async () => {
  try {
    const hasList =
      document.getElementById("invoiceTableBody") ||
      document.getElementById("invoiceList");

    // ✅ Initialize if list exists (invoices have no add form)
    if (hasList) await initInvoiceModule();

    // ✅ Setup enterprise action handlers dynamically
    if (hasList) {
      const userRole = (localStorage.getItem("userRole") || "staff").toLowerCase();

      // 🧩 Parse permissions from localStorage
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
        FIELD_DEFAULTS_INVOICE[userRole] || FIELD_DEFAULTS_INVOICE.staff;

      setupActionHandlers({
        entries: window.latestInvoiceEntries || [],
        token,
        currentPage,
        loadEntries,
        visibleFields,
        sharedState,
        user,
      });
    }
  } catch (err) {
    console.error("❌ Failed to initialize invoice module", err);
    hideLoading();
    showToast("❌ Failed to load invoice module");
  }
});
