// 📦 patientchart-main.js – Patient Chart Cache Form Loader (Generate-Only Mode)
// ============================================================================
// 🔹 Enterprise-aligned bootstrap for form page
// 🔹 Handles visibility toggles, form reset, and field selector
// 🔹 No edit session logic (no sessionStorage / currentEditId)
// ============================================================================

import {
  initPageGuard,
  autoPagePermissionKey,
  initLogoutWatcher,
} from "../../utils/index.js";
import { setupPatientChartFormSubmission } from "./patientchart-form.js";
import {
  FIELD_LABELS_PATIENT_CHART_CACHE,
  FIELD_ORDER_PATIENT_CHART_CACHE,
  FIELD_DEFAULTS_PATIENT_CHART_CACHE,
} from "./patientchart-constants.js";
import { setupFieldSelector } from "../../utils/ui-utils.js";

/* ============================================================
   🔐 Auth + Global Guards
============================================================ */
const token = initPageGuard(autoPagePermissionKey());
initLogoutWatcher();

/* ============================================================
   📎 DOM Refs
============================================================ */
const form = document.getElementById("patientChartForm");
const formContainer = document.getElementById("formContainer");
const desktopAddBtn = document.getElementById("desktopAddBtn");
const cancelBtn = document.getElementById("cancelBtn");
const clearBtn = document.getElementById("clearBtn");

/* ============================================================
   🧹 Reset Form Helper
============================================================ */
function resetForm() {
  if (form) form.reset();

  // Clear primary fields
  ["organizationSelect", "facilitySelect", "patientInput"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });

  // Clear hidden patient id
  const patientId = document.getElementById("patientId");
  if (patientId) patientId.value = "";

  // Clear any snapshot display area
  const snapshotPreview = document.getElementById("chartSnapshotPreview");
  if (snapshotPreview) snapshotPreview.innerHTML = "";
}

/* ============================================================
   🧭 Form Visibility Controls
============================================================ */
function showForm() {
  formContainer?.classList.remove("hidden");
  desktopAddBtn?.classList.add("hidden");
  localStorage.setItem("patientChartFormVisible", "true");
}

function hideForm() {
  resetForm();
  formContainer?.classList.add("hidden");
  desktopAddBtn?.classList.remove("hidden");
  localStorage.setItem("patientChartFormVisible", "false");
}

window.showForm = showForm;
window.resetForm = resetForm;

/* ============================================================
   🔘 Button Handlers
============================================================ */
cancelBtn?.addEventListener("click", () => {
  resetForm();
  window.location.href = "/patientchart-list.html";
});

clearBtn?.addEventListener("click", resetForm);

desktopAddBtn?.addEventListener("click", () => {
  resetForm();
  showForm();
});

/* ============================================================
   🚀 Module Initializer
============================================================ */
export async function initPatientChartModule() {
  showForm(); // auto-open form on standalone page

  await setupPatientChartFormSubmission({ form, token, resetForm });

  localStorage.setItem("patientChartPanelVisible", "false");

  // Normalize role for field defaults
  let roleRaw = localStorage.getItem("userRole") || "staff";
  let role = roleRaw.trim().toLowerCase();

  if (role.includes("super") && role.includes("admin")) role = "superadmin";
  else if (role.includes("admin")) role = "admin";
  else role = "staff";

  // 🧩 Initialize Field Selector (role-based)
  setupFieldSelector({
    module: "patientchart",
    fieldLabels: FIELD_LABELS_PATIENT_CHART_CACHE,
    fieldOrder: FIELD_ORDER_PATIENT_CHART_CACHE,
    defaultFields: FIELD_DEFAULTS_PATIENT_CHART_CACHE[role],
  });
}

/* ============================================================
   🔁 Sync Helper (for future integrations)
============================================================ */
export function syncRefsToState() {
  // Reserved for reactive binding if needed later
}
