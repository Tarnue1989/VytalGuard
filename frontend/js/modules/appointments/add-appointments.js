// 📁 add-appointment.js – Appointment Form Page Controller (Enterprise MASTER Pattern)
// ============================================================================
// 🧭 Mirrors add-deposit.js / consultation-main.js EXACTLY
// 🔹 Auth guard + logout watcher
// 🔹 Form reset orchestration (ADD MODE ONLY)
// 🔹 Edit session coordination
// 🔹 Delegates ALL business logic to appointments-form.js
// 🔹 NO data loaders, NO API calls, NO RBAC branching here
// ============================================================================

import { setupAppointmentFormSubmission } from "./appointments-form.js";

import {
  initPageGuard,
  initLogoutWatcher,
  autoPagePermissionKey,
} from "../../utils/index.js";

/* ============================================================
   🔐 Auth Guard + Global Watchers
============================================================ */
const token = initPageGuard(
  autoPagePermissionKey(["appointments:create", "appointments:edit"])
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
const form = document.getElementById("appointmentForm");
const cancelBtn = document.getElementById("cancelBtn");
const clearBtn = document.getElementById("clearBtn");

/* ============================================================
   🧹 Reset Helper (ADD MODE ONLY)
============================================================ */
function resetForm() {
  if (!form) return;

  form.reset();
  sharedState.currentEditIdRef.value = null;

  // Clear cached edit state
  sessionStorage.removeItem("appointmentEditId");
  sessionStorage.removeItem("appointmentEditPayload");

  // Clear hidden + text fields
  [
    "patientInput",
    "patientId",
    "doctorInput",
    "doctorId",
    "notes",
  ].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });

  // Clear selects
  [
    "organizationSelect",
    "facilitySelect",
    "departmentSelect",
  ].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });

  // Reset date
  const dateEl = document.getElementById("dateTime");
  if (dateEl) dateEl.value = "";

  // Reset UI labels
  const titleEl = document.querySelector(".card-title");
  if (titleEl) titleEl.textContent = "Add Appointment";

  const submitBtn = form.querySelector("button[type=submit]");
  if (submitBtn) {
    submitBtn.innerHTML =
      `<i class="ri-add-line me-1"></i> Add Appointment`;
  }
}

/* ============================================================
   🚀 Init (Page Entry)
============================================================ */
document.addEventListener("DOMContentLoaded", () => {
  if (!form) return;

  // Wire form logic (ALL business logic lives there)
  setupAppointmentFormSubmission({
    form,
    token,
    sharedState,
    resetForm,
  });

  /* ---------------- Cancel ---------------- */
  cancelBtn?.addEventListener("click", () => {
    sessionStorage.removeItem("appointmentEditId");
    sessionStorage.removeItem("appointmentEditPayload");
    window.location.href = "/appointments-list.html";
  });

  /* ---------------- Clear (ADD MODE ONLY) ---------------- */
  clearBtn?.addEventListener("click", () => {
    if (sharedState.currentEditIdRef.value) return;
    resetForm();
  });
});

/* ============================================================
   🔁 Reserved Sync Hook (Future)
============================================================ */
export function syncRefsToState() {
  // Reserved for enterprise reactive form syncing
}
