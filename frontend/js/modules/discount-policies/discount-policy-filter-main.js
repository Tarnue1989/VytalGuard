// 📦 discount-policy-filter-main.js – Filters + Table/Card (no form)

import {
  showToast,
  showLoading,
  hideLoading,
  initPageGuard,
  setupToggleSection,
  renderPaginationControls,
  initLogoutWatcher,
} from "../../utils/index.js";

import {
  loadOrganizationsLite,
  loadFacilitiesLite,
  setupSelectOptions,
  setupSuggestionInputDynamic,
} from "../../utils/data-loaders.js";

import { renderFieldSelector } from "../../utils/ui-utils.js";
import { exportToExcel, exportToPDF } from "../../utils/export-utils.js";

import { renderList, renderDynamicTableHead } from "./discount-policy-render.js";
import { setupActionHandlers } from "./discount-policy-actions.js";

import {
  FIELD_ORDER_DISCOUNT_POLICY,
  FIELD_DEFAULTS_DISCOUNT_POLICY,
} from "./discount-policy-constants.js";

import { setupVisibleFields } from "../../utils/field-visibility.js";

// 🔐 Auth
const token = initPageGuard("discount-policies");
initLogoutWatcher();

// 📌 Role
const roleRaw = localStorage.getItem("userRole") || "";
const userRole = roleRaw.trim().toLowerCase();

// ✅ Shared state
const sharedState = { currentEditIdRef: { value: null } };

// 🛟 No-form stubs
window.showForm = () => {};
window.resetForm = () => {};

// 📋 Field visibility
window.entries = [];
let visibleFields = setupVisibleFields({
  moduleKey: "discount-policy",
  userRole,
  defaultFields: FIELD_DEFAULTS_DISCOUNT_POLICY,
  allowedFields: FIELD_ORDER_DISCOUNT_POLICY,
});

// 🧩 Field selector
renderFieldSelector(
  {},
  visibleFields,
  (newFields) => {
    visibleFields = newFields;
    renderDynamicTableHead(visibleFields);
    renderList({ entries, visibleFields, viewMode, userRole, currentPage });
  },
  FIELD_ORDER_DISCOUNT_POLICY
);

// 🧩 Filter DOM Refs
const filterOrg = document.getElementById("filterOrganizationSelect");
const filterFacility = document.getElementById("filterFacilitySelect");

const filterCode = document.getElementById("filterCode");
const filterName = document.getElementById("filterName");
const filterAppliesTo = document.getElementById("filterAppliesToSelect");
const filterStatus = document.getElementById("filterStatus");

const filterEffectiveFrom = document.getElementById("filterEffectiveFrom");
const filterEffectiveTo = document.getElementById("filterEffectiveTo");

const filterActivatedFrom = document.getElementById("filterActivatedFrom");
const filterActivatedTo = document.getElementById("filterActivatedTo");
const filterDeactivatedFrom = document.getElementById("filterDeactivatedFrom");
const filterDeactivatedTo = document.getElementById("filterDeactivatedTo");
const filterExpiredFrom = document.getElementById("filterExpiredFrom");
const filterExpiredTo = document.getElementById("filterExpiredTo");

const filterActivatedBy = document.getElementById("filterActivatedBy");
const filterActivatedByHidden = document.getElementById("filterActivatedById");
const filterActivatedBySuggestions = document.getElementById("filterActivatedBySuggestions");

const filterDeactivatedBy = document.getElementById("filterDeactivatedBy");
const filterDeactivatedByHidden = document.getElementById("filterDeactivatedById");
const filterDeactivatedBySuggestions = document.getElementById("filterDeactivatedBySuggestions");

const filterExpiredBy = document.getElementById("filterExpiredBy");
const filterExpiredByHidden = document.getElementById("filterExpiredById");
const filterExpiredBySuggestions = document.getElementById("filterExpiredBySuggestions");

// ⬇️ Export
const exportCSVBtn = document.getElementById("exportCSVBtn");
const exportPDFBtn = document.getElementById("exportPDFBtn");

// 🌐 View & paging
let currentPage = 1;
let totalPages = 1;
let viewMode = localStorage.getItem("discountPolicyView") || "table";

// 📋 Build filters
function getFilters() {
  return {
    organization_id: filterOrg?.value || "",
    facility_id: filterFacility?.value || "",
    code: filterCode?.value || "",
    name: filterName?.value || "",
    applies_to: filterAppliesTo?.value || "",
    status: filterStatus?.value || "",

    effective_from: filterEffectiveFrom?.value || "",
    effective_to: filterEffectiveTo?.value || "",

    activated_from: filterActivatedFrom?.value || "",
    activated_to: filterActivatedTo?.value || "",
    deactivated_from: filterDeactivatedFrom?.value || "",
    deactivated_to: filterDeactivatedTo?.value || "",
    expired_from: filterExpiredFrom?.value || "",
    expired_to: filterExpiredTo?.value || "",

    activated_by_id: filterActivatedByHidden?.value || "",
    deactivated_by_id: filterDeactivatedByHidden?.value || "",
    expired_by_id: filterExpiredByHidden?.value || "",
  };
}

