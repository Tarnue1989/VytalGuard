// 📦 discount-filter-main.js – Enterprise MASTER–ALIGNED (Deposit Parity)
// ============================================================================
// 🔹 FULLY mirrors deposit-filter-main.js MASTER pattern
// 🔹 Auto search + auto filters (NO manual Search button)
// 🔹 UI-only dateRange (single input, NEVER DB column)
// 🔹 Sorting, pagination, summary, export – unified
// 🔹 Org / Facility role-aware
// 🔹 Preserves ALL existing Discount API calls
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
} from "./discount-render.js";

import { setupActionHandlers } from "./discount-actions.js";

import {
  FIELD_ORDER_DISCOUNT,
  FIELD_DEFAULTS_DISCOUNT,
  FIELD_LABELS_DISCOUNT,
} from "./discount-constants.js";

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
let viewMode = localStorage.getItem("discountView") || "table";
let sortBy = "";
let sortDir = "asc";

const sharedState = { currentEditIdRef: { value: null } };

/* ============================================================
   👁️ FIELD VISIBILITY
============================================================ */
let visibleFields = setupVisibleFields({
  moduleKey: "discount",
  userRole,
  defaultFields: FIELD_DEFAULTS_DISCOUNT,
  allowedFields: FIELD_ORDER_DISCOUNT,
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
  FIELD_ORDER_DISCOUNT
);

/* ============================================================
   🔎 FILTER DOM (MASTER)
============================================================ */
const qs = (id) => document.getElementById(id);

const globalSearch   = qs("globalSearch");
const filterOrg      = qs("filterOrganizationSelect");
const filterFacility = qs("filterFacilitySelect");
const filterStatus   = qs("filterStatus");
const dateRange      = qs("dateRange");

const filterInvoice            = qs("filterInvoice");
const filterInvoiceHidden      = qs("filterInvoiceId");
const filterInvoiceSuggestions = qs("filterInvoiceSuggestions");

const filterType   = qs("filterTypeSelect");
const filterReason = qs("filterReason");
const filterCurrency = qs("filterCurrency"); 

/* ============================================================
   🔃 SORT BRIDGE (MASTER)
============================================================ */
window.setDiscountSort = (field, dir) => {
  sortBy = field;
  sortDir = dir;
};
window.loadDiscountPage = (p = 1) => loadEntries(p);

/* ============================================================
   📄 PAGINATION
============================================================ */
const getPagination = initPaginationControl(
  "discount",
  loadEntries,
  Number(localStorage.getItem("discountPageLimit") || 25)
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
    filterType,
    filterCurrency, 
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
    type: filterType?.value,
    reason: filterReason?.value,
    invoice_id: filterInvoiceHidden?.value,
    dateRange: dateRange?.value,
    currency: filterCurrency?.value,
  };
}

/* ============================================================
   📦 LOAD DISCOUNTS (MASTER SAFE)
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
    if (f.type)            q.set("type", f.type);
    if (f.reason)          q.set("reason", f.reason);
    if (f.invoice_id)      q.set("invoice_id", f.invoice_id);
    if (f.currency) q.set("currency", f.currency);

    const res = await authFetch(`/api/discounts?${q.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    const json = await res.json();
    if (!res.ok) throw new Error(json?.message);

    const data = json.data || {};
    entries = data.records || [];
    currentPage = data.pagination?.page || safePage;

    renderList({ entries, visibleFields, viewMode, user, currentPage });

    data.summary?.discount_summary &&
      renderModuleSummary(
        data.summary.discount_summary,
        "moduleSummary",
        {
          moduleLabel: "DISCOUNTS",
        }
      );

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
    showToast("❌ Failed to load discounts");
  } finally {
    hideLoading();
  }
}

/* ============================================================
   🧭 VIEW TOGGLE
============================================================ */
qs("tableViewBtn").onclick = () => {
  viewMode = "table";
  localStorage.setItem("discountView", "table");
  syncViewToggleUI({ mode: viewMode });
  renderList({ entries, visibleFields, viewMode, user, currentPage });
};

qs("cardViewBtn").onclick = () => {
  viewMode = "card";
  localStorage.setItem("discountView", "card");
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
    filterType,
    filterReason,
    filterInvoice,
    dateRange,
  ].forEach((el) => el && (el.value = ""));
  if (filterInvoiceHidden) filterInvoiceHidden.value = "";
  loadEntries(1);
};

/* ============================================================
   ⬇️ EXPORT (MASTER)
============================================================ */
qs("exportCSVBtn")?.addEventListener("click", () => {
  if (!entries.length) return showToast("❌ No data");
  exportToExcel(
    mapDataForExport(entries, visibleFields, FIELD_LABELS_DISCOUNT),
    `discounts_${new Date().toISOString().slice(0, 10)}.csv`
  );
});

qs("exportPDFBtn")?.addEventListener("click", () => {
  exportToPDF(
    "Discounts List",
    viewMode === "table" ? ".table-container" : "#discountList",
    "portrait"
  );
});

/* ============================================================
   🚀 INIT
============================================================ */
export async function initDiscountModule() {
  renderDynamicTableHead(visibleFields);

  setupToggleSection(
    "toggleFilterBtn",
    "filterCollapse",
    "filterChevron",
    "discountFilterVisible"
  );

  setupSuggestionInputDynamic(
    filterInvoice,
    filterInvoiceSuggestions,
    "/api/lite/invoices",
    (selected) => {
      filterInvoiceHidden.value = selected?.id || "";
      filterInvoice.value = selected?.label || "";
      loadEntries(1); // ✅ IMMEDIATE SEARCH
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
  ? document.addEventListener("DOMContentLoaded", initDiscountModule)
  : initDiscountModule();
