// 📦 invoice-main.js – Filters + Table/Card (Enterprise Pattern Aligned)
// ============================================================================
// 🔹 Mirrors payment-filter-main.js for unified summary, export & pagination
// 🔹 Handles financial totals + role-aware org/facility filters
// 🔹 Includes PDF/Excel export with summary header
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
} from "../../../utils/index.js";

import { authFetch } from "../../../authSession.js";
import {
  loadOrganizationsLite,
  loadFacilitiesLite,
  loadPatientsLite,
  setupSelectOptions,
  setupSuggestionInputDynamic,
} from "../../../utils/data-loaders.js";

import { renderFieldSelector } from "../../../utils/ui-utils.js";
import { exportToExcel, exportToPDF } from "../../../utils/export-utils.js";
import { renderList, renderDynamicTableHead } from "./invoice-render.js";
import { setupActionHandlers } from "./invoice-actions.js";

import {
  FIELD_ORDER_INVOICE,
  FIELD_DEFAULTS_INVOICE,
} from "./invoice-constants.js";

import { setupVisibleFields } from "../../../utils/field-visibility.js";
import { initPaginationControl } from "../../../utils/pagination-control.js";

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
window.entries = [];
window.showForm = () => {};
window.resetForm = () => {};

/* ============================================================
   🧩 Field Visibility
============================================================ */
let visibleFields = setupVisibleFields({
  moduleKey: "invoice",
  userRole,
  defaultFields: FIELD_DEFAULTS_INVOICE,
  allowedFields: FIELD_ORDER_INVOICE,
});

renderFieldSelector(
  {},
  visibleFields,
  (newFields) => {
    visibleFields = newFields;
    renderDynamicTableHead(visibleFields);
    renderList({ entries, visibleFields, viewMode, user, currentPage });
  },
  FIELD_ORDER_INVOICE
);

