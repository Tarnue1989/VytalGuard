// 📦 consultation-main.js – Form-only loader for Consultation (Master Pattern)

import {
  initPageGuard,
  autoPagePermissionKey,
  initLogoutWatcher,
} from "../../utils/index.js";
import { setupConsultationFormSubmission } from "./consultation-form.js";
import {
  FIELD_LABELS_CONSULTATION,
  FIELD_ORDER_CONSULTATION,
  FIELD_DEFAULTS_CONSULTATION,
} from "./consultation-constants.js";
import { setupFieldSelector } from "../../utils/ui-utils.js";

/* ============================================================
   🔐 Auth + Global Guards
============================================================ */

// Automatically resolves correct permission ("consultations:create" / "consultations:edit")
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
const form = document.getElementById("consultationForm");
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

  // Clear cached edit session
  sessionStorage.removeItem("consultationEditId");
  sessionStorage.removeItem("consultationEditPayload");

  // Clear text fields
  [
    "patientInput",
    "doctorInput",
    "diagnosis",
    "consultationNotes",
    "prescribedMedications",
  ].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });

  // Clear dropdowns
  [
    "organizationSelect",
    "facilitySelect",
    "departmentSelect",
    "consultationTypeSelect",
  ].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });

  // Clear appointment dropdown
  const apptSelect = document.getElementById("appointmentSelect");
  if (apptSelect)
    apptSelect.innerHTML = `<option value="">— Select Appointment —</option>`;

  // Reset hidden IDs
  ["patientId", "doctorId"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });

  // Reset date
  const dateInput = document.getElementById("consultationDate");
  if (dateInput) dateInput.value = "";
}

/* ============================================================
   🧭 Form Visibility
============================================================ */
function showForm() {
  formContainer?.classList.remove("hidden");
  desktopAddBtn?.classList.add("hidden");
  localStorage.setItem("consultationFormVisible", "true");
}

function hideForm() {
  resetForm();
  formContainer?.classList.add("hidden");
  desktopAddBtn?.classList.remove("hidden");
  localStorage.setItem("consultationFormVisible", "false");
}

// Expose globally for reuse by other handlers (view/edit actions)
window.showForm = showForm;
window.resetForm = resetForm;

/* ============================================================
   🔘 Button Wiring
============================================================ */
if (cancelBtn) {
  cancelBtn.onclick = () => {
    resetForm();
    window.location.href = "/consultations-list.html"; // ✅ plural redirect
  };
}

if (clearBtn) clearBtn.onclick = resetForm;

if (desktopAddBtn) {
  desktopAddBtn.onclick = () => {
    // Ensure stale edit state is purged
    sessionStorage.removeItem("consultationEditId");
    sessionStorage.removeItem("consultationEditPayload");

    // Reset & open clean form
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
export async function initConsultationModule() {
  showForm(); // auto-open form on standalone page

  setupConsultationFormSubmission({
    form,
    token,
    sharedState,
    resetForm,
    loadEntries,
  });

  localStorage.setItem("consultationPanelVisible", "false");

  // Normalize role for field defaults
  let roleRaw = localStorage.getItem("userRole") || "staff";
  let role = roleRaw.trim().toLowerCase();

  if (role.includes("super") && role.includes("admin")) role = "superadmin";
  else if (role.includes("admin")) role = "admin";
  else role = "staff";

  // 🧩 Initialize Field Selector (role-based)
  setupFieldSelector({
    module: "consultation",
    fieldLabels: FIELD_LABELS_CONSULTATION,
    fieldOrder: FIELD_ORDER_CONSULTATION,
    defaultFields: FIELD_DEFAULTS_CONSULTATION[role],
  });
}

/* ============================================================
   🔁 Sync Helper
============================================================ */
export function syncRefsToState() {
  // reserved for advanced reactive integration
}
