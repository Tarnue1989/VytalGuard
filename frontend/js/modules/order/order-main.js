// 📦 order-module.js – Form-only loader for Orders (ENTERPRISE MASTER PARITY)
// ============================================================================
// 🧭 Lab Request → Order Adaptation (FULL MASTER PARITY)
// 🔹 Auth guard + logout watcher
// 🔹 Form visibility + reset logic
// 🔹 Session-safe edit handling
// 🔹 Field selector integration
// 🔹 Pill state handled in form module
// ============================================================================

/* ============================================================
   🔒 PREVENT BFCACHE RESTORE
============================================================ */
window.addEventListener("pageshow", function (event) {
  if (event.persisted) {
    window.location.reload();
  }
});

import {
  initPageGuard,
  autoPagePermissionKey,
  initLogoutWatcher,
} from "../../utils/index.js";

import { setupOrderFormSubmission } from "./order-form.js";

import {
  FIELD_LABELS_ORDER,
  FIELD_ORDER_ORDER,
  FIELD_DEFAULTS_ORDER,
} from "./order-constants.js";

import { setupFieldSelector } from "../../utils/ui-utils.js";

/* ============================================================
   🔐 Auth
============================================================ */
const token = initPageGuard(autoPagePermissionKey());
initLogoutWatcher();

const sharedState = {
  currentEditIdRef: { value: null },
};

/* ============================================================
   📎 DOM
============================================================ */
const form = document.getElementById("orderForm");
const formContainer = document.getElementById("formContainer");
const desktopAddBtn = document.getElementById("desktopAddBtn");
const cancelBtn = document.getElementById("cancelBtn");
const clearBtn = document.getElementById("clearBtn");

/* ============================================================
   🧹 RESET
============================================================ */
function resetForm() {
  sharedState.currentEditIdRef.value = null;

  if (form) form.reset();

  sessionStorage.removeItem("orderEditId");
  sessionStorage.removeItem("orderEditPayload");

  ["notes", "order_date", "itemNotes"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });

  ["organizationSelect", "facilitySelect", "departmentSelect"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });

  [
    "patientSearch",
    "providerSearch",
    "consultationSearch",
    "registrationLogSearch",
    "orderItemSearch",
  ].forEach((id) => {
    const el = document.getElementById(id);
    if (el) {
      el.value = "";
      el.dataset.value = "";
    }
  });
}

/* ============================================================
   🧭 FORM VISIBILITY
============================================================ */
function showForm() {
  formContainer?.classList.remove("hidden");
  desktopAddBtn?.classList.add("hidden");
  localStorage.setItem("orderFormVisible", "true");
}

function hideForm() {
  resetForm();
  formContainer?.classList.add("hidden");
  desktopAddBtn?.classList.remove("hidden");
  localStorage.setItem("orderFormVisible", "false");
}

window.showForm = showForm;
window.resetForm = resetForm;

/* ============================================================
   🔘 BUTTONS
============================================================ */
cancelBtn && (cancelBtn.onclick = () => {
  resetForm();
  window.location.href = "/orders-list.html";
});

clearBtn && (clearBtn.onclick = () => {
  resetForm();
});

desktopAddBtn && (desktopAddBtn.onclick = () => {
  sessionStorage.removeItem("orderEditId");
  sessionStorage.removeItem("orderEditPayload");
  resetForm();
  showForm();
});

/* ============================================================
   🚀 INIT
============================================================ */
export async function initOrderModule() {

  const urlParams = new URLSearchParams(window.location.search);
  const editIdFromUrl = urlParams.get("id");

  sharedState.currentEditIdRef.value = editIdFromUrl || null;

  if (!editIdFromUrl) {
    sessionStorage.removeItem("orderEditId");
    sessionStorage.removeItem("orderEditPayload");
  }

  showForm();

  if (form) {
    setupOrderFormSubmission({
      form,
      token,
      sharedState,
      resetForm,
    });
  }

  localStorage.setItem("orderPanelVisible", "false");

  /* ============================================================
     🎛 ROLE NORMALIZATION
  ============================================================ */
  let roleRaw = localStorage.getItem("userRole") || "staff";
  let role = roleRaw.trim().toLowerCase();

  if (role.includes("super") && role.includes("admin")) role = "superadmin";
  else if (role.includes("admin")) role = "admin";
  else role = "staff";

  setupFieldSelector({
    module: "order",
    fieldLabels: FIELD_LABELS_ORDER,
    fieldOrder: FIELD_ORDER_ORDER,
    defaultFields: FIELD_DEFAULTS_ORDER[role],
  });
}

/* ============================================================
   🔁 STUB
============================================================ */
export function syncRefsToState() {}