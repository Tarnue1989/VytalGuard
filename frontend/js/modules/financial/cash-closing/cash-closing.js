// 📦 cash-closing.js – Entry point

// ✅ Main module init
import { initCashClosingModule } from "./cash-closing-main.js";

// ✅ Load action handlers
import "./cash-closing-actions.js";

// ✅ Constants (export if needed globally)
import {
  FIELD_LABELS_CASH_CLOSING,
  FIELD_ORDER_CASH_CLOSING,
  FIELD_DEFAULTS_CASH_CLOSING,
} from "./cash-closing-constants.js";

// 🛠️ Utilities
import { showToast, hideLoading } from "../../../utils/index.js";

/* ============================================================ */
/* 🚀 Async-safe startup */
document.addEventListener("DOMContentLoaded", async () => {
  try {
    // Cash Closing container check
    if (
      document.getElementById("cashClosingTableBody") ||
      document.getElementById("cashClosingList")
    ) {
      await initCashClosingModule();
    }
  } catch (err) {
    console.error("❌ Failed to initialize cash closing module", err);
    hideLoading();
    showToast("❌ Failed to load cash closing module");
  }
});