// 📦 Load Policies
async function loadEntries(page = 1) {
  try {
    const filters = getFilters();
    const q = new URLSearchParams();

    // handle date ranges
    if (filters.effective_from) q.append("effective_from[gte]", filters.effective_from);
    if (filters.effective_to) q.append("effective_to[lte]", filters.effective_to);
    if (filters.activated_from) q.append("activated_at[gte]", filters.activated_from);
    if (filters.activated_to) q.append("activated_at[lte]", filters.activated_to);
    if (filters.deactivated_from) q.append("deactivated_at[gte]", filters.deactivated_from);
    if (filters.deactivated_to) q.append("deactivated_at[lte]", filters.deactivated_to);
    if (filters.expired_from) q.append("expired_at[gte]", filters.expired_from);
    if (filters.expired_to) q.append("expired_at[lte]", filters.expired_to);

    Object.entries(filters).forEach(([k, v]) => {
      if (!v) return;
      if (k.endsWith("_from") || k.endsWith("_to")) return;
      q.append(k, v);
    });

    const safeFields = visibleFields.filter((f) =>
      FIELD_ORDER_DISCOUNT_POLICY.includes(f)
    );
    if (safeFields.length) q.append("fields", safeFields.join(","));

    const res = await fetch(`/api/discount-policies?page=${page}&limit=10&${q}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    let result = {};
    try {
      result = await res.json();
    } catch {
      console.warn("⚠️ Response not JSON");
    }

    const payload = result?.data || {};
    const records = Array.isArray(payload.records) ? payload.records : [];

    window.entries = records;
    currentPage = Number(payload.pagination?.page) || 1;
    totalPages = Number(payload.pagination?.pageCount) || 1;

    renderList({ entries, visibleFields, viewMode, userRole, currentPage });

    setupActionHandlers({
      entries,
      token,
      currentPage,
      loadEntries,
      visibleFields,
      sharedState,
    });

    renderPaginationControls(
      document.getElementById("paginationButtons"),
      currentPage,
      totalPages,
      loadEntries
    );
  } catch (err) {
    console.error("❌ loadEntries failed:", err);
    showToast("❌ Failed to load discount policies");
  }
}

// 🧭 View toggle
document.getElementById("tableViewBtn").onclick = () => {
  viewMode = "table";
  localStorage.setItem("discountPolicyView", "table");
  renderList({ entries, visibleFields, viewMode, userRole, currentPage });
};

document.getElementById("cardViewBtn").onclick = () => {
  viewMode = "card";
  localStorage.setItem("discountPolicyView", "card");
  renderList({ entries, visibleFields, viewMode, userRole, currentPage });
};

// 🔎 Filter actions
document.getElementById("filterBtn").onclick = async () => {
  try {
    showLoading();
    await loadEntries(1);
  } finally {
    hideLoading();
  }
};

document.getElementById("resetFilterBtn").onclick = () => {
  [
    "filterCode",
    "filterName",
    "filterAppliesToSelect",
    "filterStatus",
    "filterEffectiveFrom",
    "filterEffectiveTo",
    "filterActivatedFrom",
    "filterActivatedTo",
    "filterDeactivatedFrom",
    "filterDeactivatedTo",
    "filterExpiredFrom",
    "filterExpiredTo",
    "filterActivatedBy",
    "filterDeactivatedBy",
    "filterExpiredBy",
  ].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });

  if (filterActivatedByHidden) filterActivatedByHidden.value = "";
  if (filterDeactivatedByHidden) filterDeactivatedByHidden.value = "";
  if (filterExpiredByHidden) filterExpiredByHidden.value = "";

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

// ⬇️ Export
if (exportCSVBtn) {
  exportCSVBtn.onclick = () => {
    exportToExcel(
      entries,
      `discount_policies_${new Date().toISOString().slice(0, 10)}.xlsx`
    );
  };
}
if (exportPDFBtn) {
  exportPDFBtn.onclick = () => {
    const target = viewMode === "table" ? ".table-container" : "#discountPolicyList";
    exportToPDF("Discount Policies Report", target, "portrait", true);
  };
}

// 🚀 Init
export async function initDiscountPolicyModule() {
  renderDynamicTableHead(visibleFields);

  const filterCollapse = document.getElementById("filterCollapse");
  const filterChevron = document.getElementById("filterChevron");

  const filterVisible = localStorage.getItem("discountPolicyFilterVisible") === "true";
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
    "discountPolicyFilterVisible"
  );

  // ✅ preload org + facilities
  try {
    const orgs = await loadOrganizationsLite();
    if (userRole.includes("super")) {
      orgs.unshift({ id: "", name: "-- All Organizations --" });
      setupSelectOptions(filterOrg, orgs, "id", "name");

      let facilities = await loadFacilitiesLite();
      facilities.unshift({ id: "", name: "-- All Facilities --" });
      setupSelectOptions(filterFacility, facilities, "id", "name");

      filterOrg?.addEventListener("change", async () => {
        const selectedOrgId = filterOrg.value;
        let facs = selectedOrgId
          ? await loadFacilitiesLite({ organization_id: selectedOrgId })
          : await loadFacilitiesLite();
        facs.unshift({ id: "", name: "-- All Facilities --" });
        setupSelectOptions(filterFacility, facs, "id", "name");
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
      setupSelectOptions(filterFacility, facilities, "id", "name", "-- All Facilities --");
      if (scopedFacId) filterFacility.value = scopedFacId;
    }
  } catch (err) {
    console.error("❌ preload org/facility failed:", err);
  }

  await loadEntries(1);
}

// ❌ no-op
export function syncRefsToState() {}

// ---- boot ----
function boot() {
  initDiscountPolicyModule().catch((err) => {
    console.error("initDiscountPolicyModule failed:", err);
  });
}
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot);
} else {
  boot();
}
