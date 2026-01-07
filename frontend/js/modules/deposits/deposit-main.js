// 📦 deposit-main.js – Enterprise Master Pattern Aligned
// ============================================================================
// 🔹 Mirrors appointment-main.js for consistent form lifecycle & RBAC logic
// 🔹 Retains all deposit-specific logic, IDs, and API endpoints
// 🔹 Includes unified auth guard, visibility helpers, and role-based field setup
// ============================================================================

import {
  initPageGuard,
  initLogoutWatcher,
  autoPagePermissionKey,
} from "../../utils/index.js";
import { setupDepositFormSubmission } from "./deposit-form.js";
import {
  FIELD_LABELS_DEPOSIT,
  FIELD_ORDER_DEPOSIT,
  FIELD_DEFAULTS_DEPOSIT,
} from "./deposit-constants.js";
import { setupFieldSelector } from "../../utils/ui-utils.js";

/* ============================================================
   🔐 Auth Guard
   ============================================================ */
// Auto-detect correct permission key (create / edit)
const token = initPageGuard(autoPagePermissionKey(["deposits:create", "deposits:edit"]));
initLogoutWatcher();

/* ============================================================
   🌐 Shared State + DOM Refs
   ============================================================ */
const sharedState = {
  currentEditIdRef: { value: null },
};

const form = document.getElementById("depositForm");
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
  sessionStorage.removeItem("depositEditId");
  sessionStorage.removeItem("depositEditPayload");

  // Explicitly clear text fields
  ["patientInput", "amount", "transactionRef", "notes"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });

  // Clear hidden IDs
  ["patientId", "appliedInvoiceId"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });

  // Reset dropdowns
  ["organizationSelect", "facilitySelect", "methodSelect"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });

  // Hide reason field by default (only used in edit mode)
  const reasonGroup = document.getElementById("reason")?.closest(".form-group");
  if (reasonGroup) reasonGroup.classList.add("hidden");

  console.info("🧹 [Deposit] Form reset complete");
}

function showForm() {
  formContainer?.classList.remove("hidden");
  desktopAddBtn?.classList.add("hidden");
  localStorage.setItem("depositFormVisible", "true");
}

function hideForm() {
  resetForm();
  formContainer?.classList.add("hidden");
  desktopAddBtn?.classList.remove("hidden");
  localStorage.setItem("depositFormVisible", "false");
}

// 🔗 Expose globally for action handlers
window.showForm = showForm;
window.resetForm = resetForm;

/* ============================================================
   🔘 Button Wiring
   ============================================================ */
if (cancelBtn) {
  cancelBtn.onclick = () => {
    console.log("🚪 [Deposit] Cancel clicked – returning to list");
    resetForm();
    window.location.href = "/deposits-list.html";
  };
}

if (clearBtn) clearBtn.onclick = resetForm;

if (desktopAddBtn) {
  desktopAddBtn.onclick = () => {
    console.log("➕ [Deposit] Switching to Add mode");
    sessionStorage.removeItem("depositEditId");
    sessionStorage.removeItem("depositEditPayload");
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
export async function initDepositModule() {
  showForm(); // open form immediately

  setupDepositFormSubmission({
    form,
    token,
    sharedState,
    resetForm,
    loadEntries,
  });

  localStorage.setItem("depositPanelVisible", "false");

  // Normalize role
  let roleRaw = localStorage.getItem("userRole") || "staff";
  let role = roleRaw.trim().toLowerCase();

  if (role.includes("super") && role.includes("admin")) role = "superadmin";
  else if (role.includes("admin")) role = "admin";
  else role = "staff";

  // 🧩 Setup field selector
  setupFieldSelector({
    module: "deposit",
    fieldLabels: FIELD_LABELS_DEPOSIT,
    fieldOrder: FIELD_ORDER_DEPOSIT,
    defaultFields:
      FIELD_DEFAULTS_DEPOSIT[role] || FIELD_DEFAULTS_DEPOSIT.staff,
  });

  console.info(`✅ [Deposit] Module initialized for role: ${role}`);
}

/* ============================================================
   (Optional)
   ============================================================ */
export function syncRefsToState() {
  // placeholder for future sync extensions
}
