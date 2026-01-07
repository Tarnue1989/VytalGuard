// 📦 centralstock-main.js – Form-only loader for Central Stock

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

// 🔐 Auth – automatic permission resolution ("central_stocks:create" or "central_stocks:edit")
const token = initPageGuard(autoPagePermissionKey());

// 🔁 Global logout watcher
initLogoutWatcher();

// 🌐 Shared State
const sharedState = {
  currentEditIdRef: { value: null },
};

// 📎 DOM Refs
const form = document.getElementById("centralStockForm");
const formContainer = document.getElementById("formContainer");
const desktopAddBtn = document.getElementById("desktopAddBtn");
const cancelBtn = document.getElementById("cancelBtn");
const clearBtn = document.getElementById("clearBtn");

/* ------------------------- Helpers ------------------------- */

// 🧹 Reset form
function resetForm() {
  sharedState.currentEditIdRef.value = null;
  if (form) form.reset();

  // Clear cached edit state
  sessionStorage.removeItem("centralStockEditId");
  sessionStorage.removeItem("centralStockEditPayload");

  // Explicitly clear text fields
  ["batchNumber", "notes", "quantity"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });

  // Clear organization + facility + supplier dropdowns
  ["organizationSelect", "facilitySelect", "supplierSelect"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });

  // Clear pill container
  const pillsContainer = document.getElementById("itemPillsContainer");
  if (pillsContainer) {
    pillsContainer.innerHTML = `<p class="text-muted">No items added yet.</p>`;
  }

  // Reset status radio (default Active)
  const activeRadio = document.getElementById("status_active");
  if (activeRadio) activeRadio.checked = true;
}

// 🧭 Form show/hide
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

// 🔗 Expose globally so action handlers can reuse
window.showForm = showForm;
window.resetForm = resetForm;

/* ------------------------- Wire Buttons ------------------------- */

if (cancelBtn) {
  cancelBtn.onclick = () => {
    resetForm();
    window.location.href = "/centralstocks-list.html";
  };
}

if (clearBtn) clearBtn.onclick = resetForm;

if (desktopAddBtn) {
  desktopAddBtn.onclick = () => {
    // 🧹 Ensure stale edit data is gone
    sessionStorage.removeItem("centralStockEditId");
    sessionStorage.removeItem("centralStockEditPayload");

    // Reset form for clean Add mode
    resetForm();
    showForm();
  };
}

/* ------------------------- Loader ------------------------- */
async function loadEntries() {
  return; // noop (list page handles this)
}

/* ------------------------- Init ------------------------- */
export async function initCentralStockModule() {
  showForm(); // open the form by default
  setupCentralStockFormSubmission({ form, token, sharedState, resetForm, loadEntries });

  localStorage.setItem("centralStockPanelVisible", "false");

  // 📌 Normalize role before pulling defaults
  let roleRaw = localStorage.getItem("userRole") || "staff";
  let role = roleRaw.trim().toLowerCase();

  if (role.includes("super") && role.includes("admin")) {
    role = "superadmin";
  } else if (role.includes("admin")) {
    role = "admin";
  } else {
    role = "staff";
  }

  // 🧩 Field selector setup (role-based defaults)
  setupFieldSelector({
    module: "central_stock",
    fieldLabels: FIELD_LABELS_CENTRAL_STOCK,
    fieldOrder: FIELD_ORDER_CENTRAL_STOCK,
    defaultFields: FIELD_DEFAULTS_CENTRAL_STOCK[role],
  });
}

// (Optional)
export function syncRefsToState() {
  // no-op
}
