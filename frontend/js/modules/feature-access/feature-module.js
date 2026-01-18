// 📦 feature-access.js – Enterprise Entry Point (Master Pattern Aligned)
// ============================================================================
// 🔹 Mirrors feature-module.js EXACTLY
// 🔹 Safe boot with page-type detection (form vs list)
// 🔹 No double init, no UI breakage
// ============================================================================

/* ============================================================
   ✅ Imports
============================================================ */

// 🧭 FORM initializer (add / edit page)
import { initFeatureAccess } from "./feature-access-main.js";

// ⚙️ Action handlers (view, edit, toggle, delete)
import "./feature-access-actions.js";

// 🛠️ Utilities
import { showToast, hideLoading } from "../../utils/index.js";

/* ============================================================
   🚀 DOM-Ready Bootstrap
============================================================ */
document.addEventListener("DOMContentLoaded", async () => {
  try {
    /**
     * 🔹 FORM MODE ONLY
     * feature-access-main.js is FORM-ONLY
     */
    if (document.getElementById("featureAccessForm")) {
      await initFeatureAccess();
    }

    /**
     * 🔹 LIST MODE
     * feature-access-filter-main.js bootstraps itself
     * so we intentionally DO NOTHING here
     */

  } catch (err) {
    console.error("❌ Failed to initialize Feature Access:", err);

    // 🧯 Prevent stuck spinner
    hideLoading();

    // 🔔 User feedback
    showToast("❌ Failed to load Feature Access");

    // 🧱 Prevent broken form UI
    document.getElementById("formContainer")?.classList.add("hidden");
  }
});
