// 📦 insurance-claim-main.js – Form-only loader for Insurance Claim (Enterprise Master Pattern)
// ============================================================================
// 🧭 FULL MASTER PARITY WITH payment-main.js
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

import { setupInsuranceClaimFormSubmission } from "./insurance-claim-form.js";

import {
  FIELD_LABELS_INSURANCE_CLAIM,
  FIELD_ORDER_INSURANCE_CLAIM,
  FIELD_DEFAULTS_INSURANCE_CLAIM,
} from "./insurance-claim-constants.js";

import { setupFieldSelector } from "../../utils/ui-utils.js";

/* ============================================================
   🔐 Auth Guard + Shared State
============================================================ */
const token = initPageGuard(
  autoPagePermissionKey(["insurance_claims:create", "insurance_claims:edit"])
);
initLogoutWatcher();

const sharedState = {
  currentEditIdRef: { value: null },
};

/* ============================================================
   📎 DOM Refs
============================================================ */
const form = document.getElementById("insuranceClaimForm");
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
  sessionStorage.removeItem("insuranceClaimEditId");

  // Clear text inputs
  [
    "patientInput",
    "providerInput",
    "claimNumber",
    "amountClaimed",
    "amountApproved",
    "amountPaid",
    "paymentReference",
    "rejectionReason",
    "notes",
  ].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });

  // Clear dropdowns
  ["organizationSelect", "facilitySelect", "invoiceSelect"].forEach(
    (id) => {
      const el = document.getElementById(id);
      if (el) el.value = "";
    }
  );

  // Clear hidden IDs
  ["patientId", "providerId"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });
}

/* ============================================================
   🧭 Form Show / Hide
============================================================ */
function showForm() {
  formContainer?.classList.remove("hidden");
  desktopAddBtn?.classList.add("hidden");
  localStorage.setItem("insuranceClaimFormVisible", "true");
}

function hideForm() {
  resetForm();
  formContainer?.classList.add("hidden");
  desktopAddBtn?.classList.remove("hidden");
  localStorage.setItem("insuranceClaimFormVisible", "false");
}

// 🔗 Expose globally
window.showForm = showForm;
window.resetForm = resetForm;

/* ============================================================
   🔘 Button Wiring
============================================================ */
if (cancelBtn) {
  cancelBtn.onclick = () => {
    resetForm();
    window.location.href = "/insurance-claims-list.html";
  };
}

if (clearBtn) clearBtn.onclick = resetForm;

if (desktopAddBtn) {
  desktopAddBtn.onclick = () => {
    sessionStorage.removeItem("insuranceClaimEditId");
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
   🚀 Init Entrypoint
============================================================ */
export async function initInsuranceClaimModule() {
  showForm();

  if (form) {
    setupInsuranceClaimFormSubmission({
      form,
      token,
      sharedState,
      resetForm,
      loadEntries,
    });
  }

  localStorage.setItem("insuranceClaimPanelVisible", "false");

  // Normalize role
  let roleRaw = localStorage.getItem("userRole") || "staff";
  let role = roleRaw.trim().toLowerCase();

  if (role.includes("super") && role.includes("admin")) role = "superadmin";
  else if (role.includes("admin")) role = "admin";
  else role = "staff";

  setupFieldSelector({
    module: "insurance_claim",
    fieldLabels: FIELD_LABELS_INSURANCE_CLAIM,
    fieldOrder: FIELD_ORDER_INSURANCE_CLAIM,
    defaultFields:
      FIELD_DEFAULTS_INSURANCE_CLAIM[role] ||
      FIELD_DEFAULTS_INSURANCE_CLAIM.staff,
  });
}

/* ============================================================
   🔁 Sync Stub
============================================================ */
export function syncRefsToState() {
  // reserved for future reactive syncing
}