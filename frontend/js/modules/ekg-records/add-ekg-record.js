// 📦 ekg-record-main.js – EKG Record Form Page Controller (Enterprise Master Pattern)
// ============================================================================
// 🧭 Mirrors add-registration-log.js / department-main.js / patient-main.js exactly
// 🔹 Auth guard + logout watcher
// 🔹 Form visibility & reset orchestration
// 🔹 Edit session coordination
// 🔹 Delegates ALL business logic to ekg-record-form.js
// ❌ NO API calls
// ❌ NO dropdown loading
// ❌ NO suggestion logic
// ============================================================================

import { setupEKGRecordFormSubmission } from "./ekg-record-form.js";

import {
  initPageGuard,
  initLogoutWatcher,
  autoPagePermissionKey,
} from "../../utils/index.js";

/* ============================================================
   🔐 Auth Guard + Global Watchers
============================================================ */
const token = initPageGuard(
  autoPagePermissionKey(["ekg_records:create", "ekg_records:edit"])
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
const form = document.getElementById("ekgRecordForm");
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
  sessionStorage.removeItem("ekgRecordEditId");
  sessionStorage.removeItem("ekgRecordEditPayload");

  // Clear hidden + select fields
  [
    "patientId",
    "technicianId",
    "organizationSelect",
    "facilitySelect",
    "billableItemSelect",
    "registrationLogSelect",
    "consultationSelect",
  ].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });

  // Reset emergency flag if present
  const emergency = document.getElementById("isEmergency");
  if (emergency) emergency.checked = false;

  // Reset UI labels
  const titleEl = document.querySelector(".card-title");
  if (titleEl) titleEl.textContent = "Add EKG Record";

  const submitBtn = form.querySelector("button[type=submit]");
  if (submitBtn)
    submitBtn.innerHTML =
      `<i class="ri-add-line me-1"></i> Create EKG Record`;
}

/* ============================================================
   🚀 Init (Page Entry)
============================================================ */
document.addEventListener("DOMContentLoaded", () => {
  if (!form) return;

  // Delegate ALL business logic to form module
  setupEKGRecordFormSubmission({
    form,
    token,
    sharedState,
    resetForm,
  });

  /* ---------------- Cancel ---------------- */
  cancelBtn?.addEventListener("click", () => {
    sessionStorage.removeItem("ekgRecordEditId");
    sessionStorage.removeItem("ekgRecordEditPayload");
    window.location.href = "/ekg-records-list.html";
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
