// 📦 cash-activity-filter-main.js – Enterprise MASTER–ALIGNED (Ledger)
// ============================================================================
// 🔹 READ-ONLY Ledger Module
// 🔹 FULL MASTER parity (sorting + export + filters + summary)
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
  loadAccountsLite,
} from "../../utils/data-loaders.js";

import { renderFieldSelector } from "../../utils/ui-utils.js";
import { exportToExcel, exportToPDF } from "../../utils/export-utils.js";
import { mapDataForExport } from "../../utils/export-mapper.js";

import { renderList, renderDynamicTableHead } from "./cash-activity-render.js";

import {
  FIELD_ORDER_CASH_ACTIVITY,
  FIELD_DEFAULTS_CASH_ACTIVITY,
  FIELD_LABELS_CASH_ACTIVITY,
} from "./cash-activity-constants.js";

import { setupVisibleFields } from "../../utils/field-visibility.js";
import { initPaginationControl } from "../../utils/pagination-control.js";
import { setupAutoSearch, setupAutoFilters } from "../../utils/search-utils.js";
import { syncViewToggleUI } from "../../utils/view-toggle.js";
import { renderModuleSummary } from "../../utils/render-module-summary.js";

/* ============================================================
   🔐 AUTH
============================================================ */
const token = initPageGuard(autoPagePermissionKey());
initLogoutWatcher();

const userRole = (localStorage.getItem("userRole") || "").toLowerCase();
const user = { role: userRole };

/* ============================================================
   🧠 STATE
============================================================ */
let entries = [];
let currentPage = 1;
let viewMode = localStorage.getItem("cashActivityView") || "table";
let sortBy = "";
let sortDir = "asc";

/* ============================================================
   👁️ FIELD VISIBILITY
============================================================ */
let visibleFields = setupVisibleFields({
  moduleKey: "cashActivity",
  userRole,
  defaultFields: FIELD_DEFAULTS_CASH_ACTIVITY,
  allowedFields: FIELD_ORDER_CASH_ACTIVITY,
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
  FIELD_ORDER_CASH_ACTIVITY
);

/* ============================================================
   🔎 FILTER DOM
============================================================ */
const qs = (id) => document.getElementById(id);

const globalSearch = qs("globalSearch");
const filterOrg = qs("filterOrganizationSelect");
const filterFacility = qs("filterFacilitySelect");
const filterAccount = qs("filterAccountSelect");
const filterDirection = qs("filterDirection");
const filterCurrency = qs("filterCurrency");
const dateRange = qs("dateRange");
const filterType = qs("filterType");
const filterReferenceType = qs("filterReferenceType");

/* ============================================================
   🔃 SORT
============================================================ */
window.setCashActivitySort = (field, dir) => {
  sortBy = field;
  sortDir = dir;
};
window.loadCashActivityPage = (p = 1) => loadEntries(p);

/* ============================================================
   📄 PAGINATION
============================================================ */
const getPagination = initPaginationControl(
  "cashActivity",
  loadEntries,
  Number(localStorage.getItem("cashActivityPageLimit") || 25)
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
      filterAccount,
      filterDirection,
      filterCurrency,
      filterType,
      filterReferenceType,
    ],
  dateRangeInput: dateRange,
  onChange: loadEntries,
});

/* ============================================================
   📋 FILTER BUILDER
============================================================ */
function getFilters() {
  return {
    search: globalSearch?.value,
    organization_id: filterOrg?.value,
    facility_id: filterFacility?.value,
    account_id: filterAccount?.value,
    direction: filterDirection?.value,
    currency: filterCurrency?.value,
    type: filterType?.value,
    reference_type: filterReferenceType?.value,
    dateRange: dateRange?.value,
  };
}

/* ============================================================
   📦 LOAD LEDGER
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

    Object.entries(f).forEach(([k, v]) => {
      if (v && String(v).trim() !== "" && v !== "null") {
        q.set(k, v);
      }
    });

    const res = await authFetch(`/api/cash-ledger?${q.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    const json = await res.json();
    if (!res.ok) throw new Error(json.message || "Failed");

    const data = json.data || {};

    entries = Array.isArray(data.records) ? data.records : [];
    currentPage = data.pagination?.page || safePage;

    renderList({ entries, visibleFields, viewMode, user, currentPage });

    if (data.summary) {
      renderModuleSummary(data.summary, "moduleSummary", {
        moduleLabel: "CASH ACTIVITY",
      });
    }

    syncViewToggleUI({ mode: viewMode });

    renderPaginationControls(
      qs("paginationButtons"),
      currentPage,
      data.pagination?.pageCount || 1,
      loadEntries
    );

  } catch (err) {
    showToast(err.message || "❌ Failed to load cash activity");
  } finally {
    hideLoading();
  }
}

/* ============================================================
   🧭 VIEW TOGGLE
============================================================ */
qs("tableViewBtn").onclick = () => {
  viewMode = "table";
  localStorage.setItem("cashActivityView", "table");
  syncViewToggleUI({ mode: viewMode });
  renderList({ entries, visibleFields, viewMode, user, currentPage });
};

qs("cardViewBtn").onclick = () => {
  viewMode = "card";
  localStorage.setItem("cashActivityView", "card");
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
    filterAccount,
    filterDirection,
    filterCurrency,
    filterType,
    filterReferenceType,
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
    mapDataForExport(entries, visibleFields, FIELD_LABELS_CASH_ACTIVITY),
    `cash_activity_${new Date().toISOString().slice(0, 10)}.csv`
  );
});

qs("exportPDFBtn")?.addEventListener("click", () => {
  exportToPDF(
    "Cash Activity",
    viewMode === "table" ? ".table-container" : "#cashActivityList",
    "portrait"
  );
});

/* ============================================================
   🚀 INIT
============================================================ */
export async function initCashActivityModule() {
  renderDynamicTableHead(visibleFields);

    setupToggleSection(
    "toggleFilterBtn",
    "filterCollapse",
    "filterChevron",
    "cashActivityFilterVisible"
    );

  // 🔥 Load org/fac/account filters (same as deposit)
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

    const accounts = await loadAccountsLite({}, true);
    accounts.unshift({ id: "", name: "-- All Accounts --" });
    setupSelectOptions(filterAccount, accounts, "id", "name");

    await reloadFacilities();
    filterOrg.onchange = () => reloadFacilities(filterOrg.value || null);
  }

  await loadEntries(1);
}

/* ============================================================
   🏁 BOOT
============================================================ */
document.readyState === "loading"
  ? document.addEventListener("DOMContentLoaded", initCashActivityModule)
  : initCashActivityModule();