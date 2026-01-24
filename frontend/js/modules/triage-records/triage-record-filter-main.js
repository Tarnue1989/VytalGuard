// 📦 triageRecord-filter-main.js – Enterprise Filter + Table/Card (MASTER PARITY)
// ============================================================================
// 🧭 FULL PARITY WITH vital-filter-main.js (HTML-AWARE)
// 🔹 Auto search, auto filters, sorting, pagination
// 🔹 UI-only dateRange (SINGLE FIELD, NEVER DB column)
// 🔹 Org / Facility fully wired
// 🔹 Triage status fully wired
// 🔹 DOM-safe suggestion inputs
// 🔹 PRESERVES ALL EXISTING API CALLS (/api/triage-records)
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
  loadBillableItemsLite,
  setupSelectOptions,
  setupSuggestionInputDynamic,
} from "../../utils/data-loaders.js";

import { renderFieldSelector } from "../../utils/ui-utils.js";
import { exportToExcel, exportToPDF } from "../../utils/export-utils.js";
import { mapDataForExport } from "../../utils/export-mapper.js";

import {
  renderList,
  renderDynamicTableHead,
} from "./triage-record-render.js";

import { setupActionHandlers } from "./triage-record-actions.js";

import {
  FIELD_ORDER_TRIAGE_RECORD,
  FIELD_DEFAULTS_TRIAGE_RECORD,
} from "./triage-record-constants.js";

import { setupVisibleFields } from "../../utils/field-visibility.js";
import { initPaginationControl } from "../../utils/pagination-control.js";
import { setupAutoSearch, setupAutoFilters } from "../../utils/search-utils.js";
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
    return (JSON.parse(localStorage.getItem("permissions")) || []).map((p) =>
      String(p.key || p).toLowerCase()
    );
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
let viewMode = localStorage.getItem("triageRecordView") || "table";
let sortBy = "";
let sortDir = "asc";

const sharedState = { currentEditIdRef: { value: null } };

