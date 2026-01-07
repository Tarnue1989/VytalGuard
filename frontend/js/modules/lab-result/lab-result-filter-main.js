// 📦 lab-result-filter-main.js – Filters + Table/Card (permission-aware, enterprise-aligned)
// ============================================================
// 💉 Enterprise-Aligned (Consultation Master Pattern)
// Secure, role-aware list view for Lab Results
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
import { setupSuggestionInputDynamic } from "../../utils/data-loaders.js";
import { renderFieldSelector } from "../../utils/ui-utils.js";
import { exportToExcel, exportToPDF } from "../../utils/export-utils.js";
import { renderList, renderDynamicTableHead } from "./lab-result-render.js";
import { setupActionHandlers } from "./lab-result-actions.js";
import {
  FIELD_ORDER_LAB_RESULT,
  FIELD_DEFAULTS_LAB_RESULT,
} from "./lab-result-constants.js";
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
  moduleKey: "lab_result",
  userRole,
  defaultFields: FIELD_DEFAULTS_LAB_RESULT,
  allowedFields: FIELD_ORDER_LAB_RESULT,
});

renderFieldSelector(
  {},
  visibleFields,
  (newFields) => {
    visibleFields = newFields;
    renderDynamicTableHead(visibleFields);
    renderList({ entries, visibleFields, viewMode, user, currentPage });
  },
  FIELD_ORDER_LAB_RESULT
);

/* ============================================================
   🔎 Filter DOM Refs
============================================================ */
const filterSearch = document.getElementById("filterSearch");
const filterSearchSuggestions = document.getElementById("filterSearchSuggestions");

const filterOrganization = document.getElementById("filterOrganization");
const filterOrganizationSuggestions = document.getElementById("filterOrganizationSuggestions");

const filterFacility = document.getElementById("filterFacility");
const filterFacilitySuggestions = document.getElementById("filterFacilitySuggestions");

const filterDepartment = document.getElementById("filterDepartment");
const filterDepartmentSuggestions = document.getElementById("filterDepartmentSuggestions");

const filterPatient = document.getElementById("filterPatient");
const filterPatientSuggestions = document.getElementById("filterPatientSuggestions");

const filterDoctor = document.getElementById("filterDoctor");
const filterDoctorSuggestions = document.getElementById("filterDoctorSuggestions");

const filterStatus = document.getElementById("filterStatus");
const filterResultFrom = document.getElementById("filterResultFrom");
const filterResultTo = document.getElementById("filterResultTo");

const exportCSVBtn = document.getElementById("exportCSVBtn");
const exportPDFBtn = document.getElementById("exportPDFBtn");

/* ============================================================
   🌍 View + Paging
============================================================ */
let currentPage = 1;
let totalPages = 1;
let viewMode = localStorage.getItem("labResultView") || "table";

// ✅ Add pagination helper (fixes records-per-page dropdown)
const getPagination = initPaginationControl("lab_result", loadEntries, 25);

/* ============================================================
   🧩 Helpers
============================================================ */
function normalizeDateInput(val) {
  if (!val) return "";
  const d = new Date(val);
  if (isNaN(d.getTime())) return "";
  return d.toISOString().split("T")[0]; // Ensures YYYY-MM-DD
}

/* ============================================================
   📋 Build Filter Object
============================================================ */
function getFilters() {
  return {
    search: filterSearch?.value || "",
    organization_id: filterOrganization?.dataset.value || "",
    facility_id: filterFacility?.dataset.value || "",
    department_id: filterDepartment?.dataset.value || "",
    patient_id: filterPatient?.dataset.value || "",
    doctor_id: filterDoctor?.dataset.value || "",
    status: filterStatus?.value || "",
    result_from: filterResultFrom?.value || "",
    result_to: filterResultTo?.value || "",
  };
}

/* ============================================================
   ✅ Safe DB Fields
============================================================ */
const SAFE_DB_FIELDS = [
  "id",
  "patient_id",
  "doctor_id",
  "department_id",
  "consultation_id",
  "registration_log_id",
  "lab_request_id",
  "billable_item_id",
  "result",
  "notes",
  "doctor_notes",
  "result_date",
  "attachment_url",
  "status",
  "created_at",
  "updated_at",
  "deleted_at",
];

