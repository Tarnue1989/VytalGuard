// 📦 prescription-filter-main.js – Filters + Table/Card (Enterprise-Aligned)
// ============================================================
// 🧭 Fully aligned with Lab Request Master Pattern (Central Stock Style)
// ============================================================

import {
  showToast,
  showLoading,
  hideLoading,
  initPageGuard,
  autoPagePermissionKey,
  setupToggleSection,
  renderPaginationControls,
  initLogoutWatcher,
} from "../../utils/index.js";

import { authFetch } from "../../authSession.js";
import {
  setupSuggestionInputDynamic,
  loadOrganizationsLite,
  loadFacilitiesLite,
  loadDepartmentsLite,
  loadPatientsLite,
  loadEmployeesLite,
  loadConsultationsLite,
  loadRegistrationLogsLite,
  loadBillableItemsLite,
  setupSelectOptions,
} from "../../utils/data-loaders.js";

import { renderFieldSelector } from "../../utils/ui-utils.js";
import { exportToExcel, exportToPDF } from "../../utils/export-utils.js";
import { renderList, renderDynamicTableHead } from "./prescription-render.js";
import { setupActionHandlers } from "./prescription-actions.js";
import {
  FIELD_ORDER_PRESCRIPTION,
  FIELD_DEFAULTS_PRESCRIPTION,
} from "./prescription-constants.js";
import { setupVisibleFields } from "../../utils/field-visibility.js";
import { initPaginationControl } from "../../utils/pagination-control.js";

/* ============================================================
   🔐 Auth Guard
============================================================ */
const token = initPageGuard(autoPagePermissionKey());
initLogoutWatcher();

/* ============================================================
   🌐 Role + Permissions
============================================================ */
const roleRaw = localStorage.getItem("userRole") || "";
const userRole = roleRaw.trim().toLowerCase();

let perms = [];
try {
  const rawPerms = JSON.parse(localStorage.getItem("permissions") || "[]");
  perms = Array.isArray(rawPerms)
    ? rawPerms.map((p) => String(p.key || p).toLowerCase().trim())
    : [];
} catch {
  perms = [];
}

const user = { role: userRole, permissions: perms };

/* ============================================================
   🧠 Shared State
============================================================ */
const sharedState = { currentEditIdRef: { value: null } };
window.showForm = () => {};
window.resetForm = () => {};

/* ============================================================
   🧩 Field Visibility + Selector
============================================================ */
window.entries = [];
let visibleFields = setupVisibleFields({
  moduleKey: "prescription",
  userRole,
  defaultFields: FIELD_DEFAULTS_PRESCRIPTION,
  allowedFields: FIELD_ORDER_PRESCRIPTION,
});

renderFieldSelector(
  {},
  visibleFields,
  (newFields) => {
    visibleFields = newFields;
    renderDynamicTableHead(visibleFields);
    renderList({ entries, visibleFields, viewMode, user, currentPage });
  },
  FIELD_ORDER_PRESCRIPTION
);

/* ============================================================
   🔎 Filter DOM Refs
============================================================ */
const filterOrg = document.getElementById("filterOrganizationSelect");
const filterFacility = document.getElementById("filterFacilitySelect");
const filterDept = document.getElementById("filterDept");
const filterPatient = document.getElementById("filterPatient");
const filterDoctor = document.getElementById("filterDoctor");
const filterConsultation = document.getElementById("filterConsultation");
const filterRegLog = document.getElementById("filterRegLog");
const filterMedication = document.getElementById("filterMedication");
const filterStatus = document.getElementById("filterStatus");
const filterEmergency = document.getElementById("filterEmergency");
const filterDateFrom = document.getElementById("filterDateFrom");
const filterDateTo = document.getElementById("filterDateTo");

const exportCSVBtn = document.getElementById("exportCSVBtn");
const exportPDFBtn = document.getElementById("exportPDFBtn");

/* ============================================================
   🌍 View + Pagination
============================================================ */
let currentPage = 1;
let totalPages = 1;
let viewMode = localStorage.getItem("prescriptionView") || "table";
const getPagination = initPaginationControl("prescription", loadEntries, 25);

