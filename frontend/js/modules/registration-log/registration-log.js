// 📦 registrationLog.js – Entry point (permission-driven, unified pattern)

// ✅ Main module init
import { initRegistrationLogModule } from "./registrationLog-filter-main.js";

// ✅ Load action handlers (view, edit, delete, toggle, lifecycle)
import { setupActionHandlers } from "./registration-log-actions.js";

// ✅ Constants
import {
  FIELD_LABELS_REGISTRATION_LOG,
  FIELD_ORDER_REGISTRATION_LOG,
  FIELD_DEFAULTS_REGISTRATION_LOG,
} from "./registration-log-constants.js";

// 🛠️ Utilities
import { showToast, hideLoading } from "../../utils/index.js";

/* ============================================================
   🚀 Async-safe Startup
   ============================================================ */
document.addEventListener("DOMContentLoaded", async () => {
  try {
    // ✅ If this is a form page → init module
    if (document.getElementById("registrationLogForm")) {
      await initRegistrationLogModule();
    }

    // ✅ If this is a list page → wire up actions
    const tableBody = document.getElementById("registrationLogTableBody");
    if (tableBody) {
      // Build user context
      const userRole = (localStorage.getItem("userRole") || "staff").toLowerCase();
      const perms = JSON.parse(localStorage.getItem("permissions") || "[]");
      const user = { role: userRole, permissions: perms };

      console.log("👤 [registrationLog.js] Loaded user:", user);

      // Shared state + placeholders for consistency
      const sharedState = {};
      const currentPage = 1;
      const loadEntries = async () => {};
      const visibleFields =
        FIELD_DEFAULTS_REGISTRATION_LOG[userRole] ||
        FIELD_DEFAULTS_REGISTRATION_LOG.staff;
      const token = localStorage.getItem("accessToken") || "";

      // ✅ Attach action handlers dynamically
      setupActionHandlers({
        entries: window.latestRegistrationLogEntries || [],
        token,
        currentPage,
        loadEntries,
        visibleFields,
        sharedState,
        user,
      });
    }
  } catch (err) {
    console.error("❌ Failed to initialize registration log module", err);
    hideLoading();
    showToast("❌ Failed to load registration log module");
  }
});
