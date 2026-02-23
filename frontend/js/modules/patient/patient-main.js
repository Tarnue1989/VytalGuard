// 📦 patient-main.js – Form-only loader for Patient (ENTERPRISE MASTER PARITY)
// ============================================================================
// 🧭 FULL MASTER PARITY WITH consultation-main.js
// 🔹 Auth guard + logout watcher
// 🔹 Unified form visibility and reset logic
// 🔹 Session-safe edit caching
// 🔹 Field selector integration (role-aware)
// 🔹 100% ID-safe and controller-aligned
// ============================================================================

import {
  initPageGuard,
  autoPagePermissionKey,
  initLogoutWatcher,
} from "../../utils/index.js";

import { setupPatientFormSubmission } from "./patient-form.js";

import {
  FIELD_LABELS_PATIENT,
  FIELD_ORDER_PATIENT,
  FIELD_DEFAULTS_PATIENT,
} from "./patient-constants.js";

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
const form = document.getElementById("patientForm");
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
  sessionStorage.removeItem("patientEditId");
  sessionStorage.removeItem("patientEditPayload");

  // 🧾 Explicit text inputs
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

  // 🏢 Org / Facility
  ["organizationSelect", "facilitySelect"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });

  // 🔘 Registration status (default Active)
  document
    .getElementById("registration_status_active")
    ?.setAttribute("checked", true);

  // 🖼️ File previews + flags
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
   🧭 Form Show / Hide (MASTER)
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

// 🌍 Global exposure (MASTER)
window.showForm = showForm;
window.resetForm = resetForm;

/* ============================================================
   🔘 Button Wiring (MASTER)
============================================================ */
if (cancelBtn) {
  cancelBtn.onclick = () => {
    resetForm();
    window.location.href = "/patients-list.html";
  };
}

if (clearBtn) clearBtn.onclick = resetForm;

if (desktopAddBtn) {
  desktopAddBtn.onclick = () => {
    sessionStorage.removeItem("patientEditId");
    sessionStorage.removeItem("patientEditPayload");
    resetForm();
    showForm();
  };
}

/* ============================================================
   📦 Loader Placeholder (FORM-ONLY MODE)
============================================================ */
async function loadEntries() {
  return; // handled by list page
}

/* ============================================================
   🚀 Init Entrypoint (MASTER SEQUENCE)
============================================================ */
export async function initPatientModule() {
  showForm(); // form-only mode (MASTER parity)

  if (form) {
    setupPatientFormSubmission({
      form,
      token,
      sharedState,
      resetForm,
      loadEntries,
    });
  }

  localStorage.setItem("patientPanelVisible", "false");

  // 🧩 Normalize role for field defaults (MASTER)
  let roleRaw = localStorage.getItem("userRole") || "staff";
  let role = roleRaw.trim().toLowerCase();

  if (role.includes("super") && role.includes("admin")) role = "superadmin";
  else if (role.includes("admin")) role = "admin";
  else role = "staff";

  setupFieldSelector({
    module: "patient",
    fieldLabels: FIELD_LABELS_PATIENT,
    fieldOrder: FIELD_ORDER_PATIENT,
    defaultFields: FIELD_DEFAULTS_PATIENT[role],
  });
}

/* ============================================================
   🔁 Sync Stub (MASTER)
============================================================ */
export function syncRefsToState() {
  // reserved for future reactive syncing
}
