// 📦 insurance-claims.js – Entry Point (Enterprise-Aligned MASTER Pattern)
// ============================================================================
// 🧭 Master Pattern: payments.js / deposits.js / consultation.js
// 🔹 Unified initialization entry for the Insurance Claim module
// 🔹 Handles safe boot, imports, constants, and error-guarded startup
// 🔹 NO direct action wiring here (handled internally by filter module)
// ============================================================================

/* ============================================================
   ✅ Imports
============================================================ */

// 🧭 Main module init (filters, table, card, pagination, summary, export)
import { initInsuranceClaimModule } from "./insurance-claims-filter-main.js";

// ⚙️ Lifecycle + action handlers (side-effect import, MASTER pattern)
import "./insurance-claims-actions.js";

// 🧩 Constants (kept for parity + future dynamic usage)
import {
  FIELD_LABELS_INSURANCE_CLAIM,
  FIELD_ORDER_INSURANCE_CLAIM,
  FIELD_DEFAULTS_INSURANCE_CLAIM,
} from "./insurance-claims.form.rules.js";

// 🛠 Utilities
import { showToast, hideLoading } from "../../utils/index.js";

/* ============================================================
   🚀 DOM-Ready Bootstrap
============================================================ */
document.addEventListener("DOMContentLoaded", async () => {
  try {
    // 🧩 Initialize only if form or list exists
    if (
      document.getElementById("insuranceClaimForm") ||
      document.getElementById("insuranceClaimList") ||
      document.getElementById("insuranceClaimTableBody")
    ) {
      await initInsuranceClaimModule();
    }

    // (Optional future expansion)
    // if (document.getElementById("insuranceClaimTableBody")) {
    //   await initInsuranceClaimListModule();
    // }

  } catch (err) {
    console.error("❌ Failed to initialize Insurance Claim module", err);
    hideLoading();
    showToast("❌ Failed to load Insurance Claim module");
  }
});