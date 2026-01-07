// 📦 patientchart-filter-main.js – Patient Chart Cache List + Filters (Enterprise-Aligned)

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

import {
  loadOrganizationsLite,
  loadFacilitiesLite,
  loadPatientsLite,
  setupSelectOptions,
  setupSuggestionInputDynamic,
} from "../../utils/data-loaders.js";

import { renderFieldSelector } from "../../utils/ui-utils.js";
import { exportToExcel, exportToPDF } from "../../utils/export-utils.js";
import { renderList, renderDynamicTableHead } from "./patientchart-render.js";
import { setupActionHandlers } from "./patientchart-actions.js";
import {
  FIELD_ORDER_PATIENT_CHART_CACHE,
  FIELD_DEFAULTS_PATIENT_CHART_CACHE,
} from "./patientchart-constants.js";
import { setupVisibleFields } from "../../utils/field-visibility.js";
import { initPaginationControl } from "../../utils/pagination-control.js";

/* ============================================================
   🔐 Auth Guard – Auto resolves "patient_charts:view"
============================================================ */
const token = initPageGuard(autoPagePermissionKey());
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

// no form on this page
window.showForm = () => {};
window.resetForm = () => {};

/* ============================================================
   🧩 Field Visibility + Selector
============================================================ */
window.entries = [];
let visibleFields = setupVisibleFields({
  moduleKey: "patientchart",
  userRole,
  defaultFields: FIELD_DEFAULTS_PATIENT_CHART_CACHE,
  allowedFields: FIELD_ORDER_PATIENT_CHART_CACHE,
});

renderFieldSelector(
  {},
  visibleFields,
  (newFields) => {
    visibleFields = newFields;
    renderDynamicTableHead(visibleFields);
    renderList({ entries, visibleFields, viewMode, user, currentPage });
  },
  FIELD_ORDER_PATIENT_CHART_CACHE
);

/* ============================================================
   🔎 Filter DOM Refs
============================================================ */
const filterOrg = document.getElementById("filterOrganizationSelect");
const filterFacility = document.getElementById("filterFacilitySelect");
const filterPatient = document.getElementById("filterPatient");
const filterPatientHidden = document.getElementById("filterPatientId");
const filterPatientSuggestions = document.getElementById("filterPatientSuggestions");
const filterStatus = document.getElementById("filterStatus");
const filterFrom = document.getElementById("filterFromDate");
const filterTo = document.getElementById("filterToDate");

const exportCSVBtn = document.getElementById("exportCSVBtn");
const exportPDFBtn = document.getElementById("exportPDFBtn");
const goGenerateBtn = document.getElementById("goGenerateBtn"); // ✅ NEW BUTTON

/* ============================================================
   🌍 View + Paging State
============================================================ */
let currentPage = 1;
let totalPages = 1;
let viewMode = localStorage.getItem("patientchartView") || "table";

/* ============================================================
   📋 Build Filter Object
============================================================ */
function getFilters() {
  return {
    organization_id: filterOrg?.value || "",
    facility_id: filterFacility?.value || "",
    patient_id: filterPatientHidden?.value || "",
    status: filterStatus?.value || "",
    from_date: filterFrom?.value || "",
    to_date: filterTo?.value || "",
  };
}

/* ============================================================
   🔁 Pagination Control Initialization
============================================================ */
const getPagination = initPaginationControl("patientchart", loadEntries, 25);

