// 📦 discount-waiver-filter-main.js – Enterprise MASTER–ALIGNED (Deposit Filter Parity)
// ============================================================================
// 🔹 Pattern Source: deposit-filter-main.js (Enterprise MASTER)
// 🔹 Auto search + auto filters + sorting + pagination
// 🔹 UI-only dateRange (single input, NEVER DB column)
// 🔹 Org / Facility fully wired (role-aware)
// 🔹 Status handling aligned with MASTER
// 🔹 Summary + export aligned
// 🔹 ALL existing Discount Waiver API calls PRESERVED
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
} from "./discount-waiver-render.js";

import { setupActionHandlers } from "./discount-waiver-actions.js";

import {
  FIELD_ORDER_DISCOUNT_WAIVER,
  FIELD_DEFAULTS_DISCOUNT_WAIVER,
  FIELD_LABELS_DISCOUNT_WAIVER,
} from "./discount-waiver-constants.js";

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
let viewMode = localStorage.getItem("discountWaiverView") || "table";
let sortBy = "";
let sortDir = "asc";

const sharedState = { currentEditIdRef: { value: null } };

/* ============================================================
   👁️ FIELD VISIBILITY
============================================================ */
let visibleFields = setupVisibleFields({
  moduleKey: "discount_waiver", // ✅ BACKEND-SAFE KEY (MASTER)
  userRole,
  defaultFields: FIELD_DEFAULTS_DISCOUNT_WAIVER,
  allowedFields: FIELD_ORDER_DISCOUNT_WAIVER,
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
  FIELD_ORDER_DISCOUNT_WAIVER
);

/* ============================================================
   🔎 FILTER DOM (MASTER STRUCTURE)
============================================================ */
const qs = (id) => document.getElementById(id);

const globalSearch   = qs("globalSearch"); // ✅ REQUIRED FOR MASTER AUTO SEARCH
const filterOrg      = qs("filterOrganizationSelect");
const filterFacility = qs("filterFacilitySelect");
const filterStatus   = qs("filterStatus");
const dateRange      = qs("dateRange");
const filterCurrency = qs("filterCurrency");

const filterInvoice        = qs("filterInvoice");
const filterInvoiceHidden  = qs("filterInvoiceId");
const filterPatient        = qs("filterPatient");
const filterPatientHidden  = qs("filterPatientId");

/* ============================================================
   🔃 SORT BRIDGE (MASTER)
============================================================ */
window.setDiscountWaiverSort = (field, dir) => {
  sortBy = field;
  sortDir = dir;
};
window.loadDiscountWaiverPage = (p = 1) => loadEntries(p);

/* ============================================================
   📄 PAGINATION
============================================================ */
const getPagination = initPaginationControl(
  "discount_waiver",
  loadEntries,
  Number(localStorage.getItem("discountWaiverPageLimit") || 25)
);

/* ============================================================
   🔎 AUTO SEARCH / FILTERS (MASTER)
============================================================ */
setupAutoSearch(globalSearch, loadEntries);

setupAutoFilters({
  searchInput: globalSearch,
  selectInputs: [filterOrg, filterFacility, filterStatus, filterCurrency],
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
    currency: filterCurrency?.value,
    invoice_id: filterInvoiceHidden?.value,
    patient_id: filterPatientHidden?.value,
    dateRange: dateRange?.value, // UI-only
  };
}

/* ============================================================
   📦 LOAD DISCOUNT WAIVERS (MASTER SAFE)
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
      if (f.status)          q.set("status", f.status);      // 🔥 ADD THIS BACK
      if (f.currency)        q.set("currency", f.currency);
      if (f.invoice_id)      q.set("invoice_id", f.invoice_id);
      if (f.patient_id)      q.set("patient_id", f.patient_id);

    const res = await authFetch(`/api/discount-waivers?${q.toString()}`, {
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
        moduleLabel: "DISCOUNT WAIVERS",
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
    showToast("❌ Failed to load discount waivers");
  } finally {
    hideLoading();
  }
}

/* ============================================================
   🧭 VIEW TOGGLE
============================================================ */
qs("tableViewBtn").onclick = () => {
  viewMode = "table";
  localStorage.setItem("discountWaiverView", "table");
  syncViewToggleUI({ mode: viewMode });
  renderList({ entries, visibleFields, viewMode, user, currentPage });
};

qs("cardViewBtn").onclick = () => {
  viewMode = "card";
  localStorage.setItem("discountWaiverView", "card");
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
    filterCurrency,
    filterInvoice,
    filterPatient,
    dateRange,
  ].forEach((el) => el && (el.value = ""));
  filterInvoiceHidden.value = "";
  filterPatientHidden.value = "";
  loadEntries(1);
};

/* ============================================================
   ⬇️ EXPORT (MASTER)
============================================================ */
qs("exportCSVBtn")?.addEventListener("click", () => {
  if (!entries.length) return showToast("❌ No data");
  exportToExcel(
    mapDataForExport(entries, visibleFields, FIELD_LABELS_DISCOUNT_WAIVER),
    `discount_waivers_${new Date().toISOString().slice(0, 10)}.csv`
  );
});

qs("exportPDFBtn")?.addEventListener("click", () => {
  exportToPDF(
    "Discount Waivers List",
    viewMode === "table" ? ".table-container" : "#discountWaiverList",
    "portrait"
  );
});

/* ============================================================
   🚀 INIT
============================================================ */
export async function initDiscountWaiverModule() {
  renderDynamicTableHead(visibleFields);

  setupToggleSection(
    "toggleFilterBtn",
    "filterCollapse",
    "filterChevron",
    "discountWaiverFilterVisible"
  );

  setupSuggestionInputDynamic(
    filterInvoice,
    qs("filterInvoiceSuggestions"),
    "/api/lite/invoices",
    (selected) => {
      filterInvoiceHidden.value = selected?.id || "";
      filterInvoice.value = selected?.invoice_number || "";
      loadEntries(1);
    },
    "label"
  );

  setupSuggestionInputDynamic(
    filterPatient,
    qs("filterPatientSuggestions"),
    "/api/lite/patients",
    (selected) => {
      filterPatientHidden.value = selected?.id || "";
      filterPatient.value = selected?.label || "";
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
  ? document.addEventListener("DOMContentLoaded", initDiscountWaiverModule)
  : initDiscountWaiverModule();
