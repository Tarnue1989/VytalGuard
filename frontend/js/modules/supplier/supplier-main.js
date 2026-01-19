// 📦 employee-main.js – Form-only loader for Employee (Enterprise Master Pattern)
// ============================================================================
// 🧭 FULL PARITY WITH department-main.js
// 🔹 Auth guard + logout watcher
// 🔹 Unified form visibility and reset logic
// 🔹 Session-safe edit caching
// 🔹 Field selector integration (role-aware)
// 🔹 100% ID-safe and controller-aligned
// ============================================================================

import {
  initPageGuard,
  initLogoutWatcher,
  autoPagePermissionKey,
} from "../../utils/index.js";

import { setupEmployeeFormSubmission } from "./employee-form.js";

import {
  FIELD_LABELS_EMPLOYEE,
  FIELD_ORDER_EMPLOYEE,
  FIELD_DEFAULTS_EMPLOYEE,
} from "./employee-constants.js";

import { setupFieldSelector } from "../../utils/ui-utils.js";

/* ============================================================
   🔐 Auth Guard + Shared State
============================================================ */
const token = initPageGuard(autoPagePermissionKey());
initLogoutWatcher();

const sharedState = {
  currentEditIdRef: { value: null },
};

/* ============================================================
   📎 DOM Refs
============================================================ */
const form = document.getElementById("employeeForm");
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
  sessionStorage.removeItem("employeeEditId");
  sessionStorage.removeItem("employeeEditPayload");

  // Clear text / date / select inputs (ID-safe)
  [
    "first_name",
    "middle_name",
    "last_name",
    "gender",
    "dob",
    "phone",
    "email",
    "address",
    "employee_no",
    "position",
    "license_no",
    "specialty",
    "certifications",
    "hire_date",
    "termination_date",
    "emergency_contact_name",
    "emergency_contact_phone",
  ].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });

  // Clear dropdowns
  ["organizationSelect", "facilitySelect", "departmentSelect"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });

  // Default status = active
  document.getElementById("status_active")?.setAttribute("checked", true);

  // Clear file inputs + flags
  ["photo", "resume", "document"].forEach((type) => {
    document.getElementById(`${type}Input`)?.value = "";
    document.getElementById(`remove_${type}`)?.setAttribute("value", "false");
    document.getElementById(`${type}Preview`) &&
      (document.getElementById(`${type}Preview`).innerHTML = "");
    document
      .getElementById(
        `remove${type.charAt(0).toUpperCase() + type.slice(1)}Btn`
      )
      ?.classList.add("hidden");
  });
}

/* ============================================================
   🧭 Form Show / Hide
============================================================ */
function showForm() {
  formContainer?.classList.remove("hidden");
  desktopAddBtn?.classList.add("hidden");
  localStorage.setItem("employeeFormVisible", "true");
}

function hideForm() {
  resetForm();
  formContainer?.classList.add("hidden");
  desktopAddBtn?.classList.remove("hidden");
  localStorage.setItem("employeeFormVisible", "false");
}

// 🔗 Expose globally (actions / hot reload)
window.showForm = showForm;
window.resetForm = resetForm;

/* ============================================================
   ⚙️ Button Wiring
============================================================ */
if (cancelBtn) {
  cancelBtn.onclick = () => {
    resetForm();
    window.location.href = "/employees-list.html";
  };
}

if (clearBtn) clearBtn.onclick = resetForm;

if (desktopAddBtn) {
  desktopAddBtn.onclick = () => {
    sessionStorage.removeItem("employeeEditId");
    sessionStorage.removeItem("employeeEditPayload");
    resetForm();
    showForm();
  };
}

/* ============================================================
   📦 Loader Placeholder
============================================================ */
async function loadEntries() {
  return; // handled by list page
}

/* ============================================================
   🚀 Init Entrypoint
============================================================ */
export async function initEmployeeModule() {
  showForm(); // form-only mode (MASTER PARITY)

  if (form) {
    setupEmployeeFormSubmission({
      form,
      token,
      sharedState,
      resetForm,
      loadEntries,
    });
  }

  localStorage.setItem("employeePanelVisible", "false");

  // Normalize role for field defaults
  let roleRaw = localStorage.getItem("userRole") || "staff";
  let role = roleRaw.trim().toLowerCase();

  if (role.includes("super") && role.includes("admin")) role = "superadmin";
  else if (role.includes("admin")) role = "admin";
  else role = "staff";

  setupFieldSelector({
    module: "employees",
    fieldLabels: FIELD_LABELS_EMPLOYEE,
    fieldOrder: FIELD_ORDER_EMPLOYEE,
    defaultFields: FIELD_DEFAULTS_EMPLOYEE[role],
  });
}

/* ============================================================
   (Optional) State Sync Stub
============================================================ */
export function syncRefsToState() {
  // reserved for future reactive syncing
}
