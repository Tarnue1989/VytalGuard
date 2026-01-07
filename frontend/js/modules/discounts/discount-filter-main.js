// 📦 discount-filter-main.js – Filters + Table/Card (Enterprise Pattern Aligned)
// ============================================================================
// 🔹 Mirrors deposit-filter-main.js for unified summary, export, pagination
// 🔹 Includes Discount Summary (PDF/Excel-ready)
// 🔹 Handles role-aware org/facility filters and lifecycle-safe reload
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
  setupSelectOptions,
  setupSuggestionInputDynamic,
} from "../../utils/data-loaders.js";

import { renderFieldSelector } from "../../utils/ui-utils.js";
import { exportToExcel, exportToPDF } from "../../utils/export-utils.js";
import { renderList, renderDynamicTableHead } from "./discount-render.js";
import { setupActionHandlers } from "./discount-actions.js";
import {
  FIELD_ORDER_DISCOUNT,
  FIELD_DEFAULTS_DISCOUNT,
} from "./discount-constants.js";
import { setupVisibleFields } from "../../utils/field-visibility.js";
import { initPaginationControl } from "../../utils/pagination-control.js";

/* ============================================================
   🔐 Auth + Session
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
  moduleKey: "discount",
  userRole,
  defaultFields: FIELD_DEFAULTS_DISCOUNT,
  allowedFields: FIELD_ORDER_DISCOUNT,
});

renderFieldSelector(
  {},
  visibleFields,
  (newFields) => {
    visibleFields = newFields;
    renderDynamicTableHead(visibleFields);
    renderList({ entries, visibleFields, viewMode, user, currentPage });
  },
  FIELD_ORDER_DISCOUNT
);

/* ============================================================
   📊 Discount Summary Renderer (Enterprise Lifecycle-Aligned)
   ────────────────────────────────────────────────────────────
   ✅ Matches deposit summary structure & style
   ✅ Displays all lifecycle statuses
   ✅ Formats totals as plain numbers (no $)
   ✅ Currency formatting only for “value”, “amount”, “sum”
============================================================ */
function renderModuleSummary(summary = {}) {
  const container = document.getElementById("moduleSummary");
  if (!container) return;

  const colorMap = {
    draft: "text-warning",
    active: "text-info",
    inactive: "text-muted",
    finalized: "text-success",
    voided: "text-secondary",
    total: "text-dark fw-bold",
  };

  const formatVal = (key, val) => {
    if (val === null || val === undefined) return 0;

    // 🧩 Flatten nested summary objects gracefully
    if (typeof val === "object" && !Array.isArray(val)) {
      const parts = Object.entries(val)
        .map(([k, v]) => `${k}: ${v}`)
        .join(" / ");
      return parts || "—";
    }

    const lower = key.toLowerCase();

    // 🔒 Plain numeric totals (not $)
    const numericTotals = [
      "total_discounts",
      "total_records",
      "total_count",
      "count",
      "total"
    ];
    if (numericTotals.includes(lower) || lower.endsWith("_count")) {
      return parseInt(val, 10);
    }

    // 💰 Format amounts & values as currency
    const shouldFormatAsCurrency =
      /amount|value|sum|balance/.test(lower) && !/count|number/.test(lower);
    if (shouldFormatAsCurrency && !isNaN(val)) {
      const num = parseFloat(val);
      return `$${num.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`;
    }

    return val;
  };

  const keys = Object.keys(summary);
  if (!keys.length) {
    container.innerHTML = `<div class="text-muted small">No summary data</div>`;
    return;
  }

  // 🧠 Show lifecycle statuses + key totals only
  const keepKeys = keys.filter((k) =>
    /(draft|active|inactive|finalized|voided|total|sum|value|count)$/i.test(k)
  );

  container.innerHTML = `
    <div class="d-flex flex-wrap gap-3 align-items-center small fw-semibold mb-2">
      ${keepKeys
        .map((key) => {
          const val = formatVal(key, summary[key]);
          const label = key.replace(/_/g, " ").toUpperCase();
          const color = colorMap[key.toLowerCase()] || "text-dark";
          return `<span class="${color}">${label}: ${val}</span>`;
        })
        .join('<span class="text-muted"> | </span>')}
    </div>
  `;
}


/* ============================================================
   🔎 Filter DOM
============================================================ */
const filterOrg = document.getElementById("filterOrganizationSelect");
const filterFacility = document.getElementById("filterFacilitySelect");
const filterInvoice = document.getElementById("filterInvoice");
const filterInvoiceHidden = document.getElementById("filterInvoiceId");
const filterInvoiceSuggestions = document.getElementById("filterInvoiceSuggestions");

const filterType = document.getElementById("filterTypeSelect");
const filterStatus = document.getElementById("filterStatus");
const filterReason = document.getElementById("filterReason");
const filterCreatedFrom = document.getElementById("filterCreatedFrom");
const filterCreatedTo = document.getElementById("filterCreatedTo");

