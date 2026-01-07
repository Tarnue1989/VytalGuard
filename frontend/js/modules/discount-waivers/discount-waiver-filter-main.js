// 📦 discount-waiver-filter-main.js – Enterprise Master Pattern Aligned
// ============================================================================
// 🔹 Mirrors discount-filter-main.js for unified summary, pagination, and export
// 🔹 Adds lifecycle-safe loading, role-based filters, and enterprise summary
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
import { renderList, renderDynamicTableHead } from "./discount-waiver-render.js";
import { setupActionHandlers } from "./discount-waiver-actions.js";
import {
  FIELD_ORDER_DISCOUNT_WAIVER,
  FIELD_DEFAULTS_DISCOUNT_WAIVER,
} from "./discount-waiver-constants.js";
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
  moduleKey: "discount-waiver",
  userRole,
  defaultFields: FIELD_DEFAULTS_DISCOUNT_WAIVER,
  allowedFields: FIELD_ORDER_DISCOUNT_WAIVER,
});

renderFieldSelector(
  {},
  visibleFields,
  (newFields) => {
    visibleFields = newFields;
    renderDynamicTableHead(visibleFields);
    renderList({ entries, visibleFields, viewMode, user, currentPage });
  },
  FIELD_ORDER_DISCOUNT_WAIVER
);

