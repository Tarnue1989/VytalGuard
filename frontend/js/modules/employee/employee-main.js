// 📦 employee-main.js – Form-only loader for Employee

import { initPageGuard, initLogoutWatcher } from "../../utils/index.js";
import { setupEmployeeFormSubmission } from "./employee-form.js";
import {
  FIELD_LABELS_EMPLOYEE,
  FIELD_ORDER_EMPLOYEE,
  FIELD_DEFAULTS_EMPLOYEE,
} from "./employee-constants.js";
import { setupFieldSelector } from "../../utils/ui-utils.js";

// 🔐 Auth – driven by backend permission key
const token = initPageGuard("employees");

// 🔁 Global logout watcher
initLogoutWatcher();

// 🌐 Shared State
const sharedState = {
  currentEditIdRef: { value: null },
};

// 📎 DOM Refs
const form = document.getElementById("employeeForm");
const formContainer = document.getElementById("formContainer");
const desktopAddBtn = document.getElementById("desktopAddBtn");
const cancelBtn = document.getElementById("cancelBtn");
const clearBtn = document.getElementById("clearBtn");

/* ------------------------- Helpers ------------------------- */

// 🧹 Reset form
function resetForm() {
  sharedState.currentEditIdRef.value = null;
  if (form) form.reset();

  // Clear cached edit state
  sessionStorage.removeItem("employeeEditId");
  sessionStorage.removeItem("employeeEditPayload");

  // Explicitly clear text fields
  [
    "first_name", "middle_name", "last_name", "gender", "dob", "phone",
    "email", "address", "employee_no", "position", "license_no",
    "specialty", "certifications", "hire_date", "termination_date",
    "emergency_contact_name", "emergency_contact_phone"
  ].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });

  // Clear organization + facility + department dropdowns
  const orgSelect = document.getElementById("organizationSelect");
  if (orgSelect) orgSelect.value = "";
  const facilitySelect = document.getElementById("facilitySelect");
  if (facilitySelect) facilitySelect.value = "";
  const departmentSelect = document.getElementById("departmentSelect");
  if (departmentSelect) departmentSelect.value = "";

  // Reset status radio (default Active)
  const activeRadio = document.getElementById("status_active");
  if (activeRadio) activeRadio.checked = true;

  // Clear file previews + hide remove buttons
  ["photo", "resume", "document"].forEach((type) => {
    const preview = document.getElementById(`${type}Preview`);
    const removeBtn = document.getElementById(`remove${type.charAt(0).toUpperCase() + type.slice(1)}Btn`);
    const input = document.getElementById(`${type}Input`);
    if (preview) preview.innerHTML = "";
    if (removeBtn) removeBtn.classList.add("hidden");
    if (input) input.value = "";
    const flag = document.getElementById(`remove_${type}`);
    if (flag) flag.value = "false";
  });
}

// 🧭 Form show/hide
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

// 🔗 Expose globally so action handlers can reuse
window.showForm = showForm;
window.resetForm = resetForm;

/* ------------------------- Wire Buttons ------------------------- */

if (cancelBtn) {
  cancelBtn.onclick = () => {
    resetForm();
    window.location.href = "/employees-list.html"; // ✅ plural
  };
}

if (clearBtn) clearBtn.onclick = resetForm;

if (desktopAddBtn) {
  desktopAddBtn.onclick = () => {
    // 🧹 Ensure stale edit data is gone
    sessionStorage.removeItem("employeeEditId");
    sessionStorage.removeItem("employeeEditPayload");

    // Reset form for clean Add mode
    resetForm();
    showForm();
  };
}

/* ------------------------- Loader ------------------------- */

async function loadEntries() {
  return; // noop (list page handles this)
}

/* ------------------------- Init ------------------------- */

export async function initEmployeeModule() {
  showForm(); // open the form by default
  setupEmployeeFormSubmission({ form, token, sharedState, resetForm, loadEntries });

  localStorage.setItem("employeePanelVisible", "false");

  // 📌 Normalize role before pulling defaults
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
    module: "employee",
    fieldLabels: FIELD_LABELS_EMPLOYEE,
    fieldOrder: FIELD_ORDER_EMPLOYEE,
    defaultFields: FIELD_DEFAULTS_EMPLOYEE[role],
  });
}

// (Optional)
export function syncRefsToState() {
  // no-op
}
