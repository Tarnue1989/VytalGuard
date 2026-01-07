// 📦 refund-deposits-main.js – Enterprise Master Pattern Aligned
// ============================================================================
// 🔹 Mirrors refund-main.js for deposit refunds
// 🔹 Unified form lifecycle, RBAC consistency, and edit-mode support
// 🔹 Uses refundable balance from deposit model
// ============================================================================

import {
  initPageGuard,
  initLogoutWatcher,
  autoPagePermissionKey,
} from "../../utils/index.js";

import { setupRefundDepositFormSubmission } from "./refund-deposits-form.js";

import {
  FIELD_LABELS_REFUND_DEPOSIT,
  FIELD_ORDER_REFUND_DEPOSIT,
  FIELD_DEFAULTS_REFUND_DEPOSIT,
} from "./refund-deposits-constants.js";

import { setupFieldSelector } from "../../utils/ui-utils.js";

/* ============================================================
   🔐 Auth Guard
============================================================ */
const token = initPageGuard(
  autoPagePermissionKey(["refund-deposits:create", "refund-deposits:edit"])
);
initLogoutWatcher();

/* ============================================================
   🌐 Shared State + DOM Refs
============================================================ */
const sharedState = {
  currentEditIdRef: { value: null },
};

const form = document.getElementById("refundDepositForm");
const formContainer = document.getElementById("refundDepositFormContainer");

const desktopAddBtn = document.getElementById("desktopAddRefundDepositBtn");
const cancelBtn = document.getElementById("cancelRefundDepositBtn");
const clearBtn = document.getElementById("clearRefundDepositBtn");

/* ============================================================
   🧹 Reset & Visibility Helpers
============================================================ */
function resetForm() {
  sharedState.currentEditIdRef.value = null;

  if (form) form.reset();

  // Clear cached edit mode
  sessionStorage.removeItem("refundDepositEditId");
  sessionStorage.removeItem("refundDepositEditPayload");

  // Clear text inputs
  ["patientInput", "depositInput", "refund_amount", "reason"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });

  // Clear hidden inputs
  ["patientId", "depositId"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });

  // 🔥 HARD RESET dropdown DATA (important)
  const depositInput = document.getElementById("depositInput");
  if (depositInput) {
    depositInput.innerHTML = "";       // remove all options
    depositInput.disabled = true;      // lock until patient selected
  }

  const methodSelect = document.getElementById("methodSelect");
  if (methodSelect) {
    methodSelect.value = "";
  }

  const orgSelect = document.getElementById("organizationSelect");
  if (orgSelect) orgSelect.value = "";

  const facSelect = document.getElementById("facilitySelect");
  if (facSelect) facSelect.value = "";

  // Reset max constraint
  const amt = document.getElementById("refund_amount");
  if (amt) amt.removeAttribute("max");

  console.info("🧹 [Deposit Refund] FULL form reset (values + data)");
}

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

window.showForm = showForm;
window.resetForm = resetForm;

/* ============================================================
   🔘 Button Wiring
============================================================ */
if (cancelBtn) {
  cancelBtn.onclick = () => {
    console.log("🚪 [Deposit Refund] Cancel clicked – returning to list");
    resetForm();
    window.location.href = "/refund-deposits-list.html";
  };
}

if (clearBtn) {
  clearBtn.onclick = () => {
    console.log("🧹 Clear Deposit Refund Form");
    resetForm();
  };
}

if (desktopAddBtn) {
  desktopAddBtn.onclick = () => {
    console.log("➕ [Deposit Refund] Switching to Add mode");
    sessionStorage.removeItem("refundDepositEditId");
    sessionStorage.removeItem("refundDepositEditPayload");
    resetForm();
    showForm();
  };
}

/* ============================================================
   🚀 Module Init
============================================================ */
export async function initRefundDepositModule() {
  showForm(); // Always open form

  setupRefundDepositFormSubmission({
    form,
    token,
    sharedState,
    resetForm,
    loadEntries: () => {},
  });

  localStorage.setItem("refundDepositPanelVisible", "false");

  // Normalize role
  let roleRaw = localStorage.getItem("userRole") || "staff";
  let role = roleRaw.trim().toLowerCase();

  if (role.includes("super") && role.includes("admin")) role = "superadmin";
  else if (role.includes("admin")) role = "admin";
  else role = "staff";

  // Field selector for visibility control
  setupFieldSelector({
    module: "refund_deposit",
    fieldLabels: FIELD_LABELS_REFUND_DEPOSIT,
    fieldOrder: FIELD_ORDER_REFUND_DEPOSIT,
    defaultFields:
      FIELD_DEFAULTS_REFUND_DEPOSIT[role] ||
      FIELD_DEFAULTS_REFUND_DEPOSIT.staff,
  });

  console.info(`✅ [Deposit Refund] Module initialized for role: ${role}`);
}

/* ============================================================
   Placeholder
============================================================ */
export function syncRefsToState() {}
