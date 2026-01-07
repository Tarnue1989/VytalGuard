// 📦 feature-access-filter-main.js – Filters + Table/Card (Enterprise-Parity, No Form)

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

import { renderList, renderDynamicTableHead } from "./feature-access-render.js";
import { setupActionHandlers } from "./feature-access-actions.js";

import {
  FIELD_ORDER_FEATURE_ACCESS,
  FIELD_DEFAULTS_FEATURE_ACCESS,
} from "./feature-access-constants.js";

import { setupVisibleFields } from "../../utils/field-visibility.js";
import { initPaginationControl } from "../../utils/pagination-control.js";

/* ============================================================
   🔐 Auth
============================================================ */
const token = initPageGuard("feature_accesses");
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
  moduleKey: "feature_access",
  userRole,
  defaultFields: FIELD_DEFAULTS_FEATURE_ACCESS,
  allowedFields: FIELD_ORDER_FEATURE_ACCESS,
});

// 🔒 Only DB-safe columns go to ?fields=
const API_FIELD_WHITELIST = [
  "module_id",
  "role_id",
  "facility_id",
  "status",
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
  FIELD_ORDER_FEATURE_ACCESS
);

/* ============================================================
   🔎 Filter DOM Refs
============================================================ */
const filterModule = document.getElementById("filterModule");
const filterModuleSuggestions = document.getElementById("filterModuleSuggestions");

const filterRole = document.getElementById("filterRole");
const filterRoleSuggestions = document.getElementById("filterRoleSuggestions");

const filterFacility = document.getElementById("filterFacility");
const filterFacilitySuggestions = document.getElementById("filterFacilitySuggestions");

const filterStatus = document.getElementById("filterStatus");
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
let viewMode = localStorage.getItem("featureAccessView") || "table";

/* ============================================================
   🔁 Pagination Control (MATCHES ALL MODULES)
============================================================ */
const getPagination = initPaginationControl(
  "feature_access",
  loadEntries,
  25
);

/* ============================================================
   📋 Filters
============================================================ */
function getFilters() {
  return {
    module_id: filterModule?.dataset.value || "",
    role_id: filterRole?.dataset.value || "",
    facility_id: filterFacility?.dataset.value || "",
    status: filterStatus?.value || "",
    created_from: filterCreatedFrom?.value || "",
    created_to: filterCreatedTo?.value || "",
  };
}

/* ============================================================
   📦 Load Feature Access Entries (PAGINATION FIXED)
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
      `/api/features/feature-access?${q.toString()}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = json?.message || "Failed to load feature access entries";
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
  renderList({ entries, visibleFields, viewMode, userRole, currentPage });
};

document.getElementById("cardViewBtn").onclick = () => {
  viewMode = "card";
  localStorage.setItem("featureAccessView", "card");
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
    filterModule,
    filterRole,
    filterFacility,
    filterStatus,
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
      `feature_access_${new Date().toISOString().slice(0, 10)}.xlsx`
    );

if (exportPDFBtn)
  exportPDFBtn.onclick = () => {
    const target =
      viewMode === "table" ? ".table-container" : "#featureAccessList";
    exportToPDF("Feature Access List", target, "portrait", true);
  };

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

  if (filterRole && filterRoleSuggestions) {
    setupSuggestionInputDynamic(
      filterRole,
      filterRoleSuggestions,
      "/api/lite/roles",
      (sel) => (filterRole.dataset.value = sel.id),
      "name"
    );
  }

  if (filterModule && filterModuleSuggestions) {
    setupSuggestionInputDynamic(
      filterModule,
      filterModuleSuggestions,
      "/api/lite/feature-modules",
      (sel) => (filterModule.dataset.value = sel.id),
      "name"
    );
  }

  if (filterFacility && filterFacilitySuggestions) {
    setupSuggestionInputDynamic(
      filterFacility,
      filterFacilitySuggestions,
      "/api/lite/facilities",
      (sel) => (filterFacility.dataset.value = sel.id),
      "name"
    );
  }

  await loadEntries(1);
}

/* ============================================================
   🏁 Boot
============================================================ */
export function syncRefsToState() {}

function boot() {
  initFeatureAccess().catch((err) =>
    console.error("initFeatureAccess failed:", err)
  );
}

if (document.readyState === "loading")
  document.addEventListener("DOMContentLoaded", boot);
else boot();
