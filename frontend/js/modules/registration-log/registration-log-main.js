// 📦 registrationLog-main.js – Form-only loader for Registration Log (Enterprise Master Pattern)
// ============================================================================
// 🧭 FULL MASTER PARITY WITH consultation-main.js / department-main.js
// 🔹 Auth guard + logout watcher
// 🔹 Unified form visibility and reset logic
// 🔹 Session-safe edit caching
// 🔹 Field selector integration (role-aware)
// 🔹 100% ID-safe and controller-aligned
// ============================================================================

import {
  initPageGuard,
  autoPagePermissionKey,
  initLogoutWatcher,
} from "../../utils/index.js";

import { setupRegistrationLogFormSubmission } from "./registration-log-form.js";

import {
  FIELD_LABELS_REGISTRATION_LOG,
  FIELD_ORDER_REGISTRATION_LOG,
  FIELD_DEFAULTS_REGISTRATION_LOG,
} from "./registration-log-constants.js";

import { setupFieldSelector } from "../../utils/ui-utils.js";

/* ============================================================
   🔐 Auth Guard + Shared State
============================================================ */
const token = initPageGuard(
  autoPagePermissionKey(["registration_logs:create", "registration_logs:edit"])
);
initLogoutWatcher();

const sharedState = {
  currentEditIdRef: { value: null },
};

/* ============================================================
   📎 DOM Refs
============================================================ */
const form = document.getElementById("registrationLogForm");
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
  sessionStorage.removeItem("registrationLogEditId");
  sessionStorage.removeItem("registrationLogEditPayload");

  // Clear visible inputs
  [
    "patientInput",
    "registrarInput",
    "visitReason",
    "registrationSource",
    "notes",
  ].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });

  // Clear dropdowns
  [
    "organizationSelect",
    "facilitySelect",
    "registrationTypeSelect",
    "registrationMethod",
    "patientCategory",
  ].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });

  // Clear hidden IDs
  ["patientId", "registrarId"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });

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
  localStorage.setItem("registrationLogFormVisible", "true");
}

function hideForm() {
  resetForm();
  formContainer?.classList.add("hidden");
  desktopAddBtn?.classList.remove("hidden");
  localStorage.setItem("registrationLogFormVisible", "false");
}

// 🔗 Expose globally (actions / hot reload parity)
window.showForm = showForm;
window.resetForm = resetForm;

/* ============================================================
   ⚙️ Button Wiring
============================================================ */
if (cancelBtn) {
  cancelBtn.onclick = () => {
    resetForm();
    window.location.href = "/registration-logs-list.html";
  };
}

if (clearBtn) clearBtn.onclick = resetForm;

if (desktopAddBtn) {
  desktopAddBtn.onclick = () => {
    sessionStorage.removeItem("registrationLogEditId");
    sessionStorage.removeItem("registrationLogEditPayload");
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
   🚀 Init Entrypoint
============================================================ */
export async function initRegistrationLogModule() {
  showForm(); // form-only mode (MASTER parity)

  if (form) {
    setupRegistrationLogFormSubmission({
      form,
      token,
      sharedState,
      resetForm,
      loadEntries,
    });
  }

  localStorage.setItem("registrationLogPanelVisible", "false");

  // Normalize role for field defaults (MASTER PARITY)
  let roleRaw = localStorage.getItem("userRole") || "staff";
  let role = roleRaw.trim().toLowerCase();

  if (role.includes("super") && role.includes("admin")) role = "superadmin";
  else if (role.includes("admin")) role = "admin";
  else role = "staff";

  setupFieldSelector({
    module: "registration_log",
    fieldLabels: FIELD_LABELS_REGISTRATION_LOG,
    fieldOrder: FIELD_ORDER_REGISTRATION_LOG,
    defaultFields:
      FIELD_DEFAULTS_REGISTRATION_LOG[role] ||
      FIELD_DEFAULTS_REGISTRATION_LOG.staff,
  });
}

/* ============================================================
   🔁 Sync Stub (Future)
============================================================ */
export function syncRefsToState() {
  // reserved for future reactive syncing
}
