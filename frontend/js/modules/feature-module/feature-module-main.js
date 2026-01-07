// 📦 feature-module-main.js – Form-only loader for Feature Modules

import { initPageGuard, initLogoutWatcher } from "../../utils/index.js";
import { setupFeatureModuleFormSubmission } from "./feature-module-form.js";
import {
  FIELD_LABELS_FEATURE_MODULE,
  FIELD_ORDER_FEATURE_MODULE,
  FIELD_DEFAULTS_FEATURE_MODULE,
} from "./feature-module-constants.js";
import { setupFieldSelector } from "../../utils/ui-utils.js"; // ✅ uses constants now

// 🔐 Auth – driven by backend permission key
initPageGuard("feature_modules");

// 🔁 Global logout watcher
initLogoutWatcher();

// 🌐 Shared State (kept consistent with other modules)
const sharedState = {
  currentEditIdRef: { value: null },
};

// 📎 DOM Refs
const form = document.getElementById("featureModuleForm");
const formContainer = document.getElementById("formContainer");
const desktopAddBtn = document.getElementById("desktopAddBtn");
const clearBtn = document.getElementById("clearBtn");

/* ------------------------- Helpers ------------------------- */

// 🧹 Reset form
function resetForm() {
  sharedState.currentEditIdRef.value = null;
  if (form) form.reset();

  // Explicitly clear text fields
  ["name", "key", "icon", "category", "description", "tags", "route"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });

  // Reset dropdowns
  const parentSelect = document.getElementById("parent_id");
  if (parentSelect) parentSelect.value = "";

  // Reset radios (defaults)
  const activeRadio = document.getElementById("status_active");
  if (activeRadio) activeRadio.checked = true;

  const publicRadio = document.getElementById("visibility_public");
  if (publicRadio) publicRadio.checked = true;

  // Reset checkbox
  const enabledEl = document.getElementById("enabled");
  if (enabledEl) enabledEl.checked = false;
}

// 🧭 Form show/hide
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

/* ------------------------- Wire Buttons ------------------------- */

if (clearBtn) clearBtn.onclick = resetForm;
if (desktopAddBtn) desktopAddBtn.onclick = showForm;

/* ------------------------- Loader ------------------------- */

// 🧰 Minimal no-op loader (compatibility with form.js)
async function loadEntries() {
  return;
}

/* ------------------------- Init ------------------------- */

export async function initFeatureModule() {
  showForm(); // open the form by default
  setupFeatureModuleFormSubmission({ form, sharedState, resetForm, loadEntries });

  // 📌 Setup "Select Fields" dropdown for Feature Modules
  const role = (localStorage.getItem("userRole") || "staff").toLowerCase();
  setupFieldSelector({
    module: "feature_module",
    fieldLabels: FIELD_LABELS_FEATURE_MODULE,
    fieldOrder: FIELD_ORDER_FEATURE_MODULE,
    defaultFields: FIELD_DEFAULTS_FEATURE_MODULE[role],
  });

  localStorage.setItem("featureModulePanelVisible", "false");
}

// (Optional) If other modules expect this
export function syncRefsToState() {
  // no-op
}
