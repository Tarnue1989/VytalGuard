// ============================================================================
// 🏥 VytalGuard – Facility Entry Point (Master Pattern Aligned)
// 🔹 Mirrors organization.js / consultation.js for unified structure & safety
// 🔹 Handles both form and filter/list pages seamlessly
// ============================================================================

/* ============================================================
   ✅ Imports
============================================================ */

// 🧭 Main module init (handles form, filters, etc.)
import { initFacilityModule } from "./facility-main.js";

// ⚙️ Lifecycle + action handlers (view, edit, delete, toggle, etc.)
import "./facility-actions.js";

// 🧩 Constants (exportable for dynamic UI or column builders)
import {
  FIELD_LABELS_FACILITY,
  FIELD_ORDER_FACILITY,
  FIELD_DEFAULTS_FACILITY,
} from "./facility-constants.js";

// 🛠 Utilities
import { showToast, hideLoading } from "../../utils/index.js";

/* ============================================================
   🚀 DOM-Ready Bootstrap
============================================================ */

document.addEventListener("DOMContentLoaded", async () => {
  try {
    // 🧩 Only initialize if the facility form or list exists
    if (document.getElementById("facilityForm")) {
      await initFacilityModule();
    }

    // (Optional) Future pattern for table/list-only pages:
    // if (document.getElementById("facilityTableBody")) {
    //   await initFacilityListModule();
    // }

  } catch (err) {
    console.error("❌ Failed to initialize facility module", err);
    hideLoading(); // ensure spinner doesn’t hang
    showToast("❌ Failed to load facility module");
  }
});
