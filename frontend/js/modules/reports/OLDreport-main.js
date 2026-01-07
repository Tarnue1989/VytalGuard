// ============================================================================
// 📊 VytalGuard – Report Main (Enterprise Master Pattern)
// Single self-contained module – unified filter + list + export
// ============================================================================
import {
  showToast,
  showLoading,
  hideLoading,
  initPageGuard,
  initLogoutWatcher,
  autoPagePermissionKey,
  setupToggleSection,
  renderPaginationControls,
} from "../../utils/index.js";

import { authFetch } from "../../authSession.js";
import {
  loadOrganizationsLite,
  loadFacilitiesLite,
  loadFeatureModulesLite,
  setupSelectOptions,
} from "../../utils/data-loaders.js";

import { renderReportResults } from "./report-render.js";
import { exportToExcel, exportToPDF } from "../../utils/export-utils.js";

/* ============================================================
   ⚙️ INIT SECURITY + ROLE DETECTION
============================================================ */
const token = initPageGuard(autoPagePermissionKey("reports:view"));
initLogoutWatcher();

const roles = Array.isArray(window.userRoles)
  ? window.userRoles
      .map((r) => (typeof r === "string" ? r : r.name || ""))
      .join(" ")
      .toLowerCase()
  : "";

const isSuperAdmin = roles.includes("superadmin");
const isAdmin = roles.includes("admin");

/* ============================================================
   🔎 DOM REFS
============================================================ */
const filterOrg = document.getElementById("filterOrganizationSelect");
const filterFacility = document.getElementById("filterFacilitySelect");
const filterModule = document.getElementById("filterModuleSelect");
const filterGroup = document.getElementById("filterGroupField");
const filterDateRange = document.getElementById("filterDateRange");
const filterFrom = document.getElementById("filterCreatedFrom");
const filterTo = document.getElementById("filterCreatedTo");
const exportExcelBtn = document.getElementById("exportExcelBtn");
const exportPDFBtn = document.getElementById("exportPDFBtn");
const filterBtn = document.getElementById("filterBtn");
const resetFilterBtn = document.getElementById("resetFilterBtn");

/* ============================================================
   🧠 Shared State
============================================================ */
let entries = [];
let currentPage = 1;
let totalPages = 1;

/* ============================================================
   🏢 Organization / Facility Cascade
============================================================ */
async function setupOrgFacilityDropdowns() {
  try {
    const userFacilityId =
      window.userFacilityId || localStorage.getItem("facility_id") || "";
    const userFacilityName =
      window.userFacilityName || localStorage.getItem("facility_name") || "—";

    if (isSuperAdmin) {
      filterOrg?.closest(".form-group")?.classList.remove("hidden", "d-none");
      filterFacility?.closest(".form-group")?.classList.remove("hidden", "d-none");

      const orgs = await loadOrganizationsLite();
      orgs.unshift({ id: "", name: "-- All Organizations --" });
      setupSelectOptions(filterOrg, orgs, "id", "name");

      async function reloadFacilities(orgId = null) {
        const facs = await loadFacilitiesLite(
          orgId ? { organization_id: orgId } : {},
          true
        );
        facs.unshift({ id: "", name: "-- All Facilities --" });
        setupSelectOptions(filterFacility, facs, "id", "name");
      }

      await reloadFacilities();
      filterOrg?.addEventListener("change", async () => {
        await reloadFacilities(filterOrg.value || null);
      });
    } else if (isAdmin) {
      filterOrg?.closest(".form-group")?.classList.add("hidden");
      const facs = await loadFacilitiesLite({}, true);
      facs.unshift({ id: "", name: "-- All Facilities --" });
      setupSelectOptions(filterFacility, facs, "id", "name");
      if (userFacilityId) filterFacility.value = userFacilityId;
    } else {
      filterOrg?.closest(".form-group")?.classList.add("hidden");
      filterFacility.innerHTML = `<option value="${userFacilityId}">${userFacilityName}</option>`;
      filterFacility.disabled = true;
    }
  } catch (err) {
    console.error("❌ setupOrgFacilityDropdowns failed:", err);
    showToast("❌ Could not load organization/facility filters");
  }
}

/* ============================================================
   ⚙️ Feature Modules Dropdown
============================================================ */
async function setupModuleDropdown() {
  try {
    const modules = await loadFeatureModulesLite();
    setupSelectOptions(filterModule, modules, "key", "name", "-- Select Module --");
  } catch (err) {
    console.error("❌ setupModuleDropdown failed:", err);
  }
}

/* ============================================================
   📋 Filters + Query
============================================================ */
function getFilters() {
  return {
    organization_id: filterOrg?.value || "",
    facility_id: filterFacility?.value || "",
    modelType: filterModule?.value || "",
    groupField: filterGroup?.value || "",
    date_range: filterDateRange?.value || "",
    from_date: filterFrom?.value || "",
    to_date: filterTo?.value || "",
    format: "formatted",
  };
}

/* ============================================================
   📦 Load Reports
============================================================ */
async function loadReports(page = 1) {
  try {
    showLoading("Generating report...");
    const filters = getFilters();
    const q = new URLSearchParams({ page, limit: 25 });

    Object.entries(filters).forEach(([key, val]) => {
      if (val) q.append(key, val);
    });

    const res = await authFetch(`/api/reports/generate?${q.toString()}`);
    const result = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(result.message || "Failed to generate report");

    const payload = result.data || {};
    entries = Array.isArray(payload.records)
      ? payload.records
      : payload.rows || [];

    currentPage = Number(payload.pagination?.page || 1);
    totalPages = Number(payload.pagination?.pageCount || 1);

    renderReportResults(result);
    renderPaginationControls(
      document.getElementById("paginationButtons"),
      currentPage,
      totalPages,
      loadReports
    );

    hideLoading();
    showToast(`✅ Report generated (${entries.length} records)`);
  } catch (err) {
    console.error("❌ loadReports failed:", err);
    hideLoading();
    showToast("❌ Failed to load reports");
  }
}

/* ============================================================
   🧾 Export Buttons
============================================================ */
if (exportExcelBtn)
  exportExcelBtn.onclick = () =>
    exportToExcel(entries, `reports_${new Date().toISOString().slice(0, 10)}.xlsx`);

if (exportPDFBtn)
  exportPDFBtn.onclick = () =>
    exportToPDF("Enterprise Report", ".table-container", "landscape", true);

/* ============================================================
   🎚️ Filter Actions
============================================================ */
filterBtn?.addEventListener("click", async () => await loadReports(1));

resetFilterBtn?.addEventListener("click", async () => {
  [
    filterOrg,
    filterFacility,
    filterModule,
    filterGroup,
    filterDateRange,
    filterFrom,
    filterTo,
  ].forEach((el) => el && (el.value = ""));
  await loadReports(1);
});

/* ============================================================
   🚀 INIT ENTRY
============================================================ */
async function initReportModule() {
  try {
    showLoading("Initializing reports...");
    await setupOrgFacilityDropdowns();
    await setupModuleDropdown();
    await loadReports(1);

    setupToggleSection(
      "toggleFilterBtn",
      "filterCollapse",
      "filterChevron",
      "reportFilterVisible"
    );

    hideLoading();
    console.log("✅ Report module initialized successfully");
  } catch (err) {
    console.error("❌ initReportModule failed:", err);
    hideLoading();
    showToast("❌ Failed to initialize report module");
  }
}

/* ============================================================
   🏁 Boot
============================================================ */
if (document.readyState === "loading")
  document.addEventListener("DOMContentLoaded", initReportModule);
else initReportModule();
