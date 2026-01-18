// 📦 facility.js – Entry Point (Enterprise-Aligned Master Pattern)
// ============================================================================
// 🧭 Master Pattern: role.js / vitals.js
// 🔹 Unified initialization entry for the Facility module
// 🔹 Handles module boot, imports, constants, and safe startup guard
// 🔹 NO business logic here (delegated to filter-main / form / actions)
// ============================================================================

/* ============================================================
   ✅ Imports
============================================================ */

// 🧭 Main module init (handles filter, table, card, etc.)
import { initFacilityModule } from "./facility-filter-main.js";

// ⚙️ Lifecycle + action handlers (view, edit, delete, toggle, etc.)
import "./facility-actions.js";

// 🧩 Constants (exportable for dynamic field selector or columns)
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
    // 🧩 Initialize only if the facility form or list container exists
    if (
      document.getElementById("facilityForm") ||
      document.getElementById("facilityList")
    ) {
      await initFacilityModule();
    }

    // (Optional future extension)
    // if (document.getElementById("facilityTableBody")) {
    //   await initFacilityListModule();
    // }

  } catch (err) {
    console.error("❌ Failed to initialize Facility module", err);
    hideLoading();
    showToast("❌ Failed to load Facility module");
  }
});
