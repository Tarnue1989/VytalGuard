// 📦 billing-trigger-main.js – Form-only loader for Billing Trigger (Enterprise Master Pattern)
// ============================================================================
// 🔹 Converted 1:1 from patient-main.js
// 🔹 Aligned with BillingTrigger controller, routes, and permissions
// 🔹 Preserves ALL DOM IDs required by form + list + RT loaders
// 🔹 NO explanations – production-ready
// ============================================================================

import { initPageGuard, initLogoutWatcher } from "../../utils/index.js";
import { setupBillingTriggerFormSubmission } from "./billing-trigger-form.js";
import {
  FIELD_LABELS_BILLING_TRIGGER,
  FIELD_ORDER_BILLING_TRIGGER,
  FIELD_DEFAULTS_BILLING_TRIGGER,
} from "./billing-trigger-constants.js";
import { setupFieldSelector } from "../../utils/ui-utils.js";

/* ============================================================
   🔐 Auth Guard + Shared State
============================================================ */
const token = initPageGuard("billing_trigger");
initLogoutWatcher();

const sharedState = {
  currentEditIdRef: { value: null },
};

/* ============================================================
   📎 DOM Refs (IDS MUST MATCH FORM HTML)
============================================================ */
const form = document.getElementById("billingTriggerForm");
const formContainer = document.getElementById("formContainer");
const desktopAddBtn = document.getElementById("desktopAddBtn");
const cancelBtn = document.getElementById("cancelBtn");
const clearBtn = document.getElementById("clearBtn");

/* ============================================================
   🧹 Reset Form Helper
============================================================ */
function resetForm() {
  sharedState.currentEditIdRef.value = null;
  if (form) form.reset();

  // Clear cached edit state
  sessionStorage.removeItem("billingTriggerEditId");
  sessionStorage.removeItem("billingTriggerEditPayload");

  // Explicitly clear text/select inputs
  [
    "module_key",
    "trigger_status",
    "organizationSelect",
    "facilitySelect",
  ].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });

  // Reset active flag (select → default true)
  const activeEl = document.getElementById("is_active");
  if (activeEl) activeEl.value = "true";
}

/* ============================================================
   🧭 Form Show / Hide
============================================================ */
function showForm() {
  formContainer?.classList.remove("hidden");
  desktopAddBtn?.classList.add("hidden");
  localStorage.setItem("billingTriggerFormVisible", "true");
}

function hideForm() {
  resetForm();
  formContainer?.classList.add("hidden");
  desktopAddBtn?.classList.remove("hidden");
  localStorage.setItem("billingTriggerFormVisible", "false");
}

// 🔗 Expose globally (for actions / hot reload)
window.showForm = showForm;
window.resetForm = resetForm;

/* ============================================================
   ⚙️ Wire Button Actions
============================================================ */
if (cancelBtn) {
  cancelBtn.onclick = () => {
    resetForm();
    window.location.href = "/billing-trigger-list.html";
  };
}

if (clearBtn) clearBtn.onclick = resetForm;

if (desktopAddBtn) {
  desktopAddBtn.onclick = () => {
    sessionStorage.removeItem("billingTriggerEditId");
    sessionStorage.removeItem("billingTriggerEditPayload");
    resetForm();
    showForm();
  };
}

/* ============================================================
   📦 Loader Placeholder (list handled elsewhere)
============================================================ */
async function loadEntries() {
  return;
}

/* ============================================================
   🚀 Init Entrypoint
============================================================ */
export async function initBillingTriggerModule() {
  showForm();

  setupBillingTriggerFormSubmission({
    form,
    token,
    sharedState,
    resetForm,
    loadEntries,
  });

  localStorage.setItem("billingTriggerPanelVisible", "false");

  // Normalize role
  let roleRaw = localStorage.getItem("userRole") || "staff";
  let role = roleRaw.trim().toLowerCase();

  if (role.includes("super") && role.includes("admin")) {
    role = "superadmin";
  } else if (role.includes("admin")) {
    role = "admin";
  } else {
    role = "staff";
  }

  setupFieldSelector({
    module: "billing_trigger",
    fieldLabels: FIELD_LABELS_BILLING_TRIGGER,
    fieldOrder: FIELD_ORDER_BILLING_TRIGGER,
    defaultFields: FIELD_DEFAULTS_BILLING_TRIGGER[role],
  });
}

/* ============================================================
   (Optional) State Sync Stub
============================================================ */
export function syncRefsToState() {
  // no-op
}
