// 📦 discount-waiver-main.js – Enterprise Master Pattern Aligned
// ============================================================================
// 🔹 Mirrors discount-main.js for unified form lifecycle & RBAC logic
// 🔹 Retains all waiver-specific IDs, logic, and API endpoints
// 🔹 Includes unified auth guard, visibility helpers, and role-based field setup
// ============================================================================

import {
  initPageGuard,
  initLogoutWatcher,
  autoPagePermissionKey,
  showToast,
} from "../../utils/index.js";
import { setupDiscountWaiverFormSubmission } from "./discount-waiver-form.js";
import {
  FIELD_LABELS_DISCOUNT_WAIVER,
  FIELD_ORDER_DISCOUNT_WAIVER,
  FIELD_VISIBILITY_DISCOUNT_WAIVER,
} from "./discount-waiver-constants.js";
import { setupFieldSelector, setupSelectOptions } from "../../utils/ui-utils.js";
import { loadOrganizationsLite, loadFacilitiesLite } from "../../utils/data-loaders.js";

/* ============================================================
   🔐 Auth Guard + Session Watch
============================================================ */
const token = initPageGuard(
  autoPagePermissionKey(["discount-waivers:create", "discount-waivers:edit"])
);
initLogoutWatcher();

/* ============================================================
   🌐 Shared State + DOM Refs
============================================================ */
const sharedState = {
  currentEditIdRef: { value: null },
};

const form = document.getElementById("discountWaiverForm");
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
  sessionStorage.removeItem("discountWaiverEditId");
  sessionStorage.removeItem("discountWaiverEditPayload");

  // Explicitly clear text fields
  ["invoiceInput", "patientInput", "percentage", "amount", "reason"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });

  // Clear hidden IDs
  ["invoiceId", "patientId"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });

  // 🔄 Reload org/facility lists based on role
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

  // Reset type dropdown
  const typeEl = document.getElementById("typeSelect");
  if (typeEl) {
    typeEl.innerHTML = `
      <option value="">-- Select Type --</option>
      <option value="percentage">Percentage</option>
      <option value="fixed">Fixed Amount</option>
    `;
  }

  // Reset Applied Total
  const appliedEl = document.getElementById("appliedTotal");
  if (appliedEl) appliedEl.value = "0.00";

  console.info("🧹 [Discount Waiver] Form reset complete");
}

/* ============================================================
   🧭 Visibility Controls
============================================================ */
function showForm() {
  formContainer?.classList.remove("hidden");
  desktopAddBtn?.classList.add("hidden");
  localStorage.setItem("discountWaiverFormVisible", "true");
}

function hideForm() {
  resetForm();
  formContainer?.classList.add("hidden");
  desktopAddBtn?.classList.remove("hidden");
  localStorage.setItem("discountWaiverFormVisible", "false");
}

// 🔗 Expose globally for reuse
window.showForm = showForm;
window.resetForm = resetForm;

/* ============================================================
   🔘 Button Wiring
============================================================ */
if (cancelBtn) {
  cancelBtn.onclick = () => {
    console.log("🚪 [Discount Waiver] Cancel clicked – returning to list");
    resetForm();
    window.location.href = "/discount-waivers-list.html";
  };
}

if (clearBtn) clearBtn.onclick = resetForm;

if (desktopAddBtn) {
  desktopAddBtn.onclick = () => {
    console.log("➕ [Discount Waiver] Switching to Add mode");
    sessionStorage.removeItem("discountWaiverEditId");
    sessionStorage.removeItem("discountWaiverEditPayload");
    resetForm();
    showForm();
  };
}

/* ============================================================
   📦 Stub – List Loader (handled on list page)
============================================================ */
async function loadEntries() {
  return;
}

/* ============================================================
   🚀 Module Init
============================================================ */
export async function initDiscountWaiverModule() {
  // Restore last state
  if (localStorage.getItem("discountWaiverFormVisible") === "true") {
    showForm();
  } else {
    hideForm();
  }

  setupDiscountWaiverFormSubmission({
    form,
    token,
    sharedState,
    resetForm,
    loadEntries,
  });

  localStorage.setItem("discountWaiverPanelVisible", "false");

  // Normalize role
  let roleRaw = localStorage.getItem("userRole") || "staff";
  let role = roleRaw.trim().toLowerCase();
  if (role.includes("super") && role.includes("admin")) role = "superadmin";
  else if (role.includes("admin")) role = "admin";
  else if (role.includes("manager")) role = "manager";
  else role = "staff";

  // 🧩 Field Selector
  setupFieldSelector({
    module: "discount-waiver",
    fieldLabels: FIELD_LABELS_DISCOUNT_WAIVER,
    fieldOrder: FIELD_ORDER_DISCOUNT_WAIVER,
    defaultFields: FIELD_VISIBILITY_DISCOUNT_WAIVER[role] || FIELD_VISIBILITY_DISCOUNT_WAIVER.staff,
  });

  console.info(`✅ [Discount Waiver] Module initialized for role: ${role}`);
}

/* ============================================================
   (Optional)
============================================================ */
export function syncRefsToState() {
  // placeholder for extensions
}
