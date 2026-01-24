// 📦 ekg-record-main.js – Form-only Loader for EKG Record (ENTERPRISE MASTER PARITY)
// ============================================================================
// 🧭 Mirrors registrationLog-main.js / department-main.js exactly
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

import { setupEKGRecordFormSubmission } from "./ekg-record-form.js";

import {
  FIELD_LABELS_EKG_RECORD,
  FIELD_ORDER_EKG_RECORD,
  FIELD_DEFAULTS_EKG_RECORD,
} from "./ekg-record-constants.js";

import { setupFieldSelector } from "../../utils/ui-utils.js";

/* ============================================================
   🔐 Auth Guard + Shared State (MASTER PARITY)
============================================================ */
const token = initPageGuard(
  autoPagePermissionKey(["ekg_records:create", "ekg_records:edit"])
);
initLogoutWatcher();

const sharedState = {
  currentEditIdRef: { value: null },
};

/* ============================================================
   📎 DOM Refs
============================================================ */
const form = document.getElementById("ekgRecordForm");
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
  sessionStorage.removeItem("ekgRecordEditId");
  sessionStorage.removeItem("ekgRecordEditPayload");

  // Clear visible text inputs
  [
    "patientInput",
    "technicianInput",
    "heartRate",
    "prInterval",
    "qrsDuration",
    "qtInterval",
    "axis",
    "rhythm",
    "interpretation",
    "recommendation",
    "note",
  ].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });

  // Clear dropdowns
  [
    "organizationSelect",
    "facilitySelect",
    "billableItemSelect",
    "registrationLogSelect",
    "consultationSelect",
  ].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });

  // Clear hidden IDs
  ["patientId", "technicianId"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });

  // Reset date field
  const dateInput = document.getElementById("recordedDate");
  if (dateInput) dateInput.value = "";

  // Reset emergency flag
  const emergency = document.getElementById("isEmergency");
  if (emergency) emergency.checked = false;
}

/* ============================================================
   🧭 Form Show / Hide (MASTER PARITY)
============================================================ */
function showForm() {
  formContainer?.classList.remove("hidden");
  desktopAddBtn?.classList.add("hidden");
  localStorage.setItem("ekgRecordFormVisible", "true");
}

function hideForm() {
  resetForm();
  formContainer?.classList.add("hidden");
  desktopAddBtn?.classList.remove("hidden");
  localStorage.setItem("ekgRecordFormVisible", "false");
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
    window.location.href = "/ekg-records-list.html";
  };
}

if (clearBtn) clearBtn.onclick = resetForm;

if (desktopAddBtn) {
  desktopAddBtn.onclick = () => {
    sessionStorage.removeItem("ekgRecordEditId");
    sessionStorage.removeItem("ekgRecordEditPayload");
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
export async function initEKGRecordModule() {
  showForm(); // form-only mode (matches Registration Log / Department)

  if (form) {
    setupEKGRecordFormSubmission({
      form,
      token,
      sharedState,
      resetForm,
      loadEntries,
    });
  }

  localStorage.setItem("ekgRecordPanelVisible", "false");

  // Normalize role for field defaults (MASTER PARITY)
  let roleRaw = localStorage.getItem("userRole") || "staff";
  let role = roleRaw.trim().toLowerCase();

  if (role.includes("super") && role.includes("admin")) role = "superadmin";
  else if (role.includes("admin")) role = "admin";
  else role = "staff";

  setupFieldSelector({
    module: "ekg_record",
    fieldLabels: FIELD_LABELS_EKG_RECORD,
    fieldOrder: FIELD_ORDER_EKG_RECORD,
    defaultFields:
      FIELD_DEFAULTS_EKG_RECORD[role] ||
      FIELD_DEFAULTS_EKG_RECORD.staff,
  });
}

/* ============================================================
   (Optional) State Sync Stub
============================================================ */
export function syncRefsToState() {
  // reserved for future reactive syncing
}
