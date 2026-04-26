// 📦 currency-rate-main.js – Form-only loader for Currency Rate (Enterprise Master Pattern)
// ============================================================================
// 🧭 Mirrors role-main.js structure (1:1)
// 🔹 Auth guard + logout watcher
// 🔹 Unified form visibility + reset logic
// 🔹 Session-safe edit caching
// 🔹 Field selector integration
// ============================================================================

import {
  initPageGuard,
  autoPagePermissionKey,
  initLogoutWatcher,
} from "../../utils/index.js";

import { setupCurrencyRateFormSubmission } from "./currency-rate-form.js";

import {
  FIELD_LABELS_CURRENCY_RATE,
  FIELD_ORDER_CURRENCY_RATE,
  FIELD_DEFAULTS_CURRENCY_RATE,
} from "./currency-rate-constants.js";

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
   📎 DOM Refs
============================================================ */
const form = document.getElementById("currencyRateForm");
const formContainer = document.getElementById("formContainer");
const desktopAddBtn = document.getElementById("desktopAddBtn");
const cancelBtn = document.getElementById("cancelBtn");
const clearBtn = document.getElementById("clearBtn");

/* ============================================================
   🧹 Reset Form
============================================================ */
function resetForm() {
  sharedState.currentEditIdRef.value = null;
  form?.reset();

  sessionStorage.removeItem("currencyRateEditId");
  sessionStorage.removeItem("currencyRateEditPayload");

  ["from_currency", "to_currency", "rate", "effective_date"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });

  ["organizationSelect", "facilitySelect"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });

  document.getElementById("status_active")?.setAttribute("checked", true);
}

/* ============================================================
   🧭 Form Visibility
============================================================ */
function showForm() {
  formContainer?.classList.remove("hidden");
  desktopAddBtn?.classList.add("hidden");
  localStorage.setItem("currencyRateFormVisible", "true");
}

function hideForm() {
  resetForm();
  formContainer?.classList.add("hidden");
  desktopAddBtn?.classList.remove("hidden");
  localStorage.setItem("currencyRateFormVisible", "false");
}

// 🔗 Expose for action handlers
window.showForm = showForm;
window.resetForm = resetForm;

/* ============================================================
   🔘 Button Wiring
============================================================ */
cancelBtn &&
  (cancelBtn.onclick = () => {
    resetForm();
    window.location.href = "/currency-rates-list.html";
  });

clearBtn && (clearBtn.onclick = resetForm);

desktopAddBtn &&
  (desktopAddBtn.onclick = () => {
    sessionStorage.removeItem("currencyRateEditId");
    sessionStorage.removeItem("currencyRateEditPayload");
    resetForm();
    showForm();
  });

/* ============================================================
   📦 Loader Placeholder
============================================================ */
async function loadEntries() {
  return;
}

/* ============================================================
   🚀 Init Entrypoint
============================================================ */
export async function initCurrencyRateModule() {
  localStorage.getItem("currencyRateFormVisible") === "true"
    ? showForm()
    : hideForm();

  form &&
    setupCurrencyRateFormSubmission({
      form,
      token,
      sharedState,
      resetForm,
      loadEntries,
    });

  localStorage.setItem("currencyRatePanelVisible", "false");

  /* -------- Normalize user role -------- */
  let roleRaw = localStorage.getItem("userRole") || "staff";
  let role = roleRaw.trim().toLowerCase();

  if (role.includes("super") && role.includes("admin")) role = "superadmin";
  else if (role.includes("admin")) role = "admin";
  else role = "staff";

  setupFieldSelector({
    module: "currency_rates",
    fieldLabels: FIELD_LABELS_CURRENCY_RATE,
    fieldOrder: FIELD_ORDER_CURRENCY_RATE,
    defaultFields: FIELD_DEFAULTS_CURRENCY_RATE[role],
  });
}

/* ============================================================
   (Optional) Sync Stub
============================================================ */
export function syncRefsToState() {}