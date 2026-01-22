// 📦 consultation-filter-main.js – Enterprise Filter + Table/Card (MASTER PARITY)
// ============================================================================
// 🔹 Mirrors department-filter-main.js EXACTLY
// 🔹 Auto search, auto filters, sorting, pagination
// 🔹 UI-only dateRange (never DB column)
// 🔹 Org / Facility fully wired
// 🔹 Consultation Status fully wired
// ============================================================================

import {
  showToast,
  showLoading,
  hideLoading,
  initPageGuard,
  setupToggleSection,
  renderPaginationControls,
  initLogoutWatcher,
  autoPagePermissionKey,
} from "../../utils/index.js";

import { authFetch } from "../../authSession.js";

import {
  loadOrganizationsLite,
  loadFacilitiesLite,
  setupSelectOptions,
} from "../../utils/data-loaders.js";

import { renderFieldSelector } from "../../utils/ui-utils.js";
import { exportToExcel, exportToPDF } from "../../utils/export-utils.js";

import {
  renderList,
  renderDynamicTableHead,
} from "./consultation-render.js";

import { setupActionHandlers } from "./consultation-actions.js";

import {
  FIELD_ORDER_CONSULTATION,
  FIELD_DEFAULTS_CONSULTATION,
  FIELD_LABELS_CONSULTATION,
} from "./consultation-constants.js";

import { setupVisibleFields } from "../../utils/field-visibility.js";
import { initPaginationControl } from "../../utils/pagination-control.js";
import { setupAutoSearch, setupAutoFilters } from "../../utils/search-utils.js";
import { mapDataForExport } from "../../utils/export-mapper.js";
import { syncViewToggleUI } from "../../utils/view-toggle.js";
import { renderModuleSummary } from "../../utils/render-module-summary.js";

/* ============================================================
   🔐 AUTH + USER
============================================================ */
const token = initPageGuard(autoPagePermissionKey());
initLogoutWatcher();

const userRole = (localStorage.getItem("userRole") || "").toLowerCase();
const permissions = (() => {
  try {
    return (JSON.parse(localStorage.getItem("permissions")) || [])
      .map(p => String(p.key || p).toLowerCase());
  } catch {
    return [];
  }
})();
const user = { role: userRole, permissions };

/* ============================================================
   🧠 STATE
============================================================ */
let entries = [];
let currentPage = 1;
let viewMode = localStorage.getItem("consultationView") || "table";
let sortBy = "";
let sortDir = "asc";

const sharedState = { currentEditIdRef: { value: null } };

/* ============================================================
   👁️ FIELD VISIBILITY
============================================================ */
let visibleFields = setupVisibleFields({
  moduleKey: "consultation",
  userRole,
  defaultFields: FIELD_DEFAULTS_CONSULTATION,
  allowedFields: FIELD_ORDER_CONSULTATION,
});

/* ============================================================
   🧩 FIELD SELECTOR
============================================================ */
renderFieldSelector(
  {},
  visibleFields,
  (fields) => {
    visibleFields = fields;
    renderDynamicTableHead(visibleFields);
    renderList({ entries, visibleFields, viewMode, user, currentPage });
  },
  FIELD_ORDER_CONSULTATION
);

/* ============================================================
   🔎 FILTER DOM
============================================================ */
const qs = id => document.getElementById(id);

const filterPatient    = qs("filterPatient");
const filterDoctor     = qs("filterDoctor");
const filterDepartment = qs("filterDepartment");
const filterType       = qs("filterConsultationType");
const filterStatus     = qs("filterStatus");
const filterOrg        = qs("filterOrganizationSelect");
const filterFacility   = qs("filterFacilitySelect");
const dateRange        = qs("dateRange"); // ✅ MASTER single-field

/* ============================================================
   🔃 SORT BRIDGE
============================================================ */
window.setConsultationSort = (field, dir) => {
  sortBy = field;
  sortDir = dir;
};
window.loadConsultationPage = (p = 1) => loadEntries(p);

/* ============================================================
   📄 PAGINATION
============================================================ */
const getPagination = initPaginationControl(
  "consultation",
  loadEntries,
  Number(localStorage.getItem("consultationPageLimit") || 25)
);

/* ============================================================
   🔎 AUTO SEARCH / FILTERS (MASTER)
============================================================ */
setupAutoFilters({
  selectInputs: [
    filterDepartment,
    filterType,
    filterStatus,
    filterOrg,
    filterFacility,
  ],
  dateRangeInput: dateRange,
  onChange: loadEntries,
});

