// 📦 labrequest-filter-main.js – Filters + Table/Card (Master Pattern Aligned)

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
import { renderList, renderDynamicTableHead } from "./lab-request-render.js";
import { setupActionHandlers } from "./lab-request-actions.js";
import {
  FIELD_ORDER_LAB_REQUEST,
  FIELD_DEFAULTS_LAB_REQUEST,
} from "./lab-request-constants.js";
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
  moduleKey: "lab_request",
  userRole,
  defaultFields: FIELD_DEFAULTS_LAB_REQUEST,
  allowedFields: FIELD_ORDER_LAB_REQUEST,
});

renderFieldSelector(
  {},
  visibleFields,
  (newFields) => {
    visibleFields = newFields;
    renderDynamicTableHead(visibleFields);
    renderList({ entries, visibleFields, viewMode, user, currentPage });
  },
  FIELD_ORDER_LAB_REQUEST
);

/* ============================================================
   🔎 Filter DOM Refs  (aligned with HTML)
============================================================ */
const filterOrg = document.getElementById("filterOrganizationSelect");
const filterFacility = document.getElementById("filterFacilitySelect");
const filterDept = document.getElementById("filterDept");
const filterPatient = document.getElementById("filterPatient");
const filterDoctor = document.getElementById("filterDoctor");
const filterConsultation = document.getElementById("filterConsultation");
const filterRegLog = document.getElementById("filterRegLog");
const filterLabTest = document.getElementById("filterLabTest");
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
let viewMode = localStorage.getItem("labRequestView") || "table";
const getPagination = initPaginationControl("lab_request", loadEntries, 25);

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
    lab_test_id: filterLabTest?.dataset?.value || "",
    status: filterStatus?.value || "",
    is_emergency: filterEmergency?.value || "",
    request_from: filterDateFrom?.value || "",
    request_to: filterDateTo?.value || "",
  };
}

/* ============================================================
   📦 Load Lab Requests
============================================================ */
async function loadEntries(page = 1) {
  try {
    showLoading();
    const filters = getFilters();
    const q = new URLSearchParams();

    const { page: safePage, limit: safeLimit } = getPagination(page);
    q.append("page", safePage);
    q.append("limit", safeLimit);

    // ✅ Proper request_date range filtering
    if (filters.request_from) q.append("request_date[gte]", filters.request_from);
    if (filters.request_to) q.append("request_date[lte]", filters.request_to);

    // ✅ Skip the request_from/request_to so they don’t double-append
    Object.entries(filters).forEach(([k, v]) => {
      if (!v || ["request_from", "request_to"].includes(k)) return;
      q.append(k, v);
    });

    const safeFields = visibleFields.filter((f) =>
      FIELD_ORDER_LAB_REQUEST.includes(f)
    );
    if (safeFields.length) q.append("fields", safeFields.join(","));

    const res = await authFetch(`/api/lab-requests?${q.toString()}`, {
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
      showToast("ℹ️ No lab requests found for current filters");
  } catch (err) {
    console.error("❌ loadEntries failed:", err);
    showToast("❌ Failed to load lab requests");
  } finally {
    hideLoading();
  }
}

/* ============================================================
   🧭 View Toggle (Table ↔ Card)
============================================================ */
document.getElementById("tableViewBtn").onclick = () => {
  viewMode = "table";
  localStorage.setItem("labRequestView", "table");
  renderList({ entries, visibleFields, viewMode, user, currentPage });
  document.getElementById("tableViewBtn")?.classList.add("active");
  document.getElementById("cardViewBtn")?.classList.remove("active");
};

document.getElementById("cardViewBtn").onclick = () => {
  viewMode = "card";
  localStorage.setItem("labRequestView", "card");
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
    filterLabTest,
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
      `lab_requests_${new Date().toISOString().slice(0, 10)}.xlsx`
    );

if (exportPDFBtn)
  exportPDFBtn.onclick = () => {
    const target =
      viewMode === "table" ? ".table-container" : "#labRequestList";
    exportToPDF("Lab Requests List", target, "portrait", true);
  };

/* ============================================================
   🚀 Init Module
============================================================ */
export async function initLabRequestModule() {
  renderDynamicTableHead(visibleFields);

  const filterCollapse = document.getElementById("filterCollapse");
  const filterChevron = document.getElementById("filterChevron");

  const filterVisible =
    localStorage.getItem("labRequestFilterVisible") === "true";
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
    "labRequestFilterVisible"
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

  if (filterLabTest)
    setupSuggestionInputDynamic(
      filterLabTest,
      document.getElementById("filterLabTestSuggestions"),
      "/api/lite/billable-items",
      (sel) => (filterLabTest.dataset.value = sel?.id || ""),
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
  initLabRequestModule().catch((err) =>
    console.error("initLabRequestModule failed:", err)
  );
}
if (document.readyState === "loading")
  document.addEventListener("DOMContentLoaded", boot);
else boot();
