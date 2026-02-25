// 📦 discount-waiver-main.js – Form-only Loader (ENTERPRISE MASTER PARITY)
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
  showToast,
} from "../../utils/index.js";

import { setupDiscountWaiverFormSubmission } from "./discount-waiver-form.js";

import {
  FIELD_LABELS_DISCOUNT_WAIVER,
  FIELD_ORDER_DISCOUNT_WAIVER,
  FIELD_DEFAULTS_DISCOUNT_WAIVER,
} from "./discount-waiver-constants.js";

import { setupFieldSelector } from "../../utils/ui-utils.js";

/* ============================================================
   🔐 Auth Guard + Shared State
============================================================ */
const token = initPageGuard(
  autoPagePermissionKey(["discount-waivers:create", "discount-waivers:edit"])
);
initLogoutWatcher();

const sharedState = {
  currentEditIdRef: { value: null },
};

/* ============================================================
   📎 DOM Refs
============================================================ */
const form = document.getElementById("discountWaiverForm");
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
  sessionStorage.removeItem("discountWaiverEditId");
  sessionStorage.removeItem("discountWaiverEditPayload");

  // Clear visible inputs
  [
    "invoiceInput",
    "percentage",
    "amount",
    "appliedTotal",
    "reason",
  ].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });

  // Clear hidden IDs
  ["invoiceId", "patientId"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });

  // Reset type selector
  const typeSelect = document.getElementById("typeSelect");
  if (typeSelect) typeSelect.value = "";

  // Hide conditional groups
  document.getElementById("percentageGroup")?.classList.add("hidden");
  document.getElementById("amountGroup")?.classList.add("hidden");
}

/* ============================================================
   🧭 Form Show / Hide
============================================================ */
function showForm() {
  formContainer?.classList.remove("hidden");
  desktopAddBtn?.classList.add("hidden");
  localStorage.setItem("discountWaiverFormVisible", "true");
}

function hideForm() {
  resetForm();
  formContainer?.classList.add("hidden");
  desktopAddBtn?.classList.remove("hidden");
  localStorage.setItem("discountWaiverFormVisible", "false");
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
    window.location.href = "/discount-waivers-list.html";
  };
}

if (clearBtn) clearBtn.onclick = resetForm;

if (desktopAddBtn) {
  desktopAddBtn.onclick = () => {
    sessionStorage.removeItem("discountWaiverEditId");
    sessionStorage.removeItem("discountWaiverEditPayload");
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
export async function initDiscountWaiverModule() {
  showForm(); // form-only mode (MASTER parity)

  if (form) {
    setupDiscountWaiverFormSubmission({
      form,
      token,
      sharedState,
      resetForm,
      loadEntries,
    });
  }

  localStorage.setItem("discountWaiverPanelVisible", "false");

  // Normalize role for field defaults
  let roleRaw = localStorage.getItem("userRole") || "staff";
  let role = roleRaw.trim().toLowerCase();

  if (role.includes("super") && role.includes("admin")) role = "superadmin";
  else if (role.includes("admin")) role = "admin";
  else if (role.includes("manager")) role = "manager";
  else role = "staff";

  setupFieldSelector({
    module: "discount-waiver",
    fieldLabels: FIELD_LABELS_DISCOUNT_WAIVER,
    fieldOrder: FIELD_ORDER_DISCOUNT_WAIVER,
    defaultFields:
      FIELD_DEFAULTS_DISCOUNT_WAIVER[role] ||
      FIELD_DEFAULTS_DISCOUNT_WAIVER.staff,
  });
}

/* ============================================================
   🔁 Sync Stub
============================================================ */
export function syncRefsToState() {
  // reserved for future reactive syncing
}
