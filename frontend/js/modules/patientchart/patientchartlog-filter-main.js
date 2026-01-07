// 📘 patientchartlog-filter-main.js – Compliance Dashboard for Patient Chart Access Logs
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
  setupSelectOptions,
  setupSuggestionInputDynamic,
} from "../../utils/data-loaders.js";

import { renderFieldSelector } from "../../utils/ui-utils.js";
import { exportToExcel, exportToPDF } from "../../utils/export-utils.js";
import { renderViewLogs, renderDynamicLogTableHead } from "./patientchartlog-render.js";
import {
  FIELD_ORDER_PATIENT_CHART_VIEW_LOG,
  FIELD_DEFAULTS_PATIENT_CHART_VIEW_LOG,
} from "./patientchart-constants.js";
import { setupVisibleFields } from "../../utils/field-visibility.js";
import { initPaginationControl } from "../../utils/pagination-control.js";

/* ============================================================
   🔐 Auth Guard – Auto resolves "patient_chart_logs:view"
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
   🧠 State
============================================================ */
window.entries = [];
let visibleFields = setupVisibleFields({
  moduleKey: "patientchartlog",
  userRole,
  defaultFields: FIELD_DEFAULTS_PATIENT_CHART_VIEW_LOG,
  allowedFields: FIELD_ORDER_PATIENT_CHART_VIEW_LOG,
});

renderFieldSelector(
  {},
  visibleFields,
  (newFields) => {
    visibleFields = newFields;
    renderDynamicLogTableHead(visibleFields);
    renderViewLogs({ entries, visibleFields, viewMode, user, currentPage });
  },
  FIELD_ORDER_PATIENT_CHART_VIEW_LOG
);

/* ============================================================
   🔍 Filters
============================================================ */
const filterOrg = document.getElementById("filterOrganizationSelect");
const filterFacility = document.getElementById("filterFacilitySelect");
const filterPatient = document.getElementById("filterPatient");
const filterPatientHidden = document.getElementById("filterPatientId");
const filterPatientSuggestions = document.getElementById("filterPatientSuggestions");
const filterUser = document.getElementById("filterUser");
const filterUserHidden = document.getElementById("filterUserId");
const filterUserSuggestions = document.getElementById("filterUserSuggestions");
const filterAction = document.getElementById("filterAction");
const filterFrom = document.getElementById("filterFromDate");
const filterTo = document.getElementById("filterToDate");

const exportCSVBtn = document.getElementById("exportCSVBtn");
const exportPDFBtn = document.getElementById("exportPDFBtn");

let currentPage = 1;
let totalPages = 1;
let viewMode = localStorage.getItem("patientchartlogView") || "table";

/* ============================================================
   📋 Filter Builder
============================================================ */
function getFilters() {
  return {
    organization_id: filterOrg?.value || "",
    facility_id: filterFacility?.value || "",
    patient_id: filterPatientHidden?.value || "",
    user_id: filterUserHidden?.value || "",
    action: filterAction?.value || "",
    from: filterFrom?.value || "",
    to: filterTo?.value || "",
  };
}

/* ============================================================
   🔁 Pagination
============================================================ */
const getPagination = initPaginationControl("patientchartlog", loadEntries, 25);