/* ============================================================
   📦 Load Patient Chart Cache Entries
============================================================ */
async function loadEntries(page = 1) {
  try {
    showLoading();
    const filters = getFilters();
    const q = new URLSearchParams();

    const { page: safePage, limit: safeLimit } = getPagination(page);
    q.append("page", safePage);
    q.append("limit", safeLimit);

    if (filters.from_date) q.append("generated_at[gte]", filters.from_date);
    if (filters.to_date) q.append("generated_at[lte]", filters.to_date);

    Object.entries(filters).forEach(([k, v]) => {
      if (!v || ["from_date", "to_date"].includes(k)) return;
      q.append(k, v);
    });

    const safeFields = visibleFields.filter((f) =>
      FIELD_ORDER_PATIENT_CHART_CACHE.includes(f)
    );
    if (safeFields.length) q.append("fields", safeFields.join(","));

    const res = await fetch(`/api/patient-chart?${q.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    let result = {};
    try {
      result = await res.json();
    } catch {
      console.warn("⚠️ Non-JSON response");
    }

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
    showToast("❌ Failed to load patient charts");
  } finally {
    hideLoading();
  }
}

/* ============================================================
   🧭 View Mode Toggle
============================================================ */
document.getElementById("tableViewBtn").onclick = () => {
  viewMode = "table";
  localStorage.setItem("patientchartView", "table");
  renderList({ entries, visibleFields, viewMode, user, currentPage });
};

document.getElementById("cardViewBtn").onclick = () => {
  viewMode = "card";
  localStorage.setItem("patientchartView", "card");
  renderList({ entries, visibleFields, viewMode, user, currentPage });
};

/* ============================================================
   🔍 Filter Actions
============================================================ */
document.getElementById("filterBtn").onclick = async () => {
  await loadEntries(1);
};

document.getElementById("resetFilterBtn").onclick = () => {
  ["filterPatient", "filterStatus", "filterFromDate", "filterToDate"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });
  if (filterPatientHidden) filterPatientHidden.value = "";

  if (userRole.includes("super")) {
    if (filterOrg) filterOrg.value = "";
    if (filterFacility) filterFacility.value = "";
  } else {
    const scopedOrgId = localStorage.getItem("organizationId");
    const scopedFacId = localStorage.getItem("facilityId");
    if (filterOrg) filterOrg.value = scopedOrgId || "";
    if (filterFacility) filterFacility.value = scopedFacId || "";
  }

  loadEntries(1);
};

/* ============================================================
   ⚙️ NEW: Go to Generate Cache Page
============================================================ */
if (goGenerateBtn) {
  goGenerateBtn.addEventListener("click", () => {
    window.location.href = "add-patientchart.html";
  });

  // Optional role-based visibility
  if (!["superadmin", "admin", "doctor"].includes(userRole)) {
    goGenerateBtn.classList.add("hidden");
  }
}

/* ============================================================
   ⬇️ Export Tools
============================================================ */
if (exportCSVBtn) {
  exportCSVBtn.onclick = () => {
    exportToExcel(
      entries,
      `patient_chart_cache_${new Date().toISOString().slice(0, 10)}.xlsx`
    );
  };
}

if (exportPDFBtn) {
  exportPDFBtn.onclick = () => {
    const target =
      viewMode === "table" ? ".table-container" : "#patientChartList";
    exportToPDF("Patient Chart Cache List", target, "portrait", true);
  };
}

/* ============================================================
   🚀 Init Module
============================================================ */
export async function initPatientChartModule() {
  renderDynamicTableHead(visibleFields);

  const filterCollapse = document.getElementById("filterCollapse");
  const filterChevron = document.getElementById("filterChevron");

  const filterVisible =
    localStorage.getItem("patientchartFilterVisible") === "true";
  if (filterVisible) {
    filterCollapse?.classList.remove("hidden");
    filterChevron?.classList.add("chevron-rotate");
  } else {
    filterCollapse?.classList.add("hidden");
    filterChevron?.classList.remove("chevron-rotate");
  }

  setupToggleSection(
    "toggleFilterBtn",
    "filterCollapse",
    "filterChevron",
    "patientchartFilterVisible"
  );

  /* ----------------- Suggestion Inputs ----------------- */
  setupSuggestionInputDynamic(
    filterPatient,
    filterPatientSuggestions,
    "/api/lite/patients",
    (selected) => {
      filterPatientHidden.value = selected?.id || "";
      if (selected)
        filterPatient.value =
          selected.label ||
          `${selected.first_name || ""} ${selected.last_name || ""}`.trim();
    },
    "label"
  );

  /* ----------------- Preload Orgs / Facilities ----------------- */
  try {
    const orgs = await loadOrganizationsLite();
    if (userRole.includes("super")) {
      orgs.unshift({ id: "", name: "-- All Organizations --" });
      setupSelectOptions(filterOrg, orgs, "id", "name");

      let facilities = await loadFacilitiesLite();
      facilities.unshift({ id: "", name: "-- All Facilities --" });
      setupSelectOptions(filterFacility, facilities, "id", "name");

      filterOrg?.addEventListener("change", async () => {
        const selectedOrgId = filterOrg.value;
        let facs = selectedOrgId
          ? await loadFacilitiesLite({ organization_id: selectedOrgId })
          : await loadFacilitiesLite();
        facs.unshift({ id: "", name: "-- All Facilities --" });
        setupSelectOptions(filterFacility, facs, "id", "name");
      });
    } else {
      const scopedOrgId = localStorage.getItem("organizationId");
      const scopedFacId = localStorage.getItem("facilityId");
      if (filterOrg) {
        const scopedOrg = orgs.find((o) => o.id === scopedOrgId);
        setupSelectOptions(filterOrg, scopedOrg ? [scopedOrg] : [], "id", "name");
        filterOrg.disabled = true;
        filterOrg.value = scopedOrgId || "";
      }
      const facilities = scopedOrgId
        ? await loadFacilitiesLite({ organization_id: scopedOrgId })
        : [];
      setupSelectOptions(filterFacility, facilities, "id", "name", "-- All Facilities --");
      if (scopedFacId) filterFacility.value = scopedFacId;
    }
  } catch (err) {
    console.error("❌ preload org/facility failed:", err);
  }

  await loadEntries(1);
}

/* ============================================================
   🏁 Boot
============================================================ */
function boot() {
  initPatientChartModule().catch((err) => {
    console.error("initPatientChartModule failed:", err);
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot);
} else {
  boot();
}
