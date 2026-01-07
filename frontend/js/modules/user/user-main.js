// 📦 user-main.js – Form-only loader for Users (Enterprise-Aligned)
// ============================================================================
// 🧭 Master Pattern: role-main.js / vital-main.js
// 🔹 Shared state, visibility restore, resetForm()
// 🔹 Permission auto-resolution (users:create / users:edit)
// 🔹 Preserves all original HTML IDs
// ============================================================================

import {
  initPageGuard,
  autoPagePermissionKey,
  initLogoutWatcher,
} from "../../utils/index.js";

import { setupUserFormSubmission } from "./user-form.js";

import {
  FIELD_LABELS_USER,
  FIELD_ORDER_USER,
  FIELD_DEFAULTS_USER,
} from "./user-constants.js";

import { setupFieldSelector } from "../../utils/ui-utils.js";

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
   📎 DOM Refs
============================================================ */
const form = document.getElementById("userForm");
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
  sessionStorage.removeItem("userEditId");
  sessionStorage.removeItem("userEditPayload");

  // Explicitly clear text fields
  ["username", "email", "first_name", "last_name", "password"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });

  // 🔴 HARD reset dropdowns
  const orgSelect = document.getElementById("organization_id");
  if (orgSelect) orgSelect.value = "";

  const facilitySelect = document.getElementById("facility_id");
  if (facilitySelect) {
    facilitySelect.innerHTML = `<option value="">-- Select Facility --</option>`;
  }

  const roleSelect = document.getElementById("role_id");
  if (roleSelect) {
    roleSelect.innerHTML = `<option value="">-- Select Role --</option>`;
  }

  // Default status → active
  const activeRadio = document.getElementById("status_active");
  if (activeRadio) activeRadio.checked = true;
}

/* ============================================================
   🧭 Form Visibility
============================================================ */
function showForm() {
  formContainer?.classList.remove("hidden");
  desktopAddBtn?.classList.add("hidden");
  localStorage.setItem("userFormVisible", "true");
}

function hideForm() {
  resetForm();
  formContainer?.classList.add("hidden");
  desktopAddBtn?.classList.remove("hidden");
  localStorage.setItem("userFormVisible", "false");
}

// 🔁 Expose globally (matches role-main.js)
window.showForm = showForm;
window.resetForm = resetForm;

/* ============================================================
   🔘 Button Wiring
============================================================ */
if (clearBtn) clearBtn.onclick = resetForm;

if (cancelBtn) {
  cancelBtn.onclick = () => {
    resetForm();
    window.location.href = "/users-list.html"; // ✅ plural redirect
  };
}

if (desktopAddBtn) {
  desktopAddBtn.onclick = () => {
    // Purge stale edit data
    sessionStorage.removeItem("userEditId");
    sessionStorage.removeItem("userEditPayload");

    resetForm();
    showForm();

    setupUserFormSubmission({
      form,
      token,
      sharedState,
      resetForm,
      loadEntries,
    });
  };
}

/* ============================================================
   🧰 Loader (no-op)
============================================================ */
async function loadEntries() {
  return; // list page handles this
}

/* ============================================================
   🚀 Module Initializer
============================================================ */
export async function initUser() {
  // Restore last form visibility
  const visible = localStorage.getItem("userFormVisible") === "true";
  if (visible) showForm();
  else hideForm();

  /* --------------------- Role Normalization --------------------- */
  let roleRaw = localStorage.getItem("userRole") || "staff";
  let role = roleRaw.trim().toLowerCase();

  if (role.includes("super") && role.includes("admin")) role = "superadmin";
  else if (role.includes("admin")) role = "admin";
  else role = "staff";

  /* --------------------- Field Selector --------------------- */
  setupFieldSelector({
    module: "user",
    fieldLabels: FIELD_LABELS_USER,
    fieldOrder: FIELD_ORDER_USER,
    defaultFields: FIELD_DEFAULTS_USER[role],
  });

  // Hide list panel on standalone form
  localStorage.setItem("userPanelVisible", "false");
}

/* ============================================================
   🔁 Sync Helper (reserved)
============================================================ */
export function syncRefsToState() {
  // Reserved for advanced reactive behavior
}
