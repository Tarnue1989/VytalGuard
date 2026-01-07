// 📦 department-filter-main.js – Filters + Table/Card (Enterprise-Aligned)
// ============================================================================
// 🧭 Master Pattern: role-filter-main.js / vital-filter-main.js
// 🔹 Full enterprise structure — auth guard, pagination, filter toggles,
//   export tools, field selector, role-based visibility, unified UI logic.
// 🔹 100% ID preservation for safe integration with existing HTML.
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
  loadEmployeesLite,
  setupSelectOptions,
  setupSuggestionInputDynamic,
} from "../../utils/data-loaders.js";

import { renderFieldSelector } from "../../utils/ui-utils.js";
import { exportToExcel, exportToPDF } from "../../utils/export-utils.js";
import { renderList, renderDynamicTableHead } from "./department-render.js";
import { setupActionHandlers } from "./department-actions.js";
import {
  FIELD_ORDER_DEPARTMENT,
  FIELD_DEFAULTS_DEPARTMENT,
} from "./department-constants.js";
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
  moduleKey: "department",
  userRole,
  defaultFields: FIELD_DEFAULTS_DEPARTMENT,
  allowedFields: FIELD_ORDER_DEPARTMENT,
});

renderFieldSelector(
  {},
  visibleFields,
  (newFields) => {
    visibleFields = newFields;
    renderDynamicTableHead(visibleFields);
    renderList({ entries, visibleFields, viewMode, user, currentPage });
  },
  FIELD_ORDER_DEPARTMENT
);

/* ============================================================
   🔎 Filter DOM Refs
============================================================ */
const filterOrg = document.getElementById("filterOrganizationSelect");
const filterFacility = document.getElementById("filterFacilitySelect");
const filterName = document.getElementById("filterName");
const filterCode = document.getElementById("filterCode");
const filterStatus = document.getElementById("filterStatus");
const filterDescription = document.getElementById("filterDescription");
const filterHeadInput = document.getElementById("filterHead");
const filterHeadHidden = document.getElementById("filterHeadId");
const filterHeadSuggestions = document.getElementById("filterHeadSuggestions");
const filterCreatedFrom = document.getElementById("filterCreatedFrom");
const filterCreatedTo = document.getElementById("filterCreatedTo");
const filterSearch = document.getElementById("filterSearch");

const exportCSVBtn = document.getElementById("exportCSVBtn");
const exportPDFBtn = document.getElementById("exportPDFBtn");

/* ============================================================
   🌍 View + Paging
============================================================ */
let currentPage = 1;
let totalPages = 1;
let viewMode = localStorage.getItem("departmentView") || "table";

/* ============================================================
   📋 Build Filter Object
============================================================ */
function getFilters() {
  return {
    organization_id: filterOrg?.value || "",
    facility_id: filterFacility?.value || "",
    name: filterName?.value || "",
    code: filterCode?.value?.toUpperCase() || "",
    description: filterDescription?.value || "",
    head_of_department_id: filterHeadHidden?.value || "",
    status: filterStatus?.value || "",
    created_from: filterCreatedFrom?.value || "",
    created_to: filterCreatedTo?.value || "",
    q: filterSearch?.value || "",
  };
}

/* ============================================================
   🔁 Pagination Control
============================================================ */
const getPagination = initPaginationControl("department", loadEntries, 25);

/* ============================================================
   📦 Load Departments
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
      FIELD_ORDER_DEPARTMENT.includes(f)
    );
    if (safeFields.length) q.append("fields", safeFields.join(","));

    const res = await authFetch(`/api/departments?${q.toString()}`, {
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

    if (!records.length)
      showToast("ℹ️ No departments found for current filters");
  } catch (err) {
    console.error("❌ loadEntries failed:", err);
    showToast("❌ Failed to load departments");
  } finally {
    hideLoading();
  }
}

/* ============================================================
   🧭 View Toggle (Table ↔ Card)
============================================================ */
document.getElementById("tableViewBtn").onclick = () => {
  viewMode = "table";
  localStorage.setItem("departmentView", "table");
  renderList({ entries, visibleFields, viewMode, user, currentPage });
};

document.getElementById("cardViewBtn").onclick = () => {
  viewMode = "card";
  localStorage.setItem("departmentView", "card");
  renderList({ entries, visibleFields, viewMode, user, currentPage });
};

/* ============================================================
   🔍 Filter Actions
============================================================ */
document.getElementById("filterBtn").onclick = async () => await loadEntries(1);

document.getElementById("resetFilterBtn").onclick = () => {
  [
    filterOrg,
    filterFacility,
    filterName,
    filterCode,
    filterStatus,
    filterDescription,
    filterHeadInput,
    filterCreatedFrom,
    filterCreatedTo,
    filterSearch,
  ].forEach((el) => {
    if (el) {
      el.value = "";
      if (el.dataset) el.dataset.value = "";
    }
  });

  if (filterHeadHidden) filterHeadHidden.value = "";
  loadEntries(1);
};

/* ============================================================
   ⬇️ Export Tools
============================================================ */
if (exportCSVBtn)
  exportCSVBtn.onclick = () =>
    exportToExcel(
      entries,
      `departments_${new Date().toISOString().slice(0, 10)}.xlsx`
    );

if (exportPDFBtn)
  exportPDFBtn.onclick = () => {
    const target =
      viewMode === "table" ? ".table-container" : "#departmentList";
    exportToPDF("Department List", target, "portrait", true);
  };

/* ============================================================
   🚀 Init Module
============================================================ */
export async function initDepartmentModule() {
  renderDynamicTableHead(visibleFields);

  const filterCollapse = document.getElementById("filterCollapse");
  const filterChevron = document.getElementById("filterChevron");
  const filterVisible =
    localStorage.getItem("departmentFilterVisible") === "true";

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
    "departmentFilterVisible"
  );

  /* ----------------- Suggestion Inputs ----------------- */
  setupSuggestionInputDynamic(
    filterHeadInput,
    filterHeadSuggestions,
    "/api/lite/employees",
    (selected) => {
      filterHeadHidden.value = selected?.id || "";
      if (selected) {
        filterHeadInput.value = [
          selected.first_name,
          selected.middle_name,
          selected.last_name,
        ]
          .filter(Boolean)
          .join(" ");
      }
    },
    "full_name"
  );

  /* ----------------- Preload Org & Facility ----------------- */
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
      setupSelectOptions(
        filterFacility,
        facilities,
        "id",
        "name",
        "-- All Facilities --"
      );
      if (scopedFacId) filterFacility.value = scopedFacId;
    }
  } catch (err) {
    console.error("❌ preload org/facility failed:", err);
  }

  await loadEntries(1);
}

/* ============================================================
   🔁 Sync Helper (reserved)
============================================================ */
export function syncRefsToState() {
  // Reserved for enterprise reactive behavior
}

/* ============================================================
   🏁 Boot
============================================================ */
function boot() {
  initDepartmentModule().catch((err) =>
    console.error("initDepartmentModule failed:", err)
  );
}

if (document.readyState === "loading")
  document.addEventListener("DOMContentLoaded", boot);
else boot();
