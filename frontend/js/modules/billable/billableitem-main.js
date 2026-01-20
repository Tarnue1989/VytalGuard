// 📦 billableitem-main.js – Form-only Loader for Billable Items (ENTERPRISE MASTER PARITY)
// ============================================================================
// 🧭 Mirrors department-main.js / patient-main.js EXACTLY (form-only mode)
// 🔹 Auth guard + logout watcher
// 🔹 Unified form visibility + reset logic
// 🔹 Session-safe edit caching
// 🔹 Role-based field selector (enterprise-aligned)
// 🔹 100% ID-safe (pills, inputs, radios, buttons preserved)
// ============================================================================

import {
  initPageGuard,
  autoPagePermissionKey,
  initLogoutWatcher,
} from "../../utils/index.js";

import { setupBillableItemFormSubmission } from "./billableitem-form.js";
import {
  FIELD_LABELS_BILLABLE_ITEM,
  FIELD_ORDER_BILLABLE_ITEM,
  FIELD_DEFAULTS_BILLABLE_ITEM,
} from "./billableitem-constants.js";
import { setupFieldSelector } from "../../utils/ui-utils.js";

/* ============================================================
   🔐 Auth Guard + Shared State
============================================================ */
const token = initPageGuard(autoPagePermissionKey());
initLogoutWatcher();

const sharedState = {
  currentEditIdRef: { value: null },
};

/* ============================================================
   📎 DOM Refs
============================================================ */
const form = document.getElementById("billableItemForm");
const formContainer = document.getElementById("formContainer");
const desktopAddBtn = document.getElementById("desktopAddBtn");
const cancelBtn = document.getElementById("cancelBtn");
const clearBtn = document.getElementById("clearBtn");

/* ============================================================
   🧹 Reset Form Helper (ID-SAFE)
============================================================ */
function resetForm() {
  sharedState.currentEditIdRef.value = null;
  if (form) form.reset();

  // Clear cached edit state
  sessionStorage.removeItem("billableItemEditId");
  sessionStorage.removeItem("billableItemEditPayload");

  // Clear core text inputs
  ["name", "code", "description", "price"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });

  // Clear dropdowns / selects
  [
    "organizationSelect",
    "facilitySelect",
    "departmentSelect",
    "masterItemSelect",
  ].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });

  // Default status = active
  document.getElementById("status_active")?.setAttribute("checked", true);

  // Reset pill container (must retain ID)
  const pills = document.getElementById("itemPillsContainer");
  if (pills)
    pills.innerHTML = `<p class="text-muted">No billables added yet.</p>`;
}

/* ============================================================
   🧭 Form Show / Hide
============================================================ */
function showForm() {
  formContainer?.classList.remove("hidden");
  desktopAddBtn?.classList.add("hidden");
  localStorage.setItem("billableItemFormVisible", "true");
}

function hideForm() {
  resetForm();
  formContainer?.classList.add("hidden");
  desktopAddBtn?.classList.remove("hidden");
  localStorage.setItem("billableItemFormVisible", "false");
}

// 🌍 Expose globally (actions / hot reload)
window.showForm = showForm;
window.resetForm = resetForm;

/* ============================================================
   🔘 Button Wiring
============================================================ */
if (cancelBtn) {
  cancelBtn.onclick = () => {
    resetForm();
    window.location.href = "/billableitems-list.html";
  };
}

if (clearBtn) clearBtn.onclick = resetForm;

if (desktopAddBtn) {
  desktopAddBtn.onclick = () => {
    sessionStorage.removeItem("billableItemEditId");
    sessionStorage.removeItem("billableItemEditPayload");
    resetForm();
    showForm();
  };
}

/* ============================================================
   📦 Loader Placeholder (Form-only)
============================================================ */
async function loadEntries() {
  return; // list page owns data loading
}

/* ============================================================
   🚀 Init Entrypoint (MASTER PARITY)
============================================================ */
export async function initBillableItemModule() {
  // Form-only mode (matches Department / Patient)
  showForm();

  if (form) {
    setupBillableItemFormSubmission({
      form,
      token,
      sharedState,
      resetForm,
      loadEntries,
    });
  }

  // Ensure list panel stays hidden
  localStorage.setItem("billableItemPanelVisible", "false");

  /* ---------------- Role Normalization ---------------- */
  let roleRaw = localStorage.getItem("userRole") || "staff";
  let role = roleRaw.trim().toLowerCase();

  if (role.includes("super") && role.includes("admin")) role = "superadmin";
  else if (role.includes("admin")) role = "admin";
  else role = "staff";

  /* ---------------- Field Selector ---------------- */
  setupFieldSelector({
    module: "billable_items",
    fieldLabels: FIELD_LABELS_BILLABLE_ITEM,
    fieldOrder: FIELD_ORDER_BILLABLE_ITEM,
    defaultFields: FIELD_DEFAULTS_BILLABLE_ITEM[role],
  });
}

/* ============================================================
   🔁 State Sync Stub
============================================================ */
export function syncRefsToState() {
  // reserved for future enterprise reactive syncing
}
