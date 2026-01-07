// 📦 ekg-record-main.js – Form-only Loader for EKG Record (secure + role-aware)

import {
  initPageGuard,
  autoPagePermissionKey,
  initLogoutWatcher,
} from "../../utils/index.js";

import { setupEKGRecordFormSubmission } from "./ekg-record-form.js";
import {
  FIELD_LABELS_EKG_RECORD,
  FIELD_ORDER_EKG_RECORD,
  FIELD_DEFAULTS_EKG_RECORD,
} from "./ekg-record-constants.js";
import { setupFieldSelector } from "../../utils/ui-utils.js";

/* ============================================================
   🔐 Auth – automatic permission resolution ("ekg_records:create" / "ekg_records:edit")
============================================================ */
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
const form = document.getElementById("ekgRecordForm");
const formContainer = document.getElementById("formContainer");
const desktopAddBtn = document.getElementById("desktopAddBtn");
const cancelBtn = document.getElementById("cancelBtn");
const clearBtn = document.getElementById("clearBtn");

/* ============================================================
   🧹 Reset Form (clear + restore add mode)
============================================================ */
function resetForm() {
  sharedState.currentEditIdRef.value = null;
  if (form) form.reset();

  // Clear cached edit state
  sessionStorage.removeItem("ekgRecordEditId");
  sessionStorage.removeItem("ekgRecordEditPayload");

  // Clear text inputs
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

  // Clear date field
  const dateInput = document.getElementById("recordedDate");
  if (dateInput) dateInput.value = "";

  // Reset status if applicable
  const pendingStatus = document.getElementById("status_pending");
  if (pendingStatus) pendingStatus.checked = true;
}

/* ============================================================
   🧭 Form Show / Hide
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

// 🔗 Expose globally (for reuse in action handlers)
window.showForm = showForm;
window.resetForm = resetForm;

/* ============================================================
   🎛️ Button Wiring
============================================================ */
if (cancelBtn) {
  cancelBtn.onclick = () => {
    resetForm();
    window.location.href = "/ekg-records-list.html"; // ✅ consistent plural route
  };
}

if (clearBtn) clearBtn.onclick = resetForm;

if (desktopAddBtn) {
  desktopAddBtn.onclick = () => {
    // 🧹 Remove stale session edits
    sessionStorage.removeItem("ekgRecordEditId");
    sessionStorage.removeItem("ekgRecordEditPayload");

    // Reset and open form
    resetForm();
    showForm();
  };
}

/* ============================================================
   📥 Loader (noop – list handles fetch)
============================================================ */
async function loadEntries() {
  return; // noop
}

/* ============================================================
   🚀 Init Module
============================================================ */
export async function initEKGRecordModule() {
  showForm(); // open form by default
  setupEKGRecordFormSubmission({ form, token, sharedState, resetForm, loadEntries });

  localStorage.setItem("ekgRecordPanelVisible", "false");

  // 📌 Normalize user role
  let roleRaw = localStorage.getItem("userRole") || "staff";
  let role = roleRaw.trim().toLowerCase();

  if (role.includes("super") && role.includes("admin")) {
    role = "superadmin";
  } else if (role.includes("admin")) {
    role = "admin";
  } else {
    role = "staff";
  }

  /* ============================================================
     🧩 Field Selector Setup (Role-Based)
  ============================================================ */
  setupFieldSelector({
    module: "ekg_record",
    fieldLabels: FIELD_LABELS_EKG_RECORD,
    fieldOrder: FIELD_ORDER_EKG_RECORD,
    defaultFields: FIELD_DEFAULTS_EKG_RECORD[role],
  });
}

/* ============================================================
   (Optional)
============================================================ */
export function syncRefsToState() {
  // no-op for compatibility
}
