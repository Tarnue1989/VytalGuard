// 📦 feature-module-filter-main.js – Enterprise Filter + Table/Card (CLEAN FINAL)
// ============================================================================
// 🔹 Unified global search (name | key | category)
// 🔹 AUTO filters (search, selects, date range)
// 🔹 Sorting, pagination, summary MATCH controller
// 🔹 Permission-aware
// 🔹 Non-breaking
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
import { renderModuleSummary } from "../../utils/render-module-summary.js";
import { authFetch } from "../../authSession.js";

import { renderFieldSelector } from "../../utils/ui-utils.js";
import { exportToExcel, exportToPDF } from "../../utils/export-utils.js";

import { renderList, renderDynamicTableHead } from "./feature-module-render.js";
import { setupActionHandlers } from "./feature-module-actions.js";

import {
  FIELD_ORDER_FEATURE_MODULE,
  FIELD_DEFAULTS_FEATURE_MODULE,
  FIELD_LABELS_FEATURE_MODULE
} from "./feature-module-constants.js";

import { setupVisibleFields } from "../../utils/field-visibility.js";
import { initPaginationControl } from "../../utils/pagination-control.js";
import {
  setupAutoSearch,
  setupAutoFilters,
} from "../../utils/search-utils.js";
import { mapDataForExport } from "../../utils/export-mapper.js";
import { syncViewToggleUI } from "../../utils/view-toggle.js";

/* ============================================================
   👤 USER PREFERENCE KEYS (UI ONLY)
============================================================ */
const USER_PREF_COLUMN_ORDER_KEY =
  "user_pref:feature_module:column_order";

/* ============================================================
   🔐 Auth + Permissions
============================================================ */
const token = initPageGuard("feature_modules");
initLogoutWatcher();

const roleRaw = localStorage.getItem("userRole") || "";
const userRole = roleRaw.trim().toLowerCase();

let perms = [];
try {
  const raw = JSON.parse(localStorage.getItem("permissions") || "[]");
  perms = Array.isArray(raw)
    ? raw.map(p => String(p.key || p).toLowerCase())
    : [];
} catch {
  perms = [];
}

const user = { role: userRole, permissions: perms };

/* ============================================================
   🧠 Shared State
============================================================ */
const sharedState = { currentEditIdRef: { value: null } };
window.entries = [];
window.showForm = () => {};
window.resetForm = () => {};

/* ============================================================
   👁️ Field Visibility (BASE)
============================================================ */
let visibleFields = setupVisibleFields({
  moduleKey: "feature_module",
  userRole,
  defaultFields: FIELD_DEFAULTS_FEATURE_MODULE,
  allowedFields: FIELD_ORDER_FEATURE_MODULE,
});

/* ============================================================
   👤 Restore USER column order preference (SAFE)
============================================================ */
try {
  const saved = JSON.parse(
    localStorage.getItem(USER_PREF_COLUMN_ORDER_KEY) || "null"
  );

  if (Array.isArray(saved)) {
    visibleFields = saved.filter(f =>
      FIELD_ORDER_FEATURE_MODULE.includes(f)
    );
  }
} catch {
  // silently ignore corrupt preference
}

/* ============================================================
   🔐 API Field Whitelist
============================================================ */
const API_FIELD_WHITELIST = [
  "id",
  "name",
  "key",
  "icon",
  "category",
  "description",
  "tags",
  "visibility",
  "enabled",
  "status",
  "route",
  "parent_id",
  "created_at",
  "updated_at",
  "deleted_at",
];

/* ============================================================
   🧩 Field Selector
============================================================ */
renderFieldSelector(
  {},
  visibleFields,
  newFields => {
    visibleFields = newFields;

    // 👤 persist user preference
    localStorage.setItem(
      USER_PREF_COLUMN_ORDER_KEY,
      JSON.stringify(visibleFields)
    );

    renderDynamicTableHead(visibleFields);
    renderList({ entries, visibleFields, viewMode, userRole, currentPage });
  },
  FIELD_ORDER_FEATURE_MODULE
);

/* ============================================================
   🔎 Filter DOM Refs
============================================================ */
const globalSearch = document.getElementById("globalSearch");
const filterStatus = document.getElementById("filterStatus");
const filterVisibility = document.getElementById("filterVisibility");
const filterEnabled = document.getElementById("filterEnabled");
const filterTenantScope = document.getElementById("filterTenantScope");
const dateRange = document.getElementById("dateRange");

/* ============================================================
   🌍 View + Pagination + Sorting
============================================================ */
let currentPage = 1;
let totalPages = 1;
let viewMode = localStorage.getItem("featureModuleView") || "table";

let sortBy = "";
let sortDir = "asc";

/* ============================================================
   🔃 Sort Bridge (Renderer → Main)
============================================================ */
window.setFeatureModuleSort = (field, dir) => {
  sortBy = field;
  sortDir = dir;
};

window.loadFeatureModulePage = (page = 1) => loadEntries(page);

/* ============================================================
   🔁 Pagination Control
============================================================ */
const getPagination = initPaginationControl(
  "feature_module",
  loadEntries,
  25
);

/* ============================================================
   🔎 Auto Filters
============================================================ */
setupAutoSearch(globalSearch, loadEntries);

setupAutoFilters({
  searchInput: globalSearch,
  selectInputs: [
    filterStatus,
    filterVisibility,
    filterEnabled,
    filterTenantScope,
  ],
  dateRangeInput: dateRange,
  onChange: loadEntries,
});

