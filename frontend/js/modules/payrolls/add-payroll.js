// 📦 add-payroll.js – Payroll Form Page Controller (FULLY UPDATED)

import { setupPayrollFormSubmission } from "./payroll-form.js";

import {
  initPageGuard,
  initLogoutWatcher,
  autoPagePermissionKey,
} from "../../utils/index.js";

/* ============================================================
   🔐 Auth Guard + Global Watchers
============================================================ */
const token = initPageGuard(
  autoPagePermissionKey(["payrolls:create", "payrolls:update"])
);
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
const form = document.getElementById("payrollForm");
const cancelBtn = document.getElementById("cancelBtn");
const clearBtn = document.getElementById("clearBtn");

/* ============================================================
   🧹 Reset Helper
============================================================ */
function resetForm() {
  if (!form) return;

  form.reset();
  sharedState.currentEditIdRef.value = null;

  sessionStorage.removeItem("payrollEditId");
  sessionStorage.removeItem("payrollEditPayload");

  // Clear hidden IDs
  ["employeeId"].forEach((id) => {
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

  // Reset UI
  const titleEl = document.querySelector(".card-title");
  if (titleEl) titleEl.textContent = "Add Payroll";

  const submitBtn = form.querySelector("button[type=submit]");
  if (submitBtn)
    submitBtn.innerHTML = `<i class="ri-add-line me-1"></i> Add Payroll`;
}

/* ============================================================
   🚀 Init
============================================================ */
document.addEventListener("DOMContentLoaded", () => {
  if (!form) return;

  setupPayrollFormSubmission({
    form,
    token,
    sharedState,
    resetForm,
  });

  /* ---------------- Cancel ---------------- */
  cancelBtn?.addEventListener("click", () => {
    sessionStorage.removeItem("payrollEditId");
    sessionStorage.removeItem("payrollEditPayload");
    window.location.href = "/payrolls-list.html";
  });

  /* ---------------- Clear ---------------- */
  clearBtn?.addEventListener("click", () => {
    resetForm();
  });
});

/* ============================================================
   🔁 Reserved Sync Hook
============================================================ */
export function syncRefsToState() {}