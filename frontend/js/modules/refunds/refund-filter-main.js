// 📦 refund-filter-main.js – Enterprise Master Pattern Aligned
// ============================================================================
// 🔹 Mirrors deposit-filter-main.js for unified summary, export, and pagination
// 🔹 Includes Refund Summary (PDF/Excel-ready)
// 🔹 Handles role-aware org/facility filters, lifecycle-safe reload, and RBAC logic
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
  loadPaymentsLite,
  setupSelectOptions,
  setupSuggestionInputDynamic,
} from "../../utils/data-loaders.js";

import { renderFieldSelector } from "../../utils/ui-utils.js";
import { exportToExcel, exportToPDF } from "../../utils/export-utils.js";
import { renderList, renderDynamicTableHead } from "./refund-render.js";
import { setupActionHandlers } from "./refund-actions.js";
import {
  FIELD_ORDER_REFUND,
  FIELD_DEFAULTS_REFUND,
} from "./refund-constants.js";
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
  moduleKey: "refund",
  userRole,
  defaultFields: FIELD_DEFAULTS_REFUND,
  allowedFields: FIELD_ORDER_REFUND,
});

renderFieldSelector(
  {},
  visibleFields,
  (newFields) => {
    visibleFields = newFields;
    renderDynamicTableHead(visibleFields);
    renderList({ entries, visibleFields, viewMode, user, currentPage });
  },
  FIELD_ORDER_REFUND
);

