// 📦 discount-main.js – Enterprise Master Pattern Aligned
// ============================================================================
// 🔹 Mirrors deposit-main.js for consistent form lifecycle & RBAC logic
// 🔹 Retains all discount-specific logic, IDs, and API endpoints
// 🔹 Includes unified auth guard, visibility helpers, and role-based field setup
// ============================================================================

import {
  initPageGuard,
  initLogoutWatcher,
  autoPagePermissionKey,
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
   🔐 Auth Guard
============================================================ */
// Auto-detect correct permission key (create / edit)
const token = initPageGuard(autoPagePermissionKey(["discounts:create", "discounts:edit"]));
initLogoutWatcher();

/* ============================================================
   🌐 Shared State + DOM Refs
============================================================ */
const sharedState = {
  currentEditIdRef: { value: null },
};

const form = document.getElementById("discountForm");
const formContainer = document.getElementById("formContainer");
const desktopAddBtn = document.getElementById("desktopAddBtn");
const cancelBtn = document.getElementById("cancelBtn");
const clearBtn = document.getElementById("clearBtn");

/* ============================================================
   🧹 Reset & Visibility Helpers
============================================================ */
async function resetForm() {
  sharedState.currentEditIdRef.value = null;
  if (form) form.reset();

  // Clear cached edit state
  sessionStorage.removeItem("discountEditId");
  sessionStorage.removeItem("discountEditPayload");

  // Explicitly clear text fields
  ["invoiceInput", "value", "reason"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });

  // Clear hidden IDs
  ["invoiceId", "invoiceItemId"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });

  // Reset dropdowns
  const typeEl = document.getElementById("typeSelect");
  if (typeEl) {
    typeEl.innerHTML = `
      <option value="">-- Select Type --</option>
      <option value="percentage">Percentage</option>
      <option value="fixed">Fixed Amount</option>
    `;
  }

  // 🔄 Reload live orgs/facs per role
  const userRole = (localStorage.getItem("userRole") || "").toLowerCase();

  try {
    if (userRole.includes("super")) {
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
    console.error("❌ Failed to reload dropdowns on reset:", err);
    showToast("❌ Could not reload reference lists");
  }

  // Hide reason field by default (only used in edit mode)
  const reasonGroup = document.getElementById("reason")?.closest(".form-group");
  if (reasonGroup) reasonGroup.classList.add("hidden");

  console.info("🧹 [Discount] Form reset complete");
}

/* ============================================================
   🧭 Visibility Controls
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

// 🔗 Expose globally for other handlers
window.showForm = showForm;
window.resetForm = resetForm;

/* ============================================================
   🔘 Button Wiring
============================================================ */
if (cancelBtn) {
  cancelBtn.onclick = () => {
    console.log("🚪 [Discount] Cancel clicked – returning to list");
    resetForm();
    window.location.href = "/discounts-list.html";
  };
}

if (clearBtn) clearBtn.onclick = resetForm;

if (desktopAddBtn) {
  desktopAddBtn.onclick = () => {
    console.log("➕ [Discount] Switching to Add mode");
    sessionStorage.removeItem("discountEditId");
    sessionStorage.removeItem("discountEditPayload");
    resetForm();
    showForm();
  };
}

/* ============================================================
   📦 Stub – List Loader (no-op here)
============================================================ */
async function loadEntries() {
  return; // handled on list page
}

/* ============================================================
   🚀 Module Init
============================================================ */
export async function initDiscountModule() {
  showForm(); // open immediately for form-only page

  setupDiscountFormSubmission({
    form,
    token,
    sharedState,
    resetForm,
    loadEntries,
  });

  localStorage.setItem("discountPanelVisible", "false");

  // Normalize role
  let roleRaw = localStorage.getItem("userRole") || "staff";
  let role = roleRaw.trim().toLowerCase();

  if (role.includes("super") && role.includes("admin")) role = "superadmin";
  else if (role.includes("admin")) role = "admin";
  else if (role.includes("manager")) role = "manager";
  else role = "staff";

  // 🧩 Setup field selector (role-based defaults)
  setupFieldSelector({
    module: "discount",
    fieldLabels: FIELD_LABELS_DISCOUNT,
    fieldOrder: FIELD_ORDER_DISCOUNT,
    defaultFields: FIELD_DEFAULTS_DISCOUNT[role] || FIELD_DEFAULTS_DISCOUNT.staff,
  });

  console.info(`✅ [Discount] Module initialized for role: ${role}`);
}

/* ============================================================
   (Optional)
============================================================ */
export function syncRefsToState() {
  // placeholder for future sync extensions
}
