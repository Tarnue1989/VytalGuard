// 📦 accounts.js – Entry point

// ✅ Main module init
import { initAccountModule } from "./accounts-main.js";

// ✅ Load action handlers
import "./accounts-actions.js";

// ✅ Constants (export if needed globally)
import {
  FIELD_LABELS_ACCOUNT,
  FIELD_ORDER_ACCOUNT,
  FIELD_DEFAULTS_ACCOUNT,
} from "./accounts-constants.js";

// 🛠️ Utilities
import { showToast, hideLoading } from "../../../utils/index.js";

/* ============================================================ */
/* 🚀 Async-safe startup */
document.addEventListener("DOMContentLoaded", async () => {
  try {
    // Accounts container check
    if (
      document.getElementById("accountTableBody") ||
      document.getElementById("accountList")
    ) {
      await initAccountModule();
    }
  } catch (err) {
    console.error("❌ Failed to initialize account module", err);
    hideLoading();
    showToast("❌ Failed to load account module");
  }
});