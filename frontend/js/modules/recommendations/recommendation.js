// 📦 recommendation.js – Entry point

// ✅ Main module init
import { initRecommendationModule } from "./recommendation-filter-main.js";

// ✅ Load action handlers (view, edit, delete, lifecycle)
import "./recommendation-actions.js";

// ✅ Constants (exported if needed globally)
import {
  FIELD_LABELS_RECOMMENDATION,
  FIELD_ORDER_RECOMMENDATION,
  FIELD_DEFAULTS_RECOMMENDATION,
} from "./recommendation-constants.js";

// 🛠️ Utilities
import { showToast, hideLoading } from "../../utils/index.js";

// ✅ Async-safe startup
document.addEventListener("DOMContentLoaded", async () => {
  try {
    if (document.getElementById("recommendationForm")) {
      // Ensure form exists before init (prevents errors on wrong page)
      await initRecommendationModule();
    }
  } catch (err) {
    console.error("❌ Failed to initialize recommendation module", err);
    hideLoading();
    showToast("❌ Failed to load recommendation module");
  }
});
