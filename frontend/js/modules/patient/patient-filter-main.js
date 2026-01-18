// 📦 patient-filter-main.js – Enterprise Filter + Table/Card (ROLE PARITY)
// ============================================================================
// 🔹 Pagination EXACTLY mirrors role-filter-main.js
// 🔹 DateRange wired correctly (single source)
// 🔹 Role-aware filters, summary, export, view toggle
// 🔹 Non-breaking: preserves all IDs and behaviors
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

import { renderModuleSummary } from "../../utils/render-module-summary.js";
import { authFetch } from "../../authSession.js";
import { setupSuggestionInputDynamic } from "../../utils/data-loaders.js";

import { renderFieldSelector } from "../../utils/ui-utils.js";
import { exportToExcel, exportToPDF } from "../../utils/export-utils.js";
import { renderList, renderDynamicTableHead } from "./patient-render.js";
import { setupActionHandlers } from "./patient-actions.js";

import {
  FIELD_ORDER_PATIENT,
  FIELD_DEFAULTS_PATIENT,
} from "./patient-constants.js";

import { setupVisibleFields } from "../../utils/field-visibility.js";
import { initPaginationControl } from "../../utils/pagination-control.js";

/* ============================================================
   🔐 Auth Guard + Role Context
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
window.entries = [];

/* ============================================================
   🧩 Field Visibility + Selector
============================================================ */
let visibleFields = setupVisibleFields({
  moduleKey: "patient",
  userRole,
  defaultFields: FIELD_DEFAULTS_PATIENT,
  allowedFields: FIELD_ORDER_PATIENT,
});

renderFieldSelector(
  {},
  visibleFields,
  (newFields) => {
    visibleFields = newFields;
    renderDynamicTableHead(visibleFields);
    renderList({ entries, visibleFields, viewMode, user, currentPage });
  },
  FIELD_ORDER_PATIENT
);

/* ============================================================
   🔎 Filter DOM Refs
============================================================ */
const dateRangeInput = document.getElementById("dateRange");

const filterSearch = document.getElementById("filterSearch");
const filterSearchSuggestions = document.getElementById("filterSearchSuggestions");

const filterOrganization = document.getElementById("filterOrganization");
const filterOrganizationSuggestions =
  document.getElementById("filterOrganizationSuggestions");

const filterFacility = document.getElementById("filterFacility");
const filterFacilitySuggestions =
  document.getElementById("filterFacilitySuggestions");

const filterGender = document.getElementById("filterGender");
const filterStatus = document.getElementById("filterStatus");

const exportCSVBtn = document.getElementById("exportCSVBtn");
const exportPDFBtn = document.getElementById("exportPDFBtn");

/* ============================================================
   🌍 View + Pagination State (ROLE-EXACT)
============================================================ */
let currentPage = 1;
let totalPages = 1;
let viewMode = localStorage.getItem("patientView") || "table";

/* ============================================================
   🔃 Sort State (ROLE PARITY)
============================================================ */
let sortBy = "";
let sortDir = "asc"; // asc | desc

/* ============================================================
   🔃 Sort Bridge (RENDER ↔ MAIN)
============================================================ */
window.setPatientSort = (field, dir) => {
  sortBy = field;
  sortDir = dir;
};

/* ============================================================
   🔗 SAFE PUBLIC RELOAD HOOK (RENDER → MAIN)
   ✅ REQUIRED FOR TABLE SORTING
   ❌ DOES NOT CHANGE EXISTING LOGIC
============================================================ */
window.loadPatientPage = (page = 1) => loadEntries(page);

// ✅ EXACT SAME LINE AS ROLE (ONLY module key differs)
const getPagination = initPaginationControl("patient", loadEntries, 25);

/* ============================================================
   📅 Date Range → ISO
============================================================ */
function getDateRange() {
  if (!dateRangeInput?.value) return {};

  const [start, end] = dateRangeInput.value.split(" - ");
  if (!start || !end) return {};

  return {
    created_from: moment(start, "MM/DD/YYYY", true).format("YYYY-MM-DD"),
    created_to: moment(end, "MM/DD/YYYY", true).format("YYYY-MM-DD"),
  };
}

/* ============================================================
   📋 Build Filters
============================================================ */
function getFilters() {
  const { created_from, created_to } = getDateRange();

  return {
    global: filterSearch?.dataset.value || "",
    organization_id: filterOrganization?.dataset.value || "",
    facility_id: filterFacility?.dataset.value || "",
    gender: filterGender?.value || "",
    registration_status: filterStatus?.value || "",
    created_from,
    created_to,
  };
}

function clearFilters() {
  [
    filterSearch,
    filterOrganization,
    filterFacility,
    filterGender,
    filterStatus,
    dateRangeInput,
  ].forEach((el) => {
    if (!el) return;
    el.value = "";
    if (el.dataset) el.dataset.value = "";
  });

  filterSearchSuggestions && (filterSearchSuggestions.innerHTML = "");
  filterOrganizationSuggestions && (filterOrganizationSuggestions.innerHTML = "");
  filterFacilitySuggestions && (filterFacilitySuggestions.innerHTML = "");
}