/* ============================================================
   📦 Load Logs (Enterprise-compliant)
============================================================ */
async function loadEntries(page = 1) {
  try {
    showLoading();

    const filters = getFilters();
    const q = new URLSearchParams();
    const { page: safePage, limit: safeLimit } = getPagination(page);
    q.append("page", safePage);
    q.append("limit", safeLimit);

    // Date filters
    if (filters.from) q.append("viewed_at[gte]", filters.from);
    if (filters.to) q.append("viewed_at[lte]", filters.to);

    // Other filters
    Object.entries(filters).forEach(([k, v]) => {
      if (!v || ["from", "to"].includes(k)) return;
      q.append(k, v);
    });

    // Safe fields
    const safeFields = visibleFields.filter((f) =>
      FIELD_ORDER_PATIENT_CHART_VIEW_LOG.includes(f)
    );
    if (safeFields.length) q.append("fields", safeFields.join(","));

    // Require patient selection
    const patientId = filters.patient_id?.trim();
    if (!patientId) {
      hideLoading();
      renderViewLogs({ entries: [], visibleFields, viewMode, user, currentPage: 1 });
      showToast("⚠️ Please select a patient to view access logs.");
      return;
    }

    // Correct API endpoint
    const res = await fetch(`/api/patient-chart/patient/${patientId}/view-logs?${q.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
      throw new Error(`Server responded with ${res.status}`);
    }

    const result = await res.json().catch(() => ({}));
    const payload = result?.data || {};
    const records = Array.isArray(payload.records) ? payload.records : [];

    window.entries = records;
    currentPage = Number(payload.pagination?.page) || safePage;
    totalPages = Number(payload.pagination?.totalPages) || 1;

    renderViewLogs({ entries, visibleFields, viewMode, user, currentPage });

    renderPaginationControls(
      document.getElementById("paginationButtons"),
      currentPage,
      totalPages,
      loadEntries
    );
  } catch (err) {
    console.error("❌ Failed to load logs:", err);
    showToast("❌ Could not load patient chart view logs");
  } finally {
    hideLoading();
  }
}
/* ============================================================
   🔎 Filter & Reset Buttons
============================================================ */
document.getElementById("filterBtn")?.addEventListener("click", async () => {
  try {
    showLoading();
    await loadEntries(1);
  } finally {
    hideLoading();
  }
});

document.getElementById("resetFilterBtn")?.addEventListener("click", () => {
  [
    "filterPatient",
    "filterUser",
    "filterAction",
    "filterFromDate",
    "filterToDate"
  ].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });

  if (document.getElementById("filterPatientId"))
    document.getElementById("filterPatientId").value = "";
  if (document.getElementById("filterUserId"))
    document.getElementById("filterUserId").value = "";

  // Reset org/facility based on role
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
});

/* ============================================================
   ⬇️ Export
============================================================ */
if (exportCSVBtn) {
  exportCSVBtn.onclick = () =>
    exportToExcel(
      entries,
      `patientchart_logs_${new Date().toISOString().slice(0, 10)}.xlsx`
    );
}

if (exportPDFBtn) {
  exportPDFBtn.onclick = () => {
    const target =
      viewMode === "table" ? ".table-container" : "#patientChartLogList";
    exportToPDF("Patient Chart Access Logs", target, "portrait", true);
  };
}

/* ============================================================
   🚀 Init
============================================================ */
export async function initPatientChartLogModule() {
  renderDynamicLogTableHead(visibleFields);

  const filterCollapse = document.getElementById("filterCollapse");
  const filterChevron = document.getElementById("filterChevron");

  const filterVisible =
    localStorage.getItem("patientchartlogFilterVisible") === "true";
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
    "patientchartlogFilterVisible"
  );

  /* Patient & User Suggestions */
  /* Patient & User Suggestions (vital-style dropdown behavior) */
  setupSuggestionInputDynamic(
    filterPatient,
    filterPatientSuggestions,
    "/api/lite/patients",
    (selected) => {
      filterPatientHidden.value = selected?.id || "";
      if (selected) {
        // ✅ Use label if present, else build friendly string
        filterPatient.value =
          selected.label ||
          (selected.pat_no && selected.full_name
            ? `${selected.pat_no} - ${selected.full_name}`
            : selected.full_name || selected.pat_no || "");
      }
    },
    "label"
  );


  setupSuggestionInputDynamic(
    filterUser,
    filterUserSuggestions,
    "/api/lite/employees",
    (selected) => {
      filterUserHidden.value = selected?.id || "";
      filterUser.value =
        selected.full_name ||
        `${selected.first_name || ""} ${selected.last_name || ""}`.trim();
    },
    "full_name"
  );

  /* Org & Facility preload */
  try {
    const orgs = await loadOrganizationsLite();
    if (userRole.includes("super")) {
      orgs.unshift({ id: "", name: "-- All Organizations --" });
      setupSelectOptions(filterOrg, orgs, "id", "name");

      let facilities = await loadFacilitiesLite();
      facilities.unshift({ id: "", name: "-- All Facilities --" });
      setupSelectOptions(filterFacility, facilities, "id", "name");
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
      setupSelectOptions(filterFacility, facilities, "id", "name");
      if (scopedFacId) filterFacility.value = scopedFacId;
    }
  } catch (err) {
    console.error("❌ preload org/facility failed:", err);
  }

  await loadEntries(1);
  /* ============================================================
     🔁 View Toggle Controls (Table ↔ Cards)
  ============================================================ */
  const tableBtn = document.getElementById("tableViewBtn");
  const cardBtn = document.getElementById("cardViewBtn");
  let currentViewMode = viewMode; // use stored mode or "table"

  // Initial button states
  if (currentViewMode === "card") {
    tableBtn?.classList.remove("active");
    cardBtn?.classList.add("active");
  } else {
    tableBtn?.classList.add("active");
    cardBtn?.classList.remove("active");
  }

  tableBtn?.addEventListener("click", () => {
    if (currentViewMode === "table") return;
    currentViewMode = "table";
    localStorage.setItem("patientchartlogView", "table");
    renderViewLogs({ entries, visibleFields, viewMode: "table", user, currentPage });
  });

  cardBtn?.addEventListener("click", () => {
    if (currentViewMode === "card") return;
    currentViewMode = "card";
    localStorage.setItem("patientchartlogView", "card");
    renderViewLogs({ entries, visibleFields, viewMode: "card", user, currentPage });
  });

}

/* ============================================================
   🏁 Boot
============================================================ */
function boot() {
  initPatientChartLogModule().catch((err) => {
    console.error("initPatientChartLogModule failed:", err);
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot);
} else {
  boot();
}
