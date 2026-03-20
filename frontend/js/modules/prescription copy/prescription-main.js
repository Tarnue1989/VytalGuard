// 📦 prescription-main.js – Form-only Loader for Prescriptions (Enterprise-Aligned)
// ============================================================
// 🧭 Fully aligned with Lab Request Master Pattern (Central Stock Style)
// ============================================================

import {
  initPageGuard,
  autoPagePermissionKey,
  initLogoutWatcher,
} from "../../utils/index.js";
import { setupPrescriptionFormSubmission } from "./prescription-form.js";
import {
  FIELD_LABELS_PRESCRIPTION,
  FIELD_ORDER_PRESCRIPTION,
  FIELD_DEFAULTS_PRESCRIPTION,
} from "./prescription-constants.js";
import { setupFieldSelector } from "../../utils/ui-utils.js";

/* ============================================================
   🔐 Auth + Global Guards
============================================================ */

// Automatically resolves correct permission ("prescriptions:create" / "prescriptions:edit")
const token = initPageGuard(autoPagePermissionKey());
initLogoutWatcher();

/* ============================================================
   🌐 Shared State
============================================================ */
const sharedState = {
  currentEditIdRef: { value: null },
};

/* ============================================================
   📎 DOM References
============================================================ */
const form = document.getElementById("prescriptionForm");
const formContainer = document.getElementById("formContainer");
const desktopAddBtn = document.getElementById("desktopAddBtn");
const cancelBtn = document.getElementById("cancelBtn");
const clearBtn = document.getElementById("clearBtn");

/* ============================================================
   🧹 Reset Form Helper (Enterprise-Aligned)
============================================================ */
function resetForm() {
  sharedState.currentEditIdRef.value = null;
  if (form) form.reset();

  // Clear cached edit state
  sessionStorage.removeItem("prescriptionEditId");
  sessionStorage.removeItem("prescriptionEditPayload");

  // Explicitly clear text fields
  ["notes"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });

  // ✅ Always reset prescription_date to today’s date
  const dateInput = document.getElementById("prescription_date");
  if (dateInput) {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, "0");
    const dd = String(today.getDate()).padStart(2, "0");
    dateInput.value = `${yyyy}-${mm}-${dd}`;
  }

  // Clear dropdowns
  ["organizationSelect", "facilitySelect", "departmentSelect"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });

  // Clear suggestion-based inputs
  [
    "patientSearch",
    "doctorSearch",
    "consultationSearch",
    "registrationLogSearch",
    "medicationSearch",
  ].forEach((id) => {
    const el = document.getElementById(id);
    if (el) {
      el.value = "";
      el.dataset.value = "";
    }
  });

  // Reset checkbox
  const emergencyCheck = document.getElementById("is_emergency");
  if (emergencyCheck) emergencyCheck.checked = false;

  // Reset pills
  const pillsContainer = document.getElementById("prescriptionPillsContainer");
  if (pillsContainer)
    pillsContainer.innerHTML = `<p class="text-muted">No prescription items added yet.</p>`;

  // Reset UI state
  const titleEl = document.querySelector(".card-title");
  if (titleEl) titleEl.textContent = "Add Prescription";

  const submitBtn = form?.querySelector("button[type=submit]");
  if (submitBtn)
    submitBtn.innerHTML = `<i class="ri-add-line me-1"></i> Submit Prescription`;
}

/* ============================================================
   🧭 Form Visibility
============================================================ */
function showForm() {
  formContainer?.classList.remove("hidden");
  desktopAddBtn?.classList.add("hidden");
  localStorage.setItem("prescriptionFormVisible", "true");
}

function hideForm() {
  resetForm();
  formContainer?.classList.add("hidden");
  desktopAddBtn?.classList.remove("hidden");
  localStorage.setItem("prescriptionFormVisible", "false");
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
    window.location.href = "/prescriptions-list.html";
  };
}

if (clearBtn) {
  clearBtn.onclick = () => {
    const isEdit = !!sharedState.currentEditIdRef.value;
    sessionStorage.removeItem("prescriptionEditId");
    sessionStorage.removeItem("prescriptionEditPayload");

    if (isEdit) {
      window.location.href = "/prescriptions-list.html";
    } else {
      resetForm();
    }
  };
}

if (desktopAddBtn) {
  desktopAddBtn.onclick = () => {
    sessionStorage.removeItem("prescriptionEditId");
    sessionStorage.removeItem("prescriptionEditPayload");
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
export async function initPrescriptionModule() {
  showForm(); // auto-open form on standalone page

  setupPrescriptionFormSubmission({
    form,
    token,
    sharedState,
    resetForm,
    loadEntries,
  });

  localStorage.setItem("prescriptionPanelVisible", "false");

  // Normalize role for default field visibility
  let roleRaw = localStorage.getItem("userRole") || "staff";
  let role = roleRaw.trim().toLowerCase();
  if (role.includes("super") && role.includes("admin")) role = "superadmin";
  else if (role.includes("admin")) role = "admin";
  else role = "staff";

  // 🧩 Initialize Field Selector (role-based)
  setupFieldSelector({
    module: "prescription",
    fieldLabels: FIELD_LABELS_PRESCRIPTION,
    fieldOrder: FIELD_ORDER_PRESCRIPTION,
    defaultFields: FIELD_DEFAULTS_PRESCRIPTION[role],
  });
}

/* ============================================================
   🔁 Sync Helper
============================================================ */
export function syncRefsToState() {
  // reserved for advanced reactive integration
}
