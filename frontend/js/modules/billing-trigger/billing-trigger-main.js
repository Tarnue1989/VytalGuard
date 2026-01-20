// 📦 billing-trigger-main.js – Form-only Loader for Billing Trigger (ENTERPRISE FINAL)
// ============================================================================
// 🧭 FULL PARITY WITH billableitem-main.js (form-only mode)
// 🔹 Auth guard + logout watcher
// 🔹 Unified form visibility + reset logic
// 🔹 Session-safe edit caching
// 🔹 Role-based field selector (enterprise-aligned)
// 🔹 100% ID-safe (inputs, selects, buttons preserved)
// ============================================================================

import {
  initPageGuard,
  autoPagePermissionKey,
  initLogoutWatcher,
} from "../../utils/index.js";

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
const token = initPageGuard(autoPagePermissionKey());
initLogoutWatcher();

const sharedState = {
  currentEditIdRef: { value: null },
};

/* ============================================================
   📎 DOM Refs (ID-SAFE)
============================================================ */
const form = document.getElementById("billingTriggerForm");
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
  sessionStorage.removeItem("billingTriggerEditId");
  sessionStorage.removeItem("billingTriggerEditPayload");

  // Clear text / select inputs (ID-safe)
  [
    "module_key",
    "trigger_status",
    "organizationSelect",
    "facilitySelect",
  ].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });

  // Default active = true
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

// 🌍 Expose globally (actions / hot reload)
window.showForm = showForm;
window.resetForm = resetForm;

/* ============================================================
   🔘 Button Wiring
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
   📦 Loader Placeholder (Form-only)
============================================================ */
async function loadEntries() {
  return; // list page owns data loading
}

/* ============================================================
   🚀 Init Entrypoint (ENTERPRISE FINAL)
============================================================ */
export async function initBillingTriggerModule() {
  // Form-only mode
  showForm();

  if (form) {
    setupBillingTriggerFormSubmission({
      form,
      token,
      sharedState,
      resetForm,
      loadEntries,
    });
  }

  // Ensure list panel stays hidden
  localStorage.setItem("billingTriggerPanelVisible", "false");

  /* ---------------- Role Normalization ---------------- */
  let roleRaw = localStorage.getItem("userRole") || "staff";
  let role = roleRaw.trim().toLowerCase();

  if (role.includes("super") && role.includes("admin")) role = "superadmin";
  else if (role.includes("admin")) role = "admin";
  else role = "staff";

  /* ---------------- Field Selector ---------------- */
  setupFieldSelector({
    module: "billing_trigger",
    fieldLabels: FIELD_LABELS_BILLING_TRIGGER,
    fieldOrder: FIELD_ORDER_BILLING_TRIGGER,
    defaultFields: FIELD_DEFAULTS_BILLING_TRIGGER[role],
  });
}

/* ============================================================
   🔁 State Sync Stub
============================================================ */
export function syncRefsToState() {
  // reserved for future enterprise reactive syncing
}
