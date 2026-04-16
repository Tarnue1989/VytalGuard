// 📦 payrolls.js – Entry Point (Deposit → Payroll PARITY)
// ============================================================================
// 🧭 FULL MASTER PARITY
// 🔹 ONLY payroll module adjustments
// 🔹 No feature removed
// ============================================================================

/* ============================================================
   ✅ Imports
============================================================ */

// 🧭 Main module init
import { initPayrollModule } from "./payroll-filter-main.js";

// ⚙️ Actions
import "./payroll-actions.js";

// 🧩 Constants
import {
  FIELD_LABELS_PAYROLL,
  FIELD_ORDER_PAYROLL,
  FIELD_DEFAULTS_PAYROLL,
} from "./payroll-constants.js";

// 🛠 Utilities
import { showToast, hideLoading } from "../../utils/index.js";

/* ============================================================
   🚀 DOM-Ready Bootstrap
============================================================ */
document.addEventListener("DOMContentLoaded", async () => {
  try {
    if (
      document.getElementById("payrollForm") ||
      document.getElementById("payrollList") ||
      document.getElementById("payrollTableBody")
    ) {
      await initPayrollModule();
    }

  } catch (err) {
    console.error("❌ Failed to initialize Payroll module", err);
    hideLoading();
    showToast("❌ Failed to load Payroll module");
  }
});