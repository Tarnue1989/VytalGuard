// 📦 payment-main.js – Enterprise Master Pattern Aligned
// ============================================================================
// 🔹 Mirrors deposit-main.js for consistent form lifecycle & RBAC logic
// 🔹 Retains all payment-specific logic, IDs, and API endpoints
// 🔹 Includes unified auth guard, visibility helpers, and role-based field setup
// ============================================================================

import {
  initPageGuard,
  initLogoutWatcher,
  autoPagePermissionKey,
} from "../../utils/index.js";
import { setupPaymentFormSubmission } from "./payment-form.js";
import {
  FIELD_LABELS_PAYMENT,
  FIELD_ORDER_PAYMENT,
  FIELD_DEFAULTS_PAYMENT,
} from "./payment-constants.js";
import { setupFieldSelector } from "../../utils/ui-utils.js";

/* ============================================================
   🔐 Auth Guard
============================================================ */
const token = initPageGuard(autoPagePermissionKey(["payments:create", "payments:edit"]));
initLogoutWatcher();

/* ============================================================
   🌐 Shared State + DOM Refs
============================================================ */
const sharedState = {
  currentEditIdRef: { value: null },
};

const form = document.getElementById("paymentForm");
const formContainer = document.getElementById("formContainer");
const desktopAddBtn = document.getElementById("desktopAddBtn");
const cancelBtn = document.getElementById("cancelBtn");
const clearBtn = document.getElementById("clearBtn");

/* ============================================================
   🧹 Reset & Visibility Helpers
============================================================ */
function resetForm() {
  sharedState.currentEditIdRef.value = null;
  if (form) form.reset();

  // Clear cached edit state
  sessionStorage.removeItem("paymentEditId");
  sessionStorage.removeItem("paymentEditPayload");

  // Clear text fields
  ["patientInput", "amount", "transactionRef", "reason"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });

  // Clear dropdowns
  ["organizationSelect", "facilitySelect", "methodSelect", "invoiceSelect"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });

  // Clear hidden IDs
  const pid = document.getElementById("patientId");
  if (pid) pid.value = "";

  // Reset checkbox
  const dep = document.getElementById("isDeposit");
  if (dep) dep.checked = false;

  // Hide reason group
  const reasonGroup = document.getElementById("reasonGroup");
  if (reasonGroup) reasonGroup.classList.add("hidden");

  console.info("🧹 [Payment] Form reset complete");
}

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

// 🔗 Expose globally
window.showForm = showForm;
window.resetForm = resetForm;

/* ============================================================
   🔘 Button Wiring
============================================================ */
if (cancelBtn) {
  cancelBtn.onclick = () => {
    console.log("🚪 [Payment] Cancel clicked – returning to list");
    resetForm();
    window.location.href = "/payments-list.html";
  };
}

if (clearBtn) clearBtn.onclick = resetForm;

if (desktopAddBtn) {
  desktopAddBtn.onclick = () => {
    console.log("➕ [Payment] Switching to Add mode");
    sessionStorage.removeItem("paymentEditId");
    sessionStorage.removeItem("paymentEditPayload");
    resetForm();
    showForm();
  };
}

/* ============================================================
   📦 Stub – List Loader (no-op)
============================================================ */
async function loadEntries() {
  return;
}

/* ============================================================
   🚀 Module Init
============================================================ */
export async function initPaymentModule() {
  showForm();

  setupPaymentFormSubmission({
    form,
    token,
    sharedState,
    resetForm,
    loadEntries,
  });

  localStorage.setItem("paymentPanelVisible", "false");

  // 🧩 Normalize role
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

  console.info(`✅ [Payment] Module initialized for role: ${role}`);
}

/* ============================================================
   (Optional)
============================================================ */
export function syncRefsToState() {
  // placeholder for extensions
}
