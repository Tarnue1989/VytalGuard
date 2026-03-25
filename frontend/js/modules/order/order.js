// 📦 order.js – Entry Point (Enterprise-Aligned MASTER Pattern)
// ============================================================================
// 🧭 Lab Request → Order Adaptation (FULL MASTER PARITY)
// 🔹 Unified initialization entry for Order module
// 🔹 Handles module boot, imports, and safe startup
// ============================================================================

/* ============================================================
   ✅ Imports
============================================================ */

// 🧭 Main module init
import { initOrderModule } from "./order-filter-main.js";

// ⚙️ Actions
import "./order-actions.js";

// 🧩 Constants
import {
  FIELD_LABELS_ORDER,
  FIELD_ORDER_ORDER,
  FIELD_DEFAULTS_ORDER,
} from "./order-constants.js";

// 🛠 Utils
import { showToast, hideLoading } from "../../utils/index.js";

/* ============================================================
   🚀 BOOT
============================================================ */
document.addEventListener("DOMContentLoaded", async () => {
  try {
    if (
      document.getElementById("orderForm") ||
      document.getElementById("orderList") ||
      document.getElementById("orderTableBody")
    ) {
      await initOrderModule();
    }

  } catch (err) {
    console.error("❌ Failed to initialize Order module", err);
    hideLoading();
    showToast("❌ Failed to load Order module");
  }
});