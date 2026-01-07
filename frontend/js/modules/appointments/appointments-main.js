// 📦 appointment-main.js – Form-only loader for Appointment (permission-driven)

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
   🔐 Auth Guard
   ============================================================ */
// Auto-detect proper permission (e.g., appointments:create / edit)
const token = initPageGuard(autoPagePermissionKey(["appointments:create", "appointments:edit"]));
initLogoutWatcher();

/* ============================================================
   🌐 Shared State + DOM Refs
   ============================================================ */
const sharedState = {
  currentEditIdRef: { value: null },
};

const form = document.getElementById("appointmentForm");
const formContainer = document.getElementById("formContainer");
const desktopAddBtn = document.getElementById("desktopAddBtn");
const cancelBtn = document.getElementById("cancelBtn");
const clearBtn = document.getElementById("clearBtn");

/* ============================================================
   🧹 Reset & Visibility Helpers
   ============================================================ */
function resetForm() {
  sharedState.currentEditIdRef.value = null;
  if (form) form.reset();

  // Clear cached edit session
  sessionStorage.removeItem("appointmentEditId");
  sessionStorage.removeItem("appointmentEditPayload");

  // Reset text inputs
  ["notes", "patientInput", "doctorInput"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });

  // Reset dropdowns
  ["organizationSelect", "facilitySelect", "departmentSelect"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });

  // Clear hidden IDs
  ["patientId", "doctorId"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });

  // Clear date/time field
  const dateTimeInput = document.getElementById("dateTime");
  if (dateTimeInput) dateTimeInput.value = "";

  console.info("🧹 [Appointment] Form reset complete");
}

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

// Expose globally so action handlers can reuse
window.showForm = showForm;
window.resetForm = resetForm;

/* ============================================================
   🔘 Button Wiring
   ============================================================ */
if (cancelBtn) {
  cancelBtn.onclick = () => {
    console.log("🚪 [Appointment] Cancel clicked – returning to list");
    resetForm();
    window.location.href = "/appointments-list.html";
  };
}

if (clearBtn) clearBtn.onclick = resetForm;

if (desktopAddBtn) {
  desktopAddBtn.onclick = () => {
    console.log("➕ [Appointment] Switching to Add mode");
    sessionStorage.removeItem("appointmentEditId");
    sessionStorage.removeItem("appointmentEditPayload");
    resetForm();
    showForm();
  };
}

/* ============================================================
   📦 Stub (no list handling here)
   ============================================================ */
async function loadEntries() {
  return; // no-op (list page handles this)
}

/* ============================================================
   🚀 Module Init
   ============================================================ */
export async function initAppointmentModule() {
  showForm(); // open form immediately

  setupAppointmentFormSubmission({
    form,
    token,
    sharedState,
    resetForm,
    loadEntries,
  });

  localStorage.setItem("appointmentPanelVisible", "false");

  // Normalize role
  let roleRaw = localStorage.getItem("userRole") || "staff";
  let role = roleRaw.trim().toLowerCase();

  if (role.includes("super") && role.includes("admin")) role = "superadmin";
  else if (role.includes("admin")) role = "admin";
  else role = "staff";

  // 🔧 Setup field selector based on role defaults
  setupFieldSelector({
    module: "appointment",
    fieldLabels: FIELD_LABELS_APPOINTMENT,
    fieldOrder: FIELD_ORDER_APPOINTMENT,
    defaultFields:
      FIELD_DEFAULTS_APPOINTMENT[role] ||
      FIELD_DEFAULTS_APPOINTMENT.staff,
  });

  console.info(`✅ [Appointment] Module initialized for role: ${role}`);
}

/* ============================================================
   (Optional)
   ============================================================ */
export function syncRefsToState() {
  // no-op (placeholder for future)
}
