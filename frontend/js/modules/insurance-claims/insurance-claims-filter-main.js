// 📦 insurance-claim-filter-main.js – Enterprise MASTER–ALIGNED (FIXED)

import {
  showToast,
  showLoading,
  hideLoading,
  initPageGuard,
  setupToggleSection,
  renderPaginationControls,
  initLogoutWatcher,
  autoPagePermissionKey,
} from "../../utils/index.js";
import { loadInsuranceProvidersLite } from "../../utils/data-loaders.js";
import { authFetch } from "../../authSession.js";

import {
  loadOrganizationsLite,
  loadFacilitiesLite,
  setupSelectOptions,
  setupSuggestionInputDynamic,
} from "../../utils/data-loaders.js";

import { renderFieldSelector } from "../../utils/ui-utils.js";
import { exportToExcel, exportToPDF } from "../../utils/export-utils.js";

import {
  renderList,
  renderDynamicTableHead,
} from "./insurance-claims-render.js";

import { setupActionHandlers } from "./insurance-claims-actions.js";

import {
  FIELD_ORDER_INSURANCE_CLAIM,
  FIELD_DEFAULTS_INSURANCE_CLAIM,
  FIELD_LABELS_INSURANCE_CLAIM,
} from "./insurance-claims-constants.js";

import { setupVisibleFields } from "../../utils/field-visibility.js";
import { initPaginationControl } from "../../utils/pagination-control.js";
import { setupAutoSearch, setupAutoFilters } from "../../utils/search-utils.js";
import { mapDataForExport } from "../../utils/export-mapper.js";
import { syncViewToggleUI } from "../../utils/view-toggle.js";
import { renderModuleSummary } from "../../utils/render-module-summary.js";

/* ============================================================
   🔐 AUTH + USER
============================================================ */
const token = initPageGuard(autoPagePermissionKey());
initLogoutWatcher();

const userRole = (localStorage.getItem("userRole") || "").toLowerCase();
const permissions = (() => {
  try {
    return (JSON.parse(localStorage.getItem("permissions")) || []).map((p) =>
      String(p.key || p).toLowerCase()
    );
  } catch {
    return [];
  }
})();
const user = { role: userRole, permissions };

/* ============================================================
   🧠 STATE
============================================================ */
let entries = [];
let currentPage = 1;
let viewMode = localStorage.getItem("insuranceClaimView") || "table";
let sortBy = "";
let sortDir = "asc";

const sharedState = { currentEditIdRef: { value: null } };

/* ============================================================
   👁️ FIELD VISIBILITY
============================================================ */
let visibleFields = setupVisibleFields({
  moduleKey: "insurance_claim",
  userRole,
  defaultFields: FIELD_DEFAULTS_INSURANCE_CLAIM,
  allowedFields: FIELD_ORDER_INSURANCE_CLAIM,
});

/* ============================================================
   🧩 FIELD SELECTOR
============================================================ */
renderFieldSelector(
  {},
  visibleFields,
  (fields) => {
    visibleFields = fields;
    renderDynamicTableHead(visibleFields);
    renderList({ entries, visibleFields, viewMode, user, currentPage });
  },
  FIELD_ORDER_INSURANCE_CLAIM
);

/* ============================================================
   🔎 FILTER DOM
============================================================ */
const qs = (id) => document.getElementById(id);

const globalSearch   = qs("globalSearch");
const filterOrg      = qs("filterOrganizationSelect");
const filterFacility = qs("filterFacilitySelect");
const filterStatus   = qs("filterStatus");
const dateRange      = qs("dateRange");

const filterPatient            = qs("filterPatient");
const filterPatientHidden      = qs("filterPatientId");
const filterPatientSuggestions = qs("filterPatientSuggestions");

const filterProvider = qs("filterProvider");

const filterInvoiceId = qs("filterInvoiceId");
const filterCurrency  = qs("filterCurrency");

/* ============================================================
   🔃 SORT
============================================================ */
window.setInsuranceClaimSort = (field, dir) => {
  sortBy = field;
  sortDir = dir;
};

window.loadInsuranceClaimPage = (p = 1) => loadEntries(p);

/* ============================================================
   📄 PAGINATION
============================================================ */
const getPagination = initPaginationControl(
  "insurance_claim",
  loadEntries,
  Number(localStorage.getItem("insuranceClaimPageLimit") || 25)
);

/* ============================================================
   🔎 AUTO SEARCH / FILTERS (FIXED)
============================================================ */
setupAutoSearch(globalSearch, loadEntries);

// SAFE FILTER (prevents null crash)
const safe = (el) => el !== null;

setupAutoFilters({
  searchInput: globalSearch,
  selectInputs: [
    filterOrg,
    filterFacility,
    filterStatus,
    filterCurrency,
    filterInvoiceId,
    filterProvider,// ✅ added
  ].filter(safe),
  dateRangeInput: dateRange,
  onChange: loadEntries,
});

/* ============================================================
   📋 FILTER BUILDER
============================================================ */
function getFilters() {
  return {
    search: globalSearch?.value?.trim(),
    organization_id: filterOrg?.value,
    facility_id: filterFacility?.value,
    status: filterStatus?.value,
    currency: filterCurrency?.value,
    patient_id: filterPatientHidden?.value,
    provider_id: filterProvider?.value,
    invoice_id: filterInvoiceId?.value,
    dateRange: dateRange?.value,
  };
}

