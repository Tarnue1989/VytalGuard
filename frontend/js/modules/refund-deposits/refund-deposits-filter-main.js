// 📦 refund-deposits-filter-main.js – ENTERPRISE MASTER–ALIGNED (FINAL)
// ============================================================================
// 🔹 STRICT parity with refund-filter-main.js MASTER
// 🔹 Auto search + auto filters
// 🔹 Sorting + pagination parity
// 🔹 UI-only dateRange (MASTER)
// 🔹 View toggle + summary + export
// 🔹 Suggestion dependency (patient → deposits)
// 🔹 MINIMAL DOM EXTENSION (currency filter added)
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
  loadPaymentsLite, // 🔥 MASTER parity
  setupSelectOptions,
  setupSuggestionInputDynamic,
} from "../../utils/data-loaders.js";

import {
  renderFieldSelector,
  formatDateTime,
  initTooltips,
} from "../../utils/ui-utils.js";

import { exportToExcel, exportToPDF } from "../../utils/export-utils.js";

import {
  renderList,
  renderDynamicTableHead,
} from "./refund-deposits-render.js";

import { setupRefundDepositActionHandlers } from "./refund-deposits-actions.js";

import {
  FIELD_ORDER_REFUND_DEPOSIT,
  FIELD_DEFAULTS_REFUND_DEPOSIT,
  FIELD_LABELS_REFUND_DEPOSIT,
} from "./refund-deposits-constants.js";

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
let viewMode = localStorage.getItem("refundDepositView") || "table";
let sortBy = "";
let sortDir = "asc";

const sharedState = { currentEditIdRef: { value: null } };

