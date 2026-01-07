// 📦 discount-policy-main.js – Form-only loader for Discount Policy

import { initPageGuard, initLogoutWatcher, showToast } from "../../utils/index.js";
import { setupDiscountPolicyFormSubmission } from "./discount-policy-form.js";
import {
  FIELD_LABELS_DISCOUNT_POLICY,
  FIELD_ORDER_DISCOUNT_POLICY,
  FIELD_DEFAULTS_DISCOUNT_POLICY,
} from "./discount-policy-constants.js";
import { setupFieldSelector, setupSelectOptions } from "../../utils/ui-utils.js";
import { loadOrganizationsLite, loadFacilitiesLite } from "../../utils/data-loaders.js";

// 🔐 Auth – driven by backend permission key
const token = initPageGuard("discount-policies");

// 🔁 Global logout watcher
initLogoutWatcher();

// 🌐 Shared State
const sharedState = {
  currentEditIdRef: { value: null },
};

// 📎 DOM Refs
const form = document.getElementById("discountPolicyForm");
const formContainer = document.getElementById("formContainer");
const desktopAddBtn = document.getElementById("desktopAddBtn");
const cancelBtn = document.getElementById("cancelBtn");
const clearBtn = document.getElementById("clearBtn");

/* ------------------------- Helpers ------------------------- */

// 🧹 Reset form
async function resetForm() {
  sharedState.currentEditIdRef.value = null;
  if (form) form.reset();

  // Clear cached edit state
  sessionStorage.removeItem("discountPolicyEditId");
  sessionStorage.removeItem("discountPolicyEditPayload");

  // Explicit clears
  ["code", "name", "description", "value", "conditionJson"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });

  // Reset selects (🚫 no statusSelect here)
  ["discountTypeSelect", "appliesToSelect"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.selectedIndex = 0;
  });

  // Reset dates
  ["effectiveFrom", "effectiveTo"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });

  // Reset org/facility
  const userRole = (localStorage.getItem("userRole") || "").toLowerCase();
  try {
    if (userRole.includes("super")) {
      const orgs = await loadOrganizationsLite();
      setupSelectOptions(document.getElementById("organizationSelect"), orgs, "id", "name", "-- Select Organization --");
    } else {
      const facs = await loadFacilitiesLite({}, true);
      setupSelectOptions(document.getElementById("facilitySelect"), facs, "id", "name", "-- Select Facility --");
    }
  } catch (err) {
    console.error("❌ Failed to reload dropdowns on reset:", err);
    showToast("❌ Could not reload reference lists");
  }
}

// 🧭 Form show/hide
function showForm() {
  formContainer?.classList.remove("hidden");
  desktopAddBtn?.classList.add("hidden");
  localStorage.setItem("discountPolicyFormVisible", "true");
}

function hideForm() {
  resetForm();
  formContainer?.classList.add("hidden");
  desktopAddBtn?.classList.remove("hidden");
  localStorage.setItem("discountPolicyFormVisible", "false");
}

// 🔗 Expose globally
window.showForm = showForm;
window.resetForm = resetForm;

/* ------------------------- Wire Buttons ------------------------- */

if (cancelBtn) {
  cancelBtn.onclick = () => {
    resetForm();
    window.location.href = "/discount-policies-list.html"; // ✅ plural
  };
}

if (clearBtn) clearBtn.onclick = resetForm;

if (desktopAddBtn) {
  desktopAddBtn.onclick = () => {
    sessionStorage.removeItem("discountPolicyEditId");
    sessionStorage.removeItem("discountPolicyEditPayload");
    resetForm();
    showForm();
  };
}

/* ------------------------- Init ------------------------- */

export async function initDiscountPolicyModule() {
  if (localStorage.getItem("discountPolicyFormVisible") === "true") {
    showForm();
  } else {
    hideForm();
  }

  setupDiscountPolicyFormSubmission({ form, token, sharedState, resetForm });

  // 📌 Normalize role before pulling defaults
  let roleRaw = localStorage.getItem("userRole") || "staff";
  let role = roleRaw.trim().toLowerCase();
  if (role.includes("super") && role.includes("admin")) role = "superadmin";
  else if (role.includes("admin")) role = "admin";
  else if (role.includes("manager")) role = "manager";
  else role = "staff";

  setupFieldSelector({
    module: "discount-policy",
    fieldLabels: FIELD_LABELS_DISCOUNT_POLICY,
    fieldOrder: FIELD_ORDER_DISCOUNT_POLICY,
    defaultFields: FIELD_DEFAULTS_DISCOUNT_POLICY[role],
  });
}
