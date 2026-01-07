// 📦 medical-record-main.js – Form-only Loader for Medical Record (Upgraded)
// ============================================================================
// 🧭 Master Pattern: Consultation Form-Only Loader (Enterprise-Aligned)
// Handles:
// - Secure permission-based initialization
// - Unified form show/hide
// - Role-based field visibility
// - Field selector initialization
// - Consistent cancel/clear/add behavior
// ============================================================================

import {
  initPageGuard,
  autoPagePermissionKey,
  initLogoutWatcher,
} from "../../utils/index.js";
import { setupMedicalRecordFormSubmission } from "./medical-record-form.js";
import {
  FIELD_LABELS_MEDICAL_RECORD,
  FIELD_ORDER_MEDICAL_RECORD,
  FIELD_DEFAULTS_MEDICAL_RECORD,
} from "./medical-record-constants.js";
import { setupFieldSelector } from "../../utils/ui-utils.js";

/* ============================================================
   🔐 Auth + Global Guards
============================================================ */
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
const form = document.getElementById("medicalRecordForm");
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
  sessionStorage.removeItem("medicalRecordEditId");
  sessionStorage.removeItem("medicalRecordEditPayload");

  // Clear text fields (clinical + history + physical + plan)
  [
    "cc", "hpi", "pmh", "fh_sh", "nut_hx", "imm_hx", "obs_hx", "gyn_hx",
    "pe", "resp_ex", "cv_ex", "abd_ex", "pel_ex", "ext", "neuro_ex",
    "ddx", "dx", "lab_inv", "img_inv", "tx_mx", "summary_pg"
  ].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });

  // Clear dropdowns
  ["organizationSelect", "facilitySelect"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });

  // Clear hidden IDs and visible search fields
  [
    "patientId", "doctorId", "consultationId", "registrationLogId",
    "patientInput", "doctorInput", "consultationInput", "registrationLogInput"
  ].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });

  // Reset checkbox and file input
  const emergency = document.getElementById("isEmergency");
  if (emergency) emergency.checked = false;
  const file = document.getElementById("reportFile");
  if (file) file.value = "";

  // Reset date
  const dateInput = document.getElementById("recordedAt");
  if (dateInput) dateInput.value = "";

  // UI
  const titleEl = document.querySelector(".card-title");
  if (titleEl) titleEl.textContent = "Add Medical Record";
  const submitBtn = form?.querySelector("button[type=submit]");
  if (submitBtn)
    submitBtn.innerHTML = `<i class="ri-add-line me-1"></i> Add Medical Record`;
}

/* ============================================================
   🧭 Form Visibility Controls
============================================================ */
function showForm() {
  formContainer?.classList.remove("hidden");
  desktopAddBtn?.classList.add("hidden");
  localStorage.setItem("medicalRecordFormVisible", "true");
}

function hideForm() {
  resetForm();
  formContainer?.classList.add("hidden");
  desktopAddBtn?.classList.remove("hidden");
  localStorage.setItem("medicalRecordFormVisible", "false");
}

// Global exposure for reuse (action handlers, external modules)
window.showForm = showForm;
window.resetForm = resetForm;

/* ============================================================
   🔘 Button Wiring
============================================================ */
if (cancelBtn) {
  cancelBtn.onclick = () => {
    resetForm();
    window.location.href = "/medical-records-list.html"; // ✅ plural redirect
  };
}

if (clearBtn) clearBtn.onclick = resetForm;

if (desktopAddBtn) {
  desktopAddBtn.onclick = () => {
    // Ensure stale edit state is purged
    sessionStorage.removeItem("medicalRecordEditId");
    sessionStorage.removeItem("medicalRecordEditPayload");

    // Reset & open clean form
    resetForm();
    showForm();
  };
}

/* ============================================================
   🧠 Loader (no-op placeholder)
============================================================ */
async function loadEntries() {
  return; // list page handles loading
}

/* ============================================================
   🚀 Module Initializer
============================================================ */
export async function initMedicalRecordModule() {
  showForm(); // auto-open form on standalone page

  setupMedicalRecordFormSubmission({
    form,
    token,
    sharedState,
    resetForm,
    loadEntries,
  });

  localStorage.setItem("medicalRecordPanelVisible", "false");

  // 🧩 Normalize role for field defaults
  let roleRaw = localStorage.getItem("userRole") || "staff";
  let role = roleRaw.trim().toLowerCase();

  if (role.includes("super") && role.includes("admin")) role = "superadmin";
  else if (role.includes("admin")) role = "admin";
  else role = "staff";

  // 🎛 Initialize Field Selector (role-based visibility)
  setupFieldSelector({
    module: "medical_record",
    fieldLabels: FIELD_LABELS_MEDICAL_RECORD,
    fieldOrder: FIELD_ORDER_MEDICAL_RECORD,
    defaultFields: FIELD_DEFAULTS_MEDICAL_RECORD[role],
  });
}

/* ============================================================
   🔁 Sync Helper
============================================================ */
export function syncRefsToState() {
  // Reserved for future reactive use
}
