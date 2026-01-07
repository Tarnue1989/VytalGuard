// 📦 employee-main.js – Enterprise-Aligned Master Pattern
// ============================================================================
// 🧭 Master Pattern: triage-record-main.js
// 🔹 Enterprise-consistent structure: unified reset logic, form visibility,
//   permission guard, logout watcher, role normalization, and field selector.
// 🔹 All Employee form element IDs preserved exactly.
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
   🔐 Auth + Logout Guard
============================================================ */
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

  // 🧽 Clear cached edit state
  sessionStorage.removeItem("employeeEditId");
  sessionStorage.removeItem("employeeEditPayload");

  // 🧾 Explicit field cleanup
  [
    "first_name", "middle_name", "last_name", "gender", "dob", "phone",
    "email", "address", "employee_no", "position", "license_no", "specialty",
    "certifications", "hire_date", "termination_date", "emergency_contact_name",
    "emergency_contact_phone",
  ].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });

  // 🏢 Dropdowns
  ["organizationSelect", "facilitySelect", "departmentSelect"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });

  // ✅ Reset status
  const activeRadio = document.getElementById("status_active");
  if (activeRadio) activeRadio.checked = true;

  // 📸 File input & preview cleanup
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

  console.info("🧹 [Employee] Form reset complete");
}

/* ============================================================
   🧭 Form Visibility Controls
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

// 🌍 Expose for global use
window.showForm = showForm;
window.resetForm = resetForm;

/* ============================================================
   🔘 Button Wiring
============================================================ */
if (cancelBtn) {
  cancelBtn.onclick = () => {
    console.log("🚪 [Employee] Cancel clicked → back to list");
    resetForm();
    window.location.href = "/employees-list.html";
  };
}

if (clearBtn) clearBtn.onclick = resetForm;

if (desktopAddBtn) {
  desktopAddBtn.onclick = () => {
    console.log("➕ [Employee] Switching to Add mode");
    sessionStorage.removeItem("employeeEditId");
    sessionStorage.removeItem("employeeEditPayload");
    resetForm();
    showForm();
  };
}

/* ============================================================
   🔁 Loader (No-op)
============================================================ */
async function loadEntries() {
  return;
}

/* ============================================================
   🚀 Module Initializer
============================================================ */
export async function initEmployeeModule() {
  // Restore form visibility preference
  const visible = localStorage.getItem("employeeFormVisible") === "true";
  if (visible) showForm();
  else hideForm();

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

  /* --------------------- Role Normalization --------------------- */
  let roleRaw = localStorage.getItem("userRole") || "staff";
  let role = roleRaw.trim().toLowerCase();

  if (role.includes("super") && role.includes("admin")) role = "superadmin";
  else if (role.includes("admin")) role = "admin";
  else role = "staff";

  /* --------------------- Field Selector Setup --------------------- */
  setupFieldSelector({
    module: "employees",
    fieldLabels: FIELD_LABELS_EMPLOYEE,
    fieldOrder: FIELD_ORDER_EMPLOYEE,
    defaultFields:
      FIELD_DEFAULTS_EMPLOYEE[role] ||
      FIELD_DEFAULTS_EMPLOYEE.staff,
  });

  console.info(`✅ [Employee] Module initialized (role: ${role})`);
}

/* ============================================================
   🔁 Sync Helper (Reserved)
============================================================ */
export function syncRefsToState() {
  // reserved for future reactive linkages
}
