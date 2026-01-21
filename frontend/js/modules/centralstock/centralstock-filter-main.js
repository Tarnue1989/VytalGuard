// 📦 centralstock-filter-main.js – Enterprise Filter + Table/Card (FULL MASTER PARITY)
// ============================================================================
// 🔹 FULL PARITY WITH billableitem-filter-main.js
// 🔹 Auto search, auto filters, sorting, pagination
// 🔹 UI-only dateRange (single field, NEVER DB column)
// 🔹 Org / Facility fully wired
// 🔹 Central Stock Status fully wired
// 🔹 Summary, export, view toggle, field selector aligned
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
  loadSuppliersLite,
  setupSelectOptions,
} from "../../utils/data-loaders.js";

import { renderFieldSelector } from "../../utils/ui-utils.js";
import { exportToExcel, exportToPDF } from "../../utils/export-utils.js";

import {
  renderList,
  renderDynamicTableHead,
} from "./centralstock-render.js";
import { formatDate } from "../../utils/ui-utils.js";

import { setupActionHandlers } from "./centralstock-actions.js";

import {
  FIELD_ORDER_CENTRAL_STOCK,
  FIELD_DEFAULTS_CENTRAL_STOCK,
  FIELD_LABELS_CENTRAL_STOCK,
} from "./centralstock-constants.js";

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
let viewMode = localStorage.getItem("centralStockView") || "table";
let sortBy = "";
let sortDir = "asc";

const sharedState = { currentEditIdRef: { value: null } };

/* ============================================================
   👁️ FIELD VISIBILITY
============================================================ */
let visibleFields = setupVisibleFields({
  moduleKey: "centralstock",
  userRole,
  defaultFields: FIELD_DEFAULTS_CENTRAL_STOCK,
  allowedFields: FIELD_ORDER_CENTRAL_STOCK,
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
  FIELD_ORDER_CENTRAL_STOCK
);

/* ============================================================
   🔎 FILTER DOM
============================================================ */
const qs = (id) => document.getElementById(id);

const globalSearch   = qs("globalSearch");
const filterOrg      = qs("filterOrganizationSelect");
const filterFacility = qs("filterFacilitySelect");
const filterStatus   = qs("filterStatusSelect");
const dateRange      = qs("dateRange");

/* ============================================================
   🔃 SORT BRIDGE
============================================================ */
window.setCentralStockSort = (field, dir) => {
  sortBy = field;
  sortDir = dir;
};
window.loadCentralStockPage = (p = 1) => loadEntries(p);

/* ============================================================
   📄 PAGINATION
============================================================ */
const getPagination = initPaginationControl(
  "centralstock",
  loadEntries,
  Number(localStorage.getItem("centralstockPageLimit") || 25)
);

/* ============================================================
   🔎 AUTO SEARCH / FILTERS (MASTER)
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
   📋 FILTER BUILDER (MASTER CONTRACT)
============================================================ */
function getFilters() {
  return {
    search: globalSearch?.value?.trim(),
    organization_id: filterOrg?.value,
    facility_id: filterFacility?.value,
    status: filterStatus?.value,
    dateRange: dateRange?.value, // UI-only
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

    if (sortBy) {
      q.set("sort_by", sortBy);
      q.set("sort_order", sortDir);
    }

    Object.entries(f).forEach(([k, v]) => {
      if (v) q.set(k, v);
    });

    q.set("fields", visibleFields.join(","));

    const res = await authFetch(`/api/central-stocks?${q.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    const json = await res.json();
    if (!res.ok) throw new Error(json?.message);

    const data = json.data || {};
    entries = data.records || [];
    currentPage = data.pagination?.page || safePage;

    renderList({ entries, visibleFields, viewMode, user, currentPage });

    if (data.summary) {
      const summary = { ...data.summary };

      if (summary.dateRange?.start || summary.dateRange?.end) {
        summary.dateRange = {
          start: summary.dateRange.start
            ? formatDate(summary.dateRange.start)
            : "—",
          end: summary.dateRange.end
            ? formatDate(summary.dateRange.end)
            : "—",
        };
      }

      renderModuleSummary(summary, "moduleSummary", {
        moduleLabel: "CENTRAL STOCK",
      });
    }

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
    showToast("❌ Failed to load central stock");
  } finally {
    hideLoading();
  }
}

/* ============================================================
   🧭 VIEW TOGGLE
============================================================ */
qs("tableViewBtn").onclick = () => {
  viewMode = "table";
  localStorage.setItem("centralStockView", "table");
  syncViewToggleUI({ mode: viewMode });
  renderList({ entries, visibleFields, viewMode, user, currentPage });
};

qs("cardViewBtn").onclick = () => {
  viewMode = "card";
  localStorage.setItem("centralStockView", "card");
  syncViewToggleUI({ mode: viewMode });
  renderList({ entries, visibleFields, viewMode, user, currentPage });
};

/* ============================================================
   🔄 RESET FILTERS
============================================================ */
qs("resetFilterBtn").onclick = () => {
  [globalSearch, filterOrg, filterFacility, filterStatus, dateRange].forEach(
    (el) => {
      if (!el) return;
      el.value = "";
    }
  );
  loadEntries(1);
};

/* ============================================================
   ⬇️ EXPORT
============================================================ */
qs("exportCSVBtn")?.addEventListener("click", () => {
  if (!entries.length) return showToast("❌ No data");
  exportToExcel(
    mapDataForExport(entries, visibleFields, FIELD_LABELS_CENTRAL_STOCK),
    `central_stock_${new Date().toISOString().slice(0, 10)}.csv`
  );
});

qs("exportPDFBtn")?.addEventListener("click", () => {
  exportToPDF(
    "Central Stock",
    viewMode === "table" ? ".table-container" : "#centralStockList",
    "portrait"
  );
});

/* ============================================================
   🚀 INIT
============================================================ */
export async function initCentralStockModule() {
  renderDynamicTableHead(visibleFields);

  setupToggleSection(
    "toggleFilterBtn",
    "filterCollapse",
    "filterChevron",
    "centralStockFilterVisible"
  );

  /* ----------------- Organization ----------------- */
  if (filterOrg) {
    const orgs = await loadOrganizationsLite();
    orgs.unshift({ id: "", name: "-- All Organizations --" });
    setupSelectOptions(filterOrg, orgs, "id", "name");
  }

  /* ----------------- Facility ----------------- */
  if (filterFacility) {
    const facs = await loadFacilitiesLite();
    facs.unshift({ id: "", name: "-- All Facilities --" });
    setupSelectOptions(filterFacility, facs, "id", "name");
  }

  /* ----------------- Status ----------------- */
  // static in HTML

  await loadEntries(1);
}

/* ============================================================
   🏁 BOOT
============================================================ */
document.readyState === "loading"
  ? document.addEventListener("DOMContentLoaded", initCentralStockModule)
  : initCentralStockModule();
