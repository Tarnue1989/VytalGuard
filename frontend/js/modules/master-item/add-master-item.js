// 📦 add-master-item.js – Master Item Form Page Controller (Enterprise Master Pattern)
// ============================================================================
// 🧭 Mirrors department-main.js / patient-main.js responsibilities EXACTLY
// 🔹 Auth guard + logout watcher
// 🔹 Form reset orchestration
// 🔹 Edit session coordination
// 🔹 Delegates ALL business logic to master-item-form.js
// ============================================================================

import { setupMasterItemFormSubmission } from "./master-item-form.js";

import {
  initPageGuard,
  initLogoutWatcher,
  autoPagePermissionKey,
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
const form = document.getElementById("masterItemForm");
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

  sessionStorage.removeItem("masterItemEditId");
  sessionStorage.removeItem("masterItemEditPayload");

  // Clear hidden + select fields (ID-safe)
  [
    "organizationSelect",
    "facilitySelect",
    "departmentSelect",
    "categorySelect",
    "featureModuleId",
  ].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });

  const featureModuleInput = document.getElementById("featureModuleInput");
  if (featureModuleInput) featureModuleInput.value = "";

  // Default status → active
  document.getElementById("status_active")?.setAttribute("checked", true);

  // Reset UI labels
  const titleEl = document.querySelector(".card-title");
  if (titleEl) titleEl.textContent = "Add Master Item";

  const submitBtn = form.querySelector("button[type=submit]");
  if (submitBtn)
    submitBtn.innerHTML = `<i class="ri-add-line me-1"></i> Add Item`;
}

/* ============================================================
   🚀 Init (Page Entry)
============================================================ */
document.addEventListener("DOMContentLoaded", () => {
  if (!form) return;

  // Wire form logic (ALL business logic lives in master-item-form.js)
  setupMasterItemFormSubmission({
    form,
    token,
    sharedState,
    resetForm,
  });

  /* ---------------- Cancel ---------------- */
  cancelBtn?.addEventListener("click", () => {
    sessionStorage.removeItem("masterItemEditId");
    sessionStorage.removeItem("masterItemEditPayload");
    window.location.href = "/master-items-list.html";
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
