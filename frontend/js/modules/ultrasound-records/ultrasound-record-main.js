// 📦 ultrasoundRecord-main.js – Form-only loader for UltrasoundRecord (Master Pattern Aligned)

import {
  initPageGuard,
  autoPagePermissionKey,
  initLogoutWatcher,
} from "../../utils/index.js";
import { setupUltrasoundFormSubmission } from "./ultrasound-record-form.js";
import {
  FIELD_LABELS_ULTRASOUND_RECORD,
  FIELD_ORDER_ULTRASOUND_RECORD,
  FIELD_DEFAULTS_ULTRASOUND_RECORD,
} from "./ultrasound-record-constants.js";
import { setupFieldSelector } from "../../utils/ui-utils.js";

/* ============================================================
   🔐 Auth + Global Guards
============================================================ */

// Automatically resolves correct permission ("ultrasound-records:create" / "ultrasound-records:edit")
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
const form = document.getElementById("ultrasoundRecordForm");
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

  // Clear cached edit state
  sessionStorage.removeItem("ultrasoundEditId");
  sessionStorage.removeItem("ultrasoundEditPayload");

  // Explicitly clear text fields
  [
    "patientInput",
    "consultationInput",
    "maternityVisitInput",
    "technicianInput",
    "scanType",
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
    "billableItemSelect",
    "departmentSelect",
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

  // Reset checkboxes
  ["isEmergency", "ultrasoundDone", "previousCesarean"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.checked = false;
  });
}

/* ============================================================
   🧭 Form Visibility
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

// Expose globally for cross-module reuse
window.showForm = showForm;
window.resetForm = resetForm;

/* ============================================================
   🔘 Button Wiring
============================================================ */
if (cancelBtn) {
  cancelBtn.onclick = () => {
    resetForm();
    window.location.href = "/ultrasound-records-list.html"; // ✅ plural redirect
  };
}

if (clearBtn) clearBtn.onclick = resetForm;

if (desktopAddBtn) {
  desktopAddBtn.onclick = () => {
    // Ensure stale edit data is cleared
    sessionStorage.removeItem("ultrasoundEditId");
    sessionStorage.removeItem("ultrasoundEditPayload");
    resetForm();
    showForm();
  };
}

/* ============================================================
   🧠 Loader (no-op)
============================================================ */
async function loadEntries() {
  return; // list page handles loading
}

/* ============================================================
   🚀 Module Initializer
============================================================ */
export async function initUltrasoundModule() {
  showForm(); // auto-open form on standalone page

  setupUltrasoundFormSubmission({
    form,
    token,
    sharedState,
    resetForm,
    loadEntries,
  });

  localStorage.setItem("ultrasoundPanelVisible", "false");

  // Normalize role for field defaults
  let roleRaw = localStorage.getItem("userRole") || "staff";
  let role = roleRaw.trim().toLowerCase();

  if (role.includes("super") && role.includes("admin")) role = "superadmin";
  else if (role.includes("admin")) role = "admin";
  else role = "staff";

  // 🧩 Initialize Field Selector (role-based)
  setupFieldSelector({
    module: "ultrasound_record",
    fieldLabels: FIELD_LABELS_ULTRASOUND_RECORD,
    fieldOrder: FIELD_ORDER_ULTRASOUND_RECORD,
    defaultFields: FIELD_DEFAULTS_ULTRASOUND_RECORD[role],
  });
}

/* ============================================================
   🔁 Sync Helper
============================================================ */
export function syncRefsToState() {
  // reserved for advanced reactive integration
}
