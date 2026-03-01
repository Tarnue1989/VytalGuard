// 📦 labrequest-main.js – Form-only loader for Lab Requests (ENTERPRISE MASTER PARITY)
// ============================================================================
// 🧭 FULL MASTER PARITY WITH consultation-main.js
// 🔹 Auth guard + logout watcher
// 🔹 Unified form visibility and reset logic
// 🔹 Session-safe edit caching
// 🔹 Field selector integration (role-aware)
// 🔹 Pill state preserved (handled by form module)
// 🔹 100% ID-safe and controller-aligned
// ============================================================================

/* ============================================================
   🔒 PREVENT BFCACHE RESTORE (ROOT FIX)
   Ensures form never reopens with stale data after navigation
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

import { setupLabRequestFormSubmission } from "./lab-request-form.js";

import {
  FIELD_LABELS_LAB_REQUEST,
  FIELD_ORDER_LAB_REQUEST,
  FIELD_DEFAULTS_LAB_REQUEST,
} from "./lab-request-constants.js";

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
const form = document.getElementById("labRequestForm");
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

  sessionStorage.removeItem("labRequestEditId");
  sessionStorage.removeItem("labRequestEditPayload");

  ["notes", "request_date", "itemNotes"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });

  ["organizationSelect", "facilitySelect", "departmentSelect"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });

  [
    "patientSearch",
    "doctorSearch",
    "consultationSearch",
    "registrationLogSearch",
    "labTestSearch",
  ].forEach((id) => {
    const el = document.getElementById(id);
    if (el) {
      el.value = "";
      el.dataset.value = "";
    }
  });

  const emergencyCheck = document.getElementById("is_emergency");
  if (emergencyCheck) emergencyCheck.checked = false;
}

/* ============================================================
   🧭 Form Show / Hide (MASTER)
============================================================ */
function showForm() {
  formContainer?.classList.remove("hidden");
  desktopAddBtn?.classList.add("hidden");
  localStorage.setItem("labRequestFormVisible", "true");
}

function hideForm() {
  resetForm();
  formContainer?.classList.add("hidden");
  desktopAddBtn?.classList.remove("hidden");
  localStorage.setItem("labRequestFormVisible", "false");
}

window.showForm = showForm;
window.resetForm = resetForm;

/* ============================================================
   🔘 Button Wiring (MASTER)
============================================================ */
if (cancelBtn) {
  cancelBtn.onclick = () => {
    resetForm();
    window.location.href = "/lab-requests-list.html";
  };
}

if (clearBtn) {
  clearBtn.onclick = () => {
    resetForm();
  };
}

if (desktopAddBtn) {
  desktopAddBtn.onclick = () => {
    sessionStorage.removeItem("labRequestEditId");
    sessionStorage.removeItem("labRequestEditPayload");
    resetForm();
    showForm();
  };
}

/* ============================================================
   📦 Loader Placeholder
============================================================ */
async function loadEntries() {
  return;
}

/* ============================================================
   🚀 Init Entrypoint (MASTER SAFE)
============================================================ */
export async function initLabRequestModule() {

  /* ============================================================
     🔒 MODE DETERMINED STRICTLY BY URL
  ============================================================ */
  const urlParams = new URLSearchParams(window.location.search);
  const editIdFromUrl = urlParams.get("id");

  sharedState.currentEditIdRef.value = editIdFromUrl || null;

  if (!editIdFromUrl) {
    sessionStorage.removeItem("labRequestEditId");
    sessionStorage.removeItem("labRequestEditPayload");
  }

  showForm();

  if (form) {
    setupLabRequestFormSubmission({
      form,
      token,
      sharedState,
      resetForm,
      loadEntries,
    });
  }

  localStorage.setItem("labRequestPanelVisible", "false");

  /* ============================================================
     🎛 Normalize role for field defaults
  ============================================================ */
  let roleRaw = localStorage.getItem("userRole") || "staff";
  let role = roleRaw.trim().toLowerCase();

  if (role.includes("super") && role.includes("admin")) role = "superadmin";
  else if (role.includes("admin")) role = "admin";
  else role = "staff";

  setupFieldSelector({
    module: "lab_request",
    fieldLabels: FIELD_LABELS_LAB_REQUEST,
    fieldOrder: FIELD_ORDER_LAB_REQUEST,
    defaultFields: FIELD_DEFAULTS_LAB_REQUEST[role],
  });
}

/* ============================================================
   🔁 Sync Stub
============================================================ */
export function syncRefsToState() {
  // reserved
}