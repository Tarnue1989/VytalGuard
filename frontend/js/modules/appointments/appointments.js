// 📦 appointments.js – Entry point

// ✅ Main module init
import { initAppointmentModule } from "./appointments-filter-main.js";

// ✅ Load action handlers (view, edit, delete, toggle, lifecycle)
import { setupActionHandlers } from "./appointments-actions.js";  // ⬅️ import properly

// ✅ Constants
import {
  FIELD_LABELS_APPOINTMENT,
  FIELD_ORDER_APPOINTMENT,
  FIELD_DEFAULTS_APPOINTMENT,
} from "./appointments-constants.js";

// 🛠️ Utilities
import { showToast, hideLoading } from "../../utils/index.js";

document.addEventListener("DOMContentLoaded", async () => {
  try {
    if (document.getElementById("appointmentForm")) {
      // For form page
      await initAppointmentModule();
    }

    // For list page
    const tableBody = document.getElementById("appointmentTableBody");
    if (tableBody) {
      // ✅ Build user from localStorage
      const userRole = (localStorage.getItem("userRole") || "staff").toLowerCase();
      const perms = JSON.parse(localStorage.getItem("permissions") || "[]");
      const user = { role: userRole, permissions: perms };

      console.log("👤 [appointments.js] Loaded user:", user);

      // Dummy placeholders (you can replace with real ones from your list module)
      const sharedState = {};
      const currentPage = 1;
      const loadEntries = async () => {};
      const visibleFields = FIELD_DEFAULTS_APPOINTMENT[userRole] || FIELD_DEFAULTS_APPOINTMENT.staff;
      const token = localStorage.getItem("accessToken") || "";

      setupActionHandlers({
        entries: window.latestAppointmentEntries || [],
        token,
        currentPage,
        loadEntries,
        visibleFields,
        sharedState,
        user,
      });
    }
  } catch (err) {
    console.error("❌ Failed to initialize appointment module", err);
    hideLoading();
    showToast("❌ Failed to load appointment module");
  }
});
