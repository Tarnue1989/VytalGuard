// 📦 refund-deposits-filter-main.js – Enterprise Master Pattern Aligned
// ============================================================================
// 🔹 Mirrors refund-filter-main.js for unified summary, export, and pagination
// 🔹 Handles Deposit Refund Summary (PDF/Excel-ready)
// 🔹 Supports RBAC-aware org/facility filters and lifecycle updates
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
  loadDepositsLite,
  setupSelectOptions,
  setupSuggestionInputDynamic,
} from "../../utils/data-loaders.js";

import { renderFieldSelector } from "../../utils/ui-utils.js";
import { exportToExcel, exportToPDF } from "../../utils/export-utils.js";
import {
  renderList,
  renderDynamicTableHead,
} from "./refund-deposits-render.js";

import {
  setupRefundDepositActionHandlers,
} from "./refund-deposits-actions.js";

import {
  FIELD_ORDER_REFUND_DEPOSIT,
  FIELD_DEFAULTS_REFUND_DEPOSIT,
} from "./refund-deposits-constants.js";

import { setupVisibleFields } from "../../utils/field-visibility.js";
import { initPaginationControl } from "../../utils/pagination-control.js";

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

/* ============================================================
   🧩 Field Visibility
============================================================ */
let visibleFields = setupVisibleFields({
  moduleKey: "refund-deposits",
  userRole,
  defaultFields: FIELD_DEFAULTS_REFUND_DEPOSIT,
  allowedFields: FIELD_ORDER_REFUND_DEPOSIT,
});

renderFieldSelector(
  {},
  visibleFields,
  (newFields) => {
    visibleFields = newFields;
    renderDynamicTableHead(visibleFields);
    renderList({ entries, visibleFields, viewMode, user, currentPage });
  },
  FIELD_ORDER_REFUND_DEPOSIT
);

/* ============================================================
   📊 Deposit Refund Summary Renderer (nested safe)
============================================================ */
function renderDepositRefundSummary(summary = {}) {
  const container = document.getElementById("moduleSummary");
  if (!container) return;

  const colorMap = {
    pending: "text-warning",
    approved: "text-success",
    processed: "text-info",
    reversed: "text-dark",
    voided: "text-muted",
    total: "text-dark fw-bold",
  };

  const keys = Object.keys(summary);
  if (!keys.length) {
    container.innerHTML = `<div class="text-muted small">No summary data</div>`;
    return;
  }

  const formatVal = (key, val) => {
    if (val == null) return 0;

    const currencyFields = /(amount|total|balance)/i;
    if (typeof val === "number" && currencyFields.test(key)) {
      return `$${val.toFixed(2)}`;
    }

    if (typeof val === "object") return JSON.stringify(val);
    return val;
  };

  container.innerHTML = `
    <div class="d-flex flex-wrap gap-3 align-items-center small fw-semibold mb-2">
      ${keys
        .map((key) => {
          const val = formatVal(key, summary[key]);
          const label = key.replace(/_/g, " ").toUpperCase();
          const color = colorMap[key.toLowerCase()] || "text-dark";
          return `<span class="${color}">${label}: ${val}</span>`;
        })
        .join('<span class="text-muted"> | </span>')}
    </div>
  `;
}

/* ============================================================
   🔎 Filter DOM
============================================================ */
const filterOrg = document.getElementById("filterOrganizationSelect");
const filterFacility = document.getElementById("filterFacilitySelect");
const filterPatient = document.getElementById("filterPatient");
const filterPatientHidden = document.getElementById("filterPatientId");
const filterPatientSuggestions = document.getElementById("filterPatientSuggestions");

const filterDeposit = document.getElementById("filterDeposit");
const filterDepositHidden = document.getElementById("filterDepositId");
const filterDepositSuggestions = document.getElementById("filterDepositSuggestions");

const filterMethod = document.getElementById("filterMethodSelect");
const filterStatus = document.getElementById("filterStatus");

const filterCreatedFrom = document.getElementById("filterCreatedFrom");
const filterCreatedTo = document.getElementById("filterCreatedTo");

const filterBtn = document.getElementById("filterBtn");
const resetFilterBtn = document.getElementById("resetFilterBtn");

const exportCSVBtn = document.getElementById("exportCSVBtn");
const exportPDFBtn = document.getElementById("exportPDFBtn");

/* ============================================================
   🔁 Pagination / State
============================================================ */
let currentPage = 1;
let totalPages = 1;

let viewMode =
  localStorage.getItem("refundDepositView") || "table";

