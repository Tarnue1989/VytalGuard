// 📦 vital-filter-main.js – Enterprise Filter + Table/Card (MASTER PARITY)
// ============================================================================
// 🧭 FULL PARITY WITH ekg-record-filter-main.js (HTML-AWARE)
// 🔹 Auto search, auto filters, sorting, pagination
// 🔹 UI-only dateRange (SINGLE FIELD, NEVER DB column)
// 🔹 Org / Facility fully wired
// 🔹 Vital status fully wired
// 🔹 DOM-safe suggestion inputs
// 🔹 PRESERVES ALL EXISTING API CALLS (/api/vitals)
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
  setupSuggestionInputDynamic,
} from "../../utils/data-loaders.js";

import { renderFieldSelector } from "../../utils/ui-utils.js";
import { exportToExcel, exportToPDF } from "../../utils/export-utils.js";
import { mapDataForExport } from "../../utils/export-mapper.js";

import {
  renderList,
  renderDynamicTableHead,
} from "./vital-render.js";

import { setupActionHandlers } from "./vital-actions.js";

import {
  FIELD_ORDER_VITAL,
  FIELD_DEFAULTS_VITAL,
} from "./vital-constants.js";

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
let viewMode = localStorage.getItem("vitalView") || "table";
let sortBy = "";
let sortDir = "asc";

const sharedState = { currentEditIdRef: { value: null } };

/* ============================================================
   👁️ FIELD VISIBILITY
============================================================ */
let visibleFields = setupVisibleFields({
  moduleKey: "vital",
  userRole,
  defaultFields: FIELD_DEFAULTS_VITAL,
  allowedFields: FIELD_ORDER_VITAL,
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
  FIELD_ORDER_VITAL
);

/* ============================================================
   🔎 FILTER DOM (HTML-AWARE)
============================================================ */
const qs = (id) => document.getElementById(id);

const globalSearch = qs("globalSearch"); // may be null (HTML-safe)
const filterOrg = qs("filterOrganizationSelect");
const filterFacility = qs("filterFacilitySelect");
const filterStatus = qs("filterStatus");
const dateRange = qs("dateRange");

const filterPatient = qs("filterPatient");
const filterPatientId = qs("filterPatientId");
const filterPatientSuggestions = qs("filterPatientSuggestions");

const filterNurse = qs("filterNurse");
const filterNurseId = qs("filterNurseId");
const filterNurseSuggestions = qs("filterNurseSuggestions");

/* ============================================================
   🔃 SORT BRIDGE
============================================================ */
window.setVitalSort = (field, dir) => {
  sortBy = field;
  sortDir = dir;
};
window.loadVitalPage = (p = 1) => loadEntries(p);

/* ============================================================
   📄 PAGINATION
============================================================ */
const getPagination = initPaginationControl(
  "vital",
  loadEntries,
  Number(localStorage.getItem("vitalPageLimit") || 25)
);

/* ============================================================
   🔎 AUTO SEARCH / FILTERS (MASTER)
============================================================ */
if (globalSearch) setupAutoSearch(globalSearch, loadEntries);

setupAutoFilters({
  searchInput: globalSearch || null,
  selectInputs: [filterOrg, filterFacility, filterStatus],
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
    nurse_id: filterNurseId?.value,
    status: filterStatus?.value,
    dateRange: dateRange?.value,
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

    const res = await authFetch(`/api/vitals?${q.toString()}`, {
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
        moduleLabel: "VITALS",
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
    showToast("❌ Failed to load vitals");
  } finally {
    hideLoading();
  }
}

/* ============================================================
   🧭 VIEW TOGGLE
============================================================ */
qs("tableViewBtn").onclick = () => {
  viewMode = "table";
  localStorage.setItem("vitalView", "table");
  syncViewToggleUI({ mode: viewMode });
  renderList({ entries, visibleFields, viewMode, user, currentPage });
};

qs("cardViewBtn").onclick = () => {
  viewMode = "card";
  localStorage.setItem("vitalView", "card");
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
    dateRange,
  ].forEach((el) => el && (el.value = ""));

  if (filterPatient) filterPatient.value = "";
  if (filterPatientId) filterPatientId.value = "";
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
    `vitals_${new Date().toISOString().slice(0, 10)}.xlsx`
  );
});

qs("exportPDFBtn")?.addEventListener("click", () => {
  const target = viewMode === "table" ? ".table-container" : "#vitalList";
  exportToPDF("Vitals", target, "portrait", true);
});

/* ============================================================
   🚀 INIT
============================================================ */
export async function initVitalModule() {
  renderDynamicTableHead(visibleFields);

  setupToggleSection(
    "toggleFilterBtn",
    "filterCollapse",
    "filterChevron",
    "vitalFilterVisible"
  );

  /* ========= PATIENT SUGGESTION ========= */
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

  /* ========= NURSE SUGGESTION (MASTER PARITY) ========= */
  if (filterNurse && filterNurseSuggestions && filterNurseId) {
    setupSuggestionInputDynamic(
      filterNurse,
      filterNurseSuggestions,
      "/api/lite/employees",
      (selected) => {
        filterNurseId.value = selected?.id || "";
        filterNurse.value = selected?.full_name || "";
        loadEntries(1); // ✅ immediate filter
      },
      "full_name" // ✅ REQUIRED (same as doctor / technician)
    );

    filterNurse.addEventListener("input", () => {
      if (!filterNurse.value.trim()) {
        filterNurseId.value = "";
        loadEntries(1);
      }
    });
  }

  /* ========= ORG / FACILITY ========= */
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
  ? document.addEventListener("DOMContentLoaded", initVitalModule)
  : initVitalModule();