/* ============================================================
   📋 FILTER BUILDER (MASTER SAFE)
============================================================ */
function getFilters() {
  return {
    patient: filterPatient?.value?.trim(),
    doctor: filterDoctor?.value?.trim(),
    department_id: filterDepartment?.value,
    consultation_type: filterType?.value,
    status: filterStatus?.value,
    organization_id: filterOrg?.value,
    facility_id: filterFacility?.value,
    dateRange: dateRange?.value, // ✅ UI-only
  };
}

/* ============================================================
   📦 LOAD CONSULTATIONS (MASTER SAFE)
============================================================ */
async function loadEntries(page = 1) {
  try {
    showLoading();

    const q = new URLSearchParams();
    const { page: safePage, limit } = getPagination(page);
    const f = getFilters();

    q.set("page", safePage);
    q.set("limit", limit);

    if (sortBy) {
      q.set("sort_by", sortBy);
      q.set("sort_order", sortDir);
    }

    if (f.patient)           q.set("patient", f.patient);
    if (f.doctor)            q.set("doctor", f.doctor);
    if (f.department_id)     q.set("department_id", f.department_id);
    if (f.consultation_type) q.set("consultation_type", f.consultation_type);
    if (f.status)            q.set("status", f.status);
    if (f.organization_id)   q.set("organization_id", f.organization_id);
    if (f.facility_id)       q.set("facility_id", f.facility_id);
    if (f.dateRange)         q.set("dateRange", f.dateRange); // ✅ FIXED

    const res = await authFetch(`/api/consultations?${q.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    const json = await res.json();
    if (!res.ok) throw new Error(json?.message);

    const data = json.data || {};
    entries = data.records || [];
    currentPage = data.pagination?.page || safePage;

    renderList({ entries, visibleFields, viewMode, user, currentPage });

    data.summary &&
      renderModuleSummary(data.summary, "moduleSummary", {
        moduleLabel: "CONSULTATIONS",
      });

    syncViewToggleUI({ mode: viewMode });

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
      qs("paginationButtons"),
      currentPage,
      data.pagination?.pageCount || 1,
      loadEntries
    );
  } catch (err) {
    console.error(err);
    showToast("❌ Failed to load consultations");
  } finally {
    hideLoading();
  }
}

/* ============================================================
   🧭 VIEW TOGGLE
============================================================ */
qs("tableViewBtn").onclick = () => {
  viewMode = "table";
  localStorage.setItem("consultationView", "table");
  syncViewToggleUI({ mode: viewMode });
  renderList({ entries, visibleFields, viewMode, user, currentPage });
};

qs("cardViewBtn").onclick = () => {
  viewMode = "card";
  localStorage.setItem("consultationView", "card");
  syncViewToggleUI({ mode: viewMode });
  renderList({ entries, visibleFields, viewMode, user, currentPage });
};

/* ============================================================
   🔄 RESET FILTERS (MASTER SAFE)
============================================================ */
qs("resetFilterBtn").onclick = () => {
  [
    filterPatient,
    filterDoctor,
    filterDepartment,
    filterType,
    filterStatus,
    filterOrg,
    filterFacility,
    dateRange,
  ].forEach(el => el && (el.value = ""));
  loadEntries(1);
};

/* ============================================================
   ⬇️ EXPORT
============================================================ */
qs("exportCSVBtn")?.addEventListener("click", () => {
  if (!entries.length) return showToast("❌ No data");
  exportToExcel(
    mapDataForExport(entries, visibleFields, FIELD_LABELS_CONSULTATION),
    `consultations_${new Date().toISOString().slice(0, 10)}.csv`
  );
});

qs("exportPDFBtn")?.addEventListener("click", () => {
  exportToPDF(
    "Consultations List",
    viewMode === "table" ? ".table-container" : "#consultationList",
    "portrait"
  );
});

/* ============================================================
   🚀 INIT
============================================================ */
export async function initConsultationModule() {
  renderDynamicTableHead(visibleFields);

  setupToggleSection(
    "toggleFilterBtn",
    "filterCollapse",
    "filterChevron",
    "consultationFilterVisible"
  );

  if (userRole.includes("super") || userRole.includes("admin")) {
    const orgs = await loadOrganizationsLite();
    orgs.unshift({ id: "", name: "-- All Organizations --" });
    setupSelectOptions(filterOrg, orgs, "id", "name");

    const reloadFacilities = async (orgId = null) => {
      const facs = await loadFacilitiesLite(
        orgId ? { organization_id: orgId } : {},
        true
      );
      facs.unshift({ id: "", name: "-- All Facilities --" });
      setupSelectOptions(filterFacility, facs, "id", "name");
    };

    await reloadFacilities();
    filterOrg.onchange = () => reloadFacilities(filterOrg.value || null);
  }

  await loadEntries(1);
}

/* ============================================================
   🏁 BOOT
============================================================ */
document.readyState === "loading"
  ? document.addEventListener("DOMContentLoaded", initConsultationModule)
  : initConsultationModule();
