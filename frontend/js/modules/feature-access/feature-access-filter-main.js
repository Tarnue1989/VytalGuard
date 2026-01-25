// 📦 feature-access-filter-main.js – Enterprise Filter + Table/Card (FULL PARITY)
// ============================================================================
// 🔹 Unified global search
// 🔹 Full filter wiring (organization, role, module, facility, status, date range)
// 🔹 Table + Card view
// 🔹 Sorting, pagination, export
// 🔹 Permission-aware actions
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
import { setupSuggestionInputDynamic } from "../../utils/data-loaders.js";
import { renderFieldSelector } from "../../utils/ui-utils.js";
import { exportToExcel, exportToPDF } from "../../utils/export-utils.js";

import { renderList, renderDynamicTableHead } from "./feature-access-render.js";
import { setupActionHandlers } from "./feature-access-actions.js";

import {
  FIELD_ORDER_FEATURE_ACCESS,
  FIELD_DEFAULTS_FEATURE_ACCESS,
  FIELD_LABELS_FEATURE_ACCESS,
} from "./feature-access-constants.js";

import { setupVisibleFields } from "../../utils/field-visibility.js";
import { initPaginationControl } from "../../utils/pagination-control.js";
import { setupAutoSearch, setupAutoFilters } from "../../utils/search-utils.js";
import { mapDataForExport } from "../../utils/export-mapper.js";
import { syncViewToggleUI } from "../../utils/view-toggle.js";
import { renderModuleSummary } from "../../utils/render-module-summary.js";


/* ============================================================
   👤 USER PREF KEYS
============================================================ */
const USER_PREF_COLUMN_ORDER_KEY =
  "user_pref:feature_access:column_order";

/* ============================================================
   🔐 Auth + Permissions
============================================================ */
const token = initPageGuard(autoPagePermissionKey());
initLogoutWatcher();

const roleRaw = localStorage.getItem("userRole") || "";
const userRole = roleRaw.trim().toLowerCase();

let perms = [];
try {
  const raw = JSON.parse(localStorage.getItem("permissions") || "[]");
  perms = Array.isArray(raw)
    ? raw.map(p => String(p.key || p).toLowerCase())
    : [];
} catch {}

const user = { role: userRole, permissions: perms };

/* ============================================================
   🧠 Shared State
============================================================ */
const sharedState = { currentEditIdRef: { value: null } };
window.entries = [];
window.showForm = () => {};
window.resetForm = () => {};

/* ============================================================
   👁️ Field Visibility
============================================================ */
let visibleFields = setupVisibleFields({
  moduleKey: "feature_access",
  userRole,
  defaultFields: FIELD_DEFAULTS_FEATURE_ACCESS,
  allowedFields: FIELD_ORDER_FEATURE_ACCESS,
});

/* ============================================================
   👤 Restore column order
============================================================ */
try {
  const saved = JSON.parse(
    localStorage.getItem(USER_PREF_COLUMN_ORDER_KEY) || "null"
  );
  if (Array.isArray(saved)) {
    visibleFields = saved.filter(f =>
      FIELD_ORDER_FEATURE_ACCESS.includes(f)
    );
  }
} catch {}

/* ============================================================
   🔐 API Field Whitelist
============================================================ */
const API_FIELD_WHITELIST = [
  "organization_id",
  "module_id",
  "role_id",
  "facility_id",
  "status",
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
    localStorage.setItem(
      USER_PREF_COLUMN_ORDER_KEY,
      JSON.stringify(visibleFields)
    );
    renderDynamicTableHead(visibleFields);
    syncViewToggleUI({ mode: viewMode });

    renderList({ entries, visibleFields, viewMode, user, currentPage });
  },
  FIELD_ORDER_FEATURE_ACCESS
);

/* ============================================================
   🔎 Filter DOM Refs
============================================================ */
const globalSearch = document.getElementById("globalSearch");

const filterOrganization = document.getElementById("filterOrganization");
const filterOrganizationSuggestions =
  document.getElementById("filterOrganizationSuggestions");

const filterModule = document.getElementById("filterModule");
const filterModuleSuggestions =
  document.getElementById("filterModuleSuggestions");

const filterRole = document.getElementById("filterRole");
const filterRoleSuggestions =
  document.getElementById("filterRoleSuggestions");

const filterFacility = document.getElementById("filterFacility");
const filterFacilitySuggestions =
  document.getElementById("filterFacilitySuggestions");

const filterStatus = document.getElementById("filterStatus");
const dateRange = document.getElementById("dateRange");

/* ============================================================
   🌍 View / Sort / Paging
============================================================ */
let currentPage = 1;
let totalPages = 1;
let viewMode = localStorage.getItem("featureAccessView") || "table";

let sortBy = "";
let sortDir = "asc";

/* ============================================================
   🔃 Sort Bridge
============================================================ */
window.setFeatureAccessSort = (field, dir) => {
  sortBy = field;
  sortDir = dir;
};

window.loadFeatureAccessPage = (page = 1) => loadEntries(page);

/* ============================================================
   🔁 Pagination
============================================================ */
const getPagination = initPaginationControl(
  "feature_access",
  loadEntries,
  25
);

/* ============================================================
   🔎 Auto Search & Filters
============================================================ */
setupAutoSearch(globalSearch, loadEntries);

setupAutoFilters({
  searchInput: globalSearch,
  selectInputs: [filterStatus],
  dateRangeInput: dateRange,
  onChange: loadEntries,
});

/* ============================================================
   📋 Filters
============================================================ */
function getFilters() {
  return {
    search: globalSearch?.value?.trim() || "",
    organization_id: filterOrganization?.dataset.value || "",
    module_id: filterModule?.dataset.value || "",
    role_id: filterRole?.dataset.value || "",
    facility_id: filterFacility?.dataset.value || "",
    status: filterStatus?.value || "",
    dateRange: dateRange?.value || "",
  };
}

