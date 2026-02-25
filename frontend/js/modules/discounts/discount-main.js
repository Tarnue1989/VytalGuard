// 📦 discount-main.js – Form-only loader for Discount (ENTERPRISE MASTER PARITY)
// ============================================================================
// 🧭 FULL MASTER PARITY WITH deposit-main.js / consultation-main.js
// 🔹 Auth guard + logout watcher
// 🔹 Unified form visibility and reset logic
// 🔹 Session-safe edit caching
// 🔹 Field selector integration (role-aware)
// 🔹 FORM-ONLY (no filters, no list, no summary)
// 🔹 100% ID-safe and controller-aligned
// ============================================================================

import {
  initPageGuard,
  autoPagePermissionKey,
  initLogoutWatcher,
  showToast,
} from "../../utils/index.js";

import { setupDiscountFormSubmission } from "./discount-form.js";

import {
  FIELD_LABELS_DISCOUNT,
  FIELD_ORDER_DISCOUNT,
  FIELD_DEFAULTS_DISCOUNT,
} from "./discount-constants.js";

import { setupFieldSelector } from "../../utils/ui-utils.js";

import {
  loadOrganizationsLite,
  loadFacilitiesLite,
  setupSelectOptions,
} from "../../utils/data-loaders.js";

/* ============================================================
   🔐 Auth Guard + Shared State (MASTER)
============================================================ */
const token = initPageGuard(
  autoPagePermissionKey(["discounts:create", "discounts:edit"])
);
initLogoutWatcher();

const sharedState = {
  currentEditIdRef: { value: null },
};

/* ============================================================
   📎 DOM Refs (ID-SAFE)
============================================================ */
const form = document.getElementById("discountForm");
const formContainer = document.getElementById("formContainer");
const desktopAddBtn = document.getElementById("desktopAddBtn");
const cancelBtn = document.getElementById("cancelBtn");
const clearBtn = document.getElementById("clearBtn");

/* ============================================================
   🧹 Reset Form Helper (MASTER PARITY)
============================================================ */
async function resetForm() {
  sharedState.currentEditIdRef.value = null;
  if (form) form.reset();

  // Clear cached edit state
  sessionStorage.removeItem("discountEditId");
  sessionStorage.removeItem("discountEditPayload");

  // Clear text inputs
  ["invoiceInput", "value", "reason"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });

  // Clear hidden IDs
  ["invoiceId", "invoiceItemId"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });

  // Reset type selector explicitly
  const typeEl = document.getElementById("typeSelect");
  if (typeEl) {
    typeEl.innerHTML = `
      <option value="">-- Select Type --</option>
      <option value="percentage">Percentage</option>
      <option value="fixed">Fixed Amount</option>
    `;
  }

  // Reload scoped org / facility lists (SAFE, no API change)
  try {
    const roleRaw = (localStorage.getItem("userRole") || "").toLowerCase();

    if (roleRaw.includes("super")) {
      const orgs = await loadOrganizationsLite();
      setupSelectOptions(
        document.getElementById("organizationSelect"),
        orgs,
        "id",
        "name",
        "-- Select Organization --"
      );
    } else {
      const facs = await loadFacilitiesLite({}, true);
      setupSelectOptions(
        document.getElementById("facilitySelect"),
        facs,
        "id",
        "name",
        "-- Select Facility --"
      );
    }
  } catch (err) {
    console.error("❌ Failed to reload dropdowns on reset", err);
    showToast("❌ Failed to reload reference lists");
  }

  // Hide reason group by default
  const reasonGroup = document.getElementById("reason")?.closest(".form-group");
  if (reasonGroup) reasonGroup.classList.add("hidden");
}

/* ============================================================
   🧭 Form Show / Hide (MASTER)
============================================================ */
function showForm() {
  formContainer?.classList.remove("hidden");
  desktopAddBtn?.classList.add("hidden");
  localStorage.setItem("discountFormVisible", "true");
}

function hideForm() {
  resetForm();
  formContainer?.classList.add("hidden");
  desktopAddBtn?.classList.remove("hidden");
  localStorage.setItem("discountFormVisible", "false");
}

// 🔗 Expose globally (actions / hot reload)
window.showForm = showForm;
window.resetForm = resetForm;

/* ============================================================
   🔘 Button Wiring (MASTER)
============================================================ */
if (cancelBtn) {
  cancelBtn.onclick = () => {
    resetForm();
    window.location.href = "/discounts-list.html";
  };
}

if (clearBtn) clearBtn.onclick = resetForm;

if (desktopAddBtn) {
  desktopAddBtn.onclick = () => {
    sessionStorage.removeItem("discountEditId");
    sessionStorage.removeItem("discountEditPayload");
    resetForm();
    showForm();
  };
}

/* ============================================================
   📦 Loader Stub (FORM-ONLY)
============================================================ */
async function loadEntries() {
  return; // handled by list page
}

/* ============================================================
   🚀 Init Entrypoint (MASTER)
============================================================ */
export async function initDiscountModule() {
  showForm(); // form-only mode

  if (form) {
    setupDiscountFormSubmission({
      form,
      token,
      sharedState,
      resetForm,
      loadEntries,
    });
  }

  localStorage.setItem("discountPanelVisible", "false");

  // Normalize role (MASTER logic)
  let roleRaw = localStorage.getItem("userRole") || "staff";
  let role = roleRaw.trim().toLowerCase();

  if (role.includes("super") && role.includes("admin")) role = "superadmin";
  else if (role.includes("admin")) role = "admin";
  else if (role.includes("manager")) role = "manager";
  else role = "staff";

  setupFieldSelector({
    module: "discount",
    fieldLabels: FIELD_LABELS_DISCOUNT,
    fieldOrder: FIELD_ORDER_DISCOUNT,
    defaultFields: FIELD_DEFAULTS_DISCOUNT[role],
  });
}

/* ============================================================
   🔁 Sync Stub (Reserved)
============================================================ */
export function syncRefsToState() {
  // reserved for future reactive syncing
}
