// 📦 feature-module.js – Entry point

// ✅ Main module init
import { initFeatureModule } from "./feature-module-main.js";

// ✅ Load action handlers (view, edit, delete, toggle)
import "./feature-module-actions.js";

// 🛠️ Utilities
import { showToast, hideLoading } from "../../utils/index.js";

// ✅ Async-safe startup
document.addEventListener("DOMContentLoaded", async () => {
  try {
    const form = document.getElementById("featureModuleForm");
    if (form) {
      await initFeatureModule();
    }
  } catch (err) {
    console.error("❌ Failed to initialize feature module", err);
    hideLoading(); // ensure spinner doesn’t hang
    showToast("❌ Failed to load feature module");

    // Optional: hide form container to prevent broken UI
    document.getElementById("formContainer")?.classList.add("hidden");
  }
});
