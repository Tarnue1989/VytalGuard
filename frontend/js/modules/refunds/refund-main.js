// 📦 refund-main.js – Enterprise MASTER–ALIGNED (Form-Only Loader)
// ============================================================================
// 🧭 FULL MASTER PARITY WITH refund-deposits-main.js / deposit-main.js
// 🔹 Auth guard + logout watcher
// 🔹 Unified form visibility + reset lifecycle
// 🔹 Session-safe edit caching
// 🔹 Field selector integration (role-aware)
// 🔹 Refund-specific wiring (NO API changes, NO ID changes)
// ============================================================================

import {
  initPageGuard,
  autoPagePermissionKey,
  initLogoutWatcher,
} from "../../utils/index.js";

import { setupRefundFormSubmission } from "./refund-form.js";

import {
  FIELD_LABELS_REFUND,
  FIELD_ORDER_REFUND,
  FIELD_DEFAULTS_REFUND,
} from "./refund-constants.js";

import { setupFieldSelector } from "../../utils/ui-utils.js";

/* ============================================================
   🔐 Auth Guard + Session
============================================================ */
const token = initPageGuard(
  autoPagePermissionKey(["refunds:create", "refunds:edit"])
);
initLogoutWatcher();

/* ============================================================
   🧠 Shared State
============================================================ */
const sharedState = {
  currentEditIdRef: { value: null },
};

/* ============================================================
   📎 DOM Refs (ID-SAFE)
============================================================ */
const form = document.getElementById("refundForm");
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
  sessionStorage.removeItem("refundEditId");
  sessionStorage.removeItem("refundEditPayload");

  // Clear visible inputs
  ["patientInput", "amount", "reason"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });

  // Clear hidden IDs
  ["patientId", "invoiceId"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });

  // Clear dropdowns
  ["organizationSelect", "facilitySelect", "methodSelect", "paymentSelect"].forEach(
    (id) => {
      const el = document.getElementById(id);
      if (el) el.value = "";
    }
  );

  // Reset max constraint (refund balance safety)
  const amt = document.getElementById("amount");
  if (amt) amt.removeAttribute("max");
}

/* ============================================================
   🧭 Form Visibility (MASTER)
============================================================ */
function showForm() {
  formContainer?.classList.remove("hidden");
  desktopAddBtn?.classList.add("hidden");
  localStorage.setItem("refundFormVisible", "true");
}

function hideForm() {
  resetForm();
  formContainer?.classList.add("hidden");
  desktopAddBtn?.classList.remove("hidden");
  localStorage.setItem("refundFormVisible", "false");
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
    window.location.href = "/refunds-list.html";
  };
}

if (clearBtn) {
  clearBtn.onclick = resetForm;
}

if (desktopAddBtn) {
  desktopAddBtn.onclick = () => {
    sessionStorage.removeItem("refundEditId");
    sessionStorage.removeItem("refundEditPayload");
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
export async function initRefundModule() {
  showForm(); // form-only mode (MASTER parity)

  if (form) {
    setupRefundFormSubmission({
      form,
      token,
      sharedState,
      resetForm,
      loadEntries,
    });
  }

  localStorage.setItem("refundPanelVisible", "false");

  // Normalize role for field defaults
  let roleRaw = localStorage.getItem("userRole") || "staff";
  let role = roleRaw.trim().toLowerCase();

  if (role.includes("super") && role.includes("admin")) role = "superadmin";
  else if (role.includes("admin")) role = "admin";
  else role = "staff";

  setupFieldSelector({
    module: "refund",
    fieldLabels: FIELD_LABELS_REFUND,
    fieldOrder: FIELD_ORDER_REFUND,
    defaultFields:
      FIELD_DEFAULTS_REFUND[role] || FIELD_DEFAULTS_REFUND.staff,
  });
}

/* ============================================================
   🔁 Sync Stub
============================================================ */
export function syncRefsToState() {
  // reserved for future reactive syncing
}
