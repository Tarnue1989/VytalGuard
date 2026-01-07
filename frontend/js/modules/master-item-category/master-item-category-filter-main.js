// 📦 master-item-category-filter-main.js – Filters + Table/Card (Enterprise-Aligned)
// ============================================================================
// 🧭 Master Pattern: role-filter-main.js
// 🔹 Full enterprise structure — permissions, pagination, toggle sections,
//   exports, field selector, and role-aware visibility
// 🔹 All HTML IDs preserved exactly for linked HTML and UI logic
// ============================================================================

import {
  showToast,
  showLoading,
  hideLoading,
  initPageGuard,
  autoPagePermissionKey,
  setupToggleSection,
  renderPaginationControls,
  initLogoutWatcher,
} from "../../utils/index.js";

import { authFetch } from "../../authSession.js";
import { setupSuggestionInputDynamic } from "../../utils/data-loaders.js";
import { renderFieldSelector } from "../../utils/ui-utils.js";
import { exportToExcel, exportToPDF } from "../../utils/export-utils.js";
import { renderList, renderDynamicTableHead } from "./master-item-category-render.js";
import { setupActionHandlers } from "./master-item-category-actions.js";
import {
  FIELD_ORDER_MASTER_ITEM_CATEGORY,
  FIELD_DEFAULTS_MASTER_ITEM_CATEGORY,
} from "./master-item-category-constants.js";
import { setupVisibleFields } from "../../utils/field-visibility.js";
import { initPaginationControl } from "../../utils/pagination-control.js";

/* ============================================================
   🔐 Auth Guard
============================================================ */
const token = initPageGuard(autoPagePermissionKey());
initLogoutWatcher();

/* ============================================================
   🌐 Role + Permissions
============================================================ */
const roleRaw = localStorage.getItem("userRole") || "";
const userRole = roleRaw.trim().toLowerCase();

let perms = [];
try {
  const rawPerms = JSON.parse(localStorage.getItem("permissions") || "[]");
  perms = Array.isArray(rawPerms)
    ? rawPerms.map((p) => String(p.key || p).toLowerCase().trim())
    : [];
} catch {
  perms = [];
}

const user = { role: userRole, permissions: perms };

/* ============================================================
   🧠 Shared State
============================================================ */
const sharedState = { currentEditIdRef: { value: null } };
window.showForm = () => {};
window.resetForm = () => {};

/* ============================================================
   🧩 Field Visibility + Selector
============================================================ */
window.entries = [];
let visibleFields = setupVisibleFields({
  moduleKey: "master_item_category",
  userRole,
  defaultFields: FIELD_DEFAULTS_MASTER_ITEM_CATEGORY,
  allowedFields: FIELD_ORDER_MASTER_ITEM_CATEGORY,
});

renderFieldSelector(
  {},
  visibleFields,
  (newFields) => {
    visibleFields = newFields;
    renderDynamicTableHead(visibleFields);
    renderList({ entries, visibleFields, viewMode, user, currentPage });
  },
  FIELD_ORDER_MASTER_ITEM_CATEGORY
);

/* ============================================================
   🔎 Filter DOM Refs
============================================================ */
const filterOrg = document.getElementById("filterOrg");
const filterOrgSuggestions = document.getElementById("filterOrgSuggestions");
const filterFacility = document.getElementById("filterFacility");
const filterFacilitySuggestions = document.getElementById("filterFacilitySuggestions");
const filterName = document.getElementById("filterName");
const filterNameSuggestions = document.getElementById("filterNameSuggestions");
const filterCode = document.getElementById("filterCode");
const filterCodeSuggestions = document.getElementById("filterCodeSuggestions");
const filterDescription = document.getElementById("filterDescription");
const filterDescriptionSuggestions = document.getElementById("filterDescriptionSuggestions");
const filterStatus = document.getElementById("filterStatus");
const filterCreatedFrom = document.getElementById("filterCreatedFrom");
const filterCreatedTo = document.getElementById("filterCreatedTo");
const filterSearch = document.getElementById("filterSearch");

const exportCSVBtn = document.getElementById("exportCSVBtn");
const exportPDFBtn = document.getElementById("exportPDFBtn");

/* ============================================================
   🌍 View + Paging
============================================================ */
let currentPage = 1;
let totalPages = 1;
let viewMode = localStorage.getItem("masterItemCategoryView") || "table";

/* ============================================================
   📋 Build Filter Object
============================================================ */
function getFilters() {
  return {
    organization_id: filterOrg?.dataset.value || "",
    facility_id: filterFacility?.dataset.value || "",
    name: filterName?.dataset.value || "",
    code: filterCode?.dataset.value || "",
    description: filterDescription?.dataset.value || "",
    status: filterStatus?.value || "",
    created_from: filterCreatedFrom?.value || "",
    created_to: filterCreatedTo?.value || "",
    q: filterSearch?.value || "",
  };
}

/* ============================================================
   🔁 Pagination Control
============================================================ */
const getPagination = initPaginationControl("master_item_category", loadEntries, 25);

