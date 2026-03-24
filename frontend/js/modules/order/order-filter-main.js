// 📦 order-filter-main.js – Enterprise Filter + Table/Card (MASTER PARITY)
// ============================================================================
// 🔹 Lab Request → Order Adaptation
// 🔹 FULL MASTER pattern preserved
// 🔹 API: /api/orders
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
  setupSelectOptions,
  setupSuggestionInputDynamic,
} from "../../utils/data-loaders.js";

import { renderFieldSelector } from "../../utils/ui-utils.js";
import { exportToExcel, exportToPDF } from "../../utils/export-utils.js";

import {
  renderList,
  renderDynamicTableHead,
} from "./order-render.js";

import { setupActionHandlers } from "./order-actions.js";

import {
  FIELD_ORDER_ORDER,
  FIELD_DEFAULTS_ORDER,
  FIELD_LABELS_ORDER,
} from "./order-constants.js";

import { setupVisibleFields } from "../../utils/field-visibility.js";
import { initPaginationControl } from "../../utils/pagination-control.js";
import { setupAutoSearch, setupAutoFilters } from "../../utils/search-utils.js";
import { mapDataForExport } from "../../utils/export-mapper.js";
import { syncViewToggleUI } from "../../utils/view-toggle.js";
import { renderModuleSummary } from "../../utils/render-module-summary.js";

/* ============================================================
   🔐 AUTH
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
let viewMode = localStorage.getItem("orderView") || "table";
let sortBy = "";
let sortDir = "asc";

const sharedState = { currentEditIdRef: { value: null } };

/* ============================================================
   👁️ FIELD VISIBILITY
============================================================ */
let visibleFields = setupVisibleFields({
  moduleKey: "order",
  userRole,
  defaultFields: FIELD_DEFAULTS_ORDER,
  allowedFields: FIELD_ORDER_ORDER,
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
  FIELD_ORDER_ORDER
);

/* ============================================================
   🔎 FILTER DOM
============================================================ */
const qs = (id) => document.getElementById(id);

const globalSearch   = qs("globalSearch");
const filterOrg      = qs("filterOrganizationSelect");
const filterFacility = qs("filterFacilitySelect");
const filterStatus   = qs("filterStatus");
const dateRange      = qs("dateRange");

const filterPatient            = qs("filterPatient");
const filterPatientHidden      = qs("filterPatientId");
const filterPatientSuggestions = qs("filterPatientSuggestions");

const filterProvider           = qs("filterProvider");
const filterProviderHidden     = qs("filterProviderId");
const filterProviderSuggestions= qs("filterProviderSuggestions");

const filterDepartment         = qs("filterDepartment");
const filterOrderItem          = qs("filterOrderItem");

/* ============================================================
   🔃 SORT
============================================================ */
window.setOrderSort = (field, dir) => {
  sortBy = field;
  sortDir = dir;
};
window.loadOrderPage = (p = 1) => loadEntries(p);

/* ============================================================
   📄 PAGINATION
============================================================ */
const getPagination = initPaginationControl(
  "order",
  loadEntries,
  Number(localStorage.getItem("orderPageLimit") || 25)
);

/* ============================================================
   🔎 AUTO SEARCH
============================================================ */
globalSearch && setupAutoSearch(globalSearch, loadEntries);

setupAutoFilters({
  searchInput: globalSearch,
  selectInputs: [
    filterOrg,
    filterFacility,
    filterStatus,
    filterDepartment,
    filterOrderItem,
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
    status: filterStatus?.value,
    department_id: filterDepartment?.value,
    patient_id: filterPatientHidden?.value,
    provider_id: filterProviderHidden?.value,
    dateRange: dateRange?.value,
  };
}

/* ============================================================
   📦 LOAD ORDERS
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
    if (f.status)          q.set("status", f.status);
    if (f.department_id)   q.set("department_id", f.department_id);
    if (f.patient_id)      q.set("patient_id", f.patient_id);
    if (f.provider_id)     q.set("provider_id", f.provider_id);

    const res = await authFetch(`/api/orders?${q.toString()}`);
    const json = await res.json();

    if (!res.ok) throw new Error(json?.message);

    const data = json.data || {};
    entries = data.records || [];
    currentPage = data.pagination?.page || safePage;

    renderList({ entries, visibleFields, viewMode, user, currentPage });

    data.summary &&
      renderModuleSummary(data.summary, "moduleSummary", {
        moduleLabel: "ORDERS",
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
    showToast("❌ Failed to load orders");
  } finally {
    hideLoading();
  }
}

/* ============================================================
   🧭 VIEW TOGGLE
============================================================ */
qs("tableViewBtn").onclick = () => {
  viewMode = "table";
  localStorage.setItem("orderView", "table");
  syncViewToggleUI({ mode: viewMode });
  renderList({ entries, visibleFields, viewMode, user, currentPage });
};

qs("cardViewBtn").onclick = () => {
  viewMode = "card";
  localStorage.setItem("orderView", "card");
  syncViewToggleUI({ mode: viewMode });
  renderList({ entries, visibleFields, viewMode, user, currentPage });
};

/* ============================================================
   🔄 RESET FILTERS
============================================================ */
qs("resetFilterBtn").onclick = () => {
  [
    globalSearch,
    filterOrg,
    filterFacility,
    filterStatus,
    filterDepartment,
    filterOrderItem,
    filterPatient,
    filterProvider,
    dateRange,
  ].forEach((el) => el && (el.value = ""));

  filterPatientHidden.value = "";
  filterProviderHidden.value = "";

  loadEntries(1);
};

/* ============================================================
   ⬇️ EXPORT
============================================================ */
qs("exportCSVBtn")?.addEventListener("click", () => {
  if (!entries.length) return showToast("❌ No data");

  exportToExcel(
    mapDataForExport(entries, visibleFields, FIELD_LABELS_ORDER),
    `orders_${new Date().toISOString().slice(0, 10)}.csv`
  );
});

qs("exportPDFBtn")?.addEventListener("click", () => {
  exportToPDF(
    "Orders List",
    viewMode === "table" ? ".table-container" : "#orderList",
    "portrait"
  );
});

/* ============================================================
   🚀 INIT
============================================================ */
export async function initOrderModule() {
  renderDynamicTableHead(visibleFields);

  setupToggleSection(
    "toggleFilterBtn",
    "filterCollapse",
    "filterChevron",
    "orderFilterVisible"
  );

  setupSuggestionInputDynamic(
    filterPatient,
    filterPatientSuggestions,
    "/api/lite/patients",
    (selected) => {
      filterPatientHidden.value = selected?.id || "";
      filterPatient.value = selected?.label || "";
      loadEntries(1);
    },
    "label"
  );

  setupSuggestionInputDynamic(
    filterProvider,
    filterProviderSuggestions,
    "/api/lite/employees",
    (selected) => {
      filterProviderHidden.value = selected?.id || "";
      filterProvider.value = selected?.full_name || "";
      loadEntries(1);
    },
    "full_name"
  );

  const orgs = await loadOrganizationsLite();
  orgs.unshift({ id: "", name: "-- All Organizations --" });
  setupSelectOptions(filterOrg, orgs, "id", "name");

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

  const depts = await loadDepartmentsLite({}, true);
  setupSelectOptions(
    filterDepartment,
    depts,
    "id",
    "name",
    "-- All Departments --"
  );

  await loadEntries(1);
}

/* ============================================================
   🏁 BOOT
============================================================ */
document.readyState === "loading"
  ? document.addEventListener("DOMContentLoaded", initOrderModule)
  : initOrderModule();