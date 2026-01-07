// 📦 master-item-filter-main.js – Filters + Table/Card (Enterprise-Aligned)
// ============================================================================
// 🧭 Master Pattern: master-item-category-filter-main.js / autoBillingRule-filter-main.js
// 🔹 Full enterprise structure — permissions, pagination, toggle sections,
//   exports, field selector, and role-aware visibility
// 🔹 Added Feature Module filter (ID-based, dynamic suggestions)
// 🔹 100% ID-safe and fully consistent with backend API
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
import {
  setupSuggestionInputDynamic,
  loadOrganizationsLite,
  loadFacilitiesLite,
  loadMasterItemsLite,
} from "../../utils/data-loaders.js";

import { renderFieldSelector } from "../../utils/ui-utils.js";
import { exportToExcel, exportToPDF } from "../../utils/export-utils.js";
import { renderList, renderDynamicTableHead } from "./master-item-render.js";
import { setupActionHandlers } from "./master-item-actions.js";

import {
  FIELD_ORDER_MASTER_ITEM,
  FIELD_DEFAULTS_MASTER_ITEM,
} from "./master-item-constants.js";

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
  moduleKey: "master_item",
  userRole,
  defaultFields: FIELD_DEFAULTS_MASTER_ITEM,
  allowedFields: FIELD_ORDER_MASTER_ITEM,
});

renderFieldSelector(
  {},
  visibleFields,
  (newFields) => {
    visibleFields = newFields;
    renderDynamicTableHead(visibleFields);
    renderList({ entries, visibleFields, viewMode, user, currentPage });
  },
  FIELD_ORDER_MASTER_ITEM
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

// ✅ Added: Feature Module Filter
const filterFeatureModule = document.getElementById("filterFeatureModule");
const filterFeatureModuleSuggestions = document.getElementById("filterFeatureModuleSuggestions");

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
let viewMode = localStorage.getItem("masterItemView") || "table";

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
    feature_module_id: filterFeatureModule?.dataset.value || "", // ✅ new
    status: filterStatus?.value || "",
    created_from: filterCreatedFrom?.value || "",
    created_to: filterCreatedTo?.value || "",
    q: filterSearch?.value || "",
  };
}

/* ============================================================
   🔁 Pagination Control
============================================================ */
const getPagination = initPaginationControl("master_item", loadEntries, 25);

/* ============================================================
   📦 Load Master Items
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
      FIELD_ORDER_MASTER_ITEM.includes(f)
    );
    if (safeFields.length) q.append("fields", safeFields.join(","));

    const res = await authFetch(`/api/master-items?${q.toString()}`, {
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

    if (!records.length) showToast("ℹ️ No master items found for current filters");
  } catch (err) {
    console.error("❌ loadEntries failed:", err);
    showToast("❌ Failed to load master items");
  } finally {
    hideLoading();
  }
}

/* ============================================================
   🧭 View Toggle (Table ↔ Card)
============================================================ */
document.getElementById("tableViewBtn").onclick = () => {
  viewMode = "table";
  localStorage.setItem("masterItemView", "table");
  renderList({ entries, visibleFields, viewMode, user, currentPage });
};

document.getElementById("cardViewBtn").onclick = () => {
  viewMode = "card";
  localStorage.setItem("masterItemView", "card");
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
    filterFeatureModule, // ✅ clear module filter too
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
      `master_items_${new Date().toISOString().slice(0, 10)}.xlsx`
    );

if (exportPDFBtn)
  exportPDFBtn.onclick = () => {
    const target = viewMode === "table" ? ".table-container" : "#masterItemList";
    exportToPDF("Master Item List", target, "portrait", true);
  };

/* ============================================================
   🚀 Init Module
============================================================ */
export async function initMasterItemModule() {
  renderDynamicTableHead(visibleFields);

  const filterCollapse = document.getElementById("filterCollapse");
  const filterChevron = document.getElementById("filterChevron");
  const filterVisible = localStorage.getItem("masterItemFilterVisible") === "true";

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
    "masterItemFilterVisible"
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
    (selected) => (filterFacility.dataset.value = selected.id),
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
    "/api/lite/master-items",
    (selected) => (filterName.dataset.value = selected.id),
    "name"
  );

  setupSuggestionInputDynamic(
    filterCode,
    filterCodeSuggestions,
    "/api/lite/master-items",
    (selected) => (filterCode.dataset.value = selected.id),
    "code"
  );

  setupSuggestionInputDynamic(
    filterDescription,
    filterDescriptionSuggestions,
    "/api/lite/master-items",
    (selected) => (filterDescription.dataset.value = selected.id),
    "description"
  );

  // ✅ NEW: Feature Module dynamic search (ID-based)
  setupSuggestionInputDynamic(
    filterFeatureModule,
    filterFeatureModuleSuggestions,
    "/api/lite/feature-modules",
    (selected) => (filterFeatureModule.dataset.value = selected.id),
    "name"
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
  initMasterItemModule().catch((err) =>
    console.error("initMasterItemModule failed:", err)
  );
}
if (document.readyState === "loading")
  document.addEventListener("DOMContentLoaded", boot);
else boot();
