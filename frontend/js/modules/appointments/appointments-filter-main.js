// 📦 appointment-filter-main.js – Filters + Table/Card (Enterprise Pattern Aligned)
// ============================================================================
// 🔹 Fully synchronized with appointments-list.html structure
// 🔹 Adds working Search, Clear, and View toggle buttons
// 🔹 Retains enterprise summary, pagination, export, and role logic
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
  loadDepartmentsLite,
  setupSelectOptions,
  setupSuggestionInputDynamic,
} from "../../utils/data-loaders.js";

import { renderFieldSelector } from "../../utils/ui-utils.js";
import { exportToExcel, exportToPDF } from "../../utils/export-utils.js";
import { renderList, renderDynamicTableHead } from "./appointments-render.js";
import { setupActionHandlers } from "./appointments-actions.js";
import {
  FIELD_ORDER_APPOINTMENT,
  FIELD_DEFAULTS_APPOINTMENT,
} from "./appointments-constants.js";
import { setupVisibleFields } from "../../utils/field-visibility.js";
import { initPaginationControl } from "../../utils/pagination-control.js";

/* ============================================================
   🔐 Auth Guard + Session
============================================================ */
const token = initPageGuard(autoPagePermissionKey());
initLogoutWatcher();

/* ============================================================
   👥 Role & Permissions
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
window.entries = [];

/* ============================================================
   🧩 Field Visibility
============================================================ */
let visibleFields = setupVisibleFields({
  moduleKey: "appointment",
  userRole,
  defaultFields: FIELD_DEFAULTS_APPOINTMENT,
  allowedFields: FIELD_ORDER_APPOINTMENT,
});

renderFieldSelector(
  {},
  visibleFields,
  (newFields) => {
    visibleFields = newFields;
    renderDynamicTableHead(visibleFields);
    renderList({ entries, visibleFields, viewMode, user, currentPage });
  },
  FIELD_ORDER_APPOINTMENT
);

/* ============================================================
   🔎 Filter DOM
============================================================ */
const filterOrg = document.getElementById("filterOrganizationSelect");
const filterFacility = document.getElementById("filterFacilitySelect");
const filterPatient = document.getElementById("filterPatient");
const filterPatientHidden = document.getElementById("filterPatientId");
const filterPatientSuggestions = document.getElementById("filterPatientSuggestions");
const filterDoctor = document.getElementById("filterDoctor");
const filterDoctorHidden = document.getElementById("filterDoctorId");
const filterDoctorSuggestions = document.getElementById("filterDoctorSuggestions");
const filterDepartment = document.getElementById("filterDepartment");
const filterStatus = document.getElementById("filterStatus");
const filterCreatedFrom = document.getElementById("filterCreatedFrom");
const filterCreatedTo = document.getElementById("filterCreatedTo");

const filterBtn = document.getElementById("filterBtn");
const resetFilterBtn = document.getElementById("resetFilterBtn");

const exportCSVBtn = document.getElementById("exportCSVBtn");
const exportPDFBtn = document.getElementById("exportPDFBtn");

/* ============================================================
   📊 Appointment Summary Renderer
============================================================ */
function renderModuleSummary(summary = {}) {
  const container = document.getElementById("moduleSummary");
  if (!container) return;

  const colorMap = {
    scheduled: "text-primary",
    in_progress: "text-warning",
    completed: "text-success",
    verified: "text-info",
    cancelled: "text-danger",
    no_show: "text-muted",
    voided: "text-danger",
    total: "text-dark fw-bold",
  };

  const formatValue = (val) => (val === null || val === undefined ? 0 : val);
  const keys = Object.keys(summary);
  if (!keys.length) {
    container.innerHTML = `<div class="text-muted small">No summary data</div>`;
    return;
  }

  container.innerHTML = `
    <div class="d-flex flex-wrap gap-3 justify-content-start align-items-center fw-semibold small mb-3">
      ${keys
        .map((key) => {
          const val = formatValue(summary[key]);
          const label = key.replace(/_/g, " ").toUpperCase();
          const color = colorMap[key] || "text-dark";
          return `<span class="${color}">${label}: ${val}</span>`;
        })
        .join('<span class="text-muted"> | </span>')}
    </div>
  `;
}

/* ============================================================
   🔁 Pagination / State
============================================================ */
let currentPage = 1;
let totalPages = 1;
let viewMode = localStorage.getItem("appointmentView") || "table";

const savedLimit = parseInt(localStorage.getItem("appointmentPageLimit") || "25", 10);
let getPagination = initPaginationControl("appointment", loadEntries, savedLimit);

const recordsPerPageSelect = document.getElementById("recordsPerPage");
if (recordsPerPageSelect) {
  recordsPerPageSelect.value = savedLimit;
  recordsPerPageSelect.addEventListener("change", async () => {
    const newLimit = parseInt(recordsPerPageSelect.value, 10);
    localStorage.setItem("appointmentPageLimit", newLimit);
    getPagination = initPaginationControl("appointment", loadEntries, newLimit);
    await loadEntries(1);
  });
}

/* ============================================================
   📋 Filters + Reset
============================================================ */
function getFilters() {
  return {
    organization_id: filterOrg?.value || "",
    facility_id: filterFacility?.value || "",
    patient_id: filterPatientHidden?.value || "",
    doctor_id: filterDoctorHidden?.value || "",
    department_id: filterDepartment?.value || "",
    status: filterStatus?.value || "",
    created_from: filterCreatedFrom?.value || "",
    created_to: filterCreatedTo?.value || "",
  };
}

