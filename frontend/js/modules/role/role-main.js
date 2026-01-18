// 📦 role-main.js – Form-only loader for Role (Enterprise Master Pattern)
// ============================================================================
// 🧭 Mirrors patient-main.js structure
// 🔹 Auth guard + logout watcher
// 🔹 Unified form visibility + reset logic
// 🔹 Session-safe edit caching
// 🔹 Field selector integration
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
const form = document.getElementById("roleForm");
const formContainer = document.getElementById("formContainer");
const desktopAddBtn = document.getElementById("desktopAddBtn");
const cancelBtn = document.getElementById("cancelBtn");
const clearBtn = document.getElementById("clearBtn");

/* ============================================================
   🧹 Reset Form
============================================================ */
function resetForm() {
  sharedState.currentEditIdRef.value = null;
  form?.reset();

  sessionStorage.removeItem("roleEditId");
  sessionStorage.removeItem("roleEditPayload");

  ["name", "code", "description"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });

  ["organizationSelect", "facilitySelect"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });

  document.getElementById("status_active")?.setAttribute("checked", true);
  document.getElementById("is_system_false")?.setAttribute("checked", true);
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

// 🔗 Expose for action handlers
window.showForm = showForm;
window.resetForm = resetForm;

/* ============================================================
   🔘 Button Wiring
============================================================ */
cancelBtn &&
  (cancelBtn.onclick = () => {
    resetForm();
    window.location.href = "/roles-list.html";
  });

clearBtn && (clearBtn.onclick = resetForm);

desktopAddBtn &&
  (desktopAddBtn.onclick = () => {
    sessionStorage.removeItem("roleEditId");
    sessionStorage.removeItem("roleEditPayload");
    resetForm();
    showForm();
  });

/* ============================================================
   📦 Loader Placeholder
============================================================ */
async function loadEntries() {
  return; // handled by list page
}

/* ============================================================
   🚀 Init Entrypoint
============================================================ */
export async function initRoleModule() {
  localStorage.getItem("roleFormVisible") === "true"
    ? showForm()
    : hideForm();

  form &&
    setupRoleFormSubmission({
      form,
      token,
      sharedState,
      resetForm,
      loadEntries,
    });

  localStorage.setItem("rolePanelVisible", "false");

  /* -------- Normalize user role -------- */
  let roleRaw = localStorage.getItem("userRole") || "staff";
  let role = roleRaw.trim().toLowerCase();

  if (role.includes("super") && role.includes("admin")) role = "superadmin";
  else if (role.includes("admin")) role = "admin";
  else role = "staff";

  setupFieldSelector({
    module: "roles",
    fieldLabels: FIELD_LABELS_ROLE,
    fieldOrder: FIELD_ORDER_ROLE,
    defaultFields: FIELD_DEFAULTS_ROLE[role],
  });
}

/* ============================================================
   (Optional) Sync Stub
============================================================ */
export function syncRefsToState() {}
