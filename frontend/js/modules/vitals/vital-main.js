// 📦 vital-main.js – Form-only loader for Vital (Master-Aligned)
// ============================================================================
// 🧭 Master Pattern: consultation-main.js
// 🔹 Enterprise-aligned structure with identical resetForm(), show/hide behavior,
//   permission guards, role normalization, and field selector setup.
// 🔹 All original HTML IDs are preserved exactly as in your existing vital form.
// ============================================================================

import {
  initPageGuard,
  autoPagePermissionKey,
  initLogoutWatcher,
} from "../../utils/index.js";
import { setupVitalFormSubmission } from "./vital-form.js";
import {
  FIELD_LABELS_VITAL,
  FIELD_ORDER_VITAL,
  FIELD_DEFAULTS_VITAL,
} from "./vital-constants.js";
import { setupFieldSelector } from "../../utils/ui-utils.js";

/* ============================================================
   🔐 Auth + Global Guards
============================================================ */
// Automatically resolves correct permission ("vitals:create" / "vitals:edit")
const token = initPageGuard(autoPagePermissionKey());
initLogoutWatcher();

/* ============================================================
   🌐 Shared State
============================================================ */
const sharedState = {
  currentEditIdRef: { value: null },
};

/* ============================================================
   📎 DOM Refs
============================================================ */
const form = document.getElementById("vitalForm");
const formContainer = document.getElementById("formContainer");
const desktopAddBtn = document.getElementById("desktopAddBtn");
const cancelBtn = document.getElementById("cancelBtn");
const clearBtn = document.getElementById("clearBtn");

/* ============================================================
   🧹 Reset Form Helper
============================================================ */
function resetForm() {
  sharedState.currentEditIdRef.value = null;
  if (form) form.reset();

  // Clear cached edit session
  sessionStorage.removeItem("vitalEditId");
  sessionStorage.removeItem("vitalEditPayload");

  // Text / numeric input fields
  [
    "bp",
    "pulse",
    "rr",
    "temp",
    "oxygen",
    "weight",
    "height",
    "rbg",
    "painScore",
    "position",
    "recordedAt",
    "patientInput",
    "nurseInput",
  ].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });

  // Dropdowns
  ["organizationSelect", "facilitySelect"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });

  // Hidden IDs
  ["patientId", "nurseId"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });

  // Default status (Active, if applicable)
  const activeRadio = document.getElementById("status_active");
  if (activeRadio) activeRadio.checked = true;
}

/* ============================================================
   🧭 Form Visibility
============================================================ */
function showForm() {
  formContainer?.classList.remove("hidden");
  desktopAddBtn?.classList.add("hidden");
  localStorage.setItem("vitalFormVisible", "true");
}

function hideForm() {
  resetForm();
  formContainer?.classList.add("hidden");
  desktopAddBtn?.classList.remove("hidden");
  localStorage.setItem("vitalFormVisible", "false");
}

// Expose globally for reuse by action handlers
window.showForm = showForm;
window.resetForm = resetForm;

/* ============================================================
   🔘 Button Wiring
============================================================ */
if (cancelBtn) {
  cancelBtn.onclick = () => {
    resetForm();
    window.location.href = "/vitals-list.html"; // ✅ plural redirect
  };
}

if (clearBtn) clearBtn.onclick = resetForm;

if (desktopAddBtn) {
  desktopAddBtn.onclick = () => {
    // Purge stale edit data
    sessionStorage.removeItem("vitalEditId");
    sessionStorage.removeItem("vitalEditPayload");

    // Reset form for Add mode
    resetForm();
    showForm();
  };
}

/* ============================================================
   🧠 Loader (no-op)
============================================================ */
async function loadEntries() {
  return; // list page handles this
}

/* ============================================================
   🚀 Module Initializer
============================================================ */
export async function initVitalModule() {
  // Restore last form visibility state
  const visible = localStorage.getItem("vitalFormVisible") === "true";
  if (visible) showForm();
  else hideForm();

  // Initialize form submission
  if (form) {
    setupVitalFormSubmission({
      form,
      token,
      sharedState,
      resetForm,
      loadEntries,
    });
  }

  // Hide list panel on standalone form
  localStorage.setItem("vitalPanelVisible", "false");

  /* --------------------- Role Normalization --------------------- */
  let roleRaw = localStorage.getItem("userRole") || "staff";
  let role = roleRaw.trim().toLowerCase();

  if (role.includes("super") && role.includes("admin")) role = "superadmin";
  else if (role.includes("admin")) role = "admin";
  else role = "staff";

  /* --------------------- Field Selector Setup --------------------- */
  setupFieldSelector({
    module: "vitals",
    fieldLabels: FIELD_LABELS_VITAL,
    fieldOrder: FIELD_ORDER_VITAL,
    defaultFields: FIELD_DEFAULTS_VITAL[role],
  });
}

/* ============================================================
   🔁 Sync Helper (reserved)
============================================================ */
export function syncRefsToState() {
  // Reserved for advanced reactive behavior
}
