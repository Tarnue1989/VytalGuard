// 📦 maternity-visit.js – Entry Point (Master Pattern Aligned)

/* ============================================================
   ✅ Imports
============================================================ */

// 🧭 Main module init (handles filters, table/card views)
import { initMaternityVisitModule } from "./maternity-visit-filter-main.js";

// ⚙️ Lifecycle + action handlers (view, edit, delete, start, verify, etc.)
import "./maternity-visit-actions.js";

// 🧩 Constants (exportable for dynamic UI / column builders)
import {
  FIELD_LABELS_MATERNITY_VISIT,
  FIELD_ORDER_MATERNITY_VISIT,
  FIELD_DEFAULTS_MATERNITY_VISIT,
} from "./maternity-visit-constants.js";

// 🛠 Utilities
import { showToast, hideLoading } from "../../utils/index.js";

/* ============================================================
   🚀 DOM-Ready Bootstrap
============================================================ */

document.addEventListener("DOMContentLoaded", async () => {
  try {
    // ✅ Initialize ONLY if maternity visit UI exists
    if (
      document.getElementById("maternityVisitTableBody") ||
      document.getElementById("maternityVisitList") ||
      document.getElementById("maternityVisitForm")
    ) {
      await initMaternityVisitModule();
    }
  } catch (err) {
    console.error("❌ Failed to initialize maternity visit module", err);
    hideLoading();
    showToast("❌ Failed to load maternity visit module");
  }
});
