// 📦 refund-filter-main.js – ENTERPRISE MASTER–ALIGNED (Refund ← Deposit Parity)
// ============================================================================
// 🔹 FRONTEND parity with payment-filter-main.js
// 🔹 Auto search + auto filters
// 🔹 Sorting + pagination parity
// 🔹 UI-only dateRange (MASTER)
// 🔹 View toggle + summary + export
// 🔹 NO new fields, NO new API params
// 🔹 ALL EXISTING DOM + API CALLS PRESERVED
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
  loadPaymentsLite,
  setupSelectOptions,
  setupSuggestionInputDynamic,
} from "../../utils/data-loaders.js";

import { renderFieldSelector } from "../../utils/ui-utils.js";
import { exportToExcel, exportToPDF } from "../../utils/export-utils.js";

import {
  renderList,
  renderDynamicTableHead,
} from "./refund-render.js";

import { setupRefundActionHandlers } from "./refund-actions.js";

import {
  FIELD_ORDER_REFUND,
  FIELD_DEFAULTS_REFUND,
  FIELD_LABELS_REFUND,
} from "./refund-constants.js";

import { setupVisibleFields } from "../../utils/field-visibility.js";
import { initPaginationControl } from "../../utils/pagination-control.js";
import { setupAutoSearch, setupAutoFilters } from "../../utils/search-utils.js";
import { mapDataForExport } from "../../utils/export-mapper.js";
import { syncViewToggleUI } from "../../utils/view-toggle.js";
import { renderModuleSummary } from "../../utils/render-module-summary.js";
import { formatDateTime, initTooltips } from "../../utils/ui-utils.js";

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
let viewMode = localStorage.getItem("refundView") || "table";
let sortBy = "";
let sortDir = "asc";

const sharedState = { currentEditIdRef: { value: null } };

/* ============================================================
   👁️ FIELD VISIBILITY
============================================================ */
let visibleFields = setupVisibleFields({
  moduleKey: "refund",
  userRole,
  defaultFields: FIELD_DEFAULTS_REFUND,
  allowedFields: FIELD_ORDER_REFUND,
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
  FIELD_ORDER_REFUND
);

/* ============================================================
   🔎 FILTER DOM
============================================================ */
const qs = (id) => document.getElementById(id);

const globalSearch = qs("globalSearch");

const filterOrg      = qs("filterOrganizationSelect");
const filterFacility = qs("filterFacilitySelect");
const filterStatus   = qs("filterStatus");
const filterMethod   = qs("filterMethodSelect");
const dateRange      = qs("dateRange");
const filterCurrency = qs("filterCurrencySelect"); // ✅ ADD

const filterPatient            = qs("filterPatient");
const filterPatientHidden      = qs("filterPatientId");
const filterPatientSuggestions = qs("filterPatientSuggestions");

const filterPayment            = qs("filterPayment");
const filterPaymentHidden      = qs("filterPaymentId");
const filterPaymentSuggestions = qs("filterPaymentSuggestions");

/* ============================================================
   🔃 SORT BRIDGE (MASTER)
============================================================ */
window.setRefundSort = (field, dir) => {
  sortBy = field;
  sortDir = dir;
};
window.loadRefundPage = (p = 1) => loadEntries(p);

/* ============================================================
   📄 PAGINATION
============================================================ */
const getPagination = initPaginationControl(
  "refund",
  loadEntries,
  Number(localStorage.getItem("refundPageLimit") || 25)
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
    payment_id: filterPaymentHidden?.value,
    dateRange: dateRange?.value,
    currency: filterCurrency?.value, 
  };
}

/* ============================================================
   📦 LOAD REFUNDS
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
    if (f.payment_id)      q.set("payment_id", f.payment_id);
    if (f.currency)        q.set("currency", f.currency);

    const res = await authFetch(`/api/refunds?${q.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    const json = await res.json();
    if (!res.ok) throw new Error(json?.message);

    const data = json.data || {};
    entries = data.records || [];
    currentPage = data.pagination?.page || safePage;

    renderList({ entries, visibleFields, viewMode, user, currentPage });

    /* ========================================================
       🧾 SUMMARY DATE NORMALIZATION (UI-UTIL PARITY)
       ✔ Uses formatDateTime
       ✔ Frontend only
       ✔ Matches Payment / Deposit pattern
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
        moduleLabel: "REFUNDS",
      });

    syncViewToggleUI({ mode: viewMode });

    setupRefundActionHandlers({
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
    showToast("❌ Failed to load refunds");
  } finally {
    hideLoading();
  }
}

/* ============================================================
   🧭 VIEW TOGGLE
============================================================ */
qs("tableViewBtn")?.addEventListener("click", () => {
  viewMode = "table";
  localStorage.setItem("refundView", "table");
  syncViewToggleUI({ mode: viewMode });
  renderList({ entries, visibleFields, viewMode, user, currentPage });
});

qs("cardViewBtn")?.addEventListener("click", () => {
  viewMode = "card";
  localStorage.setItem("refundView", "card");
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
    filterPayment,
    dateRange,
    filterCurrency,
  ].forEach((el) => el && (el.value = ""));

  filterPatientHidden.value = "";
  filterPaymentHidden.value = "";
  loadEntries(1);
});

/* ============================================================
   ⬇️ EXPORT
============================================================ */
qs("exportCSVBtn")?.addEventListener("click", () => {
  if (!entries.length) return showToast("❌ No data");
  exportToExcel(
    mapDataForExport(entries, visibleFields, FIELD_LABELS_REFUND),
    `refunds_${new Date().toISOString().slice(0, 10)}.csv`
  );
});

qs("exportPDFBtn")?.addEventListener("click", () => {
  exportToPDF(
    "Refunds List",
    viewMode === "table" ? ".table-container" : "#refundList",
    "portrait"
  );
});

/* ============================================================
   🚀 INIT
============================================================ */
export async function initRefundModule() {
  renderDynamicTableHead(visibleFields);

  setupToggleSection(
    "toggleFilterBtn",
    "filterCollapse",
    "filterChevron",
    "refundFilterVisible"
  );

  setupSuggestionInputDynamic(
    filterPatient,
    filterPatientSuggestions,
    "/api/lite/patients",
    async (selected) => {
      filterPatientHidden.value = selected?.id || "";
      filterPatient.value = selected?.label || "";

      if (selected?.id) {
        const payments = await loadPaymentsLite({ patient_id: selected.id });
        setupSelectOptions(
          filterPayment,
          payments,
          "id",
          "label",
          "-- All Payments --"
        );
      } else {
        setupSelectOptions(filterPayment, [], "id", "label", "-- All Payments --");
        filterPaymentHidden.value = "";
      }
      loadEntries(1);
    },
    "label"
  );

  setupSuggestionInputDynamic(
    filterPayment,
    filterPaymentSuggestions,
    "/api/lite/payments",
    (selected) => {
      filterPaymentHidden.value = selected?.id || "";
      filterPayment.value = selected?.label || "";
      loadEntries(1);
    },
    "label"
  );

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

  await loadEntries(1);
}

/* ============================================================
   🏁 BOOT
============================================================ */
document.readyState === "loading"
  ? document.addEventListener("DOMContentLoaded", initRefundModule)
  : initRefundModule();
