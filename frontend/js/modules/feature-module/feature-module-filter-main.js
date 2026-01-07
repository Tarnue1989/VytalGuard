// 📦 feature-module-filter-main.js – Filters + Table/Card (Enterprise-Parity, No Form)

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

import {
  setupSuggestionInputDynamic,
} from "../../utils/data-loaders.js";

import { renderFieldSelector } from "../../utils/ui-utils.js";
import { exportToExcel, exportToPDF } from "../../utils/export-utils.js";

import { renderList, renderDynamicTableHead } from "./feature-module-render.js";
import { setupActionHandlers } from "./feature-module-actions.js";

import {
  FIELD_ORDER_FEATURE_MODULE,
  FIELD_DEFAULTS_FEATURE_MODULE,
} from "./feature-module-constants.js";

import { setupVisibleFields } from "../../utils/field-visibility.js";
import { initPaginationControl } from "../../utils/pagination-control.js";

/* ============================================================
   🔐 Auth
============================================================ */
const token = initPageGuard("feature_modules");
initLogoutWatcher();

/* ============================================================
   🌐 Role
============================================================ */
const userRole = localStorage.getItem("userRole") || "admin";

/* ============================================================
   🧠 Shared State
============================================================ */
const sharedState = {
  currentEditIdRef: { value: null },
};

// 🛟 No-form stubs
window.showForm = () => {};
window.resetForm = () => {};

/* ============================================================
   🧩 Field Visibility
============================================================ */
window.entries = [];
let visibleFields = setupVisibleFields({
  moduleKey: "feature_module",
  userRole,
  defaultFields: FIELD_DEFAULTS_FEATURE_MODULE,
  allowedFields: FIELD_ORDER_FEATURE_MODULE,
});

// 🔒 Only DB columns go to ?fields=
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
  "created_by",
  "updated_by",
  "deleted_by",
];

/* ============================================================
   🧩 Field Selector
============================================================ */
renderFieldSelector(
  {},
  visibleFields,
  (newFields) => {
    visibleFields = newFields;
    renderDynamicTableHead(visibleFields);
    renderList({ entries, visibleFields, viewMode, userRole, currentPage });
  },
  FIELD_ORDER_FEATURE_MODULE
);

/* ============================================================
   🔎 Filter DOM Refs
============================================================ */
const filterName = document.getElementById("filterName");
const filterKey = document.getElementById("filterKey");

const filterCategory = document.getElementById("filterCategory");
const filterCategorySuggestions = document.getElementById("filterCategorySuggestions");

const filterParent = document.getElementById("filterParent");
const filterParentSuggestions = document.getElementById("filterParentSuggestions");

const filterStatus = document.getElementById("filterStatus");
const filterVisibility = document.getElementById("filterVisibility");
const filterEnabled = document.getElementById("filterEnabled");

const filterTags = document.getElementById("filterTags");
const filterCreatedFrom = document.getElementById("filterCreatedFrom");
const filterCreatedTo = document.getElementById("filterCreatedTo");

/* ============================================================
   ⬇️ Export Buttons
============================================================ */
const exportCSVBtn = document.getElementById("exportCSVBtn");
const exportPDFBtn = document.getElementById("exportPDFBtn");

/* ============================================================
   🌍 View + Paging
============================================================ */
let currentPage = 1;
let totalPages = 1;
let viewMode = localStorage.getItem("featureModuleView") || "table";

/* ============================================================
   🔁 Pagination Control (MATCHES ALL OTHER MODULES)
============================================================ */
const getPagination = initPaginationControl(
  "feature_module",
  loadEntries,
  25
);

