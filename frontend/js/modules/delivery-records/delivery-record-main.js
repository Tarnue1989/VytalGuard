// 📦 delivery-record-main.js – Form-only loader (enterprise-consistent with Central Stock)

import {
  initPageGuard,
  autoPagePermissionKey,
  initLogoutWatcher,
} from "../../utils/index.js";

import { setupDeliveryRecordFormSubmission } from "./delivery-record-form.js";
import {
  FIELD_LABELS_DELIVERY_RECORD,
  FIELD_ORDER_DELIVERY_RECORD,
  FIELD_DEFAULTS_DELIVERY_RECORD,
} from "./delivery-record-constants.js";
import { setupFieldSelector } from "../../utils/ui-utils.js";

// 🔐 Auth – automatic permission resolution ("delivery_records:create" or "delivery_records:edit")
const token = initPageGuard(autoPagePermissionKey());

// 🔁 Global logout watcher
initLogoutWatcher();

// 🌐 Shared State
const sharedState = {
  currentEditIdRef: { value: null },
};

// 📎 DOM Refs
const form = document.getElementById("deliveryRecordForm");
const formContainer = document.getElementById("formContainer");
const desktopAddBtn = document.getElementById("desktopAddBtn");
const cancelBtn = document.getElementById("cancelBtn");
const clearBtn = document.getElementById("clearBtn");

/* ------------------------- Helpers ------------------------- */

// 🧹 Reset form
function resetForm() {
  sharedState.currentEditIdRef.value = null;
  if (form) form.reset();

  // 🧽 Clear cached edit state
  sessionStorage.removeItem("deliveryRecordEditId");
  sessionStorage.removeItem("deliveryRecordEditPayload");

  // 🧩 Clear visible + hidden inputs
  [
    "patientInput", "doctorInput", "midwifeInput", "deliveryType", "deliveryMode",
    "babyCount", "birthWeight", "birthLength", "newbornWeight", "newbornGender",
    "apgarScore", "complications", "notes", "deliveryDate",
  ].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });

  // 🔒 Reset dropdowns + hidden IDs
  [
    "organizationSelect", "facilitySelect", "departmentSelect",
    "consultationSelect", "billableItemSelect",
    "patientId", "doctorId", "midwifeId",
  ].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });

  // 🚨 Reset emergency checkbox
  const emergency = document.getElementById("isEmergency");
  if (emergency) emergency.checked = false;
}

// 🧭 Form show/hide (same as central stock)
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

window.showForm = showForm;
window.resetForm = resetForm;

/* ------------------------- Wire Buttons ------------------------- */
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

/* ------------------------- Loader ------------------------- */
async function loadEntries() {
  return; // noop (list handles)
}

/* ------------------------- Init ------------------------- */
export async function initDeliveryRecordModule() {
  showForm(); // default open
  setupDeliveryRecordFormSubmission({ form, token, sharedState, resetForm, loadEntries });

  localStorage.setItem("deliveryRecordPanelVisible", "false");

  // 🧩 Role normalization
  let roleRaw = localStorage.getItem("userRole") || "staff";
  let role = roleRaw.trim().toLowerCase();

  if (role.includes("super") && role.includes("admin")) role = "superadmin";
  else if (role.includes("admin")) role = "admin";
  else role = "staff";

  // 🧱 Field Selector (enterprise alignment)
  setupFieldSelector({
    module: "delivery_record",
    fieldLabels: FIELD_LABELS_DELIVERY_RECORD,
    fieldOrder: FIELD_ORDER_DELIVERY_RECORD,
    defaultFields: FIELD_DEFAULTS_DELIVERY_RECORD[role],
  });
}

// (Optional sync function)
export function syncRefsToState() {
  // no-op
}
