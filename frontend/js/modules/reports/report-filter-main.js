// ============================================================================
// 📊 VytalGuard – Report Filter + List (Enterprise Master Pattern)
// Cascading Org → Facility + Dynamic Module & Safe Group Field Mapping
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
  loadFeatureModulesLite,
  setupSelectOptions,
} from "../../utils/data-loaders.js";

import { renderReportResults } from "./report-render.js";
import { exportToExcel, exportToPDF } from "../../utils/export-utils.js";

/* ============================================================
   ⚙️ AUTH + ROLE DETECTION
============================================================ */
async function setupAuthAndRoles() {
  await initPageGuard();
  initLogoutWatcher();
  autoPagePermissionKey("reports:view");

  const roles = Array.isArray(window.userRoles)
    ? window.userRoles
        .map((r) => (typeof r === "string" ? r : r.name || ""))
        .join(" ")
        .toLowerCase()
    : "";

  return {
    isSuperAdmin: roles.includes("superadmin"),
    isAdmin: roles.includes("admin"),
  };
}

/* ============================================================
   🧩 MODEL NORMALIZER (Frontend → Backend key, Compact)
============================================================ */
function normalizeModelKey(key) {
  if (!key) return "";
  const map = {
    registrationlogs: "registration",
    patients: "patient",
    consultations: "consultation",
    triagerecords: "triage",
    vitals: "vital",
    admissions: "admission",
    deliveries: "delivery",
    ultrasounds: "ultrasound",
    ekgrecords: "ekg",
    appointments: "appointment",
    labrequests: "lab_request",
    labrequestitems: "lab_request_item",
    prescriptions: "prescription",
    prescriptionitems: "prescription_item",
    billableitems: "billable_item",
    invoiceitems: "invoice_item",
    deposits: "deposit",
    depositapplications: "deposit_application",
    payments: "payment",
    refunds: "refund",
    refundtransactions: "refund_transaction",
    discounts: "discount",
    discountwaivers: "discount_waiver",
  };
  return map[key.toLowerCase().replace(/[\s_]/g, "")] || key.toLowerCase();
}

/* ============================================================
   🧠 DEFAULT GROUP MAP (Ensures valid backend group fields)
============================================================ */
const DEFAULT_GROUP_MAP = {
  registration: "status",
  patient: "gender",
  consultation: "status",
  triage: "status",
  vital: "status",
  admission: "status",
  delivery: "status",
  ultrasound: "status",
  ekg: "status",
  appointment: "status",
  lab_request: "status",
  lab_request_item: "lab_test_id",
  prescription: "status",
  prescription_item: "billable_item_id",
  billable_item: "category_id",
  invoice: "status",
  invoice_item: "billable_item_id",
  deposit: "method",
  deposit_application: "status",
  payment: "method",
  refund: "status",
  refund_transaction: "method",
  discount: "status",
  discount_waiver: "status",
};

function getDefaultGroupForModule(moduleKey) {
  return DEFAULT_GROUP_MAP[moduleKey] || "status";
}

/* ============================================================
   🧠 STATE
============================================================ */
let currentPage = 1;
let totalPages = 1;
let entries = [];
let isSuperAdmin = false;
let isAdmin = false;

/* ============================================================
   🔎 DOM REFERENCES
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
   📋 COLLECT FILTERS
============================================================ */
function getFilters() {
  const rawModel = filterModule?.value || "";
  const normalizedModel = normalizeModelKey(rawModel);
  const groupField = filterGroup?.value || getDefaultGroupForModule(normalizedModel);

  return {
    organization_id: filterOrg?.value || "",
    facility_id: filterFacility?.value || "",
    modelType: normalizedModel,
    groupField,
    date_range: filterDateRange?.value || "",
    from_date: filterFrom?.value || "",
    to_date: filterTo?.value || "",
    format: "formatted",
  };
}

