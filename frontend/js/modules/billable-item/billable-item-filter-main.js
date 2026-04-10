// 📦 billable-item-filter-main.js – FINAL (Enterprise MASTER + SORT + REORDER FIXED)
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
} from "../../utils/data-loaders.js";

import { renderFieldSelector } from "../../utils/ui-utils.js";
import { exportToExcel, exportToPDF } from "../../utils/export-utils.js";

import {
  renderList,
  renderDynamicTableHead,
} from "./billable-item-render.js";

import { setupActionHandlers } from "./billable-item-actions.js";

import {
  FIELD_ORDER_BILLABLE_ITEM,
  FIELD_DEFAULTS_BILLABLE_ITEM,
  FIELD_LABELS_BILLABLE_ITEM,
} from "./billable-item-constants.js";

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
   🧠 STATE (🔥 FIXED)
============================================================ */
let entries = [];
let currentPage = 1;
let viewMode = localStorage.getItem("billableItemView") || "table";

/* 🔥 FIX: persist sort */
let sortBy = localStorage.getItem("billableItemSortBy") || "";
let sortDir = localStorage.getItem("billableItemSortDir") || "asc";

const sharedState = { currentEditIdRef: { value: null } };

/* ============================================================
   👁️ FIELD VISIBILITY
============================================================ */
let visibleFields = setupVisibleFields({
  moduleKey: "billable_items",
  userRole,
  defaultFields: FIELD_DEFAULTS_BILLABLE_ITEM,
  allowedFields: FIELD_ORDER_BILLABLE_ITEM,
});

renderFieldSelector(
  {},
  visibleFields,
  (fields) => {
    visibleFields = fields;
    renderDynamicTableHead(visibleFields);
    renderList({ entries, visibleFields, viewMode, user, currentPage });
  },
  FIELD_ORDER_BILLABLE_ITEM
);

/* ============================================================
   🔎 FILTER DOM
============================================================ */
const qs = (id) => document.getElementById(id);

const globalSearch = qs("globalSearch");
const filterOrg = qs("filterOrganizationSelect");
const filterFacility = qs("filterFacilitySelect");
const filterStatus = qs("filterStatusSelect");
const filterCurrency = qs("filterCurrencySelect");
const filterPayerType = qs("filterPayerTypeSelect");
const dateRange = qs("dateRange");

/* ============================================================
   📄 PAGINATION
============================================================ */
const getPagination = initPaginationControl(
  "billableitem",
  loadEntries,
  Number(localStorage.getItem("billableitemPageLimit") || 25)
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
    filterCurrency,
    filterPayerType,
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
    payer_type: filterPayerType?.value,
    currency: filterCurrency?.value,
    dateRange: dateRange?.value,
  };
}

/* ============================================================
   📦 LOAD ENTRIES
============================================================ */
async function loadEntries(page = 1) {
  try {
    showLoading();

    const q = new URLSearchParams();
    const { page: safePage, limit } = getPagination(page);
    const f = getFilters();

    q.set("page", safePage);
    q.set("limit", limit);

    /* 🔥 SORT WORKS NOW */
    if (sortBy) {
      q.set("sort_by", sortBy);
      q.set("sort_order", sortDir);
    }

    Object.entries(f).forEach(([k, v]) => {
      if (v) q.set(k, v);
    });

    const res = await authFetch(`/api/billable-items?${q.toString()}`, {
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
        moduleLabel: "BILLABLE ITEMS",
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
    showToast("❌ Failed to load billable items");
  } finally {
    hideLoading();
  }
}

/* ============================================================
   🔥 SORT BRIDGE (CRITICAL FIX)
============================================================ */
window.setBillableItemSort = (field, dir) => {
  sortBy = field;
  sortDir = dir;
};

window.loadBillableItemPage = (p = 1) => loadEntries(p);

/* ============================================================
   🧭 VIEW TOGGLE
============================================================ */
qs("tableViewBtn").onclick = () => {
  viewMode = "table";
  localStorage.setItem("billableItemView", "table");
  syncViewToggleUI({ mode: viewMode });
  renderList({ entries, visibleFields, viewMode, user, currentPage });
};

qs("cardViewBtn").onclick = () => {
  viewMode = "card";
  localStorage.setItem("billableItemView", "card");
  syncViewToggleUI({ mode: viewMode });
  renderList({ entries, visibleFields, viewMode, user, currentPage });
};

/* ============================================================
   🔄 RESET
============================================================ */
qs("resetFilterBtn").onclick = () => {
  [
    globalSearch,
    filterOrg,
    filterFacility,
    filterStatus,
    filterCurrency,
    filterPayerType,
    dateRange,
  ].forEach((el) => el && (el.value = ""));

  loadEntries(1);
};

/* ============================================================
   ⬇️ EXPORT
============================================================ */
qs("exportCSVBtn")?.addEventListener("click", () => {
  if (!entries.length) return showToast("❌ No data");

  exportToExcel(
    mapDataForExport(entries, visibleFields, FIELD_LABELS_BILLABLE_ITEM),
    `billable_items_${new Date().toISOString().slice(0, 10)}.csv`
  );
});

qs("exportPDFBtn")?.addEventListener("click", () => {
  exportToPDF(
    "Billable Items",
    viewMode === "table" ? ".table-container" : "#billableItemList",
    "portrait"
  );
});

/* ============================================================
   🚀 INIT
============================================================ */
export async function initBillableItemModule() {
  renderDynamicTableHead(visibleFields);

  setupToggleSection(
    "toggleFilterBtn",
    "filterCollapse",
    "filterChevron",
    "billableItemFilterVisible"
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

  await loadEntries(1);
}

/* ============================================================
   🏁 BOOT
============================================================ */
document.readyState === "loading"
  ? document.addEventListener("DOMContentLoaded", initBillableItemModule)
  : initBillableItemModule();