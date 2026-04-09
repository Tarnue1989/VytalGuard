// 📦 add-insurance-claim.js – Insurance Claim Form Page Controller (Enterprise Master Pattern)
// ============================================================================
// 🧭 Mirrors add-payment.js / add-deposit.js EXACTLY
// 🔹 Auth guard + logout watcher
// 🔹 Form reset orchestration
// 🔹 Edit session coordination
// 🔹 Delegates ALL business logic to insurance-claim-form.js
// 🔹 NO data loaders, NO API calls, NO RBAC branching here
// ============================================================================

import { setupInsuranceClaimFormSubmission } from "./insurance-claims-form.js";

import {
  initPageGuard,
  initLogoutWatcher,
  autoPagePermissionKey,
} from "../../utils/index.js";

/* ============================================================
   🔐 Auth Guard + Global Watchers
============================================================ */
const token = initPageGuard(
  autoPagePermissionKey(["insurance_claims:create", "insurance_claims:edit"])
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
const form = document.getElementById("insuranceClaimForm");
const cancelBtn = document.getElementById("cancelBtn");
const clearBtn = document.getElementById("clearBtn");

/* ============================================================
   🧹 Reset Helper (Add Mode)
============================================================ */
function resetForm() {
  if (!form) return;

  form.reset();
  sharedState.currentEditIdRef.value = null;

  // Clear cached edit state
  sessionStorage.removeItem("insuranceClaimEditId");

  // Clear hidden IDs
  ["patientId", "providerId"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });

  // Clear selects
  ["organizationSelect", "facilitySelect", "invoiceSelect"].forEach(
    (id) => {
      const el = document.getElementById(id);
      if (el) el.value = "";
    }
  );

  // Reset UI labels
  const titleEl = document.querySelector(".card-title");
  if (titleEl) titleEl.textContent = "Add Insurance Claim";

  const submitBtn = form.querySelector("button[type=submit]");
  if (submitBtn)
    submitBtn.innerHTML = `<i class="ri-add-line me-1"></i> Add Insurance Claim`;
}

/* ============================================================
   🚀 Init (Page Entry)
============================================================ */
document.addEventListener("DOMContentLoaded", () => {
  if (!form) return;

  // Wire form logic (ALL business logic lives there)
  setupInsuranceClaimFormSubmission({
    form,
    token,
    sharedState,
    resetForm,
  });

  /* ---------------- Cancel ---------------- */
  cancelBtn?.addEventListener("click", () => {
    sessionStorage.removeItem("insuranceClaimEditId");
    window.location.href = "/insurance-claims-list.html";
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
  // Reserved for enterprise reactive form syncing
}