/* ============================================================
   📦 LOAD REPORTS
============================================================ */
async function loadReports(page = 1) {
  try {
    const filters = getFilters();
    if (!filters.modelType) {
      showToast("Please select a module to generate a report", "info");
      return;
    }

    showLoading("Generating report...");
    const q = new URLSearchParams({ page, limit: 25 });
    for (const [k, v] of Object.entries(filters)) if (v) q.append(k, v);

    const res = await authFetch(`/api/reports/generate?${q.toString()}`);
    const result = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(result.message || "Failed to load reports");

    entries = result.data?.grouped || [];
    currentPage = 1;
    totalPages = 1;

    renderReportResults(result);
    renderPaginationControls(
      document.getElementById("paginationButtons"),
      currentPage,
      totalPages,
      loadReports
    );

    if (!entries.length)
      showToast("ℹ️ No report records found for selected filters", "info");
  } catch (err) {
    console.error("❌ loadReports failed:", err);
    showToast(err.message || "❌ Failed to load reports");
  } finally {
    hideLoading();
  }
}

/* ============================================================
   🏢 ORG → FACILITY CASCADE (Always Visible + Auto Cascade)
============================================================ */
async function setupOrgFacilityDropdowns() {
  try {
    filterOrg?.closest(".form-group")?.classList.remove("hidden", "d-none");
    filterFacility?.closest(".form-group")?.classList.remove("hidden", "d-none");

    const userFacilityId =
      window.userFacilityId || localStorage.getItem("facility_id") || "";

    const orgs = await loadOrganizationsLite();
    orgs.unshift({ id: "", name: "-- All Organizations --" });
    setupSelectOptions(filterOrg, orgs, "id", "name");

    async function reloadFacilities(orgId = null) {
      const query = orgId ? { organization_id: orgId } : {};
      const facs = await loadFacilitiesLite(query, true);
      facs.unshift({ id: "", name: "-- All Facilities --" });
      setupSelectOptions(filterFacility, facs, "id", "name");
      if (!filterFacility.value && userFacilityId) filterFacility.value = userFacilityId;
    }

    await reloadFacilities();
    filterOrg?.addEventListener("change", async (e) => {
      const orgId = e.target.value || null;
      await reloadFacilities(orgId);
    });
  } catch (err) {
    console.error("❌ setupOrgFacilityDropdowns failed:", err);
    showToast("❌ Failed to load organization/facility filters");
  }
}

/* ============================================================
   ⚙️ MODULE DROPDOWN
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
   ⬇️ EXPORT BUTTONS
============================================================ */
exportExcelBtn?.addEventListener("click", () =>
  exportToExcel(entries, `report_${new Date().toISOString().slice(0, 10)}.xlsx`)
);
exportPDFBtn?.addEventListener("click", () =>
  exportToPDF("Enterprise Report", ".table-container", "portrait", true)
);

/* ============================================================
   🎚️ FILTER ACTIONS
============================================================ */
filterBtn?.addEventListener("click", () => loadReports(1));

resetFilterBtn?.addEventListener("click", () => {
  [
    filterOrg,
    filterFacility,
    filterModule,
    filterGroup,
    filterDateRange,
    filterFrom,
    filterTo,
  ].forEach((el) => el && (el.value = ""));
  showToast("Filters cleared", "info");
});

/* ============================================================
   🚀 INIT MODULE
============================================================ */
async function initReportModule() {
  try {
    showLoading("Initializing report module...");
    const roleState = await setupAuthAndRoles();
    isSuperAdmin = roleState.isSuperAdmin;
    isAdmin = roleState.isAdmin;

    await setupOrgFacilityDropdowns();
    await setupModuleDropdown();

    setupToggleSection("toggleFilterBtn", "filterCollapse", "filterChevron", "reportFilterVisible");

    hideLoading();
    console.log("✅ Report module initialized successfully");
  } catch (err) {
    console.error("❌ initReportModule failed:", err);
    hideLoading();
    showToast("❌ Failed to initialize report module");
  }
}

/* ============================================================
   🏁 DOM READY BOOTSTRAP
============================================================ */
if (document.readyState === "loading")
  document.addEventListener("DOMContentLoaded", initReportModule);
else initReportModule();