/* ============================================================
   📦 Load Master Item Categories
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
      if (!v || ["created_from", "created_to"].includes(k)) return;
      q.append(k, v);
    });

    const safeFields = visibleFields.filter((f) =>
      FIELD_ORDER_MASTER_ITEM_CATEGORY.includes(f)
    );
    if (safeFields.length) q.append("fields", safeFields.join(","));

    const res = await authFetch(`/api/master-item-categories?${q.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    const result = await res.json().catch(() => ({}));
    const payload = result?.data || {};
    const records = Array.isArray(payload.records) ? payload.records : [];

    window.entries = records;
    currentPage = Number(payload.pagination?.page) || safePage;
    totalPages = Number(payload.pagination?.pageCount) || 1;

    renderList({ entries, visibleFields, viewMode, user, currentPage });

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

    if (!records.length) showToast("ℹ️ No categories found for current filters");
  } catch (err) {
    console.error("❌ loadEntries failed:", err);
    showToast("❌ Failed to load categories");
  } finally {
    hideLoading();
  }
}

/* ============================================================
   🧭 View Toggle (Table ↔ Card)
============================================================ */
document.getElementById("tableViewBtn").onclick = () => {
  viewMode = "table";
  localStorage.setItem("masterItemCategoryView", "table");
  renderList({ entries, visibleFields, viewMode, user, currentPage });
};

document.getElementById("cardViewBtn").onclick = () => {
  viewMode = "card";
  localStorage.setItem("masterItemCategoryView", "card");
  renderList({ entries, visibleFields, viewMode, user, currentPage });
};

/* ============================================================
   🔍 Filter Actions
============================================================ */
document.getElementById("filterBtn").onclick = async () => await loadEntries(1);

document.getElementById("resetFilterBtn").onclick = () => {
  [
    filterOrg,
    filterFacility,
    filterName,
    filterCode,
    filterDescription,
    filterStatus,
    filterCreatedFrom,
    filterCreatedTo,
    filterSearch,
  ].forEach((el) => {
    if (el) {
      el.value = "";
      if (el.dataset) el.dataset.value = "";
    }
  });
  loadEntries(1);
};

/* ============================================================
   ⬇️ Export Tools
============================================================ */
if (exportCSVBtn)
  exportCSVBtn.onclick = () =>
    exportToExcel(
      entries,
      `master_item_categories_${new Date().toISOString().slice(0, 10)}.xlsx`
    );

if (exportPDFBtn)
  exportPDFBtn.onclick = () => {
    const target =
      viewMode === "table" ? ".table-container" : "#masterItemCategoryList";
    exportToPDF("Master Item Category List", target, "portrait", true);
  };

/* ============================================================
   🚀 Init Module
============================================================ */
export async function initMasterItemCategoryModule() {
  renderDynamicTableHead(visibleFields);

  const filterCollapse = document.getElementById("filterCollapse");
  const filterChevron = document.getElementById("filterChevron");
  const filterVisible =
    localStorage.getItem("masterItemCategoryFilterVisible") === "true";

  if (filterVisible) {
    filterCollapse?.classList.remove("hidden");
    filterChevron?.classList.add("chevron-rotate");
  } else {
    filterCollapse?.classList.add("hidden");
    filterChevron?.classList.remove("chevron-rotate");
  }

  setupToggleSection(
    "toggleFilterBtn",
    "filterCollapse",
    "filterChevron",
    "masterItemCategoryFilterVisible"
  );

  /* ----------------- Suggestion Inputs ----------------- */
  setupSuggestionInputDynamic(
    filterOrg,
    filterOrgSuggestions,
    "/api/lite/organizations",
    (selected) => {
      filterOrg.dataset.value = selected.id;
      filterFacility.value = "";
      filterFacility.dataset.value = "";
    },
    "name"
  );

  setupSuggestionInputDynamic(
    filterFacility,
    filterFacilitySuggestions,
    "/api/lite/facilities",
    (selected) => {
      filterFacility.dataset.value = selected.id;
    },
    "name",
    {
      extraParams: () => ({
        organization_id: filterOrg?.dataset.value || "",
      }),
    }
  );

  setupSuggestionInputDynamic(
    filterName,
    filterNameSuggestions,
    "/api/lite/master-item-categories",
    (selected) => (filterName.dataset.value = selected.id),
    "name"
  );

  setupSuggestionInputDynamic(
    filterCode,
    filterCodeSuggestions,
    "/api/lite/master-item-categories",
    (selected) => (filterCode.dataset.value = selected.id),
    "code"
  );

  setupSuggestionInputDynamic(
    filterDescription,
    filterDescriptionSuggestions,
    "/api/lite/master-item-categories",
    (selected) => (filterDescription.dataset.value = selected.id),
    "description"
  );

  await loadEntries(1);
}

/* ============================================================
   🔁 Sync Helper (reserved)
============================================================ */
export function syncRefsToState() {
  // Reserved for advanced reactive behavior
}

/* ============================================================
   🏁 Boot
============================================================ */
function boot() {
  initMasterItemCategoryModule().catch((err) =>
    console.error("initMasterItemCategoryModule failed:", err)
  );
}
if (document.readyState === "loading")
  document.addEventListener("DOMContentLoaded", boot);
else boot();