const savedLimit = parseInt(
  localStorage.getItem("refundDepositPageLimit") || "25",
  10
);

let getPagination = initPaginationControl(
  "refund-deposits",
  loadEntries,
  savedLimit
);

const recordsPerPageSelect = document.getElementById("recordsPerPage");
if (recordsPerPageSelect) {
  recordsPerPageSelect.value = savedLimit;
  recordsPerPageSelect.addEventListener("change", async () => {
    const newLimit = parseInt(recordsPerPageSelect.value, 10);
    localStorage.setItem("refundDepositPageLimit", newLimit);
    getPagination = initPaginationControl(
      "refund-deposits",
      loadEntries,
      newLimit
    );
    await loadEntries(1);
  });
}

/* ============================================================
   📋 Filters Builder
============================================================ */
function getFilters() {
  return {
    organization_id: filterOrg?.value || "",
    facility_id: filterFacility?.value || "",
    patient_id: filterPatientHidden?.value || "",
    deposit_id: filterDepositHidden?.value || "",
    status: filterStatus?.value || "",
    method: filterMethod?.value || "",
    created_from: filterCreatedFrom?.value || "",
    created_to: filterCreatedTo?.value || "",
  };
}

/* ============================================================
   🧹 Reset Filters
============================================================ */
function clearFilters() {
  [
    filterOrg,
    filterFacility,
    filterPatient,
    filterPatientHidden,
    filterDeposit,
    filterDepositHidden,
    filterMethod,
    filterStatus,
    filterCreatedFrom,
    filterCreatedTo,
  ].forEach((el) => el && (el.value = ""));

  if (filterPatientSuggestions) filterPatientSuggestions.innerHTML = "";
  if (filterDepositSuggestions) filterDepositSuggestions.innerHTML = "";
}

