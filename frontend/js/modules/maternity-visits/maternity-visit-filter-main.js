// 📦 maternity-visit-filter-main.js – Filters + Table/Card (Ultrasound-Parity)

import {
  showToast,
  showLoading,
  hideLoading,
  initPageGuard,
  setupToggleSection,
  renderPaginationControls,
  initLogoutWatcher,
} from "../../utils/index.js";

import { authFetch } from "../../authSession.js";

import {
  loadOrganizationsLite,
  loadFacilitiesLite,
  loadPatientsLite,
  loadEmployeesLite,
  loadBillableItemsLite,
  setupSelectOptions,
  setupSuggestionInputDynamic,
} from "../../utils/data-loaders.js";

import { renderFieldSelector } from "../../utils/ui-utils.js";
import { exportToExcel, exportToPDF } from "../../utils/export-utils.js";

import { renderList, renderDynamicTableHead } from "./maternity-visit-render.js";
import { setupActionHandlers } from "./maternity-visit-actions.js";

import {
  FIELD_ORDER_MATERNITY_VISIT,
  FIELD_DEFAULTS_MATERNITY_VISIT,
} from "./maternity-visit-constants.js";

import { setupVisibleFields } from "../../utils/field-visibility.js";
import { initPaginationControl } from "../../utils/pagination-control.js";

/* ============================================================
   🔐 Auth
============================================================ */
const token = initPageGuard("maternity_visits:view");
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
window.showForm = () => {};
window.resetForm = () => {};

/* ============================================================
   🧩 Field Visibility
============================================================ */
window.entries = [];
let visibleFields = setupVisibleFields({
  moduleKey: "maternity_visit",
  userRole,
  defaultFields: FIELD_DEFAULTS_MATERNITY_VISIT,
  allowedFields: FIELD_ORDER_MATERNITY_VISIT,
});

/* ============================================================
   🧩 Field Selector
============================================================ */
renderFieldSelector(
  {},
  visibleFields,
  (newFields) => {
    visibleFields = newFields;
    renderDynamicTableHead(visibleFields);
    renderList({ entries, visibleFields, viewMode, user, currentPage });
  },
  FIELD_ORDER_MATERNITY_VISIT
);

/* ============================================================
   🔎 Filter DOM Refs
============================================================ */
const filterOrg = document.getElementById("filterOrganizationSelect");
const filterFacility = document.getElementById("filterFacilitySelect");

const filterPatient = document.getElementById("filterPatient");
const filterPatientHidden = document.getElementById("filterPatientId");
const filterPatientSuggestions = document.getElementById("filterPatientSuggestions");

const filterDoctor = document.getElementById("filterDoctor");
const filterDoctorHidden = document.getElementById("filterDoctorId");
const filterDoctorSuggestions = document.getElementById("filterDoctorSuggestions");

const filterMidwife = document.getElementById("filterMidwife");
const filterMidwifeHidden = document.getElementById("filterMidwifeId");
const filterMidwifeSuggestions = document.getElementById("filterMidwifeSuggestions");

const filterVisitType = document.getElementById("filterVisitType");
const filterStatus = document.getElementById("filterStatus");
const filterCreatedFrom = document.getElementById("filterCreatedFrom");
const filterCreatedTo = document.getElementById("filterCreatedTo");

/* ============================================================
   ⬇️ Export Buttons
============================================================ */
const exportCSVBtn = document.getElementById("exportCSVBtn");
const exportPDFBtn = document.getElementById("exportPDFBtn");

/* ============================================================
   🌍 View + Paging
============================================================ */
let currentPage = 1;
let totalPages = 1;
let viewMode = localStorage.getItem("maternityVisitView") || "table";

/* ============================================================
   🔁 Pagination Control (MATCHES ULTRASOUND)
============================================================ */
const getPagination = initPaginationControl(
  "maternity_visit",
  loadEntries,
  25
);

/* ============================================================
   📋 Build Filters
============================================================ */
function getFilters() {
  return {
    organization_id: filterOrg?.value || "",
    facility_id: filterFacility?.value || "",
    patient_id: filterPatientHidden?.value || "",
    doctor_id: filterDoctorHidden?.value || "",
    midwife_id: filterMidwifeHidden?.value || "",
    visit_type: filterVisitType?.value || "",
    status: filterStatus?.value || "",
    created_from: filterCreatedFrom?.value || "",
    created_to: filterCreatedTo?.value || "",
  };
}

/* ============================================================
   📦 Load Maternity Visits (PAGINATION FIXED)
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
      FIELD_ORDER_MATERNITY_VISIT.includes(f)
    );
    if (safeFields.length) q.append("fields", safeFields.join(","));

    const res = await authFetch(`/api/maternity-visits?${q.toString()}`, {
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
  } catch (err) {
    console.error("❌ loadEntries failed:", err);
    showToast("❌ Failed to load maternity visits");
  } finally {
    hideLoading();
  }
}

/* ============================================================
   🧭 View Toggle
============================================================ */
document.getElementById("tableViewBtn").onclick = () => {
  viewMode = "table";
  localStorage.setItem("maternityVisitView", "table");
  renderList({ entries, visibleFields, viewMode, user, currentPage });
};

document.getElementById("cardViewBtn").onclick = () => {
  viewMode = "card";
  localStorage.setItem("maternityVisitView", "card");
  renderList({ entries, visibleFields, viewMode, user, currentPage });
};

/* ============================================================
   🔎 Filter Actions
============================================================ */
document.getElementById("filterBtn").onclick = async () => await loadEntries(1);

document.getElementById("resetFilterBtn").onclick = () => {
  [
    filterPatient,
    filterDoctor,
    filterMidwife,
    filterVisitType,
    filterStatus,
    filterCreatedFrom,
    filterCreatedTo,
  ].forEach((el) => el && (el.value = ""));

  if (filterPatientHidden) filterPatientHidden.value = "";
  if (filterDoctorHidden) filterDoctorHidden.value = "";
  if (filterMidwifeHidden) filterMidwifeHidden.value = "";

  loadEntries(1);
};

/* ============================================================
   ⬇️ Export
============================================================ */
if (exportCSVBtn)
  exportCSVBtn.onclick = () =>
    exportToExcel(
      entries,
      `maternity_visits_${new Date().toISOString().slice(0, 10)}.xlsx`
    );

if (exportPDFBtn)
  exportPDFBtn.onclick = () => {
    const target =
      viewMode === "table" ? ".table-container" : "#maternityVisitList";
    exportToPDF("Maternity Visit List", target, "portrait", true);
  };

/* ============================================================
   🚀 Init
============================================================ */
export async function initMaternityVisitModule() {
  renderDynamicTableHead(visibleFields);

  setupToggleSection(
    "toggleFilterBtn",
    "filterCollapse",
    "filterChevron",
    "maternityVisitFilterVisible"
  );

  await loadEntries(1);
}

/* ============================================================
   🏁 Boot
============================================================ */
function boot() {
  initMaternityVisitModule().catch((err) =>
    console.error("initMaternityVisitModule failed:", err)
  );
}

if (document.readyState === "loading")
  document.addEventListener("DOMContentLoaded", boot);
else boot();
