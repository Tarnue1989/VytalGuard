// 📦 lab-result-filter-main.js – Enterprise Filter + Table/Card (MASTER PARITY)
// ============================================================================
// 🔹 FULL parity with lab-request-filter-main.js
// 🔹 Auto search, auto filters, sorting, pagination
// 🔹 UI-only dateRange (single input, NEVER DB column)
// 🔹 Org / Facility / Dept / Doctor wired correctly (SELECT-based)
// 🔹 Status fully wired
// 🔹 Summary + export aligned
// 🔹 ALL existing Lab Result API calls PRESERVED
// ============================================================================

import {
  showToast,
  showLoading,
  hideLoading,
  initPageGuard,
  setupToggleSection,
  renderPaginationControls,
  initLogoutWatcher,
  autoPagePermissionKey,
} from "../../utils/index.js";

import { authFetch } from "../../authSession.js";

import {
  loadOrganizationsLite,
  loadFacilitiesLite,
  loadDepartmentsLite,
  loadEmployeesLite,
  setupSelectOptions,
} from "../../utils/data-loaders.js";

import { renderFieldSelector } from "../../utils/ui-utils.js";
import { exportToExcel, exportToPDF } from "../../utils/export-utils.js";

import {
  renderList,
  renderDynamicTableHead,
} from "./lab-result-render.js";

import { setupActionHandlers } from "./lab-result-actions.js";

import {
  FIELD_ORDER_LAB_RESULT,
  FIELD_DEFAULTS_LAB_RESULT,
  FIELD_LABELS_LAB_RESULT,
} from "./lab-result-constants.js";

import { setupVisibleFields } from "../../utils/field-visibility.js";
import { initPaginationControl } from "../../utils/pagination-control.js";
import { setupAutoSearch, setupAutoFilters } from "../../utils/search-utils.js";
import { mapDataForExport } from "../../utils/export-mapper.js";
import { syncViewToggleUI } from "../../utils/view-toggle.js";
import { renderModuleSummary } from "../../utils/render-module-summary.js";

/* ============================================================
   🔐 AUTH + USER
============================================================ */
const token = initPageGuard(autoPagePermissionKey());
initLogoutWatcher();

const userRole = (localStorage.getItem("userRole") || "").toLowerCase();
const permissions = (() => {
  try {
    return (JSON.parse(localStorage.getItem("permissions")) || []).map((p) =>
      String(p.key || p).toLowerCase()
    );
  } catch {
    return [];
  }
})();
const user = { role: userRole, permissions };

/* ============================================================
   🧠 STATE
============================================================ */
let entries = [];
let currentPage = 1;
let viewMode = localStorage.getItem("labResultView") || "table";
let sortBy = "";
let sortDir = "asc";

const sharedState = { currentEditIdRef: { value: null } };

/* ============================================================
   👁️ FIELD VISIBILITY
============================================================ */
let visibleFields = setupVisibleFields({
  moduleKey: "lab_result",
  userRole,
  defaultFields: FIELD_DEFAULTS_LAB_RESULT,
  allowedFields: FIELD_ORDER_LAB_RESULT,
});

/* ============================================================
   🧩 FIELD SELECTOR
============================================================ */
renderFieldSelector(
  {},
  visibleFields,
  (fields) => {
    visibleFields = fields;
    renderDynamicTableHead(visibleFields);
    renderList({ entries, visibleFields, viewMode, user, currentPage });
  },
  FIELD_ORDER_LAB_RESULT
);

/* ============================================================
   🔎 FILTER DOM
============================================================ */
const qs = (id) => document.getElementById(id);

const globalSearch   = qs("filterSearch");
const filterOrg      = qs("filterOrganizationSelect");
const filterFacility = qs("filterFacilitySelect");
const filterDept     = qs("filterDepartment");
const filterDoctor   = qs("filterDoctor");
const filterStatus   = qs("filterStatus");
const dateRange      = qs("dateRange");

/* ============================================================
   🔃 SORT BRIDGE
============================================================ */
window.setLabResultSort = (field, dir) => {
  sortBy = field;
  sortDir = dir;
};
window.loadLabResultPage = (p = 1) => loadEntries(p);

/* ============================================================
   📄 PAGINATION
============================================================ */
const getPagination = initPaginationControl(
  "lab_result",
  loadEntries,
  Number(localStorage.getItem("lab_resultPageLimit") || 25)
);

/* ============================================================
   🔎 AUTO SEARCH / FILTERS
============================================================ */
globalSearch && setupAutoSearch(globalSearch, loadEntries);

setupAutoFilters({
  searchInput: globalSearch,
  selectInputs: [
    filterOrg,
    filterFacility,
    filterDept,
    filterDoctor,
    filterStatus,
  ],
  dateRangeInput: dateRange,
  onChange: loadEntries,
});

