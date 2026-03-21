// 📦 autoBillingRule-main.js – FULL ENTERPRISE MASTER ALIGNMENT (UPGRADED)
// ============================================================================
// 🧭 Mirrors registrationLog-main.js EXACTLY
// 🔹 Pure module orchestrator (NO API, NO validation, NO business logic)
// 🔹 Form visibility control + reset orchestration
// 🔹 Session-safe edit handling
// 🔹 Field selector (role-aware)
// 🔹 100% aligned with enterprise structure
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
   🔐 Auth Guard + Shared State
============================================================ */
const token = initPageGuard(
  autoPagePermissionKey([
    "auto_billing_rule:create",
    "auto_billing_rule:edit",
  ])
);
initLogoutWatcher();

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
   🧹 Reset Form Helper (MASTER PARITY)
============================================================ */
function resetForm() {
  sharedState.currentEditIdRef.value = null;

  if (form) form.reset();

  // Clear cached edit state
  sessionStorage.removeItem("autoBillingRuleEditId");
  sessionStorage.removeItem("autoBillingRuleEditPayload");

  // Clear visible inputs
  [
    "triggerModuleInput",
    "defaultPrice",
  ].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });

  // Clear dropdowns
  [
    "organizationSelect",
    "facilitySelect",
    "featureModuleSelect",
    "billableItemSelect",
    "chargeMode",
  ].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });

  // Clear dataset (trigger module)
  const triggerInput = document.getElementById("triggerModuleInput");
  if (triggerInput) {
    delete triggerInput.dataset.key;
    delete triggerInput.dataset.id;
  }

  // Reset checkbox
  const autoGen = document.getElementById("autoGenerate");
  if (autoGen) autoGen.checked = false;

  // Reset status radio
  const activeRadio = document.getElementById("status_active");
  if (activeRadio) activeRadio.checked = true;
}

/* ============================================================
   🧭 Form Show / Hide (MASTER PARITY)
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

// 🌐 Expose globally
window.showForm = showForm;
window.resetForm = resetForm;

/* ============================================================
   ⚙️ Button Wiring
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
    sessionStorage.removeItem("autoBillingRuleEditId");
    sessionStorage.removeItem("autoBillingRuleEditPayload");
    resetForm();
    showForm();
  };
}

/* ============================================================
   📦 Loader Placeholder (FORM-ONLY MODE)
============================================================ */
async function loadEntries() {
  return;
}

/* ============================================================
   🚀 Init Entrypoint (MASTER PARITY)
============================================================ */
export async function initAutoBillingRuleModule() {
  showForm(); // form-only mode (match registration log)

  if (form) {
    setupAutoBillingRuleFormSubmission({
      form,
      token,
      sharedState,
      resetForm,
      loadEntries,
    });
  }

  localStorage.setItem("autoBillingRulePanelVisible", "false");

  /* ---------------- Role Normalization ---------------- */
  let roleRaw = localStorage.getItem("userRole") || "staff";
  let role = roleRaw.trim().toLowerCase();

  if (role.includes("super") && role.includes("admin")) role = "superadmin";
  else if (role.includes("admin")) role = "admin";
  else role = "staff";

  /* ---------------- Field Selector ---------------- */
  setupFieldSelector({
    module: "auto_billing_rule",
    fieldLabels: FIELD_LABELS_AUTO_BILLING_RULE,
    fieldOrder: FIELD_ORDER_AUTO_BILLING_RULE,
    defaultFields:
      FIELD_DEFAULTS_AUTO_BILLING_RULE[role] ||
      FIELD_DEFAULTS_AUTO_BILLING_RULE.staff,
  });
}

/* ============================================================
   🔁 Sync Stub (Future)
============================================================ */
export function syncRefsToState() {
  // Reserved for enterprise reactive syncing
}