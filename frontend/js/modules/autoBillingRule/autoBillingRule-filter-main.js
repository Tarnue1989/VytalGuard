// 📦 autoBillingRule-filter-main.js – Filters + Table/Card (Enterprise-Aligned)
// ============================================================================
// 🧭 Master Pattern: billableitem-filter-main.js / vital-filter-main.js
// 🔹 Full enterprise structure — auth guard, pagination, filters, exports,
//   field selector, unified UI logic, and consistent permission handling.
// 🔹 Added dynamic Trigger Module search (lite endpoint integration)
// 🔹 100% ID and dataset key preservation for safe integration.
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

/* ============================================================
   🔐 Auth Guard + Session Watch
============================================================ */
const token = initPageGuard(autoPagePermissionKey());
initLogoutWatcher();

/* ============================================================
   🌐 Role + Permissions
============================================================ */
const roleRaw = localStorage.getItem("userRole") || "";
const userRole = roleRaw.trim().toLowerCase();

let perms = [];
try {
  const rawPerms = JSON.parse(localStorage.getItem("permissions") || "[]");
  perms = Array.isArray(rawPerms)
    ? rawPerms.map((p) => String(p.key || p).toLowerCase().trim())
    : [];
} catch {
  perms = [];
}
const user = { role: userRole, permissions: perms };

/* ============================================================
   🧠 Shared State
============================================================ */
const sharedState = { currentEditIdRef: { value: null } };
window.showForm = () => {};
window.resetForm = () => {};

/* ============================================================
   🧩 Field Visibility + Selector
============================================================ */
window.entries = [];
let visibleFields = setupVisibleFields({
  moduleKey: "auto_billing_rule",
  userRole,
  defaultFields: FIELD_DEFAULTS_AUTO_BILLING_RULE,
  allowedFields: FIELD_ORDER_AUTO_BILLING_RULE,
});

renderFieldSelector(
  {},
  visibleFields,
  (newFields) => {
    visibleFields = newFields;
    renderDynamicTableHead(visibleFields);
    renderList({ entries, visibleFields, viewMode, user, currentPage });
  },
  FIELD_ORDER_AUTO_BILLING_RULE
);

/* ============================================================
   🔎 Filter DOM Refs
============================================================ */
const filterOrg = document.getElementById("filterOrganizationSelect");
const filterFacility = document.getElementById("filterFacilitySelect");
const filterTriggerModule = document.getElementById("filterTriggerModule");
const filterTriggerModuleId = document.getElementById("filterTriggerModuleId");
const filterTriggerModuleSuggestions = document.getElementById("filterTriggerModuleSuggestions");
const filterBillableItem = document.getElementById("filterBillableItemSelect");
const filterChargeMode = document.getElementById("filterChargeMode");
const filterStatus = document.getElementById("filterStatus");
const filterCreatedFrom = document.getElementById("filterCreatedFrom");
const filterCreatedTo = document.getElementById("filterCreatedTo");

const exportCSVBtn = document.getElementById("exportCSVBtn");
const exportPDFBtn = document.getElementById("exportPDFBtn");

/* ============================================================
   🌍 View + Paging
============================================================ */
let currentPage = 1;
let totalPages = 1;
let viewMode = localStorage.getItem("autoBillingRuleView") || "table";

/* ============================================================
   📋 Build Filter Object
============================================================ */
function getFilters() {
  return {
    organization_id: filterOrg?.value || "",
    facility_id: filterFacility?.value || "",
    trigger_feature_module_id: filterTriggerModuleId?.value || "",
    trigger_module: filterTriggerModule?.value || "",
    billable_item_id: filterBillableItem?.value || "",
    charge_mode: filterChargeMode?.value || "",
    status: filterStatus?.value || "",
    created_at: {
      gte: filterCreatedFrom?.value || "",
      lte: filterCreatedTo?.value || "",
    },
  };
}

/* ============================================================
   🔁 Pagination Control
============================================================ */
const getPagination = initPaginationControl(
  "auto_billing_rule",
  loadEntries,
  25
);