/* ============================================================
   📊 Discount Waiver Summary Renderer
============================================================ */
function renderModuleSummary(summary = {}) {
  const container = document.getElementById("moduleSummary");
  if (!container) return;

  const colorMap = {
    pending: "text-warning",
    approved: "text-success",
    rejected: "text-danger",
    voided: "text-secondary",
    finalized: "text-primary",
    total: "text-dark fw-bold",
  };

  const formatVal = (key, val) => {
    if (val == null) return 0;
    const lower = key.toLowerCase();

    // Numeric-only totals
    const countKeys = ["count", "total_records", "total_waivers"];
    if (countKeys.some((k) => lower.includes(k))) return parseInt(val, 10);

    // Currency formatting
    const shouldCurrency =
      /amount|value|sum|balance|applied_total/.test(lower) && !/count/.test(lower);
    if (shouldCurrency && !isNaN(val))
      return `$${parseFloat(val).toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`;

    return val;
  };

  const keys = Object.keys(summary);
  if (!keys.length) {
    container.innerHTML = `<div class="text-muted small">No summary data</div>`;
    return;
  }

  const keepKeys = keys.filter((k) =>
    /(pending|approved|rejected|voided|finalized|total|sum|value|count)$/i.test(k)
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
    </div>`;
}

/* ============================================================
   🔎 Filter DOM
============================================================ */
const filterOrg = document.getElementById("filterOrganizationSelect");
const filterFacility = document.getElementById("filterFacilitySelect");

const filterInvoice = document.getElementById("filterInvoice");
const filterInvoiceHidden = document.getElementById("filterInvoiceId");
const filterPatient = document.getElementById("filterPatient");
const filterReason = document.getElementById("filterReason");
const filterType = document.getElementById("filterTypeSelect");
const filterStatus = document.getElementById("filterStatus");

// Lifecycle
const filterApprovedFrom = document.getElementById("filterApprovedFrom");
const filterApprovedTo = document.getElementById("filterApprovedTo");
const filterRejectedFrom = document.getElementById("filterRejectedFrom");
const filterRejectedTo = document.getElementById("filterRejectedTo");
const filterVoidedFrom = document.getElementById("filterVoidedFrom");
const filterVoidedTo = document.getElementById("filterVoidedTo");
const filterFinalizedFrom = document.getElementById("filterFinalizedFrom");
const filterFinalizedTo = document.getElementById("filterFinalizedTo");

const filterApprovedBy = document.getElementById("filterApprovedBy");
const filterApprovedByHidden = document.getElementById("filterApprovedById");
const filterApprovedBySuggestions = document.getElementById("filterApprovedBySuggestions");

const filterRejectedBy = document.getElementById("filterRejectedBy");
const filterRejectedByHidden = document.getElementById("filterRejectedById");
const filterRejectedBySuggestions = document.getElementById("filterRejectedBySuggestions");

const filterVoidedBy = document.getElementById("filterVoidedBy");
const filterVoidedByHidden = document.getElementById("filterVoidedById");
const filterVoidedBySuggestions = document.getElementById("filterVoidedBySuggestions");

const filterFinalizedBy = document.getElementById("filterFinalizedBy");
const filterFinalizedByHidden = document.getElementById("filterFinalizedById");
const filterFinalizedBySuggestions = document.getElementById("filterFinalizedBySuggestions");

const filterBtn = document.getElementById("filterBtn");
const resetFilterBtn = document.getElementById("resetFilterBtn");
const exportCSVBtn = document.getElementById("exportCSVBtn");
const exportPDFBtn = document.getElementById("exportPDFBtn");

/* ============================================================
   🔁 Pagination / State
============================================================ */
let currentPage = 1;
let totalPages = 1;
let viewMode = localStorage.getItem("discountWaiverView") || "table";

const savedLimit = parseInt(localStorage.getItem("discountWaiverPageLimit") || "25", 10);
let getPagination = initPaginationControl("discount-waiver", loadEntries, savedLimit);

const recordsPerPageSelect = document.getElementById("recordsPerPage");
if (recordsPerPageSelect) {
  recordsPerPageSelect.value = savedLimit;
  recordsPerPageSelect.addEventListener("change", async () => {
    const newLimit = parseInt(recordsPerPageSelect.value, 10);
    localStorage.setItem("discountWaiverPageLimit", newLimit);
    getPagination = initPaginationControl("discount-waiver", loadEntries, newLimit);
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
    patient_id: filterPatient?.dataset?.selectedId || "",
    reason: filterReason?.value || "",
    type: filterType?.value || "",
    status: filterStatus?.value || "",
    approved_from: filterApprovedFrom?.value || "",
    approved_to: filterApprovedTo?.value || "",
    rejected_from: filterRejectedFrom?.value || "",
    rejected_to: filterRejectedTo?.value || "",
    voided_from: filterVoidedFrom?.value || "",
    voided_to: filterVoidedTo?.value || "",
    finalized_from: filterFinalizedFrom?.value || "",
    finalized_to: filterFinalizedTo?.value || "",
    approved_by_id: filterApprovedByHidden?.value || "",
    rejected_by_id: filterRejectedByHidden?.value || "",
    voided_by_id: filterVoidedByHidden?.value || "",
    finalized_by_id: filterFinalizedByHidden?.value || "",
  };
}

/* ============================================================
   📦 Load Discount Waivers (with Summary)
============================================================ */
async function loadEntries(page = 1) {
  try {
    showLoading();
    const filters = getFilters();
    const q = new URLSearchParams();
    const { page: safePage, limit: safeLimit } = getPagination(page);

    q.append("page", safePage);
    q.append("limit", safeLimit);

    // handle date ranges
    ["approved", "rejected", "voided", "finalized"].forEach((k) => {
      if (filters[`${k}_from`]) q.append(`${k}_at[gte]`, filters[`${k}_from`]);
      if (filters[`${k}_to`]) q.append(`${k}_at[lte]`, filters[`${k}_to`]);
    });

    Object.entries(filters).forEach(([k, v]) => {
      if (!v || k.endsWith("_from") || k.endsWith("_to")) return;
      q.append(k, v);
    });

    const safeFields = visibleFields.filter((f) => FIELD_ORDER_DISCOUNT_WAIVER.includes(f));
    if (safeFields.length) q.append("fields", safeFields.join(","));

    const res = await authFetch(`/api/discount-waivers?${q.toString()}`, {
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
    showToast("❌ Failed to load discount waivers");
  } finally {
    hideLoading();
  }
}

/* ============================================================
   🔘 Filter Buttons
============================================================ */
function clearFilters() {
  [
    filterInvoice,
    filterInvoiceHidden,
    filterPatient,
    filterReason,
    filterType,
    filterStatus,
    filterApprovedFrom,
    filterApprovedTo,
    filterRejectedFrom,
    filterRejectedTo,
    filterVoidedFrom,
    filterVoidedTo,
    filterFinalizedFrom,
    filterFinalizedTo,
    filterApprovedBy,
    filterApprovedByHidden,
    filterRejectedBy,
    filterRejectedByHidden,
    filterVoidedBy,
    filterVoidedByHidden,
    filterFinalizedBy,
    filterFinalizedByHidden,
  ].forEach((el) => el && (el.value = ""));
}

filterBtn?.addEventListener("click", async () => await loadEntries(1));
resetFilterBtn?.addEventListener("click", async () => {
  clearFilters();
  await loadEntries(1);
});

/* ============================================================
   🧭 View Toggle
============================================================ */
const cardViewBtn = document.getElementById("cardViewBtn");
const tableViewBtn = document.getElementById("tableViewBtn");

cardViewBtn?.addEventListener("click", () => {
  viewMode = "card";
  localStorage.setItem("discountWaiverView", "card");
  renderList({ entries, visibleFields, viewMode, user, currentPage });
});

tableViewBtn?.addEventListener("click", () => {
  viewMode = "table";
  localStorage.setItem("discountWaiverView", "table");
  renderList({ entries, visibleFields, viewMode, user, currentPage });
});

/* ============================================================
   ⬇️ Export Tools
============================================================ */
if (exportCSVBtn)
  exportCSVBtn.onclick = () =>
    exportToExcel(entries, `discount_waivers_${new Date().toISOString().slice(0, 10)}.xlsx`);

if (exportPDFBtn)
  exportPDFBtn.onclick = () => {
    try {
      const targetSelector = viewMode === "table" ? ".table-container" : "#discountWaiverList";
      const target = document.querySelector(targetSelector);
      if (!target) return showToast("⚠️ Nothing to export");

      const summaryEl = document.getElementById("moduleSummary");
      const summaryHTML = summaryEl
        ? `<div class="export-summary mb-3 border rounded p-2 bg-light" style="font-size:11px; text-align:center;">
            <h5 class="fw-bold mb-2">Discount Waiver Summary</h5>
            ${summaryEl.innerHTML}
          </div>`
        : "";

      const combinedHTML = `<div id="exportWrapper">${summaryHTML}${target.outerHTML}</div>`;
      const tempDiv = document.createElement("div");
      tempDiv.innerHTML = combinedHTML;
      document.body.appendChild(tempDiv);

      exportToPDF("Discount_Waivers_Report", "#exportWrapper", "portrait", true);
      setTimeout(() => tempDiv.remove(), 1000);
    } catch (err) {
      console.error("❌ exportPDF failed:", err);
      showToast("❌ Failed to export PDF");
    }
  };

/* ============================================================
   🚀 Init Discount Waiver Module
============================================================ */
export async function initDiscountWaiverModule() {
  renderDynamicTableHead(visibleFields);
  setupToggleSection(
    "toggleFilterBtn",
    "filterCollapse",
    "filterChevron",
    "discountWaiverFilterVisible"
  );

  // ✅ Invoice suggestions
  setupSuggestionInputDynamic(
    filterInvoice,
    document.getElementById("filterInvoiceSuggestions"),
    "/api/lite/invoices",
    (selected) => {
      filterInvoiceHidden.value = selected?.id || "";
      filterInvoice.value = selected?.invoice_number || "";
    },
    "label"
  );

  // ✅ User suggestions for lifecycle (deferred to ensure DOM ready)
  const setupUserSuggest = (input, hidden, sugId) => {
    const sugEl = document.getElementById(sugId);
    if (!input || !sugEl) return; // guard if not yet available
    setupSuggestionInputDynamic(
      input,
      sugEl,
      "/api/lite/users",
      (s) => {
        hidden.value = s?.id || "";
        input.value = s ? `${s.first_name || ""} ${s.last_name || ""}` : "";
      },
      "first_name"
    );
  };

  // Delay binding slightly to avoid DOM race
  setTimeout(() => {
    setupUserSuggest(filterApprovedBy, filterApprovedByHidden, "filterApprovedBySuggestions");
    setupUserSuggest(filterRejectedBy, filterRejectedByHidden, "filterRejectedBySuggestions");
    setupUserSuggest(filterVoidedBy, filterVoidedByHidden, "filterVoidedBySuggestions");
    setupUserSuggest(filterFinalizedBy, filterFinalizedByHidden, "filterFinalizedBySuggestions");
  }, 100);

  // ✅ preload org + facilities
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
  initDiscountWaiverModule().catch((err) =>
    console.error("initDiscountWaiverModule failed:", err)
  );
}
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
else boot();
