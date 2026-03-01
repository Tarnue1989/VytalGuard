// 📦 lab-result-main.js – Form-only Loader for Lab Results (ENTERPRISE MASTER)
// ============================================================================
// 🧭 FULL MASTER PARITY WITH patient-main.js & consultation-main.js
// 🔹 Auth guard + logout watcher
// 🔹 Unified form visibility and reset logic
// 🔹 Session-safe edit coordination
// 🔹 Field selector integration (role-aware)
// 🔹 NO data loaders, NO API calls, NO RBAC branching
// ============================================================================

import {
  initPageGuard,
  autoPagePermissionKey,
  initLogoutWatcher,
} from "../../utils/index.js";

import { setupLabResultFormSubmission } from "./lab-result-form.js";

import {
  FIELD_LABELS_LAB_RESULT,
  FIELD_ORDER_LAB_RESULT,
  FIELD_DEFAULTS_LAB_RESULT,
} from "./lab-result-constants.js";

import { setupFieldSelector } from "../../utils/ui-utils.js";

/* ============================================================
   🔐 Auth Guard + Shared State (MASTER)
============================================================ */
const token = initPageGuard(autoPagePermissionKey());
initLogoutWatcher();

const sharedState = {
  currentEditIdRef: { value: null },
};

/* ============================================================
   📎 DOM Refs (ID-SAFE)
============================================================ */
const form = document.getElementById("labResultForm");
const formContainer = document.getElementById("formContainer");
const desktopAddBtn = document.getElementById("desktopAddBtn");
const cancelBtn = document.getElementById("cancelBtn");
const clearBtn = document.getElementById("clearBtn");

/* ============================================================
   🧹 Reset Form Helper (ENTERPRISE MASTER)
============================================================ */
function resetForm() {
  sharedState.currentEditIdRef.value = null;

  if (form) form.reset();

  // 🧹 Clear cached edit state
  sessionStorage.removeItem("labResultEditId");
  sessionStorage.removeItem("labResultEditPayload");

  // Clear core fields
  [
    "result",
    "notes",
    "doctor_notes",
    "result_date",
    "patientSearch",
    "patientId",
    "doctorSearch",
    "doctorId",
    "consultationField",
    "consultationId",
    "registrationLogField",
    "registrationLogId",
  ].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });

  // Clear selects
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

  // Department
  const deptField = document.getElementById("departmentField");
  const deptHidden = document.getElementById("departmentIdHidden");
  if (deptField) deptField.value = "";
  if (deptHidden) deptHidden.value = "";

  // File preview reset
  const preview = document.getElementById("attachmentPreview");
  const removeBtn = document.getElementById("removeAttachmentBtn");
  const input = document.getElementById("attachmentInput");
  const flag = document.getElementById("remove_attachment");

  if (preview) preview.innerHTML = "";
  if (removeBtn) removeBtn.classList.add("hidden");
  if (input) input.value = "";
  if (flag) flag.value = "false";

  // Pills reset
  const pills = document.getElementById("resultPillsContainer");
  if (pills)
    pills.innerHTML = `<p class="text-muted">No lab results added yet.</p>`;

  // UI reset
  const titleEl = document.querySelector(".card-title");
  if (titleEl) titleEl.textContent = "Add Lab Result";

  const submitBtn = form?.querySelector("button[type=submit]");
  if (submitBtn)
    submitBtn.innerHTML = `<i class="ri-save-3-line me-1"></i> Submit All`;

  document.getElementById("addResultBtn")?.classList.remove("hidden");
  document.getElementById("resultPillsContainer")?.classList.remove("hidden");
}

/* ============================================================
   🧭 Form Visibility (MASTER)
============================================================ */
function showForm() {
  formContainer?.classList.remove("hidden");
  desktopAddBtn?.classList.add("hidden");
  localStorage.setItem("labResultFormVisible", "true");
}

function hideForm() {
  resetForm();
  formContainer?.classList.add("hidden");
  desktopAddBtn?.classList.remove("hidden");
  localStorage.setItem("labResultFormVisible", "false");
}

window.showForm = showForm;
window.resetForm = resetForm;

/* ============================================================
   🔘 Button Wiring (Controller-Only)
============================================================ */
if (cancelBtn) {
  cancelBtn.onclick = () => {
    resetForm();
    window.location.href = "/lab-results-list.html";
  };
}

if (clearBtn) clearBtn.onclick = resetForm;

if (desktopAddBtn) {
  desktopAddBtn.onclick = () => {
    sessionStorage.removeItem("labResultEditId");
    sessionStorage.removeItem("labResultEditPayload");
    resetForm();
    showForm();
  };
}

/* ============================================================
   🚀 Init Entrypoint (MASTER SEQUENCE)
============================================================ */
export async function initLabResultModule() {
  showForm(); // form-only mode

  if (form) {
    setupLabResultFormSubmission({
      form,
      token,
      sharedState,
      resetForm,
      loadEntries: null,
    });
  }

  localStorage.setItem("labResultPanelVisible", "false");

  // Role normalization (MASTER)
  let roleRaw = localStorage.getItem("userRole") || "staff";
  let role = roleRaw.trim().toLowerCase();

  if (role.includes("super") && role.includes("admin")) role = "superadmin";
  else if (role.includes("admin")) role = "admin";
  else role = "staff";

  setupFieldSelector({
    module: "lab_result",
    fieldLabels: FIELD_LABELS_LAB_RESULT,
    fieldOrder: FIELD_ORDER_LAB_RESULT,
    defaultFields: FIELD_DEFAULTS_LAB_RESULT[role],
  });
}

/* ============================================================
   🔁 Sync Stub (MASTER)
============================================================ */
export function syncRefsToState() {
  // reserved for enterprise reactive syncing
}