/* ============================================================
   📋 Filters (UNIFIED)
============================================================ */
function getFilters() {
  return {
    search: globalSearch?.value?.trim() || "",
    status: filterStatus?.value || "",
    visibility: filterVisibility?.value || "",
    enabled: filterEnabled?.value || "",
    tenant_scope: filterTenantScope?.value || "",
    dateRange: dateRange?.value || "",
  };
}

/* ============================================================
   📦 Load Feature Modules
============================================================ */
async function loadEntries(page = 1) {
  try {
    showLoading();

    const filters = getFilters();
    const q = new URLSearchParams();
    const { page: safePage, limit } = getPagination(page);

    q.append("page", safePage);
    q.append("limit", limit);

    if (sortBy) {
      q.append("sort_by", sortBy);
      q.append("sort_order", sortDir);
    }

    if (filters.search) q.append("search", filters.search);
    if (filters.status) q.append("status", filters.status);
    if (filters.visibility) q.append("visibility", filters.visibility);
    if (filters.enabled) q.append("enabled", filters.enabled);
    if (filters.tenant_scope) q.append("tenant_scope", filters.tenant_scope);
    if (filters.dateRange) q.append("dateRange", filters.dateRange);

    const safeFields = visibleFields.filter(f =>
      API_FIELD_WHITELIST.includes(f)
    );
    if (safeFields.length) q.append("fields", safeFields.join(","));

    const res = await authFetch(
      `/api/features/feature-modules?${q.toString()}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    const json = await res.json();
    if (!res.ok) throw new Error(json?.message || "Load failed");

    const payload = json.data || {};
    const records = Array.isArray(payload.records) ? payload.records : [];

    window.entries = records;
    currentPage = payload.pagination?.page || safePage;
    totalPages = payload.pagination?.pageCount || 1;

    renderList({ entries, visibleFields, viewMode, user, currentPage });
    payload.summary && renderModuleSummary(payload.summary);

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
      document.getElementById("paginationButtons"),
      currentPage,
      totalPages,
      loadEntries
    );

    if (!records.length) {
      showToast("ℹ️ No feature modules found");
    }
  } catch (err) {
    console.error("❌ loadEntries failed:", err);
    showToast("❌ Failed to load feature modules");
  } finally {
    hideLoading();
  }
}

/* ============================================================
   🧭 View Toggle
============================================================ */
document.getElementById("tableViewBtn").onclick = () => {
  viewMode = "table";
  localStorage.setItem("featureModuleView", "table");
  syncViewToggleUI({ mode: viewMode });
  renderList({ entries, visibleFields, viewMode, user, currentPage });
};

document.getElementById("cardViewBtn").onclick = () => {
  viewMode = "card";
  localStorage.setItem("featureModuleView", "card");
  syncViewToggleUI({ mode: viewMode });
  renderList({ entries, visibleFields, viewMode, user, currentPage });
};

/* ============================================================
   🔄 Reset Filters
============================================================ */
document.getElementById("resetFilterBtn").onclick = () => {
  [
    globalSearch,
    filterStatus,
    filterVisibility,
    filterEnabled,
    filterTenantScope,
    dateRange,
  ].forEach(el => el && (el.value = ""));

  loadEntries(1);
};

/* ============================================================
   ⬇️ Export (CLEAN + SAFE)
============================================================ */
const exportExcelBtn = document.getElementById("exportExcelBtn");
const exportPDFBtn = document.getElementById("exportPDFBtn");
const exportCSVBtn = document.getElementById("exportCSVBtn");

exportCSVBtn &&
  (exportCSVBtn.onclick = () => {
    if (!entries.length) {
      showToast("❌ No data to export");
      return;
    }

    const exportRows = mapDataForExport(
      entries,
      visibleFields,
      FIELD_LABELS_FEATURE_MODULE
    );

    exportData({
      type: "csv",
      data: exportRows,
      title: `feature_modules_${new Date().toISOString().slice(0, 10)}`
    });
  });

exportExcelBtn &&
  (exportExcelBtn.onclick = () => {
    if (!entries.length) {
      showToast("❌ No data to export");
      return;
    }

    const exportRows = mapDataForExport(
      entries,
      visibleFields,
      FIELD_LABELS_FEATURE_MODULE
    );

    exportToExcel(
      exportRows,
      `feature_modules_${new Date().toISOString().slice(0, 10)}`
    );
  });

exportPDFBtn &&
  (exportPDFBtn.onclick = () => {
    if (!entries.length) {
      showToast("❌ No data to export");
      return;
    }

    const target =
      viewMode === "table" ? ".table-container" : "#featureModuleList";

    exportToPDF("Feature Module List", target, "portrait");
  });

/* ============================================================
   🚀 Init
============================================================ */
export async function initFeatureModule() {
  renderDynamicTableHead(visibleFields);
  syncViewToggleUI({ mode: viewMode });
  setupToggleSection(
    "toggleFilterBtn",
    "filterCollapse",
    "filterChevron",
    "featureModuleFilterVisible"
  );

  await loadEntries(1);
}

/* ============================================================
   🏁 Boot
============================================================ */
document.readyState === "loading"
  ? document.addEventListener("DOMContentLoaded", initFeatureModule)
  : initFeatureModule();
