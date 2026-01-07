// 📦 supplier.js – Entry Point (Enterprise-Aligned Master Pattern)
// ============================================================================
// 🧭 Master Pattern: triage-record.js
// 🔹 Unified initialization entry for the Supplier module
// 🔹 Handles module boot, imports, constants, and safe startup guard
// ============================================================================

/* ============================================================
   ✅ Imports
============================================================ */

// 🧭 Main module init (handles filters, table, and pagination)
import { initSupplierModule } from "./supplier-filter-main.js";

// ⚙️ Lifecycle + action handlers (view, edit, delete, toggle, etc.)
import "./supplier-actions.js";

// 🧩 Constants (for dynamic field selector or column rendering)
import {
  FIELD_LABELS_SUPPLIER,
  FIELD_ORDER_SUPPLIER,
  FIELD_DEFAULTS_SUPPLIER,
} from "./supplier-constants.js";

// 🛠 Utilities
import { showToast, hideLoading } from "../../utils/index.js";

/* ============================================================
   🚀 DOM-Ready Bootstrap
============================================================ */
document.addEventListener("DOMContentLoaded", async () => {
  try {
    // 🧩 Initialize if this is a Supplier page (form or list)
    if (document.getElementById("supplierForm") || document.getElementById("supplierTableBody")) {
      await initSupplierModule();
    }

    // (Optional future hook:)
    // if (document.getElementById("supplierReportSection")) {
    //   await initSupplierReportModule();
    // }

  } catch (err) {
    console.error("❌ Failed to initialize Supplier module", err);
    hideLoading();
    showToast("❌ Failed to load Supplier module");
  }
});
