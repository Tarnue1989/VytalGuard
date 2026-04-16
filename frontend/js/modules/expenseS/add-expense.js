// 📦 add-expense.js – Expense Form Page Controller (Enterprise Master Pattern)
// ============================================================================
// 🧭 Mirrors consultation-main.js / deposit-main.js EXACTLY
// 🔹 Auth guard + logout watcher
// 🔹 Form reset orchestration
// 🔹 Edit session coordination
// 🔹 Delegates ALL business logic to expense-form.js
// 🔹 NO data loaders, NO API calls, NO RBAC branching here
// ============================================================================

import { setupExpenseFormSubmission } from "./expense-form.js";

import {
  initPageGuard,
  initLogoutWatcher,
  autoPagePermissionKey,
} from "../../utils/index.js";

/* ============================================================ */
/* 🔐 Auth Guard + Global Watchers */
/* ============================================================ */
const token = initPageGuard(
  autoPagePermissionKey(["expenses:create", "expenses:update"])
);
initLogoutWatcher();

/* ============================================================ */
/* 🌐 Shared State (Enterprise Pattern) */
/* ============================================================ */
const sharedState = {
  currentEditIdRef: { value: null },
};

/* ============================================================ */
/* 📎 DOM Refs */
/* ============================================================ */
const form = document.getElementById("expenseForm");
const cancelBtn = document.getElementById("cancelBtn");
const clearBtn = document.getElementById("clearBtn");

/* ============================================================ */
/* 🧹 Reset Helper (Add Mode) */
/* ============================================================ */
function resetForm() {
  if (!form) return;

  form.reset();
  sharedState.currentEditIdRef.value = null;

  // Clear cached edit state
  sessionStorage.removeItem("expenseEditId");
  sessionStorage.removeItem("expenseEditPayload");

  // Clear selects
  [
    "organizationSelect",
    "facilitySelect",
    "accountSelect",
    "categorySelect",
    "paymentMethodSelect",
  ].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });

  // Reset UI labels
  const titleEl = document.querySelector(".card-title");
  if (titleEl) titleEl.textContent = "Add Expense";

  const submitBtn = form.querySelector("button[type=submit]");
  if (submitBtn)
    submitBtn.innerHTML = `<i class="ri-add-line me-1"></i> Add Expense`;
}

/* ============================================================ */
/* 🚀 Init (Page Entry) */
/* ============================================================ */
document.addEventListener("DOMContentLoaded", () => {
  if (!form) return;

  setupExpenseFormSubmission({
    form,
    token,
    sharedState,
    resetForm,
  });

  /* ---------------- Cancel ---------------- */
  cancelBtn?.addEventListener("click", () => {
    sessionStorage.removeItem("expenseEditId");
    sessionStorage.removeItem("expenseEditPayload");
    window.location.href = "/expenses-list.html";
  });

  /* ---------------- Clear ---------------- */
  clearBtn?.addEventListener("click", () => {
    resetForm();
  });
});

/* ============================================================ */
/* 🔁 Reserved Sync Hook (Future) */
/* ============================================================ */
export function syncRefsToState() {
  // Reserved for enterprise reactive form syncing
}