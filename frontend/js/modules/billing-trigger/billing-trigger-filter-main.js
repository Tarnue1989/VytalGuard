// 📦 billing-trigger-filter-main.js – Enterprise Filter + Table/Card (Master Pattern)
// ============================================================================
// 🔹 Converted from patient-filter-main.js
// 🔹 Fully aligned with BillingTrigger controller + routes
// 🔹 Preserves ALL required IDs for list + form interoperability
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
  setupSelectOptions,
} from "../../utils/data-loaders.js";

import { renderFieldSelector } from "../../utils/ui-utils.js";
import { exportToExcel, exportToPDF } from "../../utils/export-utils.js";
import { renderList, renderDynamicTableHead } from "./billing-trigger-render.js";
import { setupActionHandlers } from "./billing-trigger-actions.js";
import {
  FIELD_ORDER_BILLING_TRIGGER,
  FIELD_DEFAULTS_BILLING_TRIGGER,
} from "./billing-trigger-constants.js";
import { setupVisibleFields } from "../../utils/field-visibility.js";
import { initPaginationControl } from "../../utils/pagination-control.js";

/* ============================================================
   🔐 Auth Guard + Role Context
============================================================ */
const token = initPageGuard(autoPagePermissionKey());
initLogoutWatcher();

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
  moduleKey: "billing_trigger",
  userRole,
  defaultFields: FIELD_DEFAULTS_BILLING_TRIGGER,
  allowedFields: FIELD_ORDER_BILLING_TRIGGER,
});

renderFieldSelector(
  {},
  visibleFields,
  (newFields) => {
    visibleFields = newFields;
    renderDynamicTableHead(visibleFields);
    renderList({ entries, visibleFields, viewMode, user, currentPage });
  },
  FIELD_ORDER_BILLING_TRIGGER
);

/* ============================================================
   🔎 Filter DOM Refs (IDS MUST MATCH HTML)
============================================================ */
const filterModuleKey = document.getElementById("filterModuleKey");
const filterStatus = document.getElementById("filterStatus");
const filterActive = document.getElementById("filterIsActive");

const filterOrganizationSelect = document.getElementById("filterOrganizationSelect");
const filterFacilitySelect = document.getElementById("filterFacilitySelect");

const exportCSVBtn = document.getElementById("exportCSVBtn");
const exportPDFBtn = document.getElementById("exportPDFBtn");

/* ============================================================
   🌍 View + Pagination State
============================================================ */
let currentPage = 1;
let totalPages = 1;
let viewMode = localStorage.getItem("billingTriggerView") || "table";
const getPagination = initPaginationControl(
  "billing_trigger",
  loadEntries,
  25
);

/* ============================================================
   📋 Build Filters
============================================================ */
function getFilters() {
  return {
    module_key: filterModuleKey?.value || "",
    trigger_status: filterStatus?.value || "",
    is_active: filterActive?.value || "",
    organization_id: filterOrganizationSelect?.value || "",
    facility_id: filterFacilitySelect?.value || "",
  };
}

/* ============================================================
   📦 Load Billing Triggers
============================================================ */
async function loadEntries(page = 1) {
  try {
    showLoading();

    const filters = getFilters();
    const q = new URLSearchParams();
    const { page: safePage, limit: safeLimit } = getPagination(page);

    q.append("page", safePage);
    q.append("limit", safeLimit);

    Object.entries(filters).forEach(([k, v]) => {
      if (!v) return;
      q.append(k, v);
    });

    const safeFields = visibleFields.filter((f) =>
      FIELD_ORDER_BILLING_TRIGGER.includes(f)
    );
    if (safeFields.length) q.append("fields", safeFields.join(","));

    const res = await authFetch(`/api/billing-triggers?${q.toString()}`);
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
      showToast("ℹ️ No billing triggers found for current filters");
  } catch (err) {
    console.error("❌ loadEntries failed:", err);
    showToast("❌ Failed to load billing triggers");
  } finally {
    hideLoading();
  }
}

/* ============================================================
   🧭 View Toggle (Table ↔ Card)
============================================================ */
document.getElementById("tableViewBtn")?.addEventListener("click", () => {
  viewMode = "table";
  localStorage.setItem("billingTriggerView", "table");
  renderList({ entries, visibleFields, viewMode, user, currentPage });
  document.getElementById("tableViewBtn")?.classList.add("active");
  document.getElementById("cardViewBtn")?.classList.remove("active");
});

document.getElementById("cardViewBtn")?.addEventListener("click", () => {
  viewMode = "card";
  localStorage.setItem("billingTriggerView", "card");
  renderList({ entries, visibleFields, viewMode, user, currentPage });
  document.getElementById("cardViewBtn")?.classList.add("active");
  document.getElementById("tableViewBtn")?.classList.remove("active");
});

/* ============================================================
   🔍 Filter Actions
============================================================ */
document.getElementById("filterBtn")?.addEventListener("click", () => {
  loadEntries(1);
});

document.getElementById("resetFilterBtn")?.addEventListener("click", () => {
  [
    filterModuleKey,
    filterStatus,
    filterActive,
    filterOrganizationSelect,
    filterFacilitySelect,
  ].forEach((el) => {
    if (el) el.value = "";
  });
  loadEntries(1);
});

/* ============================================================
   ⬇️ Export Tools
============================================================ */
if (exportCSVBtn)
  exportCSVBtn.onclick = () =>
    exportToExcel(
      entries,
      `billing_triggers_${new Date().toISOString().slice(0, 10)}.xlsx`
    );

if (exportPDFBtn)
  exportPDFBtn.onclick = () => {
    const target =
      viewMode === "table" ? ".table-container.active" : "#billingTriggerList";
    exportToPDF("Billing Triggers", target, "landscape", true);
  };

/* ============================================================
   🚀 Init Module
============================================================ */
export async function initBillingTriggerModule() {
  renderDynamicTableHead(visibleFields);

  setupToggleSection(
    "toggleFilterBtn",
    "filterCollapse",
    "filterChevron",
    "billingTriggerFilterVisible"
  );

  // Org / Facility filters (superadmin aware)
  if (filterOrganizationSelect) {
    setupSelectOptions(
      filterOrganizationSelect,
      await loadOrganizationsLite(),
      "id",
      "name",
      "-- All Organizations --"
    );
  }

  if (filterFacilitySelect && filterOrganizationSelect) {
    filterOrganizationSelect.addEventListener("change", async () => {
      setupSelectOptions(
        filterFacilitySelect,
        await loadFacilitiesLite({
          organization_id: filterOrganizationSelect.value,
        }),
        "id",
        "name",
        "-- All Facilities --"
      );
    });
  }

  await loadEntries(1);
}

/* ============================================================
   🏁 Boot
============================================================ */
function boot() {
  initBillingTriggerModule().catch((err) =>
    console.error("initBillingTriggerModule failed:", err)
  );
}

if (document.readyState === "loading")
  document.addEventListener("DOMContentLoaded", boot);
else boot();
