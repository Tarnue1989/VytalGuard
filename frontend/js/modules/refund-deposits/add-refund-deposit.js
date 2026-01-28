// 📦 add-refundDeposit.js – Deposit Refund Form Page Controller (Enterprise Master Pattern)
// ============================================================================
// 🧭 FULL MASTER PARITY WITH add-deposit.js / add-refund.js
// 🔹 Auth guard + logout watcher
// 🔹 Form reset orchestration
// 🔹 Edit session coordination
// 🔹 Delegates ALL logic to refund-deposits-form.js
// 🔹 NO data loaders, NO API calls, NO RBAC branching
// ============================================================================

import { setupRefundDepositFormSubmission } from "./refund-deposits-form.js";

import {
  initPageGuard,
  initLogoutWatcher,
  autoPagePermissionKey,
} from "../../utils/index.js";

/* ============================================================
   🔐 Auth Guard + Global Watchers
============================================================ */
const token = initPageGuard(
  autoPagePermissionKey(["refund-deposits:create", "refund-deposits:edit"])
);
initLogoutWatcher();

/* ============================================================
   🌐 Shared State (Enterprise Pattern)
============================================================ */
const sharedState = {
  currentEditIdRef: { value: null },
};

/* ============================================================
   📎 DOM Refs
============================================================ */
const form = document.getElementById("refundDepositForm");
const cancelBtn = document.getElementById("cancelRefundDepositBtn");
const clearBtn = document.getElementById("clearRefundDepositBtn");

/* ============================================================
   🧹 Reset Helper (Add Mode)
============================================================ */
function resetForm() {
  if (!form) return;

  form.reset();
  sharedState.currentEditIdRef.value = null;

  // Clear cached edit state
  sessionStorage.removeItem("refundDepositEditId");
  sessionStorage.removeItem("refundDepositEditPayload");

  // Clear hidden IDs
  ["patientId", "depositId"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });

  // Clear selects
  ["organizationSelect", "facilitySelect", "methodSelect"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });

  // Reset amount constraints
  const amt = document.getElementById("refund_amount");
  if (amt) amt.removeAttribute("max");

  // Reset UI labels
  const titleEl = document.querySelector(".card-title");
  if (titleEl) titleEl.textContent = "Add Deposit Refund";

  const submitBtn = form.querySelector("button[type=submit]");
  if (submitBtn)
    submitBtn.innerHTML = `<i class="ri-add-line me-1"></i> Add Refund`;
}

/* ============================================================
   🚀 Init (Page Entry)
============================================================ */
document.addEventListener("DOMContentLoaded", () => {
  if (!form) return;

  // Wire ALL business logic (lives entirely in form module)
  setupRefundDepositFormSubmission({
    form,
    token,
    sharedState,
    resetForm,
  });

  /* ---------------- Cancel ---------------- */
  cancelBtn?.addEventListener("click", () => {
    sessionStorage.removeItem("refundDepositEditId");
    sessionStorage.removeItem("refundDepositEditPayload");
    window.location.href = "/refund-deposits-list.html";
  });

  /* ---------------- Clear ---------------- */
  clearBtn?.addEventListener("click", () => {
    resetForm();
  });
});

/* ============================================================
   🔁 Reserved Sync Hook (Future)
============================================================ */
export function syncRefsToState() {
  // Reserved for enterprise reactive form syncing
}
