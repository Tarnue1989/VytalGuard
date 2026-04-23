// 📦 permissions-filter-main.js – FULL MASTER (BACKEND ALIGNED)

/* ============================================================
   🔐 IMPORTS
============================================================ */
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

import { renderFieldSelector } from "../../utils/ui-utils.js";
import { exportToExcel, exportToPDF } from "../../utils/export-utils.js";

import {
  renderList,
  renderDynamicTableHead,
} from "./permissions-render.js";

import { setupPermissionActionHandlers } from "./permissions-actions.js";

import {
  FIELD_ORDER_PERMISSION,
  FIELD_DEFAULTS_PERMISSION,
  FIELD_LABELS_PERMISSION,
} from "./permissions-constants.js";

import { setupVisibleFields } from "../../utils/field-visibility.js";
import { initPaginationControl } from "../../utils/pagination-control.js";
import { setupAutoSearch, setupAutoFilters } from "../../utils/search-utils.js";
import { mapDataForExport } from "../../utils/export-mapper.js";
import { syncViewToggleUI } from "../../utils/view-toggle.js";

/* ============================================================
   🔐 AUTH
============================================================ */
const token = initPageGuard(autoPagePermissionKey());
initLogoutWatcher();
/* ============================================================
   👤 USER
============================================================ */
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
let viewMode = localStorage.getItem("permissionView") || "table";
let sortBy = "";
let sortDir = "asc";

const sharedState = { currentEditIdRef: { value: null } };

/* ============================================================
   👁️ FIELD VISIBILITY
============================================================ */
let visibleFields = setupVisibleFields({
  moduleKey: "permission",
  userRole,
  defaultFields: FIELD_DEFAULTS_PERMISSION,
  allowedFields: FIELD_ORDER_PERMISSION,
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
  FIELD_ORDER_PERMISSION
);

/* ============================================================
   🔎 FILTER DOM (MASTER)
============================================================ */
const qs = (id) => document.getElementById(id);

const globalSearch = qs("globalSearch");
const filterModule = qs("filterModule");
const filterCategory = qs("filterCategory");
const filterIsGlobal = qs("filterIsGlobal");
const dateRange = qs("dateRange");

/* ============================================================
   🔃 SORT
============================================================ */
window.setPermissionSort = (field, dir) => {
  sortBy = field;
  sortDir = dir;
};

window.loadPermissionPage = (p = 1) => loadEntries(p);

/* ============================================================
   📄 PAGINATION
============================================================ */
const getPagination = initPaginationControl(
  "permission",
  loadEntries,
  Number(localStorage.getItem("permissionPageLimit") || 25)
);

/* ============================================================
   🔎 AUTO SEARCH / FILTER
============================================================ */
setupAutoSearch(globalSearch, loadEntries);

setupAutoFilters({
  searchInput: globalSearch,
  selectInputs: [filterModule, filterCategory, filterIsGlobal],
  dateRangeInput: dateRange,
  onChange: loadEntries,
});

/* ============================================================
   📋 FILTER BUILDER
============================================================ */
function getFilters() {
  return {
    search: globalSearch?.value?.trim(),
    module: filterModule?.value,
    category: filterCategory?.value,
    is_global: filterIsGlobal?.value,
    dateRange: dateRange?.value,
  };
}

/* ============================================================
   📦 LOAD PERMISSIONS (ALIGNED WITH BACKEND)
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
      q.set("sortBy", sortBy);
      q.set("sortOrder", sortDir);
    }

    if (f.search) q.set("search", f.search);
    if (f.dateRange) q.set("dateRange", f.dateRange);
    if (f.module) q.set("module", f.module);
    if (f.category) q.set("category", f.category);
    if (f.is_global) q.set("is_global", f.is_global);

    const res = await authFetch(`/api/permissions?${q.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    const json = await res.json();
    if (!res.ok) throw new Error(json?.message);

    const data = json.data || {};
    entries = data.records || [];
    currentPage = data.pagination?.page || safePage;

    renderList({ entries, visibleFields, viewMode, user, currentPage });

    syncViewToggleUI({ mode: viewMode });

    setupPermissionActionHandlers({
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
    showToast("❌ Failed to load permissions");
  } finally {
    hideLoading();
  }
}

/* ============================================================
   🧭 VIEW TOGGLE
============================================================ */
qs("tableViewBtn").onclick = () => {
  viewMode = "table";
  localStorage.setItem("permissionView", "table");
  syncViewToggleUI({ mode: viewMode });
  renderList({ entries, visibleFields, viewMode, user, currentPage });
};

qs("cardViewBtn").onclick = () => {
  viewMode = "card";
  localStorage.setItem("permissionView", "card");
  syncViewToggleUI({ mode: viewMode });
  renderList({ entries, visibleFields, viewMode, user, currentPage });
};

/* ============================================================
   🔄 RESET
============================================================ */
qs("resetFilterBtn").onclick = () => {
  [globalSearch, filterModule, filterCategory, filterIsGlobal, dateRange].forEach(
    (el) => el && (el.value = "")
  );
  loadEntries(1);
};

/* ============================================================
   ⬇️ EXPORT
============================================================ */
qs("exportCSVBtn")?.addEventListener("click", () => {
  if (!entries.length) return showToast("❌ No data");

  exportToExcel(
    mapDataForExport(entries, visibleFields, FIELD_LABELS_PERMISSION),
    `permissions_${new Date().toISOString().slice(0, 10)}.csv`
  );
});

qs("exportPDFBtn")?.addEventListener("click", () => {
  exportToPDF(
    "Permissions List",
    viewMode === "table" ? ".table-container" : "#permissionList",
    "portrait"
  );
});

/* ============================================================
   🚀 INIT
============================================================ */
export async function initPermissionModule() {
  renderDynamicTableHead(visibleFields);

  setupToggleSection(
    "toggleFilterBtn",
    "filterCollapse",
    "filterChevron",
    "permissionFilterVisible"
  );

  await loadEntries(1);
}

/* ============================================================
   🏁 BOOT
============================================================ */
document.readyState === "loading"
  ? document.addEventListener("DOMContentLoaded", initPermissionModule)
  : initPermissionModule();