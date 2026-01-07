// 📦 ekg-record.js – Entry Point (Unified Master Pattern)

// ✅ Main module init (list / filter page)
import { initEKGRecordModule } from "./ekg-record-filter-main.js";

// ✅ Load action handlers (view, edit, delete, lifecycle)
import { setupActionHandlers } from "./ekg-record-actions.js";

// ✅ Constants (exposed if needed globally)
import {
  FIELD_LABELS_EKG_RECORD,
  FIELD_ORDER_EKG_RECORD,
  FIELD_DEFAULTS_EKG_RECORD,
} from "./ekg-record-constants.js";

// 🛠 Utilities
import { showToast, hideLoading } from "../../utils/index.js";

document.addEventListener("DOMContentLoaded", async () => {
  try {
    /* ============================================================
       🧾 FORM PAGE (Add / Edit)
       ------------------------------------------------------------
       Checks if <form id="ekgRecordForm"> exists before init.
    ============================================================ */
    if (document.getElementById("ekgRecordForm")) {
      await initEKGRecordModule();
    }

    /* ============================================================
       📋 LIST PAGE (Table / Card View)
    ============================================================ */
    const tableBody = document.getElementById("ekgRecordTableBody");
    if (tableBody) {
      const userRole = (localStorage.getItem("userRole") || "staff").toLowerCase();
      const perms = JSON.parse(localStorage.getItem("permissions") || "[]");
      const user = { role: userRole, permissions: perms };

      console.log("👤 [ekg-record.js] Loaded user:", user);

      const sharedState = { currentEditIdRef: { value: null } };
      const currentPage = 1;
      const loadEntries = async () => {};

      const visibleFields =
        FIELD_DEFAULTS_EKG_RECORD[userRole] ||
        FIELD_DEFAULTS_EKG_RECORD.staff;

      const token =
        localStorage.getItem("accessToken") ||
        sessionStorage.getItem("accessToken") ||
        "";

      setupActionHandlers({
        entries: window.latestEKGRecordEntries || [],
        token,
        currentPage,
        loadEntries,
        visibleFields,
        sharedState,
        user,
      });
    }
  } catch (err) {
    console.error("❌ Failed to initialize EKG Record module", err);
    hideLoading();
    showToast("❌ Failed to load EKG Record module");
  }
});
