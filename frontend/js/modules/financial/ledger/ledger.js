// 📦 ledger.js – Entry point

// ✅ Main module init
import { initLedgerModule } from "./ledger-main.js";

// ✅ Load action handlers
import "./ledger-actions.js";

// ✅ Constants (export if needed globally)
import {
  FIELD_LABELS_LEDGER,
  FIELD_ORDER_LEDGER,
  FIELD_DEFAULTS_LEDGER,
} from "./ledger-constants.js";

// 🛠️ Utilities
import { showToast, hideLoading } from "../../../utils/index.js";

/* ============================================================ */
/* 🚀 Async-safe startup */
document.addEventListener("DOMContentLoaded", async () => {
  try {
    // Ledger container check
    if (
      document.getElementById("ledgerTableBody") ||
      document.getElementById("ledgerList")
    ) {
      await initLedgerModule();
    }
  } catch (err) {
    console.error("❌ Failed to initialize ledger module", err);
    hideLoading();
    showToast("❌ Failed to load ledger module");
  }
});