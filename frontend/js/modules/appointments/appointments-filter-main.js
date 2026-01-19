// 📦 appointment-filter-main.js – Enterprise Filter + Table/Card (MASTER FINAL)
// ============================================================================
// 🔹 Mirrors feature-access-filter-main.js EXACTLY
// 🔹 Auto search, auto filters, sorting, pagination
// 🔹 UI-only dateRange (never DB column)
// 🔹 Org / Facility / Department fully wired
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
  loadDepartmentsLite,
  setupSuggestionInputDynamic,
  setupSelectOptions,
} from "../../utils/data-loaders.js";

import { renderFieldSelector } from "../../utils/ui-utils.js";
import { exportToExcel, exportToPDF } from "../../utils/export-utils.js";

import {
  renderList,
  renderDynamicTableHead,
} from "./appointments-render.js";

import { setupActionHandlers } from "./appointments-actions.js";

import {
  FIELD_ORDER_APPOINTMENT,
  FIELD_DEFAULTS_APPOINTMENT,
  FIELD_LABELS_APPOINTMENT,
} from "./appointments-constants.js";

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
let viewMode = localStorage.getItem("appointmentView") || "table";
let sortBy = "";
let sortDir = "asc";

const sharedState = { currentEditIdRef: { value: null } };

/* ============================================================
   👁️ FIELD VISIBILITY
============================================================ */
let visibleFields = setupVisibleFields({
  moduleKey: "appointment",
  userRole,
  defaultFields: FIELD_DEFAULTS_APPOINTMENT,
  allowedFields: FIELD_ORDER_APPOINTMENT,
});

/* ============================================================
   🧩 FIELD SELECTOR
============================================================ */
renderFieldSelector(
  {},
  visibleFields,
  fields => {
    visibleFields = fields;
    renderDynamicTableHead(visibleFields);
    renderList({ entries, visibleFields, viewMode, user, currentPage });
  },
  FIELD_ORDER_APPOINTMENT
);

/* ============================================================
   🔎 FILTER DOM
============================================================ */
const qs = id => document.getElementById(id);

const globalSearch = qs("globalSearch");

const filterOrg = qs("filterOrganizationSelect");
const filterFacility = qs("filterFacilitySelect");
const filterDepartment = qs("filterDepartment");
const filterStatus = qs("filterStatus");

const filterPatient = qs("filterPatient");
const filterPatientId = qs("filterPatientId");
const filterPatientSuggestions = qs("filterPatientSuggestions");

const filterDoctor = qs("filterDoctor");
const filterDoctorId = qs("filterDoctorId");
const filterDoctorSuggestions = qs("filterDoctorSuggestions");

const dateRange = qs("dateRange");

/* ============================================================
   🔃 SORT BRIDGE
============================================================ */
window.setAppointmentSort = (field, dir) => {
  sortBy = field;
  sortDir = dir;
};
window.loadAppointmentPage = (p = 1) => loadEntries(p);

/* ============================================================
   📄 PAGINATION
============================================================ */
const getPagination = initPaginationControl(
  "appointment",
  loadEntries,
  Number(localStorage.getItem("appointmentPageLimit") || 25)
);

/* ============================================================
   🔎 AUTO SEARCH / FILTERS
============================================================ */
setupAutoSearch(globalSearch, loadEntries);