const filterFinalizedFrom = document.getElementById("filterFinalizedFrom");
const filterFinalizedTo = document.getElementById("filterFinalizedTo");
const filterVoidedFrom = document.getElementById("filterVoidedFrom");
const filterVoidedTo = document.getElementById("filterVoidedTo");

const filterFinalizedBy = document.getElementById("filterFinalizedBy");
const filterFinalizedByHidden = document.getElementById("filterFinalizedById");
const filterFinalizedBySuggestions = document.getElementById("filterFinalizedBySuggestions");
const filterVoidedBy = document.getElementById("filterVoidedBy");
const filterVoidedByHidden = document.getElementById("filterVoidedById");
const filterVoidedBySuggestions = document.getElementById("filterVoidedBySuggestions");

const filterBtn = document.getElementById("filterBtn");
const resetFilterBtn = document.getElementById("resetFilterBtn");
const exportCSVBtn = document.getElementById("exportCSVBtn");
const exportPDFBtn = document.getElementById("exportPDFBtn");

/* ============================================================
   🔁 Pagination / State
============================================================ */
let currentPage = 1;
let totalPages = 1;
let viewMode = localStorage.getItem("discountView") || "table";

const savedLimit = parseInt(localStorage.getItem("discountPageLimit") || "25", 10);
let getPagination = initPaginationControl("discount", loadEntries, savedLimit);

const recordsPerPageSelect = document.getElementById("recordsPerPage");
if (recordsPerPageSelect) {
  recordsPerPageSelect.value = savedLimit;
  recordsPerPageSelect.addEventListener("change", async () => {
    const newLimit = parseInt(recordsPerPageSelect.value, 10);
    localStorage.setItem("discountPageLimit", newLimit);
    getPagination = initPaginationControl("discount", loadEntries, newLimit);
    await loadEntries(1);
  });
}

/* ============================================================
   📋 Filters Builder
============================================================ */
function getFilters() {
  return {
    organization_id: filterOrg?.value || "",
    facility_id: filterFacility?.value || "",
    invoice_id: filterInvoiceHidden?.value || "",
    type: filterType?.value || "",
    status: filterStatus?.value || "",
    reason: filterReason?.value || "",
    created_from: filterCreatedFrom?.value || "",
    created_to: filterCreatedTo?.value || "",
    finalized_from: filterFinalizedFrom?.value || "",
    finalized_to: filterFinalizedTo?.value || "",
    voided_from: filterVoidedFrom?.value || "",
    voided_to: filterVoidedTo?.value || "",
    finalized_by_id: filterFinalizedByHidden?.value || "",
    voided_by_id: filterVoidedByHidden?.value || "",
  };
}

/* ============================================================
   📦 Load Discounts (with Summary)
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
    if (filters.finalized_from) q.append("finalized_at[gte]", filters.finalized_from);
    if (filters.finalized_to) q.append("finalized_at[lte]", filters.finalized_to);
    if (filters.voided_from) q.append("voided_at[gte]", filters.voided_from);
    if (filters.voided_to) q.append("voided_at[lte]", filters.voided_to);

    Object.entries(filters).forEach(([k, v]) => {
      if (!v || k.endsWith("_from") || k.endsWith("_to")) return;
      q.append(k, v);
    });

    const safeFields = visibleFields.filter((f) =>
      FIELD_ORDER_DISCOUNT.includes(f)
    );
    if (safeFields.length) q.append("fields", safeFields.join(","));

    const res = await authFetch(`/api/discounts?${q.toString()}`, {
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
  } catch (err) {
    console.error("❌ loadEntries failed:", err);
    showToast("❌ Failed to load discounts");
  } finally {
    hideLoading();
  }
}

/* ============================================================
   🔘 Filter Buttons Wiring (Fixed Search + Clear)
============================================================ */
function clearFilters() {
  [
    filterOrg,
    filterFacility,
    filterInvoice,
    filterInvoiceHidden,
    filterType,
    filterStatus,
    filterReason,
    filterCreatedFrom,
    filterCreatedTo,
    filterFinalizedFrom,
    filterFinalizedTo,
    filterVoidedFrom,
    filterVoidedTo,
    filterFinalizedBy,
    filterFinalizedByHidden,
    filterVoidedBy,
    filterVoidedByHidden,
  ].forEach((el) => {
    if (el) el.value = "";
  });

  if (filterInvoiceSuggestions) filterInvoiceSuggestions.innerHTML = "";
  if (filterFinalizedBySuggestions) filterFinalizedBySuggestions.innerHTML = "";
  if (filterVoidedBySuggestions) filterVoidedBySuggestions.innerHTML = "";
}

if (filterBtn) {
  filterBtn.addEventListener("click", async () => {
    await loadEntries(1);
  });
}

if (resetFilterBtn) {
  resetFilterBtn.addEventListener("click", async () => {
    clearFilters();
    await loadEntries(1);
  });
}

/* ============================================================
   🧭 View Toggle
============================================================ */
const cardViewBtn = document.getElementById("cardViewBtn");
const tableViewBtn = document.getElementById("tableViewBtn");

