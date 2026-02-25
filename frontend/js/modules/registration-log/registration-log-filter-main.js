// 📦 registrationLog-filter-main.js – Enterprise Filter + Table/Card (MASTER)
// ============================================================================
// 🔹 FULL PARITY WITH department-filter-main.js
// 🔹 Auto search, auto filters, sorting, pagination
// 🔹 UI-only dateRange (single field, NEVER DB column)
// 🔹 Org / Facility fully wired
// 🔹 Registration Log log_status fully wired
// 🔹 NO toggle-status (enterprise-safe)
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

import {
  renderList,
  renderDynamicTableHead,
} from "./registration-log-render.js";

import { setupActionHandlers } from "./registration-log-actions.js";

import {
  FIELD_ORDER_REGISTRATION_LOG,
  FIELD_DEFAULTS_REGISTRATION_LOG,
  FIELD_LABELS_REGISTRATION_LOG,
} from "./registration-log-constants.js";

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
let viewMode = localStorage.getItem("registrationLogView") || "table";
let sortBy = "";
let sortDir = "asc";

const sharedState = { currentEditIdRef: { value: null } };

/* ============================================================
   👁️ FIELD VISIBILITY
============================================================ */
let visibleFields = setupVisibleFields({
  moduleKey: "registration_logs",
  userRole,
  defaultFields: FIELD_DEFAULTS_REGISTRATION_LOG,
  allowedFields: FIELD_ORDER_REGISTRATION_LOG,
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
  FIELD_ORDER_REGISTRATION_LOG
);

/* ============================================================
   🔎 FILTER DOM
============================================================ */
const qs = (id) => document.getElementById(id);

const globalSearch = qs("globalSearch");
const filterOrg = qs("filterOrganizationSelect");
const filterFacility = qs("filterFacilitySelect");
const filterLogStatus = qs("filterStatus");
const dateRange = qs("dateRange");

const filterPatient = qs("filterPatient");
const filterPatientId = qs("filterPatientId");
const filterPatientSuggestions = qs("filterPatientSuggestions");

const filterRegistrar = qs("filterRegistrar");
const filterRegistrarId = qs("filterRegistrarId");
const filterRegistrarSuggestions = qs("filterRegistrarSuggestions");

const filterType = qs("filterRegistrationType");
const filterMethod = qs("filterMethod");
const filterCategory = qs("filterCategory");
const filterReason = qs("filterReason");
const filterSource = qs("filterSource");

/* ============================================================
   🔃 SORT BRIDGE
============================================================ */
window.setRegistrationLogSort = (field, dir) => {
  sortBy = field;
  sortDir = dir;
};
window.loadRegistrationLogPage = (p = 1) => loadEntries(p);

/* ============================================================
   📄 PAGINATION
============================================================ */
const getPagination = initPaginationControl(
  "registration_logs",
  loadEntries,
  Number(localStorage.getItem("registrationLogPageLimit") || 25)
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
    filterLogStatus,
    filterType,
    filterMethod,
    filterCategory,
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
    registrar_id: filterRegistrarId?.value,
    registration_type_id: filterType?.value,
    registration_method: filterMethod?.value,
    patient_category: filterCategory?.value,
    log_status: filterLogStatus?.value,
    visit_reason: filterReason?.value,
    registration_source: filterSource?.value,
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

    const res = await authFetch(`/api/registration-logs?${q.toString()}`, {
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
        moduleLabel: "REGISTRATION LOGS",
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
    showToast("❌ Failed to load registration logs");
  } finally {
    hideLoading();
  }
}

/* ============================================================
   🧭 VIEW TOGGLE
============================================================ */
qs("tableViewBtn").onclick = () => {
  viewMode = "table";
  localStorage.setItem("registrationLogView", "table");
  syncViewToggleUI({ mode: viewMode });
  renderList({ entries, visibleFields, viewMode, user, currentPage });
};

qs("cardViewBtn").onclick = () => {
  viewMode = "card";
  localStorage.setItem("registrationLogView", "card");
  syncViewToggleUI({ mode: viewMode });
  renderList({ entries, visibleFields, viewMode, user, currentPage });
};

/* ============================================================
   🔄 RESET FILTERS
============================================================ */
qs("resetFilterBtn")?.addEventListener("click", () => {
  [
    globalSearch,
    filterOrg,
    filterFacility,
    filterLogStatus,
    filterType,
    filterMethod,
    filterCategory,
    filterReason,
    filterSource,
    dateRange,
  ].forEach(el => el && (el.value = ""));

  if (filterPatient) filterPatient.value = "";
  if (filterPatientId) filterPatientId.value = "";
  if (filterRegistrar) filterRegistrar.value = "";
  if (filterRegistrarId) filterRegistrarId.value = "";

  loadEntries(1);
});

/* ============================================================
   🚀 INIT
============================================================ */
export async function initRegistrationLogModule() {
  renderDynamicTableHead(visibleFields);

  setupToggleSection(
    "toggleFilterBtn",
    "filterCollapse",
    "filterChevron",
    "registrationLogFilterVisible"
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

  /* ========= REGISTRAR SUGGESTION ========= */
  if (filterRegistrar && filterRegistrarSuggestions && filterRegistrarId) {
    setupSuggestionInputDynamic(
      filterRegistrar,
      filterRegistrarSuggestions,
      "/api/lite/employees",
      (selected) => {
        filterRegistrarId.value = selected?.id || "";
        filterRegistrar.value = selected?.full_name || "";
        loadEntries(1);
      }
    );

    filterRegistrar.addEventListener("input", () => {
      if (!filterRegistrar.value.trim()) {
        filterRegistrarId.value = "";
        loadEntries(1);
      }
    });
  }

  if (filterType) {
    const regTypes = await loadBillableItemsLite(
      { category: "registration" },
      true
    );
    setupSelectOptions(
      filterType,
      [{ id: "", name: "-- All Types --" }, ...regTypes],
      "id",
      "name"
    );
  }

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
  ? document.addEventListener("DOMContentLoaded", initRegistrationLogModule)
  : initRegistrationLogModule();
