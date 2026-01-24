// 📦 delivery-record-filter-main.js – Enterprise Filter + Table/Card (MASTER PARITY)
// ============================================================================
// 🔹 FULL PARITY WITH ekg-record-filter-main.js
// 🔹 Auto search, auto filters, sorting, pagination
// 🔹 UI-only dateRange (single field, NEVER DB column)
// 🔹 Org / Facility fully wired
// 🔹 Delivery Record status fully wired
// 🔹 DOM-safe suggestion inputs
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
} from "./delivery-record-render.js";

import { setupActionHandlers } from "./delivery-record-actions.js";

import {
  FIELD_ORDER_DELIVERY_RECORD,
  FIELD_DEFAULTS_DELIVERY_RECORD,
} from "./delivery-record-constants.js";

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
    return (JSON.parse(localStorage.getItem("permissions")) || []).map(p =>
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
let viewMode = localStorage.getItem("deliveryRecordView") || "table";
let sortBy = "";
let sortDir = "asc";

const sharedState = { currentEditIdRef: { value: null } };

/* ============================================================
   👁️ FIELD VISIBILITY
============================================================ */
let visibleFields = setupVisibleFields({
  moduleKey: "delivery_records",
  userRole,
  defaultFields: FIELD_DEFAULTS_DELIVERY_RECORD,
  allowedFields: FIELD_ORDER_DELIVERY_RECORD,
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
  FIELD_ORDER_DELIVERY_RECORD
);

/* ============================================================
   🔎 FILTER DOM
============================================================ */
const qs = (id) => document.getElementById(id);

const globalSearch = qs("globalSearch");
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

const filterMidwife = qs("filterMidwife");
const filterMidwifeId = qs("filterMidwifeId");
const filterMidwifeSuggestions = qs("filterMidwifeSuggestions");

/* ============================================================
   🔃 SORT BRIDGE
============================================================ */
window.setDeliveryRecordSort = (field, dir) => {
  sortBy = field;
  sortDir = dir;
};
window.loadDeliveryRecordPage = (p = 1) => loadEntries(p);

/* ============================================================
   📄 PAGINATION
============================================================ */
const getPagination = initPaginationControl(
  "delivery_records",
  loadEntries,
  Number(localStorage.getItem("deliveryRecordPageLimit") || 25)
);

/* ============================================================
   🔎 AUTO SEARCH / FILTERS
============================================================ */
setupAutoSearch(globalSearch, loadEntries);

setupAutoFilters({
  searchInput: globalSearch,
  selectInputs: [
    filterOrg,
    filterFacility,
    filterStatus,
  ],
  dateRangeInput: dateRange,
  onChange: loadEntries,
});

/* ============================================================
   📋 FILTER BUILDER
============================================================ */
function getFilters() {
  return {
    search: globalSearch?.value?.trim(),
    organization_id: filterOrg?.value,
    facility_id: filterFacility?.value,
    patient_id: filterPatientId?.value,
    doctor_id: filterDoctorId?.value,
    midwife_id: filterMidwifeId?.value,
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

    const res = await authFetch(`/api/delivery-records?${q.toString()}`, {
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
        moduleLabel: "DELIVERY RECORDS",
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
    showToast("❌ Failed to load delivery records");
  } finally {
    hideLoading();
  }
}
/* ============================================================
   🧭 VIEW TOGGLE
============================================================ */
qs("tableViewBtn").onclick = () => {
  viewMode = "table";
  localStorage.setItem("centralStockView", "table");
  syncViewToggleUI({ mode: viewMode });
  renderList({ entries, visibleFields, viewMode, user, currentPage });
};

qs("cardViewBtn").onclick = () => {
  viewMode = "card";
  localStorage.setItem("centralStockView", "card");
  syncViewToggleUI({ mode: viewMode });
  renderList({ entries, visibleFields, viewMode, user, currentPage });
};

/* ============================================================
   🔄 RESET FILTERS (FULL + SAFE)
============================================================ */
qs("resetFilterBtn")?.addEventListener("click", () => {
  [
    globalSearch,
    filterOrg,
    filterFacility,
    filterStatus,
    dateRange,
  ].forEach(el => el && (el.value = ""));

  if (filterPatient) filterPatient.value = "";
  if (filterPatientId) filterPatientId.value = "";
  if (filterDoctor) filterDoctor.value = "";
  if (filterDoctorId) filterDoctorId.value = "";
  if (filterMidwife) filterMidwife.value = "";
  if (filterMidwifeId) filterMidwifeId.value = "";

  loadEntries(1);
});

/* ============================================================
   📤 EXPORT
============================================================ */
qs("exportExcelBtn")?.addEventListener("click", () => {
  const mapped = mapDataForExport(entries, visibleFields);
  exportToExcel(
    mapped,
    `delivery_records_${new Date().toISOString().slice(0, 10)}.xlsx`
  );
});

qs("exportPDFBtn")?.addEventListener("click", () => {
  const target =
    viewMode === "table" ? ".table-container" : "#deliveryRecordList";
  exportToPDF("Delivery Records", target, "portrait", true);
});

/* ============================================================
   🚀 INIT
============================================================ */
export async function initDeliveryRecordModule() {
  renderDynamicTableHead(visibleFields);

  setupToggleSection(
    "toggleFilterBtn",
    "filterCollapse",
    "filterChevron",
    "deliveryRecordFilterVisible"
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

  /* ========= DOCTOR SUGGESTION ========= */
  if (filterDoctor && filterDoctorSuggestions && filterDoctorId) {
    setupSuggestionInputDynamic(
      filterDoctor,
      filterDoctorSuggestions,
      "/api/lite/employees",
      (selected) => {
        filterDoctorId.value = selected?.id || "";
        filterDoctor.value = selected?.full_name || "";
        loadEntries(1);
      }
    );

    filterDoctor.addEventListener("input", () => {
      if (!filterDoctor.value.trim()) {
        filterDoctorId.value = "";
        loadEntries(1);
      }
    });
  }

  /* ========= MIDWIFE SUGGESTION ========= */
  if (filterMidwife && filterMidwifeSuggestions && filterMidwifeId) {
    setupSuggestionInputDynamic(
      filterMidwife,
      filterMidwifeSuggestions,
      "/api/lite/employees",
      (selected) => {
        filterMidwifeId.value = selected?.id || "";
        filterMidwife.value = selected?.full_name || "";
        loadEntries(1);
      }
    );

    filterMidwife.addEventListener("input", () => {
      if (!filterMidwife.value.trim()) {
        filterMidwifeId.value = "";
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
  ? document.addEventListener("DOMContentLoaded", initDeliveryRecordModule)
  : initDeliveryRecordModule();
