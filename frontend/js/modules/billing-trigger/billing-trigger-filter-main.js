// 📦 billing-trigger-filter-main.js – Enterprise Filter + Table/Card (FINAL – FULL SAFE UPGRADE)

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
  loadFeatureModulesLite, // 🔥 NEW (SAFE ADD)
  setupSelectOptions,
} from "../../utils/data-loaders.js";

import { renderFieldSelector } from "../../utils/ui-utils.js";
import { exportToExcel, exportToPDF } from "../../utils/export-utils.js";
import { mapDataForExport } from "../../utils/export-mapper.js";

import {
  renderList,
  renderDynamicTableHead,
} from "./billing-trigger-render.js";

import { setupActionHandlers } from "./billing-trigger-actions.js";

import {
  FIELD_ORDER_BILLING_TRIGGER,
  FIELD_DEFAULTS_BILLING_TRIGGER,
  FIELD_LABELS_BILLING_TRIGGER,
} from "./billing-trigger-constants.js";

import { setupVisibleFields } from "../../utils/field-visibility.js";
import { initPaginationControl } from "../../utils/pagination-control.js";
import { setupAutoSearch, setupAutoFilters } from "../../utils/search-utils.js";
import { syncViewToggleUI } from "../../utils/view-toggle.js";
import { renderModuleSummary } from "../../utils/render-module-summary.js";

/* ============================================================ */
const token = initPageGuard(autoPagePermissionKey());
initLogoutWatcher();

const userRole = (localStorage.getItem("userRole") || "").toLowerCase();
const permissions = (() => {
  try {
    return (JSON.parse(localStorage.getItem("permissions")) || [])
      .map(p => String(p.key || p).toLowerCase());
  } catch {
    return [];
  }
})();
const user = { role: userRole, permissions };

/* ============================================================ */
let entries = [];
let currentPage = 1;
let viewMode = localStorage.getItem("billingTriggerView") || "table";
let sortBy = "";
let sortDir = "asc";

const sharedState = { currentEditIdRef: { value: null } };

/* ============================================================ */
let visibleFields = setupVisibleFields({
  moduleKey: "billing_triggers",
  userRole,
  defaultFields: FIELD_DEFAULTS_BILLING_TRIGGER,
  allowedFields: FIELD_ORDER_BILLING_TRIGGER,
});

/* ============================================================ */
renderFieldSelector(
  {},
  visibleFields,
  (fields) => {
    visibleFields = fields;
    renderDynamicTableHead(visibleFields);
    renderList({ entries, visibleFields, viewMode, user, currentPage });
  },
  FIELD_ORDER_BILLING_TRIGGER
);

/* ============================================================ */
const qs = (id) => document.getElementById(id);

const globalSearch   = qs("globalSearch");
const filterModule   = qs("filterModuleSelect"); // 🔥 NEW
const filterOrg      = qs("filterOrganizationSelect");
const filterFacility = qs("filterFacilitySelect");
const filterActive   = qs("filterStatusSelect");
const dateRange      = qs("dateRange");

/* ============================================================ */
window.setBillingTriggerSort = (field, dir) => {
  sortBy = field;
  sortDir = dir;
};
window.loadBillingTriggerPage = (p = 1) => loadEntries(p);

/* ============================================================ */
const getPagination = initPaginationControl(
  "billingTrigger",
  loadEntries,
  Number(localStorage.getItem("billingTriggerPageLimit") || 25)
);

/* ============================================================ */
setupAutoSearch(globalSearch, loadEntries);

setupAutoFilters({
  searchInput: globalSearch,
  selectInputs: [
    filterModule, // 🔥 ADDED
    filterOrg,
    filterFacility,
    filterActive
  ],
  dateRangeInput: dateRange,
  onChange: loadEntries,
});

/* ============================================================ */
function getFilters() {
  return {
    search: globalSearch?.value?.trim() || undefined,

    feature_module_id: filterModule?.value || undefined, // 🔥 NEW

    organization_id: filterOrg?.value || undefined,
    facility_id: filterFacility?.value || undefined,

    is_active:
      filterActive?.value === "active"
        ? true
        : filterActive?.value === "inactive"
        ? false
        : undefined,

    dateRange: dateRange?.value || undefined,
  };
}

/* ============================================================ */
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
      if (v !== undefined && v !== "") q.set(k, v);
    });

    q.set("fields", visibleFields.join(","));

    const res = await authFetch(`/api/billing-triggers?${q.toString()}`, {
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
        moduleLabel: "BILLING TRIGGERS",
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
    showToast("❌ Failed to load billing triggers");
  } finally {
    hideLoading();
  }
}

/* ============================================================ */
qs("tableViewBtn").onclick = () => {
  viewMode = "table";
  localStorage.setItem("billingTriggerView", "table");
  syncViewToggleUI({ mode: viewMode });
  renderList({ entries, visibleFields, viewMode, user, currentPage });
};

qs("cardViewBtn").onclick = () => {
  viewMode = "card";
  localStorage.setItem("billingTriggerView", "card");
  syncViewToggleUI({ mode: viewMode });
  renderList({ entries, visibleFields, viewMode, user, currentPage });
};

/* ============================================================ */
qs("resetFilterBtn").onclick = () => {
  [globalSearch, filterModule, filterOrg, filterFacility, filterActive, dateRange].forEach(el => {
    if (el) el.value = "";
  });
  loadEntries(1);
};

/* ============================================================ */
qs("exportCSVBtn")?.addEventListener("click", () => {
  if (!entries.length) return showToast("❌ No data");
  exportToExcel(
    mapDataForExport(entries, visibleFields, FIELD_LABELS_BILLING_TRIGGER),
    `billing_triggers_${new Date().toISOString().slice(0, 10)}.csv`
  );
});

qs("exportPDFBtn")?.addEventListener("click", () => {
  exportToPDF(
    "Billing Triggers",
    viewMode === "table" ? ".table-container" : "#billingTriggerList",
    "portrait"
  );
});

/* ============================================================ */
export async function initBillingTriggerModule() {
  renderDynamicTableHead(visibleFields);

  setupToggleSection(
    "toggleFilterBtn",
    "filterCollapse",
    "filterChevron",
    "billingTriggerFilterVisible"
  );

  // 🔥 FEATURE MODULES (SAFE ADD)
  if (filterModule) {
    const modules = await loadFeatureModulesLite();
    modules.unshift({ id: "", name: "-- All Modules --" });
    setupSelectOptions(filterModule, modules, "id", "name");
  }

  // ORG
  if (filterOrg) {
    const orgs = await loadOrganizationsLite();
    orgs.unshift({ id: "", name: "-- All Organizations --" });
    setupSelectOptions(filterOrg, orgs, "id", "name");
  }

  // FACILITY
  if (filterFacility) {
    const facs = await loadFacilitiesLite();
    facs.unshift({ id: "", name: "-- All Facilities --" });
    setupSelectOptions(filterFacility, facs, "id", "name");
  }

  filterOrg?.addEventListener("change", async () => {
    const facs = await loadFacilitiesLite(filterOrg.value);
    facs.unshift({ id: "", name: "-- All Facilities --" });
    setupSelectOptions(filterFacility, facs, "id", "name");
    loadEntries(1);
  });

  await loadEntries(1);
}

/* ============================================================ */
document.readyState === "loading"
  ? document.addEventListener("DOMContentLoaded", initBillingTriggerModule)
  : initBillingTriggerModule();