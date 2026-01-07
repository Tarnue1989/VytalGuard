// 📦 deliveryRecord.js – Entry Point (aligned with Central Stock master pattern)

// ✅ Main module init (list / filter page)
import { initDeliveryRecordModule } from "./delivery-record-filter-main.js";

// ✅ Load action handlers (view, edit, delete, lifecycle actions)
import { setupActionHandlers } from "./delivery-record-actions.js";

// ✅ Constants (exposed if needed globally)
import {
  FIELD_LABELS_DELIVERY_RECORD,
  FIELD_ORDER_DELIVERY_RECORD,
  FIELD_DEFAULTS_DELIVERY_RECORD,
} from "./delivery-record-constants.js";

// 🛠 Utilities
import { showToast, hideLoading } from "../../utils/index.js";

document.addEventListener("DOMContentLoaded", async () => {
  try {
    // 🚀 Form Page (Add/Edit)
    if (document.getElementById("deliveryRecordForm")) {
      await initDeliveryRecordModule();
    }

    // 📋 List Page (Table/Card)
    const tableBody = document.getElementById("deliveryRecordTableBody");
    if (tableBody) {
      const userRole = (localStorage.getItem("userRole") || "staff").toLowerCase();
      const perms = JSON.parse(localStorage.getItem("permissions") || "[]");
      const user = { role: userRole, permissions: perms };

      console.log("👤 [deliveryRecord.js] Loaded user:", user);

      const sharedState = { currentEditIdRef: { value: null } };
      const currentPage = 1;
      const loadEntries = async () => {};
      const visibleFields =
        FIELD_DEFAULTS_DELIVERY_RECORD[userRole] ||
        FIELD_DEFAULTS_DELIVERY_RECORD.staff;
      const token =
        localStorage.getItem("accessToken") ||
        sessionStorage.getItem("accessToken") ||
        "";

      setupActionHandlers({
        entries: window.latestDeliveryRecordEntries || [],
        token,
        currentPage,
        loadEntries,
        visibleFields,
        sharedState,
        user,
      });
    }
  } catch (err) {
    console.error("❌ Failed to initialize delivery record module", err);
    hideLoading();
    showToast("❌ Failed to load delivery record module");
  }
});
