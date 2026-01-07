// 📘 patientchartnote-filter-main.js – Patient Chart Notes List + Filters (Enterprise Aligned)

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
  loadEmployeesLite,
  setupSelectOptions,
  setupSuggestionInputDynamic,
} from "../../utils/data-loaders.js";

import { renderFieldSelector } from "../../utils/ui-utils.js";
import { exportToExcel, exportToPDF } from "../../utils/export-utils.js";
import {
  renderPatientNotesList,
  renderDynamicNoteTableHead,
} from "./patientchartnote-render.js";
import {
  FIELD_ORDER_PATIENT_CHART_NOTE,
  FIELD_DEFAULTS_PATIENT_CHART_NOTE,
} from "./patientchart-constants.js";
import { setupVisibleFields } from "../../utils/field-visibility.js";
import { initPaginationControl } from "../../utils/pagination-control.js";
// 🩺 Add Note Button → open modal form
import { openNoteFormModal } from "./patientchartnote-form.js";
/* ============================================================
   🔐 Auth Guard – Auto resolves "patient_chart_notes:view"
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
window.entries = [];
let visibleFields = setupVisibleFields({
  moduleKey: "patientchartnote",
  userRole,
  defaultFields: FIELD_DEFAULTS_PATIENT_CHART_NOTE,
  allowedFields: FIELD_ORDER_PATIENT_CHART_NOTE,
});

renderFieldSelector(
  {},
  visibleFields,
  (newFields) => {
    visibleFields = newFields;
    renderDynamicNoteTableHead(visibleFields);
    renderPatientNotesList({ entries, visibleFields, viewMode, user, currentPage });
  },
  FIELD_ORDER_PATIENT_CHART_NOTE
);

/* ============================================================
   🔍 Filter DOM Refs
============================================================ */
const filterOrg = document.getElementById("filterOrganizationSelect");
const filterFacility = document.getElementById("filterFacilitySelect");
const filterPatient = document.getElementById("filterPatient");
const filterPatientHidden = document.getElementById("filterPatientId");
const filterPatientSuggestions = document.getElementById("filterPatientSuggestions");
const filterAuthor = document.getElementById("filterAuthor");
const filterAuthorHidden = document.getElementById("filterAuthorId");
const filterAuthorSuggestions = document.getElementById("filterAuthorSuggestions");
const filterNoteType = document.getElementById("filterNoteType");
const filterStatus = document.getElementById("filterStatus");
const filterFrom = document.getElementById("filterFromDate");
const filterTo = document.getElementById("filterToDate");

const exportCSVBtn = document.getElementById("exportCSVBtn");
const exportPDFBtn = document.getElementById("exportPDFBtn");

/* ============================================================
   🌍 View + Pagination State
============================================================ */
let currentPage = 1;
let totalPages = 1;
let viewMode = localStorage.getItem("patientchartnoteView") || "table";

/* ============================================================
   📋 Build Filter Object
============================================================ */
function getFilters() {
  return {
    organization_id: filterOrg?.value || "",
    facility_id: filterFacility?.value || "",
    patient_id: filterPatientHidden?.value || "",
    author_id: filterAuthorHidden?.value || "",
    note_type: filterNoteType?.value || "",
    status: filterStatus?.value || "",
    from_date: filterFrom?.value || "",
    to_date: filterTo?.value || "",
  };
}

/* ============================================================
   🔁 Pagination Control Initialization
============================================================ */
const getPagination = initPaginationControl("patientchartnote", loadEntries, 25);

