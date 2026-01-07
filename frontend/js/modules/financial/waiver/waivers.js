// 📦 waivers.js – Entry point

// ✅ Main module init
import { initWaiverModule } from "./waivers-main.js";

// ✅ Load action handlers (view, approve, reject, reverse, delete)
import "./waivers-actions.js";

// ✅ Constants (exported if needed globally)
import {
  FIELD_LABELS_DISCOUNT_WAIVER,
  FIELD_ORDER_DISCOUNT_WAIVER,
  FIELD_DEFAULTS_DISCOUNT_WAIVER,
} from "./waivers-constants.js";

// 🛠️ Utilities
import { showToast, hideLoading } from "../../../utils/index.js";

// ✅ Async-safe startup
document.addEventListener("DOMContentLoaded", async () => {
  try {
    // Waivers don’t have a form; check for list container
    if (document.getElementById("waiverTableBody") || document.getElementById("waiverList")) {
      await initWaiverModule();
    }
  } catch (err) {
    console.error("❌ Failed to initialize waiver module", err);
    hideLoading();
    showToast("❌ Failed to load waiver module");
  }
});
