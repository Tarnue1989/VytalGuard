// 📦 employee-filter-main.js – Enterprise Filter + Table/Card (Master Pattern Aligned)
// ============================================================================
// 🔹 Fully synchronized with consultation-filter-main.js
// 🔹 Role-aware dropdowns, tooltips, export, pagination, and field visibility
// 🔹 Preserves all IDs and linked HTML behavior (non-breaking upgrade)
// ============================================================================

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
  loadOrganizationsLite,
  loadFacilitiesLite,
  loadDepartmentsLite,
  setupSuggestionInputDynamic,
  setupSelectOptions,
} from "../../utils/data-loaders.js";

import { renderFieldSelector } from "../../utils/ui-utils.js";
import { exportToExcel, exportToPDF } from "../../utils/export-utils.js";
import { renderList, renderDynamicTableHead } from "./employee-render.js";
import { setupActionHandlers } from "./employee-actions.js";
import {
  FIELD_ORDER_EMPLOYEE,
  FIELD_DEFAULTS_EMPLOYEE,
} from "./employee-constants.js";
import { setupVisibleFields } from "../../utils/field-visibility.js";
import { initPaginationControl } from "../../utils/pagination-control.js";

/* ============================================================
   🔐 Auth Guard + Role Context
============================================================ */
const token = initPageGuard(autoPagePermissionKey());
initLogoutWatcher();

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
  moduleKey: "employee",
  userRole,
  defaultFields: FIELD_DEFAULTS_EMPLOYEE,
  allowedFields: FIELD_ORDER_EMPLOYEE,
});

renderFieldSelector(
  {},
  visibleFields,
  (newFields) => {
    visibleFields = newFields;
    renderDynamicTableHead(visibleFields);
    renderList({ entries, visibleFields, viewMode, user, currentPage });
  },
  FIELD_ORDER_EMPLOYEE
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

const filterGender = document.getElementById("filterGender");
const filterStatus = document.getElementById("filterStatus");
const filterCreatedFrom = document.getElementById("filterCreatedFrom");
const filterCreatedTo = document.getElementById("filterCreatedTo");

const exportCSVBtn = document.getElementById("exportCSVBtn");
const exportPDFBtn = document.getElementById("exportPDFBtn");

/* ============================================================
   🌍 View + Pagination State
============================================================ */
let currentPage = 1;
let totalPages = 1;
let viewMode = localStorage.getItem("employeeView") || "table";
const getPagination = initPaginationControl("employee", loadEntries, 25);

/* ============================================================
   📋 Build Filters
============================================================ */
function getFilters() {
  return {
    global: filterSearch?.dataset.value || "",
    organization_id: filterOrganization?.dataset.value || "",
    facility_id: filterFacility?.dataset.value || "",
    department_id: filterDepartment?.dataset.value || "",
    gender: filterGender?.value || "",
    status: filterStatus?.value || "",
    created_from: filterCreatedFrom?.value || "",
    created_to: filterCreatedTo?.value || "",
  };
}

/* ============================================================
   📦 Load Employees
============================================================ */
async function loadEntries(page = 1) {
  try {
    showLoading();

    const filters = getFilters();
    const q = new URLSearchParams();
    const { page: safePage, limit: safeLimit } = getPagination(page);

    q.append("page", safePage);
    q.append("limit", safeLimit);

    if (filters.created_from) q.append("created_at[gte]", filters.created_from);
    if (filters.created_to) q.append("created_at[lte]", filters.created_to);

    Object.entries(filters).forEach(([k, v]) => {
      if (!v || ["created_from", "created_to"].includes(k)) return;
      q.append(k, v);
    });

    const safeFields = visibleFields.filter((f) =>
      FIELD_ORDER_EMPLOYEE.includes(f)
    );
    if (safeFields.length) q.append("fields", safeFields.join(","));

    const res = await authFetch(`/api/employees?${q.toString()}`);
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

    if (!records.length) showToast("ℹ️ No employees found for current filters");
  } catch (err) {
    console.error("❌ loadEntries failed:", err);
    showToast("❌ Failed to load employees");
  } finally {
    hideLoading();
  }
}

/* ============================================================
   🧭 View Toggle (Table ↔ Card)
============================================================ */
document.getElementById("tableViewBtn").onclick = () => {
  viewMode = "table";
  localStorage.setItem("employeeView", "table");
  renderList({ entries, visibleFields, viewMode, user, currentPage });
  document.getElementById("tableViewBtn")?.classList.add("active");
  document.getElementById("cardViewBtn")?.classList.remove("active");
};

document.getElementById("cardViewBtn").onclick = () => {
  viewMode = "card";
  localStorage.setItem("employeeView", "card");
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
    filterSearch,
    filterOrganization,
    filterFacility,
    filterDepartment,
    filterGender,
    filterStatus,
    filterCreatedFrom,
    filterCreatedTo,
  ].forEach((el) => {
    if (!el) return;
    el.value = "";
    if (el.dataset) el.dataset.value = "";
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
      `employees_${new Date().toISOString().slice(0, 10)}.xlsx`
    );

if (exportPDFBtn)
  exportPDFBtn.onclick = () => {
    const target = viewMode === "table" ? ".table-container" : "#employeeList";
    exportToPDF("Employee List", target, "portrait", true);
  };

/* ============================================================
   🚀 Init Module
============================================================ */
export async function initEmployeeModule() {
  renderDynamicTableHead(visibleFields);

  const filterCollapse = document.getElementById("filterCollapse");
  const filterChevron = document.getElementById("filterChevron");
  const filterVisible = localStorage.getItem("employeeFilterVisible") === "true";

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
    "employeeFilterVisible"
  );

  /* --------------------------- Suggestion Inputs --------------------------- */
  setupSuggestionInputDynamic(
    filterSearch,
    filterSearchSuggestions,
    "/api/lite/employees",
    (selected) => (filterSearch.dataset.value = selected?.id || ""),
    "label"
  );

  setupSuggestionInputDynamic(
    filterOrganization,
    filterOrganizationSuggestions,
    "/api/lite/organizations",
    (selected) => {
      filterOrganization.dataset.value = selected?.id || "";
      filterFacility.value = "";
      filterFacility.dataset.value = "";
      filterDepartment.value = "";
      filterDepartment.dataset.value = "";
    },
    "name"
  );

  setupSuggestionInputDynamic(
    filterFacility,
    filterFacilitySuggestions,
    "/api/lite/facilities",
    (selected) => {
      filterFacility.dataset.value = selected?.id || "";
      filterDepartment.value = "";
      filterDepartment.dataset.value = "";
    },
    "name",
    {
      extraParams: () => ({
        organization_id: filterOrganization?.dataset.value || "",
      }),
    }
  );

  setupSuggestionInputDynamic(
    filterDepartment,
    filterDepartmentSuggestions,
    "/api/lite/departments",
    (selected) => (filterDepartment.dataset.value = selected?.id || ""),
    "name",
    {
      extraParams: () => ({
        facility_id: filterFacility?.dataset.value || "",
      }),
    }
  );

  await loadEntries(1);
}

/* ============================================================
   🏁 Boot
============================================================ */
function boot() {
  initEmployeeModule().catch((err) =>
    console.error("initEmployeeModule failed:", err)
  );
}
if (document.readyState === "loading")
  document.addEventListener("DOMContentLoaded", boot);
else boot();
