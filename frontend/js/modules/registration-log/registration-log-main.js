// 📦 registrationLog-main.js – Form-only loader for Registration Log (permission-driven)

import {
  initPageGuard,
  initLogoutWatcher,
  autoPagePermissionKey,
} from "../../utils/index.js";
import { setupRegistrationLogFormSubmission } from "./registration-log-form.js";
import {
  FIELD_LABELS_REGISTRATION_LOG,
  FIELD_ORDER_REGISTRATION_LOG,
  FIELD_DEFAULTS_REGISTRATION_LOG,
} from "./registration-log-constants.js";
import { setupFieldSelector } from "../../utils/ui-utils.js";

/* ============================================================
   🔐 Auth Guard
   ============================================================ */
// Auto-detect proper permission (e.g., registration_logs:create / edit)
const token = initPageGuard(
  autoPagePermissionKey(["registration_logs:create", "registration_logs:edit"])
);
initLogoutWatcher();

/* ============================================================
   🌐 Shared State + DOM Refs
   ============================================================ */
const sharedState = {
  currentEditIdRef: { value: null },
};

const form = document.getElementById("registrationLogForm");
const formContainer = document.getElementById("formContainer");
const desktopAddBtn = document.getElementById("desktopAddBtn");
const cancelBtn = document.getElementById("cancelBtn");
const clearBtn = document.getElementById("clearBtn");

/* ============================================================
   🧹 Reset & Visibility Helpers
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

  // Reset selects
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

  // Clear hidden fields
  ["patientId", "registrarId"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });

  // Reset emergency flag
  const emergency = document.getElementById("isEmergency");
  if (emergency) emergency.checked = false;

  console.info("🧹 [Registration Log] Form reset complete");
}

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

// Expose globally so other modules can call them
window.showForm = showForm;
window.resetForm = resetForm;

/* ============================================================
   🔘 Button Wiring
   ============================================================ */
if (cancelBtn) {
  cancelBtn.onclick = () => {
    console.log("🚪 [Registration Log] Cancel clicked – returning to list");
    resetForm();
    window.location.href = "/registration-logs-list.html";
  };
}

if (clearBtn) clearBtn.onclick = resetForm;

if (desktopAddBtn) {
  desktopAddBtn.onclick = () => {
    console.log("➕ [Registration Log] Switching to Add mode");
    sessionStorage.removeItem("registrationLogEditId");
    sessionStorage.removeItem("registrationLogEditPayload");
    resetForm();
    showForm();
  };
}

/* ============================================================
   📦 Stub (no list handling here)
   ============================================================ */
async function loadEntries() {
  return; // no-op (handled by list page)
}

/* ============================================================
   🚀 Module Init
   ============================================================ */
export async function initRegistrationLogModule() {
  showForm(); // open form immediately

  setupRegistrationLogFormSubmission({
    form,
    token,
    sharedState,
    resetForm,
    loadEntries,
  });

  localStorage.setItem("registrationLogPanelVisible", "false");

  // Normalize role
  let roleRaw = localStorage.getItem("userRole") || "staff";
  let role = roleRaw.trim().toLowerCase();

  if (role.includes("super") && role.includes("admin")) role = "superadmin";
  else if (role.includes("admin")) role = "admin";
  else role = "staff";

  // 🔧 Setup field selector
  setupFieldSelector({
    module: "registration_log",
    fieldLabels: FIELD_LABELS_REGISTRATION_LOG,
    fieldOrder: FIELD_ORDER_REGISTRATION_LOG,
    defaultFields:
      FIELD_DEFAULTS_REGISTRATION_LOG[role] ||
      FIELD_DEFAULTS_REGISTRATION_LOG.staff,
  });

  console.info(`✅ [Registration Log] Module initialized for role: ${role}`);
}

/* ============================================================
   (Optional)
   ============================================================ */
export function syncRefsToState() {
  // placeholder for future syncs
}
