// 📦 centralstock-main.js – Form-only Loader for Central Stock (ENTERPRISE MASTER PARITY)
// ============================================================================
// 🧭 FULL PARITY WITH billableitem-main.js (Form-only mode)
// 🔹 Auth guard + logout watcher
// 🔹 Unified form visibility + reset logic
// 🔹 Session-safe edit caching (ID ref only)
// 🔹 Role-based field selector (enterprise-aligned)
// 🔹 100% ID-safe (pills, inputs, buttons preserved)
// 🔹 ❌ NEVER detect edit via URL
// 🔹 ❌ NEVER fetch edit payload here
// 🔹 ❌ NEVER touch pill state directly
// ============================================================================

import {
  initPageGuard,
  autoPagePermissionKey,
  initLogoutWatcher,
} from "../../utils/index.js";

import { setupCentralStockFormSubmission } from "./centralstock-form.js";

import {
  FIELD_LABELS_CENTRAL_STOCK,
  FIELD_ORDER_CENTRAL_STOCK,
  FIELD_DEFAULTS_CENTRAL_STOCK,
} from "./centralstock-constants.js";

import { setupFieldSelector } from "../../utils/ui-utils.js";

/* ============================================================
   🔐 Auth Guard + Shared State
============================================================ */
initPageGuard(autoPagePermissionKey());
initLogoutWatcher();

const sharedState = {
  currentEditIdRef: { value: null },
};

/* ============================================================
   📎 DOM Refs
============================================================ */
const form = document.getElementById("centralStockForm");
const formContainer = document.getElementById("formContainer");
const desktopAddBtn = document.getElementById("desktopAddBtn");
const cancelBtn = document.getElementById("cancelBtn");
const clearBtn = document.getElementById("clearBtn");

/* ============================================================
   🧹 Reset Form Helper (ID-SAFE — MASTER PARITY)
============================================================ */
function resetForm() {
  sharedState.currentEditIdRef.value = null;

  if (form) form.reset();

  // Clear cached edit state
  sessionStorage.removeItem("centralStockEditId");
  sessionStorage.removeItem("centralStockEditPayload");

  // Clear core inputs
  ["batchNumber", "quantity", "receivedDate", "expiryDate", "notes"].forEach(
    (id) => {
      const el = document.getElementById(id);
      if (el) el.value = "";
    }
  );

  // Clear selects
  ["organizationSelect", "facilitySelect", "supplierSelect"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });

  // Reset pills container (ID preserved)
  const pills = document.getElementById("itemPillsContainer");
  if (pills)
    pills.innerHTML = `<p class="text-muted">No items added yet.</p>`;

  // Reset submit label
  const submitBtn = form?.querySelector("button[type=submit]");
  if (submitBtn)
    submitBtn.innerHTML = `<i class="ri-save-3-line me-1"></i> Submit All`;
}

/* ============================================================
   🧭 Form Show / Hide
============================================================ */
function showForm() {
  formContainer?.classList.remove("hidden");
  desktopAddBtn?.classList.add("hidden");
  localStorage.setItem("centralStockFormVisible", "true");
}

function hideForm() {
  resetForm();
  formContainer?.classList.add("hidden");
  desktopAddBtn?.classList.remove("hidden");
  localStorage.setItem("centralStockFormVisible", "false");
}

// 🌍 Expose globally (actions / hot reload)
window.showForm = showForm;
window.resetForm = resetForm;

/* ============================================================
   🔘 Button Wiring (MASTER PARITY)
============================================================ */
if (cancelBtn) {
  cancelBtn.onclick = () => {
    resetForm();
    window.location.href = "/centralstocks-list.html";
  };
}

if (clearBtn) clearBtn.onclick = resetForm;

if (desktopAddBtn) {
  desktopAddBtn.onclick = () => {
    sessionStorage.removeItem("centralStockEditId");
    sessionStorage.removeItem("centralStockEditPayload");
    resetForm();
    showForm();
  };
}

/* ============================================================
   📦 Loader Placeholder (Form-only)
============================================================ */
async function loadEntries() {
  return; // list page owns data loading
}

/* ============================================================
   🚀 Init Entrypoint (MASTER PARITY)
============================================================ */
export async function initCentralStockModule() {
  // Form-only mode
  showForm();

  if (form) {
    setupCentralStockFormSubmission({
      form,
      sharedState,
      resetForm,
      loadEntries,
    });
  }

  // Ensure list panel stays hidden
  localStorage.setItem("centralStockPanelVisible", "false");

  /* ---------------- Role Normalization ---------------- */
  let roleRaw = localStorage.getItem("userRole") || "staff";
  let role = roleRaw.trim().toLowerCase();

  if (role.includes("super") && role.includes("admin")) role = "superadmin";
  else if (role.includes("admin")) role = "admin";
  else role = "staff";

  /* ---------------- Field Selector ---------------- */
  setupFieldSelector({
    module: "central_stock",
    fieldLabels: FIELD_LABELS_CENTRAL_STOCK,
    fieldOrder: FIELD_ORDER_CENTRAL_STOCK,
    defaultFields: FIELD_DEFAULTS_CENTRAL_STOCK[role],
  });
}

/* ============================================================
   🔁 State Sync Stub
============================================================ */
export function syncRefsToState() {
  // reserved for future enterprise reactive syncing
}
