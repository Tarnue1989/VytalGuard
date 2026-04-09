// 📦 patient-insurance-filter-main.js – Enterprise MASTER–ALIGNED

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

import {
  loadInsuranceProvidersLite,
  loadPatientInsurancesLite,
  loadOrganizationsLite,
  loadFacilitiesLite,
  setupSelectOptions,
  setupSuggestionInputDynamic,
} from "../../utils/data-loaders.js";

import { authFetch } from "../../authSession.js";

import { renderFieldSelector } from "../../utils/ui-utils.js";
import { exportToExcel, exportToPDF } from "../../utils/export-utils.js";

import {
  renderList,
  renderDynamicTableHead,
} from "./patient-insurance-render.js";

import { setupActionHandlers } from "./patient-insurance-actions.js";

import {
  FIELD_ORDER_PATIENT_INSURANCE,
  FIELD_DEFAULTS_PATIENT_INSURANCE,
  FIELD_LABELS_PATIENT_INSURANCE,
} from "./patient-insurance-constants.js";

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
let viewMode = localStorage.getItem("patientInsuranceView") || "table";
let sortBy = "";
let sortDir = "asc";

const sharedState = { currentEditIdRef: { value: null } };

/* ============================================================
   👁️ FIELD VISIBILITY
============================================================ */
let visibleFields = setupVisibleFields({
  moduleKey: "patient_insurances",
  userRole,
  defaultFields: FIELD_DEFAULTS_PATIENT_INSURANCE,
  allowedFields: FIELD_ORDER_PATIENT_INSURANCE,
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
  FIELD_ORDER_PATIENT_INSURANCE
);

/* ============================================================
   🔎 FILTER DOM
============================================================ */
const qs = (id) => document.getElementById(id);

const globalSearch   = qs("globalSearch");
const filterOrg      = qs("filterOrganizationSelect");
const filterFacility = qs("filterFacilitySelect");
const filterStatus   = qs("filterStatus");
const dateRange      = qs("dateRange");
const filterCurrency = qs("filterCurrency");
const filterPatient            = qs("filterPatient");
const filterPatientHidden      = qs("filterPatientId");
const filterPatientSuggestions = qs("filterPatientSuggestions");

const filterProvider = qs("filterProvider");

/* ============================================================
   🔃 SORT
============================================================ */
window.setPatientInsuranceSort = (field, dir) => {
  sortBy = field;
  sortDir = dir;
};

window.loadPatientInsurancePage = (p = 1) => loadEntries(p);

/* ============================================================
   📄 PAGINATION
============================================================ */
const getPagination = initPaginationControl(
  "patient_insurance",
  loadEntries,
  Number(localStorage.getItem("patientInsurancePageLimit") || 25)
);

/* ============================================================
   🔎 AUTO SEARCH / FILTERS
============================================================ */
setupAutoSearch(globalSearch, loadEntries);

const safe = (el) => el !== null;

setupAutoFilters({
  searchInput: globalSearch,
  selectInputs: [
    filterOrg,
    filterFacility,
    filterStatus,
    filterProvider,
    filterCurrency,
  ].filter(safe),
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
    status: filterStatus?.value,
    patient_id: filterPatientHidden?.value,
    provider_id: filterProvider?.value,
    currency: filterCurrency?.value, // ✅ ADD
    dateRange: dateRange?.value,
  };
}

/* ============================================================
   📦 LOAD
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

    if (f.search)          q.set("search", f.search);
    if (f.dateRange)       q.set("dateRange", f.dateRange);
    if (f.organization_id) q.set("organization_id", f.organization_id);
    if (f.facility_id)     q.set("facility_id", f.facility_id);
    if (f.status)          q.set("status", f.status);
    if (f.patient_id)      q.set("patient_id", f.patient_id);
    if (f.provider_id)     q.set("provider_id", f.provider_id);
    if (f.currency)        q.set("currency", f.currency);

    const res = await authFetch(`/api/patient-insurances?${q.toString()}`, {
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
        moduleLabel: "PATIENT INSURANCES",
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
    showToast("❌ Failed to load patient insurances");
  } finally {
    hideLoading();
  }
}

/* ============================================================
   🧭 VIEW TOGGLE
============================================================ */
qs("tableViewBtn").onclick = () => {
  viewMode = "table";
  localStorage.setItem("patientInsuranceView", "table");
  syncViewToggleUI({ mode: viewMode });
  renderList({ entries, visibleFields, viewMode, user, currentPage });
};

qs("cardViewBtn").onclick = () => {
  viewMode = "card";
  localStorage.setItem("patientInsuranceView", "card");
  syncViewToggleUI({ mode: viewMode });
  renderList({ entries, visibleFields, viewMode, user, currentPage });
};

/* ============================================================
   🔄 RESET
============================================================ */
qs("resetFilterBtn").onclick = () => {
  [
    globalSearch,
    filterOrg,
    filterFacility,
    filterStatus,
    filterPatient,
    filterProvider,
    filterCurrency,
    dateRange,
  ].forEach((el) => el && (el.value = ""));

  filterPatientHidden.value = "";

  loadEntries(1);
};

/* ============================================================
   ⬇️ EXPORT
============================================================ */
qs("exportCSVBtn")?.addEventListener("click", () => {
  if (!entries.length) return showToast("❌ No data");
  exportToExcel(
    mapDataForExport(entries, visibleFields, FIELD_LABELS_PATIENT_INSURANCE),
    `patient_insurances_${new Date().toISOString().slice(0, 10)}.csv`
  );
});

qs("exportPDFBtn")?.addEventListener("click", () => {
  exportToPDF(
    "Patient Insurance List",
    viewMode === "table" ? ".table-container" : "#patientInsuranceList",
    "portrait"
  );
});

/* ============================================================
   🚀 INIT
============================================================ */
export async function initPatientInsuranceModule() {
  renderDynamicTableHead(visibleFields);

  setupToggleSection(
    "toggleFilterBtn",
    "filterCollapse",
    "filterChevron",
    "patientInsuranceFilterVisible"
  );

  const providers = await loadInsuranceProvidersLite();
  providers.unshift({ id: "", label: "-- All Providers --" });
  setupSelectOptions(filterProvider, providers, "id", "label");

  setupSuggestionInputDynamic(
    filterPatient,
    filterPatientSuggestions,
    "/api/lite/patients",
    (selected) => {
      filterPatientHidden.value = selected?.id || "";
      filterPatient.value = selected?.label || "";
      loadEntries(1);
    },
    "label"
  );

  filterPatient.oninput = () => {
    if (!filterPatient.value) {
      filterPatientHidden.value = "";
      loadEntries(1);
    }
  };

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
  } else {
    filterOrg?.closest(".form-group")?.classList.add("hidden");
    filterFacility?.closest(".form-group")?.classList.add("hidden");
  }

  await loadEntries(1);
}

/* ============================================================
   🏁 BOOT
============================================================ */
document.readyState === "loading"
  ? document.addEventListener("DOMContentLoaded", initPatientInsuranceModule)
  : initPatientInsuranceModule();