// 📦 triage-record-main.js – Form-only loader for Triage Record (Enterprise-Aligned)
// ============================================================================
// 🧭 Master Pattern: vital-main.js
// 🔹 Enterprise-aligned structure: unified form visibility, reset, auth guard,
//   role normalization, and field selector setup.
// 🔹 All original Triage Record HTML IDs are preserved exactly.
// ============================================================================

import {
  initPageGuard,
  autoPagePermissionKey,
  initLogoutWatcher,
} from "../../utils/index.js";
import { setupTriageRecordFormSubmission } from "./triage-record-form.js";
import {
  FIELD_LABELS_TRIAGE_RECORD,
  FIELD_ORDER_TRIAGE_RECORD,
  FIELD_DEFAULTS_TRIAGE_RECORD,
} from "./triage-record-constants.js";
import { setupFieldSelector } from "../../utils/ui-utils.js";

/* ============================================================
   🔐 Auth + Logout Guard
============================================================ */
// Automatically detects correct permission ("triage_records:create" / "triage_records:edit")
const token = initPageGuard(autoPagePermissionKey());
initLogoutWatcher();

/* ============================================================
   🌐 Shared State
============================================================ */
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
   🧹 Reset Form Helper
============================================================ */
function resetForm() {
  sharedState.currentEditIdRef.value = null;
  if (form) form.reset();

  // Clear cached edit session
  sessionStorage.removeItem("triageRecordEditId");
  sessionStorage.removeItem("triageRecordEditPayload");

  // Text/numeric fields
  [
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
    "patientInput",
    "doctorInput",
    "nurseInput",
  ].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });

  // Dropdowns
  [
    "organizationSelect",
    "facilitySelect",
    "triageTypeSelect",
    "registrationLogSelect",
  ].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });

  // Hidden IDs
  ["patientId", "doctorId", "nurseId"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });

  // Reset state
  console.info("🧹 [Triage Record] Form reset complete");
}

/* ============================================================
   🧭 Form Visibility Controls
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

// Expose globally for reuse
window.showForm = showForm;
window.resetForm = resetForm;

/* ============================================================
   🔘 Button Wiring
============================================================ */
if (cancelBtn) {
  cancelBtn.onclick = () => {
    console.log("🚪 [Triage Record] Cancel clicked → back to list");
    resetForm();
    window.location.href = "/triage-records-list.html";
  };
}

if (clearBtn) clearBtn.onclick = resetForm;

if (desktopAddBtn) {
  desktopAddBtn.onclick = () => {
    console.log("➕ [Triage Record] Switching to Add mode");
    sessionStorage.removeItem("triageRecordEditId");
    sessionStorage.removeItem("triageRecordEditPayload");
    resetForm();
    showForm();
  };
}

/* ============================================================
   🧠 No-op Loader (handled by list page)
============================================================ */
async function loadEntries() {
  return;
}

/* ============================================================
   🚀 Module Initializer
============================================================ */
export async function initTriageRecordModule() {
  // Restore form visibility preference
  const visible = localStorage.getItem("triageRecordFormVisible") === "true";
  if (visible) showForm();
  else hideForm();

  // Initialize form submission
  if (form) {
    setupTriageRecordFormSubmission({
      form,
      token,
      sharedState,
      resetForm,
      loadEntries,
    });
  }

  // Hide list panel on standalone form
  localStorage.setItem("triageRecordPanelVisible", "false");

  /* --------------------- Role Normalization --------------------- */
  let roleRaw = localStorage.getItem("userRole") || "staff";
  let role = roleRaw.trim().toLowerCase();

  if (role.includes("super") && role.includes("admin")) role = "superadmin";
  else if (role.includes("admin")) role = "admin";
  else role = "staff";

  /* --------------------- Field Selector Setup --------------------- */
  setupFieldSelector({
    module: "triage_records",
    fieldLabels: FIELD_LABELS_TRIAGE_RECORD,
    fieldOrder: FIELD_ORDER_TRIAGE_RECORD,
    defaultFields:
      FIELD_DEFAULTS_TRIAGE_RECORD[role] ||
      FIELD_DEFAULTS_TRIAGE_RECORD.staff,
  });

  console.info(`✅ [Triage Record] Module initialized (role: ${role})`);
}

/* ============================================================
   🔁 Sync Helper (reserved)
============================================================ */
export function syncRefsToState() {
  // reserved for future reactive linkages
}
