// 📦 payment-filter-main.js – Enterprise MASTER–ALIGNED (Deposit Parity)
// ============================================================================
// 🔹 FULLY mirrors deposit-filter-main.js MASTER pattern
// 🔹 Auto search, auto filters, sorting, pagination
// 🔹 UI-only dateRange (single input, NEVER DB column)
// 🔹 Org / Facility fully wired (role-aware)
// 🔹 Payment Status fully wired
// 🔹 Summary + export aligned
// 🔹 ALL existing Payment API calls PRESERVED
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
  loadAccountsLite
} from "../../utils/data-loaders.js";

import { renderFieldSelector } from "../../utils/ui-utils.js";
import { exportToExcel, exportToPDF } from "../../utils/export-utils.js";

import {
  renderList,
  renderDynamicTableHead,
} from "./payment-render.js";

import { setupActionHandlers } from "./payment-actions.js";

import {
  FIELD_ORDER_PAYMENT,
  FIELD_DEFAULTS_PAYMENT,
  FIELD_LABELS_PAYMENT,
} from "./payment-constants.js";

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
let viewMode = localStorage.getItem("paymentView") || "table";
let sortBy = "";
let sortDir = "asc";

const sharedState = { currentEditIdRef: { value: null } };

/* ============================================================
   👁️ FIELD VISIBILITY
============================================================ */
let visibleFields = setupVisibleFields({
  moduleKey: "payment",
  userRole,
  defaultFields: FIELD_DEFAULTS_PAYMENT,
  allowedFields: FIELD_ORDER_PAYMENT,
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
  FIELD_ORDER_PAYMENT
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

const filterMethod        = qs("filterMethodSelect");
const filterCurrency      = qs("filterCurrency"); // ✅ ADD
const filterTransactionRef = qs("filterTransactionRef");
const filterAccount = qs("filterAccountSelect");

/* ============================================================
   🔃 SORT BRIDGE (MASTER)
============================================================ */
window.setPaymentSort = (field, dir) => {
  sortBy = field;
  sortDir = dir;
};
window.loadPaymentPage = (p = 1) => loadEntries(p);

/* ============================================================
   📄 PAGINATION
============================================================ */
const getPagination = initPaginationControl(
  "payment",
  loadEntries,
  Number(localStorage.getItem("paymentPageLimit") || 25)
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
    filterAccount,
  ],
  dateRangeInput: dateRange,
  onChange: loadEntries,
});

/* ============================================================
   📋 FILTER BUILDER (MASTER SAFE)
============================================================ */
function getFilters() {
  return {
    search: globalSearch?.value?.trim() || "",
    organization_id: filterOrg?.value || "",
    facility_id: filterFacility?.value || "",
    status: filterStatus?.value || "",
    method: filterMethod?.value || "",
    currency: filterCurrency?.value || "",
    transaction_ref: filterTransactionRef?.value || "",
    patient_id: filterPatientHidden?.value || "",
    dateRange: dateRange?.value || "",
    account_id: filterAccount?.value || "",
  };
}