/* ============================================================
   👁️ FIELD VISIBILITY
============================================================ */
let visibleFields = setupVisibleFields({
  moduleKey: "triage_records",
  userRole,
  defaultFields: FIELD_DEFAULTS_TRIAGE_RECORD,
  allowedFields: FIELD_ORDER_TRIAGE_RECORD,
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
  FIELD_ORDER_TRIAGE_RECORD
);

/* ============================================================
   🔎 FILTER DOM (HTML-AWARE)
============================================================ */
const qs = (id) => document.getElementById(id);

const globalSearch = qs("globalSearch"); // may be null
const filterOrg = qs("filterOrganizationSelect");
const filterFacility = qs("filterFacilitySelect");
const filterStatus = qs("filterStatus");
const dateRange = qs("dateRange");

const filterPatient = qs("filterPatient");
const filterPatientId = qs("filterPatientId");
const filterPatientSuggestions = qs("filterPatientSuggestions");

const filterDoctor = qs("filterDoctor");
const filterDoctorId = qs("filterDoctorId");
const filterDoctorSuggestions = qs("filterDoctorSuggestions");

const filterNurse = qs("filterNurse");
const filterNurseId = qs("filterNurseId");
const filterNurseSuggestions = qs("filterNurseSuggestions");

const filterTriageType = qs("filterTriageType");

/* ============================================================
   🔃 SORT BRIDGE
============================================================ */
window.setTriageRecordSort = (field, dir) => {
  sortBy = field;
  sortDir = dir;
};
window.loadTriageRecordPage = (p = 1) => loadEntries(p);

/* ============================================================
   📄 PAGINATION
============================================================ */
const getPagination = initPaginationControl(
  "triage_records",
  loadEntries,
  Number(localStorage.getItem("triageRecordPageLimit") || 25)
);

/* ============================================================
   🔎 AUTO SEARCH / FILTERS (MASTER)
============================================================ */
if (globalSearch) setupAutoSearch(globalSearch, loadEntries);

setupAutoFilters({
  searchInput: globalSearch || null,
  selectInputs: [
    filterOrg,
    filterFacility,
    filterStatus,
    filterTriageType,
  ],
  dateRangeInput: dateRange || null,
  onChange: loadEntries,
});

/* ============================================================
   📋 FILTER BUILDER (MASTER)
============================================================ */
function getFilters() {
  return {
    search: globalSearch?.value?.trim(),
    organization_id: filterOrg?.value,
    facility_id: filterFacility?.value,
    patient_id: filterPatientId?.value,
    doctor_id: filterDoctorId?.value,
    nurse_id: filterNurseId?.value,
    triage_type_id: filterTriageType?.value,
    triage_status: filterStatus?.value,
    dateRange: dateRange?.value, // UI-only
  };
}

/* ============================================================
   📦 LOAD DATA
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

    Object.entries(f).forEach(([k, v]) => {
      if (v) q.set(k, v);
    });

    const res = await authFetch(`/api/triage-records?${q.toString()}`, {
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
        moduleLabel: "TRIAGE RECORDS",
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
    showToast("❌ Failed to load triage records");
  } finally {
    hideLoading();
  }
}

/* ============================================================
   🧭 VIEW TOGGLE
============================================================ */
qs("tableViewBtn").onclick = () => {
  viewMode = "table";
  localStorage.setItem("triageRecordView", "table");
  syncViewToggleUI({ mode: viewMode });
  renderList({ entries, visibleFields, viewMode, user, currentPage });
};

qs("cardViewBtn").onclick = () => {
  viewMode = "card";
  localStorage.setItem("triageRecordView", "card");
  syncViewToggleUI({ mode: viewMode });
  renderList({ entries, visibleFields, viewMode, user, currentPage });
};

/* ============================================================
   🔄 RESET FILTERS (MASTER)
============================================================ */
qs("resetFilterBtn")?.addEventListener("click", () => {
  [
    globalSearch,
    filterOrg,
    filterFacility,
    filterStatus,
    filterTriageType,
    dateRange,
  ].forEach((el) => el && (el.value = ""));

  if (filterPatient) filterPatient.value = "";
  if (filterPatientId) filterPatientId.value = "";
  if (filterDoctor) filterDoctor.value = "";
  if (filterDoctorId) filterDoctorId.value = "";
  if (filterNurse) filterNurse.value = "";
  if (filterNurseId) filterNurseId.value = "";

  loadEntries(1);
});

/* ============================================================
   📤 EXPORT (MASTER)
============================================================ */
qs("exportExcelBtn")?.addEventListener("click", () => {
  const mapped = mapDataForExport(entries, visibleFields);
  exportToExcel(
    mapped,
    `triage_records_${new Date().toISOString().slice(0, 10)}.xlsx`
  );
});

qs("exportPDFBtn")?.addEventListener("click", () => {
  const target =
    viewMode === "table" ? ".table-container" : "#triageRecordList";
  exportToPDF("Triage Records", target, "portrait", true);
});

/* ============================================================
   🚀 INIT
============================================================ */
export async function initTriageRecordModule() {
  renderDynamicTableHead(visibleFields);

  setupToggleSection(
    "toggleFilterBtn",
    "filterCollapse",
    "filterChevron",
    "triageRecordFilterVisible"
  );

  /* ========= PATIENT ========= */
  if (filterPatient && filterPatientSuggestions && filterPatientId) {
    setupSuggestionInputDynamic(
      filterPatient,
      filterPatientSuggestions,
      "/api/lite/patients",
      (selected) => {
        filterPatientId.value = selected?.id || "";
        filterPatient.value = selected?.label || "";
        loadEntries(1);
      },
      "label"
    );

    filterPatient.addEventListener("input", () => {
      if (!filterPatient.value.trim()) {
        filterPatientId.value = "";
        loadEntries(1);
      }
    });
  }

  /* ========= DOCTOR ========= */
  if (filterDoctor && filterDoctorSuggestions && filterDoctorId) {
    setupSuggestionInputDynamic(
      filterDoctor,
      filterDoctorSuggestions,
      "/api/lite/employees",
      (selected) => {
        filterDoctorId.value = selected?.id || "";
        filterDoctor.value = selected?.full_name || "";
        loadEntries(1);
      },
      "full_name"
    );

    filterDoctor.addEventListener("input", () => {
      if (!filterDoctor.value.trim()) {
        filterDoctorId.value = "";
        loadEntries(1);
      }
    });
  }

  /* ========= NURSE ========= */
  if (filterNurse && filterNurseSuggestions && filterNurseId) {
    setupSuggestionInputDynamic(
      filterNurse,
      filterNurseSuggestions,
      "/api/lite/employees",
      (selected) => {
        filterNurseId.value = selected?.id || "";
        filterNurse.value = selected?.full_name || "";
        loadEntries(1);
      },
      "full_name"
    );

    filterNurse.addEventListener("input", () => {
      if (!filterNurse.value.trim()) {
        filterNurseId.value = "";
        loadEntries(1);
      }
    });
  }

  /* ========= TRIAGE TYPE ========= */
  if (filterTriageType) {
    const types = await loadBillableItemsLite({ category: "triage" }, true);
    types.unshift({ id: "", name: "-- All Types --" });
    setupSelectOptions(filterTriageType, types, "id", "name");
  }

  /* ========= ORG / FAC ========= */
  if (userRole.includes("super") || userRole.includes("admin")) {
    const orgs = await loadOrganizationsLite();
    orgs.unshift({ id: "", name: "-- All Organizations --" });
    setupSelectOptions(filterOrg, orgs, "id", "name");

    const reloadFacilities = async (orgId = null) => {
      if (!filterFacility) return;
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
  ? document.addEventListener("DOMContentLoaded", initTriageRecordModule)
  : initTriageRecordModule();
