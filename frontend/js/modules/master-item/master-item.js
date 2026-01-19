// 📦 master-item.js – Entry Point (Enterprise-Aligned Master Pattern)
// ============================================================================
// 🧭 FULL PARITY with department.js
// 🔹 Unified initialization entry for the Master Item module
// 🔹 SAFE startup guard (list-only bootstrap)
// 🔹 NEVER initializes list logic on form pages
// ============================================================================

/* ============================================================
   ✅ Imports
============================================================ */

// 🧭 Main LIST module init (filters, table, card, pagination, summary)
import { initMasterItemModule } from "./master-item-filter-main.js";

// ⚙️ Lifecycle + action handlers (view, edit, delete, toggle, etc.)
import "./master-item-actions.js";

// 🧩 Constants (exportable for dynamic field selector / columns)
import {
  FIELD_LABELS_MASTER_ITEM,
  FIELD_ORDER_MASTER_ITEM,
  FIELD_DEFAULTS_MASTER_ITEM,
} from "./master-item-constants.js";

// 🛠 Utilities
import { showToast, hideLoading } from "../../utils/index.js";

/* ============================================================
   🚀 DOM-Ready Bootstrap (MASTER SAFE)
============================================================ */
document.addEventListener("DOMContentLoaded", async () => {
  try {
    // ✅ LIST PAGE ONLY — matches department.js behavior
    if (document.getElementById("masterItemList")) {
      await initMasterItemModule();
    }

  } catch (err) {
    console.error("❌ Failed to initialize Master Item module", err);
    hideLoading();
    showToast("❌ Failed to load Master Item module");
  }
});