/* ============================================================
   📊 Refund Summary Renderer (v2.4 – Nested Object Safe)
============================================================ */
function renderModuleSummary(summary = {}) {
  const container = document.getElementById("moduleSummary");
  if (!container) return;

  const colorMap = {
    pending: "text-warning",
    approved: "text-success",
    rejected: "text-danger",
    processed: "text-info",
    cancelled: "text-secondary",
    reversed: "text-dark",
    voided: "text-muted",
    total: "text-dark fw-bold",
  };

  const formatVal = (key, val) => {
    if (val == null) return 0;
    const lower = key.toLowerCase();

    const excludedExact = [
      "pending",
      "approved",
      "rejected",
      "processed",
      "cancelled",
      "reversed",
      "voided",
      "total_refunds",
      "count",
    ];

    const shouldFormatAsCurrency =
      !excludedExact.includes(lower) &&
      (/_amount/.test(lower) || /_balance/.test(lower) || /total/.test(lower));

    if (typeof val === "object") {
      // ✅ Handle nested object summaries gracefully
      if (key === "refund_summary") {
        const rs = val || {};
        const byMethod =
          rs.by_method &&
          Object.entries(rs.by_method)
            .filter(([_, v]) => v > 0)
            .map(([k, v]) => `${k}: $${v}`)
            .join(", ");
        return `
          <div class="small text-dark">
            Total: ${rs.total_refunds ?? 0} |
            Amount: $${(rs.total_refund_amount ?? 0).toFixed(2)} |
            Avg: $${(rs.average_refund_amount ?? 0).toFixed(2)} |
            By Method: ${byMethod || "-"}
          </div>
        `;
      }
      if (key === "gender_breakdown") {
        return Object.entries(val)
          .map(([g, c]) => `${g}: ${c}`)
          .join(", ");
      }
      // fallback for any generic object
      return JSON.stringify(val);
    }

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

  container.innerHTML = `
    <div class="d-flex flex-wrap gap-3 align-items-center small fw-semibold mb-2">
      ${keys
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
const filterPatient = document.getElementById("filterPatient");
const filterPatientHidden = document.getElementById("filterPatientId");
const filterPatientSuggestions = document.getElementById("filterPatientSuggestions");
const filterPayment = document.getElementById("filterPayment");
const filterPaymentHidden = document.getElementById("filterPaymentId");
const filterPaymentSuggestions = document.getElementById("filterPaymentSuggestions");
const filterMethod = document.getElementById("filterMethodSelect");
const filterStatus = document.getElementById("filterStatus");
const filterCreatedFrom = document.getElementById("filterCreatedFrom");
const filterCreatedTo = document.getElementById("filterCreatedTo");
const filterApproved = document.getElementById("filterApprovedBy");
const filterRejected = document.getElementById("filterRejectedBy");

const filterBtn = document.getElementById("filterBtn");
const resetFilterBtn = document.getElementById("resetFilterBtn");
const exportCSVBtn = document.getElementById("exportCSVBtn");
const exportPDFBtn = document.getElementById("exportPDFBtn");

/* ============================================================
   🔁 Pagination / State
============================================================ */
let currentPage = 1;
let totalPages = 1;
let viewMode = localStorage.getItem("refundView") || "table";

const savedLimit = parseInt(localStorage.getItem("refundPageLimit") || "25", 10);
let getPagination = initPaginationControl("refund", loadEntries, savedLimit);

const recordsPerPageSelect = document.getElementById("recordsPerPage");
if (recordsPerPageSelect) {
  recordsPerPageSelect.value = savedLimit;
  recordsPerPageSelect.addEventListener("change", async () => {
    const newLimit = parseInt(recordsPerPageSelect.value, 10);
    localStorage.setItem("refundPageLimit", newLimit);
    getPagination = initPaginationControl("refund", loadEntries, newLimit);
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
    patient_id: filterPatientHidden?.value || "",
    payment_id: filterPaymentHidden?.value || "",
    method: filterMethod?.value || "",
    status: filterStatus?.value || "",
    approved_by_id: filterApproved?.value || "",
    rejected_by_id: filterRejected?.value || "",
    created_from: filterCreatedFrom?.value || "",
    created_to: filterCreatedTo?.value || "",
  };
}

/* ============================================================
   🧹 Reset Filters
============================================================ */
function clearFilters() {
  [
    filterOrg,
    filterFacility,
    filterPatient,
    filterPatientHidden,
    filterPayment,
    filterPaymentHidden,
    filterMethod,
    filterStatus,
    filterApproved,
    filterRejected,
    filterCreatedFrom,
    filterCreatedTo,
  ].forEach((el) => el && (el.value = ""));
  if (filterPatientSuggestions) filterPatientSuggestions.innerHTML = "";
  if (filterPaymentSuggestions) filterPaymentSuggestions.innerHTML = "";
}

/* ============================================================
   📦 Load Refunds (with Summary)
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
      FIELD_ORDER_REFUND.includes(f)
    );
    if (safeFields.length) q.append("fields", safeFields.join(","));

    const res = await authFetch(`/api/refunds?${q.toString()}`, {
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
    showToast("❌ Failed to load refunds");
  } finally {
    hideLoading();
  }
}

/* ============================================================
   🔘 Filter Buttons Wiring (Fixed)
============================================================ */
if (filterBtn)
  filterBtn.addEventListener("click", async () => {
    if (filterPatientSuggestions) filterPatientSuggestions.innerHTML = "";
    if (filterPaymentSuggestions) filterPaymentSuggestions.innerHTML = "";
    await loadEntries(1); // 🔍 perform search
  });

if (resetFilterBtn)
  resetFilterBtn.addEventListener("click", async () => {
    clearFilters(); // 🧹 clear all
    await loadEntries(1); // reload unfiltered
  });

/* ============================================================
   🪟 View Toggle
============================================================ */
const cardViewBtn = document.getElementById("cardViewBtn");
const tableViewBtn = document.getElementById("tableViewBtn");

cardViewBtn?.addEventListener("click", () => {
  viewMode = "card";
  localStorage.setItem("refundView", "card");
  renderList({ entries, visibleFields, viewMode, user, currentPage });
});

tableViewBtn?.addEventListener("click", () => {
  viewMode = "table";
  localStorage.setItem("refundView", "table");
  renderList({ entries, visibleFields, viewMode, user, currentPage });
});

/* ============================================================
   ⬇️ Export Tools
============================================================ */
if (exportCSVBtn)
  exportCSVBtn.onclick = () =>
    exportToExcel(entries, `refunds_${new Date().toISOString().slice(0, 10)}.xlsx`);

if (exportPDFBtn)
  exportPDFBtn.onclick = () => {
    try {
      const targetSelector = viewMode === "table" ? ".table-container" : "#refundList";
      const target = document.querySelector(targetSelector);
      if (!target) return showToast("⚠️ Nothing to export");

      const summaryEl = document.getElementById("moduleSummary");
      const summaryHTML = summaryEl
        ? `<div class="export-summary mb-3 border rounded p-2 bg-light" style="font-size:11px; text-align:center;">
            <h5 class="fw-bold mb-2">Refund Summary</h5>
            ${summaryEl.innerHTML}
          </div>`
        : "";

      const combinedHTML = `<div id="exportWrapper">${summaryHTML}${target.outerHTML}</div>`;
      const tempDiv = document.createElement("div");
      tempDiv.innerHTML = combinedHTML;
      document.body.appendChild(tempDiv);

      exportToPDF("Refunds_Report", "#exportWrapper", "portrait", true);
      setTimeout(() => tempDiv.remove(), 1000);
    } catch (err) {
      console.error("❌ exportPDF failed:", err);
      showToast("❌ Failed to export PDF");
    }
  };

/* ============================================================
   🚀 Init Refund Module
============================================================ */
export async function initRefundModule() {
  renderDynamicTableHead(visibleFields);

  setupSelectOptions(filterMethod, [
    { value: "", label: "-- All Methods --" },
    { value: "cash", label: "Cash" },
    { value: "card", label: "Card" },
    { value: "mobile_money", label: "Mobile Money" },
    { value: "bank_transfer", label: "Bank Transfer" },
    { value: "cheque", label: "Cheque" },
  ], "value", "label");

  const filterCollapse = document.getElementById("filterCollapse");
  const filterChevron = document.getElementById("filterChevron");
  const filterVisible = localStorage.getItem("refundFilterVisible") === "true";

  if (filterVisible) {
    filterCollapse?.classList.remove("hidden");
    filterChevron?.classList.add("chevron-rotate");
  } else {
    filterCollapse?.classList.add("hidden");
    filterChevron?.classList.remove("chevron-rotate");
  }

  setupToggleSection("toggleFilterBtn", "filterCollapse", "filterChevron", "refundFilterVisible");

  setupSuggestionInputDynamic(
    filterPatient,
    filterPatientSuggestions,
    "/api/lite/patients",
    async (selected) => {
      filterPatientHidden.value = selected?.id || "";
      if (selected) {
        try {
          const payments = await loadPaymentsLite({ patient_id: selected.id });
          setupSelectOptions(filterPayment, payments, "id", "label", "-- Select Payment --");
        } catch {
          setupSelectOptions(filterPayment, [], "id", "label", "-- Select Payment --");
        }
      } else {
        setupSelectOptions(filterPayment, [], "id", "label", "-- Select Payment --");
        filterPaymentHidden.value = "";
      }
    },
    "label"
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
  initRefundModule().catch((err) =>
    console.error("initRefundModule failed:", err)
  );
}
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
else boot();