/* ============================================================
   📦 Load Entries
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
    if (filters.dateRange) q.append("dateRange", filters.dateRange);

    ["organization_id", "module_id", "role_id", "facility_id", "status"]
      .forEach(k => filters[k] && q.append(k, filters[k]));

    const safeFields = visibleFields.filter(f =>
      API_FIELD_WHITELIST.includes(f)
    );
    if (safeFields.length) q.append("fields", safeFields.join(","));

    const res = await authFetch(
      `/api/features/feature-access?${q.toString()}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    const json = await res.json();
    if (!res.ok) throw new Error(json?.message || "Load failed");

    const payload = json.data || {};
    const records = Array.isArray(payload.records) ? payload.records : [];

    window.entries = records;
    currentPage = payload.pagination?.page || safePage;
    totalPages = payload.pagination?.pageCount || 1;

    /* ================= RENDER LIST ================= */
    renderList({ entries, visibleFields, viewMode, user, currentPage });

    /* ================= SUMMARY (REUSABLE UTIL) ================= */
    payload.summary &&
      renderModuleSummary(payload.summary, "moduleSummary", {
        moduleLabel: "ACCESS RULES",
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
      document.getElementById("paginationButtons"),
      currentPage,
      totalPages,
      loadEntries
    );
  } catch (err) {
    console.error(err);
    showToast("❌ Failed to load feature access entries");
  } finally {
    hideLoading();
  }
}

/* ============================================================
   🧭 View Toggle
============================================================ */
document.getElementById("tableViewBtn").onclick = () => {
  viewMode = "table";
  localStorage.setItem("featureAccessView", "table");
  syncViewToggleUI({ mode: viewMode });
  renderList({ entries, visibleFields, viewMode, user, currentPage });
};

document.getElementById("cardViewBtn").onclick = () => {
  viewMode = "card";
  localStorage.setItem("featureAccessView", "card");
  syncViewToggleUI({ mode: viewMode });
  renderList({ entries, visibleFields, viewMode, user, currentPage });
};


/* ============================================================
   🔄 Reset Filters
============================================================ */
document.getElementById("resetFilterBtn").onclick = () => {
  [
    globalSearch,
    filterOrganization,
    filterModule,
    filterRole,
    filterFacility,
    filterStatus,
    dateRange,
  ].forEach(el => {
    if (!el) return;
    el.value = "";
    if (el.dataset) el.dataset.value = "";
  });

  loadEntries(1);
};

/* ============================================================
   ⬇️ Export
============================================================ */
document.getElementById("exportCSVBtn")?.addEventListener("click", () => {
  if (!entries.length) return showToast("❌ No data to export");

  const rows = mapDataForExport(
    entries,
    visibleFields,
    FIELD_LABELS_FEATURE_ACCESS
  );

  exportToExcel(
    rows,
    `feature_access_${new Date().toISOString().slice(0, 10)}.csv`
  );
});

document.getElementById("exportExcelBtn")?.addEventListener("click", () => {
  if (!entries.length) return showToast("❌ No data to export");

  const rows = mapDataForExport(
    entries,
    visibleFields,
    FIELD_LABELS_FEATURE_ACCESS
  );

  exportToExcel(
    rows,
    `feature_access_${new Date().toISOString().slice(0, 10)}`
  );
});

document.getElementById("exportPDFBtn")?.addEventListener("click", () => {
  const target =
    viewMode === "table" ? ".table-container" : "#featureAccessList";
  exportToPDF("Feature Access List", target, "portrait");
});

/* ============================================================
   🚀 Init
============================================================ */
export async function initFeatureAccess() {
  renderDynamicTableHead(visibleFields);

  setupToggleSection(
    "toggleFilterBtn",
    "filterCollapse",
    "filterChevron",
    "featureAccessFilterVisible"
  );

  // 🔒 Enforce REAL suggestion selection
  const enforce = input => {
    input.addEventListener("input", () => {
      input.dataset.value = "";
    });
    input.addEventListener("blur", () => {
      if (!input.dataset.value) input.value = "";
    });
  };

  [filterOrganization, filterRole, filterModule, filterFacility]
    .forEach(enforce);

  setupSuggestionInputDynamic(
    filterOrganization,
    filterOrganizationSuggestions,
    "/api/lite/organizations",
    sel => {
      filterOrganization.value = sel.name;
      filterOrganization.dataset.value = sel.id;
      loadEntries(1);
    },
    "name"
  );

  setupSuggestionInputDynamic(
    filterRole,
    filterRoleSuggestions,
    "/api/lite/roles",
    sel => {
      filterRole.value = sel.name;
      filterRole.dataset.value = sel.id;
      loadEntries(1);
    },
    "name"
  );

  setupSuggestionInputDynamic(
    filterModule,
    filterModuleSuggestions,
    "/api/lite/feature-modules",
    sel => {
      filterModule.value = sel.name;
      filterModule.dataset.value = sel.id;
      loadEntries(1);
    },
    "name"
  );

  setupSuggestionInputDynamic(
    filterFacility,
    filterFacilitySuggestions,
    "/api/lite/facilities",
    sel => {
      filterFacility.value = sel.name;
      filterFacility.dataset.value = sel.id;
      loadEntries(1);
    },
    "name"
  );

  await loadEntries(1);
}

/* ============================================================
   🏁 Boot
============================================================ */
document.readyState === "loading"
  ? document.addEventListener("DOMContentLoaded", initFeatureAccess)
  : initFeatureAccess();
