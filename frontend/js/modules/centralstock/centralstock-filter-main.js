// 📦 centralstock-filter-main.js – Filters + Table/Card (Enterprise Pattern Aligned)
// ============================================================================
// 🔹 Mirrors appointment-filter-main.js for unified lifecycle & summary logic
// 🔹 Adds universal summary renderer using #moduleSummary
// 🔹 Handles quantity/value totals, expired counts, org/facility filters
// 🔹 Now includes dynamic records-per-page dropdown behavior
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
  loadOrganizationsLite,
  loadFacilitiesLite,
  loadSuppliersLite,
  loadMasterItemsLite,
  setupSuggestionInputDynamic,
  setupSelectOptions,
} from "../../utils/data-loaders.js";

import { renderFieldSelector } from "../../utils/ui-utils.js";
import { exportToExcel, exportToPDF } from "../../utils/export-utils.js";
import { renderList, renderDynamicTableHead } from "./centralstock-render.js";
import { setupActionHandlers } from "./centralstock-actions.js";
import {
  FIELD_ORDER_CENTRAL_STOCK,
  FIELD_DEFAULTS_CENTRAL_STOCK,
} from "./centralstock-constants.js";
import { setupVisibleFields } from "../../utils/field-visibility.js";
import { initPaginationControl } from "../../utils/pagination-control.js";

/* ============================================================
   🔐 Auth Guard + Session
============================================================ */
const token = initPageGuard(autoPagePermissionKey());
initLogoutWatcher();

/* ============================================================
   👥 Role & Permissions
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
window.entries = [];

/* ============================================================
   🧩 Field Visibility
============================================================ */
let visibleFields = setupVisibleFields({
  moduleKey: "central_stock",
  userRole,
  defaultFields: FIELD_DEFAULTS_CENTRAL_STOCK,
  allowedFields: FIELD_ORDER_CENTRAL_STOCK,
});

renderFieldSelector(
  {},
  visibleFields,
  (newFields) => {
    visibleFields = newFields;
    renderDynamicTableHead(visibleFields);
    renderList({ entries, visibleFields, viewMode, user, currentPage });
  },
  FIELD_ORDER_CENTRAL_STOCK
);

/* ============================================================
   🔎 Filter DOM Refs
============================================================ */
const filterOrg = document.getElementById("filterOrganizationSelect");
const filterFacility = document.getElementById("filterFacilitySelect");
const filterItem = document.getElementById("filterItem");
const filterItemHidden = document.getElementById("filterItemId");
const filterItemSuggestions = document.getElementById("filterItemSuggestions");
const filterSupplier = document.getElementById("filterSupplier");
const filterStatus = document.getElementById("filterStatus");
const filterBatchNumber = document.getElementById("filterBatchNumber");
const filterReceivedFrom = document.getElementById("filterReceivedFrom");
const filterReceivedTo = document.getElementById("filterReceivedTo");

const exportCSVBtn = document.getElementById("exportCSVBtn");
const exportPDFBtn = document.getElementById("exportPDFBtn");

/* ============================================================
   📊 Universal Summary Renderer
============================================================ */
function renderModuleSummary(summary = {}) {
  const container = document.getElementById("moduleSummary");
  if (!container) return;

  const colorMap = {
    active: "text-success",
    inactive: "text-muted",
    expired: "text-danger",
    quarantined: "text-warning",
    total_quantity: "text-primary",
    total_value: "text-teal",
    expired_count: "text-danger",
  };

  const keys = Object.keys(summary);
  if (!keys.length) {
    container.innerHTML = `<div class="text-muted small">No summary data</div>`;
    return;
  }

  container.innerHTML = `
    <div class="d-flex flex-wrap gap-3 justify-content-start align-items-center fw-semibold small mb-3">
      ${keys
        .map((key) => {
          const val = summary[key] ?? 0;
          const label = key.replace(/_/g, " ").toUpperCase();
          const color = colorMap[key] || "text-dark";
          return `<span class="${color}">${label}: ${val}</span>`;
        })
        .join('<span class="text-muted"> | </span>')}
    </div>
  `;
}