setupAutoFilters({
  searchInput: globalSearch,
  selectInputs: [
    filterStatus,
    filterOrg,
    filterFacility,
    filterDepartment,
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
    department_id: filterDepartment?.value,
    patient_id: filterPatientId?.value,
    doctor_id: filterDoctorId?.value,
    status: filterStatus?.value,
    dateRange: dateRange?.value,
  };
}

/* ============================================================
   📦 LOAD ENTRIES
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

    if (f.search) q.set("search", f.search);
    if (f.dateRange) q.set("dateRange", f.dateRange);

    [
      "organization_id",
      "facility_id",
      "department_id",
      "patient_id",
      "doctor_id",
      "status",
    ].forEach(k => f[k] && q.set(k, f[k]));

    const res = await authFetch(`/api/appointments?${q.toString()}`, {
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
        moduleLabel: "APPOINTMENTS",
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
    showToast("❌ Failed to load appointments");
  } finally {
    hideLoading();
  }
}

/* ============================================================
   🧭 VIEW TOGGLE
============================================================ */
qs("tableViewBtn").onclick = () => {
  viewMode = "table";
  localStorage.setItem("appointmentView", "table");
  syncViewToggleUI({ mode: viewMode });
  renderList({ entries, visibleFields, viewMode, user, currentPage });
};

qs("cardViewBtn").onclick = () => {
  viewMode = "card";
  localStorage.setItem("appointmentView", "card");
  syncViewToggleUI({ mode: viewMode });
  renderList({ entries, visibleFields, viewMode, user, currentPage });
};

/* ============================================================
   🔄 RESET FILTERS
============================================================ */
qs("resetFilterBtn").onclick = () => {
  [
    globalSearch,
    filterOrg,
    filterFacility,
    filterDepartment,
    filterStatus,
    filterPatient,
    filterPatientId,
    filterDoctor,
    filterDoctorId,
    dateRange,
  ].forEach(el => el && (el.value = "", el.dataset && (el.dataset.value = "")));

  filterPatientSuggestions.innerHTML = "";
  filterDoctorSuggestions.innerHTML = "";

  loadEntries(1);
};

/* ============================================================
   ⬇️ EXPORT
============================================================ */
qs("exportCSVBtn")?.addEventListener("click", () => {
  if (!entries.length) return showToast("❌ No data");
  exportToExcel(
    mapDataForExport(entries, visibleFields, FIELD_LABELS_APPOINTMENT),
    `appointments_${new Date().toISOString().slice(0, 10)}.csv`
  );
});

qs("exportPDFBtn")?.addEventListener("click", () => {
  exportToPDF(
    "Appointments List",
    viewMode === "table" ? ".table-container" : "#appointmentList",
    "landscape"
  );
});

/* ============================================================
   🚀 INIT
============================================================ */
export async function initAppointmentModule() {
  renderDynamicTableHead(visibleFields);

  setupToggleSection(
    "toggleFilterBtn",
    "filterCollapse",
    "filterChevron",
    "appointmentFilterVisible"
  );

  const enforce = i => {
    i.addEventListener("input", () => (i.dataset.value = ""));
    i.addEventListener("blur", () => !i.dataset.value && (i.value = ""));
  };
  [filterPatient, filterDoctor].forEach(enforce);

  setupSuggestionInputDynamic(
    filterPatient,
    filterPatientSuggestions,
    "/api/lite/patients",
    s => {
      filterPatient.value = s.label;
      filterPatientId.value = s.id;
      filterPatient.dataset.value = s.id;
      loadEntries(1);
    },
    "label"
  );

  setupSuggestionInputDynamic(
    filterDoctor,
    filterDoctorSuggestions,
    "/api/lite/employees",
    s => {
      filterDoctor.value = s.full_name;
      filterDoctorId.value = s.id;
      filterDoctor.dataset.value = s.id;
      loadEntries(1);
    },
    "full_name"
  );

  if (userRole.includes("super")) {
    const orgs = await loadOrganizationsLite();
    orgs.unshift({ id: "", name: "-- All Organizations --" });
    setupSelectOptions(filterOrg, orgs, "id", "name");

    const reloadFacilities = async orgId => {
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

  setupSelectOptions(
    filterDepartment,
    await loadDepartmentsLite({}, true),
    "id",
    "name",
    "-- All Departments --"
  );

  await loadEntries(1);
}

/* ============================================================
   🏁 BOOT
============================================================ */
document.readyState === "loading"
  ? document.addEventListener("DOMContentLoaded", initAppointmentModule)
  : initAppointmentModule();
