// 📦 autoBillingRule-filter-main.js – ENTERPRISE MASTER PARITY (FINAL)
// ============================================================================
// 🔹 FULL parity with registrationLog-filter-main.js
// 🔹 Auto search + auto filters (FIXED)
// 🔹 Trigger module live search (FIXED)
// 🔹 Date range wired (FIXED)
// 🔹 Sort bridge
// 🔹 View sync
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
  loadBillableItemsLite,
  loadAutoBillingRulesLite,
  setupSelectOptions,
  setupSuggestionInputDynamic,
} from "../../utils/data-loaders.js";

import { renderFieldSelector } from "../../utils/ui-utils.js";
import { exportToExcel, exportToPDF } from "../../utils/export-utils.js";
import { renderList, renderDynamicTableHead } from "./autoBillingRule-render.js";
import { setupActionHandlers } from "./autoBillingRule-actions.js";

import {
  FIELD_ORDER_AUTO_BILLING_RULE,
  FIELD_DEFAULTS_AUTO_BILLING_RULE,
} from "./autoBillingRule-constants.js";

import { setupVisibleFields } from "../../utils/field-visibility.js";
import { initPaginationControl } from "../../utils/pagination-control.js";

import { setupAutoSearch, setupAutoFilters } from "../../utils/search-utils.js";
import { syncViewToggleUI } from "../../utils/view-toggle.js";

/* ============================================================
   🔐 AUTH
============================================================ */
const token = initPageGuard(autoPagePermissionKey());
initLogoutWatcher();

const userRole = (localStorage.getItem("userRole") || "").toLowerCase();

