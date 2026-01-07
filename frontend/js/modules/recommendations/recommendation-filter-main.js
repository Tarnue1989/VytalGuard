// 📦 recommendation-filter-main.js – Filters + Table/Card (no form)

import {
  showToast,
  showLoading,
  hideLoading,
  initPageGuard,
  setupToggleSection,
  renderPaginationControls,
  initLogoutWatcher,
} from "../../utils/index.js";

import {
  loadOrganizationsLite,
  loadFacilitiesLite,
  loadPatientsLite,
  loadEmployeesLite,
  loadDepartmentsLite,
  setupSelectOptions,
  setupSuggestionInputDynamic,
} from "../../utils/data-loaders.js";

import { renderFieldSelector } from "../../utils/ui-utils.js";
import { exportToExcel, exportToPDF } from "../../utils/export-utils.js";

import { renderList, renderDynamicTableHead } from "./recommendation-render.js";
import { setupActionHandlers } from "./recommendation-actions.js";

import {
  FIELD_ORDER_RECOMMENDATION,
  FIELD_DEFAULTS_RECOMMENDATION,
} from "./recommendation-constants.js";

import { setupVisibleFields } from "../../utils/field-visibility.js";

// 🔐 Auth
const token = initPageGuard("recommendations");
initLogoutWatcher();

// 📌 Role (normalized)
const roleRaw = localStorage.getItem("userRole") || "";
const userRole = roleRaw.trim().toLowerCase();

// ✅ Shared state
const sharedState = { currentEditIdRef: { value: null } };

// 🛟 No-form stubs
window.showForm = () => {};
window.resetForm = () => {};

// 📋 Field visibility
window.entries = [];
let visibleFields = setupVisibleFields({
  moduleKey: "recommendation",
  userRole,
  defaultFields: FIELD_DEFAULTS_RECOMMENDATION,
  allowedFields: FIELD_ORDER_RECOMMENDATION,
});

// 🧩 Field selector
renderFieldSelector(
  {},
  visibleFields,
  (newFields) => {
    visibleFields = newFields;
    renderDynamicTableHead(visibleFields);
    renderList({ entries, visibleFields, viewMode, userRole, currentPage });
  },
  FIELD_ORDER_RECOMMENDATION
);

// 🧩 Filter DOM Refs
const filterOrg = document.getElementById("filterOrganizationSelect");
const filterFacility = document.getElementById("filterFacilitySelect");
const filterPatient = document.getElementById("filterPatient");
const filterPatientHidden = document.getElementById("filterPatientId");
const filterPatientSuggestions = document.getElementById("filterPatientSuggestions");
const filterDoctor = document.getElementById("filterDoctor");
const filterDoctorHidden = document.getElementById("filterDoctorId");
const filterDoctorSuggestions = document.getElementById("filterDoctorSuggestions");
const filterDepartment = document.getElementById("filterDepartment");
const filterConsultation = document.getElementById("filterConsultation");
const filterStatus = document.getElementById("filterStatus");
const filterCreatedFrom = document.getElementById("filterCreatedFrom");
const filterCreatedTo = document.getElementById("filterCreatedTo");

// ⬇️ Export buttons
const exportCSVBtn = document.getElementById("exportCSVBtn");
const exportPDFBtn = document.getElementById("exportPDFBtn");

// 🌐 View & paging state
let currentPage = 1;
let totalPages = 1;
let viewMode = localStorage.getItem("recommendationView") || "table";

// 📋 Build filters
function getFilters() {
  return {
    organization_id: filterOrg?.value || "",
    facility_id: filterFacility?.value || "",
    patient_id: filterPatientHidden?.value || "",
    doctor_id: filterDoctorHidden?.value || "",
    department_id: filterDepartment?.value || "",
    consultation_id: filterConsultation?.value || "",
    status: filterStatus?.value || "",
    created_from: filterCreatedFrom?.value || "",
    created_to: filterCreatedTo?.value || "",
  };
}

