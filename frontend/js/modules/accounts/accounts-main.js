// 📦 account-main.js – Form-only loader for Accounts (LIGHT MASTER)
// ============================================================================
// 🧭 Based on deposit-main.js (simplified for Accounts)
// 🔹 Auth guard + logout watcher
// 🔹 Form visibility + reset logic
// 🔹 Session-safe edit handling
// 🔹 Field selector (light)
// ============================================================================

import {
  initPageGuard,
  autoPagePermissionKey,
  initLogoutWatcher,
} from "../../utils/index.js";

import { setupAccountFormSubmission } from "./account-form.js";

import {
  FIELD_LABELS_ACCOUNT,
  FIELD_ORDER_ACCOUNT,
  FIELD_DEFAULTS_ACCOUNT,
} from "./accounts-constants.js";

import { setupFieldSelector } from "../../utils/ui-utils.js";

/* ============================================================
   🔐 AUTH
============================================================ */
const token = initPageGuard(autoPagePermissionKey());
initLogoutWatcher();

const sharedState = {
  currentEditIdRef: { value: null },
};

/* ============================================================
   📎 DOM
============================================================ */
const form = document.getElementById("accountForm");
const formContainer = document.getElementById("formContainer");
const desktopAddBtn = document.getElementById("desktopAddBtn");
const cancelBtn = document.getElementById("cancelBtn");
const clearBtn = document.getElementById("clearBtn");

/* ============================================================
   🧹 RESET FORM
============================================================ */
function resetForm() {
  sharedState.currentEditIdRef.value = null;
  if (form) form.reset();

  sessionStorage.removeItem("accountEditId");
  sessionStorage.removeItem("accountEditPayload");

  ["organizationSelect", "facilitySelect"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });
}

/* ============================================================
   🧭 SHOW / HIDE FORM
============================================================ */
function showForm() {
  formContainer?.classList.remove("hidden");
  desktopAddBtn?.classList.add("hidden");
  localStorage.setItem("accountFormVisible", "true");
}

function hideForm() {
  resetForm();
  formContainer?.classList.add("hidden");
  desktopAddBtn?.classList.remove("hidden");
  localStorage.setItem("accountFormVisible", "false");
}

window.showForm = showForm;
window.resetForm = resetForm;

/* ============================================================
   🔘 BUTTONS
============================================================ */
if (cancelBtn) {
  cancelBtn.onclick = () => {
    resetForm();
    window.location.href = "/accounts-list.html";
  };
}

if (clearBtn) clearBtn.onclick = resetForm;

if (desktopAddBtn) {
  desktopAddBtn.onclick = () => {
    sessionStorage.removeItem("accountEditId");
    sessionStorage.removeItem("accountEditPayload");
    resetForm();
    showForm();
  };
}

/* ============================================================
   🚀 INIT
============================================================ */
export async function initAccountModule() {
  showForm();

  if (form) {
    setupAccountFormSubmission({
      form,
      token,
      sharedState,
      resetForm,
    });
  }

  // Normalize role
  let roleRaw = localStorage.getItem("userRole") || "staff";
  let role = roleRaw.trim().toLowerCase();

  if (role.includes("super") && role.includes("admin")) role = "superadmin";
  else if (role.includes("admin")) role = "admin";
  else role = "staff";

  setupFieldSelector({
    module: "accounts",
    fieldLabels: FIELD_LABELS_ACCOUNT,
    fieldOrder: FIELD_ORDER_ACCOUNT,
    defaultFields: FIELD_DEFAULTS_ACCOUNT[role],
  });
}

/* ============================================================
   🔁 SYNC
============================================================ */
export function syncRefsToState() {
  // reserved
}