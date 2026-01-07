// 📦 newborn-record.js – Entry point

// ✅ Main module init
import { initNewbornRecordModule } from "./newborn-record-filter-main.js";

// ✅ Load action handlers (view, edit, delete, lifecycle actions)
import "./newborn-record-actions.js";

// ✅ Constants (exported if needed globally)
import {
  FIELD_LABELS_NEWBORN_RECORD,
  FIELD_ORDER_NEWBORN_RECORD,
  FIELD_DEFAULTS_NEWBORN_RECORD,
} from "./newborn-record-constants.js";

// 🛠️ Utilities
import { showToast, hideLoading } from "../../utils/index.js";

// ✅ Async-safe startup
document.addEventListener("DOMContentLoaded", async () => {
  try {
    // Ensure form exists before init (prevents errors on wrong page)
    if (document.getElementById("newbornRecordForm")) {
      await initNewbornRecordModule();
    }
  } catch (err) {
    console.error("❌ Failed to initialize newborn record module", err);
    hideLoading(); // ensure spinner doesn’t hang
    showToast("❌ Failed to load newborn record module");
  }
});