/* ============================================================
   📋 FILTER BUILDER
============================================================ */
function getFilters() {
  return {
    search: globalSearch?.value?.trim(),
    organization_id: filterOrg?.value,
    facility_id: filterFacility?.value,
    department_id: filterDept?.value,
    doctor_id: filterDoctor?.value,
    status: filterStatus?.value,
    dateRange: dateRange?.value,
  };
}

/* ============================================================
   📦 LOAD LAB RESULTS
============================================================ */
async function loadEntries(page = 1) {
  try {
    showLoading();

    const q = new URLSearchParams();
    const { page: safePage, limit } = getPagination(page);
    const f = getFilters();

    q.set("page", safePage);
    q.set("limit", limit);

    if (sortBy) {
      q.set("sort_by", sortBy);
      q.set("sort_order", sortDir);
    }

    if (f.search)          q.set("search", f.search);
    if (f.dateRange)       q.set("dateRange", f.dateRange);
    if (f.organization_id) q.set("organization_id", f.organization_id);
    if (f.facility_id)     q.set("facility_id", f.facility_id);
    if (f.department_id)   q.set("department_id", f.department_id);
    if (f.doctor_id)       q.set("doctor_id", f.doctor_id);
    if (f.status)          q.set("status", f.status);

    const res = await authFetch(`/api/lab-results?${q.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    const json = await res.json();
    if (!res.ok) throw new Error(json?.message);

    const data = json.data || {};
    entries = data.records || [];
    currentPage = data.pagination?.page || safePage;

    renderList({ entries, visibleFields, viewMode, user, currentPage });

    data.summary &&
      renderModuleSummary(data.summary, "moduleSummary", {
        moduleLabel: "LAB RESULTS",
      });

    syncViewToggleUI({ mode: viewMode });

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
      qs("paginationButtons"),
      currentPage,
      data.pagination?.pageCount || 1,
      loadEntries
    );
  } catch (err) {
    console.error(err);
    showToast("❌ Failed to load lab results");
  } finally {
    hideLoading();
  }
}
/* ============================================================
   🧭 VIEW TOGGLE (RESTORED)
============================================================ */
qs("tableViewBtn")?.addEventListener("click", () => {
  viewMode = "table";
  localStorage.setItem("labResultView", "table");
  syncViewToggleUI({ mode: viewMode });
  renderList({ entries, visibleFields, viewMode, user, currentPage });
});

qs("cardViewBtn")?.addEventListener("click", () => {
  viewMode = "card";
  localStorage.setItem("labResultView", "card");
  syncViewToggleUI({ mode: viewMode });
  renderList({ entries, visibleFields, viewMode, user, currentPage });
});
/* ============================================================
   🔄 RESET FILTERS
============================================================ */
qs("resetFilterBtn").onclick = () => {
  [
    globalSearch,
    filterOrg,
    filterFacility,
    filterDept,
    filterDoctor,
    filterStatus,
    dateRange,
  ].forEach((el) => el && (el.value = ""));
  loadEntries(1);
};

/* ============================================================
   🚀 INIT
============================================================ */
export async function initLabResultModule() {
  renderDynamicTableHead(visibleFields);
  syncViewToggleUI({ mode: viewMode });
  setupToggleSection(
    "toggleFilterBtn",
    "filterCollapse",
    "filterChevron",
    "labResultFilterVisible"
  );

  // Load Organizations
  const orgs = await loadOrganizationsLite();
  orgs.unshift({ id: "", name: "-- All Organizations --" });
  setupSelectOptions(filterOrg, orgs, "id", "name");

  // Load Facilities
  const reloadFacilities = async (orgId = null) => {
    const facs = await loadFacilitiesLite(
      orgId ? { organization_id: orgId } : {},
      true
    );
    facs.unshift({ id: "", name: "-- All Facilities --" });
    setupSelectOptions(filterFacility, facs, "id", "name");
  };

  await reloadFacilities();
  filterOrg.onchange = () => reloadFacilities(filterOrg.value || null);

  // Load Departments
  const depts = await loadDepartmentsLite({}, true);
  depts.unshift({ id: "", name: "-- All Departments --" });
  setupSelectOptions(filterDept, depts, "id", "name");

  // Load Doctors
  const doctors = await loadEmployeesLite({ position: "Doctor" }, true);
  doctors.unshift({ id: "", full_name: "-- All Doctors --" });
  setupSelectOptions(filterDoctor, doctors, "id", "full_name");

  await loadEntries(1);
}

/* ============================================================
   🏁 BOOT
============================================================ */
document.readyState === "loading"
  ? document.addEventListener("DOMContentLoaded", initLabResultModule)
  : initLabResultModule();