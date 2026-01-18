// 📦 department-main.js – Department Form Page Controller (Enterprise Master Pattern)
// ============================================================================
// 🧭 Mirrors patient-main.js responsibilities exactly
// 🔹 Auth guard + logout watcher
// 🔹 Form visibility & reset orchestration
// 🔹 Edit session coordination
// 🔹 Delegates ALL business logic to department-form.js
// ============================================================================

import { setupDepartmentFormSubmission } from "./department-form.js";

import {
  initPageGuard,
  initLogoutWatcher,
  autoPagePermissionKey
} from "../../utils/index.js";

/* ============================================================
   🔐 Auth Guard + Global Watchers
============================================================ */
const token = initPageGuard(autoPagePermissionKey());
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
const form = document.getElementById("departmentForm");
const formContainer = document.getElementById("formContainer");
const cancelBtn = document.getElementById("cancelBtn");
const clearBtn = document.getElementById("clearBtn");

/* ============================================================
   🧹 Reset Helper (Add Mode)
============================================================ */
function resetForm() {
  if (!form) return;

  form.reset();
  sharedState.currentEditIdRef.value = null;

  sessionStorage.removeItem("departmentEditId");
  sessionStorage.removeItem("departmentEditPayload");

  // Clear hidden + select fields
  ["headId", "organizationSelect", "facilitySelect"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });

  // Default status → active
  document.getElementById("status_active")?.setAttribute("checked", true);

  // Reset UI labels
  const titleEl = document.querySelector(".card-title");
  if (titleEl) titleEl.textContent = "Add Department";

  const submitBtn = form.querySelector("button[type=submit]");
  if (submitBtn)
    submitBtn.innerHTML =
      `<i class="ri-add-line me-1"></i> Add Department`;
}

/* ============================================================
   🚀 Init (Page Entry)
============================================================ */
document.addEventListener("DOMContentLoaded", () => {
  if (!form) return;

  // Wire form logic (ALL business logic lives there)
  setupDepartmentFormSubmission({
    form,
    token,
    sharedState,
    resetForm,
  });

  /* ---------------- Cancel ---------------- */
  cancelBtn?.addEventListener("click", () => {
    sessionStorage.removeItem("departmentEditId");
    sessionStorage.removeItem("departmentEditPayload");
    window.location.href = "/departments-list.html";
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
