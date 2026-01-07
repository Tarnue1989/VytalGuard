// 📦 stockrequest.js – Entry Point (Master Pattern Aligned)

/* ============================================================
   ✅ Imports
============================================================ */

// 🧭 Main module init (handles filters, table, etc.)
import { initStockRequestModule } from "./stockrequest-filter-main.js";

// ⚙️ Lifecycle + action handlers (view, edit, delete, approve, reject, issue, etc.)
import "./stockrequest-actions.js";

// 🧩 Constants (exportable for dynamic UI or column builders)
import {
  FIELD_LABELS_STOCK_REQUEST,
  FIELD_ORDER_STOCK_REQUEST,
  FIELD_DEFAULTS_STOCK_REQUEST,
} from "./stockrequest-constants.js";

// 🛠 Utilities
import { showToast, hideLoading } from "../../utils/index.js";

/* ============================================================
   🚀 DOM-Ready Bootstrap
============================================================ */

document.addEventListener("DOMContentLoaded", async () => {
  try {
    // 🧩 Initialize only if the stock request form or list is present
    if (document.getElementById("stockRequestForm")) {
      await initStockRequestModule();
    }

    // (Optional) you can later detect a list/table container here:
    // if (document.getElementById("stockRequestTableBody")) {
    //   await initStockRequestListModule();
    // }

  } catch (err) {
    console.error("❌ Failed to initialize stock request module", err);
    hideLoading();
    showToast("❌ Failed to load stock request module");
  }
});
