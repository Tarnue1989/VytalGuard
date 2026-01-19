// 📦 supplier.js – Entry Point (Enterprise-Aligned Master Pattern)
// ============================================================================
// 🧭 Master Pattern: role.js / vitals.js / department.js
// 🔹 Unified initialization entry for the Supplier module
// 🔹 Handles module boot, imports, constants, and safe startup guard
// ============================================================================

/* ============================================================
   ✅ Imports
============================================================ */

// 🧭 Main module init (handles filter, table, card, etc.)
import { initSupplierModule } from "./supplier-filter-main.js";

// ⚙️ Lifecycle + action handlers (view, edit, delete, toggle, etc.)
import "./supplier-actions.js";

// 🧩 Constants (exportable for dynamic field selector or columns)
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
    // 🧩 Initialize only if the supplier form or list container exists
    if (
      document.getElementById("supplierForm") ||
      document.getElementById("supplierList")
    ) {
      await initSupplierModule();
    }

    // (Optional) Future enhancement:
    // if (document.getElementById("supplierTableBody")) {
    //   await initSupplierListModule();
    // }

  } catch (err) {
    console.error("❌ Failed to initialize Supplier module", err);
    hideLoading();
    showToast("❌ Failed to load Supplier module");
  }
});
