// 📦 currency-rate.js – Entry Point (Enterprise-Aligned Master Pattern)
// ============================================================================
// 🧭 Master Pattern: role.js (1:1)
// 🔹 Unified initialization entry for the Currency Rate module
// 🔹 Handles module boot, imports, constants, and safe startup guard
// ============================================================================

/* ============================================================
   ✅ Imports
============================================================ */

// 🧭 Main module init (handles filter, table, card, etc.)
import { initCurrencyRateModule } from "./currency-rate-filter-main.js";

// ⚙️ Lifecycle + action handlers
import "./currency-rate-actions.js";

// 🧩 Constants
import {
  FIELD_LABELS_CURRENCY_RATE,
  FIELD_ORDER_CURRENCY_RATE,
  FIELD_DEFAULTS_CURRENCY_RATE,
} from "./currency-rate-constants.js";

// 🛠 Utilities
import { showToast, hideLoading } from "../../utils/index.js";

/* ============================================================
   🚀 DOM-Ready Bootstrap
============================================================ */

document.addEventListener("DOMContentLoaded", async () => {
  try {
    if (
      document.getElementById("currencyRateForm") ||
      document.getElementById("currencyRateList")
    ) {
      await initCurrencyRateModule();
    }

  } catch (err) {
    console.error("❌ Failed to initialize Currency Rate module", err);
    hideLoading();
    showToast("❌ Failed to load Currency Rate module");
  }
});