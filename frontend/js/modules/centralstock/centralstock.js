// 📦 centralstock.js – Entry Point (Enterprise-Aligned Master Pattern)
// ============================================================================
// 🧭 Master Pattern: billableitem.js / department.js / role.js
// 🔹 Unified initialization entry for the Central Stock module
// 🔹 Handles form + filter/list bootstrapping safely
// 🔹 Enterprise-grade startup guard and error handling
// ============================================================================

/* ============================================================
   ✅ Imports
============================================================ */

// 🧭 Main module init (filters, table, card, pagination, summary)
import { initCentralStockModule } from "./centralstock-filter-main.js";

// ⚙️ Lifecycle + action handlers (edit, delete, toggle, lock, restore)
import "./centralstock-actions.js";

// 🧩 Constants (exportable for field selector / dynamic UI)
import {
  FIELD_LABELS_CENTRAL_STOCK,
  FIELD_ORDER_CENTRAL_STOCK,
  FIELD_DEFAULTS_CENTRAL_STOCK,
} from "./centralstock-constants.js";

// 🛠 Utilities
import { showToast, hideLoading } from "../../utils/index.js";

/* ============================================================
   🚀 DOM-Ready Bootstrap
============================================================ */
document.addEventListener("DOMContentLoaded", async () => {
  try {
    // 🧩 Initialize only if Central Stock form or list is present
    if (
      document.getElementById("centralStockForm") ||
      document.getElementById("centralStockList") ||
      document.getElementById("centralStockTableBody")
    ) {
      await initCentralStockModule();
    }

    // (Reserved – future split initializers)
    // if (document.getElementById("centralStockTableBody")) {
    //   await initCentralStockListModule();
    // }

  } catch (err) {
    console.error("❌ Failed to initialize Central Stock module", err);
    hideLoading();
    showToast("❌ Failed to load Central Stock module");
  }
});
