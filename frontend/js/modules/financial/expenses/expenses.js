// 📦 expenses.js – Entry point

// ✅ Main module init
import { initExpenseModule } from "./expenses-main.js";

// ✅ Load action handlers
import "./expenses-actions.js";

// ✅ Constants (export if needed globally)
import {
  FIELD_LABELS_EXPENSE,
  FIELD_ORDER_EXPENSE,
  FIELD_DEFAULTS_EXPENSE,
} from "./expenses-constants.js";

// 🛠️ Utilities
import { showToast, hideLoading } from "../../../utils/index.js";

/* ============================================================ */
/* 🚀 Async-safe startup */
document.addEventListener("DOMContentLoaded", async () => {
  try {
    // Expenses container check
    if (
      document.getElementById("expenseTableBody") ||
      document.getElementById("expenseList")
    ) {
      await initExpenseModule();
    }
  } catch (err) {
    console.error("❌ Failed to initialize expense module", err);
    hideLoading();
    showToast("❌ Failed to load expense module");
  }
});