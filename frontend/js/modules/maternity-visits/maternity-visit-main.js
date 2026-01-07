// 📦 maternity-visit-main.js – Form-only loader for Maternity Visit (Master Pattern Aligned)

/* ============================================================
   🔐 Imports
============================================================ */

import {
  initPageGuard,
  autoPagePermissionKey,
  initLogoutWatcher,
} from "../../utils/index.js";

import { setupMaternityVisitFormSubmission } from "./maternity-visit-form.js";

import {
  FIELD_LABELS_MATERNITY_VISIT,
  FIELD_ORDER_MATERNITY_VISIT,
  FIELD_DEFAULTS_MATERNITY_VISIT,
} from "./maternity-visit-constants.js";

import { setupFieldSelector } from "../../utils/ui-utils.js";

/* ============================================================
   🔐 Auth + Global Guards
============================================================ */

// ✅ Auto-resolves correct permission (create / edit)
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
const form = document.getElementById("maternityVisitForm");
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

  // Clear cached edit state
  sessionStorage.removeItem("maternityVisitEditId");
  sessionStorage.removeItem("maternityVisitEditPayload");

  // Explicitly clear text inputs
  [
    "patientInput",
    "doctorInput",
    "midwifeInput",
    "lnmp",
    "expectedDueDate",
    "estimatedGestAge",
    "fundusHeight",
    "fetalHeartRate",
    "presentation",
    "position",
    "complaint",
    "gravida",
    "para",
    "abortion",
    "living",
    "visitNotes",
    "bloodPressure",
    "weight",
    "height",
    "temperature",
    "pulseRate",
  ].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });

  // Clear dropdowns
  [
    "organizationSelect",
    "facilitySelect",
    "visitTypeSelect",
    "registrationLogSelect",
  ].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });

  // Clear hidden IDs
  ["patientId", "doctorId", "midwifeId"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });

  // Reset visit date
  const dateInput = document.getElementById("visitDate");
  if (dateInput) dateInput.value = "";
}

/* ============================================================
   🧭 Form Visibility
============================================================ */
function showForm() {
  formContainer?.classList.remove("hidden");
  desktopAddBtn?.classList.add("hidden");
  localStorage.setItem("maternityVisitFormVisible", "true");
}

function hideForm() {
  resetForm();
  formContainer?.classList.add("hidden");
  desktopAddBtn?.classList.remove("hidden");
  localStorage.setItem("maternityVisitFormVisible", "false");
}

// 🌍 Expose globally (matches ultrasound)
window.showForm = showForm;
window.resetForm = resetForm;

/* ============================================================
   🔘 Button Wiring
============================================================ */
if (cancelBtn) {
  cancelBtn.onclick = () => {
    resetForm();
    window.location.href = "/maternity-visits-list.html"; // ✅ plural redirect
  };
}

if (clearBtn) clearBtn.onclick = resetForm;

if (desktopAddBtn) {
  desktopAddBtn.onclick = () => {
    // Ensure stale edit data is cleared
    sessionStorage.removeItem("maternityVisitEditId");
    sessionStorage.removeItem("maternityVisitEditPayload");

    resetForm();
    showForm();
  };
}

/* ============================================================
   🧠 Loader (no-op)
============================================================ */
async function loadEntries() {
  return; // list page handles loading
}

/* ============================================================
   🚀 Module Initializer
============================================================ */
export async function initMaternityVisitModule() {
  showForm(); // auto-open form on standalone page

  setupMaternityVisitFormSubmission({
    form,
    token,
    sharedState,
    resetForm,
    loadEntries,
  });

  localStorage.setItem("maternityVisitPanelVisible", "false");

  // Normalize role (ULTRASOUND-PARITY)
  let roleRaw = localStorage.getItem("userRole") || "staff";
  let role = roleRaw.trim().toLowerCase();

  if (role.includes("super") && role.includes("admin")) role = "superadmin";
  else if (role.includes("admin")) role = "admin";
  else role = "staff";

  // 🧩 Initialize Field Selector (role-based)
  setupFieldSelector({
    module: "maternity_visit",
    fieldLabels: FIELD_LABELS_MATERNITY_VISIT,
    fieldOrder: FIELD_ORDER_MATERNITY_VISIT,
    defaultFields: FIELD_DEFAULTS_MATERNITY_VISIT[role],
  });
}

/* ============================================================
   🔁 Sync Helper
============================================================ */
export function syncRefsToState() {
  // reserved for advanced reactive integration
}
