// 📦 organization.js – Entry Point (Enterprise-Aligned Master Pattern)
// ============================================================================
// 🧭 Master Pattern: role.js / consultation.js / vitals.js
// 🔹 Unified initialization entry for the Organization module
// 🔹 Safe bootstrap for form + list pages
// 🔹 Preserves all existing IDs and lifecycle behavior
// ============================================================================

/* ============================================================
   ✅ Imports
============================================================ */

// 🧭 Main module init (form, visibility, field selector, etc.)
import { initOrganizationModule } from "./organization-main.js";

// ⚙️ Action handlers (edit, delete, toggle status, etc.)
import "./organization-actions.js";

// 🧩 Constants (exposed for dynamic UI / selectors)
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
    // 🧩 Initialize ONLY when organization context exists
    if (
      document.getElementById("organizationForm") ||
      document.getElementById("organizationList") ||
      document.getElementById("organizationTableBody")
    ) {
      await initOrganizationModule();
    }
  } catch (err) {
    console.error("❌ Failed to initialize Organization module", err);
    hideLoading();
    showToast("❌ Failed to load Organization module");
  }
});