/* ============================================================
   📦 Load Notes (Enterprise-compliant)
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
    if (filters.from_date) q.append("created_at[gte]", filters.from_date);
    if (filters.to_date) q.append("created_at[lte]", filters.to_date);

    // Other filters
    Object.entries(filters).forEach(([k, v]) => {
      if (!v || ["from_date", "to_date"].includes(k)) return;
      q.append(k, v);
    });

    // Safe fields
    const safeFields = visibleFields.filter((f) =>
      FIELD_ORDER_PATIENT_CHART_NOTE.includes(f)
    );
    if (safeFields.length) q.append("fields", safeFields.join(","));

    const res = await fetch(`/api/patient-chart/notes?${q.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    const result = await res.json().catch(() => ({}));
    const payload = result?.data || {};
    const records = Array.isArray(payload.records) ? payload.records : [];

    window.entries = records;
    currentPage = Number(payload.pagination?.page) || safePage;
    totalPages = Number(payload.pagination?.pageCount) || 1;

    renderPatientNotesList({ entries, visibleFields, viewMode, user, currentPage });

    renderPaginationControls(
      document.getElementById("paginationButtons"),
      currentPage,
      totalPages,
      loadEntries
    );
  } catch (err) {
    console.error("❌ loadEntries failed:", err);
    showToast("❌ Failed to load patient chart notes");
  } finally {
    hideLoading();
  }
}

/* ============================================================
   🧭 View Mode Toggle
============================================================ */
document.getElementById("tableViewBtn").onclick = () => {
  viewMode = "table";
  localStorage.setItem("patientchartnoteView", "table");
  renderPatientNotesList({ entries, visibleFields, viewMode, user, currentPage });
};

document.getElementById("cardViewBtn").onclick = () => {
  viewMode = "card";
  localStorage.setItem("patientchartnoteView", "card");
  renderPatientNotesList({ entries, visibleFields, viewMode, user, currentPage });
};

/* ============================================================
   🔍 Filter Actions
============================================================ */
document.getElementById("filterBtn").onclick = async () => {
  await loadEntries(1);
};

document.getElementById("resetFilterBtn").onclick = () => {
  [
    "filterPatient",
    "filterAuthor",
    "filterNoteType",
    "filterStatus",
    "filterFromDate",
    "filterToDate",
  ].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });
  if (filterPatientHidden) filterPatientHidden.value = "";
  if (filterAuthorHidden) filterAuthorHidden.value = "";

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
   ⬇️ Export Tools
============================================================ */
if (exportCSVBtn) {
  exportCSVBtn.onclick = () => {
    exportToExcel(
      entries,
      `patientchart_notes_${new Date().toISOString().slice(0, 10)}.xlsx`
    );
  };
}

if (exportPDFBtn) {
  exportPDFBtn.onclick = () => {
    const target =
      viewMode === "table" ? ".table-container" : "#patientChartNoteList";
    exportToPDF("Patient Chart Notes", target, "portrait", true);
  };
}

/* ============================================================
   🚀 Init Module
============================================================ */
export async function initPatientChartNoteModule() {
  renderDynamicNoteTableHead(visibleFields);

  const filterCollapse = document.getElementById("filterCollapse");
  const filterChevron = document.getElementById("filterChevron");

  const filterVisible =
    localStorage.getItem("patientchartnoteFilterVisible") === "true";
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
    "patientchartnoteFilterVisible"
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

  setupSuggestionInputDynamic(
    filterAuthor,
    filterAuthorSuggestions,
    "/api/lite/employees",
    (selected) => {
      filterAuthorHidden.value = selected?.id || "";
      if (selected)
        filterAuthor.value =
          selected.full_name ||
          `${selected.first_name || ""} ${selected.last_name || ""}`.trim();
    },
    "full_name"
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

document.getElementById("addNoteBtn")?.addEventListener("click", () => {
  const patientId =
    document.getElementById("filterPatientId")?.value ||
    new URLSearchParams(window.location.search).get("patient_id") ||
    null;

  openNoteFormModal({
    patient_id: patientId,
    onSuccess: () => loadEntries(currentPage),
  });
});

/* ============================================================
   🏁 Boot
============================================================ */
function boot() {
  initPatientChartNoteModule().catch((err) => {
    console.error("initPatientChartNoteModule failed:", err);
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot);
} else {
  boot();
}
