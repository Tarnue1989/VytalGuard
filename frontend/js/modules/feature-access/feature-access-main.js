// 📦 feature-access-main.js – Form-only loader for Feature Access

import { initPageGuard, initLogoutWatcher } from "../../utils/index.js";
import { setupFeatureAccessFormSubmission } from "./feature-access-form.js";
import {
  FIELD_LABELS_FEATURE_ACCESS,
  FIELD_ORDER_FEATURE_ACCESS,
  FIELD_DEFAULTS_FEATURE_ACCESS,
} from "./feature-access-constants.js";
import { setupFieldSelector } from "../../utils/ui-utils.js"; 

// 🔐 Auth – driven by backend permission key
initPageGuard("feature_accesses");

// 🔁 Global logout watcher
initLogoutWatcher();

// 🌐 Shared State (kept consistent with other modules)
const sharedState = {
  currentEditIdRef: { value: null },
};

// 📎 DOM Refs
const form = document.getElementById("featureAccessForm");
const formContainer = document.getElementById("formContainer");
const desktopAddBtn = document.getElementById("desktopAddBtn");
const clearBtn = document.getElementById("clearBtn");

/* ------------------------- Helpers ------------------------- */

// 🧹 Reset form
function resetForm() {
  sharedState.currentEditIdRef.value = null;
  if (form) form.reset();

  // Explicitly clear dropdowns
  ["organization_id", "module_id", "role_id", "facility_id", "status"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });

  // Reset radios (default: active)
  const activeRadio = document.getElementById("status_active");
  if (activeRadio) activeRadio.checked = true;
}

// 🧭 Form show/hide
function showForm() {
  formContainer?.classList.remove("hidden");
  desktopAddBtn?.classList.add("hidden");
  localStorage.setItem("featureAccessFormVisible", "true");
}

function hideForm() {
  resetForm();
  formContainer?.classList.add("hidden");
  desktopAddBtn?.classList.remove("hidden");
  localStorage.setItem("featureAccessFormVisible", "false");
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

export async function initFeatureAccess() {
  showForm(); // open the form by default
  setupFeatureAccessFormSubmission({ form, sharedState, resetForm, loadEntries });

  // 📌 Setup "Select Fields" dropdown for Feature Access
  const role = (localStorage.getItem("userRole") || "staff").toLowerCase();
  setupFieldSelector({
    module: "feature_access",
    fieldLabels: FIELD_LABELS_FEATURE_ACCESS,
    fieldOrder: FIELD_ORDER_FEATURE_ACCESS,
    defaultFields: FIELD_DEFAULTS_FEATURE_ACCESS[role],
  });

  localStorage.setItem("featureAccessPanelVisible", "false");
}

// (Optional) If other modules expect this
export function syncRefsToState() {
  // no-op
}
