// 📦 labrequest-main.js – Form-only loader for Lab Requests (Master Pattern Aligned)

import {
  initPageGuard,
  autoPagePermissionKey,
  initLogoutWatcher,
} from "../../utils/index.js";
import { setupLabRequestFormSubmission } from "./lab-request-form.js";
import {
  FIELD_LABELS_LAB_REQUEST,
  FIELD_ORDER_LAB_REQUEST,
  FIELD_DEFAULTS_LAB_REQUEST,
} from "./lab-request-constants.js";
import { setupFieldSelector } from "../../utils/ui-utils.js";

/* ============================================================
   🔐 Auth + Global Guards
============================================================ */

// Automatically resolves correct permission ("lab_requests:create" / "lab_requests:edit")
const token = initPageGuard(autoPagePermissionKey());
initLogoutWatcher();

/* ============================================================
   🌐 Shared State
============================================================ */
const sharedState = {
  currentEditIdRef: { value: null },
};

/* ============================================================
   📎 DOM Refs
============================================================ */
const form = document.getElementById("labRequestForm");
const formContainer = document.getElementById("formContainer");
const desktopAddBtn = document.getElementById("desktopAddBtn");
const cancelBtn = document.getElementById("cancelBtn");
const clearBtn = document.getElementById("clearBtn");

/* ============================================================
   🧹 Reset Form Helper
============================================================ */
function resetForm() {
  sharedState.currentEditIdRef.value = null;
  if (form) form.reset();

  // Clear cached edit state
  sessionStorage.removeItem("labRequestEditId");
  sessionStorage.removeItem("labRequestEditPayload");

  // Explicitly clear text fields
  ["notes", "request_date"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });

  // Clear dropdowns
  ["organizationSelect", "facilitySelect", "departmentSelect"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });

  // Reset inputs with data attributes
  ["patientSearch", "doctorSearch", "consultationSearch", "registrationLogSearch"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) {
      el.value = "";
      el.dataset.value = "";
    }
  });

  // Reset checkbox
  const emergencyCheck = document.getElementById("is_emergency");
  if (emergencyCheck) emergencyCheck.checked = false;

  // Clear lab test pills
  const pillsContainer = document.getElementById("requestPillsContainer");
  if (pillsContainer)
    pillsContainer.innerHTML = `<p class="text-muted">No lab tests added yet.</p>`;
}

/* ============================================================
   🧭 Form Visibility
============================================================ */
function showForm() {
  formContainer?.classList.remove("hidden");
  desktopAddBtn?.classList.add("hidden");
  localStorage.setItem("labRequestFormVisible", "true");
}

function hideForm() {
  resetForm();
  formContainer?.classList.add("hidden");
  desktopAddBtn?.classList.remove("hidden");
  localStorage.setItem("labRequestFormVisible", "false");
}

// Expose globally
window.showForm = showForm;
window.resetForm = resetForm;

/* ============================================================
   🔘 Button Wiring
============================================================ */
if (cancelBtn) {
  cancelBtn.onclick = () => {
    resetForm();
    window.location.href = "/lab-requests-list.html";
  };
}

if (clearBtn) {
  clearBtn.onclick = () => {
    const isEdit = !!sharedState.currentEditIdRef.value;
    sessionStorage.removeItem("labRequestEditId");
    sessionStorage.removeItem("labRequestEditPayload");

    if (isEdit) {
      window.location.href = "/lab-requests-list.html";
    } else {
      resetForm();
    }
  };
}

if (desktopAddBtn) {
  desktopAddBtn.onclick = () => {
    sessionStorage.removeItem("labRequestEditId");
    sessionStorage.removeItem("labRequestEditPayload");
    resetForm();
    showForm();
  };
}

/* ============================================================
   🧠 Loader (no-op)
============================================================ */
async function loadEntries() {
  return; // list page handles loading
}

/* ============================================================
   🚀 Module Initializer
============================================================ */
export async function initLabRequestModule() {
  showForm(); // auto-open form on standalone page

  setupLabRequestFormSubmission({
    form,
    token,
    sharedState,
    resetForm,
    loadEntries,
  });

  localStorage.setItem("labRequestPanelVisible", "false");

  // Normalize role for default field visibility
  let roleRaw = localStorage.getItem("userRole") || "staff";
  let role = roleRaw.trim().toLowerCase();
  if (role.includes("super") && role.includes("admin")) role = "superadmin";
  else if (role.includes("admin")) role = "admin";
  else role = "staff";

  // 🧩 Initialize Field Selector (role-based)
  setupFieldSelector({
    module: "lab_request",
    fieldLabels: FIELD_LABELS_LAB_REQUEST,
    fieldOrder: FIELD_ORDER_LAB_REQUEST,
    defaultFields: FIELD_DEFAULTS_LAB_REQUEST[role],
  });
}

/* ============================================================
   🔁 Sync Helper
============================================================ */
export function syncRefsToState() {
  // reserved for advanced reactive integration
}
