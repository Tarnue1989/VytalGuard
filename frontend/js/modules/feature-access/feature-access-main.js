// 📦 feature-access-main.js – FINAL (CARD SYSTEM READY)

import { initPageGuard, initLogoutWatcher } from "../../utils/index.js";
import { setupFeatureAccessFormSubmission } from "./feature-access-form.js";
import {
  FIELD_LABELS_FEATURE_ACCESS,
  FIELD_ORDER_FEATURE_ACCESS,
  FIELD_DEFAULTS_FEATURE_ACCESS,
} from "./feature-access-constants.js";
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
const form = document.getElementById("featureAccessForm");
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
  sessionStorage.removeItem("featureAccessEditId");
  sessionStorage.removeItem("featureAccessEditPayload");

  // ❌ removed module_id
  ["organization_id", "role_id", "facility_id"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });

  // ✅ Correct status reset
  document
    .querySelector('input[name="status"][value="active"]')
    ?.click();
}

/* ============================================================
   🧭 Form Show / Hide
============================================================ */
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

// expose globally (kept for parity)
window.showForm = showForm;
window.resetForm = resetForm;

/* ============================================================
   ⚙️ Wire Buttons
============================================================ */
if (cancelBtn) {
  cancelBtn.onclick = () => {
    resetForm();
    window.location.href = "/feature-access.html";
  };
}

if (clearBtn) clearBtn.onclick = resetForm;

if (desktopAddBtn) {
  desktopAddBtn.onclick = () => {
    sessionStorage.removeItem("featureAccessEditId");
    sessionStorage.removeItem("featureAccessEditPayload");
    resetForm();
    showForm();
  };
}

/* ============================================================
   📦 Loader Stub
============================================================ */
async function loadEntries() {
  return;
}

/* ============================================================
   🚀 INIT
============================================================ */
export async function initFeatureAccess() {
  showForm();

  setupFeatureAccessFormSubmission({
    form,
    sharedState,
    resetForm,
    loadEntries,
  });

  localStorage.setItem("featureAccessPanelVisible", "false");

  /* ================= ROLE NORMALIZATION ================= */
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
    module: "feature_access",
    fieldLabels: FIELD_LABELS_FEATURE_ACCESS,
    fieldOrder: FIELD_ORDER_FEATURE_ACCESS,
    defaultFields: FIELD_DEFAULTS_FEATURE_ACCESS[role],
  });
}

/* ============================================================
   (Optional) State Sync Stub
============================================================ */
export function syncRefsToState() {
  // no-op
}