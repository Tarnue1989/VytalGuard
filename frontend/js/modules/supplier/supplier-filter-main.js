// 📦 supplier-filter-main.js – Enterprise-Aligned (Master Pattern)
// ============================================================================
// 🧭 Master Pattern: triageRecord-filter-main.js
// 🔹 Unified enterprise structure for filters, visibility, permissions,
//   exports, and pagination.
// 🔹 All Supplier HTML IDs preserved exactly.
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

import {
  loadOrganizationsLite,
  loadFacilitiesLite,
  setupSuggestionInputDynamic,
  setupSelectOptions,
} from "../../utils/data-loaders.js";

import { renderFieldSelector } from "../../utils/ui-utils.js";
import { exportToExcel, exportToPDF } from "../../utils/export-utils.js";
import { renderList, renderDynamicTableHead } from "./supplier-render.js";
import { setupActionHandlers } from "./supplier-actions.js";
import {
  FIELD_ORDER_SUPPLIER,
  FIELD_DEFAULTS_SUPPLIER,
} from "./supplier-constants.js";
import { setupVisibleFields } from "../../utils/field-visibility.js";

/* ============================================================
   🔐 Auth + Logout Guard
============================================================ */
const token = initPageGuard(autoPagePermissionKey());
initLogoutWatcher();

/* ============================================================
   🧠 Role + Permission Normalization
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
   🌐 Shared State
============================================================ */
const sharedState = { currentEditIdRef: { value: null } };
window.showForm = () => {};
window.resetForm = () => {};

/* ============================================================
   📋 Field Visibility Setup
============================================================ */
window.entries = [];
let visibleFields = setupVisibleFields({
  moduleKey: "suppliers",
  userRole,
  defaultFields: FIELD_DEFAULTS_SUPPLIER,
  allowedFields: FIELD_ORDER_SUPPLIER,
});

renderFieldSelector(
  {},
  visibleFields,
  (newFields) => {
    visibleFields = newFields;
    renderDynamicTableHead(visibleFields);
    renderList({ entries, visibleFields, viewMode, user, currentPage });
  },
  FIELD_ORDER_SUPPLIER
);

/* ============================================================
   🧩 Filter DOM Refs
============================================================ */
const filterSearch = document.getElementById("filterSearch");
const filterSearchSuggestions = document.getElementById("filterSearchSuggestions");
const filterOrganization = document.getElementById("filterOrganization");
const filterOrganizationSuggestions = document.getElementById("filterOrganizationSuggestions");
const filterFacility = document.getElementById("filterFacility");
const filterFacilitySuggestions = document.getElementById("filterFacilitySuggestions");
const filterStatus = document.getElementById("filterStatus");
const filterCreatedFrom = document.getElementById("filterCreatedFrom");
const filterCreatedTo = document.getElementById("filterCreatedTo");

const exportCSVBtn = document.getElementById("exportCSVBtn");
const exportPDFBtn = document.getElementById("exportPDFBtn");

/* ============================================================
   🌍 View + Paging State
============================================================ */
let currentPage = 1;
let totalPages = 1;
let viewMode = localStorage.getItem("supplierView") || "table";

/* ============================================================
   📋 Build Filters
============================================================ */
function getFilters() {
  return {
    global: filterSearch?.dataset.value || "",
    organization_id: filterOrganization?.dataset.value || "",
    facility_id: filterFacility?.dataset.value || "",
    status: filterStatus?.value || "",
    created_from: filterCreatedFrom?.value || "",
    created_to: filterCreatedTo?.value || "",
  };
}

