// 📦 stockrequest-main.js – Form-only loader for Stock Request (Master Pattern Aligned)

import {
  initPageGuard,
  autoPagePermissionKey,
  initLogoutWatcher,
} from "../../utils/index.js";
import { setupStockRequestFormSubmission } from "./stockrequest-form.js";
import {
  FIELD_LABELS_STOCK_REQUEST,
  FIELD_ORDER_STOCK_REQUEST,
  FIELD_DEFAULTS_STOCK_REQUEST,
} from "./stockrequest-constants.js";
import { setupFieldSelector } from "../../utils/ui-utils.js";

/* ============================================================
   🔐 Auth + Global Guards
============================================================ */
// Automatically resolves correct permission ("stock_requests:create" / "stock_requests:edit")
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
const form = document.getElementById("stockRequestForm");
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
  sessionStorage.removeItem("stockRequestEditId");
  sessionStorage.removeItem("stockRequestEditPayload");

  // Clear text inputs
  ["referenceNumber", "notes", "quantity", "remarks"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });

  // Reset dropdowns
  ["organizationSelect", "facilitySelect", "departmentSelect"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });

  // Reset pill container
  const pillsContainer = document.getElementById("itemPillsContainer");
  if (pillsContainer)
    pillsContainer.innerHTML = `<p class="text-muted">No items added yet.</p>`;
}

/* ============================================================
   🧭 Form Visibility
============================================================ */
function showForm() {
  formContainer?.classList.remove("hidden");
  desktopAddBtn?.classList.add("hidden");
  localStorage.setItem("stockRequestFormVisible", "true");
}

function hideForm() {
  resetForm();
  formContainer?.classList.add("hidden");
  desktopAddBtn?.classList.remove("hidden");
  localStorage.setItem("stockRequestFormVisible", "false");
}

// Expose globally for reuse (view/edit actions)
window.showForm = showForm;
window.resetForm = resetForm;

/* ============================================================
   🔘 Button Wiring
============================================================ */
if (cancelBtn) {
  cancelBtn.onclick = () => {
    resetForm();
    window.location.href = "/stockrequests-list.html"; // ✅ plural redirect
  };
}

if (clearBtn) clearBtn.onclick = resetForm;

if (desktopAddBtn) {
  desktopAddBtn.onclick = () => {
    // Purge stale edit session
    sessionStorage.removeItem("stockRequestEditId");
    sessionStorage.removeItem("stockRequestEditPayload");

    // Reset & open fresh form
    resetForm();
    showForm();
  };
}

/* ============================================================
   🧠 Loader (no-op)
============================================================ */
async function loadEntries() {
  return; // list page handles loading
}

/* ============================================================
   🚀 Module Initializer
============================================================ */
export async function initStockRequestModule() {
  showForm(); // auto-open form on standalone page

  setupStockRequestFormSubmission({
    form,
    token,
    sharedState,
    resetForm,
    loadEntries,
  });

  localStorage.setItem("stockRequestPanelVisible", "false");

  // Normalize role for field defaults
  let roleRaw = localStorage.getItem("userRole") || "staff";
  let role = roleRaw.trim().toLowerCase();

  if (role.includes("super") && role.includes("admin")) role = "superadmin";
  else if (role.includes("admin")) role = "admin";
  else role = "staff";

  // 🧩 Initialize Field Selector (role-based)
  setupFieldSelector({
    module: "stock_request",
    fieldLabels: FIELD_LABELS_STOCK_REQUEST,
    fieldOrder: FIELD_ORDER_STOCK_REQUEST,
    defaultFields: FIELD_DEFAULTS_STOCK_REQUEST[role],
  });
}

/* ============================================================
   🔁 Sync Helper
============================================================ */
export function syncRefsToState() {
  // reserved for advanced reactive integrations
}
