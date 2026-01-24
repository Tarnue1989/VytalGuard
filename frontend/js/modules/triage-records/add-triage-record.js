// 📦 add-triage-record.js – Triage Record Form Page Controller (Enterprise MASTER PARITY)
// ============================================================================
// 🧭 Mirrors vital-main.js / ekg-record-main.js / add-registration-log.js EXACTLY
// 🔹 Auth guard + logout watcher
// 🔹 Form visibility & reset orchestration
// 🔹 Edit session coordination
// 🔹 Delegates ALL business logic to triage-record-form.js
// ❌ NO API calls
// ❌ NO dropdown loading
// ❌ NO suggestion logic
// ============================================================================

import { setupTriageRecordFormSubmission } from "./triage-record-form.js";

import {
  initPageGuard,
  initLogoutWatcher,
  autoPagePermissionKey,
} from "../../utils/index.js";

/* ============================================================
   🔐 Auth Guard + Global Watchers
============================================================ */
const token = initPageGuard(
  autoPagePermissionKey(["triage_records:create", "triage_records:edit"])
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
const form = document.getElementById("triageRecordForm");
const formContainer = document.getElementById("formContainer");
const cancelBtn = document.getElementById("cancelBtn");
const clearBtn = document.getElementById("clearBtn");

/* ============================================================
   🧹 Reset Helper (Add Mode – MASTER PARITY)
============================================================ */
function resetForm() {
  if (!form) return;

  form.reset();
  sharedState.currentEditIdRef.value = null;

  // Clear cached edit state
  sessionStorage.removeItem("triageRecordEditId");
  sessionStorage.removeItem("triageRecordEditPayload");

  // Clear hidden + select fields
  [
    "patientId",
    "doctorId",
    "nurseId",
    "organizationSelect",
    "facilitySelect",
    "triageTypeSelect",
    "registrationLogSelect",
  ].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });

  // Reset UI labels
  const titleEl = document.querySelector(".card-title");
  if (titleEl) titleEl.textContent = "Add Triage Record";

  const submitBtn = form.querySelector("button[type=submit]");
  if (submitBtn)
    submitBtn.innerHTML =
      `<i class="ri-add-line me-1"></i> Add Triage Record`;
}

/* ============================================================
   🚀 Init (Page Entry)
============================================================ */
document.addEventListener("DOMContentLoaded", () => {
  if (!form) return;

  // Delegate ALL business logic to form module
  setupTriageRecordFormSubmission({
    form,
    token,
    sharedState,
    resetForm,
  });

  /* ---------------- Cancel ---------------- */
  cancelBtn?.addEventListener("click", () => {
    sessionStorage.removeItem("triageRecordEditId");
    sessionStorage.removeItem("triageRecordEditPayload");
    window.location.href = "/triage-records-list.html";
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
