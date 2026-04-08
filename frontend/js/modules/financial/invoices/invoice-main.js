// 📦 invoice-main.js – Filters + Table/Card (MASTER PARITY – PART 1)

import {
  showToast,
  showLoading,
  hideLoading,
  initPageGuard,
  autoPagePermissionKey,
  setupToggleSection,
  renderPaginationControls,
  initLogoutWatcher,
} from "../../../utils/index.js";

import { authFetch } from "../../../authSession.js";
import { renderModuleSummary } from "../../../utils/render-module-summary.js";
import {
  loadOrganizationsLite,
  loadFacilitiesLite,
  setupSelectOptions,
  setupSuggestionInputDynamic,
} from "../../../utils/data-loaders.js";

import { renderFieldSelector } from "../../../utils/ui-utils.js";
import { exportToExcel, exportToPDF } from "../../../utils/export-utils.js";

import { renderList, renderDynamicTableHead } from "./invoice-render.js";
import { setupActionHandlers } from "./invoice-actions.js";

import {
  FIELD_ORDER_INVOICE,
  FIELD_DEFAULTS_INVOICE,
} from "./invoice-constants.js";

import { setupVisibleFields } from "../../../utils/field-visibility.js";
import { initPaginationControl } from "../../../utils/pagination-control.js";

import {
  setupAutoSearch,
  setupAutoFilters,
} from "../../../utils/search-utils.js";

import { syncViewToggleUI } from "../../../utils/view-toggle.js";

/* ============================================================
   🔐 Auth + Session
============================================================ */
const token = initPageGuard(autoPagePermissionKey());
initLogoutWatcher();

/* ============================================================
   👥 Role & Permissions
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
window.entries = [];
window.showForm = () => {};
window.resetForm = () => {};

/* ============================================================
   🧩 Field Visibility
============================================================ */
let visibleFields = setupVisibleFields({
  moduleKey: "invoice",
  userRole,
  defaultFields: FIELD_DEFAULTS_INVOICE,
  allowedFields: FIELD_ORDER_INVOICE,
});

renderFieldSelector(
  {},
  visibleFields,
  (newFields) => {
    visibleFields = newFields;
    renderDynamicTableHead(visibleFields);
    renderList({ entries, visibleFields, viewMode, user, currentPage });
  },
  FIELD_ORDER_INVOICE
);

/* ============================================================
   🔎 FILTER DOM (MASTER)
============================================================ */
const qs = (id) => document.getElementById(id);

const globalSearch = qs("globalSearch");

const filterOrg = qs("filterOrganizationSelect");
const filterFacility = qs("filterFacilitySelect");
const filterStatus = qs("filterStatus");
const filterCurrency = qs("filterCurrency");
const filterPayerType = qs("filterPayerType");

const filterPatient = qs("filterPatient");
const filterPatientHidden = qs("filterPatientId");
const filterPatientSuggestions = qs("filterPatientSuggestions");

const dateRange = qs("dateRange");

const exportCSVBtn = qs("exportCSVBtn");
const exportPDFBtn = qs("exportPDFBtn");
const resetFilterBtn = qs("resetFilterBtn");

/* ============================================================
   🔁 SORT (MASTER)
============================================================ */
let sortBy = "";
let sortDir = "asc";

window.setInvoiceSort = (field, dir) => {
  sortBy = field;
  sortDir = dir;
};

window.loadInvoicePage = (p = 1) => loadEntries(p);

/* ============================================================
   📄 PAGINATION
============================================================ */
let currentPage = 1;
let totalPages = 1;
let viewMode = localStorage.getItem("invoiceView") || "table";

const getPagination = initPaginationControl(
  "invoice",
  loadEntries,
  Number(localStorage.getItem("invoicePageLimit") || 25)
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
    filterCurrency,
    filterPayerType,
  ],
  dateRangeInput: dateRange,
  onChange: loadEntries,
});

/* ============================================================
   📋 FILTER BUILDER (UPDATED)
============================================================ */
function getFilters() {
  return {
    search: globalSearch?.value?.trim(),
    organization_id: filterOrg?.value,
    facility_id: filterFacility?.value,
    status: filterStatus?.value,
    patient_id: filterPatientHidden?.value,
    dateRange: dateRange?.value,
    currency: filterCurrency?.value,
    payer_type: filterPayerType?.value, // ✅ ADD THIS
  };
}

