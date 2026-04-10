// 📦 insurance-provider.js – Entry Point (INSURANCE PROVIDER | Enterprise Master)
// ============================================================================
// 🔹 Converted from role.js (MASTER PARITY)
// 🔹 Unified initialization entry for Insurance Provider module
// ============================================================================

/* ============================================================
   ✅ Imports
============================================================ */

// 🧭 Main module init
import { initInsuranceProviderModule } from "./insurance-provider-filter-main.js";

// ⚙️ Actions
import "./insurance-provider-actions.js";

// 🧩 Constants
import {
  FIELD_LABELS_INSURANCE_PROVIDER,
  FIELD_ORDER_INSURANCE_PROVIDER,
  FIELD_DEFAULTS_INSURANCE_PROVIDER,
} from "./insurance-provider-constants.js";

// 🛠 Utils
import { showToast, hideLoading } from "../../utils/index.js";

/* ============================================================
   🚀 BOOT
============================================================ */
document.addEventListener("DOMContentLoaded", async () => {
  try {
    if (
      document.getElementById("insuranceProviderForm") ||
      document.getElementById("insuranceProviderList")
    ) {
      await initInsuranceProviderModule();
    }
  } catch (err) {
    console.error("❌ Failed to initialize Insurance Provider module", err);
    hideLoading();
    showToast("❌ Failed to load Insurance Provider module");
  }
});