/* ============================================================
   🧾 Summary Renderer (v2.3 – Financial + Count-Safe)
============================================================ */
function renderModuleSummary(summary = {}) {
  const container = document.getElementById("moduleSummary");
  if (!container) return;

  const colorMap = {
    draft: "text-muted",
    issued: "text-info",
    unpaid: "text-warning",
    partial: "text-primary",
    paid: "text-success",
    cancelled: "text-secondary",
    voided: "text-dark",
    total: "text-dark fw-bold",
  };

  const formatVal = (key, val) => {
    if (val == null) return 0;
    const lower = key.toLowerCase();

    const countFields = ["count", "total_invoices"];
    const isCount = countFields.some((k) => lower.includes(k));
    const isMoney =
      !isCount && /amount|balance|sum|value|total|paid|subtotal/.test(lower);

    if (isMoney && !isNaN(val)) {
      const num = parseFloat(val);
      return `$${num.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`;
    }
    if (!isNaN(val)) return parseFloat(val).toLocaleString();
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
   🔎 Filters + Controls
============================================================ */
const filterOrg = document.getElementById("filterOrganizationSelect");
const filterFacility = document.getElementById("filterFacilitySelect");
const filterPatient = document.getElementById("filterPatient");
const filterPatientHidden = document.getElementById("filterPatientId");
const filterPatientSuggestions = document.getElementById("filterPatientSuggestions");
const filterStatus = document.getElementById("filterStatus");
const filterCreatedFrom = document.getElementById("filterCreatedFrom");
const filterCreatedTo = document.getElementById("filterCreatedTo");

const filterBtn = document.getElementById("filterBtn");
const resetFilterBtn = document.getElementById("resetFilterBtn");
const exportCSVBtn = document.getElementById("exportCSVBtn");
const exportPDFBtn = document.getElementById("exportPDFBtn");

/* ============================================================
   🔁 Pagination + View State
============================================================ */
let currentPage = 1;
let totalPages = 1;
let viewMode = localStorage.getItem("invoiceView") || "table";

const savedLimit = parseInt(localStorage.getItem("invoicePageLimit") || "25", 10);
let getPagination = initPaginationControl("invoice", loadEntries, savedLimit);

const recordsPerPageSelect = document.getElementById("recordsPerPage");
if (recordsPerPageSelect) {
  recordsPerPageSelect.value = savedLimit;
  recordsPerPageSelect.addEventListener("change", async () => {
    const newLimit = parseInt(recordsPerPageSelect.value, 10);
    localStorage.setItem("invoicePageLimit", newLimit);
    getPagination = initPaginationControl("invoice", loadEntries, newLimit);
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
    status: filterStatus?.value || "",
    created_from: filterCreatedFrom?.value || "",
    created_to: filterCreatedTo?.value || "",
  };
}

/* ============================================================
   📦 Load Invoices (with Summary)
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
      FIELD_ORDER_INVOICE.includes(f)
    );
    if (safeFields.length) q.append("fields", safeFields.join(","));

    const res = await authFetch(`/api/invoices?${q.toString()}`, {
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
    showToast("❌ Failed to load invoices");
  } finally {
    hideLoading();
  }
}

/* ============================================================
   🔘 Filter Buttons
============================================================ */
if (filterBtn) filterBtn.onclick = async () => await loadEntries(1);
if (resetFilterBtn)
  resetFilterBtn.onclick = async () => {
    [
      filterOrg,
      filterFacility,
      filterPatient,
      filterPatientHidden,
      filterStatus,
      filterCreatedFrom,
      filterCreatedTo,
    ].forEach((el) => el && (el.value = ""));
    if (filterPatientSuggestions) filterPatientSuggestions.innerHTML = "";
    await loadEntries(1);
  };

/* ============================================================
   🪟 View Toggle
============================================================ */
const cardViewBtn = document.getElementById("cardViewBtn");
const tableViewBtn = document.getElementById("tableViewBtn");

cardViewBtn?.addEventListener("click", () => {
  viewMode = "card";
  localStorage.setItem("invoiceView", "card");
  renderList({ entries, visibleFields, viewMode, user, currentPage });
});

tableViewBtn?.addEventListener("click", () => {
  viewMode = "table";
  localStorage.setItem("invoiceView", "table");
  renderList({ entries, visibleFields, viewMode, user, currentPage });
});

/* ============================================================
   ⬇️ Export Tools (with Summary)
============================================================ */
if (exportCSVBtn)
  exportCSVBtn.onclick = () =>
    exportToExcel(entries, `invoices_${new Date().toISOString().slice(0, 10)}.xlsx`);

if (exportPDFBtn)
  exportPDFBtn.onclick = () => {
    try {
      const targetSelector = viewMode === "table" ? ".table-container" : "#invoiceList";
      const target = document.querySelector(targetSelector);
      if (!target) return showToast("⚠️ Nothing to export");

      const summaryEl = document.getElementById("moduleSummary");
      const summaryHTML = summaryEl
        ? `<div class="export-summary mb-3 border rounded p-2 bg-light" style="font-size:11px; text-align:center;">
            <h5 class="fw-bold mb-2">Invoice Summary</h5>
            ${summaryEl.innerHTML}
          </div>`
        : "";

      const combinedHTML = `<div id="exportWrapper">${summaryHTML}${target.outerHTML}</div>`;
      const tempDiv = document.createElement("div");
      tempDiv.innerHTML = combinedHTML;
      document.body.appendChild(tempDiv);

      exportToPDF("Invoices_Report", "#exportWrapper", "portrait", true);
      setTimeout(() => tempDiv.remove(), 1000);
    } catch (err) {
      console.error("❌ exportPDF failed:", err);
      showToast("❌ Failed to export PDF");
    }
  };

/* ============================================================
   🚀 Init Invoice Module (FULL – FIXED)
============================================================ */
export async function initInvoiceModule() {
  // ================================
  // 🧱 Table Head
  // ================================
  renderDynamicTableHead(visibleFields);

  // ================================
  // 🔽 Filter Toggle (Payments Pattern)
  // ================================
  const filterCollapse = document.getElementById("filterCollapse");
  const filterChevron = document.getElementById("filterChevron");

  const filterVisible = localStorage.getItem("invoiceFilterVisible") === "true";
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
    "invoiceFilterVisible"
  );

  // ================================
  // 🔎 Patient Suggestion Search
  // ================================
  setupSuggestionInputDynamic(
    filterPatient,
    filterPatientSuggestions,
    "/api/lite/patients",
    (selected) => {
      filterPatientHidden.value = selected?.id || "";
      filterPatient.value =
        selected?.label ||
        (selected?.pat_no && selected?.full_name
          ? `${selected.pat_no} - ${selected.full_name}`
          : selected?.full_name || selected?.pat_no || "");
    },
    "label"
  );

  // ================================
  // 🏢 Organization / Facility (FIXED)
  // ================================
  try {
    if (userRole.includes("super")) {
      // 🔹 Super Admin → Org + Facility
      const orgs = await loadOrganizationsLite();
      orgs.unshift({ id: "", name: "-- All Organizations --" });
      setupSelectOptions(filterOrg, orgs, "id", "name");

      async function reloadFacilities(orgId = null) {
        const facs = await loadFacilitiesLite(
          orgId ? { organization_id: orgId } : {},
          true
        );
        facs.unshift({ id: "", name: "-- All Facilities --" });
        setupSelectOptions(filterFacility, facs, "id", "name");
      }

      await reloadFacilities();

      filterOrg?.addEventListener("change", async () => {
        await reloadFacilities(filterOrg.value || null);
      });

    } else if (userRole.includes("admin")) {
      // 🔹 Admin → Facility only
      filterOrg?.closest(".col-md-3")?.classList.add("hidden");

      const facs = await loadFacilitiesLite({}, true);
      facs.unshift({ id: "", name: "-- All Facilities --" });
      setupSelectOptions(filterFacility, facs, "id", "name");

    } else {
      // 🔹 Staff → Hide both
      filterOrg?.closest(".col-md-3")?.classList.add("hidden");
      filterFacility?.closest(".col-md-3")?.classList.add("hidden");
    }
  } catch (err) {
    console.error("❌ preload org/fac failed:", err);
    showToast("❌ Failed to load organization/facility filters");
  }

  // ================================
  // 📦 Initial Load
  // ================================
  await loadEntries(1);
}

/* ============================================================
   🏁 Boot
============================================================ */
function boot() {
  initInvoiceModule().catch((err) => console.error("initInvoiceModule failed:", err));
}
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
else boot();
