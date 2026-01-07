// 📦 feature-access.js – Entry point

// ✅ Main module init
import { initFeatureAccess } from "./feature-access-main.js";

// ✅ Load action handlers (view, edit, delete, toggle)
import "./feature-access-actions.js";

// 🛠️ Utilities
import { showToast, hideLoading } from "../../utils/index.js";

// ✅ Async-safe startup
document.addEventListener("DOMContentLoaded", async () => {
  try {
    const form = document.getElementById("featureAccessForm");
    if (form) {
      await initFeatureAccess();
    }
  } catch (err) {
    console.error("❌ Failed to initialize feature access", err);
    hideLoading(); // ensure spinner doesn’t hang
    showToast("❌ Failed to load feature access");

    // Optional: hide form container to prevent broken UI
    document.getElementById("formContainer")?.classList.add("hidden");
  }
});