/* ============================================================
   📦 Load Auto Billing Rules
============================================================ */
async function loadEntries(page = 1) {
  try {
    showLoading();

    const filters = getFilters();
    const q = new URLSearchParams();
    const { page: safePage, limit: safeLimit } = getPagination(page);

    q.append("page", safePage);
    q.append("limit", safeLimit);

    if (filters.created_at.gte) q.append("created_at[gte]", filters.created_at.gte);
    if (filters.created_at.lte) q.append("created_at[lte]", filters.created_at.lte);

    Object.entries(filters).forEach(([k, v]) => {
      if (!v || typeof v === "object") return;
      q.append(k, v);
    });

    const safeFields = visibleFields.filter((f) =>
      FIELD_ORDER_AUTO_BILLING_RULE.includes(f)
    );
    if (safeFields.length) q.append("fields", safeFields.join(","));

    const res = await authFetch(`/api/auto-billing-rules?${q.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    const result = await res.json().catch(() => ({}));
    const payload = result?.data || {};
    const records = Array.isArray(payload.records) ? payload.records : [];

    window.entries = records;
    currentPage = Number(payload.pagination?.page) || safePage;
    totalPages = Number(payload.pagination?.pageCount) || 1;

    renderList({ entries, visibleFields, viewMode, user, currentPage });

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
      document.getElementById("paginationButtons"),
      currentPage,
      totalPages,
      loadEntries
    );

    if (!records.length)
      showToast("ℹ️ No Auto Billing Rules found for current filters");
  } catch (err) {
    console.error("❌ loadEntries failed:", err);
    showToast("❌ Failed to load Auto Billing Rules");
  } finally {
    hideLoading();
  }
}

/* ============================================================
   🧭 View Toggle (Table ↔ Card)
============================================================ */
document.getElementById("tableViewBtn").onclick = () => {
  viewMode = "table";
  localStorage.setItem("autoBillingRuleView", "table");
  renderList({ entries, visibleFields, viewMode, user, currentPage });
};

document.getElementById("cardViewBtn").onclick = () => {
  viewMode = "card";
  localStorage.setItem("autoBillingRuleView", "card");
  renderList({ entries, visibleFields, viewMode, user, currentPage });
};

/* ============================================================
   🔍 Filter Actions
============================================================ */
document.getElementById("filterBtn").onclick = async () => await loadEntries(1);

document.getElementById("resetFilterBtn").onclick = () => {
  [
    filterTriggerModule,
    filterBillableItem,
    filterChargeMode,
    filterStatus,
    filterCreatedFrom,
    filterCreatedTo,
  ].forEach((el) => {
    if (el) el.value = "";
  });
  if (filterTriggerModuleId) filterTriggerModuleId.value = "";

  if (userRole.includes("super")) {
    if (filterOrg) filterOrg.value = "";
    if (filterFacility) filterFacility.value = "";
  } else {
    const scopedOrgId = localStorage.getItem("organizationId");
    const scopedFacId = localStorage.getItem("facilityId");
    if (filterOrg) filterOrg.value = scopedOrgId || "";
    if (filterFacility) filterFacility.value = scopedFacId || "";
  }

  loadEntries(1);
};

/* ============================================================
   ⬇️ Export Tools
============================================================ */
if (exportCSVBtn)
  exportCSVBtn.onclick = () =>
    exportToExcel(
      entries,
      `auto_billing_rules_${new Date().toISOString().slice(0, 10)}.xlsx`
    );

if (exportPDFBtn)
  exportPDFBtn.onclick = () => {
    const target =
      viewMode === "table" ? ".table-container" : "#autoBillingRuleList";
    exportToPDF("Auto Billing Rule List", target, "portrait", true);
  };

/* ============================================================
   🚀 Init Module
============================================================ */
export async function initAutoBillingRuleModule() {
  renderDynamicTableHead(visibleFields);

  const filterCollapse = document.getElementById("filterCollapse");
  const filterChevron = document.getElementById("filterChevron");
  const filterVisible =
    localStorage.getItem("autoBillingRuleFilterVisible") === "true";

  if (filterVisible) {
    filterCollapse?.classList.remove("hidden");
    filterChevron?.classList.add("chevron-rotate");
  } else {
    filterCollapse?.classList.add("hidden");
    filterChevron?.classList.remove("chevron-rotate");
  }

  setupToggleSection(
    "toggleFilterBtn",
    "filterCollapse",
    "filterChevron",
    "autoBillingRuleFilterVisible"
  );

  try {
    // 🌐 Organization / Facility preload
    const orgs = await loadOrganizationsLite();
    if (userRole.includes("super")) {
      orgs.unshift({ id: "", name: "-- All Organizations --" });
      setupSelectOptions(filterOrg, orgs, "id", "name");

      let facilities = await loadFacilitiesLite();
      facilities.unshift({ id: "", name: "-- All Facilities --" });
      setupSelectOptions(filterFacility, facilities, "id", "name");

      filterOrg?.addEventListener("change", async () => {
        const selectedOrgId = filterOrg.value;
        try {
          let facs = selectedOrgId
            ? await loadFacilitiesLite({ organization_id: selectedOrgId })
            : await loadFacilitiesLite();
          facs.unshift({ id: "", name: "-- All Facilities --" });
          setupSelectOptions(filterFacility, facs, "id", "name");
        } catch (err) {
          console.error("❌ Facility reload failed:", err);
          showToast("❌ Could not load facilities for organization");
        }
      });
    } else {
      const scopedOrgId = localStorage.getItem("organizationId");
      const scopedFacId = localStorage.getItem("facilityId");
      if (filterOrg) {
        const scopedOrg = orgs.find((o) => o.id === scopedOrgId);
        setupSelectOptions(filterOrg, scopedOrg ? [scopedOrg] : [], "id", "name");
        filterOrg.disabled = true;
        filterOrg.value = scopedOrgId || "";
      }

      const facilities = scopedOrgId
        ? await loadFacilitiesLite({ organization_id: scopedOrgId })
        : [];
      setupSelectOptions(
        filterFacility,
        facilities,
        "id",
        "name",
        "-- All Facilities --"
      );
      if (scopedFacId) filterFacility.value = scopedFacId;
    }

    // 💳 Billable Items
    const billables = await loadBillableItemsLite();
    setupSelectOptions(
      filterBillableItem,
      billables,
      "id",
      "name",
      "-- All Billable Items --"
    );

    // ⚡ Dynamic Trigger Module Search
    setupSuggestionInputDynamic(
      filterTriggerModule,
      filterTriggerModuleSuggestions,
      "/api/lite/feature-modules",
      (item) => {
        filterTriggerModule.value = item.name;
        filterTriggerModuleId.value = item.id;
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
   🔁 Sync Helper (reserved)
============================================================ */
export function syncRefsToState() {
  // Reserved for enterprise reactive sync
}

/* ============================================================
   🏁 Boot
============================================================ */
function boot() {
  initAutoBillingRuleModule().catch((err) =>
    console.error("initAutoBillingRuleModule failed:", err)
  );
}
if (document.readyState === "loading")
  document.addEventListener("DOMContentLoaded", boot);
else boot();