/* ============================================================
   📦 Load Suppliers
============================================================ */
async function loadEntries(page = 1) {
  try {
    const filters = getFilters();
    const q = new URLSearchParams();

    if (filters.created_from) q.append("created_at[gte]", filters.created_from);
    if (filters.created_to) q.append("created_at[lte]", filters.created_to);

    Object.entries(filters).forEach(([k, v]) => {
      if (!v || ["created_from", "created_to"].includes(k)) return;
      q.append(k, v);
    });

    const safeFields = visibleFields.filter((f) =>
      FIELD_ORDER_SUPPLIER.includes(f)
    );
    if (safeFields.length) q.append("fields", safeFields.join(","));

    const res = await fetch(`/api/suppliers?page=${page}&limit=10&${q}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    let result = {};
    try {
      result = await res.json();
    } catch {
      console.warn("⚠️ Non-JSON response");
    }

    const payload = result?.data || {};
    const records = Array.isArray(payload.records) ? payload.records : [];

    window.entries = records;
    currentPage = Number(payload.pagination?.page) || 1;
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
  } catch (err) {
    console.error("❌ loadEntries failed:", err);
    showToast("❌ Failed to load suppliers");
  }
}

/* ============================================================
   🧭 View Toggle
============================================================ */
document.getElementById("tableViewBtn").onclick = () => {
  viewMode = "table";
  localStorage.setItem("supplierView", "table");
  renderList({ entries, visibleFields, viewMode, user, currentPage });
};

document.getElementById("cardViewBtn").onclick = () => {
  viewMode = "card";
  localStorage.setItem("supplierView", "card");
  renderList({ entries, visibleFields, viewMode, user, currentPage });
};

/* ============================================================
   🔎 Filter Actions
============================================================ */
document.getElementById("filterBtn").onclick = async () => {
  try {
    showLoading();
    await loadEntries(1);
  } finally {
    hideLoading();
  }
};

document.getElementById("resetFilterBtn").onclick = () => {
  [
    filterSearch,
    filterOrganization,
    filterFacility,
    filterStatus,
    filterCreatedFrom,
    filterCreatedTo,
  ].forEach((el) => {
    if (el) {
      el.value = "";
      if (el.dataset) el.dataset.value = "";
    }
  });
  loadEntries(1);
};

/* ============================================================
   ⬇️ Export Buttons
============================================================ */
if (exportCSVBtn) {
  exportCSVBtn.onclick = () => {
    exportToExcel(
      entries,
      `suppliers_${new Date().toISOString().slice(0, 10)}.xlsx`
    );
  };
}

if (exportPDFBtn) {
  exportPDFBtn.onclick = () => {
    const target =
      viewMode === "table" ? ".table-container" : "#supplierList";
    exportToPDF("Supplier List", target, "portrait", true);
  };
}

/* ============================================================
   🚀 Init Module
============================================================ */
export async function initSupplierModule() {
  renderDynamicTableHead(visibleFields);

  const filterCollapse = document.getElementById("filterCollapse");
  const filterChevron = document.getElementById("filterChevron");

  const filterVisible =
    localStorage.getItem("supplierFilterVisible") === "true";
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
    "supplierFilterVisible"
  );

  // ✅ Global Search
  if (filterSearch && filterSearchSuggestions) {
    setupSuggestionInputDynamic(
      filterSearch,
      filterSearchSuggestions,
      "/api/lite/suppliers",
      (selected) => {
        filterSearch.dataset.value = selected.id;
      },
      "label"
    );
  }

  // ✅ Organization + Facility (cascading)
  if (filterOrganization && filterOrganizationSuggestions) {
    setupSuggestionInputDynamic(
      filterOrganization,
      filterOrganizationSuggestions,
      "/api/lite/organizations",
      (selected) => {
        filterOrganization.dataset.value = selected.id;
        filterFacility.value = "";
        filterFacility.dataset.value = "";
      },
      "name"
    );
  }

  if (filterFacility && filterFacilitySuggestions) {
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
          organization_id: filterOrganization?.dataset.value || "",
        }),
      }
    );
  }

  await loadEntries(1);
}

/* ============================================================
   🔁 Sync Helper (Reserved)
============================================================ */
export function syncRefsToState() {}

/* ============================================================
   ⚙️ Boot
============================================================ */
function boot() {
  initSupplierModule().catch((err) => {
    console.error("initSupplierModule failed:", err);
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot);
} else {
  boot();
}
