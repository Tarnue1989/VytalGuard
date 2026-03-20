// 📁 prescription-main.js – Prescription Form Page Controller (MASTER-ALIGNED)
// ============================================================================
// 🧭 EXACT parity with lab-request-main.js
// 🔹 Auth guard + logout watcher
// 🔹 Form reset orchestration
// 🔹 Edit session coordination (SESSION-DRIVEN)
// 🔹 Delegates ALL business logic to prescription-form.js
// 🔹 NO data loaders, NO API calls, NO RBAC branching here
// ============================================================================

import { setupPrescriptionFormSubmission } from "./prescription-form.js";

import {
  initPageGuard,
  initLogoutWatcher,
  autoPagePermissionKey,
} from "../../utils/index.js";

/* ============================================================
   🔐 Auth Guard + Global Watchers
============================================================ */
const token = initPageGuard(
  autoPagePermissionKey(["prescriptions:create", "prescriptions:edit"])
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
const form = document.getElementById("prescriptionForm");
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
  sessionStorage.removeItem("prescriptionEditId");
  sessionStorage.removeItem("prescriptionEditPayload");

  // Clear suggestion inputs (dataset + value)
  [
    "patientSearch",
    "doctorSearch",
    "consultationSearch",
    "registrationLogSearch",
    "medicationSearch",
  ].forEach((id) => {
    const el = document.getElementById(id);
    if (el) {
      el.value = "";
      el.dataset.value = "";
    }
  });

  // Clear selects
  ["departmentSelect"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });

  // Reset emergency checkbox
  const emergencyCheck = document.getElementById("is_emergency");
  if (emergencyCheck) emergencyCheck.checked = false;

  // Reset pills UI ONLY (state handled in form file)
  const pillsContainer = document.getElementById("prescriptionPillsContainer");
  if (pillsContainer)
    pillsContainer.innerHTML =
      `<p class="text-muted">No prescription items added yet.</p>`;

  // Reset UI labels
  const titleEl = document.querySelector(".card-title");
  if (titleEl) titleEl.textContent = "Add Prescription";

  const submitBtn = form.querySelector("button[type=submit]");
  if (submitBtn)
    submitBtn.innerHTML =
      `<i class="ri-add-line me-1"></i> Submit Prescription`;
}

/* ============================================================
   🚀 Init (Page Entry)
============================================================ */
document.addEventListener("DOMContentLoaded", () => {
  if (!form) return;

  /* ------------------------------------------------------------
     🧠 SESSION-DRIVEN EDIT COORDINATION (MASTER)
  ------------------------------------------------------------ */
  const editId = sessionStorage.getItem("prescriptionEditId");
  if (editId) {
    sharedState.currentEditIdRef.value = editId;
  }

  /* ------------------------------------------------------------
     🔗 Wire Form Logic (ALL business logic in form file)
  ------------------------------------------------------------ */
  setupPrescriptionFormSubmission({
    form,
    token,
    sharedState,
    resetForm,
  });

  /* ---------------- Cancel ---------------- */
  cancelBtn?.addEventListener("click", () => {
    sessionStorage.removeItem("prescriptionEditId");
    sessionStorage.removeItem("prescriptionEditPayload");
    window.location.href = "/prescriptions-list.html";
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
  // Reserved for enterprise reactive syncing
}