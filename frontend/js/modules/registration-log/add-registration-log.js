// 📦 add-registration-log.js – Registration Log Form Page Controller (Enterprise Master Pattern)
// ============================================================================
// 🧭 Mirrors consultation-main.js EXACTLY
// 🔹 Auth guard + logout watcher
// 🔹 Form reset orchestration
// 🔹 Edit session coordination
// 🔹 Delegates ALL business logic to registration-log-form.js
// 🔹 NO data loaders, NO API calls, NO RBAC branching here
// ============================================================================

import { setupRegistrationLogFormSubmission } from "./registration-log-form.js";

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
    "registration_logs:create",
    "registration_logs:edit",
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
const form = document.getElementById("registrationLogForm");
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
  sessionStorage.removeItem("registrationLogEditId");
  sessionStorage.removeItem("registrationLogEditPayload");

  // Clear hidden IDs
  ["patientId", "registrarId"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });

  // Clear selects
  [
    "organizationSelect",
    "facilitySelect",
    "registrationTypeSelect",
    "payerType",                 // ✅ ADDED
    "patientInsuranceSelect",    // ✅ ADDED
  ].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });

  // Reset emergency checkbox
  const emergencyEl = document.getElementById("isEmergency");
  if (emergencyEl) emergencyEl.checked = false;

  // ✅ ADDED
  const insuranceSelect = document.getElementById("patientInsuranceSelect");
  if (insuranceSelect) {
    insuranceSelect.value = "";
    insuranceSelect.disabled = true;
  }

  // Reset UI labels
  const titleEl = document.querySelector(".card-title");
  if (titleEl) titleEl.textContent = "Add Registration Log";

  const submitBtn = form.querySelector("button[type=submit]");
  if (submitBtn)
    submitBtn.innerHTML =
      `<i class="ri-add-line me-1"></i> Submit`;
}

/* ============================================================
   🚀 Init (Page Entry)
============================================================ */
document.addEventListener("DOMContentLoaded", () => {
  if (!form) return;

  // Wire form logic (ALL business logic lives in form file)
  setupRegistrationLogFormSubmission({
    form,
    token,
    sharedState,
    resetForm,
  });

  /* ---------------- Cancel ---------------- */
  cancelBtn?.addEventListener("click", () => {
    sessionStorage.removeItem("registrationLogEditId");
    sessionStorage.removeItem("registrationLogEditPayload");
    window.location.href = "/registration-logs-list.html";
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