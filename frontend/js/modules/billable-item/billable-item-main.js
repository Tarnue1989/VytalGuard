// 📦 billable-item-main.js – Form-only loader for Billable Items (ENTERPRISE MASTER PARITY)
// ============================================================================
// 🧭 FULL MASTER PARITY WITH prescription-main.js
// 🔹 Auth guard + logout watcher
// 🔹 Unified form visibility and reset logic
// 🔹 Session-safe edit caching
// 🔹 Field selector integration (role-aware)
// 🔹 Pill state preserved (handled by form module)
// 🔹 100% ID-safe and controller-aligned
// ============================================================================

/* ============================================================
   🔒 PREVENT BFCACHE RESTORE (ROOT FIX)
============================================================ */
window.addEventListener("pageshow", function (event) {
  if (event.persisted) {
    window.location.reload();
  }
});

import {
  initPageGuard,
  autoPagePermissionKey,
  initLogoutWatcher,
} from "../../utils/index.js";

import { setupBillableItemFormSubmission } from "./billable-item-form.js";

import {
  FIELD_LABELS_BILLABLE_ITEM,
  FIELD_ORDER_BILLABLE_ITEM,
  FIELD_DEFAULTS_BILLABLE_ITEM,
} from "./billable-item-constants.js";

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
const form = document.getElementById("billableItemForm");
const formContainer = document.getElementById("formContainer");
const desktopAddBtn = document.getElementById("desktopAddBtn");
const cancelBtn = document.getElementById("cancelBtn");
const clearBtn = document.getElementById("clearBtn");

/* ============================================================
   🧹 Reset Form Helper (MASTER PARITY)
============================================================ */
function resetForm() {
  sharedState.currentEditIdRef.value = null;

  if (form) form.reset();

  sessionStorage.removeItem("billableItemEditId");
  sessionStorage.removeItem("billableItemEditPayload");

  ["description"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });

  ["organizationSelect", "facilitySelect", "departmentSelect"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });

  ["masterItemSearch"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) {
      el.value = "";
      el.dataset.value = "";
    }
  });

  // reset price pills UI
  const pillsContainer = document.getElementById("pricePillsContainer");
  if (pillsContainer) {
    pillsContainer.innerHTML =
      `<p class="text-muted">No prices added yet.</p>`;
  }
}

/* ============================================================
   🧭 Form Show / Hide (MASTER)
============================================================ */
function showForm() {
  formContainer?.classList.remove("hidden");
  desktopAddBtn?.classList.add("hidden");
  localStorage.setItem("billableItemFormVisible", "true");
}

function hideForm() {
  resetForm();
  formContainer?.classList.add("hidden");
  desktopAddBtn?.classList.remove("hidden");
  localStorage.setItem("billableItemFormVisible", "false");
}

window.showForm = showForm;
window.resetForm = resetForm;

/* ============================================================
   🔘 Button Wiring (MASTER)
============================================================ */
if (cancelBtn) {
  cancelBtn.onclick = () => {
    resetForm();
    window.location.href = "/billable-items-list.html";
  };
}

if (clearBtn) {
  clearBtn.onclick = () => {
    resetForm();
  };
}

if (desktopAddBtn) {
  desktopAddBtn.onclick = () => {
    sessionStorage.removeItem("billableItemEditId");
    sessionStorage.removeItem("billableItemEditPayload");
    resetForm();
    showForm();
  };
}

/* ============================================================
   📦 Loader Placeholder
============================================================ */
async function loadEntries() {
  return;
}

/* ============================================================
   🚀 Init Entrypoint (MASTER SAFE)
============================================================ */
export async function initBillableItemModule() {

  /* ============================================================
     🔒 MODE DETERMINED STRICTLY BY URL
  ============================================================ */
  const urlParams = new URLSearchParams(window.location.search);
  const editIdFromUrl = urlParams.get("id");

  sharedState.currentEditIdRef.value = editIdFromUrl || null;

  if (!editIdFromUrl) {
    sessionStorage.removeItem("billableItemEditId");
    sessionStorage.removeItem("billableItemEditPayload");
  }

  showForm();

  if (form) {
    setupBillableItemFormSubmission({
      form,
      token,
      sharedState,
      resetForm,
      loadEntries,
    });
  }

  localStorage.setItem("billableItemPanelVisible", "false");

  /* ============================================================
     🎛 Normalize role for field defaults
  ============================================================ */
  let roleRaw = localStorage.getItem("userRole") || "staff";
  let role = roleRaw.trim().toLowerCase();

  if (role.includes("super") && role.includes("admin")) role = "superadmin";
  else if (role.includes("admin")) role = "admin";
  else role = "staff";

  setupFieldSelector({
    module: "billable_item",
    fieldLabels: FIELD_LABELS_BILLABLE_ITEM,
    fieldOrder: FIELD_ORDER_BILLABLE_ITEM,
    defaultFields: FIELD_DEFAULTS_BILLABLE_ITEM[role],
  });
}

/* ============================================================
   🔁 Sync Stub
============================================================ */
export function syncRefsToState() {
  // reserved
}