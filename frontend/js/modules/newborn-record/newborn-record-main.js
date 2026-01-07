// 📦 newborn-record-main.js – Form-only loader for Newborn Record

import { initPageGuard, initLogoutWatcher } from "../../utils/index.js";
import { setupNewbornRecordFormSubmission } from "./newborn-record-form.js";
import {
  FIELD_LABELS_NEWBORN_RECORD,
  FIELD_ORDER_NEWBORN_RECORD,
  FIELD_DEFAULTS_NEWBORN_RECORD,
} from "./newborn-record-constants.js";
import { setupFieldSelector } from "../../utils/ui-utils.js";

// 🔐 Auth – driven by backend permission key
const token = initPageGuard("newborn-records");

// 🔁 Global logout watcher
initLogoutWatcher();

// 🌐 Shared State
const sharedState = {
  currentEditIdRef: { value: null },
};

// 📎 DOM Refs
const form = document.getElementById("newbornRecordForm");
const formContainer = document.getElementById("formContainer");
const desktopAddBtn = document.getElementById("desktopAddBtn");
const cancelBtn = document.getElementById("cancelBtn");
const clearBtn = document.getElementById("clearBtn");

/* ------------------------- Helpers ------------------------- */

// 🧹 Reset form
function resetForm() {
  sharedState.currentEditIdRef.value = null;
  if (form) form.reset();

  // Clear cached edit state
  sessionStorage.removeItem("newbornRecordEditId");
  sessionStorage.removeItem("newbornRecordEditPayload");

  // Explicitly clear newborn fields
  [
    "gender",
    "birth_weight",
    "birth_length",
    "head_circumference",
    "apgar_score_1min",
    "apgar_score_5min",
    "measurement_notes",
    "complications",
    "notes",
    "death_reason",
    "death_time",
    "transfer_reason",
    "transfer_facility_id",
    "transfer_time",
    "void_reason",
    "voided_at",
  ].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });

  // Clear selects
  const orgSelect = document.getElementById("organizationSelect");
  if (orgSelect) orgSelect.value = "";
  const facilitySelect = document.getElementById("facilitySelect");
  if (facilitySelect) facilitySelect.value = "";

  // Clear mother suggestion input
  const motherInput = document.getElementById("motherInput");
  const motherId = document.getElementById("motherId");
  if (motherInput) motherInput.value = "";
  if (motherId) motherId.value = "";

  // Clear delivery record dropdown
  const deliverySelect = document.getElementById("deliveryRecordId");
  if (deliverySelect) deliverySelect.value = "";

  // Reset status (default alive if present)
  const aliveRadio = document.getElementById("status_alive");
  if (aliveRadio) aliveRadio.checked = true;
}

// 🧭 Form show/hide
function showForm() {
  formContainer?.classList.remove("hidden");
  desktopAddBtn?.classList.add("hidden");
  localStorage.setItem("newbornRecordFormVisible", "true");
}

function hideForm() {
  resetForm();
  formContainer?.classList.add("hidden");
  desktopAddBtn?.classList.remove("hidden");
  localStorage.setItem("newbornRecordFormVisible", "false");
}

// 🔗 Expose globally so action handlers can reuse
window.showForm = showForm;
window.resetForm = resetForm;

/* ------------------------- Wire Buttons ------------------------- */

if (cancelBtn) {
  cancelBtn.onclick = () => {
    resetForm();
    window.location.href = "/newborn-records-list.html"; // ✅ plural
  };
}

if (clearBtn) clearBtn.onclick = resetForm;

if (desktopAddBtn) {
  desktopAddBtn.onclick = () => {
    // 🧹 Ensure stale edit data is gone
    sessionStorage.removeItem("newbornRecordEditId");
    sessionStorage.removeItem("newbornRecordEditPayload");

    // Reset form for clean Add mode
    resetForm();
    showForm();
  };
}

/* ------------------------- Loader ------------------------- */

async function loadEntries() {
  return; // noop (list page handles this)
}

/* ------------------------- Init ------------------------- */

export async function initNewbornRecordModule() {
  showForm(); // open the form by default
  setupNewbornRecordFormSubmission({ form, token, sharedState, resetForm, loadEntries });

  localStorage.setItem("newbornRecordPanelVisible", "false");

  // 📌 Normalize role before pulling defaults
  let roleRaw = localStorage.getItem("userRole") || "staff";
  let role = roleRaw.trim().toLowerCase();

  if (role.includes("super") && role.includes("admin")) {
    role = "superadmin";
  } else if (role.includes("admin")) {
    role = "admin";
  } else {
    role = "staff";
  }

  setupFieldSelector({
    module: "newbornRecord",
    fieldLabels: FIELD_LABELS_NEWBORN_RECORD,
    fieldOrder: FIELD_ORDER_NEWBORN_RECORD,
    defaultFields: FIELD_DEFAULTS_NEWBORN_RECORD[role],
  });
}

// (Optional)
export function syncRefsToState() {
  // no-op
}
