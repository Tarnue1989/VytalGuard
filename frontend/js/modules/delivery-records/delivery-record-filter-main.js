// 📦 delivery-record-filter-main.js – Filters + Table/Card (enterprise-aligned with Central Stock)

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
  loadDepartmentsLite,
  loadBillableItemsLite,
  setupSelectOptions,
  setupSuggestionInputDynamic,
} from "../../utils/data-loaders.js";

import { renderFieldSelector } from "../../utils/ui-utils.js";
import { exportToExcel, exportToPDF } from "../../utils/export-utils.js";
import { renderList, renderDynamicTableHead } from "./delivery-record-render.js";
import { setupActionHandlers } from "./delivery-record-actions.js";
import {
  FIELD_ORDER_DELIVERY_RECORD,
  FIELD_DEFAULTS_DELIVERY_RECORD,
} from "./delivery-record-constants.js";
import { setupVisibleFields } from "../../utils/field-visibility.js";

// 🔐 Auth → automatically detect correct permission (e.g. "delivery_records:view")
const token = initPageGuard(autoPagePermissionKey());
initLogoutWatcher();

// 📌 Role (normalized)
const roleRaw = localStorage.getItem("userRole") || "";
const userRole = roleRaw.trim().toLowerCase();

// 🔑 Permissions from storage
const perms = JSON.parse(localStorage.getItem("permissions") || "[]");
let user = { role: userRole, permissions: perms };

// ✅ Shared state
const sharedState = { currentEditIdRef: { value: null } };

// 🛟 No-form stubs
window.showForm = () => {};
window.resetForm = () => {};

// 📋 Field visibility
window.entries = [];
let visibleFields = setupVisibleFields({
  moduleKey: "delivery_record",
  userRole,
  defaultFields: FIELD_DEFAULTS_DELIVERY_RECORD,
  allowedFields: FIELD_ORDER_DELIVERY_RECORD,
});

// 🧩 Field selector
renderFieldSelector(
  {},
  visibleFields,
  (newFields) => {
    visibleFields = newFields;
    renderDynamicTableHead(visibleFields);
    renderList({ entries, visibleFields, viewMode, user, currentPage });
  },
  FIELD_ORDER_DELIVERY_RECORD
);

/* ============================================================
   🧩 Filter DOM Refs
============================================================ */
const filterOrg = document.getElementById("filterOrganizationSelect");
const filterFacility = document.getElementById("filterFacilitySelect");
const filterPatient = document.getElementById("filterPatient");
const filterPatientHidden = document.getElementById("filterPatientId");
const filterPatientSuggestions = document.getElementById("filterPatientSuggestions");
const filterDoctor = document.getElementById("filterDoctor");
const filterDoctorHidden = document.getElementById("filterDoctorId");
const filterDoctorSuggestions = document.getElementById("filterDoctorSuggestions");
const filterMidwife = document.getElementById("filterMidwife");
const filterMidwifeHidden = document.getElementById("filterMidwifeId");
const filterMidwifeSuggestions = document.getElementById("filterMidwifeSuggestions");
const filterDepartment = document.getElementById("filterDepartmentSelect");
const filterConsultation = document.getElementById("filterConsultationSelect");
const filterBillableItem = document.getElementById("filterBillableItemSelect");
const filterStatus = document.getElementById("filterStatus");
const filterCreatedFrom = document.getElementById("filterCreatedFrom");
const filterCreatedTo = document.getElementById("filterCreatedTo");

// ⬇️ Export buttons
const exportCSVBtn = document.getElementById("exportCSVBtn");
const exportPDFBtn = document.getElementById("exportPDFBtn");

// 🌐 View & paging state
let currentPage = 1;
let totalPages = 1;
let viewMode = localStorage.getItem("deliveryRecordView") || "table";

/* ============================================================
   📋 Build Filters
============================================================ */
function getFilters() {
  return {
    organization_id: filterOrg?.value || "",
    facility_id: filterFacility?.value || "",
    patient_id: filterPatientHidden?.value || "",
    doctor_id: filterDoctorHidden?.value || "",
    midwife_id: filterMidwifeHidden?.value || "",
    department_id: filterDepartment?.value || "",
    consultation_id: filterConsultation?.value || "",
    billable_item_id: filterBillableItem?.value || "",
    status: filterStatus?.value || "",
    created_from: filterCreatedFrom?.value || "",
    created_to: filterCreatedTo?.value || "",
  };
}