/* ============================================================
   📦 LOAD
============================================================ */
async function loadEntries(page = 1) {
  try {
    showLoading();

    const q = new URLSearchParams();
    const { page: safePage, limit } = getPagination(page);
    const f = getFilters();

    q.set("page", safePage);
    q.set("limit", limit);

    if (sortBy) {
      q.set("sort_by", sortBy);
      q.set("sort_order", sortDir);
    }

    if (f.search)          q.set("search", f.search);
    if (f.dateRange)       q.set("dateRange", f.dateRange);
    if (f.organization_id) q.set("organization_id", f.organization_id);
    if (f.facility_id)     q.set("facility_id", f.facility_id);
    if (f.status)          q.set("status", f.status);
    if (f.currency)        q.set("currency", f.currency);
    if (f.patient_id)      q.set("patient_id", f.patient_id);
    if (f.provider_id)     q.set("provider_id", f.provider_id);
    if (f.invoice_id)      q.set("invoice_id", f.invoice_id);

    const res = await authFetch(`/api/insurance-claims?${q.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    const json = await res.json();
    if (!res.ok) throw new Error(json?.message);

    const data = json.data || {};
    entries = data.records || [];
    currentPage = data.pagination?.page || safePage;

    renderList({ entries, visibleFields, viewMode, user, currentPage });

    data.summary &&
      renderModuleSummary(data.summary, "moduleSummary", {
        moduleLabel: "INSURANCE CLAIMS",
      });

    syncViewToggleUI({ mode: viewMode });

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
      qs("paginationButtons"),
      currentPage,
      data.pagination?.pageCount || 1,
      loadEntries
    );
  } catch (err) {
    console.error(err);
    showToast("❌ Failed to load insurance claims");
  } finally {
    hideLoading();
  }
}

/* ============================================================
   🧭 VIEW TOGGLE
============================================================ */
qs("tableViewBtn").onclick = () => {
  viewMode = "table";
  localStorage.setItem("insuranceClaimView", "table");
  syncViewToggleUI({ mode: viewMode });
  renderList({ entries, visibleFields, viewMode, user, currentPage });
};

qs("cardViewBtn").onclick = () => {
  viewMode = "card";
  localStorage.setItem("insuranceClaimView", "card");
  syncViewToggleUI({ mode: viewMode });
  renderList({ entries, visibleFields, viewMode, user, currentPage });
};

/* ============================================================
   🔄 RESET (FIXED)
============================================================ */
qs("resetFilterBtn").onclick = () => {
  [
    globalSearch,
    filterOrg,
    filterFacility,
    filterStatus,
    filterCurrency,   // ✅ added
    filterInvoiceId,  // ✅ added
    filterPatient,
    filterProvider,
    dateRange,
  ].forEach((el) => el && (el.value = ""));

  filterPatientHidden.value = "";

  loadEntries(1);
};

/* ============================================================
   ⬇️ EXPORT
============================================================ */
qs("exportCSVBtn")?.addEventListener("click", () => {
  if (!entries.length) return showToast("❌ No data");
  exportToExcel(
    mapDataForExport(entries, visibleFields, FIELD_LABELS_INSURANCE_CLAIM),
    `insurance_claims_${new Date().toISOString().slice(0, 10)}.csv`
  );
});

qs("exportPDFBtn")?.addEventListener("click", () => {
  exportToPDF(
    "Insurance Claims List",
    viewMode === "table" ? ".table-container" : "#insuranceClaimList",
    "portrait"
  );
});

/* ============================================================
   🚀 INIT (FIXED)
============================================================ */
export async function initInsuranceClaimModule() {
  renderDynamicTableHead(visibleFields);

  setupToggleSection(
    "toggleFilterBtn",
    "filterCollapse",
    "filterChevron",
    "insuranceClaimFilterVisible"
  );
  const providers = await loadInsuranceProvidersLite();
  providers.unshift({ id: "", label: "-- All Providers --" });

  setupSelectOptions(filterProvider, providers, "id", "label");
  
  setupSuggestionInputDynamic(
    filterPatient,
    filterPatientSuggestions,
    "/api/lite/patients",
    (selected) => {
      filterPatientHidden.value = selected?.id || "";
      filterPatient.value = selected?.label || "";
      loadEntries(1);
    },
    "label"
  );

  // ✅ FIX: handle manual clear
  filterPatient.oninput = () => {
    if (!filterPatient.value) {
      filterPatientHidden.value = "";
      loadEntries(1);
    }
  };


  if (userRole.includes("super") || userRole.includes("admin")) {
    const orgs = await loadOrganizationsLite();
    orgs.unshift({ id: "", name: "-- All Organizations --" });
    setupSelectOptions(filterOrg, orgs, "id", "name");

    const reloadFacilities = async (orgId = null) => {
      const facs = await loadFacilitiesLite(
        orgId ? { organization_id: orgId } : {},
        true
      );
      facs.unshift({ id: "", name: "-- All Facilities --" });
      setupSelectOptions(filterFacility, facs, "id", "name");
    };

    await reloadFacilities();
    filterOrg.onchange = () => reloadFacilities(filterOrg.value || null);
  } else {
    filterOrg?.closest(".form-group")?.classList.add("hidden");
    filterFacility?.closest(".form-group")?.classList.add("hidden");
  }

  await loadEntries(1);
}

/* ============================================================
   🏁 BOOT
============================================================ */
document.readyState === "loading"
  ? document.addEventListener("DOMContentLoaded", initInsuranceClaimModule)
  : initInsuranceClaimModule();