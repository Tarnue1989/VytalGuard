// 📦 add-patient.js – Patient Form Page Controller (Enterprise Master Pattern)
// ============================================================================
// 🧭 Mirrors consultation-main.js EXACTLY
// 🔹 Auth guard + logout watcher
// 🔹 Form reset orchestration
// 🔹 Edit session coordination
// 🔹 Delegates ALL business logic to patient-form.js
// 🔹 NO data loaders, NO API calls, NO RBAC branching here
// ============================================================================

import { setupPatientFormSubmission } from "./patient-form.js";

import {
  initPageGuard,
  initLogoutWatcher,
  autoPagePermissionKey,
} from "../../utils/index.js";

/* ============================================================
   🔐 Auth Guard + Global Watchers
============================================================ */
const token = initPageGuard(
  autoPagePermissionKey(["patients:create", "patients:edit"])
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
const form = document.getElementById("patientForm");
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
  sessionStorage.removeItem("patientEditId");
  sessionStorage.removeItem("patientEditPayload");

  // Explicit text inputs (ID-safe)
  [
    "first_name",
    "middle_name",
    "last_name",
    "gender",
    "date_of_birth",
    "phone_number",
    "email_address",
    "home_address",
    "pat_no",
    "marital_status",
    "religion",
    "profession",
    "national_id",
    "insurance_number",
    "passport_number",
    "emergency_contact_name",
    "emergency_contact_phone",
    "notes",
  ].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });

  // Clear org / facility selects
  ["organizationSelect", "facilitySelect"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });

  // Reset registration status (default = active)
  document
    .getElementById("registration_status_active")
    ?.setAttribute("checked", true);

  // Reset file previews + flags
  ["photo", "qr"].forEach((type) => {
    const preview = document.getElementById(`${type}Preview`);
    const removeBtn = document.getElementById(
      `remove${type.charAt(0).toUpperCase() + type.slice(1)}Btn`
    );
    const input = document.getElementById(`${type}Input`);
    const flag = document.getElementById(`remove_${type}`);

    if (preview) preview.innerHTML = "";
    if (removeBtn) removeBtn.classList.add("hidden");
    if (input) input.value = "";
    if (flag) flag.value = "false";
  });

  // Reset UI labels
  const titleEl = document.querySelector(".card-title");
  if (titleEl) titleEl.textContent = "Add Patient";

  const submitBtn = form.querySelector("button[type=submit]");
  if (submitBtn)
    submitBtn.innerHTML = `<i class="ri-add-line me-1"></i> Add Patient`;
}

/* ============================================================
   🚀 Init (Page Entry)
============================================================ */
document.addEventListener("DOMContentLoaded", () => {
  if (!form) return;

  // Wire form logic (ALL business logic lives in patient-form.js)
  setupPatientFormSubmission({
    form,
    token,
    sharedState,
    resetForm,
  });

  /* ---------------- Cancel ---------------- */
  cancelBtn?.addEventListener("click", () => {
    sessionStorage.removeItem("patientEditId");
    sessionStorage.removeItem("patientEditPayload");
    window.location.href = "/patients-list.html";
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