/* ============================================================
   📦 Load Lab Results
============================================================ */
async function loadEntries(page = 1) {
  try {
    showLoading();

    const filters = getFilters();
    const q = new URLSearchParams();

    // ✅ Pagination + Limit
    const { page: safePage, limit: safeLimit } = getPagination(page);
    q.append("page", safePage);
    q.append("limit", safeLimit);

    // ✅ Add search if available
    if (filters.search) q.append("search", filters.search);

    // ✅ Normalize & Add Date Range
    const fromDate = normalizeDateInput(filters.result_from);
    const toDate = normalizeDateInput(filters.result_to);
    if (fromDate) q.append("result_date[gte]", fromDate);
    if (toDate) q.append("result_date[lte]", toDate);

    // ✅ Append remaining filters
    Object.entries(filters).forEach(([k, v]) => {
      if (!v || ["result_from", "result_to", "search"].includes(k)) return;
      q.append(k, v);
    });

    // ✅ Safe visible fields
    const safeFields = visibleFields.filter((f) => SAFE_DB_FIELDS.includes(f));
    if (safeFields.length) q.append("fields", safeFields.join(","));

    const res = await authFetch(`/api/lab-results?${q.toString()}`, {
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
  } catch (err) {
    console.error("❌ loadEntries failed:", err);
    showToast("❌ Failed to load lab results");
  } finally {
    hideLoading();
  }
}

/* ============================================================
   🧭 View Toggle
============================================================ */
document.getElementById("tableViewBtn").onclick = () => {
  viewMode = "table";
  localStorage.setItem("labResultView", "table");
  renderList({ entries, visibleFields, viewMode, user, currentPage });
  document.getElementById("tableViewBtn")?.classList.add("active");
  document.getElementById("cardViewBtn")?.classList.remove("active");
};

document.getElementById("cardViewBtn").onclick = () => {
  viewMode = "card";
  localStorage.setItem("labResultView", "card");
  renderList({ entries, visibleFields, viewMode, user, currentPage });
  document.getElementById("cardViewBtn")?.classList.add("active");
  document.getElementById("tableViewBtn")?.classList.remove("active");
};

/* ============================================================
   🔎 Filter Actions
============================================================ */
document.getElementById("filterBtn").onclick = async () => await loadEntries(1);

document.getElementById("resetFilterBtn").onclick = () => {
  [
    filterSearch,
    filterOrganization,
    filterFacility,
    filterDepartment,
    filterPatient,
    filterDoctor,
    filterStatus,
    filterResultFrom,
    filterResultTo,
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
    exportToExcel(entries, `lab_results_${new Date().toISOString().slice(0, 10)}.xlsx`);

if (exportPDFBtn)
  exportPDFBtn.onclick = () => {
    const target = viewMode === "table" ? ".table-container" : "#labResultList";
    exportToPDF("Lab Result List", target, "portrait", true);
  };

/* ============================================================
   🚀 Init Module
============================================================ */
export async function initLabResultModule() {
  renderDynamicTableHead(visibleFields);

  const filterCollapse = document.getElementById("filterCollapse");
  const filterChevron = document.getElementById("filterChevron");

  const filterVisible = localStorage.getItem("labResultFilterVisible") === "true";
  if (filterVisible) {
    filterCollapse?.classList.remove("hidden");
    filterChevron?.classList.add("chevron-rotate");
  } else {
    filterCollapse?.classList.add("hidden");
    filterChevron?.classList.remove("chevron-rotate");
  }

  setupToggleSection("toggleFilterBtn", "filterCollapse", "filterChevron", "labResultFilterVisible");

  if (filterSearch && filterSearchSuggestions) {
    setupSuggestionInputDynamic(
      filterSearch,
      filterSearchSuggestions,
      "/api/lite/lab-results",
      (selected) => (filterSearch.dataset.value = selected.id),
      "label"
    );
  }

  if (filterOrganization && filterOrganizationSuggestions) {
    setupSuggestionInputDynamic(
      filterOrganization,
      filterOrganizationSuggestions,
      "/api/lite/organizations",
      (selected) => {
        filterOrganization.dataset.value = selected.id;
        filterFacility.value = "";
        filterFacility.dataset.value = "";
        filterDepartment.value = "";
        filterDepartment.dataset.value = "";
      },
      "name"
    );
  }

  if (filterFacility && filterFacilitySuggestions) {
    setupSuggestionInputDynamic(
      filterFacility,
      filterFacilitySuggestions,
      "/api/lite/facilities",
      (selected) => {
        filterFacility.dataset.value = selected.id;
        filterDepartment.value = "";
        filterDepartment.dataset.value = "";
      },
      "name",
      { extraParams: () => ({ organization_id: filterOrganization?.dataset.value || "" }) }
    );
  }

  if (filterDepartment && filterDepartmentSuggestions) {
    setupSuggestionInputDynamic(
      filterDepartment,
      filterDepartmentSuggestions,
      "/api/lite/departments",
      (selected) => (filterDepartment.dataset.value = selected.id),
      "name",
      { extraParams: () => ({ facility_id: filterFacility?.dataset.value || "" }) }
    );
  }

  if (filterPatient && filterPatientSuggestions) {
    setupSuggestionInputDynamic(
      filterPatient,
      filterPatientSuggestions,
      "/api/lite/patients",
      (selected) => (filterPatient.dataset.value = selected.id),
      "label"
    );
  }

  if (filterDoctor && filterDoctorSuggestions) {
    setupSuggestionInputDynamic(
      filterDoctor,
      filterDoctorSuggestions,
      "/api/lite/employees",
      (selected) => (filterDoctor.dataset.value = selected.id),
      "label",
      { extraParams: () => ({ position: "Doctor" }) }
    );
  }

  await loadEntries(1);
}

/* ============================================================
   🏁 Boot
============================================================ */
function boot() {
  initLabResultModule().catch((err) =>
    console.error("initLabResultModule failed:", err)
  );
}
if (document.readyState === "loading")
  document.addEventListener("DOMContentLoaded", boot);
else boot();
