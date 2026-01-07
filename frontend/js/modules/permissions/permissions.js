// 📦 permissions.js – Entry point

// ✅ Main module init
import { initPermissionModule } from "./permissions-filter-main.js";

// ✅ Load action handlers (view, edit, delete)
import { setupPermissionActionHandlers } from "./permissions-actions.js";

// ✅ Constants
import {
  FIELD_LABELS_PERMISSION,
  FIELD_ORDER_PERMISSION,
  FIELD_DEFAULTS_PERMISSION,
} from "./permissions-constants.js";

// 🛠️ Utilities
import { showToast, hideLoading } from "../../utils/index.js";

document.addEventListener("DOMContentLoaded", async () => {
  try {
    // 🔹 For form page (if any future add/edit page exists)
    if (document.getElementById("permissionForm")) {
      await initPermissionModule();
    }

    // 🔹 For list page
    const tableBody = document.getElementById("permissionTableBody");
    if (tableBody) {
      // ✅ Build user from localStorage
      const userRole = (localStorage.getItem("userRole") || "staff").toLowerCase();
      const perms = JSON.parse(localStorage.getItem("permissions") || "[]");
      const user = { role: userRole, permissions: perms };

      console.log("👤 [permissions.js] Loaded user:", user);

      // Dummy placeholders (to match your standardized structure)
      const sharedState = {};
      const currentPage = 1;
      const loadEntries = async () => {};
      const visibleFields =
        FIELD_DEFAULTS_PERMISSION[userRole] || FIELD_DEFAULTS_PERMISSION.staff;
      const token = localStorage.getItem("accessToken") || "";

      // ✅ Setup action handlers for view/edit/delete
      setupPermissionActionHandlers({
        entries: window.latestPermissionEntries || [],
        token,
        currentPage,
        loadEntries,
        visibleFields,
        sharedState,
        user,
      });
    }
  } catch (err) {
    console.error("❌ Failed to initialize permission module", err);
    hideLoading();
    showToast("❌ Failed to load permission module");
  }
});
