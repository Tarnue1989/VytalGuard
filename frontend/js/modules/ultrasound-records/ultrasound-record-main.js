// 📦 ultrasoundRecord-main.js – Form-only Loader for Ultrasound Record (ENTERPRISE MASTER PARITY)
// ============================================================================
// 🧭 Mirrors delivery-record-main.js / ekg-record-main.js / registrationLog-main.js
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

import { setupUltrasoundFormSubmission } from "./ultrasound-record-form.js";

import {
  FIELD_LABELS_ULTRASOUND_RECORD,
  FIELD_ORDER_ULTRASOUND_RECORD,
  FIELD_DEFAULTS_ULTRASOUND_RECORD,
} from "./ultrasound-record-constants.js";

import { setupFieldSelector } from "../../utils/ui-utils.js";

/* ============================================================
   🔐 Auth Guard + Shared State (MASTER PARITY)
============================================================ */
const token = initPageGuard(
  autoPagePermissionKey(["ultrasound_records:create", "ultrasound_records:edit"])
);
initLogoutWatcher();

const sharedState = {
  currentEditIdRef: { value: null },
};

/* ============================================================
   📎 DOM Refs
============================================================ */
const form = document.getElementById("ultrasoundRecordForm");
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
  sessionStorage.removeItem("ultrasoundEditId");
  sessionStorage.removeItem("ultrasoundEditPayload");

  // Clear visible inputs
  [
    "patientInput",
    "consultationInput",
    "maternityVisitInput",
    "technicianInput",
    "scanDate",
    "scanLocation",
    "ultraFindings",
    "note",
    "numberOfFetus",
    "biparietalDiameter",
    "presentation",
    "lie",
    "position",
    "amnioticVolume",
    "fetalHeartRate",
    "gender",
    "prevCesDate",
    "prevCesLocation",
    "cesareanDate",
    "indication",
    "nextOfKin",
  ].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });

  // Clear dropdowns
  [
    "organizationSelect",
    "facilitySelect",
    "departmentSelect",
    "billableItemSelect",
    "registrationLogSelect",
  ].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });

  // Clear hidden IDs
  ["patientId", "consultationId", "maternityVisitId", "technicianId"].forEach(
    (id) => {
      const el = document.getElementById(id);
      if (el) el.value = "";
    }
  );

  // Reset flags
  ["isEmergency", "previousCesarean"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.checked = false;
  });
}

/* ============================================================
   🧭 Form Show / Hide (MASTER PARITY)
============================================================ */
function showForm() {
  formContainer?.classList.remove("hidden");
  desktopAddBtn?.classList.add("hidden");
  localStorage.setItem("ultrasoundFormVisible", "true");
}

function hideForm() {
  resetForm();
  formContainer?.classList.add("hidden");
  desktopAddBtn?.classList.remove("hidden");
  localStorage.setItem("ultrasoundFormVisible", "false");
}

// Expose globally (parity with other modules)
window.showForm = showForm;
window.resetForm = resetForm;

/* ============================================================
   🔘 Button Wiring
============================================================ */
if (cancelBtn) {
  cancelBtn.onclick = () => {
    resetForm();
    window.location.href = "/ultrasound-records-list.html";
  };
}

if (clearBtn) clearBtn.onclick = resetForm;

if (desktopAddBtn) {
  desktopAddBtn.onclick = () => {
    sessionStorage.removeItem("ultrasoundEditId");
    sessionStorage.removeItem("ultrasoundEditPayload");
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
export async function initUltrasoundModule() {
  showForm(); // form-only mode

  if (form) {
    setupUltrasoundFormSubmission({
      form,
      token,
      sharedState,
      resetForm,
      loadEntries,
    });
  }

  localStorage.setItem("ultrasoundPanelVisible", "false");

  // Normalize role for field defaults
  let roleRaw = localStorage.getItem("userRole") || "staff";
  let role = roleRaw.trim().toLowerCase();

  if (role.includes("super") && role.includes("admin")) role = "superadmin";
  else if (role.includes("admin")) role = "admin";
  else role = "staff";

  setupFieldSelector({
    module: "ultrasound_record",
    fieldLabels: FIELD_LABELS_ULTRASOUND_RECORD,
    fieldOrder: FIELD_ORDER_ULTRASOUND_RECORD,
    defaultFields:
      FIELD_DEFAULTS_ULTRASOUND_RECORD[role] ||
      FIELD_DEFAULTS_ULTRASOUND_RECORD.staff,
  });
}

/* ============================================================
   (Optional) State Sync Stub
============================================================ */
export function syncRefsToState() {
  // reserved for future reactive syncing
}
