// 📦 registrationLog-filter-main.js – Filters + Table/Card (no form, permission-driven)

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
  loadBillableItemsLite,
  setupSelectOptions,
  setupSuggestionInputDynamic,
} from "../../utils/data-loaders.js";

import { renderFieldSelector } from "../../utils/ui-utils.js";
import { exportToExcel, exportToPDF } from "../../utils/export-utils.js";
import { renderList, renderDynamicTableHead } from "./registration-log-render.js";
import { setupActionHandlers } from "./registration-log-actions.js";
import {
  FIELD_ORDER_REGISTRATION_LOG,
  FIELD_DEFAULTS_REGISTRATION_LOG,
} from "./registration-log-constants.js";
import { setupVisibleFields } from "../../utils/field-visibility.js";

/* ============================================================
   🔐 Auth Guard
   ============================================================ */
const token = initPageGuard(autoPagePermissionKey());
initLogoutWatcher();

/* ============================================================
   🧠 Role + Permission Normalization
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
   🌐 Shared State
   ============================================================ */
const sharedState = { currentEditIdRef: { value: null } };
window.showForm = () => {};
window.resetForm = () => {};

/* ============================================================
   📋 Field Visibility Setup
   ============================================================ */
window.entries = [];
let visibleFields = setupVisibleFields({
  moduleKey: "registration_logs",
  userRole,
  defaultFields: FIELD_DEFAULTS_REGISTRATION_LOG,
  allowedFields: FIELD_ORDER_REGISTRATION_LOG,
});

renderFieldSelector(
  {},
  visibleFields,
  (newFields) => {
    visibleFields = newFields;
    renderDynamicTableHead(visibleFields);
    renderList({ entries, visibleFields, viewMode, user, currentPage });
  },
  FIELD_ORDER_REGISTRATION_LOG
);

/* ============================================================
   🧩 Filter DOM Refs
   ============================================================ */
const filterOrg = document.getElementById("filterOrganizationSelect");
const filterFacility = document.getElementById("filterFacilitySelect");
const filterPatient = document.getElementById("filterPatient");
const filterPatientHidden = document.getElementById("filterPatientId");
const filterPatientSuggestions = document.getElementById("filterPatientSuggestions");
const filterRegistrar = document.getElementById("filterRegistrar");
const filterRegistrarHidden = document.getElementById("filterRegistrarId");
const filterRegistrarSuggestions = document.getElementById("filterRegistrarSuggestions");
const filterType = document.getElementById("filterRegistrationType");
const filterMethod = document.getElementById("filterMethod");
const filterCategory = document.getElementById("filterCategory");
const filterStatus = document.getElementById("filterStatus");
const filterReason = document.getElementById("filterReason");
const filterSource = document.getElementById("filterSource");
const filterCreatedFrom = document.getElementById("filterCreatedFrom");
const filterCreatedTo = document.getElementById("filterCreatedTo");

const exportCSVBtn = document.getElementById("exportCSVBtn");
const exportPDFBtn = document.getElementById("exportPDFBtn");

/* ============================================================
   🌍 View + Paging State
   ============================================================ */
let currentPage = 1;
let totalPages = 1;
let viewMode = localStorage.getItem("registrationLogView") || "table";

/* ============================================================
   📋 Build Filters
   ============================================================ */
function getFilters() {
  return {
    organization_id: filterOrg?.value || "",
    facility_id: filterFacility?.value || "",
    patient_id: filterPatientHidden?.value || "",
    registrar_id: filterRegistrarHidden?.value || "",
    registration_type_id: filterType?.value || "",
    registration_method: filterMethod?.value || "",
    patient_category: filterCategory?.value || "",
    log_status: filterStatus?.value || "",
    visit_reason: filterReason?.value || "",
    registration_source: filterSource?.value || "",
    created_from: filterCreatedFrom?.value || "",
    created_to: filterCreatedTo?.value || "",
  };
}

/* ============================================================
   📦 Load Entries
   ============================================================ */
