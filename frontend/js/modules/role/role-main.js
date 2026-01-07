// 📦 role-main.js – Form-only loader for Role (Enterprise-Aligned)
// ============================================================================
// 🧭 Master Pattern: vital-main.js
// 🔹 Maintains identical enterprise structure for consistency across modules
// 🔹 Includes role normalization, visibility toggling, shared state, and resetForm()
// 🔹 Preserves all original HTML IDs for full UI compatibility
// ============================================================================

import {
  initPageGuard,
  autoPagePermissionKey,
  initLogoutWatcher,
} from "../../utils/index.js";
import { setupRoleFormSubmission } from "./role-form.js";
import {
  FIELD_LABELS_ROLE,
  FIELD_ORDER_ROLE,
  FIELD_DEFAULTS_ROLE,
} from "./role-constants.js";
import { setupFieldSelector } from "../../utils/ui-utils.js";

/* ============================================================
   🔐 Auth + Global Guards
============================================================ */
// Automatically resolves correct permission ("roles:create" / "roles:edit")
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
const form = document.getElementById("roleForm");
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

  // Clear cached edit session
  sessionStorage.removeItem("roleEditId");
  sessionStorage.removeItem("roleEditPayload");

  // Clear key text fields
  ["name", "code", "description"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });

  // Dropdown resets
  ["organizationSelect", "facilitySelect"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });

  // Default radios
  const activeRadio = document.getElementById("status_active");
  if (activeRadio) activeRadio.checked = true;
  const customRadio = document.getElementById("is_system_false");
  if (customRadio) customRadio.checked = true;
}

/* ============================================================
   🧭 Form Visibility
============================================================ */
function showForm() {
  formContainer?.classList.remove("hidden");
  desktopAddBtn?.classList.add("hidden");
  localStorage.setItem("roleFormVisible", "true");
}

function hideForm() {
  resetForm();
  formContainer?.classList.add("hidden");
  desktopAddBtn?.classList.remove("hidden");
  localStorage.setItem("roleFormVisible", "false");
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
    window.location.href = "/roles-list.html"; // ✅ plural redirect
  };
}

if (clearBtn) clearBtn.onclick = resetForm;

if (desktopAddBtn) {
  desktopAddBtn.onclick = () => {
    // Purge stale edit data
    sessionStorage.removeItem("roleEditId");
    sessionStorage.removeItem("roleEditPayload");

    // Reset form for Add mode
    resetForm();
    showForm();
  };
}

/* ============================================================
   🧠 Loader (no-op)
============================================================ */
async function loadEntries() {
  return; // list page handles this
}

/* ============================================================
   🚀 Module Initializer
============================================================ */
export async function initRoleModule() {
  // Restore last form visibility state
  const visible = localStorage.getItem("roleFormVisible") === "true";
  if (visible) showForm();
  else hideForm();

  // Initialize form submission
  if (form) {
    setupRoleFormSubmission({
      form,
      token,
      sharedState,
      resetForm,
      loadEntries,
    });
  }

  // Hide list panel on standalone form
  localStorage.setItem("rolePanelVisible", "false");

  /* --------------------- Role Normalization --------------------- */
  let roleRaw = localStorage.getItem("userRole") || "staff";
  let role = roleRaw.trim().toLowerCase();

  if (role.includes("super") && role.includes("admin")) role = "superadmin";
  else if (role.includes("admin")) role = "admin";
  else role = "staff";

  /* --------------------- Field Selector Setup --------------------- */
  setupFieldSelector({
    module: "roles",
    fieldLabels: FIELD_LABELS_ROLE,
    fieldOrder: FIELD_ORDER_ROLE,
    defaultFields: FIELD_DEFAULTS_ROLE[role],
  });
}

/* ============================================================
   🔁 Sync Helper (reserved)
============================================================ */
export function syncRefsToState() {
  // Reserved for advanced reactive behavior
}