/* ============================================================
   📦 Load Delivery Records
============================================================ */
async function loadEntries(page = 1) {
  try {
    const filters = getFilters();
    const q = new URLSearchParams();

    if (filters.created_from) q.append("created_at[gte]", filters.created_from);
    if (filters.created_to) q.append("created_at[lte]", filters.created_to);

    Object.entries(filters).forEach(([k, v]) => {
      if (!v || k === "created_from" || k === "created_to") return;
      q.append(k, v);
    });

    const safeFields = visibleFields.filter((f) =>
      FIELD_ORDER_DELIVERY_RECORD.includes(f)
    );
    if (safeFields.length) q.append("fields", safeFields.join(","));

    const res = await fetch(`/api/delivery-records?page=${page}&limit=10&${q}`, {
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
    currentPage = Number(payload.pagination?.page) || 1;
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
    showToast("❌ Failed to load delivery records");
  }
}

/* ============================================================
   🧭 View toggle
============================================================ */
document.getElementById("tableViewBtn").onclick = () => {
  viewMode = "table";
  localStorage.setItem("deliveryRecordView", "table");
  renderList({ entries, visibleFields, viewMode, user, currentPage });
};

document.getElementById("cardViewBtn").onclick = () => {
  viewMode = "card";
  localStorage.setItem("deliveryRecordView", "card");
  renderList({ entries, visibleFields, viewMode, user, currentPage });
};

/* ============================================================
   🔍 Filter actions
============================================================ */
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
    "filterPatient","filterDoctor","filterMidwife","filterDepartment",
    "filterConsultation","filterBillableItem","filterStatus",
    "filterCreatedFrom","filterCreatedTo"
  ].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });

  if (filterPatientHidden) filterPatientHidden.value = "";
  if (filterDoctorHidden) filterDoctorHidden.value = "";
  if (filterMidwifeHidden) filterMidwifeHidden.value = "";

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
   ⬇️ Export
============================================================ */
if (exportCSVBtn)
  exportCSVBtn.onclick = () => {
    exportToExcel(entries, `delivery_records_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

if (exportPDFBtn)
  exportPDFBtn.onclick = () => {
    const target = viewMode === "table" ? ".table-container" : "#deliveryRecordList";
    exportToPDF("Delivery Record List", target, "portrait", true);
  };

/* ============================================================
   🚀 Init module
============================================================ */
export async function initDeliveryRecordModule() {
  renderDynamicTableHead(visibleFields);

  const filterCollapse = document.getElementById("filterCollapse");
  const filterChevron = document.getElementById("filterChevron");
  const filterVisible = localStorage.getItem("deliveryRecordFilterVisible") === "true";

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
    "deliveryRecordFilterVisible"
  );

  // ✅ Patient filter
  setupSuggestionInputDynamic(
    filterPatient,
    filterPatientSuggestions,
    "/api/lite/patients",
    (selected) => {
      filterPatientHidden.value = selected?.id || "";
      if (selected) {
        filterPatient.value =
          selected.label ||
          (selected.pat_no && selected.full_name
            ? `${selected.pat_no} - ${selected.full_name}`
            : selected.full_name || selected.pat_no || "");
      }
    },
    "label"
  );

  // ✅ Doctor filter
  setupSuggestionInputDynamic(
    filterDoctor,
    filterDoctorSuggestions,
    "/api/lite/employees",
    (selected) => {
      filterDoctorHidden.value = selected?.id || "";
      if (selected) {
        filterDoctor.value =
          selected.full_name ||
          `${selected.first_name || ""} ${selected.last_name || ""}`.trim();
      }
    },
    "full_name"
  );

  // ✅ Midwife filter
  setupSuggestionInputDynamic(
    filterMidwife,
    filterMidwifeSuggestions,
    "/api/lite/employees",
    (selected) => {
      filterMidwifeHidden.value = selected?.id || "";
      if (selected) {
        filterMidwife.value =
          selected.full_name ||
          `${selected.first_name || ""} ${selected.last_name || ""}`.trim();
      }
    },
    "full_name"
  );

  // ✅ preload org + facilities + dropdowns
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

    // ✅ Departments + Billable Items (Delivery)
    const departments = await loadDepartmentsLite({}, true);
    setupSelectOptions(filterDepartment, departments, "id", "name", "-- All Departments --");

    const billables = await loadBillableItemsLite({ category: "delivery" }, true);
    setupSelectOptions(filterBillableItem, billables, "id", "name", "-- All Billable Items --");
  } catch (err) {
    console.error("❌ preload org/facility failed:", err);
  }

  await loadEntries(1);
}

/* ============================================================
   ❌ no-op sync
============================================================ */
export function syncRefsToState() {}

/* ============================================================
   ---- boot ----
============================================================ */
function boot() {
  initDeliveryRecordModule().catch((err) => {
    console.error("initDeliveryRecordModule failed:", err);
  });
}
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot);
} else {
  boot();
}
