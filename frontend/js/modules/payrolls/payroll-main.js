// 📦 payroll-main.js – FULLY UPDATED (Controller + Payment Fields Aligned)

import {
  initPageGuard,
  autoPagePermissionKey,
  initLogoutWatcher,
} from "../../utils/index.js";

import { setupPayrollFormSubmission } from "./payroll-form.js";

import {
  FIELD_LABELS_PAYROLL,
  FIELD_ORDER_PAYROLL,
  FIELD_DEFAULTS_PAYROLL,
} from "./payroll-constants.js";

import { setupFieldSelector } from "../../utils/ui-utils.js";

/* ============================================================ */
const token = initPageGuard(autoPagePermissionKey());
initLogoutWatcher();

const sharedState = {
  currentEditIdRef: { value: null },
};

/* ============================================================ */
const form = document.getElementById("payrollForm");
const formContainer = document.getElementById("formContainer");
const desktopAddBtn = document.getElementById("desktopAddBtn");
const cancelBtn = document.getElementById("cancelBtn");
const clearBtn = document.getElementById("clearBtn");

/* ============================================================ */
function resetForm() {
  sharedState.currentEditIdRef.value = null;
  if (form) form.reset();

  sessionStorage.removeItem("payrollEditId");
  sessionStorage.removeItem("payrollEditPayload");

  // Clear inputs
  [
    "employeeInput",
    "payrollNumber",
    "period",
    "basicSalary",
    "allowances",
    "deductions",
    "description",
  ].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });

  // Clear selects (UPDATED)
  [
    "organizationSelect",
    "facilitySelect",
    "currencySelect",
    "accountSelect",
    "paymentMethodSelect",
    "categorySelect",
  ].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });

  // Clear hidden
  ["employeeId"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });
}

/* ============================================================ */
function showForm() {
  formContainer?.classList.remove("hidden");
  desktopAddBtn?.classList.add("hidden");
  localStorage.setItem("payrollFormVisible", "true");
}

function hideForm() {
  resetForm();
  formContainer?.classList.add("hidden");
  desktopAddBtn?.classList.remove("hidden");
  localStorage.setItem("payrollFormVisible", "false");
}

window.showForm = showForm;
window.resetForm = resetForm;

/* ============================================================ */
if (cancelBtn) {
  cancelBtn.onclick = () => {
    resetForm();
    window.location.href = "/payrolls-list.html";
  };
}

if (clearBtn) clearBtn.onclick = resetForm;

if (desktopAddBtn) {
  desktopAddBtn.onclick = () => {
    sessionStorage.removeItem("payrollEditId");
    sessionStorage.removeItem("payrollEditPayload");
    resetForm();
    showForm();
  };
}

/* ============================================================ */
async function loadEntries() {
  return;
}

/* ============================================================ */
export async function initPayrollModule() {
  showForm();

  if (form) {
    setupPayrollFormSubmission({
      form,
      token,
      sharedState,
      resetForm,
      loadEntries,
    });
  }

  localStorage.setItem("payrollPanelVisible", "false");

  let roleRaw = localStorage.getItem("userRole") || "staff";
  let role = roleRaw.trim().toLowerCase();

  if (role.includes("super") && role.includes("admin")) role = "superadmin";
  else if (role.includes("admin")) role = "admin";
  else role = "staff";

  setupFieldSelector({
    module: "payrolls",
    fieldLabels: FIELD_LABELS_PAYROLL,
    fieldOrder: FIELD_ORDER_PAYROLL,
    defaultFields: FIELD_DEFAULTS_PAYROLL[role],
  });
}

/* ============================================================ */
export function syncRefsToState() {}