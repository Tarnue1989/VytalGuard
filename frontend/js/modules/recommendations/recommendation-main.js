// 📦 recommendation-main.js – Form-only loader for Recommendation

import { initPageGuard, initLogoutWatcher } from "../../utils/index.js";
import { setupRecommendationFormSubmission } from "./recommendation-form.js";
import {
  FIELD_LABELS_RECOMMENDATION,
  FIELD_ORDER_RECOMMENDATION,
  FIELD_DEFAULTS_RECOMMENDATION,
} from "./recommendation-constants.js";
import { setupFieldSelector } from "../../utils/ui-utils.js";

// 🔐 Auth – driven by backend permission key
const token = initPageGuard("recommendations");

// 🔁 Global logout watcher
initLogoutWatcher();

// 🌐 Shared State
const sharedState = {
  currentEditIdRef: { value: null },
};

// 📎 DOM Refs
const form = document.getElementById("recommendationForm");
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
  sessionStorage.removeItem("recommendationEditId");
  sessionStorage.removeItem("recommendationEditPayload");

  // Explicitly clear text fields
  ["patientInput", "doctorInput", "recommendationReason"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });

  // Clear dropdowns
  ["organizationSelect", "facilitySelect", "departmentSelect"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });

  // Clear hidden IDs
  ["patientId", "doctorId", "consultationId"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });

  // Reset date
  const dateInput = document.getElementById("recommendationDate");
  if (dateInput) dateInput.value = "";
}

// 🧭 Form show/hide
function showForm() {
  formContainer?.classList.remove("hidden");
  desktopAddBtn?.classList.add("hidden");
  localStorage.setItem("recommendationFormVisible", "true");
}

function hideForm() {
  resetForm();
  formContainer?.classList.add("hidden");
  desktopAddBtn?.classList.remove("hidden");
  localStorage.setItem("recommendationFormVisible", "false");
}

// 🔗 Expose globally so action handlers can reuse
window.showForm = showForm;
window.resetForm = resetForm;

/* ------------------------- Wire Buttons ------------------------- */

if (cancelBtn) {
  cancelBtn.onclick = () => {
    resetForm();
    window.location.href = "/recommendations-list.html"; // ✅ plural
  };
}

if (clearBtn) clearBtn.onclick = resetForm;

if (desktopAddBtn) {
  desktopAddBtn.onclick = () => {
    // 🧹 Ensure stale edit data is gone
    sessionStorage.removeItem("recommendationEditId");
    sessionStorage.removeItem("recommendationEditPayload");

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

export async function initRecommendationModule() {
  showForm(); // open the form by default
  setupRecommendationFormSubmission({ form, token, sharedState, resetForm, loadEntries });

  localStorage.setItem("recommendationPanelVisible", "false");

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

  setupFieldSelector({
    module: "recommendation",
    fieldLabels: FIELD_LABELS_RECOMMENDATION,
    fieldOrder: FIELD_ORDER_RECOMMENDATION,
    defaultFields: FIELD_DEFAULTS_RECOMMENDATION[role],
  });
}

// (Optional)
export function syncRefsToState() {
  // no-op
}
