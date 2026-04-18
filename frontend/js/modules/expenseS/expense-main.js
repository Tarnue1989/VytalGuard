// 📦 expense-main.js – Form-only loader for Expense (Enterprise Master Pattern)
// ============================================================================
// 🧭 FULL MASTER PARITY WITH deposit-main.js / consultation-main.js
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

import { setupExpenseFormSubmission } from "./expense-form.js";

import {
  FIELD_LABELS_EXPENSE,
  FIELD_ORDER_EXPENSE,
  FIELD_DEFAULTS_EXPENSE,
} from "./expense-constants.js";

import { setupFieldSelector } from "../../utils/ui-utils.js";

/* ============================================================ */
/* 🔐 Auth Guard + Shared State */
/* ============================================================ */
const token = initPageGuard(autoPagePermissionKey());
initLogoutWatcher();

const sharedState = {
  currentEditIdRef: { value: null },
};

/* ============================================================ */
/* 📎 DOM Refs */
/* ============================================================ */
const form = document.getElementById("expenseForm");
const formContainer = document.getElementById("formContainer");
const desktopAddBtn = document.getElementById("desktopAddBtn");
const cancelBtn = document.getElementById("cancelBtn");
const clearBtn = document.getElementById("clearBtn");

/* ============================================================ */
/* 🧹 Reset Form Helper (MASTER PARITY) */
/* ============================================================ */
function resetForm() {
  sharedState.currentEditIdRef.value = null;
  if (form) form.reset();

  // Clear cached edit state
  sessionStorage.removeItem("expenseEditId");
  sessionStorage.removeItem("expenseEditPayload");

  // Clear text inputs
  [
    "expenseNumber",
    "date",
    "amount",
    "description",
  ].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });

  // Clear dropdowns
  [
    "organizationSelect",
    "facilitySelect",
    "accountSelect",
    "categorySelect",
    "paymentMethodSelect",
    "currencySelect",
  ].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });
}

/* ============================================================ */
/* 🧭 Form Show / Hide */
/* ============================================================ */
function showForm() {
  formContainer?.classList.remove("hidden");
  desktopAddBtn?.classList.add("hidden");
  localStorage.setItem("expenseFormVisible", "true");
}

function hideForm() {
  resetForm();
  formContainer?.classList.add("hidden");
  desktopAddBtn?.classList.remove("hidden");
  localStorage.setItem("expenseFormVisible", "false");
}

// 🔗 Expose globally
window.showExpenseForm = showForm;
window.resetExpenseForm = resetForm;

/* ============================================================ */
/* 🔘 Button Wiring */
/* ============================================================ */
if (cancelBtn) {
  cancelBtn.onclick = () => {
    resetForm();
    window.location.href = "/expenses-list.html";
  };
}

if (clearBtn) clearBtn.onclick = resetForm;

if (desktopAddBtn) {
  desktopAddBtn.onclick = () => {
    sessionStorage.removeItem("expenseEditId");
    sessionStorage.removeItem("expenseEditPayload");
    resetForm();
    showForm();
  };
}

/* ============================================================ */
/* 📦 Loader Placeholder (FORM-ONLY MODE) */
/* ============================================================ */
async function loadEntries() {
  return; // handled by list page
}

/* ============================================================ */
/* 🚀 Init Entrypoint */
/* ============================================================ */
export async function initExpenseModule() {
  showForm(); // form-only mode

  if (form) {
    setupExpenseFormSubmission({
      form,
      token,
      sharedState,
      resetForm,
      loadEntries,
    });
  }

  localStorage.setItem("expensePanelVisible", "false");

  // Normalize role for field defaults
  let roleRaw = localStorage.getItem("userRole") || "staff";
  let role = roleRaw.trim().toLowerCase();

  if (role.includes("super") && role.includes("admin")) role = "superadmin";
  else if (role.includes("admin")) role = "admin";
  else role = "staff";

  setupFieldSelector({
    module: "expenses",
    fieldLabels: FIELD_LABELS_EXPENSE,
    fieldOrder: FIELD_ORDER_EXPENSE,
    defaultFields: FIELD_DEFAULTS_EXPENSE[role],
  });
}

/* ============================================================ */
/* 🔁 Sync Stub */
/* ============================================================ */
export function syncRefsToState() {
  // reserved for future reactive syncing
}