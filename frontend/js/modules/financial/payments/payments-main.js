// 📦 payments-main.js – Filters + Table/Card (Enterprise Pattern Aligned)
// ============================================================================
// 🔹 Unified with invoice & deposit modules (v2.3)
// 🔹 Includes summary, pagination, export, and role-aware org/facility filters
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
} from "../../../../js/utils/index.js";

import { authFetch } from "../../../../js/authSession.js";
import {
  loadOrganizationsLite,
  loadFacilitiesLite,
  loadPatientsLite,
  setupSelectOptions,
  setupSuggestionInputDynamic,
} from "../../../../js/utils/data-loaders.js";

import { renderFieldSelector } from "../../../../js/utils/ui-utils.js";
import { exportToExcel, exportToPDF } from "../../../../js/utils/export-utils.js";
import { renderPaymentList, renderDynamicPaymentHead } from "./payments-render.js";
import { setupPaymentActionHandlers } from "./payments-actions.js";
import { FIELD_ORDER_PAYMENT, FIELD_DEFAULTS_PAYMENT } from "./payments-constants.js";
import { setupVisibleFields } from "../../../../js/utils/field-visibility.js";
import { initPaginationControl } from "../../../../js/utils/pagination-control.js";

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
window.paymentEntries = [];
window.showForm = () => {};
window.resetForm = () => {};

/* ============================================================
   🧩 Field Visibility
============================================================ */
let visibleFields = setupVisibleFields({
  moduleKey: "payment",
  userRole,
  defaultFields: FIELD_DEFAULTS_PAYMENT,
  allowedFields: FIELD_ORDER_PAYMENT,
});

renderFieldSelector(
  {},
  visibleFields,
  (newFields) => {
    visibleFields = newFields;
    renderDynamicPaymentHead(visibleFields);
    renderPaymentList({
      entries: paymentEntries,
      visibleFields,
      viewMode,
      user,
      currentPage,
    });
  },
  FIELD_ORDER_PAYMENT
);

/* ============================================================
   💳 Payment Summary Renderer (v2.3)
============================================================ */
function renderModuleSummary(summary = {}) {
  const container = document.getElementById("moduleSummary");
  if (!container) return;

  const colorMap = {
    pending: "text-warning",
    completed: "text-success",
    failed: "text-danger",
    cancelled: "text-secondary",
    reversed: "text-dark",
    total: "text-dark fw-bold",
  };

  const formatVal = (key, val) => {
    if (val == null) return 0;
    const lower = key.toLowerCase();

    const countKeys = ["count", "total_records", "total_payments"];
    const isCount = countKeys.some((k) => lower.includes(k));
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
let viewMode = localStorage.getItem("paymentView") || "table";

const savedLimit = parseInt(localStorage.getItem("paymentPageLimit") || "25", 10);
let getPagination = initPaginationControl("payment", loadEntries, savedLimit);

const recordsPerPageSelect = document.getElementById("recordsPerPage");
if (recordsPerPageSelect) {
  recordsPerPageSelect.value = savedLimit;
  recordsPerPageSelect.addEventListener("change", async () => {
    const newLimit = parseInt(recordsPerPageSelect.value, 10);
    localStorage.setItem("paymentPageLimit", newLimit);
    getPagination = initPaginationControl("payment", loadEntries, newLimit);
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
   📦 Load Payments (with Summary)
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
      FIELD_ORDER_PAYMENT.includes(f)
    );
    if (safeFields.length) q.append("fields", safeFields.join(","));

    const res = await authFetch(`/api/payments?${q.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    const result = await res.json().catch(() => ({}));
    const payload = result?.data || {};
    const records = Array.isArray(payload.records) ? payload.records : [];

    window.paymentEntries = records;
    currentPage = Number(payload.pagination?.page) || safePage;
    totalPages = Number(payload.pagination?.pageCount) || 1;

    renderPaymentList({ entries: paymentEntries, visibleFields, viewMode, user, currentPage });
    if (payload.summary) renderModuleSummary(payload.summary);

    setupPaymentActionHandlers({
      entries: paymentEntries,
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
    showToast("❌ Failed to load payments");
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
  localStorage.setItem("paymentView", "card");
  renderPaymentList({ entries: paymentEntries, visibleFields, viewMode, user, currentPage });
});

tableViewBtn?.addEventListener("click", () => {
  viewMode = "table";
  localStorage.setItem("paymentView", "table");
  renderPaymentList({ entries: paymentEntries, visibleFields, viewMode, user, currentPage });
});

/* ============================================================
   ⬇️ Export Tools (with Summary)
============================================================ */
if (exportCSVBtn)
  exportCSVBtn.onclick = () =>
    exportToExcel(paymentEntries, `payments_${new Date().toISOString().slice(0, 10)}.xlsx`);

if (exportPDFBtn)
  exportPDFBtn.onclick = () => {
    try {
      const targetSelector =
        viewMode === "table" ? ".table-container" : "#paymentList";
      const target = document.querySelector(targetSelector);
      if (!target) return showToast("⚠️ Nothing to export");

      const summaryEl = document.getElementById("moduleSummary");
      const summaryHTML = summaryEl
        ? `<div class="export-summary mb-3 border rounded p-2 bg-light" style="font-size:11px; text-align:center;">
            <h5 class="fw-bold mb-2">Payment Summary</h5>
            ${summaryEl.innerHTML}
          </div>`
        : "";

      const combinedHTML = `<div id="exportWrapper">${summaryHTML}${target.outerHTML}</div>`;
      const tempDiv = document.createElement("div");
      tempDiv.innerHTML = combinedHTML;
      document.body.appendChild(tempDiv);

      exportToPDF("Payments_Report", "#exportWrapper", "portrait", true);
      setTimeout(() => tempDiv.remove(), 1000);
    } catch (err) {
      console.error("❌ exportPDF failed:", err);
      showToast("❌ Failed to export PDF");
    }
  };

/* ============================================================
   🚀 Init Payment Module
============================================================ */
export async function initPaymentModule() {
  renderDynamicPaymentHead(visibleFields);

  const filterCollapse = document.getElementById("filterCollapse");
  const filterChevron = document.getElementById("filterChevron");

  const filterVisible = localStorage.getItem("paymentFilterVisible") === "true";
  if (filterVisible) {
    filterCollapse?.classList.remove("hidden");
    filterChevron?.classList.add("chevron-rotate");
  } else {
    filterCollapse?.classList.add("hidden");
    filterChevron?.classList.remove("chevron-rotate");
  }

  setupToggleSection("toggleFilterBtn", "filterCollapse", "filterChevron", "paymentFilterVisible");

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
  initPaymentModule().catch((err) => console.error("initPaymentModule failed:", err));
}
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
else boot();