/* ============================================================
   👁️ FIELD VISIBILITY
============================================================ */
let visibleFields = setupVisibleFields({
  moduleKey: "refund-deposits",
  userRole,
  defaultFields: FIELD_DEFAULTS_REFUND_DEPOSIT,
  allowedFields: FIELD_ORDER_REFUND_DEPOSIT,
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
  FIELD_ORDER_REFUND_DEPOSIT
);

/* ============================================================
   🔎 FILTER DOM
============================================================ */
const qs = (id) => document.getElementById(id);

const globalSearch   = qs("globalSearch");
const filterOrg      = qs("filterOrganizationSelect");
const filterFacility = qs("filterFacilitySelect");
const filterStatus   = qs("filterStatus");
const filterMethod   = qs("filterMethodSelect");
const dateRange      = qs("dateRange");

const filterPatient            = qs("filterPatient");
const filterPatientHidden      = qs("filterPatientId");
const filterPatientSuggestions = qs("filterPatientSuggestions");

const filterDeposit            = qs("filterDeposit");
const filterDepositHidden      = qs("filterDepositId");
const filterDepositSuggestions = qs("filterDepositSuggestions");
const filterCurrency = qs("filterCurrency"); 

/* ============================================================
   🔃 SORT BRIDGE (MASTER)
============================================================ */
window.setRefundDepositSort = (field, dir) => {
  sortBy = field;
  sortDir = dir;
};
window.loadRefundDepositPage = (p = 1) => loadEntries(p);

/* ============================================================
   📄 PAGINATION
============================================================ */
const getPagination = initPaginationControl(
  "refund-deposits",
  loadEntries,
  Number(localStorage.getItem("refundDepositPageLimit") || 25)
);

/* ============================================================
   🔎 AUTO SEARCH / FILTERS (MASTER)
============================================================ */
setupAutoSearch(globalSearch, loadEntries);

setupAutoFilters({
  searchInput: globalSearch,
  selectInputs: [
    filterOrg,
    filterFacility,
    filterStatus,
    filterMethod,
    filterCurrency,
  ],
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
    method: filterMethod?.value,
    patient_id: filterPatientHidden?.value,
    deposit_id: filterDepositHidden?.value,
    dateRange: dateRange?.value,
    currency: filterCurrency?.value,
  };
}

/* ============================================================
   📦 LOAD ENTRIES (MASTER)
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
    if (f.method)          q.set("method", f.method);
    if (f.currency) q.set("currency", f.currency); 
    if (f.patient_id)      q.set("patient_id", f.patient_id);
    if (f.deposit_id)      q.set("deposit_id", f.deposit_id);

    const res = await authFetch(`/api/refund-deposits?${q.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    const json = await res.json();
    if (!res.ok) throw new Error(json?.message);

    const data = json.data || {};
    entries = data.records || [];
    currentPage = data.pagination?.page || safePage;

    renderList({ entries, visibleFields, viewMode, user, currentPage });

    /* ========================================================
       🧾 SUMMARY FIX (MATCH REFUND MASTER)
    ======================================================== */
    if (data.summary?.refund_summary?.metrics) {
      const m = data.summary.refund_summary.metrics;

      if (m.last_approved_at) {
        m.last_approved_at = formatDateTime(m.last_approved_at);
      }

      if (m.last_processed_at) {
        m.last_processed_at = formatDateTime(m.last_processed_at);
      }
    }

    data.summary?.refund_summary &&
      renderModuleSummary(data.summary.refund_summary, "moduleSummary", {
        moduleLabel: "REFUND DEPOSITS",
      });

    syncViewToggleUI({ mode: viewMode });

    setupRefundDepositActionHandlers({
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

    initTooltips();
  } catch (err) {
    console.error(err);
    showToast("❌ Failed to load refund deposits");
  } finally {
    hideLoading();
  }
}

/* ============================================================
   🧭 VIEW TOGGLE
============================================================ */
qs("tableViewBtn")?.addEventListener("click", () => {
  viewMode = "table";
  localStorage.setItem("refundDepositView", "table");
  syncViewToggleUI({ mode: viewMode });
  renderList({ entries, visibleFields, viewMode, user, currentPage });
});

qs("cardViewBtn")?.addEventListener("click", () => {
  viewMode = "card";
  localStorage.setItem("refundDepositView", "card");
  syncViewToggleUI({ mode: viewMode });
  renderList({ entries, visibleFields, viewMode, user, currentPage });
});

/* ============================================================
   🔄 RESET FILTERS
============================================================ */
qs("resetFilterBtn")?.addEventListener("click", () => {
  [
    globalSearch,
    filterOrg,
    filterFacility,
    filterStatus,
    filterMethod,
    filterPatient,
    filterDeposit,
    dateRange,
    filterCurrency,
  ].forEach((el) => el && (el.value = ""));

  filterPatientHidden.value = "";
  filterDepositHidden.value = "";
  loadEntries(1);
});

/* ============================================================
   ⬇️ EXPORT
============================================================ */
qs("exportCSVBtn")?.addEventListener("click", () => {
  if (!entries.length) return showToast("❌ No data");
  exportToExcel(
    mapDataForExport(entries, visibleFields, FIELD_LABELS_REFUND_DEPOSIT),
    `refund_deposits_${new Date().toISOString().slice(0, 10)}.csv`
  );
});

qs("exportPDFBtn")?.addEventListener("click", () => {
  exportToPDF(
    "Refund Deposits List",
    viewMode === "table" ? ".table-container" : "#refundDepositList",
    "portrait"
  );
});

/* ============================================================
   🚀 INIT (MASTER FIX: PATIENT → DEPOSIT DEPENDENCY)
============================================================ */
export async function initRefundDepositModule() {
  renderDynamicTableHead(visibleFields);

  setupToggleSection(
    "toggleFilterBtn",
    "filterCollapse",
    "filterChevron",
    "refundDepositFilterVisible"
  );
  /* ========================================================
    🔧 DEFAULT DEPOSIT SEARCH (NO PATIENT SELECTED)
  ======================================================== */
  setupSuggestionInputDynamic(
    filterDeposit,
    filterDepositSuggestions,
    async (q) => {
      const patientId = filterPatientHidden.value;

      const url = patientId
        ? `/api/lite/deposits?patient_id=${patientId}&q=${q}`
        : `/api/lite/deposits?q=${q}`;

      const res = await authFetch(url);
      const json = await res.json();
      return json.data?.records || [];
    },
    (selected) => {
      filterDepositHidden.value = selected?.id || "";
      filterDeposit.value = selected?.label || "";
      loadEntries(1);
    },
    "label"
  );
  /* ========================================================
     👤 PATIENT → DEPOSIT DEPENDENCY (FIXED)
  ======================================================== */
  setupSuggestionInputDynamic(
    filterPatient,
    filterPatientSuggestions,
    "/api/lite/patients",
    async (selected) => {
      filterPatientHidden.value = selected?.id || "";
      filterPatient.value = selected?.label || "";

      if (!selected?.id) {
        filterDeposit.value = "";
        filterDepositHidden.value = "";
        filterDepositSuggestions.innerHTML = "";
      }

      loadEntries(1);
    },
    "label"
  );

  /* ========================================================
     🔥 RESET ON PATIENT INPUT (CRITICAL)
  ======================================================== */
  filterPatient.addEventListener("input", () => {
    filterPatientHidden.value = "";
    filterDeposit.value = "";
    filterDepositHidden.value = "";
    filterDepositSuggestions.innerHTML = "";
  });

  /* ========================================================
     ⚠️ IMPORTANT: REMOVE DUPLICATE DEPOSIT SETUP
     (DO NOT ADD ANOTHER setupSuggestionInputDynamic FOR DEPOSIT)
  ======================================================== */

  /* ========================================================
     🏢 ORG / FACILITY (MASTER)
  ======================================================== */
  if (userRole.includes("super")) {
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
  } else if (userRole.includes("admin")) {
    filterOrg?.closest(".form-group")?.classList.add("hidden");

    const facs = await loadFacilitiesLite({}, true);
    facs.unshift({ id: "", name: "-- All Facilities --" });
    setupSelectOptions(filterFacility, facs, "id", "name");
  } else {
    filterOrg?.closest(".form-group")?.classList.add("hidden");
    filterFacility?.closest(".form-group")?.classList.add("hidden");
  }

  /* ========================================================
     🚀 INITIAL LOAD
  ======================================================== */
  await loadEntries(1);
}
/* ============================================================
   🏁 BOOT
============================================================ */
document.readyState === "loading"
  ? document.addEventListener("DOMContentLoaded", initRefundDepositModule)
  : initRefundDepositModule();