// 📦 pharmacy-transaction-main.js – Enterprise Master Pattern Aligned
// ============================================================================
// 🔹 Mirrors payment-main.js for unified RBAC, lifecycle, and field selector logic
// 🔹 Retains all pharmacy-transaction-specific IDs, fields, and endpoints
// 🔹 Includes standardized reset/show/hide helpers and role-aware setup
// ============================================================================

import {
  initPageGuard,
  initLogoutWatcher,
  autoPagePermissionKey,
} from "../../utils/index.js";
import { setupPharmacyTransactionFormSubmission } from "./pharmacy-transaction-form.js";
import {
  FIELD_LABELS_PHARMACY_TRANSACTION,
  FIELD_ORDER_PHARMACY_TRANSACTION,
  FIELD_DEFAULTS_PHARMACY_TRANSACTION,
} from "./pharmacy-transaction-constants.js";
import { setupFieldSelector } from "../../utils/ui-utils.js";

/* ============================================================
   🔐 Auth Guard
============================================================ */
const token = initPageGuard(
  autoPagePermissionKey([
    "pharmacy_transactions:create",
    "pharmacy_transactions:edit",
  ])
);
initLogoutWatcher();

/* ============================================================
   🌐 Shared State + DOM Refs
============================================================ */
const sharedState = {
  currentEditIdRef: { value: null },
};

const form = document.getElementById("pharmacyTransactionForm");
const formContainer = document.getElementById("formContainer");
const desktopAddBtn = document.getElementById("desktopAddBtn");
const cancelBtn = document.getElementById("cancelBtn");
const clearBtn = document.getElementById("clearBtn");

/* ============================================================
   🧹 Reset & Visibility Helpers
============================================================ */
function resetForm() {
  sharedState.currentEditIdRef.value = null;
  if (form) form.reset();

  // Clear cached edit state
  sessionStorage.removeItem("pharmacyTransactionEditId");
  sessionStorage.removeItem("pharmacyTransactionEditPayload");

  // Explicitly clear text/date fields
  ["notes", "transaction_date"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });

  // Clear dropdowns
  ["organizationSelect", "facilitySelect", "prescriptionRequestSelect"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });

  // Clear patient input
  const patientInput = document.getElementById("patientSearch");
  if (patientInput) {
    patientInput.value = "";
    patientInput.dataset.value = "";
  }

  // Reset emergency flag
  const emergencyCheck = document.getElementById("is_emergency");
  if (emergencyCheck) {
    if (emergencyCheck.type === "checkbox") emergencyCheck.checked = false;
    else emergencyCheck.value = "";
  }

  // Clear items table
  const itemsContainer = document.getElementById("transactionItemsContainer");
  if (itemsContainer)
    itemsContainer.innerHTML = `<p class="text-muted">No prescription selected or no items available.</p>`;

  console.info("🧹 [Pharmacy Transaction] Form reset complete");
}

function showForm() {
  formContainer?.classList.remove("hidden");
  desktopAddBtn?.classList.add("hidden");
  localStorage.setItem("pharmacyTransactionFormVisible", "true");
}

function hideForm() {
  resetForm();
  formContainer?.classList.add("hidden");
  desktopAddBtn?.classList.remove("hidden");
  localStorage.setItem("pharmacyTransactionFormVisible", "false");
}

// 🔗 Expose globally
window.showForm = showForm;
window.resetForm = resetForm;

/* ============================================================
   🔘 Button Wiring
============================================================ */
if (cancelBtn) {
  cancelBtn.onclick = () => {
    console.log("🚪 [Pharmacy Transaction] Cancel clicked – returning to list");
    resetForm();
    window.location.href = "/pharmacy-transactions-list.html";
  };
}

if (clearBtn) {
  clearBtn.onclick = () => {
    const isEdit = !!sharedState.currentEditIdRef.value;
    sessionStorage.removeItem("pharmacyTransactionEditId");
    sessionStorage.removeItem("pharmacyTransactionEditPayload");
    if (isEdit) {
      window.location.href = "/pharmacy-transactions-list.html";
    } else {
      resetForm();
    }
  };
}

if (desktopAddBtn) {
  desktopAddBtn.onclick = () => {
    console.log("➕ [Pharmacy Transaction] Switching to Add mode");
    sessionStorage.removeItem("pharmacyTransactionEditId");
    sessionStorage.removeItem("pharmacyTransactionEditPayload");
    resetForm();
    showForm();
  };
}

/* ============================================================
   📦 Stub – List Loader (no-op)
============================================================ */
async function loadEntries() {
  return [];
}

/* ============================================================
   🚀 Module Init
============================================================ */
export async function initPharmacyTransactionModule() {
  if (!form) return; // ✅ guard

  showForm();

  setupPharmacyTransactionFormSubmission({
    form,
    token,
    sharedState,
    resetForm,
    loadEntries,
  });

  localStorage.setItem("pharmacyTransactionPanelVisible", "false");

  // 🧩 Normalize role
  let roleRaw = localStorage.getItem("userRole") || "staff";
  let role = roleRaw.trim().toLowerCase();

  if (role.includes("super") && role.includes("admin")) role = "superadmin";
  else if (role.includes("admin")) role = "admin";
  else role = "staff";

  setupFieldSelector({
    module: "pharmacy-transaction",
    fieldLabels: FIELD_LABELS_PHARMACY_TRANSACTION,
    fieldOrder: FIELD_ORDER_PHARMACY_TRANSACTION,
    defaultFields:
      FIELD_DEFAULTS_PHARMACY_TRANSACTION[role] ||
      FIELD_DEFAULTS_PHARMACY_TRANSACTION.staff,
  });

  console.info(`✅ [Pharmacy Transaction] Module initialized for role: ${role}`);
}

/* ============================================================
   (Optional)
============================================================ */
export function syncRefsToState() {
  // placeholder for extensions
}
