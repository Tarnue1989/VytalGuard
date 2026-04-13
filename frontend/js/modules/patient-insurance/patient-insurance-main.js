// 📦 patient-insurance-main.js – Form-only loader for Patient Insurance (Enterprise Master Pattern)
// ============================================================================
// 🧭 FULL MASTER PARITY WITH payment-main.js
// 🔹 Auth guard + logout watcher
// 🔹 Unified form visibility and reset logic
// 🔹 Session-safe edit caching
// 🔹 Field selector integration (role-aware)
// 🔹 100% ID-safe and controller-aligned
// ============================================================================

import {
  initPageGuard,
  autoPagePermissionKey,
  initLogoutWatcher,
} from "../../utils/index.js";

import { setupPatientInsuranceFormSubmission } from "./patient-insurance-form.js";

import {
  FIELD_LABELS_PATIENT_INSURANCE,
  FIELD_ORDER_PATIENT_INSURANCE,
  FIELD_DEFAULTS_PATIENT_INSURANCE,
} from "./patient-insurance-constants.js";

import { setupFieldSelector } from "../../utils/ui-utils.js";

/* ============================================================
   🔐 Auth Guard + Shared State
============================================================ */
const token = initPageGuard(
  autoPagePermissionKey([
    "patient_insurances:create",
    "patient_insurances:edit",
  ])
);
initLogoutWatcher();

const sharedState = {
  currentEditIdRef: { value: null },
};

/* ============================================================
   📎 DOM Refs
============================================================ */
const form = document.getElementById("patientInsuranceForm");
const formContainer = document.getElementById("formContainer");
const desktopAddBtn = document.getElementById("desktopAddBtn");
const cancelBtn = document.getElementById("cancelBtn");
const clearBtn = document.getElementById("clearBtn");

/* ============================================================
   🧹 Reset Form Helper (MASTER PARITY)
============================================================ */
function resetForm() {
  sharedState.currentEditIdRef.value = null;
  if (form) form.reset();

  // Clear cached edit state
  sessionStorage.removeItem("patientInsuranceEditId");

  // Clear text inputs (REMOVED providerInput)
  [
    "patientInput",
    "policyNumber",
    "planName",
    "coverageLimit",
    "validFrom",
    "validTo",
    "notes",
  ].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });

  // Clear dropdowns
  ["organizationSelect", "facilitySelect"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });

  // Reset provider select (NEW FIX)
  const providerSelect = document.getElementById("providerSelect");
  if (providerSelect) providerSelect.value = "";

  // Clear hidden IDs (REMOVED providerId)
  ["patientId"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });
}

/* ============================================================
   🧭 Form Show / Hide
============================================================ */
function showForm() {
  formContainer?.classList.remove("hidden");
  desktopAddBtn?.classList.add("hidden");
  localStorage.setItem("patientInsuranceFormVisible", "true");
}

function hideForm() {
  resetForm();
  formContainer?.classList.add("hidden");
  desktopAddBtn?.classList.remove("hidden");
  localStorage.setItem("patientInsuranceFormVisible", "false");
}

// 🔗 Expose globally
window.showForm = showForm;
window.resetForm = resetForm;

/* ============================================================
   🔘 Button Wiring
============================================================ */
if (cancelBtn) {
  cancelBtn.onclick = () => {
    resetForm();
    window.location.href = "/patient-insurance-list.html";
  };
}

if (clearBtn) clearBtn.onclick = resetForm;

if (desktopAddBtn) {
  desktopAddBtn.onclick = () => {
    sessionStorage.removeItem("patientInsuranceEditId");
    resetForm();
    showForm();
  };
}

/* ============================================================
   📦 Loader Placeholder (FORM-ONLY MODE)
============================================================ */
async function loadEntries() {
  return;
}

/* ============================================================
   🚀 Init Entrypoint
============================================================ */
export async function initPatientInsuranceModule() {
  showForm();

  if (form) {
    setupPatientInsuranceFormSubmission({
      form,
      token,
      sharedState,
      resetForm,
      loadEntries,
    });
  }

  localStorage.setItem("patientInsurancePanelVisible", "false");

  // Normalize role
  let roleRaw = localStorage.getItem("userRole") || "staff";
  let role = roleRaw.trim().toLowerCase();

  if (role.includes("super") && role.includes("admin")) role = "superadmin";
  else if (role.includes("admin")) role = "admin";
  else role = "staff";

  setupFieldSelector({
    module: "patient_insurances",
    fieldLabels: FIELD_LABELS_PATIENT_INSURANCE,
    fieldOrder: FIELD_ORDER_PATIENT_INSURANCE,
    defaultFields:
      FIELD_DEFAULTS_PATIENT_INSURANCE[role] ||
      FIELD_DEFAULTS_PATIENT_INSURANCE.staff,
  });
}

/* ============================================================
   🔁 Sync Stub
============================================================ */
export function syncRefsToState() {
  // reserved for future reactive syncing
}