/* ============================================================
   📦 Load Patients (SAFE – NO STALE DATA + SORTING)
============================================================ */
async function loadEntries(page = 1) {
  try {
    window.entries = [];

    const tbody = document.getElementById("patientTableBody");
    if (tbody) tbody.innerHTML = "";

    const cardList = document.getElementById("patientList");
    if (cardList) cardList.innerHTML = "";

    showLoading();

    const filters = getFilters();
    const q = new URLSearchParams();
    const { page: safePage, limit: safeLimit } = getPagination(page);

    q.append("page", safePage);
    q.append("limit", safeLimit);

    if (sortBy) {
      q.append("sortBy", sortBy);
      q.append("sortDir", sortDir);
    }

    if (filters.created_from)
      q.append("created_at[gte]", filters.created_from);
    if (filters.created_to)
      q.append("created_at[lte]", filters.created_to);

    Object.entries(filters).forEach(([k, v]) => {
      if (!v || ["created_from", "created_to"].includes(k)) return;
      q.append(k, v);
    });

    const safeFields = visibleFields.filter((f) =>
      FIELD_ORDER_PATIENT.includes(f)
    );
    if (safeFields.length) q.append("fields", safeFields.join(","));

    const res = await authFetch(`/api/patients?${q.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    const result = await res.json().catch(() => ({}));
    const payload = result?.data || {};
    const records = Array.isArray(payload.records) ? payload.records : [];

    window.entries = records;
    currentPage = Number(payload.pagination?.page) || safePage;
    totalPages = Number(payload.pagination?.pageCount) || 1;

    renderList({ entries, visibleFields, viewMode, user, currentPage });

    payload.summary && renderModuleSummary(payload.summary);

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

    if (!records.length) showToast("ℹ️ No patients found for current filters");
  } catch (err) {
    console.error("❌ loadEntries failed:", err);
    showToast("❌ Failed to load patients");
  } finally {
    hideLoading();
  }
}

/* ============================================================
   🧭 View Toggle
============================================================ */
const cardViewBtn = document.getElementById("cardViewBtn");
const tableViewBtn = document.getElementById("tableViewBtn");

function setViewMode(mode) {
  viewMode = mode;
  localStorage.setItem("patientView", mode);

  cardViewBtn?.classList.toggle("active", mode === "card");
  tableViewBtn?.classList.toggle("active", mode === "table");

  renderList({ entries, visibleFields, viewMode, user, currentPage });
}

cardViewBtn && (cardViewBtn.onclick = () => setViewMode("card"));
tableViewBtn && (tableViewBtn.onclick = () => setViewMode("table"));

/* ============================================================
   🔍 Filter Actions
============================================================ */
document.getElementById("filterBtn").onclick = async () => loadEntries(1);

document.getElementById("resetFilterBtn").onclick = async () => {
  clearFilters();
  await loadEntries(1);
};

/* ============================================================
   ⬇️ Export Tools
============================================================ */
exportCSVBtn &&
  (exportCSVBtn.onclick = () =>
    exportToExcel(
      entries,
      `patients_${new Date().toISOString().slice(0, 10)}.xlsx`
    ));

exportPDFBtn &&
  (exportPDFBtn.onclick = () => {
    const target =
      viewMode === "table" ? ".table-container" : "#patientList";
    exportToPDF("Patient List", target, "portrait", true);
  });

/* ============================================================
   🚀 Init Module (NO PAGINATION HERE – ROLE PARITY)
============================================================ */
export async function initPatientModule() {
  renderDynamicTableHead(visibleFields);

  cardViewBtn?.classList.toggle("active", viewMode === "card");
  tableViewBtn?.classList.toggle("active", viewMode === "table");

  setupToggleSection(
    "toggleFilterBtn",
    "filterCollapse",
    "filterChevron",
    "patientFilterVisible"
  );

  setupSuggestionInputDynamic(
    filterSearch,
    filterSearchSuggestions,
    "/api/lite/patients",
    (sel) => (filterSearch.dataset.value = sel?.id || ""),
    "label"
  );

  setupSuggestionInputDynamic(
    filterOrganization,
    filterOrganizationSuggestions,
    "/api/lite/organizations",
    (sel) => {
      filterOrganization.dataset.value = sel?.id || "";
      filterFacility.value = "";
      filterFacility.dataset.value = "";
    },
    "name"
  );

  setupSuggestionInputDynamic(
    filterFacility,
    filterFacilitySuggestions,
    "/api/lite/facilities",
    (sel) => (filterFacility.dataset.value = sel?.id || ""),
    "name",
    {
      extraParams: () => ({
        organization_id: filterOrganization?.dataset.value || "",
      }),
    }
  );

  await loadEntries(1);
}

/* ============================================================
   🏁 Boot
============================================================ */
document.readyState === "loading"
  ? document.addEventListener("DOMContentLoaded", initPatientModule)
  : initPatientModule();
