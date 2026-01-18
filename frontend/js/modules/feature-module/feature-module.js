// 📦 feature-module.js – Enterprise Entry Point (Master Pattern Aligned)
// ============================================================================
// 🔹 Mirrors patient.js, employee.js, consultation.js
// 🔹 Safe boot with page-type detection (form vs list)
// 🔹 No double init, no UI breakage
// ============================================================================

/* ============================================================
   ✅ Imports
============================================================ */

// 🧭 FORM initializer (add / edit page)
import { initFeatureModule } from "./feature-module-main.js";

// ⚙️ Action handlers (view, edit, toggle, delete)
import "./feature-module-actions.js";

// 🛠️ Utilities
import { showToast, hideLoading } from "../../utils/index.js";

/* ============================================================
   🚀 DOM-Ready Bootstrap
============================================================ */
document.addEventListener("DOMContentLoaded", async () => {
  try {
    /**
     * 🔹 FORM MODE ONLY
     * feature-module-main.js is FORM-ONLY
     */
    if (document.getElementById("featureModuleForm")) {
      await initFeatureModule();
    }

    /**
     * 🔹 LIST MODE
     * feature-module-filter-main.js bootstraps itself
     * so we intentionally DO NOTHING here
     */

  } catch (err) {
    console.error("❌ Failed to initialize Feature Module:", err);

    // 🧯 Prevent stuck spinner
    hideLoading();

    // 🔔 User feedback
    showToast("❌ Failed to load Feature Module");

    // 🧱 Prevent broken form UI
    document.getElementById("formContainer")?.classList.add("hidden");
  }
});
