// 📦 finance-reports.js – Enterprise Entry Point
// ============================================================
// 🔹 Mirrors deposits.js / payments-main.js
// 🔹 Bootstraps module only (NO business logic)
// 🔹 Wires actions + initializes filters
// ============================================================

import { initFinanceReportModule } from "./finance-filter-main.js";
import { setupFinanceActions } from "./finance-actions.js";

document.addEventListener("DOMContentLoaded", async () => {
  try {
    // 🔹 Wire buttons (print, future export)
    setupFinanceActions();

    // 🔹 Initialize filters + load data
    await initFinanceReportModule();

  } catch (err) {
    console.error("❌ Failed to init finance reports", err);
  }
});
