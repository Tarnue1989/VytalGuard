// 📦 master-item-main.js – Form-only loader for Master Item (Enterprise Master Pattern)
// ============================================================================
// 🧭 Mirrors department-main.js structure EXACTLY
// 🔹 Auth guard + logout watcher
// 🔹 Unified form visibility and reset logic
// 🔹 Session-safe edit caching
// 🔹 Field selector integration (role-aware)
// 🔹 100% ID-safe and controller-aligned
// ============================================================================

import { initPageGuard, initLogoutWatcher } from "../../utils/index.js";
import { setupMasterItemFormSubmission } from "./master-item-form.js";
import {
  FIELD_LABELS_MASTER_ITEM,
  FIELD_ORDER_MASTER_ITEM,
  FIELD_DEFAULTS_MASTER_ITEM,
} from "./master-item-constants.js";
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
const form = document.getElementById("masterItemForm");
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
  sessionStorage.removeItem("masterItemEditId");
  sessionStorage.removeItem("masterItemEditPayload");

  // Clear text inputs
  [
    "name",
    "code",
    "generic_group",
    "strength",
    "dosage_form",
    "unit",
    "reorder_level",
    "reference_price",
    "currency",
    "test_method",
    "featureModuleInput",
  ].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });

  // Clear selects / hidden fields
  [
    "organizationSelect",
    "facilitySelect",
    "departmentSelect",
    "categorySelect",
    "itemType",
    "featureModuleId",
  ].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });

  // Clear checkboxes
  ["is_controlled", "sample_required"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.checked = false;
  });

  // Default status = active
  document.getElementById("status_active")?.setAttribute("checked", true);
}

/* ============================================================
   🧭 Form Show / Hide
============================================================ */
function showForm() {
  formContainer?.classList.remove("hidden");
  desktopAddBtn?.classList.add("hidden");
  localStorage.setItem("masterItemFormVisible", "true");
}

function hideForm() {
  resetForm();
  formContainer?.classList.add("hidden");
  desktopAddBtn?.classList.remove("hidden");
  localStorage.setItem("masterItemFormVisible", "false");
}

// 🔗 Expose globally (actions / hot reload)
window.showForm = showForm;
window.resetForm = resetForm;

/* ============================================================
   ⚙️ Button Wiring
============================================================ */
if (cancelBtn) {
  cancelBtn.onclick = () => {
    resetForm();
    window.location.href = "/master-items-list.html";
  };
}

if (clearBtn) clearBtn.onclick = resetForm;

if (desktopAddBtn) {
  desktopAddBtn.onclick = () => {
    sessionStorage.removeItem("masterItemEditId");
    sessionStorage.removeItem("masterItemEditPayload");
    resetForm();
    showForm();
  };
}

/* ============================================================
   📦 Loader Placeholder
============================================================ */
async function loadEntries() {
  return; // handled by list page
}

/* ============================================================
   🚀 Init Entrypoint
============================================================ */
export async function initMasterItemModule() {
  showForm(); // form-only mode (EXACT match with Department)

  if (form) {
    setupMasterItemFormSubmission({
      form,
      token,
      sharedState,
      resetForm,
      loadEntries,
    });
  }

  localStorage.setItem("masterItemPanelVisible", "false");

  // Normalize role for field defaults
  let roleRaw = localStorage.getItem("userRole") || "staff";
  let role = roleRaw.trim().toLowerCase();

  if (role.includes("super") && role.includes("admin")) role = "superadmin";
  else if (role.includes("admin")) role = "admin";
  else role = "staff";

  setupFieldSelector({
    module: "master_items",
    fieldLabels: FIELD_LABELS_MASTER_ITEM,
    fieldOrder: FIELD_ORDER_MASTER_ITEM,
    defaultFields: FIELD_DEFAULTS_MASTER_ITEM[role],
  });
}

/* ============================================================
   (Optional) State Sync Stub
============================================================ */
export function syncRefsToState() {
  // reserved for future reactive syncing
}
