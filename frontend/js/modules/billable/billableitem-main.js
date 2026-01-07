// 📦 billableitem-main.js – Form-Only Loader for Billable Items (Enterprise-Aligned)
// ============================================================================
// 🧭 Master Pattern: department-main.js (Form-only mode)
// 🔹 Full enterprise structure: auth guard, logout watcher, reset/show/hide logic
// 🔹 Role-based field selector & visibility
// 🔹 Retains all pill-related IDs and linked components
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
   🔐 Auth + Global Guards
============================================================ */
// Automatically resolves correct permission ("billable_items:create" / "billable_items:edit")
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
const form = document.getElementById("billableItemForm");
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

  // 🧩 Clear cached edit session
  sessionStorage.removeItem("billableItemEditId");
  sessionStorage.removeItem("billableItemEditPayload");

  // 🧽 Clear core input fields
  ["name", "code", "description", "price"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });

  // 🏢 Reset dropdowns
  [
    "organizationSelect",
    "facilitySelect",
    "departmentSelect",
    "masterItemSelect",
  ].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });

  // ✅ Default status active
  const activeRadio = document.getElementById("status_active");
  if (activeRadio) activeRadio.checked = true;

  // 🧱 Clear pill container
  const pillsContainer = document.getElementById("itemPillsContainer");
  if (pillsContainer)
    pillsContainer.innerHTML = `<p class="text-muted">No billables added yet.</p>`;
}

/* ============================================================
   🧭 Form Visibility
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

// 🌐 Expose globally for action handlers
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
    // 🧹 Clear stale session data
    sessionStorage.removeItem("billableItemEditId");
    sessionStorage.removeItem("billableItemEditPayload");

    // Reset and display form for Add mode
    resetForm();
    showForm();
  };
}

/* ============================================================
   🧠 Loader (no-op for form-only mode)
============================================================ */
async function loadEntries() {
  return; // list page handles entries
}

/* ============================================================
   🚀 Module Initializer
============================================================ */
export async function initBillableItemModule() {
  // Restore previous visibility state
  const visible = localStorage.getItem("billableItemFormVisible") === "true";
  if (visible) showForm();
  else hideForm();

  // Initialize form submission logic
  if (form) {
    setupBillableItemFormSubmission({
      form,
      token,
      sharedState,
      resetForm,
      loadEntries,
    });
  }

  // Hide list panel for standalone form mode
  localStorage.setItem("billableItemPanelVisible", "false");

  /* --------------------- Role Normalization --------------------- */
  let roleRaw = localStorage.getItem("userRole") || "staff";
  let role = roleRaw.trim().toLowerCase();

  if (role.includes("super") && role.includes("admin")) role = "superadmin";
  else if (role.includes("admin")) role = "admin";
  else role = "staff";

  /* --------------------- Field Selector Setup --------------------- */
  setupFieldSelector({
    module: "billable_items",
    fieldLabels: FIELD_LABELS_BILLABLE_ITEM,
    fieldOrder: FIELD_ORDER_BILLABLE_ITEM,
    defaultFields: FIELD_DEFAULTS_BILLABLE_ITEM[role],
  });
}

/* ============================================================
   🔁 Sync Helper (reserved for reactive updates)
============================================================ */
export function syncRefsToState() {
  // Reserved for enterprise reactive form syncing
}