/* ============================================================
   📦 LOAD PAYMENTS (DEBUG + SAFE)
============================================================ */
async function loadEntries(page = 1) {
  try {
    showLoading();

    const q = new URLSearchParams();
    const { page: safePage, limit } = getPagination(page);
    const f = getFilters();

    console.log("====================================");
    console.log("🔥 FRONTEND LOAD START");
    console.log("📥 FILTERS:", f);

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
    if (f.currency)        q.set("currency", f.currency);
    if (f.account_id)      q.set("account_id", f.account_id);
    if (f.transaction_ref) q.set("transaction_ref", f.transaction_ref);
    if (f.patient_id)      q.set("patient_id", f.patient_id);

    console.log("🌐 FINAL QUERY:", q.toString());

    const res = await authFetch(`/api/payments?${q.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    console.log("📡 RESPONSE STATUS:", res.status);

    let json = {};
    try {
      json = await res.json();
    } catch (parseErr) {
      console.error("💥 JSON PARSE ERROR:", parseErr);
      throw new Error("Invalid JSON response from server");
    }

    console.log("📦 API RESPONSE:", json);

    if (!res.ok) {
      console.error("💥 BACKEND ERROR:", json);
      throw new Error(json?.message || "Backend request failed");
    }

    /* ========================================================
       🛡️ SAFE DATA EXTRACTION
    ======================================================== */
    const data = json?.data || {};

    console.log("📊 DATA BLOCK:", data);

    if (!data || typeof data !== "object") {
      throw new Error("Invalid data format from backend");
    }

    entries = Array.isArray(data.records) ? data.records : [];
    currentPage = data.pagination?.page || safePage;

    console.log("📋 ENTRIES:", entries);

    /* ========================================================
       🧩 RENDER (THIS IS WHERE ERRORS USUALLY HAPPEN)
    ======================================================== */
    try {
      renderList({ entries, visibleFields, viewMode, user, currentPage });
    } catch (renderErr) {
      console.error("💥 RENDER ERROR:", renderErr);
      throw new Error("Render failed: " + renderErr.message);
    }

    try {
      if (data.summary) {
        renderModuleSummary(data.summary, "moduleSummary", {
          moduleLabel: "PAYMENTS",
        });
      }
    } catch (summaryErr) {
      console.error("💥 SUMMARY ERROR:", summaryErr);
    }

    try {
      syncViewToggleUI({ mode: viewMode });
    } catch (viewErr) {
      console.error("💥 VIEW TOGGLE ERROR:", viewErr);
    }

    try {
      setupActionHandlers({
        entries,
        token,
        currentPage,
        loadEntries,
        visibleFields,
        sharedState,
        user,
      });
    } catch (actionErr) {
      console.error("💥 ACTION HANDLER ERROR:", actionErr);
    }

    try {
      renderPaginationControls(
        qs("paginationButtons"),
        currentPage,
        data.pagination?.pageCount || 1,
        loadEntries
      );
    } catch (paginationErr) {
      console.error("💥 PAGINATION ERROR:", paginationErr);
    }

    console.log("✅ FRONTEND LOAD SUCCESS");

  } catch (err) {
    console.log("====================================");
    console.error("💥 FINAL FRONTEND ERROR:", err);
    console.log("====================================");

    showToast(err.message || "❌ Failed to load payments");
  } finally {
    hideLoading();
  }
}
/* ============================================================
   🧭 VIEW TOGGLE
============================================================ */
qs("tableViewBtn").onclick = () => {
  viewMode = "table";
  localStorage.setItem("paymentView", "table");
  syncViewToggleUI({ mode: viewMode });
  renderList({ entries, visibleFields, viewMode, user, currentPage });
};

qs("cardViewBtn").onclick = () => {
  viewMode = "card";
  localStorage.setItem("paymentView", "card");
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
    filterCurrency,
    filterAccount,
    filterTransactionRef,
    filterPatient,
    dateRange,
  ].forEach((el) => el && (el.value = ""));
  filterPatientHidden.value = "";
  loadEntries(1);
};

/* ============================================================
   ⬇️ EXPORT (MASTER)
============================================================ */
qs("exportCSVBtn")?.addEventListener("click", () => {
  if (!entries.length) return showToast("❌ No data");
  exportToExcel(
    mapDataForExport(entries, visibleFields, FIELD_LABELS_PAYMENT),
    `payments_${new Date().toISOString().slice(0, 10)}.csv`
  );
});

qs("exportPDFBtn")?.addEventListener("click", () => {
  exportToPDF(
    "Payments List",
    viewMode === "table" ? ".table-container" : "#paymentList",
    "portrait"
  );
});

/* ============================================================
   🚀 INIT
============================================================ */
export async function initPaymentModule() {
  renderDynamicTableHead(visibleFields);

  setupToggleSection(
    "toggleFilterBtn",
    "filterCollapse",
    "filterChevron",
    "paymentFilterVisible"
  );

  setupSuggestionInputDynamic(
    filterPatient,
    filterPatientSuggestions,
    "/api/lite/patients",
    (selected) => {
      filterPatientHidden.value = selected?.id || "";
      filterPatient.value = selected?.label || "";
      loadEntries(1); // ✅ IMMEDIATE SEARCH
    },
    "label"
  );
  const accounts = await loadAccountsLite({}, true);
  accounts.unshift({ id: "", name: "-- All Accounts --" });
  setupSelectOptions(filterAccount, accounts, "id", "name");

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
  ? document.addEventListener("DOMContentLoaded", initPaymentModule)
  : initPaymentModule();
