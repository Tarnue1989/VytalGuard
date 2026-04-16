// 📦 cash-closing-filter-main.js – Enterprise Filter + Table/Card (MASTER PARITY)

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
  loadAccountsLite,            // ✅ ADDED
  setupSelectOptions,
} from "../../utils/data-loaders.js";

import { renderFieldSelector } from "../../utils/ui-utils.js";
import { exportToExcel, exportToPDF } from "../../utils/export-utils.js";

import {
  renderList,
  renderDynamicTableHead,
} from "./cash-closing-render.js";

import { setupActionHandlers } from "./cash-closing-actions.js";

import {
  FIELD_ORDER_CASH_CLOSING,
  FIELD_DEFAULTS_CASH_CLOSING,
  FIELD_LABELS_CASH_CLOSING,
} from "./cash-closing-constants.js";

import { setupVisibleFields } from "../../utils/field-visibility.js";
import { initPaginationControl } from "../../utils/pagination-control.js";
import { setupAutoSearch, setupAutoFilters } from "../../utils/search-utils.js";
import { mapDataForExport } from "../../utils/export-mapper.js";
import { syncViewToggleUI } from "../../utils/view-toggle.js";

/* ============================================================ */
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

/* ============================================================ */
let entries = [];
let currentPage = 1;
let viewMode = localStorage.getItem("cashClosingView") || "table";

let sortBy = "";
let sortDir = "desc";

/* ============================================================ */
let visibleFields = setupVisibleFields({
  moduleKey: "cash_closing",
  userRole,
  defaultFields: FIELD_DEFAULTS_CASH_CLOSING,
  allowedFields: FIELD_ORDER_CASH_CLOSING,
});

/* ============================================================ */
renderFieldSelector(
  {},
  visibleFields,
  (fields) => {
    visibleFields = fields;
    renderDynamicTableHead(visibleFields);
    renderList({ entries, visibleFields, viewMode, user, currentPage });
  },
  FIELD_ORDER_CASH_CLOSING
);

/* ============================================================ */
const qs = (id) => document.getElementById(id);

const globalSearch   = qs("globalSearch");
const filterAccount  = qs("filterAccountSelect"); // ✅ ADDED
const filterOrg      = qs("filterOrganizationSelect");
const filterFacility = qs("filterFacilitySelect");
const dateRange      = qs("dateRange");

/* ============================================================ */
window.setCashClosingSort = (field, dir) => {
  sortBy = field;
  sortDir = dir;
};

window.loadCashClosingPage = (p = 1) => loadEntries(p);

/* ============================================================ */
const getPagination = initPaginationControl(
  "cashClosing",
  loadEntries,
  Number(localStorage.getItem("cashClosingPageLimit") || 25)
);

/* ============================================================ */
setupAutoSearch(globalSearch, loadEntries);

setupAutoFilters({
  searchInput: globalSearch,
  selectInputs: [filterAccount, filterOrg, filterFacility], // ✅ FIXED
  dateRangeInput: dateRange,
  onChange: loadEntries,
});

/* ============================================================ */
function getFilters() {
  return {
    search: globalSearch?.value?.trim(),
    account_id: filterAccount?.value, // ✅ ADDED
    organization_id: filterOrg?.value,
    facility_id: filterFacility?.value,
    dateRange: dateRange?.value,
  };
}

/* ============================================================ */
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

    const res = await authFetch(`/api/cash-closings?${q.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    const json = await res.json();
    if (!res.ok) throw new Error(json?.message);

    const data = json.data || {};

    entries = data.records || [];
    currentPage = data.pagination?.page || safePage;

    renderList({ entries, visibleFields, viewMode, user, currentPage });

    syncViewToggleUI({ mode: viewMode });

    setupActionHandlers({
      entries,
      token,
      currentPage,
      loadEntries,
      visibleFields,
      sharedState: {},
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
    showToast("❌ Failed to load cash closings");
  } finally {
    hideLoading();
  }
}

/* ============================================================ */
qs("tableViewBtn").onclick = () => {
  viewMode = "table";
  localStorage.setItem("cashClosingView", "table");
  syncViewToggleUI({ mode: viewMode });
  renderList({ entries, visibleFields, viewMode, user, currentPage });
};

qs("cardViewBtn").onclick = () => {
  viewMode = "card";
  localStorage.setItem("cashClosingView", "card");
  syncViewToggleUI({ mode: viewMode });
  renderList({ entries, visibleFields, viewMode, user, currentPage });
};

/* ============================================================ */
qs("resetFilterBtn").onclick = () => {
  [globalSearch, filterAccount, filterOrg, filterFacility, dateRange].forEach(
    (el) => el && (el.value = "")
  );
  loadEntries(1);
};

/* ============================================================ */
qs("exportCSVBtn")?.addEventListener("click", () => {
  if (!entries.length) return showToast("❌ No data");

  exportToExcel(
    mapDataForExport(entries, visibleFields, FIELD_LABELS_CASH_CLOSING),
    `cash_closing_${new Date().toISOString().slice(0, 10)}.csv`
  );
});

qs("exportPDFBtn")?.addEventListener("click", () => {
  exportToPDF(
    "Cash Closing List",
    viewMode === "table" ? ".table-container" : "#cashClosingList",
    "portrait"
  );
});

/* ============================================================ */
export async function initCashClosingModule() {
  renderDynamicTableHead(visibleFields);

  setupToggleSection(
    "toggleFilterBtn",
    "filterCollapse",
    "filterChevron",
    "cashClosingFilterVisible"
  );

  /* 🔥 ACCOUNTS (MAIN FIX) */
  const accounts = await loadAccountsLite();
  accounts.unshift({ id: "", name: "-- All Accounts --" });
  setupSelectOptions(filterAccount, accounts, "id", "name");

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
    filterOrg?.closest(".form-group")?.classList.add("hidden");
    filterFacility?.closest(".form-group")?.classList.add("hidden");
  }

  await loadEntries(1);
}

/* ============================================================ */
document.readyState === "loading"
  ? document.addEventListener("DOMContentLoaded", initCashClosingModule)
  : initCashClosingModule();