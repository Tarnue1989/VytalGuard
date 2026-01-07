// 📦 master-item-main.js – Form-only Loader (Enterprise-Aligned + Feature Module Search)
// ============================================================================
// 🧭 Master Pattern: autoBillingRule-main.js / master-item-category-main.js / vital-main.js
// 🔹 Enterprise-consistent structure for form-only modules
// 🔹 Includes dynamic Feature Module search (UUID-safe, full integration)
// 🔹 Preserves all original HTML IDs and bindings for seamless UI integration
// ============================================================================

import {
  initPageGuard,
  autoPagePermissionKey,
  initLogoutWatcher,
  showToast,
  showLoading,
  hideLoading,
} from "../../utils/index.js";

import { setupMasterItemFormSubmission } from "./master-item-form.js";
import {
  FIELD_LABELS_MASTER_ITEM,
  FIELD_ORDER_MASTER_ITEM,
  FIELD_DEFAULTS_MASTER_ITEM,
} from "./master-item-constants.js";
import {
  setupFieldSelector,
} from "../../utils/ui-utils.js";
import {
  setupSuggestionInputDynamic, // ✅ For feature module dynamic search
  loadOrganizationsLite,
  loadFacilitiesLite,
  loadDepartmentsLite,
  loadMasterItemCategoriesLite,
  setupSelectOptions,
} from "../../utils/data-loaders.js";

/* ============================================================
   🔐 Auth + Global Guards
============================================================ */
const token = initPageGuard(autoPagePermissionKey());
initLogoutWatcher();

/* ============================================================
   🌐 Shared State
============================================================ */
const sharedState = {
  currentEditIdRef: { value: null },
};

/* ============================================================
   📎 DOM References
============================================================ */
const form = document.getElementById("masterItemForm");
const formContainer = document.getElementById("formContainer");
const desktopAddBtn = document.getElementById("desktopAddBtn");
const cancelBtn = document.getElementById("cancelBtn");
const clearBtn = document.getElementById("clearBtn");

// ✅ Feature Module dynamic fields
const featureModuleInput = document.getElementById("featureModuleInput");
const featureModuleId = document.getElementById("featureModuleId");
const featureModuleSuggestions = document.getElementById("featureModuleSuggestions");

/* ============================================================
   🧹 Reset Form Helper
============================================================ */
function resetForm() {
  sharedState.currentEditIdRef.value = null;
  if (form) form.reset();

  // Clear cached edit data
  sessionStorage.removeItem("masterItemEditId");
  sessionStorage.removeItem("masterItemEditPayload");

  // Reset text fields
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
  ].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });

  // Reset checkboxes
  ["is_controlled", "sample_required"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.checked = false;
  });

  // Reset dropdowns
  [
    "organizationSelect",
    "facilitySelect",
    "departmentSelect",
    "categorySelect",
    "itemType",
  ].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });

  // Reset Feature Module dynamic input
  if (featureModuleInput) featureModuleInput.value = "";
  if (featureModuleId) featureModuleId.value = "";

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
  localStorage.setItem("masterItemFormVisible", "true");
}

function hideForm() {
  resetForm();
  formContainer?.classList.add("hidden");
  desktopAddBtn?.classList.remove("hidden");
  localStorage.setItem("masterItemFormVisible", "false");
}

// 🌍 Expose globally for reuse by other modules
window.showForm = showForm;
window.resetForm = resetForm;

/* ============================================================
   🔘 Button Wiring
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
    // 🧹 Remove stale edit data
    sessionStorage.removeItem("masterItemEditId");
    sessionStorage.removeItem("masterItemEditPayload");
    resetForm();
    showForm();
  };
}

/* ============================================================
   🗂️ Loader (No-Op)
============================================================ */
async function loadEntries() {
  return; // handled by list page
}

/* ============================================================
   🚀 Module Initializer
============================================================ */
export async function initMasterItemModule() {
  try {
    // Restore last visibility state
    const visible = localStorage.getItem("masterItemFormVisible") === "true";
    if (visible) showForm();
    else hideForm();

    // Initialize form submission
    if (form) {
      setupMasterItemFormSubmission({
        form,
        token,
        sharedState,
        resetForm,
        loadEntries,
      });
    }

    // Hide any list panel (form-only mode)
    localStorage.setItem("masterItemPanelVisible", "false");

    /* --------------------- Role Normalization --------------------- */
    let roleRaw = localStorage.getItem("userRole") || "staff";
    let role = roleRaw.trim().toLowerCase();

    if (role.includes("super") && role.includes("admin")) role = "superadmin";
    else if (role.includes("admin")) role = "admin";
    else role = "staff";

    /* --------------------- Field Selector Setup --------------------- */
    setupFieldSelector({
      module: "master_items",
      fieldLabels: FIELD_LABELS_MASTER_ITEM,
      fieldOrder: FIELD_ORDER_MASTER_ITEM,
      defaultFields: FIELD_DEFAULTS_MASTER_ITEM[role],
    });

    /* ============================================================
       🔍 Dynamic Feature Module Search Setup (UUID-safe)
    ============================================================ */
    if (featureModuleInput && featureModuleSuggestions) {
      try {
        setupSuggestionInputDynamic(
          featureModuleInput,
          featureModuleSuggestions,
          "/api/lite/feature-modules", // 🔹 API route for dynamic search
          (item) => {
            featureModuleInput.value = item.name;
            featureModuleId.value = item.id;
          },
          "name"
        );
      } catch (err) {
        console.error("❌ Feature module search setup failed:", err);
      }
    }
  } catch (err) {
    console.error("❌ initMasterItemModule failed:", err);
    showToast("❌ Could not initialize Master Item form");
  }
}

/* ============================================================
   🔁 Sync Helper (Reserved)
============================================================ */
export function syncRefsToState() {
  // Reserved for reactive synchronization
}
