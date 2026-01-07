// 📦 centralstock.js – Entry Point

// ✅ Main module init (list / filter page)
import { initCentralStockModule } from "./centralstock-filter-main.js";

// ✅ Load action handlers (view, edit, delete, toggle, lock, restore)
import { setupActionHandlers } from "./centralstock-actions.js";

// ✅ Constants (exposed if needed globally)
import {
  FIELD_LABELS_CENTRAL_STOCK,
  FIELD_ORDER_CENTRAL_STOCK,
  FIELD_DEFAULTS_CENTRAL_STOCK,
} from "./centralstock-constants.js";

// 🛠 Utilities
import { showToast, hideLoading } from "../../utils/index.js";

document.addEventListener("DOMContentLoaded", async () => {
  try {
    // 🚀 Form Page (Add/Edit)
    if (document.getElementById("centralStockForm")) {
      await initCentralStockModule();
    }

    // 📋 List Page (Table/Card)
    const tableBody = document.getElementById("centralStockTableBody");
    if (tableBody) {
      const userRole = (localStorage.getItem("userRole") || "staff").toLowerCase();
      const perms = JSON.parse(localStorage.getItem("permissions") || "[]");
      const user = { role: userRole, permissions: perms };

      console.log("👤 [centralstock.js] Loaded user:", user);

      const sharedState = { currentEditIdRef: { value: null } };
      const currentPage = 1;
      const loadEntries = async () => {};
      const visibleFields =
        FIELD_DEFAULTS_CENTRAL_STOCK[userRole] ||
        FIELD_DEFAULTS_CENTRAL_STOCK.staff;
      const token =
        localStorage.getItem("accessToken") ||
        sessionStorage.getItem("accessToken") ||
        "";

      setupActionHandlers({
        entries: window.latestCentralStockEntries || [],
        token,
        currentPage,
        loadEntries,
        visibleFields,
        sharedState,
        user,
      });
    }
  } catch (err) {
    console.error("❌ Failed to initialize central stock module", err);
    hideLoading();
    showToast("❌ Failed to load central stock module");
  }
});