const permissions = (() => {
  try {
    return (JSON.parse(localStorage.getItem("permissions")) || []).map(p =>
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
let viewMode = localStorage.getItem("autoBillingRuleView") || "table";
let sortBy = "";
let sortDir = "asc";

const sharedState = { currentEditIdRef: { value: null } };

/* ============================================================
   👁️ FIELD VISIBILITY
============================================================ */
let visibleFields = setupVisibleFields({
  moduleKey: "auto_billing_rule",
  userRole,
  defaultFields: FIELD_DEFAULTS_AUTO_BILLING_RULE,
  allowedFields: FIELD_ORDER_AUTO_BILLING_RULE,
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
  FIELD_ORDER_AUTO_BILLING_RULE
);

/* ============================================================
   🔎 DOM REFS
============================================================ */
const qs = (id) => document.getElementById(id);

const globalSearch = qs("globalSearch");
const dateRange = qs("dateRange");

const filterOrg = qs("filterOrganizationSelect");
const filterFacility = qs("filterFacilitySelect");

const filterTriggerModule = qs("filterTriggerModule");
const filterTriggerModuleId = qs("filterTriggerModuleId");
const filterTriggerModuleSuggestions = qs("filterTriggerModuleSuggestions");

const filterBillableItem = qs("filterBillableItemSelect");
const filterChargeMode = qs("filterChargeMode");
const filterStatus = qs("filterStatus");

/* ============================================================
   🔃 SORT BRIDGE
============================================================ */
window.setAutoBillingRuleSort = (field, dir) => {
  sortBy = field;
  sortDir = dir;
};

window.loadAutoBillingRulePage = (p = 1) => loadEntries(p);

/* ============================================================
   📄 PAGINATION
============================================================ */
const getPagination = initPaginationControl(
  "auto_billing_rule",
  loadEntries,
  Number(localStorage.getItem("autoBillingRulePageLimit") || 25)
);

/* ============================================================
   🔎 AUTO SEARCH + FILTERS (FIXED)
============================================================ */
setupAutoSearch(globalSearch, loadEntries);

setupAutoFilters({
  searchInput: globalSearch,
  selectInputs: [
    filterOrg,
    filterFacility,
    filterBillableItem,
    filterChargeMode,
    filterStatus,
  ],
  dateRangeInput: dateRange, // ✅ FIXED
  onChange: loadEntries,
});

/* ============================================================
   🔥 TRIGGER MODULE LIVE SEARCH (FIXED)
============================================================ */
let triggerDebounce;

filterTriggerModule?.addEventListener("input", () => {
  clearTimeout(triggerDebounce);

  triggerDebounce = setTimeout(() => {
    if (!filterTriggerModule.value.trim()) {
      filterTriggerModuleId.value = "";
    }
    loadEntries(1);
  }, 400);
});

/* ============================================================
   📋 FILTER BUILDER
============================================================ */
function getFilters() {
  return {
    search: globalSearch?.value?.trim(),
    dateRange: dateRange?.value,
    organization_id: filterOrg?.value,
    facility_id: filterFacility?.value,
    trigger_feature_module_id: filterTriggerModuleId?.value,
    trigger_module: filterTriggerModule?.value,
    billable_item_id: filterBillableItem?.value,
    charge_mode: filterChargeMode?.value,
    status: filterStatus?.value,
  };
}

/* ============================================================
   📦 LOAD DATA
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

    Object.entries(f).forEach(([k, v]) => {
      if (v) q.set(k, v);
    });

    const res = await authFetch(`/api/auto-billing-rules?${q.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    const json = await res.json();
    if (!res.ok) throw new Error(json?.message);

    const data = json.data || {};
    entries = data.records || [];
    currentPage = data.pagination?.page || safePage;

    renderList({ entries, visibleFields, viewMode, user, currentPage });

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
    showToast("❌ Failed to load Auto Billing Rules");
  } finally {
    hideLoading();
  }
}

/* ============================================================
   🧭 VIEW TOGGLE
============================================================ */
qs("tableViewBtn").onclick = () => {
  viewMode = "table";
  localStorage.setItem("autoBillingRuleView", "table");
  syncViewToggleUI({ mode: viewMode });
  renderList({ entries, visibleFields, viewMode, user, currentPage });
};

qs("cardViewBtn").onclick = () => {
  viewMode = "card";
  localStorage.setItem("autoBillingRuleView", "card");
  syncViewToggleUI({ mode: viewMode });
  renderList({ entries, visibleFields, viewMode, user, currentPage });
};

/* ============================================================
   🔄 RESET
============================================================ */
qs("resetFilterBtn")?.addEventListener("click", () => {
  [
    globalSearch,
    dateRange,
    filterOrg,
    filterFacility,
    filterBillableItem,
    filterChargeMode,
    filterStatus,
  ].forEach(el => el && (el.value = ""));

  if (filterTriggerModule) filterTriggerModule.value = "";
  if (filterTriggerModuleId) filterTriggerModuleId.value = "";

  loadEntries(1);
});

/* ============================================================
   🚀 INIT
============================================================ */
export async function initAutoBillingRuleModule() {
  renderDynamicTableHead(visibleFields);

  setupToggleSection(
    "toggleFilterBtn",
    "filterCollapse",
    "filterChevron",
    "autoBillingRuleFilterVisible"
  );

  try {
    /* ORG / FAC */
    const orgs = await loadOrganizationsLite();
    orgs.unshift({ id: "", name: "-- All Organizations --" });
    setupSelectOptions(filterOrg, orgs, "id", "name");

    const facs = await loadFacilitiesLite();
    facs.unshift({ id: "", name: "-- All Facilities --" });
    setupSelectOptions(filterFacility, facs, "id", "name");

    filterOrg?.addEventListener("change", async () => {
      const facs = await loadFacilitiesLite({
        organization_id: filterOrg.value,
      });
      facs.unshift({ id: "", name: "-- All Facilities --" });
      setupSelectOptions(filterFacility, facs, "id", "name");
    });

    /* BILLABLE */
    const billables = await loadBillableItemsLite();
    setupSelectOptions(
      filterBillableItem,
      billables,
      "id",
      "name",
      "-- All Billable Items --"
    );

    /* TRIGGER MODULE */
    setupSuggestionInputDynamic(
      filterTriggerModule,
      filterTriggerModuleSuggestions,
      "/api/lite/feature-modules",
      async (item) => {
        filterTriggerModule.value = item.name;
        filterTriggerModuleId.value = item.id;

        // 🔥 IMPORTANT: filter billables by module
        await loadBillableItemsLite(
          { code: item.key, _ts: Date.now() }, // 🔥 FORCE UNIQUE REQUEST
          true
        ).then((billables) => {
          billables.unshift({ id: "", name: "-- All Billable Items --" });

          setupSelectOptions(
            filterBillableItem,
            billables,
            "id",
            "name"
          );
        });

        loadEntries(1);
      },
      "name"
    );

  } catch (err) {
    console.error("❌ preload failed:", err);
  }

  await loadAutoBillingRulesLite();
  await loadEntries(1);
}

/* ============================================================
   🏁 BOOT
============================================================ */
document.readyState === "loading"
  ? document.addEventListener("DOMContentLoaded", initAutoBillingRuleModule)
  : initAutoBillingRuleModule();