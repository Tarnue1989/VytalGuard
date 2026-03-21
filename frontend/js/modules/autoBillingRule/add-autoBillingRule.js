// 📦 add-autoBillingRule.js – ENTERPRISE MASTER ORCHESTRATOR (UPGRADED)
// ============================================================================
// 🧭 FULL ALIGNMENT with add-registration-log.js MASTER
// 🔹 Pure orchestration layer (NO loaders, NO API, NO RBAC here)
// 🔹 Delegates ALL logic to autoBillingRule-form.js
// 🔹 Handles reset + session coordination only
// 🔹 Clean, scalable, enterprise-ready
// ============================================================================

import { setupAutoBillingRuleFormSubmission } from "./autoBillingRule-form.js";

import {
  initPageGuard,
  initLogoutWatcher,
  autoPagePermissionKey,
} from "../../utils/index.js";

/* ============================================================
   🔐 Auth Guard + Global Watchers
============================================================ */
const token = initPageGuard(
  autoPagePermissionKey([
    "auto_billing_rule:create",
    "auto_billing_rule:edit",
  ])
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
const form = document.getElementById("autoBillingRuleForm");
const cancelBtn = document.getElementById("cancelBtn");
const clearBtn = document.getElementById("clearBtn");

/* ============================================================
   🧹 Reset Helper (Add Mode)
============================================================ */
function resetForm() {
  if (!form) return;

  form.reset();
  sharedState.currentEditIdRef.value = null;

  // Clear edit session
  sessionStorage.removeItem("autoBillingRuleEditId");
  sessionStorage.removeItem("autoBillingRuleEditPayload");

  // Reset selects
  [
    "organizationSelect",
    "facilitySelect",
    "featureModuleSelect",
    "billableItemSelect",
  ].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });

  // Reset trigger module
  const triggerInput = document.getElementById("triggerModuleInput");
  if (triggerInput) {
    triggerInput.value = "";
    delete triggerInput.dataset.key;
    delete triggerInput.dataset.id;
  }

  // Reset inputs
  ["chargeMode", "defaultPrice"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });

  // Reset checkbox
  const autoGen = document.getElementById("autoGenerate");
  if (autoGen) autoGen.checked = false;

  // Reset UI
  const titleEl = document.querySelector(".card-title");
  if (titleEl) titleEl.textContent = "Add Auto Billing Rule";

  const submitBtn = form.querySelector("button[type=submit]");
  if (submitBtn)
    submitBtn.innerHTML =
      `<i class="ri-add-line me-1"></i> Add Rule`;
}

/* ============================================================
   🚀 Init (Page Entry)
============================================================ */
document.addEventListener("DOMContentLoaded", () => {
  if (!form) return;

  // 🔥 Delegate ALL business logic to form module
  setupAutoBillingRuleFormSubmission({
    form,
    token,
    sharedState,
    resetForm,
  });

  /* ---------------- Cancel ---------------- */
  cancelBtn?.addEventListener("click", () => {
    sessionStorage.removeItem("autoBillingRuleEditId");
    sessionStorage.removeItem("autoBillingRuleEditPayload");
    window.location.href = "/autoBillingRules-list.html";
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
  // Reserved for enterprise reactive syncing
}