// 📦 Load Recommendations
async function loadEntries(page = 1) {
  try {
    const filters = getFilters();
    const q = new URLSearchParams();

    if (filters.created_from) q.append("created_at[gte]", filters.created_from);
    if (filters.created_to) q.append("created_at[lte]", filters.created_to);

    Object.entries(filters).forEach(([k, v]) => {
      if (!v) return;
      if (k === "created_from" || k === "created_to") return;
      q.append(k, v);
    });

    const safeFields = visibleFields.filter((f) =>
      FIELD_ORDER_RECOMMENDATION.includes(f)
    );
    if (safeFields.length) {
      q.append("fields", safeFields.join(","));
    }

    const res = await fetch(`/api/recommendations?page=${page}&limit=10&${q}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    let result = {};
    try {
      result = await res.json();
    } catch {
      console.warn("⚠️ Response not JSON");
    }

    const payload = result?.data || {};
    const records = Array.isArray(payload.records) ? payload.records : [];

    window.entries = records;
    currentPage = Number(payload.pagination?.page) || 1;
    totalPages = Number(payload.pagination?.pageCount) || 1;

    renderList({ entries, visibleFields, viewMode, userRole, currentPage });

    setupActionHandlers({
      entries,
      token,
      currentPage,
      loadEntries,
      visibleFields,
      sharedState,
    });

    renderPaginationControls(
      document.getElementById("paginationButtons"),
      currentPage,
      totalPages,
      loadEntries
    );
  } catch (err) {
    console.error("❌ loadEntries failed:", err);
    showToast("❌ Failed to load recommendations");
  }
}

// 🧭 View toggle
document.getElementById("tableViewBtn").onclick = () => {
  viewMode = "table";
  localStorage.setItem("recommendationView", "table");
  renderList({ entries, visibleFields, viewMode, userRole, currentPage });
};

document.getElementById("cardViewBtn").onclick = () => {
  viewMode = "card";
  localStorage.setItem("recommendationView", "card");
  renderList({ entries, visibleFields, viewMode, userRole, currentPage });
};

// 🔎 Filter actions
document.getElementById("filterBtn").onclick = async () => {
  try {
    showLoading();
    await loadEntries(1);
  } finally {
    hideLoading();
  }
};

document.getElementById("resetFilterBtn").onclick = () => {
  [
    "filterPatient","filterDoctor","filterDepartment","filterConsultation",
    "filterStatus","filterCreatedFrom","filterCreatedTo"
  ].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });

  if (filterPatientHidden) filterPatientHidden.value = "";
  if (filterDoctorHidden) filterDoctorHidden.value = "";

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

// ⬇️ Export
if (exportCSVBtn) {
  exportCSVBtn.onclick = () => {
    exportToExcel(
      entries,
      `recommendations_${new Date().toISOString().slice(0, 10)}.xlsx`
    );
  };
}
if (exportPDFBtn) {
  exportPDFBtn.onclick = () => {
    const target =
      viewMode === "table" ? ".table-container" : "#recommendationList";
    exportToPDF("Recommendation List", target, "portrait", true);
  };
}

// 🚀 Init module
export async function initRecommendationModule() {
  renderDynamicTableHead(visibleFields);

  const filterCollapse = document.getElementById("filterCollapse");
  const filterChevron = document.getElementById("filterChevron");

  const filterVisible = localStorage.getItem("recommendationFilterVisible") === "true";
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
    "recommendationFilterVisible"
  );

  // ✅ Patient filter
  setupSuggestionInputDynamic(
    filterPatient,
    filterPatientSuggestions,
    "/api/lite/patients",
    (selected) => {
      filterPatientHidden.value = selected?.id || "";
      if (selected) {
        filterPatient.value = `${selected.first_name} ${selected.last_name}`;
      }
    },
    "full_name"
  );

  // ✅ Doctor filter
  setupSuggestionInputDynamic(
    filterDoctor,
    filterDoctorSuggestions,
    "/api/lite/employees",
    (selected) => {
      filterDoctorHidden.value = selected?.id || "";
      if (selected) {
        filterDoctor.value = `${selected.first_name} ${selected.last_name}`;
      }
    },
    "full_name"
  );

  // ✅ preload org + facilities
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

// ❌ no-op
export function syncRefsToState() {}

// ---- boot ----
function boot() {
  initRecommendationModule().catch((err) => {
    console.error("initRecommendationModule failed:", err);
  });
}
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot);
} else {
  boot();
}
