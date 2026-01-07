// 📦 stockrequest-filter-main.js – Filters + Table/Card (Master Pattern Aligned)

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
  setupSuggestionInputDynamic,
  loadOrganizationsLite,
  loadFacilitiesLite,
  loadDepartmentsLite,
  loadMasterItemsLite,
  setupSelectOptions,
} from "../../utils/data-loaders.js";

import { renderFieldSelector } from "../../utils/ui-utils.js";
import { exportToExcel, exportToPDF } from "../../utils/export-utils.js";
import { renderList, renderDynamicTableHead } from "./stockrequest-render.js";
import { setupActionHandlers } from "./stockrequest-actions.js";

import {
  FIELD_ORDER_STOCK_REQUEST,
  FIELD_DEFAULTS_STOCK_REQUEST,
} from "./stockrequest-constants.js";

import { setupVisibleFields } from "../../utils/field-visibility.js";
import { initPaginationControl } from "../../utils/pagination-control.js";

/* ============================================================
   🔐 Auth Guard – Auto resolves "stock_requests:view"
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

// 🛟 No-form stubs (for shared module actions)
window.showForm = () => {};
window.resetForm = () => {};

/* ============================================================
   🧩 Field Visibility + Selector
============================================================ */
window.entries = [];
let visibleFields = setupVisibleFields({
  moduleKey: "stock_request",
  userRole,
  defaultFields: FIELD_DEFAULTS_STOCK_REQUEST,
  allowedFields: FIELD_ORDER_STOCK_REQUEST,
});

renderFieldSelector(
  {},
  visibleFields,
  (newFields) => {
    visibleFields = newFields;
    renderDynamicTableHead(visibleFields);
    renderList({ entries, visibleFields, viewMode, user, currentPage });
  },
  FIELD_ORDER_STOCK_REQUEST
);

/* ============================================================
   🔎 Filter DOM Refs
============================================================ */
const filterOrg = document.getElementById("filterOrg");
const filterFacility = document.getElementById("filterFacility");
const filterDepartment = document.getElementById("filterDepartment");
const filterItem = document.getElementById("filterItem");
const filterReference = document.getElementById("filterReference");
const filterStatus = document.getElementById("filterStatus");
const filterFrom = document.getElementById("filterCreatedFrom");
const filterTo = document.getElementById("filterCreatedTo");

// ⬇️ Export buttons
const exportCSVBtn = document.getElementById("exportCSVBtn");
const exportPDFBtn = document.getElementById("exportPDFBtn");

/* ============================================================
   🌍 View + Paging State
============================================================ */
let currentPage = 1;
let totalPages = 1;
let viewMode = localStorage.getItem("stockRequestView") || "table";

/* ============================================================
   📋 Build Filter Object
============================================================ */
function getFilters() {
  return {
    organization_id: filterOrg?.dataset.value || "",
    facility_id: filterFacility?.dataset.value || "",
    department_id: filterDepartment?.dataset.value || "",
    master_item_id: filterItem?.dataset.value || "",
    reference_number: filterReference?.value || "",
    created_from: filterFrom?.value || "",
    created_to: filterTo?.value || "",
    status: filterStatus?.value || "",
  };
}

/* ============================================================
   🔁 Pagination Control Initialization
============================================================ */
const getPagination = initPaginationControl("stock_request", loadEntries, 25);

/* ============================================================
   📦 Load Stock Requests
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
      FIELD_ORDER_STOCK_REQUEST.includes(f)
    );
    if (safeFields.length) q.append("fields", safeFields.join(","));

    const res = await fetch(`/api/stock-requests?${q.toString()}`, {
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
  } catch (err) {
    console.error("❌ loadEntries failed:", err);
    showToast("❌ Failed to load stock requests");
  } finally {
    hideLoading();
  }
}

/* ============================================================
   🧭 View Mode Toggle
============================================================ */
document.getElementById("tableViewBtn").onclick = () => {
  viewMode = "table";
  localStorage.setItem("stockRequestView", "table");
  renderList({ entries, visibleFields, viewMode, user, currentPage });
};

document.getElementById("cardViewBtn").onclick = () => {
  viewMode = "card";
  localStorage.setItem("stockRequestView", "card");
  renderList({ entries, visibleFields, viewMode, user, currentPage });
};

/* ============================================================
   🔍 Filter Actions
============================================================ */
document.getElementById("filterBtn").onclick = async () => {
  await loadEntries(1);
};

document.getElementById("resetFilterBtn").onclick = () => {
  [
    filterOrg,
    filterFacility,
    filterDepartment,
    filterItem,
    filterReference,
    filterStatus,
    filterFrom,
    filterTo,
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
if (exportCSVBtn) {
  exportCSVBtn.onclick = () => {
    exportToExcel(
      entries,
      `stock_requests_${new Date().toISOString().slice(0, 10)}.xlsx`
    );
  };
}

if (exportPDFBtn) {
  exportPDFBtn.onclick = () => {
    const target =
      viewMode === "table" ? ".table-container" : "#stockRequestList";
    exportToPDF("Stock Request List", target, "portrait", true);
  };
}

/* ============================================================
   🚀 Init Module
============================================================ */
export async function initStockRequestModule() {
  renderDynamicTableHead(visibleFields);

  const filterCollapse = document.getElementById("filterCollapse");
  const filterChevron = document.getElementById("filterChevron");

  const filterVisible =
    localStorage.getItem("stockRequestFilterVisible") === "true";

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
    "stockRequestFilterVisible"
  );

  /* ----------------- Suggestion Inputs ----------------- */
  setupSuggestionInputDynamic(
    filterOrg,
    document.getElementById("filterOrgSuggestions"),
    "/api/lite/organizations",
    (selected) => {
      filterOrg.dataset.value = selected?.id || "";
      filterFacility.value = "";
      filterFacility.dataset.value = "";
    },
    "name"
  );

  setupSuggestionInputDynamic(
    filterFacility,
    document.getElementById("filterFacilitySuggestions"),
    "/api/lite/facilities",
    (selected) => {
      filterFacility.dataset.value = selected?.id || "";
    },
    "name",
    { extraParams: () => ({ organization_id: filterOrg?.dataset.value || "" }) }
  );

  setupSuggestionInputDynamic(
    filterDepartment,
    document.getElementById("filterDepartmentSuggestions"),
    "/api/lite/departments",
    (selected) => {
      filterDepartment.dataset.value = selected?.id || "";
    },
    "name"
  );

  setupSuggestionInputDynamic(
    filterItem,
    document.getElementById("filterItemSuggestions"),
    "/api/lite/master-items",
    (selected) => {
      filterItem.dataset.value = selected?.id || "";
    },
    "name"
  );

  await loadEntries(1);
}

/* ============================================================
   ❌ no-op
============================================================ */
export function syncRefsToState() {}

/* ============================================================
   🏁 Boot
============================================================ */
function boot() {
  initStockRequestModule().catch((err) => {
    console.error("initStockRequestModule failed:", err);
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot);
} else {
  boot();
}
