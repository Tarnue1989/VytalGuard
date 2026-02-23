// 📦 employee-main.js – Form-only loader for Employee (ENTERPRISE MASTER PARITY)
// ============================================================================
// 🧭 FULL MASTER PARITY WITH patient-main.js
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

import { setupEmployeeFormSubmission } from "./employee-form.js";

import {
  FIELD_LABELS_EMPLOYEE,
  FIELD_ORDER_EMPLOYEE,
  FIELD_DEFAULTS_EMPLOYEE,
} from "./employee-constants.js";

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
const form = document.getElementById("employeeForm");
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
  sessionStorage.removeItem("employeeEditId");
  sessionStorage.removeItem("employeeEditPayload");

  // 🧾 Explicit text inputs
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

  // 🏢 Org / Facility / Department
  ["organizationSelect", "facilitySelect", "departmentSelect"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });

  // 🔘 Status default (Active)
  document.getElementById("status_active")?.setAttribute("checked", true);

  // 🖼️ File previews + flags
  ["photo", "resume", "document"].forEach((type) => {
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
  localStorage.setItem("employeeFormVisible", "true");
}

function hideForm() {
  resetForm();
  formContainer?.classList.add("hidden");
  desktopAddBtn?.classList.remove("hidden");
  localStorage.setItem("employeeFormVisible", "false");
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
   📦 Loader Placeholder (FORM-ONLY MODE)
============================================================ */
async function loadEntries() {
  return; // handled by list page
}

/* ============================================================
   🚀 Init Entrypoint (MASTER SEQUENCE)
============================================================ */
export async function initEmployeeModule() {
  showForm(); // form-only mode (MASTER parity)

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

  // 🧩 Normalize role for field defaults (MASTER)
  let roleRaw = localStorage.getItem("userRole") || "staff";
  let role = roleRaw.trim().toLowerCase();

  if (role.includes("super") && role.includes("admin")) role = "superadmin";
  else if (role.includes("admin")) role = "admin";
  else role = "staff";

  setupFieldSelector({
    module: "employee",
    fieldLabels: FIELD_LABELS_EMPLOYEE,
    fieldOrder: FIELD_ORDER_EMPLOYEE,
    defaultFields: FIELD_DEFAULTS_EMPLOYEE[role],
  });
}

/* ============================================================
   🔁 Sync Stub (MASTER)
============================================================ */
export function syncRefsToState() {
  // reserved for future reactive syncing
}
