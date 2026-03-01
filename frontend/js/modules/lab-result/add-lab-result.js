// 📦 labresult-main.js – Lab Result Form Controller (ENTERPRISE MASTER)
// ============================================================================
// 🧭 Mirrors add-patient.js & consultation-main.js EXACTLY
// 🔹 Auth guard + logout watcher
// 🔹 Edit session coordination
// 🔹 Reset orchestration
// 🔹 Delegates ALL business logic to lab-result-form.js
// 🔹 NO data loaders, NO business rules, NO RBAC branching here
// ============================================================================

import { setupLabResultFormSubmission } from "./lab-result-form.js";

import {
  initPageGuard,
  initLogoutWatcher,
  autoPagePermissionKey,
} from "../../utils/index.js";

/* ============================================================
   🔐 Auth Guard + Watchers
============================================================ */
initPageGuard(autoPagePermissionKey(["lab_results:create", "lab_results:edit"]));
initLogoutWatcher();

/* ============================================================
   🌐 Shared State (Enterprise Reference Holder)
============================================================ */
const sharedState = {
  currentEditIdRef: { value: null },
};

/* ============================================================
   📎 DOM Refs
============================================================ */
const form = document.getElementById("labResultForm");
const cancelBtn = document.getElementById("cancelBtn");
const clearBtn = document.getElementById("clearBtn");

/* ============================================================
   🧹 Reset Helper (Add Mode)
============================================================ */
function resetForm() {
  if (!form) return;

  form.reset();
  sharedState.currentEditIdRef.value = null;

  // Clear edit cache
  sessionStorage.removeItem("labResultEditId");
  sessionStorage.removeItem("labResultEditPayload");

  // Clear dropdowns
  [
    "organizationSelect",
    "facilitySelect",
    "labRequestSelect",
    "labRequestItemSelect",
  ].forEach((id) => {
    const el = document.getElementById(id);
    if (el) {
      el.value = "";
      el.disabled = false;
      delete el.dataset.currentId;
      delete el.dataset.currentLabel;
    }
  });

  // Clear read-only department
  const deptField = document.getElementById("departmentField");
  const deptHidden = document.getElementById("departmentIdHidden");
  if (deptField) deptField.value = "";
  if (deptHidden) deptHidden.value = "";

  // Clear pills
  const pills = document.getElementById("resultPillsContainer");
  if (pills)
    pills.innerHTML = `<p class="text-muted">No lab results added yet.</p>`;

  // Clear file preview
  const preview = document.getElementById("attachmentPreview");
  const removeBtn = document.getElementById("removeAttachmentBtn");
  const input = document.getElementById("attachmentInput");
  const flag = document.getElementById("remove_attachment");

  if (preview) preview.innerHTML = "";
  if (removeBtn) removeBtn.classList.add("hidden");
  if (input) input.value = "";
  if (flag) flag.value = "false";

  // Reset UI
  const titleEl = document.querySelector(".card-title");
  if (titleEl) titleEl.textContent = "Add Lab Result";

  const submitBtn = form.querySelector("button[type=submit]");
  if (submitBtn)
    submitBtn.innerHTML = `<i class="ri-save-3-line me-1"></i> Submit All`;

  document.getElementById("addResultBtn")?.classList.remove("hidden");
  document.getElementById("resultPillsContainer")?.classList.remove("hidden");
}

/* ============================================================
   🚀 Init (Page Entry – MASTER SAFE BOOT)
============================================================ */
document.addEventListener("DOMContentLoaded", () => {
  if (!form) return;

  const editId =
    sessionStorage.getItem("labResultEditId") ||
    new URLSearchParams(window.location.search).get("id");

  if (editId) {
    sharedState.currentEditIdRef.value = editId;
  }

  // Delegate ALL business logic to form module
  setupLabResultFormSubmission({
    form,
    sharedState,
    resetForm,
  });

  /* ---------------- Cancel ---------------- */
  cancelBtn?.addEventListener("click", () => {
    sessionStorage.removeItem("labResultEditId");
    sessionStorage.removeItem("labResultEditPayload");
    window.location.href = "/lab-results-list.html";
  });

  /* ---------------- Clear ---------------- */
  clearBtn?.addEventListener("click", () => {
    resetForm();
  });
});

/* ============================================================
   🔁 Reserved Sync Hook (Enterprise Future Use)
============================================================ */
export function syncRefsToState() {
  // Reserved for enterprise reactive syncing
}