async function loadEntries(page = 1) {
  try {
    const filters = getFilters();
    const q = new URLSearchParams();

    if (filters.created_from) q.append("created_at[gte]", filters.created_from);
    if (filters.created_to) q.append("created_at[lte]", filters.created_to);

    Object.entries(filters).forEach(([k, v]) => {
      if (!v || ["created_from", "created_to"].includes(k)) return;
      q.append(k, v);
    });

    const safeFields = visibleFields.filter((f) =>
      FIELD_ORDER_REGISTRATION_LOG.includes(f)
    );
    if (safeFields.length) q.append("fields", safeFields.join(","));

    const res = await fetch(`/api/registration-logs?page=${page}&limit=10&${q}`, {
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
    showToast("❌ Failed to load registration logs");
  }
}

/* ============================================================
   🧭 View Toggle
   ============================================================ */
document.getElementById("tableViewBtn").onclick = () => {
  viewMode = "table";
  localStorage.setItem("registrationLogView", "table");
  renderList({ entries, visibleFields, viewMode, user, currentPage });
};

document.getElementById("cardViewBtn").onclick = () => {
  viewMode = "card";
  localStorage.setItem("registrationLogView", "card");
  renderList({ entries, visibleFields, viewMode, user, currentPage });
};

/* ============================================================
   🔎 Filter Actions
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
    "filterPatient",
    "filterRegistrar",
    "filterRegistrationType",
    "filterMethod",
    "filterCategory",
    "filterStatus",
    "filterReason",
    "filterSource",
    "filterCreatedFrom",
    "filterCreatedTo",
  ].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });

  if (filterPatientHidden) filterPatientHidden.value = "";
  if (filterRegistrarHidden) filterRegistrarHidden.value = "";

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
   ⬇️ Export Buttons
   ============================================================ */
if (exportCSVBtn) {
  exportCSVBtn.onclick = () => {
    exportToExcel(
      entries,
      `registration_logs_${new Date().toISOString().slice(0, 10)}.xlsx`
    );
  };
}
if (exportPDFBtn) {
  exportPDFBtn.onclick = () => {
    const target =
      viewMode === "table" ? ".table-container" : "#registrationLogList";
    exportToPDF("Registration Log List", target, "portrait", true);
  };
}

/* ============================================================
   🚀 Init Module
   ============================================================ */
export async function initRegistrationLogModule() {
  renderDynamicTableHead(visibleFields);

  const filterCollapse = document.getElementById("filterCollapse");
  const filterChevron = document.getElementById("filterChevron");

  const filterVisible =
    localStorage.getItem("registrationLogFilterVisible") === "true";
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
    "registrationLogFilterVisible"
  );

  // ✅ Patient filter — fully aligned with consultation behavior
  setupSuggestionInputDynamic(
    filterPatient,
    filterPatientSuggestions,
    "/api/lite/patients",
    (selected) => {
      filterPatientHidden.value = selected?.id || "";
      if (selected) {
        filterPatient.value =
          selected.label ||
          `${selected.pat_no || ""} ${selected.first_name || ""} ${selected.last_name || ""}`.trim();
      }
    },
    "label"
  );

  // ✅ Registrar filter — aligned with consultation doctor search
  setupSuggestionInputDynamic(
    filterRegistrar,
    filterRegistrarSuggestions,
    "/api/lite/employees",
    (selected) => {
      filterRegistrarHidden.value = selected?.id || "";
      if (selected) {
        filterRegistrar.value =
          selected.full_name ||
          `${selected.first_name || ""} ${selected.last_name || ""}`.trim();
      }
    },
    "full_name"
  );


  // ✅ Registration Type dropdown
  try {
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
  } catch (err) {
    console.error("❌ preload registration types failed:", err);
  }

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

/* ============================================================
   (Optional)
   ============================================================ */
export function syncRefsToState() {}

/* ============================================================
   ⚙️ Boot
   ============================================================ */
function boot() {
  initRegistrationLogModule().catch((err) => {
    console.error("initRegistrationLogModule failed:", err);
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot);
} else {
  boot();
}
