// 📦 add-branding.js – FINAL MASTER (CLEAN + ALIGNED)

import { setupBrandingForm } from "./branding-form.js";

import {
  initPageGuard,
  autoPagePermissionKey,
  initLogoutWatcher,
  showToast,
} from "../../utils/index.js";

/* ============================================================
   🔐 AUTH GUARD
============================================================ */
initPageGuard(autoPagePermissionKey());
initLogoutWatcher();

/* ============================================================
   🧹 FULL RESET (MASTER CLEAN)
============================================================ */
function resetForm() {
  const form = document.getElementById("brandingForm");
  if (!form) return;

  form.reset();

  /* ================= Theme Defaults ================= */
  document.getElementById("theme_primary").value = "#0f62fe";
  document.getElementById("theme_secondary").value = "#6f6f6f";
  document.getElementById("theme_surface").value = "#ffffff";
  document.getElementById("theme_text").value = "#111827";

  /* ================= System Defaults ================= */
  document.getElementById("currency").value = "USD";
  document.getElementById("locale").value = "en-US";
  document.getElementById("timezone").value = "UTC";

  /* ================= Status ================= */
  const activeRadio = document.querySelector(
    "input[name='status'][value='active']"
  );
  if (activeRadio) activeRadio.checked = true;

  /* ================= CLEAR IMAGE PREVIEWS ================= */
  ["logoPreview", "logoPrintPreview", "faviconPreview"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = "";
  });

  /* ================= CLEAR FILE INPUTS ================= */
  ["logo", "logo_print", "favicon"].forEach((id) => {
    const input = document.getElementById(id);
    if (input) input.value = "";
  });
}

/* ============================================================
   🚀 INIT
============================================================ */
document.addEventListener("DOMContentLoaded", async () => {
  const form = document.getElementById("brandingForm");
  if (!form) return;

  try {
    await setupBrandingForm({ form });
  } catch (err) {
    console.error(err);
    showToast("❌ Failed to initialize branding form");
  }

  /* ============================================================
     🔘 BUTTONS
  ============================================================ */

  // 🔙 Back
  document.getElementById("backBtn")?.addEventListener("click", () => {
    window.location.href = "/organization-branding.html";
  });

  // ❌ Cancel (optional — only if button exists)
  document.getElementById("cancelBtn")?.addEventListener("click", () => {
    window.location.href = "/dashboard.html";
  });

  // 🧹 Clear (RESET)
  document.getElementById("clearBtn")?.addEventListener("click", () => {
    resetForm();
  });
});