// 📦 add-autoBillingRule.js – ENTERPRISE MASTER ORCHESTRATOR (FINAL)
// ============================================================================
// ✔ PURE orchestration
// ✔ Delegates ALL logic to form
// ✔ Pills reset FIXED (role-style, no globals)
// ✔ MASTER aligned
// ============================================================================

import {
  setupAutoBillingRuleFormSubmission,
  getAutoBillingFormState, // ✅ NEW
} from "./autoBillingRule-form.js";

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
   🌐 Shared State
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
   🧠 FORM STATE (🔥 SAME AS ROLE MODULE)
============================================================ */
const { resetPills } = getAutoBillingFormState();

/* ============================================================
   🧹 FULL RESET (FINAL)
============================================================ */
function resetForm() {
  if (!form) return;

  // 1. Reset native form
  form.reset();

  // 2. Clear session
  sessionStorage.removeItem("autoBillingRuleEditId");
  sessionStorage.removeItem("autoBillingRuleEditPayload");

  // 3. Reset shared state
  sharedState.currentEditIdRef.value = null;

  // 4. 🔥 RESET PILLS (CORRECT WAY)
  resetPills();

  // 5. Reset pills UI fallback
  const pills = document.getElementById("billablePillsContainer");
  if (pills) {
    pills.innerHTML =
      `<p class="text-muted">No billable items added yet.</p>`;
  }

  // 6. Reset category + search
  const category = document.getElementById("categorySelect");
  if (category) category.value = "";

  const search = document.getElementById("billableSearch");
  if (search) search.value = "";

  // 7. Reset trigger
  const trigger = document.getElementById("triggerModuleInput");
  if (trigger) {
    trigger.value = "";
    delete trigger.dataset.key;
    delete trigger.dataset.id;
  }

  // 8. Reset selects
  [
    "organizationSelect",
    "facilitySelect",
    "featureModuleSelect",
  ].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });

  // 9. Reset numeric + checkbox
  const price = document.getElementById("defaultPrice");
  if (price) price.value = "";

  const autoGen = document.getElementById("autoGenerate");
  if (autoGen) autoGen.checked = false;

  // 10. Reset UI text
  const titleEl = document.querySelector(".card-title");
  if (titleEl) titleEl.textContent = "Add Auto Billing Rule";

  const submitBtn = form.querySelector("button[type=submit]");
  if (submitBtn) {
    submitBtn.innerHTML = `<i class="ri-add-line me-1"></i> Add Rule`;
  }
}

/* ============================================================
   🚀 Init
============================================================ */
document.addEventListener("DOMContentLoaded", () => {
  if (!form) return;

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
   🔁 Reserved Hook
============================================================ */
export function syncRefsToState() {
  // future
}