// 📦 feature-module-main.js – Form-only loader for Feature Modules
// ============================================================================
// 🧭 Mirrors patient-main.js EXACTLY (structure + lifecycle)
// 🔹 Auth guard + logout watcher
// 🔹 Unified form visibility and reset logic
// 🔹 Session-safe edit caching + field selector integration
// 🔹 Preserves all existing DOM IDs and form logic
// ============================================================================

import { initPageGuard, initLogoutWatcher } from "../../utils/index.js";
import { setupFeatureModuleFormSubmission } from "./feature-module-form.js";
import {
  FIELD_LABELS_FEATURE_MODULE,
  FIELD_ORDER_FEATURE_MODULE,
  FIELD_DEFAULTS_FEATURE_MODULE,
} from "./feature-module-constants.js";
import { setupFieldSelector } from "../../utils/ui-utils.js";

/* ============================================================
   🔐 Auth Guard + Shared State
============================================================ */
const token = initPageGuard("feature_modules");
initLogoutWatcher();

const sharedState = {
  currentEditIdRef: { value: null },
};

/* ============================================================
   📎 DOM Refs
============================================================ */
const form = document.getElementById("featureModuleForm");
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
  sessionStorage.removeItem("featureModuleEditId");
  sessionStorage.removeItem("featureModuleEditPayload");

  // Explicitly clear text inputs
  [
    "name",
    "key",
    "icon",
    "category",
    "description",
    "tags",
    "route",
    "order_index",
    "dashboard_order",
  ].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });

  // Reset dropdowns
  const parentSelect = document.getElementById("parent_id");
  if (parentSelect) parentSelect.value = "";

  const tenantScope = document.getElementById("tenant_scope");
  if (tenantScope) tenantScope.value = "org";

  const dashboardType = document.getElementById("dashboard_type");
  if (dashboardType) dashboardType.value = "none";

  // Reset radios (defaults)
  document
    .querySelector('input[name="status"][value="active"]')
    ?.setAttribute("checked", true);

  document
    .querySelector('input[name="visibility"][value="public"]')
    ?.setAttribute("checked", true);

  // Reset checkboxes
  const enabledEl = document.getElementById("enabled");
  if (enabledEl) enabledEl.checked = true;

  const showDashboard = document.getElementById("show_on_dashboard");
  if (showDashboard) showDashboard.checked = false;
}

/* ============================================================
   🧭 Form Show / Hide
============================================================ */
function showForm() {
  formContainer?.classList.remove("hidden");
  desktopAddBtn?.classList.add("hidden");
  localStorage.setItem("featureModuleFormVisible", "true");
}

function hideForm() {
  resetForm();
  formContainer?.classList.add("hidden");
  desktopAddBtn?.classList.remove("hidden");
  localStorage.setItem("featureModuleFormVisible", "false");
}

// 🔗 Expose globally (for actions or hot reload)
window.showForm = showForm;
window.resetForm = resetForm;

/* ============================================================
   ⚙️ Wire Button Actions
============================================================ */
if (cancelBtn) {
  cancelBtn.onclick = () => {
    resetForm();
    window.location.href = "/feature-modules.html"; // ✅ redirect
  };
}

if (clearBtn) clearBtn.onclick = resetForm;

if (desktopAddBtn) {
  desktopAddBtn.onclick = () => {
    // 🧹 Clear any stale edit session data
    sessionStorage.removeItem("featureModuleEditId");
    sessionStorage.removeItem("featureModuleEditPayload");

    // Reset and open form in Add mode
    resetForm();
    showForm();
  };
}

/* ============================================================
   📦 Loader Placeholder
============================================================ */
async function loadEntries() {
  return; // placeholder (handled by list page)
}

/* ============================================================
   🚀 Init Entrypoint
============================================================ */
export async function initFeatureModule() {
  showForm(); // open by default for form-only mode

  setupFeatureModuleFormSubmission({
    form,
    token,
    sharedState,
    resetForm,
    loadEntries,
  });

  localStorage.setItem("featureModulePanelVisible", "false");

  // 🧩 Normalize role for field defaults (EXACT logic as Patient)
  let roleRaw = localStorage.getItem("userRole") || "staff";
  let role = roleRaw.trim().toLowerCase();

  if (role.includes("super") && role.includes("admin")) {
    role = "superadmin";
  } else if (role.includes("admin")) {
    role = "admin";
  } else {
    role = "staff";
  }

  setupFieldSelector({
    module: "feature_module",
    fieldLabels: FIELD_LABELS_FEATURE_MODULE,
    fieldOrder: FIELD_ORDER_FEATURE_MODULE,
    defaultFields: FIELD_DEFAULTS_FEATURE_MODULE[role],
  });
}

/* ============================================================
   (Optional) State Sync Stub
============================================================ */
export function syncRefsToState() {
  // no-op placeholder for consistency
}