/* ============================================================
   📦 Load Deposit Refunds + Summary
============================================================ */
async function loadEntries(page = 1) {
  try {
    showLoading();

    const filters = getFilters();
    const q = new URLSearchParams();

    const { page: safePage, limit: safeLimit } = getPagination(page);
    q.append("page", safePage);
    q.append("limit", safeLimit);

    if (filters.created_from) q.append("created_from", filters.created_from);
    if (filters.created_to) q.append("created_to", filters.created_to);

    Object.entries(filters).forEach(([k, v]) => {
      if (!v || ["created_from", "created_to"].includes(k)) return;
      q.append(k, v);
    });

    const safeFields = visibleFields.filter((f) =>
      FIELD_ORDER_REFUND_DEPOSIT.includes(f)
    );
    if (safeFields.length) q.append("fields", safeFields.join(","));

    const res = await authFetch(`/api/refund-deposits?${q.toString()}`);
    const result = await res.json().catch(() => ({}));

    const payload = result?.data || {};
    const records = Array.isArray(payload.records) ? payload.records : [];

    window.entries = records;
    currentPage = payload.pagination?.page || safePage;
    totalPages = payload.pagination?.pageCount || 1;

    renderList({
      entries,
      visibleFields,
      viewMode,
      user,
      currentPage,
    });

    if (payload.summary) renderDepositRefundSummary(payload.summary);

    setupRefundDepositActionHandlers({
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
  } catch (err) {
    console.error("❌ loadEntries failed:", err);
    showToast("❌ Failed to load deposit refunds");
  } finally {
    hideLoading();
  }
}

/* ============================================================
   🔘 Filter Buttons
============================================================ */
filterBtn?.addEventListener("click", async () => {
  if (filterPatientSuggestions) filterPatientSuggestions.innerHTML = "";
  if (filterDepositSuggestions) filterDepositSuggestions.innerHTML = "";
  await loadEntries(1);
});

resetFilterBtn?.addEventListener("click", async () => {
  clearFilters();
  await loadEntries(1);
});

/* ============================================================
   🪟 View Toggle
============================================================ */
document.getElementById("cardViewBtn")?.addEventListener("click", () => {
  viewMode = "card";
  localStorage.setItem("refundDepositView", "card");
  renderList({ entries, visibleFields, viewMode, user, currentPage });
});

document.getElementById("tableViewBtn")?.addEventListener("click", () => {
  viewMode = "table";
  localStorage.setItem("refundDepositView", "table");
  renderList({ entries, visibleFields, viewMode, user, currentPage });
});

/* ============================================================
   ⬇️ Export Tools
============================================================ */
exportCSVBtn.onclick = () =>
  exportToExcel(
    entries,
    `refund_deposits_${new Date().toISOString().slice(0, 10)}.xlsx`
  );

exportPDFBtn.onclick = () => {
  try {
    const targetSelector =
      viewMode === "table" ? ".table-container" : "#refundDepositList";
    const target = document.querySelector(targetSelector);
    if (!target) return showToast("⚠️ Nothing to export");

    const summaryEl = document.getElementById("moduleSummary");
    const summaryHTML = summaryEl
      ? `<div class="export-summary mb-3 border rounded p-2 bg-light" style="font-size:11px; text-align:center;">
           <h5 class="fw-bold mb-2">Deposit Refund Summary</h5>
           ${summaryEl.innerHTML}
         </div>`
      : "";

    const wrapper = document.createElement("div");
    wrapper.id = "exportWrapper";
    wrapper.innerHTML = summaryHTML + target.outerHTML;
    document.body.appendChild(wrapper);

    exportToPDF("DepositRefunds_Report", "#exportWrapper", "portrait", true);
    setTimeout(() => wrapper.remove(), 1000);
  } catch (err) {
    console.error("❌ Export PDF failed:", err);
    showToast("❌ Failed to export PDF");
  }
};

/* ============================================================
   🚀 Init Deposit Refund Module
============================================================ */
export async function initRefundDepositModule() {
  renderDynamicTableHead(visibleFields);

  setupSelectOptions(filterMethod, [
    { value: "", label: "-- All Methods --" },
    { value: "cash", label: "Cash" },
    { value: "card", label: "Card" },
    { value: "mobile_money", label: "Mobile Money" },
    { value: "bank_transfer", label: "Bank Transfer" },
    { value: "cheque", label: "Cheque" },
  ], "value", "label");

  // --- Filter collapse memory
  const collapse = document.getElementById("filterCollapse");
  const chevron = document.getElementById("filterChevron");
  const visible = localStorage.getItem("refundDepositFilterVisible") === "true";

  if (visible) {
    collapse?.classList.remove("hidden");
    chevron?.classList.add("chevron-rotate");
  } else {
    collapse?.classList.add("hidden");
    chevron?.classList.remove("chevron-rotate");
  }

  setupToggleSection(
    "toggleFilterBtn",
    "filterCollapse",
    "filterChevron",
    "refundDepositFilterVisible"
  );

  // --- Patient autocomplete → loads deposits dynamically
  setupSuggestionInputDynamic(
    filterPatient,
    filterPatientSuggestions,
    "/api/lite/patients",
    async (selected) => {
      filterPatientHidden.value = selected?.id || "";
      if (selected) {
        try {
          const deposits = await loadDepositsLite({
            patient_id: selected.id,
          });
          setupSelectOptions(
            filterDeposit,
            deposits,
            "id",
            "label",
            "-- Select Deposit --"
          );
        } catch {
          setupSelectOptions(
            filterDeposit,
            [],
            "id",
            "label",
            "-- Select Deposit --"
          );
        }
      } else {
        setupSelectOptions(filterDeposit, [], "id", "label");
        filterDepositHidden.value = "";
      }
    },
    "label"
  );

  // --- ORG/FACILITY RBAC Rules
  try {
    if (userRole.includes("super")) {
      const orgs = await loadOrganizationsLite();
      orgs.unshift({ id: "", name: "-- All Organizations --" });
      setupSelectOptions(filterOrg, orgs, "id", "name");

      filterOrg.addEventListener("change", async () => {
        const facs = await loadFacilitiesLite(
          filterOrg.value ? { organization_id: filterOrg.value } : {},
          true
        );
        facs.unshift({ id: "", name: "-- All Facilities --" });
        setupSelectOptions(filterFacility, facs, "id", "name");
      });
    } else if (userRole.includes("admin")) {
      filterOrg.closest(".form-group")?.classList.add("hidden");
      const facs = await loadFacilitiesLite({}, true);
      facs.unshift({ id: "", name: "-- All Facilities --" });
      setupSelectOptions(filterFacility, facs, "id", "name");
    } else {
      filterOrg.closest(".form-group")?.classList.add("hidden");
      filterFacility.closest(".form-group")?.classList.add("hidden");
    }
  } catch (e) {
    console.error("Failed loading RBAC dropdowns:", e);
  }

  await loadEntries(1);
}

/* ============================================================
   🏁 Boot
============================================================ */
function boot() {
  initRefundDepositModule().catch((err) =>
    console.error("initRefundDepositModule failed:", err)
  );
}

if (document.readyState === "loading")
  document.addEventListener("DOMContentLoaded", boot);
else boot();
