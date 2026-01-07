// 📦 user.js – Entry Point (Enterprise-Aligned Master Pattern)
// ============================================================================
// 🧭 Master Pattern: role.js / vitals.js
// 🔹 Unified initialization entry for the User module
// 🔹 Handles module boot, imports, constants, and safe startup guard
// ============================================================================

/* ============================================================
   ✅ Imports
============================================================ */

// 🧭 Main module init (handles filter, table, card, etc.)
import { initUser } from "./user-filter-main.js";

// ⚙️ Lifecycle + action handlers (view, edit, delete, toggle, reset, etc.)
import "./user-actions.js";

// 🧩 Constants (kept for parity with role.js entry)
import {
  FIELD_LABELS_USER,
  FIELD_ORDER_USER,
  FIELD_DEFAULTS_USER,
} from "./user-constants.js";

// 🛠 Utilities
import { showToast, hideLoading } from "../../utils/index.js";

/* ============================================================
   🚀 DOM-Ready Bootstrap
============================================================ */

document.addEventListener("DOMContentLoaded", async () => {
  try {
    // 🧩 Initialize only if the user form or list container exists
    if (
      document.getElementById("userForm") ||
      document.getElementById("userList")
    ) {
      await initUser();
    }
  } catch (err) {
    console.error("❌ Failed to initialize User module", err);
    hideLoading();
    showToast("❌ Failed to load User module");
  }
});
