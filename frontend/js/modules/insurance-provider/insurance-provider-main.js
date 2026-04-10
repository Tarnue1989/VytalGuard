// 📦 insurance-provider-main.js – Form-only loader (INSURANCE PROVIDER | Enterprise Master)
// ============================================================================
// 🔹 Converted from role-main.js (MASTER PARITY)
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

import { setupInsuranceProviderFormSubmission } from "./insurance-provider-form.js";

import {
  FIELD_LABELS_INSURANCE_PROVIDER,
  FIELD_ORDER_INSURANCE_PROVIDER,
  FIELD_DEFAULTS_INSURANCE_PROVIDER,
} from "./insurance-provider-constants.js";

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
const form = document.getElementById("insuranceProviderForm");
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

  sessionStorage.removeItem("insuranceProviderEditId");
  sessionStorage.removeItem("insuranceProviderEditPayload");

  ["name", "contact_info", "address", "phone", "email"].forEach(id => {
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
  localStorage.setItem("insuranceProviderFormVisible", "true");
}

function hideForm() {
  resetForm();
  formContainer?.classList.add("hidden");
  desktopAddBtn?.classList.remove("hidden");
  localStorage.setItem("insuranceProviderFormVisible", "false");
}

// 🔗 expose
window.showForm = showForm;
window.resetForm = resetForm;

/* ============================================================
   🔘 Buttons
============================================================ */
cancelBtn &&
  (cancelBtn.onclick = () => {
    resetForm();
    window.location.href = "/insurance-providers-list.html";
  });

clearBtn && (clearBtn.onclick = resetForm);

desktopAddBtn &&
  (desktopAddBtn.onclick = () => {
    sessionStorage.removeItem("insuranceProviderEditId");
    sessionStorage.removeItem("insuranceProviderEditPayload");
    resetForm();
    showForm();
  });

/* ============================================================
   📦 Loader Stub
============================================================ */
async function loadEntries() {
  return;
}

/* ============================================================
   🚀 INIT
============================================================ */
export async function initInsuranceProviderModule() {
  localStorage.getItem("insuranceProviderFormVisible") === "true"
    ? showForm()
    : hideForm();

  form &&
    setupInsuranceProviderFormSubmission({
      form,
      token,
      sharedState,
      resetForm,
      loadEntries,
    });

  localStorage.setItem("insuranceProviderPanelVisible", "false");

  /* -------- Normalize role -------- */
  let roleRaw = localStorage.getItem("userRole") || "staff";
  let role = roleRaw.trim().toLowerCase();

  if (role.includes("super") && role.includes("admin")) role = "superadmin";
  else if (role.includes("admin")) role = "admin";
  else role = "staff";

  setupFieldSelector({
    module: "insurance_provider",
    fieldLabels: FIELD_LABELS_INSURANCE_PROVIDER,
    fieldOrder: FIELD_ORDER_INSURANCE_PROVIDER,
    defaultFields: FIELD_DEFAULTS_INSURANCE_PROVIDER[role],
  });
}

/* ============================================================
   (Optional)
============================================================ */
export function syncRefsToState() {}