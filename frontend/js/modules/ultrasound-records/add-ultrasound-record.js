// 📦 ultrasound-main.js – Ultrasound Record Form Page Controller (ENTERPRISE MASTER PARITY)
// ============================================================================
// 🧭 Mirrors delivery-record-main.js / ekg-record-main.js / add-registration-log.js
// 🔹 Auth guard + logout watcher
// 🔹 Form visibility & reset orchestration
// 🔹 Edit session coordination
// 🔹 Delegates ALL business logic to ultrasound-record-form.js
// ❌ NO API calls
// ❌ NO dropdown loading
// ❌ NO suggestion logic
// ============================================================================

import { setupUltrasoundFormSubmission } from "./ultrasound-record-form.js";

import {
  initPageGuard,
  initLogoutWatcher,
  autoPagePermissionKey,
} from "../../utils/index.js";

/* ============================================================
   🔐 Auth Guard + Global Watchers
============================================================ */
const token = initPageGuard(
  autoPagePermissionKey(["ultrasound_records:create", "ultrasound_records:edit"])
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
const form = document.getElementById("ultrasoundRecordForm");
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
  sessionStorage.removeItem("ultrasoundEditId");
  sessionStorage.removeItem("ultrasoundEditPayload");

  // Clear hidden + select fields
  [
    "patientId",
    "consultationId",
    "maternityVisitId",
    "technicianId",
    "organizationSelect",
    "facilitySelect",
    "departmentSelect",
    "billableItemSelect",
    "registrationLogSelect",
  ].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });

  // Reset flags
  ["isEmergency", "previousCesarean", "ultrasoundDone"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.checked = false;
  });

  // Reset UI labels
  const titleEl = document.querySelector(".card-title");
  if (titleEl) titleEl.textContent = "Add Ultrasound Record";

  const submitBtn = form.querySelector("button[type=submit]");
  if (submitBtn)
    submitBtn.innerHTML =
      `<i class="ri-add-line me-1"></i> Create Ultrasound Record`;
}

/* ============================================================
   🚀 Init (Page Entry)
============================================================ */
document.addEventListener("DOMContentLoaded", () => {
  if (!form) return;

  // Delegate ALL business logic to form module
  setupUltrasoundFormSubmission({
    form,
    token,
    sharedState,
    resetForm,
  });

  /* ---------------- Cancel ---------------- */
  cancelBtn?.addEventListener("click", () => {
    sessionStorage.removeItem("ultrasoundEditId");
    sessionStorage.removeItem("ultrasoundEditPayload");
    window.location.href = "/ultrasound-records-list.html";
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
