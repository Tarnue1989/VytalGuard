// 📦 surgery-main.js – Form-only loader for Surgery (Enterprise Pattern Aligned)
// ============================================================================
// 🔹 Mirrors centralstock-main.js for unified structure, lifecycle, and safety
// 🔹 Fully compatible with surgery-form.js + field visibility + role logic
// ============================================================================

import {
  initPageGuard,
  autoPagePermissionKey,
  initLogoutWatcher,
} from "../../utils/index.js";

import { setupSurgeryFormSubmission } from "./surgery-form.js";
import {
  FIELD_LABELS_SURGERY,
  FIELD_ORDER_SURGERY,
  FIELD_DEFAULTS_SURGERY,
} from "./surgery-constants.js";
import { setupFieldSelector } from "../../utils/ui-utils.js";

// 🔐 Auth – automatic permission resolution ("surgeries:create" or "surgeries:edit")
const token = initPageGuard(autoPagePermissionKey());

// 🔁 Global logout watcher
initLogoutWatcher();

// 🌐 Shared State
const sharedState = {
  currentEditIdRef: { value: null },
};

// 📎 DOM Refs
const form = document.getElementById("surgeryForm");
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

  // 🧩 Clear cached edit state
  sessionStorage.removeItem("surgeryEditId");
  sessionStorage.removeItem("surgeryEditPayload");

  // 🧼 Clear text inputs
  [
    "patientInput",
    "surgeonInput",
    "scheduledDate",
    "durationMinutes",
    "anesthesiaType",
    "complications",
    "notes",
  ].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });

  // 🧩 Clear dropdowns
  [
    "organizationSelect",
    "facilitySelect",
    "billableItemSelect",
    "departmentSelect",
    "consultationSelect",
  ].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });

  // 🧩 Clear hidden IDs
  ["patientId", "surgeonId"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });

  // 🩺 Reset checkboxes
  const chk = document.getElementById("isEmergency");
  if (chk) chk.checked = false;
}

/* ============================================================
   🧭 Form Visibility Controls
============================================================ */
function showForm() {
  formContainer?.classList.remove("hidden");
  desktopAddBtn?.classList.add("hidden");
  localStorage.setItem("surgeryFormVisible", "true");
}

function hideForm() {
  resetForm();
  formContainer?.classList.add("hidden");
  desktopAddBtn?.classList.remove("hidden");
  localStorage.setItem("surgeryFormVisible", "false");
}

// 🔗 Expose globally
window.showForm = showForm;
window.resetForm = resetForm;

/* ============================================================
   🧩 Button Handlers
============================================================ */
if (cancelBtn) {
  cancelBtn.onclick = () => {
    resetForm();
    window.location.href = "/surgeries-list.html";
  };
}

if (clearBtn) clearBtn.onclick = resetForm;

if (desktopAddBtn) {
  desktopAddBtn.onclick = () => {
    sessionStorage.removeItem("surgeryEditId");
    sessionStorage.removeItem("surgeryEditPayload");
    resetForm();
    showForm();
  };
}

/* ============================================================
   🧠 Loader Stub (list handled separately)
============================================================ */
async function loadEntries() {
  return; // noop for list page
}

/* ============================================================
   🚀 Init Module
============================================================ */
export async function initSurgeryModule() {
  showForm(); // Open the form by default
  setupSurgeryFormSubmission({ form, token, sharedState, resetForm, loadEntries });

  localStorage.setItem("surgeryPanelVisible", "false");

  // 🧩 Normalize role for field defaults
  let roleRaw = localStorage.getItem("userRole") || "staff";
  let role = roleRaw.trim().toLowerCase();
  if (role.includes("super") && role.includes("admin")) role = "superadmin";
  else if (role.includes("admin")) role = "admin";
  else role = "staff";

  // 🧠 Initialize field selector (role-based defaults)
  setupFieldSelector({
    module: "surgery",
    fieldLabels: FIELD_LABELS_SURGERY,
    fieldOrder: FIELD_ORDER_SURGERY,
    defaultFields: FIELD_DEFAULTS_SURGERY[role],
  });
}

/* ============================================================
   🔄 Sync Refs (Optional Stub)
============================================================ */
export function syncRefsToState() {
  // no-op for now
}
