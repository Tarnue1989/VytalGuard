// 📦 master-item-filter-main.js – Filters + Table/Card (FULL MASTER PARITY)
// ============================================================================
// 🧭 Master Pattern: department-filter-main.js (STRUCTURE + LIFECYCLE MATCHED)
// 🔹 Auto search, auto filters, sorting, pagination
// 🔹 UI-only dateRange (never DB column)
// 🔹 Org / Facility fully wired
// 🔹 Master Item Status fully wired
// 🔹 Feature Module filter (ID-based suggestions)
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
  setupSelectOptions,
  setupSuggestionInputDynamic,
} from "../../utils/data-loaders.js";

import { renderFieldSelector } from "../../utils/ui-utils.js";
import { exportToExcel, exportToPDF } from "../../utils/export-utils.js";

import {
  renderList,
  renderDynamicTableHead,
} from "./master-item-render.js";

import { setupActionHandlers } from "./master-item-actions.js";

import {
  FIELD_ORDER_MASTER_ITEM,
  FIELD_DEFAULTS_MASTER_ITEM,
  FIELD_LABELS_MASTER_ITEM,
} from "./master-item-constants.js";

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
    return (JSON.parse(localStorage.getItem("permissions")) || [])
      .map(p => String(p.key || p).toLowerCase());
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
let viewMode = localStorage.getItem("masterItemView") || "table";
let sortBy = "";
let sortDir = "asc";

const sharedState = { currentEditIdRef: { value: null } };

/* ============================================================
   👁️ FIELD VISIBILITY
============================================================ */
let visibleFields = setupVisibleFields({
  moduleKey: "master_item",
  userRole,
  defaultFields: FIELD_DEFAULTS_MASTER_ITEM,
  allowedFields: FIELD_ORDER_MASTER_ITEM,
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
  FIELD_ORDER_MASTER_ITEM
);

/* ============================================================
   🔎 FILTER DOM
============================================================ */
const qs = id => document.getElementById(id);

const globalSearch = qs("globalSearch");
const filterOrg = qs("filterOrganizationSelect");
const filterFacility = qs("filterFacilitySelect");
const filterStatus = qs("filterStatusSelect");
const dateRange = qs("dateRange");

const filterFeatureModule = qs("filterFeatureModule");
const filterFeatureModuleSuggestions = qs("filterFeatureModuleSuggestions");

/* ============================================================
   🔃 SORT BRIDGE
============================================================ */
window.setMasterItemSort = (field, dir) => {
  sortBy = field;
  sortDir = dir;
};
window.loadMasterItemPage = (p = 1) => loadEntries(p);

/* ============================================================
   📄 PAGINATION
============================================================ */
const getPagination = initPaginationControl(
  "master_item",
  loadEntries,
  Number(localStorage.getItem("masterItemPageLimit") || 25)
);

/* ============================================================
   🔎 AUTO SEARCH / FILTERS
============================================================ */
setupAutoSearch(globalSearch, loadEntries);

setupAutoFilters({
  searchInput: globalSearch,
  selectInputs: [
    filterOrg,
    filterFacility,
    filterStatus,
  ],
  dateRangeInput: dateRange,
  onChange: loadEntries,
});

/* ============================================================
   📋 FILTER BUILDER (MASTER SAFE)
============================================================ */
function getFilters() {
  return {
    search: globalSearch?.value?.trim(),
    organization_id: filterOrg?.value,
    facility_id: filterFacility?.value,
    status: filterStatus?.value,
    feature_module_id: filterFeatureModule?.dataset?.value,
    dateRange: dateRange?.value,
  };
}

/* ============================================================
   📦 LOAD MASTER ITEMS (MASTER SAFE)
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

    if (f.search) q.set("search", f.search);
    if (f.dateRange) q.set("dateRange", f.dateRange);
    if (f.organization_id) q.set("organization_id", f.organization_id);
    if (f.facility_id) q.set("facility_id", f.facility_id);
    if (f.status && f.status !== "all") q.set("status", f.status);
    if (f.feature_module_id) q.set("feature_module_id", f.feature_module_id);

    const res = await authFetch(`/api/master-items?${q.toString()}`, {
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
        moduleLabel: "MASTER ITEMS",
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
    showToast("❌ Failed to load master items");
  } finally {
    hideLoading();
  }
}

/* ============================================================
   🧭 VIEW TOGGLE
============================================================ */
qs("tableViewBtn").onclick = () => {
  viewMode = "table";
  localStorage.setItem("masterItemView", "table");
  syncViewToggleUI({ mode: viewMode });
  renderList({ entries, visibleFields, viewMode, user, currentPage });
};

qs("cardViewBtn").onclick = () => {
  viewMode = "card";
  localStorage.setItem("masterItemView", "card");
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
    dateRange,
  ].forEach(el => {
    if (el) el.value = "";
  });

  if (filterFeatureModule) {
    filterFeatureModule.value = "";
    filterFeatureModule.dataset.value = "";
  }

  loadEntries(1);
};

/* ============================================================
   ⬇️ EXPORT
============================================================ */
qs("exportCSVBtn")?.addEventListener("click", () => {
  if (!entries.length) return showToast("❌ No data");
  exportToExcel(
    mapDataForExport(entries, visibleFields, FIELD_LABELS_MASTER_ITEM),
    `master_items_${new Date().toISOString().slice(0, 10)}.csv`
  );
});

qs("exportPDFBtn")?.addEventListener("click", () => {
  exportToPDF(
    "Master Items List",
    viewMode === "table" ? ".table-container" : "#masterItemList",
    "portrait"
  );
});

/* ============================================================
   🚀 INIT
============================================================ */
export async function initMasterItemModule() {
  renderDynamicTableHead(visibleFields);

  setupToggleSection(
    "toggleFilterBtn",
    "filterCollapse",
    "filterChevron",
    "masterItemFilterVisible"
  );

  if (userRole.includes("super") || userRole.includes("admin")) {
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
  } else {
    filterOrg?.closest(".col-md-3")?.classList.add("hidden");
    filterFacility?.closest(".col-md-3")?.classList.add("hidden");
  }

  if (filterFeatureModule && filterFeatureModuleSuggestions) {
    setupSuggestionInputDynamic(
      filterFeatureModule,
      filterFeatureModuleSuggestions,
      "/api/lite/feature-modules",
      (selected) => (filterFeatureModule.dataset.value = selected.id),
      "name"
    );
  }

  await loadEntries(1);
}

/* ============================================================
   🏁 BOOT
============================================================ */
document.readyState === "loading"
  ? document.addEventListener("DOMContentLoaded", initMasterItemModule)
  : initMasterItemModule();