/* ============================================================
   📋 Build Filter Object
============================================================ */
function getFilters() {
  return {
    organization_id: filterOrg?.dataset?.value || "",
    facility_id: filterFacility?.dataset?.value || "",
    department_id: filterDept?.dataset?.value || "",
    patient_id: filterPatient?.dataset?.value || "",
    doctor_id: filterDoctor?.dataset?.value || "",
    consultation_id: filterConsultation?.dataset?.value || "",
    registration_log_id: filterRegLog?.dataset?.value || "",
    medication_id: filterMedication?.dataset?.value || "",
    status: filterStatus?.value || "",
    is_emergency: filterEmergency?.value || "",
    date_from: filterDateFrom?.value || "",
    date_to: filterDateTo?.value || "",
  };
}

/* ============================================================
   📦 Load Prescriptions
============================================================ */
async function loadEntries(page = 1) {
  try {
    showLoading();
    const filters = getFilters();
    const q = new URLSearchParams();

    const { page: safePage, limit: safeLimit } = getPagination(page);
    q.append("page", safePage);
    q.append("limit", safeLimit);

    if (filters.date_from) q.append("prescription_date[gte]", filters.date_from);
    if (filters.date_to) q.append("prescription_date[lte]", filters.date_to);

    Object.entries(filters).forEach(([k, v]) => {
      if (!v || ["date_from", "date_to"].includes(k)) return;
      q.append(k, v);
    });

    const safeFields = visibleFields.filter((f) =>
      FIELD_ORDER_PRESCRIPTION.includes(f)
    );
    if (safeFields.length) q.append("fields", safeFields.join(","));

    const res = await authFetch(`/api/prescriptions?${q.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    const result = await res.json().catch(() => ({}));
    const payload = result?.data || {};
    const records = Array.isArray(payload.records) ? payload.records : [];

    window.entries = records;
    currentPage = Number(payload.pagination?.page) || safePage;
    totalPages = Number(payload.pagination?.pageCount) || 1;

    renderList({ entries, visibleFields, viewMode, user, currentPage });

    setupActionHandlers({
      entries,
      token,
      currentPage,
      loadEntries,
      visibleFields,
      sharedState,
      user,
    });

    renderPaginationControls(
      document.getElementById("paginationButtons"),
      currentPage,
      totalPages,
      loadEntries
    );

    if (!records.length)
      showToast("ℹ️ No prescriptions found for current filters");
  } catch (err) {
    console.error("❌ loadEntries failed:", err);
    showToast("❌ Failed to load prescriptions");
  } finally {
    hideLoading();
  }
}

/* ============================================================
   🧭 View Toggle (Table ↔ Card)
============================================================ */
document.getElementById("tableViewBtn").onclick = () => {
  viewMode = "table";
  localStorage.setItem("prescriptionView", "table");
  renderList({ entries, visibleFields, viewMode, user, currentPage });
  document.getElementById("tableViewBtn")?.classList.add("active");
  document.getElementById("cardViewBtn")?.classList.remove("active");
};

document.getElementById("cardViewBtn").onclick = () => {
  viewMode = "card";
  localStorage.setItem("prescriptionView", "card");
  renderList({ entries, visibleFields, viewMode, user, currentPage });
  document.getElementById("cardViewBtn")?.classList.add("active");
  document.getElementById("tableViewBtn")?.classList.remove("active");
};

/* ============================================================
   🔍 Filter Actions
============================================================ */
document.getElementById("filterBtn").onclick = async () => await loadEntries(1);

document.getElementById("resetFilterBtn").onclick = () => {
  [
    filterOrg,
    filterFacility,
    filterDept,
    filterPatient,
    filterDoctor,
    filterConsultation,
    filterRegLog,
    filterMedication,
    filterStatus,
    filterEmergency,
    filterDateFrom,
    filterDateTo,
  ].forEach((el) => {
    if (el) {
      el.value = "";
      if (el.dataset) el.dataset.value = "";
    }
  });
  loadEntries(1);
};

/* ============================================================
   ⬇️ Export Tools
============================================================ */
if (exportCSVBtn)
  exportCSVBtn.onclick = () =>
    exportToExcel(
      entries,
      `prescriptions_${new Date().toISOString().slice(0, 10)}.xlsx`
    );

if (exportPDFBtn)
  exportPDFBtn.onclick = () => {
    const target =
      viewMode === "table" ? ".table-container" : "#prescriptionList";
    exportToPDF("Prescriptions List", target, "portrait", true);
  };

/* ============================================================
   🚀 Init Module
============================================================ */
export async function initPrescriptionModule() {
  renderDynamicTableHead(visibleFields);

  const filterCollapse = document.getElementById("filterCollapse");
  const filterChevron = document.getElementById("filterChevron");

  const filterVisible =
    localStorage.getItem("prescriptionFilterVisible") === "true";
  if (filterVisible) {
    filterCollapse?.classList.remove("hidden");
    filterChevron?.classList.add("chevron-rotate");
  } else {
    filterCollapse?.classList.add("hidden");
    filterChevron?.classList.remove("chevron-rotate");
  }

  setupToggleSection(
    "toggleFilterBtn",
    "filterCollapse",
    "filterChevron",
    "prescriptionFilterVisible"
  );

  /* ----------------- Suggestion Inputs ----------------- */
  if (filterOrg)
    setupSuggestionInputDynamic(
      filterOrg,
      document.getElementById("filterOrgSuggestions"),
      "/api/lite/organizations",
      (sel) => {
        filterOrg.dataset.value = sel?.id || "";
        if (filterFacility) {
          filterFacility.value = "";
          filterFacility.dataset.value = "";
        }
      },
      "name"
    );

  if (filterFacility)
    setupSuggestionInputDynamic(
      filterFacility,
      document.getElementById("filterFacilitySuggestions"),
      "/api/lite/facilities",
      (sel) => (filterFacility.dataset.value = sel?.id || ""),
      "name",
      {
        extraParams: () => ({
          organization_id: filterOrg?.dataset?.value || "",
        }),
      }
    );

  if (filterDept)
    setupSuggestionInputDynamic(
      filterDept,
      document.getElementById("filterDeptSuggestions"),
      "/api/lite/departments",
      (sel) => (filterDept.dataset.value = sel?.id || ""),
      "name",
      {
        extraParams: () => ({
          organization_id: filterOrg?.dataset?.value || "",
          facility_id: filterFacility?.dataset?.value || "",
        }),
      }
    );

  if (filterPatient)
    setupSuggestionInputDynamic(
      filterPatient,
      document.getElementById("filterPatientSuggestions"),
      "/api/lite/patients",
      (sel) => (filterPatient.dataset.value = sel?.id || ""),
      "full_name"
    );

  if (filterDoctor)
    setupSuggestionInputDynamic(
      filterDoctor,
      document.getElementById("filterDoctorSuggestions"),
      "/api/lite/employees",
      (sel) => (filterDoctor.dataset.value = sel?.id || ""),
      "full_name"
    );

  if (filterConsultation)
    setupSuggestionInputDynamic(
      filterConsultation,
      document.getElementById("filterConsultationSuggestions"),
      "/api/lite/consultations",
      (sel) => (filterConsultation.dataset.value = sel?.id || ""),
      "id"
    );

  if (filterRegLog)
    setupSuggestionInputDynamic(
      filterRegLog,
      document.getElementById("filterRegLogSuggestions"),
      "/api/lite/registration-logs",
      (sel) => (filterRegLog.dataset.value = sel?.id || ""),
      "id"
    );

  if (filterMedication)
    setupSuggestionInputDynamic(
      filterMedication,
      document.getElementById("filterMedicationSuggestions"),
      "/api/lite/billable-items?category=medication",
      (sel) => (filterMedication.dataset.value = sel?.id || ""),
      "name"
    );

  await loadEntries(1);
}

/* ============================================================
   🔁 Sync Helper
============================================================ */
export function syncRefsToState() {
  // reserved for advanced reactive integration
}

/* ============================================================
   🏁 Boot
============================================================ */
function boot() {
  initPrescriptionModule().catch((err) =>
    console.error("initPrescriptionModule failed:", err)
  );
}
if (document.readyState === "loading")
  document.addEventListener("DOMContentLoaded", boot);
else boot();
