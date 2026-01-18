// 📦 appointments.js – Enterprise Entry Point (MASTER PATTERN ALIGNED)
// ============================================================================
// 🔹 Mirrors feature-access.js EXACTLY (appointment variant)
// 🔹 Safe boot with page-type detection (form vs list)
// 🔹 No double init, no UI breakage
// ============================================================================

/* ============================================================
   ✅ Imports
============================================================ */

// 🧭 FORM initializer (add / edit page)
import { initAppointmentModule } from "./appointments-main.js";

// ⚙️ Action handlers (view, edit, lifecycle, delete)
import "./appointments-actions.js";

// 🛠️ Utilities
import { showToast, hideLoading } from "../../utils/index.js";

/* ============================================================
   🚀 DOM-Ready Bootstrap
============================================================ */
document.addEventListener("DOMContentLoaded", async () => {
  try {
    /**
     * 🔹 FORM MODE ONLY
     * appointments-main.js is FORM-ONLY
     */
    if (document.getElementById("appointmentForm")) {
      await initAppointmentModule();
    }

    /**
     * 🔹 LIST MODE
     * appointment-filter-main.js bootstraps itself
     * so we intentionally DO NOTHING here
     */

  } catch (err) {
    console.error("❌ Failed to initialize Appointments:", err);

    // 🧯 Prevent stuck spinner
    hideLoading();

    // 🔔 User feedback
    showToast("❌ Failed to load Appointments");

    // 🧱 Prevent broken form UI
    document.getElementById("formContainer")?.classList.add("hidden");
  }
});