/* ============================================================
   📋 Filters
============================================================ */
function getFilters() {
  return {
    name: filterName?.dataset.value || filterName?.value || "",
    key: filterKey?.dataset.value || filterKey?.value || "",
    category: filterCategory?.dataset.value || filterCategory?.value || "",
    parent_id: filterParent?.dataset.value || "",
    status: filterStatus?.value || "",
    visibility: filterVisibility?.value || "",
    enabled: filterEnabled?.value || "",
    tags: (filterTags?.value || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .join(","),
    created_from: filterCreatedFrom?.value || "",
    created_to: filterCreatedTo?.value || "",
  };
}

/* ============================================================
   📦 Load Feature Modules (PAGINATION FIXED)
============================================================ */
async function loadEntries(page = 1) {
  try {
    showLoading();
    const filters = getFilters();
    const q = new URLSearchParams();

    const { page: safePage, limit: safeLimit } = getPagination(page);
    q.append("page", safePage);
    q.append("limit", safeLimit);

    if (filters.created_from) q.append("created_at[gte]", filters.created_from);
    if (filters.created_to) q.append("created_at[lte]", filters.created_to);

    Object.entries(filters).forEach(([k, v]) => {
      if (!v || k === "created_from" || k === "created_to") return;
      q.append(k, v);
    });

    const safeFields = visibleFields.filter((f) =>
      API_FIELD_WHITELIST.includes(f)
    );
    if (safeFields.length) q.append("fields", safeFields.join(","));

    const res = await authFetch(
      `/api/features/feature-modules?${q.toString()}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = json?.message || "Failed to load feature modules";
      throw new Error(msg);
    }

    const payload = json?.data || {};
    const records = Array.isArray(payload.records) ? payload.records : [];
    window.entries = records;

    currentPage = Number(payload.pagination?.page) || safePage;
    totalPages = Number(payload.pagination?.pageCount) || 1;

    renderList({ entries, visibleFields, viewMode, userRole, currentPage });

    setupActionHandlers({
      entries,
      token,
      currentPage,
      loadEntries,
      visibleFields,
      sharedState,
    });

    renderPaginationControls(
      document.getElementById("paginationButtons"),
      currentPage,
      totalPages,
      loadEntries
    );
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
  renderList({ entries, visibleFields, viewMode, userRole, currentPage });
};

document.getElementById("cardViewBtn").onclick = () => {
  viewMode = "card";
  localStorage.setItem("featureModuleView", "card");
  renderList({ entries, visibleFields, viewMode, userRole, currentPage });
};

/* ============================================================
   🔎 Filter Actions
============================================================ */
document.getElementById("filterBtn").onclick = async () => {
  await loadEntries(1);
};

document.getElementById("resetFilterBtn").onclick = () => {
  [
    filterName,
    filterKey,
    filterCategory,
    filterParent,
    filterStatus,
    filterVisibility,
    filterEnabled,
    filterTags,
    filterCreatedFrom,
    filterCreatedTo,
  ].forEach((el) => {
    if (!el) return;
    el.value = "";
    if (el.dataset) el.dataset.value = "";
  });

  loadEntries(1);
};

/* ============================================================
   ⬇️ Export
============================================================ */
if (exportCSVBtn)
  exportCSVBtn.onclick = () =>
    exportToExcel(
      entries,
      `feature_modules_${new Date().toISOString().slice(0, 10)}.xlsx`
    );

if (exportPDFBtn)
  exportPDFBtn.onclick = () => {
    const target =
      viewMode === "table" ? ".table-container" : "#featureModuleList";
    exportToPDF("Feature Module List", target, "portrait", true);
  };

/* ============================================================
   🚀 Init
============================================================ */
export async function initFeatureModule() {
  renderDynamicTableHead(visibleFields);

  setupToggleSection(
    "toggleFilterBtn",
    "filterCollapse",
    "filterChevron",
    "featureModuleFilterVisible"
  );

  // Name
  if (filterName) {
    const suggestions = document.createElement("div");
    suggestions.classList.add("suggestions");
    filterName.parentNode.appendChild(suggestions);

    setupSuggestionInputDynamic(
      filterName,
      suggestions,
      "/api/lite/feature-modules",
      (sel) => {
        filterName.value = sel.name;
        filterName.dataset.value = sel.name;
      },
      "name"
    );
  }

  // Key
  if (filterKey) {
    const suggestions = document.createElement("div");
    suggestions.classList.add("suggestions");
    filterKey.parentNode.appendChild(suggestions);

    setupSuggestionInputDynamic(
      filterKey,
      suggestions,
      "/api/lite/feature-modules",
      (sel) => {
        filterKey.value = sel.key;
        filterKey.dataset.value = sel.key;
      },
      "key"
    );
  }

  // Parent
  if (filterParent && filterParentSuggestions) {
    setupSuggestionInputDynamic(
      filterParent,
      filterParentSuggestions,
      "/api/lite/feature-module-parents",
      (sel) => {
        filterParent.value = sel.name;
        filterParent.dataset.value = sel.id;
      },
      "name"
    );
  }

  // Category
  if (filterCategory && filterCategorySuggestions) {
    setupSuggestionInputDynamic(
      filterCategory,
      filterCategorySuggestions,
      "/api/lite/feature-module-categories",
      (sel) => {
        filterCategory.value = sel.category;
        filterCategory.dataset.value = sel.category;
      },
      "category"
    );
  }

  await loadEntries(1);
}

/* ============================================================
   🏁 Boot
============================================================ */
export function syncRefsToState() {}

function boot() {
  initFeatureModule().catch((err) =>
    console.error("initFeatureModule failed:", err)
  );
}

if (document.readyState === "loading")
  document.addEventListener("DOMContentLoaded", boot);
else boot();
