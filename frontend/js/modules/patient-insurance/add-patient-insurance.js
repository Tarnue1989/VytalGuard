// 📦 add-patient-insurance.js – Patient Insurance Form Page Controller (Enterprise Master Pattern)
// ============================================================================
// 🧭 Mirrors add-payment.js / add-deposit.js EXACTLY
// 🔹 Auth guard + logout watcher
// 🔹 Form reset orchestration
// 🔹 Edit session coordination
// 🔹 Delegates ALL business logic to patient-insurance-form.js
// 🔹 NO data loaders, NO API calls, NO RBAC branching here
// ============================================================================

import { setupPatientInsuranceFormSubmission } from "./patient-insurance-form.js";

import {
  initPageGuard,
  initLogoutWatcher,
  autoPagePermissionKey,
} from "../../utils/index.js";

/* ============================================================
   🔐 Auth Guard + Global Watchers
============================================================ */
const token = initPageGuard(
  autoPagePermissionKey([
    "patient_insurances:create",
    "patient_insurances:edit",
  ])
);
initLogoutWatcher();

/* ============================================================
   🌐 Shared State (Enterprise Pattern)
============================================================ */
const sharedState = {
  currentEditIdRef: { value: null },
};

/* ============================================================
   📎 DOM Refs
============================================================ */
const form = document.getElementById("patientInsuranceForm");
const cancelBtn = document.getElementById("cancelBtn");
const clearBtn = document.getElementById("clearBtn");

/* ============================================================
   🧹 Reset Helper (Add Mode)
============================================================ */
function resetForm() {
  if (!form) return;

  form.reset();
  sharedState.currentEditIdRef.value = null;

  // Clear cached edit state
  sessionStorage.removeItem("patientInsuranceEditId");

  // Clear hidden IDs (ONLY patient now)
  ["patientId"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });

  // Reset provider select (NEW)
  const providerSelect = document.getElementById("providerSelect");
  if (providerSelect) providerSelect.value = "";

  // Clear selects
  ["organizationSelect", "facilitySelect"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });

  // Reset UI labels
  const titleEl = document.querySelector(".card-title");
  if (titleEl) titleEl.textContent = "Add Patient Insurance";

  const submitBtn = form.querySelector("button[type=submit]");
  if (submitBtn)
    submitBtn.innerHTML = '<i class="ri-add-line me-1"></i> Add Patient Insurance';
}

/* ============================================================
   🚀 Init (Page Entry)
============================================================ */
document.addEventListener("DOMContentLoaded", () => {
  if (!form) return;

  // Wire form logic (ALL business logic lives there)
  setupPatientInsuranceFormSubmission({
    form,
    token,
    sharedState,
    resetForm,
  });

  /* ---------------- Cancel ---------------- */
  cancelBtn?.addEventListener("click", () => {
    sessionStorage.removeItem("patientInsuranceEditId");
    window.location.href = "/patient-insurance-list.html";
  });

  /* ---------------- Clear ---------------- */
  clearBtn?.addEventListener("click", () => {
    resetForm();
  });
});

/* ============================================================
   🔁 Reserved Sync Hook (Future)
============================================================ */
export function syncRefsToState() {
  // Reserved for enterprise reactive form syncing
}