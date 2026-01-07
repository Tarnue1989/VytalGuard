// 📦 deposits.js – Entry point

// ✅ Main module init
import { initDepositModule } from "./deposits-main.js";

// ✅ Load action handlers (view, reverse, delete)
import "./deposits-actions.js";

// ✅ Constants (exported if needed globally)
import {
  FIELD_LABELS_DEPOSIT,
  FIELD_ORDER_DEPOSIT,
  FIELD_DEFAULTS_DEPOSIT,
} from "./deposits-constants.js";

// 🛠️ Utilities
import { showToast, hideLoading } from "../../../utils/index.js";

// ✅ Async-safe startup
document.addEventListener("DOMContentLoaded", async () => {
  try {
    // Deposits list container check
    if (document.getElementById("depositTableBody") || document.getElementById("depositList")) {
      await initDepositModule();
    }
  } catch (err) {
    console.error("❌ Failed to initialize deposit module", err);
    hideLoading();
    showToast("❌ Failed to load deposit module");
  }
});
