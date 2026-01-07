// ============================================================================
// 🏢 VytalGuard – Organization Entry Point (Master Pattern Aligned)
// 🔹 Mirrors consultation.js for consistent lifecycle, structure, and safety
// 🔹 Handles both form and filter/list pages seamlessly
// ============================================================================

/* ============================================================
   ✅ Imports
============================================================ */

// 🧭 Main module init (handles form, filters, etc.)
import { initOrganizationModule } from "./organization-main.js";

// ⚙️ Lifecycle + action handlers (view, edit, delete, toggle, etc.)
import "./organization-actions.js";

// 🧩 Constants (exportable for dynamic UI or column builders)
import {
  FIELD_LABELS_ORGANIZATION,
  FIELD_ORDER_ORGANIZATION,
  FIELD_DEFAULTS_ORGANIZATION,
} from "./organization-constants.js";

// 🛠 Utilities
import { showToast, hideLoading } from "../../utils/index.js";

/* ============================================================
   🚀 DOM-Ready Bootstrap
============================================================ */

document.addEventListener("DOMContentLoaded", async () => {
  try {
    // 🧩 Only initialize if the organization form or list exists
    if (document.getElementById("organizationForm")) {
      await initOrganizationModule();
    }

    // (Optional) Future pattern for table/list-only pages:
    // if (document.getElementById("organizationTableBody")) {
    //   await initOrganizationListModule();
    // }

  } catch (err) {
    console.error("❌ Failed to initialize organization module", err);
    hideLoading();
    showToast("❌ Failed to load organization module");
  }
});
