// 📦 currency-rate-filter-main.js – Enterprise Filter + Table/Card (MASTER PARITY)
// ============================================================================
// 🔹 Mirrors role-filter-main.js EXACTLY
// 🔹 Auto search, auto filters, sorting, pagination
// 🔹 UI-only dateRange (never DB column)
// 🔹 Org / Facility fully wired
// 🔹 Currency pair + Status fully wired
// ============================================================================

import {
  showToast,
  showLoading,
  hideLoading,
  initPageGuard,
  setupToggleSection,
  renderPaginationControls,
  initLogoutWatcher,
  autoPagePermissionKey
} from "../../utils/index.js";

import { authFetch } from "../../authSession.js";
import { CURRENCY } from "./enums.js";

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
} from "./currency-rate-render.js";

import { setupActionHandlers } from "./currency-rate-actions.js";

import {
  FIELD_ORDER_CURRENCY_RATE,
  FIELD_DEFAULTS_CURRENCY_RATE,
  FIELD_LABELS_CURRENCY_RATE,
} from "./currency-rate-constants.js";

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
let viewMode = localStorage.getItem("currencyRateView") || "table";
let sortBy = "";
let sortDir = "asc";

const sharedState = { currentEditIdRef: { value: null } };

/* ============================================================
   👁️ FIELD VISIBILITY
============================================================ */
let visibleFields = setupVisibleFields({
  moduleKey: "currency_rate",
  userRole,
  defaultFields: FIELD_DEFAULTS_CURRENCY_RATE,
  allowedFields: FIELD_ORDER_CURRENCY_RATE,
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
  FIELD_ORDER_CURRENCY_RATE
);

/* ============================================================
   🔎 FILTER DOM
============================================================ */
const qs = id => document.getElementById(id);

const globalSearch     = qs("globalSearch");
const filterOrg        = qs("filterOrganizationSelect");
const filterFacility   = qs("filterFacilitySelect");
const filterFrom       = qs("filterFromCurrencySelect");
const filterTo         = qs("filterToCurrencySelect");
const filterStatus     = qs("filterStatusSelect");
const dateRange        = qs("dateRange");

/* ============================================================
   🔃 SORT BRIDGE
============================================================ */
window.setCurrencyRateSort = (field, dir) => {
  sortBy = field;
  sortDir = dir;
};
window.loadCurrencyRatePage = (p = 1) => loadEntries(p);

/* ============================================================
   📄 PAGINATION
============================================================ */
const getPagination = initPaginationControl(
  "currencyRate",
  loadEntries,
  Number(localStorage.getItem("currencyRatePageLimit") || 25)
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
    filterFrom,
    filterTo,
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
    from_currency: filterFrom?.value,
    to_currency: filterTo?.value,
    status: filterStatus?.value,
    dateRange: dateRange?.value,
  };
}

/* ============================================================
   📦 LOAD DATA
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
    if (f.from_currency)   q.set("from_currency", f.from_currency);
    if (f.to_currency)     q.set("to_currency", f.to_currency);
    if (f.status)          q.set("status", f.status);

    const res = await authFetch(`/api/currency-rates?${q.toString()}`, {
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
        moduleLabel: "CURRENCY RATES",
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
    showToast("❌ Failed to load currency rates");
  } finally {
    hideLoading();
  }
}

/* ============================================================
   🧭 VIEW TOGGLE
============================================================ */
qs("tableViewBtn").onclick = () => {
  viewMode = "table";
  localStorage.setItem("currencyRateView", "table");
  syncViewToggleUI({ mode: viewMode });
  renderList({ entries, visibleFields, viewMode, user, currentPage });
};

qs("cardViewBtn").onclick = () => {
  viewMode = "card";
  localStorage.setItem("currencyRateView", "card");
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
    filterFrom,
    filterTo,
    filterStatus,
    dateRange,
  ].forEach(el => {
    if (el) el.value = "";
  });
  loadEntries(1);
};

/* ============================================================
   ⬇️ EXPORT
============================================================ */
qs("exportCSVBtn")?.addEventListener("click", () => {
  if (!entries.length) return showToast("❌ No data");
  exportToExcel(
    mapDataForExport(entries, visibleFields, FIELD_LABELS_CURRENCY_RATE),
    `currency_rates_${new Date().toISOString().slice(0, 10)}.csv`
  );
});

qs("exportPDFBtn")?.addEventListener("click", () => {
  exportToPDF(
    "Currency Rates List",
    viewMode === "table" ? ".table-container" : "#currencyRateList",
    "portrait"
  );
});

/* ============================================================
   🚀 INIT
============================================================ */
export async function initCurrencyRateModule() {
  renderDynamicTableHead(visibleFields);

  setupToggleSection(
    "toggleFilterBtn",
    "filterCollapse",
    "filterChevron",
    "currencyRateFilterVisible"
  );

  /* ============================================================
     💱 LOAD CURRENCY DROPDOWNS
  ============================================================ */
  const currencyOptions = [
    { id: "", name: "-- All --" },
    ...Object.values(CURRENCY).map((c) => ({
      id: c,
      name: c,
    })),
  ];

  setupSelectOptions(filterFrom, currencyOptions, "id", "name");
  setupSelectOptions(filterTo, currencyOptions, "id", "name");

  /* ============================================================
     🏢 ORG / FACILITY (EXISTING — KEEP THIS)
  ============================================================ */
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

  /* ============================================================
     🚀 LOAD DATA (REQUIRED)
  ============================================================ */
  await loadEntries(1);
}
/* ============================================================
   🏁 BOOT
============================================================ */
document.readyState === "loading"
  ? document.addEventListener("DOMContentLoaded", initCurrencyRateModule)
  : initCurrencyRateModule();