// 📦 autoBillingRule-main.js – Form-Only Loader (Enterprise-Aligned)
// ============================================================================
// 🧭 Master Pattern: billableitem-main.js / department-main.js (Form-Only Mode)
// 🔹 Auth guard, logout watcher, and field selector
// 🔹 Role-based form visibility and reset logic
// 🔹 Auto-filled Trigger Module from Feature Module
// 🔹 100% ID-safe for linked HTML + JS modules
// ============================================================================

import {
  initPageGuard,
  autoPagePermissionKey,
  initLogoutWatcher,
} from "../../utils/index.js";

import { setupAutoBillingRuleFormSubmission } from "./autoBillingRule-form.js";
import {
  FIELD_LABELS_AUTO_BILLING_RULE,
  FIELD_ORDER_AUTO_BILLING_RULE,
  FIELD_DEFAULTS_AUTO_BILLING_RULE,
} from "./autoBillingRule-constants.js";
import { setupFieldSelector } from "../../utils/ui-utils.js";

/* ============================================================
   🔐 Auth + Global Guards
============================================================ */
const token = initPageGuard(autoPagePermissionKey());
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
const form = document.getElementById("autoBillingRuleForm");
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

  // 🧩 Clear cached edit session
  sessionStorage.removeItem("autoBillingRuleEditId");
  sessionStorage.removeItem("autoBillingRuleEditPayload");

  // 🧽 Clear key inputs
  [
    "featureModuleSelect",
    "triggerModuleInput",
    "billableItemSelect",
    "chargeMode",
    "defaultPrice",
  ].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });

  // 🏢 Reset dropdowns
  ["organizationSelect", "facilitySelect"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });

  // ✅ Reset checkboxes / radios
  const autoGen = document.getElementById("autoGenerate");
  if (autoGen) autoGen.checked = false;
  const activeRadio = document.getElementById("status_active");
  if (activeRadio) activeRadio.checked = true;

  // 🧩 Clear dataset values
  const triggerInput = document.getElementById("triggerModuleInput");
  if (triggerInput) {
    delete triggerInput.dataset.key;
    delete triggerInput.dataset.id;
  }

  // 🧾 Reset UI labels
  const titleEl = document.querySelector(".card-title");
  if (titleEl) titleEl.textContent = "Add Auto Billing Rule";
  const submitBtn = form?.querySelector("button[type=submit]");
  if (submitBtn)
    submitBtn.innerHTML = `<i class="ri-add-line me-1"></i> Add Rule`;
}

/* ============================================================
   🧭 Form Visibility Controls
============================================================ */
function showForm() {
  formContainer?.classList.remove("hidden");
  desktopAddBtn?.classList.add("hidden");
  localStorage.setItem("autoBillingRuleFormVisible", "true");
}

function hideForm() {
  resetForm();
  formContainer?.classList.add("hidden");
  desktopAddBtn?.classList.remove("hidden");
  localStorage.setItem("autoBillingRuleFormVisible", "false");
}

// 🌐 Expose globally for reuse by other handlers
window.showForm = showForm;
window.resetForm = resetForm;

/* ============================================================
   🔘 Button Bindings
============================================================ */
if (cancelBtn) {
  cancelBtn.onclick = () => {
    resetForm();
    window.location.href = "/autoBillingRules-list.html";
  };
}

if (clearBtn) clearBtn.onclick = resetForm;

if (desktopAddBtn) {
  desktopAddBtn.onclick = () => {
    // 🧹 Clean up stale edit data
    sessionStorage.removeItem("autoBillingRuleEditId");
    sessionStorage.removeItem("autoBillingRuleEditPayload");

    // Reset + show form for Add mode
    resetForm();
    showForm();
  };
}

/* ============================================================
   🧠 Loader Stub (Form-Only Mode)
============================================================ */
async function loadEntries() {
  return; // handled by list page
}

/* ============================================================
   🚀 Module Initializer
============================================================ */
export async function initAutoBillingRuleModule() {
  // Restore last visibility state
  const visible = localStorage.getItem("autoBillingRuleFormVisible") === "true";
  if (visible) showForm();
  else hideForm();

  // Initialize form logic
  if (form) {
    setupAutoBillingRuleFormSubmission({
      form,
      token,
      sharedState,
      resetForm,
      loadEntries,
    });
  }

  // Hide list panel when form-only mode is active
  localStorage.setItem("autoBillingRulePanelVisible", "false");

  /* --------------------- Role Normalization --------------------- */
  let roleRaw = localStorage.getItem("userRole") || "staff";
  let role = roleRaw.trim().toLowerCase();

  if (role.includes("super") && role.includes("admin")) role = "superadmin";
  else if (role.includes("admin")) role = "admin";
  else role = "staff";

  /* --------------------- Field Selector Setup --------------------- */
  setupFieldSelector({
    module: "auto_billing_rule",
    fieldLabels: FIELD_LABELS_AUTO_BILLING_RULE,
    fieldOrder: FIELD_ORDER_AUTO_BILLING_RULE,
    defaultFields: FIELD_DEFAULTS_AUTO_BILLING_RULE[role],
  });
}

/* ============================================================
   🔁 Sync Helper (Reserved for Future Reactive Updates)
============================================================ */
export function syncRefsToState() {
  // Reserved for enterprise-level reactive form syncing
}
