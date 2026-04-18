// 📦 expenses.js – Entry Point (Enterprise-Aligned Master Pattern)
// ============================================================================
// 🧭 Master Pattern: consultation.js / department.js / role.js
// 🔹 Unified initialization entry for the Expense module
// 🔹 Handles module boot, imports, constants, and safe startup guard
// ============================================================================

/* ============================================================
   ✅ Imports
============================================================ */

// 🧭 Main module init (handles filter, table, card, pagination, summary, export)
import { initExpenseModule } from "./expense-filter-main.js";

// ⚙️ Lifecycle + action handlers (view, edit, delete, approve, post, void, reverse, etc.)
import "./expense-actions.js";

// 🧩 Constants (exportable for dynamic field selector or columns)
import {
  FIELD_LABELS_EXPENSE,
  FIELD_ORDER_EXPENSE,
  FIELD_DEFAULTS_EXPENSE,
} from "./expense-constants.js";

// 🛠 Utilities
import { showToast, hideLoading } from "../../utils/index.js";

/* ============================================================
   🚀 DOM-Ready Bootstrap
============================================================ */
document.addEventListener("DOMContentLoaded", async () => {
  try {
    // 🧩 Initialize only if expense form OR list exists
    if (
      document.getElementById("expenseForm") ||
      document.getElementById("expenseList") ||
      document.getElementById("expenseTableBody")
    ) {
      await initExpenseModule();
    }

    // (Optional future expansion – list-only init hook)
    // if (document.getElementById("expenseTableBody")) {
    //   await initExpenseListModule();
    // }

  } catch (err) {
    console.error("❌ Failed to initialize Expense module", err);
    hideLoading();
    showToast("❌ Failed to load Expense module");
  }
});