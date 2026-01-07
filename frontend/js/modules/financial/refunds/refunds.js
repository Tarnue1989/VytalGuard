// 📦 refunds.js – Entry point

// ✅ Main module init
import { initRefundModule } from "./refunds-main.js";

// ✅ Load action handlers (view, toggle, refund actions)
import "./refunds-actions.js";

// ✅ Constants (exported if needed globally)
import {
  FIELD_LABELS_REFUND,
  FIELD_ORDER_REFUND,
  FIELD_DEFAULTS_REFUND,
} from "./refunds-constants.js";

// 🛠️ Utilities
import { showToast, hideLoading } from "../../../utils/index.js";

// ✅ Async-safe startup
document.addEventListener("DOMContentLoaded", async () => {
  try {
    // Refunds don’t have a form; check for list container
    if (document.getElementById("refundTableBody") || document.getElementById("refundList")) {
      await initRefundModule();
    }
  } catch (err) {
    console.error("❌ Failed to initialize refund module", err);
    hideLoading();
    showToast("❌ Failed to load refund module");
  }
});
