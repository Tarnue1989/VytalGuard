// 📦 payment-main.js – Form-only loader for Payment (Enterprise Master Pattern)
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

import { setupPaymentFormSubmission } from "./payment-form.js";

import {
  FIELD_LABELS_PAYMENT,
  FIELD_ORDER_PAYMENT,
  FIELD_DEFAULTS_PAYMENT,
} from "./payment-constants.js";

import { setupFieldSelector } from "../../utils/ui-utils.js";

/* ============================================================
   🔐 Auth Guard + Shared State
============================================================ */
const token = initPageGuard(
  autoPagePermissionKey(["payments:create", "payments:edit"])
);
initLogoutWatcher();

const sharedState = {
  currentEditIdRef: { value: null },
};

/* ============================================================
   📎 DOM Refs
============================================================ */
const form = document.getElementById("paymentForm");
const formContainer = document.getElementById("formContainer");
const desktopAddBtn = document.getElementById("desktopAddBtn");
const cancelBtn = document.getElementById("cancelBtn");
const clearBtn = document.getElementById("clearBtn");

/* ============================================================
   🧹 Reset Form Helper (MASTER PARITY)
============================================================ */
function resetForm() {
  sharedState.currentEditIdRef.value = null;
  if (form) form.reset();

  // Clear cached edit state
  sessionStorage.removeItem("paymentEditId");
  sessionStorage.removeItem("paymentEditPayload");

  // Clear text inputs
  ["patientInput", "amount", "transactionRef", "reason"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });

  // Clear dropdowns
  ["organizationSelect", "facilitySelect", "methodSelect", "invoiceSelect"].forEach(
    (id) => {
      const el = document.getElementById(id);
      if (el) el.value = "";
    }
  );

  // Clear hidden IDs
  const pid = document.getElementById("patientId");
  if (pid) pid.value = "";

  // Reset checkbox
  const dep = document.getElementById("isDeposit");
  if (dep) dep.checked = false;

  // Hide reason group by default
  const reasonGroup = document.getElementById("reasonGroup");
  if (reasonGroup) reasonGroup.classList.add("hidden");
}

/* ============================================================
   🧭 Form Show / Hide
============================================================ */
function showForm() {
  formContainer?.classList.remove("hidden");
  desktopAddBtn?.classList.add("hidden");
  localStorage.setItem("paymentFormVisible", "true");
}

function hideForm() {
  resetForm();
  formContainer?.classList.add("hidden");
  desktopAddBtn?.classList.remove("hidden");
  localStorage.setItem("paymentFormVisible", "false");
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
    window.location.href = "/payments-list.html";
  };
}

if (clearBtn) clearBtn.onclick = resetForm;

if (desktopAddBtn) {
  desktopAddBtn.onclick = () => {
    sessionStorage.removeItem("paymentEditId");
    sessionStorage.removeItem("paymentEditPayload");
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
export async function initPaymentModule() {
  showForm(); // form-only mode (MASTER parity)

  if (form) {
    setupPaymentFormSubmission({
      form,
      token,
      sharedState,
      resetForm,
      loadEntries,
    });
  }

  localStorage.setItem("paymentPanelVisible", "false");

  // Normalize role for field defaults
  let roleRaw = localStorage.getItem("userRole") || "staff";
  let role = roleRaw.trim().toLowerCase();

  if (role.includes("super") && role.includes("admin")) role = "superadmin";
  else if (role.includes("admin")) role = "admin";
  else role = "staff";

  setupFieldSelector({
    module: "payment",
    fieldLabels: FIELD_LABELS_PAYMENT,
    fieldOrder: FIELD_ORDER_PAYMENT,
    defaultFields: FIELD_DEFAULTS_PAYMENT[role] || FIELD_DEFAULTS_PAYMENT.staff,
  });
}

/* ============================================================
   🔁 Sync Stub
============================================================ */
export function syncRefsToState() {
  // reserved for future reactive syncing
}