/* ============================================================
   🔁 Pagination / State
============================================================ */
let currentPage = 1;
let totalPages = 1;
let viewMode = localStorage.getItem("centralStockView") || "table";

// 🧩 Load saved user preference for records per page (default 25)
const savedLimit = parseInt(localStorage.getItem("centralStockPageLimit") || "25", 10);
let getPagination = initPaginationControl("central_stock", loadEntries, savedLimit);

/* ✅ Bind Records-Per-Page Dropdown if present */
const recordsPerPageSelect = document.getElementById("recordsPerPage");
if (recordsPerPageSelect) {
  // Apply saved limit
  recordsPerPageSelect.value = savedLimit;

  // Update pagination dynamically when changed
  recordsPerPageSelect.addEventListener("change", async () => {
    const newLimit = parseInt(recordsPerPageSelect.value, 10);
    localStorage.setItem("centralStockPageLimit", newLimit);
    getPagination = initPaginationControl("central_stock", loadEntries, newLimit);
    await loadEntries(1);
  });
}

/* ============================================================
   📋 Filters
============================================================ */
function getFilters() {
  return {
    organization_id: filterOrg?.value || "",
    facility_id: filterFacility?.value || "",
    master_item_id: filterItemHidden?.value || "",
    supplier_id: filterSupplier?.value || "",
    status: filterStatus?.value || "",
    batch_number: filterBatchNumber?.value || "",
    received_from: filterReceivedFrom?.value || "",
    received_to: filterReceivedTo?.value || "",
  };
}

