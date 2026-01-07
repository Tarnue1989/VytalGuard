// ============================================================================
// 🏥 VytalGuard – Facility Filter + Table/Card (Enterprise Master Pattern Aligned)
// 🔹 Mirrors organization-filter-main.js for full parity in structure & behavior
// 🔹 Keeps all facility-specific IDs, filters, and org dynamic input intact
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
import { renderList, renderDynamicTableHead } from "./facility-render.js";
import { setupActionHandlers } from "./facility-actions.js";
import {
  FIELD_ORDER_FACILITY,
  FIELD_DEFAULTS_FACILITY,
} from "./facility-constants.js";
import { setupVisibleFields } from "../../utils/field-visibility.js";
import { initPaginationControl } from "../../utils/pagination-control.js";

/* ============================================================
   🔐 Auth + Permissions
============================================================ */
const token = initPageGuard(autoPagePermissionKey());
initLogoutWatcher();

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
  moduleKey: "facility",
  userRole,
  defaultFields: FIELD_DEFAULTS_FACILITY,
  allowedFields: FIELD_ORDER_FACILITY,
});

renderFieldSelector(
  {},
  visibleFields,
  (newFields) => {
    visibleFields = newFields;
    renderDynamicTableHead(visibleFields);
    renderList({ entries, visibleFields, viewMode, user, currentPage });
  },
  FIELD_ORDER_FACILITY
);

/* ============================================================
   🔎 Filter DOM Refs
============================================================ */
const filterName = document.getElementById("filterName");
const filterCode = document.getElementById("filterCode");
const filterStatus = document.getElementById("filterStatus");
const filterAddress = document.getElementById("filterAddress");
const filterPhone = document.getElementById("filterPhone");
const filterEmail = document.getElementById("filterEmail");
const filterCreatedFrom = document.getElementById("filterCreatedFrom");
const filterCreatedTo = document.getElementById("filterCreatedTo");

// 🔹 Organization Filter (Dynamic Input)
const filterOrgInput = document.getElementById("filterOrganization");
const filterOrgSuggestions = document.getElementById("filterOrganizationSuggestions");
const filterOrgHidden = document.getElementById("filterOrganizationId");

// Export buttons
const exportCSVBtn = document.getElementById("exportCSVBtn");
const exportPDFBtn = document.getElementById("exportPDFBtn");

/* ============================================================
   🌍 View + Pagination State
============================================================ */
let currentPage = 1;
let totalPages = 1;
let viewMode = localStorage.getItem("facilityView") || "table";

/* ============================================================
   📋 Build Filter Object
============================================================ */
function getFilters() {
  return {
    name: filterName?.dataset?.value || filterName?.value || "",
    code: filterCode?.dataset?.value || filterCode?.value || "",
    status: filterStatus?.value || "",
    address: filterAddress?.value || "",
    phone: filterPhone?.value || "",
    email: filterEmail?.value || "",
    organization_id: filterOrgHidden?.value || "",
    created_from: filterCreatedFrom?.value || "",
    created_to: filterCreatedTo?.value || "",
  };
}

/* ============================================================
   🔁 Pagination Control
============================================================ */
const getPagination = initPaginationControl("facility", loadEntries, 25);

/* ============================================================
   📦 Load Facilities
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
      FIELD_ORDER_FACILITY.includes(f)
    );
    if (safeFields.length) q.append("fields", safeFields.join(","));

    const res = await authFetch(`/api/facilities?${q.toString()}`, {
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

    if (!records.length) showToast("ℹ️ No facilities found for current filters");
  } catch (err) {
    console.error("❌ loadEntries failed:", err);
    showToast("❌ Failed to load facilities");
  } finally {
    hideLoading();
  }
}

/* ============================================================
   🧭 View Toggle (Table ↔ Card)
============================================================ */
document.getElementById("tableViewBtn").onclick = () => {
  viewMode = "table";
  localStorage.setItem("facilityView", "table");
  renderList({ entries, visibleFields, viewMode, user, currentPage });
  document.getElementById("tableViewBtn")?.classList.add("active");
  document.getElementById("cardViewBtn")?.classList.remove("active");
};

document.getElementById("cardViewBtn").onclick = () => {
  viewMode = "card";
  localStorage.setItem("facilityView", "card");
  renderList({ entries, visibleFields, viewMode, user, currentPage });
  document.getElementById("cardViewBtn")?.classList.add("active");
  document.getElementById("tableViewBtn")?.classList.remove("active");
};

/* ============================================================
   🔍 Filter Actions
============================================================ */
document.getElementById("filterBtn").onclick = async () => await loadEntries(1);

document.getElementById("resetFilterBtn").onclick = () => {
  [
    filterName,
    filterCode,
    filterStatus,
    filterAddress,
    filterPhone,
    filterEmail,
    filterCreatedFrom,
    filterCreatedTo,
    filterOrgInput,
  ].forEach((el) => {
    if (el) {
      el.value = "";
      if (el.dataset) el.dataset.value = "";
    }
  });
  if (filterOrgHidden) filterOrgHidden.value = "";
  loadEntries(1);
};

/* ============================================================
   ⬇️ Export Tools
============================================================ */
if (exportCSVBtn)
  exportCSVBtn.onclick = () =>
    exportToExcel(entries, `facilities_${new Date().toISOString().slice(0, 10)}.xlsx`);

if (exportPDFBtn)
  exportPDFBtn.onclick = () => {
    const target = viewMode === "table" ? ".table-container" : "#facilityList";
    exportToPDF("Facility List", target, "portrait", true);
  };

/* ============================================================
   🚀 Init Module
============================================================ */
export async function initFacilityModule() {
  renderDynamicTableHead(visibleFields);

  const filterCollapse = document.getElementById("filterCollapse");
  const filterChevron = document.getElementById("filterChevron");
  const filterVisible = localStorage.getItem("facilityFilterVisible") === "true";

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
    "facilityFilterVisible"
  );

  // 🔹 Setup dynamic organization filter
  if (filterOrgInput && filterOrgSuggestions && filterOrgHidden) {
    setupSuggestionInputDynamic(
      filterOrgInput,
      filterOrgSuggestions,
      "/api/lite/organizations",
      (selected) => (filterOrgHidden.value = selected.id),
      "name"
    );
  }

  await loadEntries(1);
}

/* ============================================================
   🔁 Sync Helper (Reserved)
============================================================ */
export function syncRefsToState() {}

/* ============================================================
   🏁 Boot
============================================================ */
function boot() {
  initFacilityModule().catch((err) =>
    console.error("initFacilityModule failed:", err)
  );
}

if (document.readyState === "loading")
  document.addEventListener("DOMContentLoaded", boot);
else boot();

// ============================================================================
// ✅ Enterprise Pattern Summary:
//  - Full parity with organization-filter-main.js
//  - Role/permission-aware loading
//  - Dynamic organization suggestion input
//  - Unified pagination + export + filter collapse memory
//  - Field visibility + selector + responsive table/card mode
// ============================================================================
