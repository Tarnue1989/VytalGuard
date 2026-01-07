// 📦 department-main.js – Form-only loader for Department (Enterprise-Aligned)
// ============================================================================
// 🧭 Master Pattern: role-main.js / vital-main.js
// 🔹 Identical enterprise structure (auth guard, reset, visibility, shared state)
// 🔹 Supports full department field schema + role-based visibility
// 🔹 100% ID-safe for existing HTML and JS integration
// ============================================================================

import {
  initPageGuard,
  autoPagePermissionKey,
  initLogoutWatcher,
} from "../../utils/index.js";
import { setupDepartmentFormSubmission } from "./department-form.js";
import {
  FIELD_LABELS_DEPARTMENT,
  FIELD_ORDER_DEPARTMENT,
  FIELD_DEFAULTS_DEPARTMENT,
} from "./department-constants.js";
import { setupFieldSelector } from "../../utils/ui-utils.js";

/* ============================================================
   🔐 Auth + Global Guards
============================================================ */
// Automatically resolves correct permission ("departments:create" / "departments:edit")
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
const form = document.getElementById("departmentForm");
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
  sessionStorage.removeItem("departmentEditId");
  sessionStorage.removeItem("departmentEditPayload");

  // 🧽 Clear core input fields
  ["name", "code", "description", "headInput"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });

  // 🏢 Reset dropdowns
  ["organizationSelect", "facilitySelect"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });

  // 👤 Clear hidden IDs
  const headId = document.getElementById("headId");
  if (headId) headId.value = "";

  // ✅ Default status active
  const activeRadio = document.getElementById("status_active");
  if (activeRadio) activeRadio.checked = true;
}

/* ============================================================
   🧭 Form Visibility
============================================================ */
function showForm() {
  formContainer?.classList.remove("hidden");
  desktopAddBtn?.classList.add("hidden");
  localStorage.setItem("departmentFormVisible", "true");
}

function hideForm() {
  resetForm();
  formContainer?.classList.add("hidden");
  desktopAddBtn?.classList.remove("hidden");
  localStorage.setItem("departmentFormVisible", "false");
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
    window.location.href = "/departments-list.html"; // ✅ plural redirect
  };
}

if (clearBtn) clearBtn.onclick = resetForm;

if (desktopAddBtn) {
  desktopAddBtn.onclick = () => {
    // 🧹 Clear stale session data
    sessionStorage.removeItem("departmentEditId");
    sessionStorage.removeItem("departmentEditPayload");

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
export async function initDepartmentModule() {
  // Restore previous form visibility
  const visible = localStorage.getItem("departmentFormVisible") === "true";
  if (visible) showForm();
  else hideForm();

  // Initialize form submission behavior
  if (form) {
    setupDepartmentFormSubmission({
      form,
      token,
      sharedState,
      resetForm,
      loadEntries,
    });
  }

  // Hide list panel for standalone form
  localStorage.setItem("departmentPanelVisible", "false");

  /* --------------------- Role Normalization --------------------- */
  let roleRaw = localStorage.getItem("userRole") || "staff";
  let role = roleRaw.trim().toLowerCase();

  if (role.includes("super") && role.includes("admin")) role = "superadmin";
  else if (role.includes("admin")) role = "admin";
  else role = "staff";

  /* --------------------- Field Selector Setup --------------------- */
  setupFieldSelector({
    module: "departments",
    fieldLabels: FIELD_LABELS_DEPARTMENT,
    fieldOrder: FIELD_ORDER_DEPARTMENT,
    defaultFields: FIELD_DEFAULTS_DEPARTMENT[role],
  });
}

/* ============================================================
   🔁 Sync Helper (reserved for future reactive linking)
============================================================ */
export function syncRefsToState() {
  // Reserved for enterprise reactive form state syncing
}
