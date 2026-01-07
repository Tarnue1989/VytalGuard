// 📦 medicalRecord-filter-main.js – Filters + Table/Card (Enterprise-Aligned)
// ============================================================================
// 🧭 Master Pattern: consultation-filter-main.js
// Mirrors the full enterprise structure (permissions, pagination,
// toggle sections, exports, field selector, and role-aware visibility).
// ============================================================================

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

import { authFetch } from "../../authSession.js";
import {
  loadOrganizationsLite,
  loadFacilitiesLite,
  loadPatientsLite,
  loadEmployeesLite,
  loadConsultationsLite,
  loadRegistrationLogsLite,
  setupSelectOptions,
  setupSuggestionInputDynamic,
} from "../../utils/data-loaders.js";

import { renderFieldSelector } from "../../utils/ui-utils.js";
import { exportToExcel, exportToPDF } from "../../utils/export-utils.js";
import { renderList, renderDynamicTableHead } from "./medical-record-render.js";
import { setupActionHandlers } from "./medical-record-actions.js";
import {
  FIELD_ORDER_MEDICAL_RECORD,
  FIELD_DEFAULTS_MEDICAL_RECORD,
} from "./medical-record-constants.js";
import { setupVisibleFields } from "../../utils/field-visibility.js";
import { initPaginationControl } from "../../utils/pagination-control.js";

/* ============================================================
   🔐 Auth Guard
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
window.showForm = () => {};
window.resetForm = () => {};

/* ============================================================
   🧩 Field Visibility + Selector
============================================================ */
window.entries = [];
let visibleFields = setupVisibleFields({
  moduleKey: "medical-record",
  userRole,
  defaultFields: FIELD_DEFAULTS_MEDICAL_RECORD,
  allowedFields: FIELD_ORDER_MEDICAL_RECORD,
});

renderFieldSelector(
  {},
  visibleFields,
  (newFields) => {
    visibleFields = newFields;
    renderDynamicTableHead(visibleFields);
    renderList({ entries, visibleFields, viewMode, user, currentPage });
  },
  FIELD_ORDER_MEDICAL_RECORD
);

/* ============================================================
   🔎 Filter DOM Refs
============================================================ */
const filterOrg = document.getElementById("filterOrganizationSelect");
const filterFacility = document.getElementById("filterFacilitySelect");
const filterPatient = document.getElementById("filterPatient");
const filterPatientHidden = document.getElementById("filterPatientId");
const filterPatientSuggestions = document.getElementById("filterPatientSuggestions");
const filterDoctor = document.getElementById("filterDoctor");
const filterDoctorHidden = document.getElementById("filterDoctorId");
const filterDoctorSuggestions = document.getElementById("filterDoctorSuggestions");
const filterConsultation = document.getElementById("filterConsultation");
const filterConsultationHidden = document.getElementById("filterConsultationId");
const filterConsultationSuggestions = document.getElementById("filterConsultationSuggestions");
const filterRegistrationLog = document.getElementById("filterRegistrationLog");
const filterRegistrationLogHidden = document.getElementById("filterRegistrationLogId");
const filterRegistrationLogSuggestions = document.getElementById("filterRegistrationLogSuggestions");
const filterStatus = document.getElementById("filterStatus");
const filterEmergency = document.getElementById("filterEmergency");
const filterCreatedFrom = document.getElementById("filterCreatedFrom");
const filterCreatedTo = document.getElementById("filterCreatedTo");

const exportCSVBtn = document.getElementById("exportCSVBtn");
const exportPDFBtn = document.getElementById("exportPDFBtn");

/* ============================================================
   🌍 View + Pagination
============================================================ */
let currentPage = 1;
let totalPages = 1;
let viewMode = localStorage.getItem("medicalRecordView") || "table";
const getPagination = initPaginationControl("medicalRecord", loadEntries, 25);

/* ============================================================
   📋 Build Filter Object
============================================================ */
function getFilters() {
  return {
    organization_id: filterOrg?.value || "",
    facility_id: filterFacility?.value || "",
    patient_id: filterPatientHidden?.value || "",
    doctor_id: filterDoctorHidden?.value || "",
    consultation_id: filterConsultationHidden?.value || "",
    registration_log_id: filterRegistrationLogHidden?.value || "",
    status: filterStatus?.value || "",
    is_emergency: filterEmergency?.value || "",
    created_from: filterCreatedFrom?.value || "",
    created_to: filterCreatedTo?.value || "",
  };
}

