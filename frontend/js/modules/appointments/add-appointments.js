// 📁 add-appointment.js – Init Add/Edit Appointment (MASTER-ALIGNED)
// ============================================================================
// 🧭 Mirrors add-feature-access.js architecture EXACTLY (appointment variant)
// 🔹 Unified guard, edit-prefill handled in form module
// 🔹 Shared state passed through
// 🔹 Reset logic ADD-mode safe
// 🔹 100% DOM ID retention
// ============================================================================

import {
  initPageGuard,
  initLogoutWatcher,
  autoPagePermissionKey,
} from "../../utils/index.js";

import { setupAppointmentFormSubmission } from "./appointments-form.js";

/* ============================================================
   🔐 Auth Guard
============================================================ */
const token = initPageGuard(autoPagePermissionKey());

initLogoutWatcher();

/* ============================================================
   🧠 Shared State
============================================================ */
const sharedState = {
  currentEditIdRef: { value: null },
};

/* ============================================================
   🧹 Reset Form Helper (ADD MODE ONLY)
============================================================ */
function resetForm() {
  const form = document.getElementById("appointmentForm");
  if (!form) return;

  form.reset();
  sharedState.currentEditIdRef.value = null;

  // Explicit clears (IDs preserved)
  [
    "patientInput",
    "patientId",
    "doctorInput",
    "doctorId",
    "organizationSelect",
    "facilitySelect",
    "departmentSelect",
    "notes",
  ].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });

  const dateEl = document.getElementById("dateTime");
  if (dateEl) dateEl.value = "";

  // Reset title + submit button
  const titleEl = document.querySelector(".card-title");
  if (titleEl) titleEl.textContent = "Add Appointment";

  const submitBtn = form.querySelector("button[type=submit]");
  if (submitBtn) {
    submitBtn.innerHTML =
      `<i class="ri-save-3-line me-1"></i> Save Appointment`;
  }
}

/* ============================================================
   🚀 Init (ADD / EDIT handled in form module)
============================================================ */
document.addEventListener("DOMContentLoaded", async () => {
  const form = document.getElementById("appointmentForm");
  if (!form) return;

  await setupAppointmentFormSubmission({
    form,
    token,
    sharedState,
    resetForm,
    loadEntries: null,
  });

  /* ----------------------------------------------------------
     🚪 Cancel
  ----------------------------------------------------------- */
  document.getElementById("cancelBtn")?.addEventListener("click", () => {
    sessionStorage.removeItem("appointmentEditId");
    sessionStorage.removeItem("appointmentEditPayload");
    window.location.href = "/appointments-list.html";
  });

  /* ----------------------------------------------------------
     🧹 Clear (ADD MODE ONLY)
  ----------------------------------------------------------- */
  document.getElementById("clearBtn")?.addEventListener("click", () => {
    if (sharedState.currentEditIdRef.value) return;
    resetForm();
  });
});
