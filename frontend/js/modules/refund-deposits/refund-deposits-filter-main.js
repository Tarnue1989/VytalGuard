// 📦 refund-deposits-filter-main.js – Enterprise MASTER–ALIGNED (Deposit Parity)
// ============================================================================
// 🔹 FULLY mirrors deposit-filter-main.js MASTER pattern
// 🔹 Auto search, auto filters, sorting, pagination
// 🔹 UI-only dateRange (single input, NEVER DB column)
// 🔹 Org / Facility fully wired (role-aware)
// 🔹 Refund Deposit Status fully wired
// 🔹 Summary + export aligned
// 🔹 ALL existing Refund Deposit API calls PRESERVED
// ============================================================================

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
   🔎 FILTER DOM (MASTER STRUCTURE)
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

const filterDeposit            = qs("filterDeposit");
const filterDepositHidden      = qs("filterDepositId");
const filterDepositSuggestions = qs("filterDepositSuggestions");

const filterMethod = qs("filterMethodSelect");

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
  ],
  dateRangeInput: dateRange,
  onChange: loadEntries,
});

/* ============================================================
   📋 FILTER BUILDER (MASTER SAFE)
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
  };
}

/* ============================================================
   📦 LOAD REFUND DEPOSITS (MASTER SAFE)
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

    data.summary &&
      renderModuleSummary(data.summary, "moduleSummary", {
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
qs("tableViewBtn").onclick = () => {
  viewMode = "table";
  localStorage.setItem("refundDepositView", "table");
  syncViewToggleUI({ mode: viewMode });
  renderList({ entries, visibleFields, viewMode, user, currentPage });
};

qs("cardViewBtn").onclick = () => {
  viewMode = "card";
  localStorage.setItem("refundDepositView", "card");
  syncViewToggleUI({ mode: viewMode });
  renderList({ entries, visibleFields, viewMode, user, currentPage });
};

/* ============================================================
   🔄 RESET FILTERS (MASTER)
============================================================ */
qs("resetFilterBtn").onclick = () => {
  [
    globalSearch,
    filterOrg,
    filterFacility,
    filterStatus,
    filterMethod,
    filterPatient,
    filterDeposit,
    dateRange,
  ].forEach((el) => el && (el.value = ""));

  filterPatientHidden.value = "";
  filterDepositHidden.value = "";
  loadEntries(1);
};

/* ============================================================
   ⬇️ EXPORT (MASTER)
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
   🚀 INIT
============================================================ */
export async function initRefundDepositModule() {
  renderDynamicTableHead(visibleFields);

  setupToggleSection(
    "toggleFilterBtn",
    "filterCollapse",
    "filterChevron",
    "refundDepositFilterVisible"
  );

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

  setupSuggestionInputDynamic(
    filterDeposit,
    filterDepositSuggestions,
    "/api/lite/deposits",
    (selected) => {
      filterDepositHidden.value = selected?.id || "";
      filterDeposit.value = selected?.label || "";
      loadEntries(1);
    },
    "label"
  );

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
  ? document.addEventListener("DOMContentLoaded", initRefundDepositModule)
  : initRefundDepositModule();
