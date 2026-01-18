// 📦 organization-filter-main.js – Enterprise Filter + Table/Card (ROLE MASTER PARITY)
// ============================================================================
// 🔹 Mirrors role-filter-main.js EXACTLY (structure, behavior, lifecycle)
// 🔹 Auto search, auto filters, sorting, pagination
// 🔹 UI-only dateRange (never DB column)
// 🔹 Keeps all IDs, routes, and backend contracts unchanged
// ============================================================================

import {
  showToast,
  showLoading,
  hideLoading,
  initPageGuard,
  setupToggleSection,
  renderPaginationControls,
  initLogoutWatcher,
} from "../../utils/index.js";

import { authFetch } from "../../authSession.js";

import { renderFieldSelector } from "../../utils/ui-utils.js";
import { exportToExcel, exportToPDF } from "../../utils/export-utils.js";

import {
  renderList,
  renderDynamicTableHead,
} from "./organization-render.js";

import { setupActionHandlers } from "./organization-actions.js";

import {
  FIELD_ORDER_ORGANIZATION,
  FIELD_DEFAULTS_ORGANIZATION,
  FIELD_LABELS_ORGANIZATION,
} from "./organization-constants.js";

import { setupVisibleFields } from "../../utils/field-visibility.js";
import { initPaginationControl } from "../../utils/pagination-control.js";
import { setupAutoSearch, setupAutoFilters } from "../../utils/search-utils.js";
import { mapDataForExport } from "../../utils/export-mapper.js";
import { syncViewToggleUI } from "../../utils/view-toggle.js";
import { renderModuleSummary } from "../../utils/render-module-summary.js";

/* ============================================================
   🔐 AUTH + USER
============================================================ */
const token = initPageGuard("organizations");
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
let viewMode = localStorage.getItem("organizationView") || "table";
let sortBy = "";
let sortDir = "asc";

const sharedState = { currentEditIdRef: { value: null } };

/* ============================================================
   👁️ FIELD VISIBILITY
============================================================ */
let visibleFields = setupVisibleFields({
  moduleKey: "organization",
  userRole,
  defaultFields: FIELD_DEFAULTS_ORGANIZATION,
  allowedFields: FIELD_ORDER_ORGANIZATION,
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
  FIELD_ORDER_ORGANIZATION
);

/* ============================================================
   🔎 FILTER DOM
============================================================ */
const qs = id => document.getElementById(id);

const globalSearch = qs("globalSearch");
const filterStatus = qs("filterStatusSelect");
const dateRange    = qs("dateRange");

/* ============================================================
   🔃 SORT BRIDGE
============================================================ */
window.setOrganizationSort = (field, dir) => {
  sortBy = field;
  sortDir = dir;
};
window.loadOrganizationPage = (p = 1) => loadEntries(p);

/* ============================================================
   📄 PAGINATION
============================================================ */
const getPagination = initPaginationControl(
  "organization",
  loadEntries,
  Number(localStorage.getItem("organizationPageLimit") || 25)
);

/* ============================================================
   🔎 AUTO SEARCH / FILTERS
============================================================ */
setupAutoSearch(globalSearch, loadEntries);

setupAutoFilters({
  searchInput: globalSearch,
  selectInputs: [filterStatus],
  dateRangeInput: dateRange,
  onChange: loadEntries,
});

/* ============================================================
   📋 FILTER BUILDER (MASTER SAFE)
============================================================ */
function getFilters() {
  return {
    search: globalSearch?.value?.trim(),
    status: filterStatus?.value,
    dateRange: dateRange?.value,
  };
}

/* ============================================================
   📦 LOAD ORGANIZATIONS
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

    if (f.search)    q.set("search", f.search);
    if (f.status)    q.set("status", f.status);
    if (f.dateRange) q.set("dateRange", f.dateRange);

    const res = await authFetch(`/api/organizations?${q.toString()}`, {
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
        moduleLabel: "ORGANIZATIONS",
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
    showToast("❌ Failed to load organizations");
  } finally {
    hideLoading();
  }
}

/* ============================================================
   🧭 VIEW TOGGLE
============================================================ */
qs("tableViewBtn").onclick = () => {
  viewMode = "table";
  localStorage.setItem("organizationView", "table");
  syncViewToggleUI({ mode: viewMode });
  renderList({ entries, visibleFields, viewMode, user, currentPage });
};

qs("cardViewBtn").onclick = () => {
  viewMode = "card";
  localStorage.setItem("organizationView", "card");
  syncViewToggleUI({ mode: viewMode });
  renderList({ entries, visibleFields, viewMode, user, currentPage });
};

/* ============================================================
   🔄 RESET FILTERS
============================================================ */
qs("resetFilterBtn").onclick = () => {
  [globalSearch, filterStatus, dateRange].forEach(el => {
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
    mapDataForExport(entries, visibleFields, FIELD_LABELS_ORGANIZATION),
    `organizations_${new Date().toISOString().slice(0, 10)}.csv`
  );
});

qs("exportPDFBtn")?.addEventListener("click", () => {
  exportToPDF(
    "Organizations List",
    viewMode === "table" ? ".table-container" : "#organizationList",
    "portrait"
  );
});

/* ============================================================
   🚀 INIT
============================================================ */
export async function initOrganizationModule() {
  renderDynamicTableHead(visibleFields);

  setupToggleSection(
    "toggleFilterBtn",
    "filterCollapse",
    "filterChevron",
    "organizationFilterVisible"
  );

  await loadEntries(1);
}

/* ============================================================
   🏁 BOOT
============================================================ */
document.readyState === "loading"
  ? document.addEventListener("DOMContentLoaded", initOrganizationModule)
  : initOrganizationModule();
