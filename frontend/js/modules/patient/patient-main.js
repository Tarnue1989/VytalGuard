// 📦 patient-main.js – Form-only loader for Patient (Enterprise Master Pattern)
// ============================================================================
// 🧭 Mirrors employee-main.js structure
// 🔹 Auth guard + logout watcher
// 🔹 Unified form visibility and reset logic
// 🔹 Session-safe edit caching + field selector integration
// 🔹 Preserves all existing DOM IDs and form logic
// ============================================================================

import { initPageGuard, initLogoutWatcher } from "../../utils/index.js";
import { setupPatientFormSubmission } from "./patient-form.js";
import {
  FIELD_LABELS_PATIENT,
  FIELD_ORDER_PATIENT,
  FIELD_DEFAULTS_PATIENT,
} from "./patient-constants.js";
import { setupFieldSelector } from "../../utils/ui-utils.js";

/* ============================================================
   🔐 Auth Guard + Shared State
============================================================ */
const token = initPageGuard("patients");
initLogoutWatcher();

const sharedState = {
  currentEditIdRef: { value: null },
};

/* ============================================================
   📎 DOM Refs
============================================================ */
const form = document.getElementById("patientForm");
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
  sessionStorage.removeItem("patientEditId");
  sessionStorage.removeItem("patientEditPayload");

  // Explicitly clear text inputs
  [
    "first_name", "middle_name", "last_name", "gender", "date_of_birth",
    "phone_number", "email_address", "home_address", "pat_no",
    "marital_status", "religion", "profession", "national_id",
    "insurance_number", "passport_number", "emergency_contact_name",
    "emergency_contact_phone", "notes",
  ].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });

  // Clear organization/facility dropdowns
  const orgSelect = document.getElementById("organizationSelect");
  if (orgSelect) orgSelect.value = "";
  const facilitySelect = document.getElementById("facilitySelect");
  if (facilitySelect) facilitySelect.value = "";

  // Reset registration_status radio (default Active)
  document
    .getElementById("registration_status_active")
    ?.setAttribute("checked", true);

  // Clear file previews and hide remove buttons
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
}

/* ============================================================
   🧭 Form Show / Hide
============================================================ */
function showForm() {
  formContainer?.classList.remove("hidden");
  desktopAddBtn?.classList.add("hidden");
  localStorage.setItem("patientFormVisible", "true");
}

function hideForm() {
  resetForm();
  formContainer?.classList.add("hidden");
  desktopAddBtn?.classList.remove("hidden");
  localStorage.setItem("patientFormVisible", "false");
}

// 🔗 Expose globally (for actions or hot reload)
window.showForm = showForm;
window.resetForm = resetForm;

/* ============================================================
   ⚙️ Wire Button Actions
============================================================ */
if (cancelBtn) {
  cancelBtn.onclick = () => {
    resetForm();
    window.location.href = "/patients-list.html"; // ✅ redirect
  };
}

if (clearBtn) clearBtn.onclick = resetForm;

if (desktopAddBtn) {
  desktopAddBtn.onclick = () => {
    // 🧹 Clear any stale edit session data
    sessionStorage.removeItem("patientEditId");
    sessionStorage.removeItem("patientEditPayload");

    // Reset and open form in Add mode
    resetForm();
    showForm();
  };
}

/* ============================================================
   📦 Loader Placeholder
============================================================ */
async function loadEntries() {
  return; // placeholder (handled by list page)
}

/* ============================================================
   🚀 Init Entrypoint
============================================================ */
export async function initPatientModule() {
  showForm(); // open by default for form-only mode
  setupPatientFormSubmission({
    form,
    token,
    sharedState,
    resetForm,
    loadEntries,
  });

  localStorage.setItem("patientPanelVisible", "false");

  // 🧩 Normalize role for field defaults
  let roleRaw = localStorage.getItem("userRole") || "staff";
  let role = roleRaw.trim().toLowerCase();

  if (role.includes("super") && role.includes("admin")) {
    role = "superadmin";
  } else if (role.includes("admin")) {
    role = "admin";
  } else {
    role = "staff";
  }

  setupFieldSelector({
    module: "patient",
    fieldLabels: FIELD_LABELS_PATIENT,
    fieldOrder: FIELD_ORDER_PATIENT,
    defaultFields: FIELD_DEFAULTS_PATIENT[role],
  });
}

/* ============================================================
   (Optional) State Sync Stub
============================================================ */
export function syncRefsToState() {
  // no-op placeholder for consistency
}
