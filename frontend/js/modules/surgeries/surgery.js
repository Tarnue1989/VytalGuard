// 📦 surgery.js – Enterprise Entry Point (Master Pattern Aligned)
// ============================================================================
// 🔹 Mirrors centralstock.js for unified init & lifecycle
// 🔹 Handles both Form (Add/Edit) and List (Table/Card) pages safely
// 🔹 Includes role + permission normalization, shared state, and error guards
// ============================================================================

// ✅ Main module init (list / filter page)
import { initSurgeryModule } from "./surgery-filter-main.js";

// ✅ Load action handlers (view, edit, delete, lifecycle)
import { setupActionHandlers } from "./surgery-actions.js";

// ✅ Constants (exported if needed globally)
import {
  FIELD_LABELS_SURGERY,
  FIELD_ORDER_SURGERY,
  FIELD_DEFAULTS_SURGERY,
} from "./surgery-constants.js";

// 🛠 Utilities
import { showToast, hideLoading } from "../../utils/index.js";

/* ============================================================
   🚀 Boot Loader
============================================================ */
document.addEventListener("DOMContentLoaded", async () => {
  try {
    // ✅ FORM PAGE (Add / Edit)
    if (document.getElementById("surgeryForm")) {
      await initSurgeryModule();
    }

    // ✅ LIST PAGE (Filter / Table / Card)
    const tableBody = document.getElementById("surgeryTableBody");
    if (tableBody) {
      const userRole = (localStorage.getItem("userRole") || "staff").toLowerCase();
      const perms = JSON.parse(localStorage.getItem("permissions") || "[]");
      const user = { role: userRole, permissions: perms };

      console.log("👤 [surgery.js] Loaded user:", user);

      const sharedState = { currentEditIdRef: { value: null } };
      const currentPage = 1;
      const loadEntries = async () => {}; // placeholder
      const visibleFields =
        FIELD_DEFAULTS_SURGERY[userRole] || FIELD_DEFAULTS_SURGERY.staff;
      const token =
        localStorage.getItem("accessToken") ||
        sessionStorage.getItem("accessToken") ||
        "";

      setupActionHandlers({
        entries: window.latestSurgeryEntries || [],
        token,
        currentPage,
        loadEntries,
        visibleFields,
        sharedState,
        user,
      });
    }
  } catch (err) {
    console.error("❌ Failed to initialize surgery module", err);
    hideLoading();
    showToast("❌ Failed to load surgery module");
  }
});