/* ============================================================
   📦 Load Medical Records
============================================================ */
async function loadEntries(page = 1) {
  try {
    showLoading();
    const filters = getFilters();
    const q = new URLSearchParams();

    const { page: safePage, limit: safeLimit } = getPagination(page);
    q.append("page", safePage);
    q.append("limit", safeLimit);

    if (filters.created_from) q.append("created_at[gte]", filters.created_from);
    if (filters.created_to) q.append("created_at[lte]", filters.created_to);

    Object.entries(filters).forEach(([k, v]) => {
      if (!v || ["created_from", "created_to"].includes(k)) return;
      q.append(k, v);
    });

    const safeFields = visibleFields.filter((f) =>
      FIELD_ORDER_MEDICAL_RECORD.includes(f)
    );
    if (safeFields.length) q.append("fields", safeFields.join(","));

    const res = await authFetch(`/api/medical-records?${q.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const result = await res.json().catch(() => ({}));

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

    if (!records.length) showToast("ℹ️ No medical records found for current filters");
  } catch (err) {
    console.error("❌ loadEntries failed:", err);
    showToast("❌ Failed to load medical records");
  } finally {
    hideLoading();
  }
}

/* ============================================================
   🧭 View Toggle (Table ↔ Card)
============================================================ */
document.getElementById("tableViewBtn").onclick = () => {
  viewMode = "table";
  localStorage.setItem("medicalRecordView", "table");
  renderList({ entries, visibleFields, viewMode, user, currentPage });
  document.getElementById("tableViewBtn")?.classList.add("active");
  document.getElementById("cardViewBtn")?.classList.remove("active");
};

document.getElementById("cardViewBtn").onclick = () => {
  viewMode = "card";
  localStorage.setItem("medicalRecordView", "card");
  renderList({ entries, visibleFields, viewMode, user, currentPage });
  document.getElementById("cardViewBtn")?.classList.add("active");
  document.getElementById("tableViewBtn")?.classList.remove("active");
};

/* ============================================================
   🔍 Filter Actions
============================================================ */
document.getElementById("filterBtn").onclick = async () => await loadEntries(1);
document.getElementById("resetFilterBtn").onclick = () => {
  [
    filterPatient,
    filterDoctor,
    filterConsultation,
    filterRegistrationLog,
    filterStatus,
    filterEmergency,
    filterCreatedFrom,
    filterCreatedTo,
  ].forEach((el) => (el ? (el.value = "") : null));
  filterPatientHidden.value = "";
  filterDoctorHidden.value = "";
  filterConsultationHidden.value = "";
  filterRegistrationLogHidden.value = "";
  loadEntries(1);
};

/* ============================================================
   ⬇️ Export Tools
============================================================ */
if (exportCSVBtn)
  exportCSVBtn.onclick = () =>
    exportToExcel(entries, `medical_records_${new Date().toISOString().slice(0, 10)}.xlsx`);

if (exportPDFBtn)
  exportPDFBtn.onclick = () => {
    const target = viewMode === "table" ? ".table-container" : "#medicalRecordList";
    exportToPDF("Medical Record List", target, "portrait", true);
  };

/* ============================================================
   🚀 Init Module
============================================================ */
export async function initMedicalRecordModule() {
  renderDynamicTableHead(visibleFields);

  const filterCollapse = document.getElementById("filterCollapse");
  const filterChevron = document.getElementById("filterChevron");

  const filterVisible = localStorage.getItem("medicalRecordFilterVisible") === "true";
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
    "medicalRecordFilterVisible"
  );

  /* -------------------- Suggestions -------------------- */
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

  if (userRole.includes("super")) {
    setupSuggestionInputDynamic(
      filterDoctor,
      filterDoctorSuggestions,
      "/api/lite/employees",
      (selected) => {
        filterDoctorHidden.value = selected?.id || "";
        if (selected)
          filterDoctor.value =
            selected.full_name ||
            `${selected.first_name || ""} ${selected.last_name || ""}`.trim();
      },
      "full_name"
    );
  } else {
    document.getElementById("filterDoctor")?.closest(".form-group")?.classList.add("hidden");
  }

  setupSuggestionInputDynamic(
    filterConsultation,
    filterConsultationSuggestions,
    "/api/lite/consultations",
    (selected) => {
      filterConsultationHidden.value = selected?.id || "";
      if (selected) filterConsultation.value = selected.label || selected.diagnosis || "";
    },
    "label"
  );

  setupSuggestionInputDynamic(
    filterRegistrationLog,
    filterRegistrationLogSuggestions,
    "/api/lite/registration-logs",
    (selected) => {
      filterRegistrationLogHidden.value = selected?.id || "";
      if (selected) filterRegistrationLog.value = selected.label || "";
    },
    "label"
  );

  /* -------------------- Org & Facilities -------------------- */
  try {
    if (userRole.includes("super")) {
      const orgs = await loadOrganizationsLite();
      orgs.unshift({ id: "", name: "-- All Organizations --" });
      setupSelectOptions(filterOrg, orgs, "id", "name");

      async function reloadFacilities(orgId = null) {
        const facs = await loadFacilitiesLite(orgId ? { organization_id: orgId } : {}, true);
        facs.unshift({ id: "", name: "-- All Facilities --" });
        setupSelectOptions(filterFacility, facs, "id", "name");
      }

      await reloadFacilities();
      filterOrg?.addEventListener("change", async () => {
        await reloadFacilities(filterOrg.value || null);
      });
    } else if (userRole.includes("admin")) {
      filterOrg?.closest(".form-group")?.classList.add("hidden");
      const facs = await loadFacilitiesLite({}, true);
      facs.unshift({ id: "", name: "-- All Facilities --" });
      setupSelectOptions(filterFacility, facs, "id", "name");
    } else {
      filterOrg?.closest(".form-group")?.classList.add("hidden");
      filterFacility?.closest(".form-group")?.classList.add("hidden");
    }
  } catch (err) {
    console.error("❌ preload org/facility failed:", err);
    showToast("❌ Failed to load filter dropdowns");
  }

  await loadEntries(1);
}

/* ============================================================
   🏁 Boot
============================================================ */
function boot() {
  initMedicalRecordModule().catch((err) =>
    console.error("initMedicalRecordModule failed:", err)
  );
}
if (document.readyState === "loading")
  document.addEventListener("DOMContentLoaded", boot);
else boot();