cardViewBtn?.addEventListener("click", () => {
  viewMode = "card";
  localStorage.setItem("discountView", "card");
  renderList({ entries, visibleFields, viewMode, user, currentPage });
});

tableViewBtn?.addEventListener("click", () => {
  viewMode = "table";
  localStorage.setItem("discountView", "table");
  renderList({ entries, visibleFields, viewMode, user, currentPage });
});

/* ============================================================
   ⬇️ Export Tools (with Summary)
============================================================ */
if (exportCSVBtn)
  exportCSVBtn.onclick = () =>
    exportToExcel(entries, `discounts_${new Date().toISOString().slice(0, 10)}.xlsx`);

if (exportPDFBtn)
  exportPDFBtn.onclick = () => {
    try {
      const targetSelector = viewMode === "table" ? ".table-container" : "#discountList";
      const target = document.querySelector(targetSelector);
      if (!target) return showToast("⚠️ Nothing to export");

      const summaryEl = document.getElementById("moduleSummary");
      const summaryHTML = summaryEl
        ? `<div class="export-summary mb-3 border rounded p-2 bg-light" style="font-size:11px; text-align:center;">
            <h5 class="fw-bold mb-2">Discount Summary</h5>
            ${summaryEl.innerHTML}
          </div>`
        : "";

      const combinedHTML = `<div id="exportWrapper">${summaryHTML}${target.outerHTML}</div>`;
      const tempDiv = document.createElement("div");
      tempDiv.innerHTML = combinedHTML;
      document.body.appendChild(tempDiv);

      exportToPDF("Discounts_Report", "#exportWrapper", "portrait", true);
      setTimeout(() => tempDiv.remove(), 1000);
    } catch (err) {
      console.error("❌ exportPDF failed:", err);
      showToast("❌ Failed to export PDF");
    }
  };

/* ============================================================
   🚀 Init Discount Module
============================================================ */
export async function initDiscountModule() {
  renderDynamicTableHead(visibleFields);
  setupToggleSection("toggleFilterBtn", "filterCollapse", "filterChevron", "discountFilterVisible");

  setupSuggestionInputDynamic(
    filterInvoice,
    filterInvoiceSuggestions,
    "/api/lite/invoices",
    (selected) => {
      filterInvoiceHidden.value = selected?.id || "";
      filterInvoice.value = selected
        ? `${selected.label || selected.invoice_number || ""}`
        : "";
    },
    "label"
  );

  if (filterFinalizedBy && filterFinalizedBySuggestions)
    setupSuggestionInputDynamic(filterFinalizedBy, filterFinalizedBySuggestions, "/api/lite/users",
      (s) => {
        filterFinalizedByHidden.value = s?.id || "";
        filterFinalizedBy.value = s ? `${s.first_name || ""} ${s.last_name || ""}` : "";
      }, "first_name"
    );

  if (filterVoidedBy && filterVoidedBySuggestions)
    setupSuggestionInputDynamic(filterVoidedBy, filterVoidedBySuggestions, "/api/lite/users",
      (s) => {
        filterVoidedByHidden.value = s?.id || "";
        filterVoidedBy.value = s ? `${s.first_name || ""} ${s.last_name || ""}` : "";
      }, "first_name"
    );

  try {
    const orgs = await loadOrganizationsLite();
    if (userRole.includes("super")) {
      orgs.unshift({ id: "", name: "-- All Organizations --" });
      setupSelectOptions(filterOrg, orgs, "id", "name");

      let facilities = await loadFacilitiesLite();
      facilities.unshift({ id: "", name: "-- All Facilities --" });
      setupSelectOptions(filterFacility, facilities, "id", "name");

      filterOrg?.addEventListener("change", async () => {
        const selectedOrgId = filterOrg.value;
        let facs = selectedOrgId
          ? await loadFacilitiesLite({ organization_id: selectedOrgId })
          : await loadFacilitiesLite();
        facs.unshift({ id: "", name: "-- All Facilities --" });
        setupSelectOptions(filterFacility, facs, "id", "name");
      });
    } else {
      const scopedOrgId = localStorage.getItem("organizationId");
      const scopedFacId = localStorage.getItem("facilityId");
      if (filterOrg) {
        const scopedOrg = orgs.find((o) => o.id === scopedOrgId);
        setupSelectOptions(filterOrg, scopedOrg ? [scopedOrg] : [], "id", "name");
        filterOrg.disabled = true;
        filterOrg.value = scopedOrgId || "";
      }
      const facilities = scopedOrgId
        ? await loadFacilitiesLite({ organization_id: scopedOrgId })
        : [];
      setupSelectOptions(filterFacility, facilities, "id", "name", "-- All Facilities --");
      if (scopedFacId) filterFacility.value = scopedFacId;
    }
  } catch (err) {
    console.error("❌ preload org/facility failed:", err);
  }

  await loadEntries(1);
}

/* ============================================================
   🏁 Boot
============================================================ */
function boot() {
  initDiscountModule().catch((err) => console.error("initDiscountModule failed:", err));
}
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
else boot();
