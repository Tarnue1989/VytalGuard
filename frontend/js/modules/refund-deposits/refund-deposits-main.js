// 📦 refund-deposits-main.js – Form-only loader for Deposit Refunds (ENTERPRISE MASTER PARITY)
// ============================================================================
// 🧭 FULL MASTER PARITY WITH deposit-main.js
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

import { setupRefundDepositFormSubmission } from "./refund-deposits-form.js";

import {
  FIELD_LABELS_REFUND_DEPOSIT,
  FIELD_ORDER_REFUND_DEPOSIT,
  FIELD_DEFAULTS_REFUND_DEPOSIT,
} from "./refund-deposits-constants.js";

import { setupFieldSelector } from "../../utils/ui-utils.js";

/* ============================================================
   🔐 Auth Guard + Shared State
============================================================ */
const token = initPageGuard(
  autoPagePermissionKey(["refund-deposits:create", "refund-deposits:edit"])
);
initLogoutWatcher();

const sharedState = {
  currentEditIdRef: { value: null },
};

/* ============================================================
   📎 DOM Refs
============================================================ */
const form = document.getElementById("refundDepositForm");
const formContainer = document.getElementById("refundDepositFormContainer");
const desktopAddBtn = document.getElementById("desktopAddRefundDepositBtn");
const cancelBtn = document.getElementById("cancelRefundDepositBtn");
const clearBtn = document.getElementById("clearRefundDepositBtn");

/* ============================================================
   🧹 Reset Form Helper (MASTER PARITY)
============================================================ */
function resetForm() {
  sharedState.currentEditIdRef.value = null;

  if (form) form.reset();

  // Clear cached edit state
  sessionStorage.removeItem("refundDepositEditId");
  sessionStorage.removeItem("refundDepositEditPayload");

  // Clear text inputs
  ["patientInput", "depositInput", "refund_amount", "reason"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });

  // Clear dropdowns
  ["organizationSelect", "facilitySelect", "methodSelect"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });

  // Clear hidden IDs
  ["patientId", "depositId"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });

  // HARD reset deposit dropdown data
  const depositInput = document.getElementById("depositInput");
  if (depositInput) {
    depositInput.innerHTML = "";
    depositInput.disabled = true;
  }

  // Reset max constraint
  const amt = document.getElementById("refund_amount");
  if (amt) amt.removeAttribute("max");
}

/* ============================================================
   🧭 Form Show / Hide
============================================================ */
function showForm() {
  formContainer?.classList.remove("hidden");
  desktopAddBtn?.classList.add("hidden");
  localStorage.setItem("refundDepositFormVisible", "true");
}

function hideForm() {
  resetForm();
  formContainer?.classList.add("hidden");
  desktopAddBtn?.classList.remove("hidden");
  localStorage.setItem("refundDepositFormVisible", "false");
}

// 🔗 Expose globally (actions / hot reload)
window.showForm = showForm;
window.resetForm = resetForm;

/* ============================================================
   🔘 Button Wiring
============================================================ */
if (cancelBtn) {
  cancelBtn.onclick = () => {
    resetForm();
    window.location.href = "/refund-deposits-list.html";
  };
}

if (clearBtn) {
  clearBtn.onclick = resetForm;
}

if (desktopAddBtn) {
  desktopAddBtn.onclick = () => {
    sessionStorage.removeItem("refundDepositEditId");
    sessionStorage.removeItem("refundDepositEditPayload");
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
   🚀 Init Entrypoint
============================================================ */
export async function initRefundDepositModule() {
  showForm(); // form-only mode (MASTER parity)

  if (form) {
    setupRefundDepositFormSubmission({
      form,
      token,
      sharedState,
      resetForm,
      loadEntries,
    });
  }

  localStorage.setItem("refundDepositPanelVisible", "false");

  // Normalize role for field defaults
  let roleRaw = localStorage.getItem("userRole") || "staff";
  let role = roleRaw.trim().toLowerCase();

  if (role.includes("super") && role.includes("admin")) role = "superadmin";
  else if (role.includes("admin")) role = "admin";
  else role = "staff";

  setupFieldSelector({
    module: "refund_deposit",
    fieldLabels: FIELD_LABELS_REFUND_DEPOSIT,
    fieldOrder: FIELD_ORDER_REFUND_DEPOSIT,
    defaultFields:
      FIELD_DEFAULTS_REFUND_DEPOSIT[role] ||
      FIELD_DEFAULTS_REFUND_DEPOSIT.staff,
  });
}

/* ============================================================
   🔁 Sync Stub
============================================================ */
export function syncRefsToState() {
  // reserved for future reactive syncing
}
