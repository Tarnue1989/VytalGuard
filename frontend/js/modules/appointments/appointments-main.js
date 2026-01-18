// 📦 appointment-main.js – Form-only loader for Appointment (MASTER-ALIGNED)
// ============================================================================
// 🧭 Mirrors feature-access-main.js EXACTLY (structure + lifecycle)
// 🔹 Auth guard + logout watcher
// 🔹 Unified form visibility and reset logic
// 🔹 Session-safe edit caching
// 🔹 Preserves all existing DOM IDs and appointment form behavior
// ============================================================================

import {
  initPageGuard,
  initLogoutWatcher,
  autoPagePermissionKey,
} from "../../utils/index.js";
import { setupAppointmentFormSubmission } from "./appointments-form.js";
import {
  FIELD_LABELS_APPOINTMENT,
  FIELD_ORDER_APPOINTMENT,
  FIELD_DEFAULTS_APPOINTMENT,
} from "./appointments-constants.js";
import { setupFieldSelector } from "../../utils/ui-utils.js";

/* ============================================================
   🔐 AUTH GUARD + SESSION
============================================================ */
const token = initPageGuard(autoPagePermissionKey());

initLogoutWatcher();

/* ============================================================
   🧠 SHARED STATE
============================================================ */
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
   🧹 RESET FORM (MASTER-SAFE)
============================================================ */
function resetForm() {
  sharedState.currentEditIdRef.value = null;

  if (form) form.reset();

  // Clear cached edit state
  sessionStorage.removeItem("appointmentEditId");
  sessionStorage.removeItem("appointmentEditPayload");

  // Explicitly clear text + hidden fields
  [
    "notes",
    "patientInput",
    "doctorInput",
    "patientId",
    "doctorId",
    "dateTime",
  ].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });

  // Explicitly clear selects
  ["organizationSelect", "facilitySelect", "departmentSelect"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });
}

/* ============================================================
   🧭 FORM VISIBILITY
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

// 🔗 Expose globally (parity with Feature Access / Patient)
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
   📦 LIST LOADER STUB (FORM-ONLY PAGE)
============================================================ */
async function loadEntries() {
  return;
}

/* ============================================================
   🚀 INIT ENTRYPOINT
============================================================ */
export async function initAppointmentModule() {
  showForm(); // form-only page opens by default

  setupAppointmentFormSubmission({
    form,
    token,
    sharedState,
    resetForm,
    loadEntries,
  });

  localStorage.setItem("appointmentPanelVisible", "false");

  // 🔐 Normalize role (EXACT same logic as master)
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
    module: "appointment",
    fieldLabels: FIELD_LABELS_APPOINTMENT,
    fieldOrder: FIELD_ORDER_APPOINTMENT,
    defaultFields:
      FIELD_DEFAULTS_APPOINTMENT[role] ||
      FIELD_DEFAULTS_APPOINTMENT.staff,
  });
}

/* ============================================================
   (Optional) STATE SYNC STUB
============================================================ */
export function syncRefsToState() {
  // no-op placeholder for consistency
}
