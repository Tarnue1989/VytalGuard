// 📦 role-permissions.js – Entry point

// ✅ Main module init
import { initRolePermissionModule } from "./role-permissions-filter-main.js";

// ✅ Load action handlers (view, edit, delete)
import { setupRolePermissionActionHandlers } from "./role-permissions-actions.js";

// ✅ Constants
import {
  FIELD_LABELS_ROLE_PERMISSION,
  FIELD_ORDER_ROLE_PERMISSION,
  FIELD_DEFAULTS_ROLE_PERMISSION,
} from "./role-permissions-constants.js";

// 🛠️ Utilities
import { showToast, hideLoading } from "../../utils/index.js";

document.addEventListener("DOMContentLoaded", async () => {
  try {
    // 🔹 For form page (if any add/edit page exists)
    if (document.getElementById("rolePermissionForm")) {
      await initRolePermissionModule();
    }

    // 🔹 For list page
    const tableBody = document.getElementById("rolePermissionTableBody");
    if (tableBody) {
      // ✅ Build user from localStorage
      const userRole = (localStorage.getItem("userRole") || "staff").toLowerCase();
      const perms = JSON.parse(localStorage.getItem("permissions") || "[]");
      const user = { role: userRole, permissions: perms };

      console.log("👤 [role-permissions.js] Loaded user:", user);

      // Dummy placeholders (to match standardized structure)
      const sharedState = {};
      const currentPage = 1;
      const loadEntries = async () => {};
      const visibleFields =
        FIELD_DEFAULTS_ROLE_PERMISSION[userRole] ||
        FIELD_DEFAULTS_ROLE_PERMISSION.staff;
      const token = localStorage.getItem("accessToken") || "";

      // ✅ Setup action handlers for view/edit/delete
      setupRolePermissionActionHandlers({
        entries: window.latestRolePermissionEntries || [],
        token,
        currentPage,
        loadEntries,
        visibleFields,
        sharedState,
        user,
      });
    }
  } catch (err) {
    console.error("❌ Failed to initialize role permission module", err);
    hideLoading();
    showToast("❌ Failed to load role permission module");
  }
});
