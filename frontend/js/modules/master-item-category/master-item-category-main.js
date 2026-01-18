// 📦 master-item-category-main.js – Form-only Loader (Enterprise-Aligned)
// ============================================================================
// 🧭 Master Pattern: role-main.js / vital-main.js
// 🔹 Enterprise-consistent structure for form-only modules
// 🔹 Includes permission guard, shared state, reset/show/hide form logic
// 🔹 Preserves all original HTML IDs and bindings for seamless UI integration
// ============================================================================

import {
  initPageGuard,
  autoPagePermissionKey,
  initLogoutWatcher,
} from "../../utils/index.js";
import { setupMasterItemCategoryFormSubmission } from "./master-item-category-form.js";
import {
  FIELD_LABELS_MASTER_ITEM_CATEGORY,
  FIELD_ORDER_MASTER_ITEM_CATEGORY,
  FIELD_DEFAULTS_MASTER_ITEM_CATEGORY,
} from "./master-item-category-constants.js";
import { setupFieldSelector } from "../../utils/ui-utils.js";

/* ============================================================
   🔐 Auth + Global Guards
============================================================ */
// Automatically resolves permission key (create/edit) based on page context
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
const form = document.getElementById("masterItemCategoryForm");
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

  // Clear cached edit data
  sessionStorage.removeItem("masterItemCategoryEditId");
  sessionStorage.removeItem("masterItemCategoryEditPayload");

  // Reset text fields
  ["name", "code", "description"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });

  // Reset dropdowns
  ["organizationSelect", "facilitySelect"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });

  // Default status → Active
  const activeRadio = document.getElementById("status_active");
  if (activeRadio) activeRadio.checked = true;
}

/* ============================================================
   🧭 Form Visibility
============================================================ */
function showForm() {
  formContainer?.classList.remove("hidden");
  desktopAddBtn?.classList.add("hidden");
  localStorage.setItem("masterItemCategoryFormVisible", "true");
}

function hideForm() {
  resetForm();
  formContainer?.classList.add("hidden");
  desktopAddBtn?.classList.remove("hidden");
  localStorage.setItem("masterItemCategoryFormVisible", "false");
}

// Expose globally for reuse by action handlers
window.showForm = showForm;
window.resetForm = resetForm;

/* ============================================================
   🔘 Button Wiring
============================================================ */
if (cancelBtn) {
  cancelBtn.onclick = () => {
    resetForm();
    window.location.href = "/master-item-categories-list.html";
  };
}

if (clearBtn) clearBtn.onclick = resetForm;

if (desktopAddBtn) {
  desktopAddBtn.onclick = () => {
    sessionStorage.removeItem("masterItemCategoryEditId");
    sessionStorage.removeItem("masterItemCategoryEditPayload");
    resetForm();
    showForm();
  };
}

/* ============================================================
   🧠 Loader (no-op)
============================================================ */
async function loadEntries() {
  return; // list module handles this
}

/* ============================================================
   🚀 Module Initializer
============================================================ */
export async function initMasterItemCategoryModule() {
  // Restore last visibility state
  const visible =
    localStorage.getItem("masterItemCategoryFormVisible") === "true";
  if (visible) showForm();
  else hideForm();

  // Initialize form submission
  if (form) {
    setupMasterItemCategoryFormSubmission({
      form,
      token,
      sharedState,
      resetForm,
      loadEntries,
    });
  }

  // Hide any list panel (form-only mode)
  localStorage.setItem("masterItemCategoryPanelVisible", "false");

  /* --------------------- Role Normalization --------------------- */
  let roleRaw = localStorage.getItem("userRole") || "staff";
  let role = roleRaw.trim().toLowerCase();

  if (role.includes("super") && role.includes("admin")) role = "superadmin";
  else if (role.includes("admin")) role = "admin";
  else role = "staff";

  /* --------------------- Field Selector Setup --------------------- */
  setupFieldSelector({
    module: "master_item_categories",
    fieldLabels: FIELD_LABELS_MASTER_ITEM_CATEGORY,
    fieldOrder: FIELD_ORDER_MASTER_ITEM_CATEGORY,
    defaultFields: FIELD_DEFAULTS_MASTER_ITEM_CATEGORY[role],
  });
}

/* ============================================================
   🔁 Sync Helper (reserved)
============================================================ */
export function syncRefsToState() {
  // Reserved for reactive synchronization
}
