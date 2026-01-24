// 📦 triage-record-main.js – Form-only Loader for Triage Record (ENTERPRISE MASTER PARITY)
// ============================================================================
// 🧭 Mirrors vital-main.js / ekg-record-main.js / registrationLog-main.js
// 🔹 Auth guard + logout watcher
// 🔹 Unified form visibility and reset logic
// 🔹 Session-safe edit caching
// 🔹 Field selector integration (role-aware)
// 🔹 100% ID-safe and controller-aligned
// ============================================================================

import {
  initPageGuard,
  initLogoutWatcher,
  autoPagePermissionKey,
} from "../../utils/index.js";

import { setupTriageRecordFormSubmission } from "./triage-record-form.js";

import {
  FIELD_LABELS_TRIAGE_RECORD,
  FIELD_ORDER_TRIAGE_RECORD,
  FIELD_DEFAULTS_TRIAGE_RECORD,
} from "./triage-record-constants.js";

import { setupFieldSelector } from "../../utils/ui-utils.js";

/* ============================================================
   🔐 Auth Guard + Shared State (MASTER PARITY)
============================================================ */
const token = initPageGuard(
  autoPagePermissionKey(["triage_records:create", "triage_records:edit"])
);
initLogoutWatcher();

const sharedState = {
  currentEditIdRef: { value: null },
};

/* ============================================================
   📎 DOM Refs
============================================================ */
const form = document.getElementById("triageRecordForm");
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
  sessionStorage.removeItem("triageRecordEditId");
  sessionStorage.removeItem("triageRecordEditPayload");

  // Clear visible inputs
  [
    "patientInput",
    "doctorInput",
    "nurseInput",
    "bp",
    "pulse",
    "rr",
    "temp",
    "oxygen",
    "weight",
    "height",
    "rbg",
    "painScore",
    "position",
    "symptoms",
    "triageNotes",
    "recordedAt",
  ].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });

  // Clear dropdowns
  [
    "organizationSelect",
    "facilitySelect",
    "triageTypeSelect",
    "registrationLogSelect",
  ].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });

  // Clear hidden IDs
  ["patientId", "doctorId", "nurseId"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });

  // Reset UI labels
  const titleEl = document.querySelector(".card-title");
  if (titleEl) titleEl.textContent = "Add Triage Record";

  const submitBtn = form?.querySelector("button[type=submit]");
  if (submitBtn)
    submitBtn.innerHTML =
      `<i class="ri-add-line me-1"></i> Add Triage Record`;
}

/* ============================================================
   🧭 Form Show / Hide (MASTER PARITY)
============================================================ */
function showForm() {
  formContainer?.classList.remove("hidden");
  desktopAddBtn?.classList.add("hidden");
  localStorage.setItem("triageRecordFormVisible", "true");
}

function hideForm() {
  resetForm();
  formContainer?.classList.add("hidden");
  desktopAddBtn?.classList.remove("hidden");
  localStorage.setItem("triageRecordFormVisible", "false");
}

// 🔗 Expose globally (actions / parity)
window.showForm = showForm;
window.resetForm = resetForm;

/* ============================================================
   ⚙️ Button Wiring
============================================================ */
if (cancelBtn) {
  cancelBtn.onclick = () => {
    resetForm();
    window.location.href = "/triage-records-list.html";
  };
}

if (clearBtn) clearBtn.onclick = resetForm;

if (desktopAddBtn) {
  desktopAddBtn.onclick = () => {
    sessionStorage.removeItem("triageRecordEditId");
    sessionStorage.removeItem("triageRecordEditPayload");
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
   🚀 Init Entrypoint (MASTER PARITY)
============================================================ */
export async function initTriageRecordModule() {
  showForm(); // form-only mode

  if (form) {
    setupTriageRecordFormSubmission({
      form,
      token,
      sharedState,
      resetForm,
      loadEntries,
    });
  }

  localStorage.setItem("triageRecordPanelVisible", "false");

  // Normalize role (MASTER PARITY)
  let roleRaw = localStorage.getItem("userRole") || "staff";
  let role = roleRaw.trim().toLowerCase();

  if (role.includes("super") && role.includes("admin")) role = "superadmin";
  else if (role.includes("admin")) role = "admin";
  else role = "staff";

  setupFieldSelector({
    module: "triage_records",
    fieldLabels: FIELD_LABELS_TRIAGE_RECORD,
    fieldOrder: FIELD_ORDER_TRIAGE_RECORD,
    defaultFields:
      FIELD_DEFAULTS_TRIAGE_RECORD[role] ||
      FIELD_DEFAULTS_TRIAGE_RECORD.staff,
  });
}

/* ============================================================
   (Optional) State Sync Stub
============================================================ */
export function syncRefsToState() {
  // reserved for future reactive syncing
}
