// 📦 pharmacy-transaction-filter-main.js – Enterprise Master Pattern Aligned
// ============================================================================
// 🔹 Mirrors payment-filter-main.js for unified summary, export & pagination
// 🔹 Includes Pharmacy Transaction Summary (PDF/Excel-ready)
// 🔹 Handles role-aware org/facility filters, pagination, and lifecycle-safe reload
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
  loadDepartmentsLite,
  loadPatientsLite,
  loadEmployeesLite,
  loadRegistrationLogsLite,
  loadConsultationsLite,
  loadMasterItemsLite,
  setupSelectOptions,
  setupSuggestionInputDynamic,
} from "../../utils/data-loaders.js";

import { renderFieldSelector } from "../../utils/ui-utils.js";
import { exportToExcel, exportToPDF } from "../../utils/export-utils.js";
import { renderList, renderDynamicTableHead } from "./pharmacy-transaction-render.js";
import {
  renderPharmacySummaryTable,
  setVisibleSummaryFields,
} from "./pharmacy-transaction-render.js";

import { setupActionHandlers } from "./pharmacy-transaction-actions.js";
// 📦 Pharmacy Transaction Constants
import {
  FIELD_LABELS_PHARMACY_TRANSACTION,
  FIELD_ORDER_PHARMACY_TRANSACTION,
  FIELD_DEFAULTS_PHARMACY_TRANSACTION,
  FIELD_LABELS_PHARMACY_SUMMARY,
  FIELD_ORDER_PHARMACY_SUMMARY,
  FIELD_DEFAULTS_PHARMACY_SUMMARY,
} from "./pharmacy-transaction-constants.js";

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
   🧩 Field Visibility (Main Table / Card)
============================================================ */
let visibleFields = setupVisibleFields({
  moduleKey: "pharmacy_transaction",
  userRole,
  defaultFields: FIELD_DEFAULTS_PHARMACY_TRANSACTION,
  allowedFields: FIELD_ORDER_PHARMACY_TRANSACTION,
});

renderFieldSelector(
  {},
  visibleFields,
  (newFields) => {
    visibleFields = newFields;
    renderDynamicTableHead(visibleFields);
    renderList({ entries, visibleFields, viewMode, user, currentPage });
  },
  FIELD_ORDER_PHARMACY_TRANSACTION,
  FIELD_LABELS_PHARMACY_TRANSACTION,     // ✅ add labels
  "fieldSelectorDropdown"                // ✅ targetId for main selector
);

/* ============================================================
   💊 SUMMARY FIELD VISIBILITY (Dynamic Header)
============================================================ */
let visibleSummaryFields = setupVisibleFields({
  moduleKey: "pharmacy_summary",
  userRole,
  defaultFields: FIELD_DEFAULTS_PHARMACY_SUMMARY,
  allowedFields: FIELD_ORDER_PHARMACY_SUMMARY,
});

// 🧭 Create the summary field selector UI (⚙️ dropdown)
renderFieldSelector(
  {},
  visibleSummaryFields,
  (newFields) => {
    visibleSummaryFields = newFields;
    setVisibleSummaryFields(newFields);
    renderPharmacySummaryTable(window.summaryData || []);
  },
  FIELD_ORDER_PHARMACY_SUMMARY,
  FIELD_LABELS_PHARMACY_SUMMARY,         // ✅ add labels
  "summaryFieldSelectorDropdown"         // ✅ targetId for summary selector
);


