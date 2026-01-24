// 📦 delivery-record.js – Entry Point (Enterprise-Aligned Master Pattern)
// ============================================================================
// 🧭 Master Pattern: ekg-record.js / registrationLog.js / department.js
// 🔹 Unified initialization entry for the Delivery Record module
// 🔹 Handles module boot, imports, constants, and safe startup guard
// 🔹 NO business logic, NO API calls here
// ============================================================================

/* ============================================================
   ✅ Imports
============================================================ */

// 🧭 Main module init (handles filters, table, card, pagination, etc.)
import { initDeliveryRecordModule } from "./delivery-record-filter-main.js";

// ⚙️ Lifecycle + action handlers (side-effect import only)
import "./delivery-record-actions.js";

// 🧩 Constants (exportable for dynamic field selector or columns)
import {
  FIELD_LABELS_DELIVERY_RECORD,
  FIELD_ORDER_DELIVERY_RECORD,
  FIELD_DEFAULTS_DELIVERY_RECORD,
} from "./delivery-record-constants.js";

// 🛠 Utilities
import { showToast, hideLoading } from "../../utils/index.js";

/* ============================================================
   🚀 DOM-Ready Bootstrap
============================================================ */

document.addEventListener("DOMContentLoaded", async () => {
  try {
    // 🧩 Initialize ONLY if delivery record form or list exists
    if (
      document.getElementById("deliveryRecordForm") ||
      document.getElementById("deliveryRecordList") ||
      document.getElementById("deliveryRecordTableBody")
    ) {
      await initDeliveryRecordModule();
    }
  } catch (err) {
    console.error("❌ Failed to initialize Delivery Record module", err);
    hideLoading();
    showToast("❌ Failed to load Delivery Record module");
  }
});
