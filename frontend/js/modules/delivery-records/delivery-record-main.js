// 📦 delivery-record-main.js – Form-only Loader for Delivery Record (ENTERPRISE MASTER PARITY)
// ============================================================================
// 🧭 Mirrors ekg-record-main.js / registrationLog-main.js / department-main.js
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

import { setupDeliveryRecordFormSubmission } from "./delivery-record-form.js";

import {
  FIELD_LABELS_DELIVERY_RECORD,
  FIELD_ORDER_DELIVERY_RECORD,
  FIELD_DEFAULTS_DELIVERY_RECORD,
} from "./delivery-record-constants.js";

import { setupFieldSelector } from "../../utils/ui-utils.js";

/* ============================================================
   🔐 Auth Guard + Shared State (MASTER PARITY)
============================================================ */
const token = initPageGuard(
  autoPagePermissionKey(["delivery_records:create", "delivery_records:edit"])
);
initLogoutWatcher();

const sharedState = {
  currentEditIdRef: { value: null },
};

/* ============================================================
   📎 DOM Refs
============================================================ */
const form = document.getElementById("deliveryRecordForm");
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
  sessionStorage.removeItem("deliveryRecordEditId");
  sessionStorage.removeItem("deliveryRecordEditPayload");

  // Clear visible text inputs
  [
    "patientInput",
    "doctorInput",
    "midwifeInput",
    "deliveryType",
    "deliveryMode",
    "babyCount",
    "birthWeight",
    "birthLength",
    "newbornWeight",
    "newbornGender",
    "apgarScore",
    "complications",
    "notes",
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
    "consultationSelect",
  ].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });

  // Clear hidden IDs
  ["patientId", "doctorId", "midwifeId"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });

  // Reset date field
  const dateInput = document.getElementById("deliveryDate");
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
  localStorage.setItem("deliveryRecordFormVisible", "true");
}

function hideForm() {
  resetForm();
  formContainer?.classList.add("hidden");
  desktopAddBtn?.classList.remove("hidden");
  localStorage.setItem("deliveryRecordFormVisible", "false");
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
    window.location.href = "/delivery-records-list.html";
  };
}

if (clearBtn) clearBtn.onclick = resetForm;

if (desktopAddBtn) {
  desktopAddBtn.onclick = () => {
    sessionStorage.removeItem("deliveryRecordEditId");
    sessionStorage.removeItem("deliveryRecordEditPayload");
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
export async function initDeliveryRecordModule() {
  showForm(); // form-only mode (matches EKG / Registration Log / Department)

  if (form) {
    setupDeliveryRecordFormSubmission({
      form,
      token,
      sharedState,
      resetForm,
      loadEntries,
    });
  }

  localStorage.setItem("deliveryRecordPanelVisible", "false");

  // Normalize role for field defaults (MASTER PARITY)
  let roleRaw = localStorage.getItem("userRole") || "staff";
  let role = roleRaw.trim().toLowerCase();

  if (role.includes("super") && role.includes("admin")) role = "superadmin";
  else if (role.includes("admin")) role = "admin";
  else role = "staff";

  setupFieldSelector({
    module: "delivery_record",
    fieldLabels: FIELD_LABELS_DELIVERY_RECORD,
    fieldOrder: FIELD_ORDER_DELIVERY_RECORD,
    defaultFields:
      FIELD_DEFAULTS_DELIVERY_RECORD[role] ||
      FIELD_DEFAULTS_DELIVERY_RECORD.staff,
  });
}

/* ============================================================
   (Optional) State Sync Stub
============================================================ */
export function syncRefsToState() {
  // reserved for future reactive syncing
}
