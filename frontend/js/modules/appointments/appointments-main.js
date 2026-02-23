// 📦 appointment-main.js – Form-only loader for Appointment (ENTERPRISE MASTER PARITY)
// ============================================================================
// 🧭 FULL MASTER PARITY WITH consultation-main.js / deposit-main.js
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

import { setupAppointmentFormSubmission } from "./appointment-form.js";

import {
  FIELD_LABELS_APPOINTMENT,
  FIELD_ORDER_APPOINTMENT,
  FIELD_DEFAULTS_APPOINTMENT,
} from "./appointments-constants.js";

import { setupFieldSelector } from "../../utils/ui-utils.js";

/* ============================================================
   🔐 AUTH GUARD + SHARED STATE
============================================================ */
const token = initPageGuard(autoPagePermissionKey());
initLogoutWatcher();

const sharedState = {
  currentEditIdRef: { value: null },
};

/* ============================================================
   📎 DOM REFERENCES
============================================================ */
const form = document.getElementById("appointmentForm");
const formContainer = document.getElementById("formContainer");
const desktopAddBtn = document.getElementById("desktopAddBtn");
const cancelBtn = document.getElementById("cancelBtn");
const clearBtn = document.getElementById("clearBtn");

/* ============================================================
   🧹 RESET FORM HELPER (MASTER PARITY)
============================================================ */
function resetForm() {
  sharedState.currentEditIdRef.value = null;

  if (form) form.reset();

  // Clear cached edit state
  sessionStorage.removeItem("appointmentEditId");
  sessionStorage.removeItem("appointmentEditPayload");

  // Clear text inputs
  [
    "patientInput",
    "doctorInput",
    "notes",
  ].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });

  // Clear hidden IDs
  ["patientId", "doctorId"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });

  // Clear dropdowns
  [
    "organizationSelect",
    "facilitySelect",
    "departmentSelect",
  ].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });

  // Reset date
  const dateInput = document.getElementById("dateTime");
  if (dateInput) dateInput.value = "";
}

/* ============================================================
   🧭 FORM VISIBILITY CONTROL
============================================================ */
function showForm() {
  formContainer?.classList.remove("hidden");
  desktopAddBtn?.classList.add("hidden");
  localStorage.setItem("appointmentFormVisible", "true");
}

function hideForm() {
  resetForm();
  formContainer?.classList.add("hidden");
  desktopAddBtn?.classList.remove("hidden");
  localStorage.setItem("appointmentFormVisible", "false");
}

// 🔗 Expose globally (actions / hot reload)
window.showForm = showForm;
window.resetForm = resetForm;

/* ============================================================
   🔘 BUTTON WIRING
============================================================ */
if (cancelBtn) {
  cancelBtn.onclick = () => {
    resetForm();
    window.location.href = "/appointments-list.html";
  };
}

if (clearBtn) clearBtn.onclick = resetForm;

if (desktopAddBtn) {
  desktopAddBtn.onclick = () => {
    sessionStorage.removeItem("appointmentEditId");
    sessionStorage.removeItem("appointmentEditPayload");
    resetForm();
    showForm();
  };
}

/* ============================================================
   📦 LIST LOADER STUB (FORM-ONLY MODE)
============================================================ */
async function loadEntries() {
  return; // handled by list page
}

/* ============================================================
   🚀 INIT ENTRYPOINT
============================================================ */
export async function initAppointmentModule() {
  showForm(); // form-only mode (MASTER parity)

  if (form) {
    setupAppointmentFormSubmission({
      form,
      token,
      sharedState,
      resetForm,
      loadEntries,
    });
  }

  localStorage.setItem("appointmentPanelVisible", "false");

  // Normalize role for field defaults (EXACT MASTER LOGIC)
  let roleRaw = localStorage.getItem("userRole") || "staff";
  let role = roleRaw.trim().toLowerCase();

  if (role.includes("super") && role.includes("admin")) role = "superadmin";
  else if (role.includes("admin")) role = "admin";
  else role = "staff";

  setupFieldSelector({
    module: "appointments",
    fieldLabels: FIELD_LABELS_APPOINTMENT,
    fieldOrder: FIELD_ORDER_APPOINTMENT,
    defaultFields: FIELD_DEFAULTS_APPOINTMENT[role],
  });
}

/* ============================================================
   🔁 SYNC STUB
============================================================ */
export function syncRefsToState() {
  // reserved for future reactive syncing
}