function clearFilters() {
  [
    filterOrg,
    filterFacility,
    filterPatient,
    filterPatientHidden,
    filterDoctor,
    filterDoctorHidden,
    filterDepartment,
    filterStatus,
    filterCreatedFrom,
    filterCreatedTo,
  ].forEach((el) => {
    if (el) el.value = "";
  });
  if (filterPatientSuggestions) filterPatientSuggestions.innerHTML = "";
  if (filterDoctorSuggestions) filterDoctorSuggestions.innerHTML = "";
}

/* ============================================================
   📦 Load Appointments (with Summary)
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
      FIELD_ORDER_APPOINTMENT.includes(f)
    );
    if (safeFields.length) q.append("fields", safeFields.join(","));

    const res = await authFetch(`/api/appointments?${q.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    const result = await res.json().catch(() => ({}));
    const payload = result?.data || {};
    const records = Array.isArray(payload.records) ? payload.records : [];

    window.entries = records;
    currentPage = Number(payload.pagination?.page) || safePage;
    totalPages = Number(payload.pagination?.pageCount) || 1;

    renderList({ entries, visibleFields, viewMode, user, currentPage });
    if (payload.summary) renderModuleSummary(payload.summary);

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
    showToast("❌ Failed to load appointments");
  } finally {
    hideLoading();
  }
}

/* ============================================================
   🔘 Search & Clear Buttons
============================================================ */
if (filterBtn) filterBtn.addEventListener("click", async () => await loadEntries(1));

if (resetFilterBtn)
  resetFilterBtn.addEventListener("click", async () => {
    clearFilters();
    await loadEntries(1);
  });

/* ============================================================
   🪟 View Toggle (Table ↔ Card)
============================================================ */
const cardViewBtn = document.getElementById("cardViewBtn");
const tableViewBtn = document.getElementById("tableViewBtn");
const tableContainer = document.querySelector(".table-container");
const cardList = document.getElementById("appointmentList");

function setViewMode(mode) {
  viewMode = mode;
  localStorage.setItem("appointmentView", mode);

  if (mode === "table") {
    tableContainer?.classList.add("active");
    cardList?.classList.remove("active");
    tableViewBtn?.classList.add("active");
    cardViewBtn?.classList.remove("active");
  } else {
    tableContainer?.classList.remove("active");
    cardList?.classList.add("active");
    cardViewBtn?.classList.add("active");
    tableViewBtn?.classList.remove("active");
  }

  renderList({ entries, visibleFields, viewMode, user, currentPage });
}

cardViewBtn?.addEventListener("click", () => setViewMode("card"));
tableViewBtn?.addEventListener("click", () => setViewMode("table"));

/* ============================================================
   ⬇️ Export Tools (Summary-Inclusive)
============================================================ */
if (exportCSVBtn)
  exportCSVBtn.onclick = () =>
    exportToExcel(entries, `appointments_${new Date().toISOString().slice(0, 10)}.xlsx`);

if (exportPDFBtn)
  exportPDFBtn.onclick = () => {
    try {
      const targetSelector = viewMode === "table" ? ".table-container" : "#appointmentList";
      const target = document.querySelector(targetSelector);
      if (!target) return showToast("⚠️ Nothing to export");

      const summaryEl = document.getElementById("moduleSummary");
      const summaryHTML = summaryEl
        ? `<div class="export-summary mb-3 border rounded p-2 bg-light" 
              style="background:#fafafa;font-size:11px;text-align:center;">
              <h5 class="fw-bold mb-2">Appointment Summary</h5>
              ${summaryEl.innerHTML}
           </div>`
        : "";

      const combinedHTML = `<div id="exportWrapper">${summaryHTML}${target.outerHTML}</div>`;
      const tempDiv = document.createElement("div");
      tempDiv.innerHTML = combinedHTML;
      document.body.appendChild(tempDiv);

      exportToPDF("Appointment_List", "#exportWrapper", "portrait", true);
      setTimeout(() => tempDiv.remove(), 1200);
    } catch (err) {
      console.error("❌ exportPDF failed:", err);
      showToast("❌ Failed to export PDF");
    }
  };

/* ============================================================
   🚀 Init Module
============================================================ */
export async function initAppointmentModule() {
  renderDynamicTableHead(visibleFields);

  const filterCollapse = document.getElementById("filterCollapse");
  const filterChevron = document.getElementById("filterChevron");

  const filterVisible = localStorage.getItem("appointmentFilterVisible") === "true";
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
    "appointmentFilterVisible"
  );

  setupSuggestionInputDynamic(
    filterPatient,
    filterPatientSuggestions,
    "/api/lite/patients",
    (selected) => {
      filterPatientHidden.value = selected?.id || "";
      filterPatient.value = selected?.label || "";
    },
    "label"
  );

  setupSuggestionInputDynamic(
    filterDoctor,
    filterDoctorSuggestions,
    "/api/lite/employees",
    (selected) => {
      filterDoctorHidden.value = selected?.id || "";
      filterDoctor.value = selected?.full_name || "";
    },
    "full_name"
  );

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

    const depts = await loadDepartmentsLite({}, true);
    setupSelectOptions(filterDepartment, depts, "id", "name", "-- All Departments --");
  } catch (err) {
    console.error("❌ preload dropdowns failed:", err);
    showToast("❌ Failed to load filter dropdowns");
  }

  await loadEntries(1);
}

/* ============================================================
   🏁 Boot
============================================================ */
function boot() {
  initAppointmentModule().catch((err) =>
    console.error("initAppointmentModule failed:", err)
  );
}
if (document.readyState === "loading")
  document.addEventListener("DOMContentLoaded", boot);
else boot();