/* ============================================================
   📦 LOAD INVOICES (MASTER)
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
      if (v && String(v).trim() !== "" && v !== "null") {
        q.set(k, v);
      }
    });

    const safeFields = visibleFields.filter((f) =>
      FIELD_ORDER_INVOICE.includes(f)
    );
    if (safeFields.length) q.set("fields", safeFields.join(","));

    const res = await authFetch(`/api/invoices?${q.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    const result = await res.json().catch(() => ({}));
    const payload = result?.data || {};

    const records = Array.isArray(payload.records) ? payload.records : [];

    const currency = records[0]?.currency || "USD";

    payload.summary = {
      ...(payload.summary || {}),
      currency,
    };

    window.entries = records;
    currentPage = Number(payload.pagination?.page) || safePage;
    totalPages = Number(payload.pagination?.pageCount) || 1;

    renderList({ entries, visibleFields, viewMode, user, currentPage });

    payload.summary &&
      renderModuleSummary(payload.summary);

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
      totalPages,
      loadEntries
    );
  } catch (err) {
    console.error(err);
    showToast("❌ Failed to load invoices");
  } finally {
    hideLoading();
  }
}
/* ============================================================
   🔄 RESET FILTERS (MASTER)
============================================================ */
if (resetFilterBtn)
  resetFilterBtn.onclick = async () => {
    [
      globalSearch,
      filterOrg,
      filterFacility,
      filterPatient,
      filterCurrency,
      filterPatientHidden,
      filterStatus,
      dateRange,
    ].forEach((el) => el && (el.value = ""));

    if (filterPatientSuggestions) filterPatientSuggestions.innerHTML = "";

    await loadEntries(1);
  };

/* ============================================================
   🪟 VIEW TOGGLE (MASTER SYNC)
============================================================ */
const cardViewBtn = document.getElementById("cardViewBtn");
const tableViewBtn = document.getElementById("tableViewBtn");

cardViewBtn?.addEventListener("click", () => {
  viewMode = "card";
  localStorage.setItem("invoiceView", "card");
  syncViewToggleUI({ mode: viewMode });
  renderList({ entries, visibleFields, viewMode, user, currentPage });
});

tableViewBtn?.addEventListener("click", () => {
  viewMode = "table";
  localStorage.setItem("invoiceView", "table");
  syncViewToggleUI({ mode: viewMode });
  renderList({ entries, visibleFields, viewMode, user, currentPage });
});

/* ============================================================
   ⬇️ EXPORT (MASTER ALIGNED)
============================================================ */
if (exportCSVBtn)
  exportCSVBtn.onclick = () => {
    if (!entries.length) return showToast("❌ No data");

    exportToExcel(
      entries,
      `invoices_${new Date().toISOString().slice(0, 10)}.csv`
    );
  };

if (exportPDFBtn)
  exportPDFBtn.onclick = () => {
    const targetSelector =
      viewMode === "table" ? ".table-container" : "#invoiceList";

    exportToPDF("Invoices List", targetSelector, "portrait");
  };

/* ============================================================
   🚀 INIT (MASTER)
============================================================ */
export async function initInvoiceModule() {
  renderDynamicTableHead(visibleFields);

  setupToggleSection(
    "toggleFilterBtn",
    "filterCollapse",
    "filterChevron",
    "invoiceFilterVisible"
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

  try {
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

      filterOrg.onchange = () =>
        reloadFacilities(filterOrg.value || null);
    } else {
      filterOrg?.closest(".form-group")?.classList.add("hidden");
      filterFacility?.closest(".form-group")?.classList.add("hidden");
    }
  } catch (err) {
    console.error(err);
    showToast("❌ Failed to load organization/facility filters");
  }

  await loadEntries(1);
}

/* ============================================================
   🏁 BOOT
============================================================ */
document.readyState === "loading"
  ? document.addEventListener("DOMContentLoaded", initInvoiceModule)
  : initInvoiceModule();