/* ============================================================
   📦 Load Central Stocks (with Summary)
============================================================ */
async function loadEntries(page = 1) {
  try {
    showLoading();
    const filters = getFilters();
    const q = new URLSearchParams();
    const { page: safePage, limit: safeLimit } = getPagination(page);

    q.append("page", safePage);
    q.append("limit", safeLimit);

    if (filters.received_from) q.append("received_date[gte]", filters.received_from);
    if (filters.received_to) q.append("received_date[lte]", filters.received_to);

    Object.entries(filters).forEach(([k, v]) => {
      if (!v || ["received_from", "received_to"].includes(k)) return;
      q.append(k, v);
    });

    const safeFields = visibleFields.filter((f) =>
      FIELD_ORDER_CENTRAL_STOCK.includes(f)
    );
    if (safeFields.length) q.append("fields", safeFields.join(","));

    const res = await authFetch(`/api/central-stocks?${q.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    const result = await res.json().catch(() => ({}));
    const payload = result?.data || {};
    const records = Array.isArray(payload.records) ? payload.records : [];

    window.entries = records;
    currentPage = Number(payload.pagination?.page) || safePage;
    totalPages = Number(payload.pagination?.pageCount) || 1;

    renderList({ entries, visibleFields, viewMode, user, currentPage });
    if (payload.summary) renderModuleSummary(payload.summary);

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

    if (!records.length) showToast("ℹ️ No central stock entries found");
  } catch (err) {
    console.error("❌ loadEntries failed:", err);
    showToast("❌ Failed to load central stocks");
  } finally {
    hideLoading();
  }
}

/* ============================================================
   🧭 View Toggle
============================================================ */
document.getElementById("tableViewBtn").onclick = () => {
  viewMode = "table";
  localStorage.setItem("centralStockView", "table");
  renderList({ entries, visibleFields, viewMode, user, currentPage });
  document.getElementById("tableViewBtn")?.classList.add("active");
  document.getElementById("cardViewBtn")?.classList.remove("active");
};

document.getElementById("cardViewBtn").onclick = () => {
  viewMode = "card";
  localStorage.setItem("centralStockView", "card");
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
    filterItem,
    filterSupplier,
    filterStatus,
    filterBatchNumber,
    filterReceivedFrom,
    filterReceivedTo,
  ].forEach((el) => (el ? (el.value = "") : null));
  if (filterItemHidden) filterItemHidden.value = "";
  loadEntries(1);
};

/* ============================================================
   ⬇️ Export Tools
============================================================ */
if (exportCSVBtn)
  exportCSVBtn.onclick = () =>
    exportToExcel(entries, `central_stocks_${new Date().toISOString().slice(0, 10)}.xlsx`);

if (exportPDFBtn)
  exportPDFBtn.onclick = () => {
    try {
      const targetSelector =
        viewMode === "table" ? ".table-container" : "#centralStockList";
      const target = document.querySelector(targetSelector);
      if (!target) return showToast("⚠️ Nothing to export");

      const summaryHTML =
        document.getElementById("moduleSummary")?.outerHTML || "";
      const combinedHTML = `<div id="exportWrapper">${summaryHTML}${target.outerHTML}</div>`;

      const tempDiv = document.createElement("div");
      tempDiv.innerHTML = combinedHTML;
      document.body.appendChild(tempDiv);

      exportToPDF("Central Stock List", "#exportWrapper", "portrait", true);
      setTimeout(() => tempDiv.remove(), 1000);
    } catch (err) {
      console.error("❌ exportPDF failed:", err);
      showToast("❌ Failed to export PDF");
    }
  };

/* ============================================================
   🚀 Init Module
============================================================ */
export async function initCentralStockModule() {
  renderDynamicTableHead(visibleFields);

  const filterCollapse = document.getElementById("filterCollapse");
  const filterChevron = document.getElementById("filterChevron");

  const filterVisible = localStorage.getItem("centralStockFilterVisible") === "true";
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
    "centralStockFilterVisible"
  );

  setupSuggestionInputDynamic(
    filterItem,
    filterItemSuggestions,
    "/api/lite/master-items",
    (selected) => {
      filterItemHidden.value = selected?.id || "";
      filterItem.value = selected?.name || "";
    },
    "name"
  );

  try {
    if (userRole.includes("super")) {
      const orgs = await loadOrganizationsLite();
      orgs.unshift({ id: "", name: "-- All Organizations --" });
      setupSelectOptions(filterOrg, orgs, "id", "name");

      async function reloadFacilities(orgId = null) {
        const facs = await loadFacilitiesLite(orgId ? { organization_id: orgId } : {}, true);
        facs.unshift({ id: "", name: "-- All Facilities --" });
        setupSelectOptions(filterFacility, facs, "id", "name");
      }

      await reloadFacilities();
      filterOrg?.addEventListener("change", async () => {
        await reloadFacilities(filterOrg.value || null);
      });
    } else if (userRole.includes("admin")) {
      filterOrg?.closest(".form-group")?.classList.add("hidden");
      const facs = await loadFacilitiesLite({}, true);
      facs.unshift({ id: "", name: "-- All Facilities --" });
      setupSelectOptions(filterFacility, facs, "id", "name");
    } else {
      filterOrg?.closest(".form-group")?.classList.add("hidden");
      filterFacility?.closest(".form-group")?.classList.add("hidden");
    }

    const suppliers = await loadSuppliersLite({}, true);
    setupSelectOptions(filterSupplier, suppliers, "id", "name", "-- All Suppliers --");
  } catch (err) {
    console.error("❌ preload dropdowns failed:", err);
    showToast("❌ Failed to load filter dropdowns");
  }

  await loadEntries(1);
}

/* ============================================================
   🏁 Boot
============================================================ */
function boot() {
  initCentralStockModule().catch((err) =>
    console.error("initCentralStockModule failed:", err)
  );
}
if (document.readyState === "loading")
  document.addEventListener("DOMContentLoaded", boot);
else boot();
