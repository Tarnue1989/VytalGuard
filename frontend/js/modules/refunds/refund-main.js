// 📦 refund-main.js – Enterprise Master Pattern Aligned
// ============================================================================
// 🔹 Mirrors deposit-main.js for unified form lifecycle & RBAC consistency
// 🔹 Updated to work with new refundable_balance behavior
// ============================================================================

import {
  initPageGuard,
  initLogoutWatcher,
  autoPagePermissionKey,
} from "../../utils/index.js";

import { setupRefundFormSubmission } from "./refund-form.js";

import {
  FIELD_LABELS_REFUND,
  FIELD_ORDER_REFUND,
  FIELD_DEFAULTS_REFUND,
} from "./refund-constants.js";

import { setupFieldSelector } from "../../utils/ui-utils.js";

/* ============================================================
   🔐 Auth Guard
============================================================ */
const token = initPageGuard(autoPagePermissionKey(["refunds:create", "refunds:edit"]));
initLogoutWatcher();

/* ============================================================
   🌐 Shared State + DOM Refs
============================================================ */
const sharedState = {
  currentEditIdRef: { value: null },
};

const form = document.getElementById("refundForm");
const formContainer = document.getElementById("formContainer");
const desktopAddBtn = document.getElementById("desktopAddBtn");
const cancelBtn = document.getElementById("cancelBtn");
const clearBtn = document.getElementById("clearBtn");

/* ============================================================
   🧹 Reset & Visibility Helpers
============================================================ */
function resetForm() {
  sharedState.currentEditIdRef.value = null;

  if (form) {
    form.reset();
  }

  // 🔥 Always remove stale cached edit payload
  sessionStorage.removeItem("refundEditId");
  sessionStorage.removeItem("refundEditPayload");

  // Clear text inputs
  ["patientInput", "amount", "reason"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });

  // Clear hidden inputs
  ["patientId", "invoiceId"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });

  // Clear dropdowns
  ["organizationSelect", "facilitySelect", "methodSelect", "paymentSelect"]
    .forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.value = "";
    });

  // 🔥 Remove max constraint from amount after reset
  const amountField = document.getElementById("amount");
  if (amountField) {
    amountField.removeAttribute("max");
  }

  console.info("🧹 [Refund] Form reset complete (safe for refundable_balance)");
}

function showForm() {
  formContainer?.classList.remove("hidden");
  desktopAddBtn?.classList.add("hidden");
  localStorage.setItem("refundFormVisible", "true");
}

function hideForm() {
  resetForm();
  formContainer?.classList.add("hidden");
  desktopAddBtn?.classList.remove("hidden");
  localStorage.setItem("refundFormVisible", "false");
}

window.showForm = showForm;
window.resetForm = resetForm;

/* ============================================================
   🔘 Button Wiring
============================================================ */
if (cancelBtn) {
  cancelBtn.onclick = () => {
    console.log("🚪 [Refund] Cancel clicked – returning to list");
    resetForm();
    window.location.href = "/refunds-list.html";
  };
}

if (clearBtn) {
  clearBtn.onclick = () => {
    console.log("🧹 Clear Refund Form");
    resetForm();
  };
}

if (desktopAddBtn) {
  desktopAddBtn.onclick = () => {
    console.log("➕ [Refund] Switching to Add mode");
    sessionStorage.removeItem("refundEditId");
    sessionStorage.removeItem("refundEditPayload");

    resetForm();
    showForm();
  };
}

/* ============================================================
   🚀 Module Init
============================================================ */
export async function initRefundModule() {
  showForm(); // Auto-open form

  setupRefundFormSubmission({
    form,
    token,
    sharedState,
    resetForm,
    loadEntries: () => {},
  });

  localStorage.setItem("refundPanelVisible", "false");

  // Normalize role
  let roleRaw = localStorage.getItem("userRole") || "staff";
  let role = roleRaw.trim().toLowerCase();

  if (role.includes("super") && role.includes("admin")) role = "superadmin";
  else if (role.includes("admin")) role = "admin";
  else role = "staff";

  // Field selector
  setupFieldSelector({
    module: "refund",
    fieldLabels: FIELD_LABELS_REFUND,
    fieldOrder: FIELD_ORDER_REFUND,
    defaultFields: FIELD_DEFAULTS_REFUND[role] || FIELD_DEFAULTS_REFUND.staff,
  });

  console.info(`✅ [Refund] Module initialized for role: ${role}`);
}

/* ============================================================
   Placeholder
============================================================ */
export function syncRefsToState() {}