/* ============================================================
   💊 Pharmacy Transaction Summary Renderer (KPI + Badges)
============================================================ */
function renderModuleSummary(summary = {}) {
  const container = document.getElementById("moduleSummary");
  if (!container || !summary || !Object.keys(summary).length) return;

  // --- Resolve flat summary (supports nested pharmacy_summary) ---
  const flat = summary.pharmacy_summary
    ? { ...summary, ...summary.pharmacy_summary }
    : { ...summary };

  // --- Helpers ---
  const formatDate = (val) => {
    if (!val) return "—";
    const d = new Date(val);
    return isNaN(d)
      ? val
      : d.toLocaleString(undefined, {
          year: "numeric",
          month: "short",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
          hour12: true,
        });
  };

  const num = (v) => (isNaN(v) || v == null ? 0 : Number(v));

  // --- KPI ROW ---
  document.getElementById("summaryKpis").innerHTML = `
    <div class="col">
      <div class="fw-bold fs-5">${num(flat.total_transactions)}</div>
      <div class="text-muted small">Transactions</div>
    </div>
    <div class="col">
      <div class="fw-bold fs-5">${num(flat.total_quantity)}</div>
      <div class="text-muted small">Total Qty</div>
    </div>
    <div class="col text-success">
      <div class="fw-bold fs-5">${num(flat.total_dispensed)}</div>
      <div class="text-muted small">Dispensed</div>
    </div>
    <div class="col text-danger">
      <div class="fw-bold fs-5">${num(flat.total_returned)}</div>
      <div class="text-muted small">Returned</div>
    </div>
  `;

  // --- STATUS BADGES ---
  document.getElementById("summaryStatuses").innerHTML = `
    <span class="badge bg-warning">Pending: ${num(flat.pending)}</span>
    <span class="badge bg-success">Dispensed: ${num(flat.dispensed)}</span>
    <span class="badge bg-info">Partial: ${num(flat.partially_dispensed)}</span>
    <span class="badge bg-danger">Returned: ${num(flat.returned)}</span>
    <span class="badge bg-secondary">Cancelled: ${num(flat.cancelled)}</span>
    <span class="badge bg-dark">Voided: ${num(flat.voided)}</span>
    <span class="badge bg-success">Verified: ${num(flat.verified)}</span>
  `;

  // --- METRICS ---
  const genderText =
    typeof flat.gender_breakdown === "object"
      ? Object.entries(flat.gender_breakdown)
          .map(([k, v]) => `${k}: ${v}`)
          .join(", ")
      : "—";

  document.getElementById("summaryMetrics").innerHTML = `
    <div>🕒 Last Fulfillment: <strong>${formatDate(flat.last_fulfillment_date)}</strong></div>
    <div>🚨 Emergency: <strong>${num(flat.emergency_count)}</strong></div>
    <div>📈 Dispense Rate: <strong>${num(flat.dispense_rate)}%</strong></div>
    <div>👤 Gender: <strong>${genderText}</strong></div>
  `;
}


/* ============================================================
   🔎 Filter DOM
============================================================ */
const filterOrg = document.getElementById("filterOrg");
const filterFacility = document.getElementById("filterFacility");
const filterDept = document.getElementById("filterDept");
const filterPatient = document.getElementById("filterPatient");
const filterDoctor = document.getElementById("filterDoctor");
const filterFulfilledBy = document.getElementById("filterFulfilledBy");
const filterConsultation = document.getElementById("filterConsultation");
const filterRegLog = document.getElementById("filterRegLog");
const filterMedication = document.getElementById("filterMedication");
const filterStatus = document.getElementById("filterStatus");
const filterType = document.getElementById("filterType");
const filterEmergency = document.getElementById("filterEmergency");
const filterDateFrom = document.getElementById("filterDateFrom");
const filterDateTo = document.getElementById("filterDateTo");

const filterBtn = document.getElementById("filterBtn");
const resetFilterBtn = document.getElementById("resetFilterBtn");
const exportCSVBtn = document.getElementById("exportCSVBtn");
const exportPDFBtn = document.getElementById("exportPDFBtn");

/* ============================================================
   🔁 Pagination / State
============================================================ */
let currentPage = 1;
let totalPages = 1;
let viewMode = localStorage.getItem("pharmacyTransactionView") || "table";

const savedLimit = parseInt(localStorage.getItem("pharmacyTransactionPageLimit") || "25", 10);
let getPagination = initPaginationControl("pharmacyTransaction", loadEntries, savedLimit);

const recordsPerPageSelect = document.getElementById("recordsPerPage");
if (recordsPerPageSelect) {
  recordsPerPageSelect.value = savedLimit;
  recordsPerPageSelect.addEventListener("change", async () => {
    const newLimit = parseInt(recordsPerPageSelect.value, 10);
    localStorage.setItem("pharmacyTransactionPageLimit", newLimit);
    getPagination = initPaginationControl("pharmacyTransaction", loadEntries, newLimit);
    await loadEntries(1);
  });
}

/* ============================================================
   📋 Filters Builder
============================================================ */
function getFilters() {
  return {
    organization_id: filterOrg?.dataset.value || "",
    facility_id: filterFacility?.dataset.value || "",
    department_id: filterDept?.dataset.value || "",
    patient_id: filterPatient?.dataset.value || "",
    doctor_id: filterDoctor?.dataset.value || "",
    fulfilled_by_id: filterFulfilledBy?.dataset.value || "",
    consultation_id: filterConsultation?.dataset.value || "",
    registration_log_id: filterRegLog?.dataset.value || "",
    medication_id: filterMedication?.dataset.value || "",
    status: filterStatus?.value || "",
    type: filterType?.value || "",
    is_emergency: filterEmergency?.value || "",
    date_from: filterDateFrom?.value || "",
    date_to: filterDateTo?.value || "",
  };
}

