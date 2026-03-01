// 📦 lab-request-main.js – Lab Request Form Page Controller (Enterprise Master Pattern)
// ============================================================================
// 🧭 Mirrors consultation-main.js / add-deposit.js EXACTLY
// 🔹 Auth guard + logout watcher
// 🔹 Form reset orchestration
// 🔹 Edit session coordination (SESSION-DRIVEN)
// 🔹 Delegates ALL business logic (including pills) to lab-request-form.js
// 🔹 NO data loaders, NO API calls, NO RBAC branching here
// ============================================================================

import { setupLabRequestFormSubmission } from "./lab-request-form.js";

import {
  initPageGuard,
  initLogoutWatcher,
  autoPagePermissionKey,
} from "../../utils/index.js";

/* ============================================================
   🔐 Auth Guard + Global Watchers
============================================================ */
const token = initPageGuard(
  autoPagePermissionKey(["lab_requests:create", "lab_requests:edit"])
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
const form = document.getElementById("labRequestForm");
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
  sessionStorage.removeItem("labRequestEditId");
  sessionStorage.removeItem("labRequestEditPayload");

  // Clear suggestion inputs (dataset + value)
  [
    "patientSearch",
    "doctorSearch",
    "consultationSearch",
    "registrationLogSearch",
    "labTestSearch",
  ].forEach((id) => {
    const el = document.getElementById(id);
    if (el) {
      el.value = "";
      el.dataset.value = "";
    }
  });

  // Clear selects (if present)
  ["departmentSelect"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });

  // Reset emergency checkbox
  const emergencyCheck = document.getElementById("is_emergency");
  if (emergencyCheck) emergencyCheck.checked = false;

  // Reset pills UI (pill state itself owned by form file)
  const pillsContainer = document.getElementById("requestPillsContainer");
  if (pillsContainer)
    pillsContainer.innerHTML =
      `<p class="text-muted">No lab tests added yet.</p>`;

  // Reset UI labels
  const titleEl = document.querySelector(".card-title");
  if (titleEl) titleEl.textContent = "Add Lab Request";

  const submitBtn = form.querySelector("button[type=submit]");
  if (submitBtn)
    submitBtn.innerHTML =
      `<i class="ri-add-line me-1"></i> Submit Lab Request`;
}

/* ============================================================
   🚀 Init (Page Entry)
============================================================ */
document.addEventListener("DOMContentLoaded", () => {
  if (!form) return;

  /* ------------------------------------------------------------
     🧠 SESSION-DRIVEN EDIT COORDINATION (MASTER FIX)
  ------------------------------------------------------------ */
  const editId = sessionStorage.getItem("labRequestEditId");
  if (editId) {
    sharedState.currentEditIdRef.value = editId;
  }

  /* ------------------------------------------------------------
     🔗 Wire Form Logic (ALL business logic lives in form file)
  ------------------------------------------------------------ */
  setupLabRequestFormSubmission({
    form,
    token,
    sharedState,
    resetForm,
  });

  /* ---------------- Cancel ---------------- */
  cancelBtn?.addEventListener("click", () => {
    sessionStorage.removeItem("labRequestEditId");
    sessionStorage.removeItem("labRequestEditPayload");
    window.location.href = "/lab-requests-list.html";
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