/* ============================================================
   🧹 Reset Filters
============================================================ */
function clearFilters() {
  [
    filterOrg,
    filterFacility,
    filterDept,
    filterPatient,
    filterDoctor,
    filterFulfilledBy,
    filterConsultation,
    filterRegLog,
    filterMedication,
    filterStatus,
    filterType,
    filterEmergency,
    filterDateFrom,
    filterDateTo,
  ].forEach((el) => el && ((el.value = ""), (el.dataset.value = "")));
}

/* ============================================================
   📦 Load Pharmacy Transactions (with Summary)
============================================================ */
async function loadEntries(page = 1) {
  try {
    showLoading();
    const filters = getFilters();
    const q = new URLSearchParams();
    const { page: safePage, limit: safeLimit } = getPagination(page);

    q.append("page", safePage);
    q.append("limit", safeLimit);

    if (filters.date_from) q.append("created_at[gte]", filters.date_from);
    if (filters.date_to) q.append("created_at[lte]", filters.date_to);

    Object.entries(filters).forEach(([k, v]) => {
      if (!v || ["date_from", "date_to"].includes(k)) return;
      q.append(k, v);
    });

    const safeFields = visibleFields.filter((f) =>
      FIELD_ORDER_PHARMACY_TRANSACTION.includes(f)
    );
    if (safeFields.length) q.append("fields", safeFields.join(","));

    const res = await authFetch(`/api/pharmacy-transactions?${q.toString()}`, {
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
    showToast("❌ Failed to load pharmacy transactions");
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
    clearFilters();
    await loadEntries(1);
  };

/* ============================================================
   🪟 View Toggle
============================================================ */
const cardViewBtn = document.getElementById("cardViewBtn");
const tableViewBtn = document.getElementById("tableViewBtn");

cardViewBtn?.addEventListener("click", () => {
  viewMode = "card";
  localStorage.setItem("pharmacyTransactionView", "card");
  renderList({ entries, visibleFields, viewMode, user, currentPage });
});

tableViewBtn?.addEventListener("click", () => {
  viewMode = "table";
  localStorage.setItem("pharmacyTransactionView", "table");
  renderList({ entries, visibleFields, viewMode, user, currentPage });
});
/* ============================================================
   💊 SUMMARY VIEW HANDLER
============================================================ */
const summaryViewBtn = document.getElementById("summaryViewBtn");
const tableContainer = document.querySelector(".table-container");
const cardList = document.getElementById("pharmacyTransactionList");
const summaryContainer = document.getElementById("pharmacySummaryContainer");

summaryViewBtn?.addEventListener("click", async () => {
  [tableViewBtn, cardViewBtn, summaryViewBtn].forEach(btn => btn.classList.remove("active"));
  summaryViewBtn.classList.add("active");

  tableContainer.style.display = "none";
  cardList.style.display = "none";
  summaryContainer.style.display = "block";

  await loadPharmacySummary();

  // 🩺 Ensure Bootstrap dropdown works after showing Summary container
  const dropdownTriggerList = [].slice.call(
    document.querySelectorAll('#summaryFieldSelectorBtn[data-bs-toggle="dropdown"]')
  );
  dropdownTriggerList.forEach((el) => new bootstrap.Dropdown(el));
});


tableViewBtn?.addEventListener("click", () => {
  [tableViewBtn, cardViewBtn, summaryViewBtn].forEach(btn => btn.classList.remove("active"));
  tableViewBtn.classList.add("active");

  tableContainer.style.display = "block";
  cardList.style.display = "none";
  summaryContainer.style.display = "none";
});

cardViewBtn?.addEventListener("click", () => {
  [tableViewBtn, cardViewBtn, summaryViewBtn].forEach(btn => btn.classList.remove("active"));
  cardViewBtn.classList.add("active");

  tableContainer.style.display = "none";
  cardList.style.display = "block";
  summaryContainer.style.display = "none";
});

/* ============================================================
   📊 Load Pharmacy Summary (using same filters)
============================================================ */
async function loadPharmacySummary() {
  try {
    showLoading();
    const filters = getFilters();
    const params = new URLSearchParams();

    if (filters.date_from) params.append("created_at[gte]", filters.date_from);
    if (filters.date_to) params.append("created_at[lte]", filters.date_to);
    Object.entries(filters).forEach(([k, v]) => {
      if (!v || ["date_from", "date_to"].includes(k)) return;
      params.append(k, v);
    });

    const res = await authFetch(`/api/pharmacy-transactions/summary?${params.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const result = await res.json();
    renderPharmacySummary(result.data || []);
  } catch (err) {
    console.error("❌ loadPharmacySummary failed:", err);
    showToast("⚠️ Failed to load summary");
  } finally {
    hideLoading();
  }
}

/* ============================================================
   🎨 Render Pharmacy Summary (Dynamic Header & Body)
============================================================ */
function renderPharmacySummary(records = []) {
  window.summaryData = records; // Keep in memory for re-render
  renderPharmacySummaryTable(records);
}


/* ============================================================
   ⬇️ Export Tools (with Summary)
============================================================ */
if (exportCSVBtn)
  exportCSVBtn.onclick = () =>
    exportToExcel(entries, `pharmacy_transactions_${new Date().toISOString().slice(0, 10)}.xlsx`);

if (exportPDFBtn)
  exportPDFBtn.onclick = () => {
    try {
      const targetSelector = viewMode === "table" ? ".table-container" : "#pharmacyTransactionList";
      const target = document.querySelector(targetSelector);
      if (!target) return showToast("⚠️ Nothing to export");

      const summaryEl = document.getElementById("moduleSummary");
      const summaryHTML = summaryEl
        ? `<div class="export-summary mb-3 border rounded p-2 bg-light" style="font-size:11px; text-align:center;">
            <h5 class="fw-bold mb-2">Pharmacy Transaction Summary</h5>
            ${summaryEl.innerHTML}
          </div>`
        : "";

      const combinedHTML = `<div id="exportWrapper">${summaryHTML}${target.outerHTML}</div>`;
      const tempDiv = document.createElement("div");
      tempDiv.innerHTML = combinedHTML;
      document.body.appendChild(tempDiv);

      exportToPDF("Pharmacy_Transactions_Report", "#exportWrapper", "portrait", true);
      setTimeout(() => tempDiv.remove(), 1000);
    } catch (err) {
      console.error("❌ exportPDF failed:", err);
      showToast("❌ Failed to export PDF");
    }
  };

/* ============================================================
   🚀 Init Pharmacy Transaction Module
============================================================ */
export async function initPharmacyTransactionModule() {
  renderDynamicTableHead(visibleFields);

  const filterCollapse = document.getElementById("filterCollapse");
  const filterChevron = document.getElementById("filterChevron");

  const filterVisible = localStorage.getItem("pharmacyTransactionFilterVisible") === "true";
  if (filterVisible) {
    filterCollapse?.classList.remove("hidden");
    filterChevron?.classList.add("chevron-rotate");
  } else {
    filterCollapse?.classList.add("hidden");
    filterChevron?.classList.remove("chevron-rotate");
  }

  setupToggleSection("toggleFilterBtn", "filterCollapse", "filterChevron", "pharmacyTransactionFilterVisible");

  // 🔍 Setup suggestions
  const suggestionRefs = {
    filterOrg: "/api/lite/organizations",
    filterFacility: "/api/lite/facilities",
    filterDept: "/api/lite/departments",
    filterPatient: "/api/lite/patients",
    filterDoctor: "/api/lite/employees",
    filterFulfilledBy: "/api/lite/employees",
    filterConsultation: "/api/lite/consultations",
    filterRegLog: "/api/lite/registration-logs",
    filterMedication: "/api/lite/master-items",
  };

  Object.entries(suggestionRefs).forEach(([id, url]) => {
    const input = document.getElementById(id);
    const sug = document.getElementById(`${id}Suggestions`);
    if (input && sug) {
      setupSuggestionInputDynamic(input, sug, url, (sel) => {
        input.dataset.value = sel?.id || "";
      });
    }
  });

  // 🔻 Org/facility cascade by role
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
      filterOrg?.addEventListener("change", async () => await reloadFacilities(filterOrg.value || null));
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
  initPharmacyTransactionModule().catch((err) =>
    console.error("initPharmacyTransactionModule failed:", err)
  );
}
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
else boot();
