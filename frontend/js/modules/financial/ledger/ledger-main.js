// 📦 ledger-main.js – Filters + Table/Card (READ-ONLY)

import {
  showToast,
  showLoading,
  hideLoading,
  initPageGuard,
  setupToggleSection,
  renderPaginationControls,
  initLogoutWatcher,
} from "../../../utils/index.js";

import {
  loadOrganizationsLite,
  loadFacilitiesLite,
  loadAccountsLite,
  setupSelectOptions,
} from "../../../utils/data-loaders.js";

import { renderFieldSelector } from "../../../utils/ui-utils.js";
import { exportToExcel, exportToPDF } from "../../../utils/export-utils.js";

import { renderLedgerList, renderLedgerTableHead } from "./ledger-render.js";
import { setupLedgerActionHandlers } from "./ledger-actions.js";

import {
  FIELD_ORDER_LEDGER,
  FIELD_DEFAULTS_LEDGER,
} from "./ledger-constants.js";

import { setupVisibleFields } from "../../../utils/field-visibility.js";

/* ============================================================ */
/* 🔐 Auth */
const token = initPageGuard("ledger");
initLogoutWatcher();

/* ============================================================ */
/* 📌 Role */
const roleRaw = localStorage.getItem("userRole") || "";
const userRole = roleRaw.trim().toLowerCase();

/* ============================================================ */
/* 📋 State */
window.entries = [];

let visibleFields = setupVisibleFields({
  moduleKey: "ledger",
  userRole,
  defaultFields: FIELD_DEFAULTS_LEDGER,
  allowedFields: FIELD_ORDER_LEDGER,
});

/* ============================================================ */
/* 🧩 Field selector */
renderFieldSelector(
  {},
  visibleFields,
  (newFields) => {
    visibleFields = newFields;
    renderLedgerTableHead(visibleFields);
    renderLedgerList({ entries, visibleFields, viewMode, userRole, currentPage });
  },
  FIELD_ORDER_LEDGER
);

/* ============================================================ */
/* 🔎 Filters */
const filterOrg = document.getElementById("filterOrganizationSelect");
const filterFacility = document.getElementById("filterFacilitySelect");
const filterAccount = document.getElementById("filterAccount");
const filterType = document.getElementById("filterType");
const filterStatus = document.getElementById("filterStatus");
const filterDate = document.getElementById("filterDate");
const filterSearch = document.getElementById("filterSearch");

/* ============================================================ */
/* 🌐 View + Paging */
let currentPage = 1;
let totalPages = 1;
let viewMode = localStorage.getItem("ledgerView") || "table";

/* ============================================================ */
/* 📋 Build filters */
function getFilters() {
  return {
    organization_id: filterOrg?.value || "",
    facility_id: filterFacility?.value || "",
    account_id: filterAccount?.value || "",
    transaction_type: filterType?.value || "",
    status: filterStatus?.value || "",
    date: filterDate?.value || "",
    q: filterSearch?.value || "",
  };
}

/* ============================================================ */
/* 📦 Load Ledger */
async function loadEntries(page = 1) {
  try {
    const filters = getFilters();
    const q = new URLSearchParams();

    Object.entries(filters).forEach(([k, v]) => {
      if (!v) return;
      q.append(k, v);
    });

    const safeFields = visibleFields.filter((f) =>
      FIELD_ORDER_LEDGER.includes(f)
    );
    if (safeFields.length) {
      q.append("fields", safeFields.join(","));
    }

    const res = await fetch(`/api/cash-ledger?page=${page}&limit=10&${q}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    const result = await res.json().catch(() => ({}));
    const payload = result?.data || {};

    const records = Array.isArray(payload.records) ? payload.records : [];

    window.entries = records;
    currentPage = Number(payload.pagination?.page) || 1;
    totalPages = Number(payload.pagination?.pageCount) || 1;

    renderLedgerList({ entries, visibleFields, viewMode, userRole, currentPage });

    setupLedgerActionHandlers({
      entries,
      currentPage,
      loadEntries,
    });

    renderPaginationControls(
      document.getElementById("paginationButtons"),
      currentPage,
      totalPages,
      loadEntries
    );

    if (!records.length) {
      showToast("ℹ️ No ledger records found");
    }
  } catch (err) {
    console.error(err);
    showToast("❌ Failed to load ledger");
  }
}

/* ============================================================ */
/* 🧭 View toggle */
document.getElementById("tableViewBtn").onclick = () => {
  viewMode = "table";
  localStorage.setItem("ledgerView", "table");
  renderLedgerList({ entries, visibleFields, viewMode, userRole, currentPage });
};

document.getElementById("cardViewBtn").onclick = () => {
  viewMode = "card";
  localStorage.setItem("ledgerView", "card");
  renderLedgerList({ entries, visibleFields, viewMode, userRole, currentPage });
};

/* ============================================================ */
/* 🔎 Filters */
document.getElementById("filterBtn").onclick = async () => {
  showLoading();
  await loadEntries(1);
  hideLoading();
};

document.getElementById("resetFilterBtn").onclick = () => {
  ["filterAccount", "filterType", "filterStatus", "filterDate", "filterSearch"]
    .forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.value = "";
    });

  loadEntries(1);
};

/* ============================================================ */
/* ⬇️ Export */
document.getElementById("exportCSVBtn")?.onclick = () => {
  exportToExcel(entries, "ledger.xlsx");
};

document.getElementById("exportPDFBtn")?.onclick = () => {
  exportToPDF("Ledger", ".ledger-table-container");
};

/* ============================================================ */
/* 🚀 INIT */
export async function initLedgerModule() {
  if (window.__ledgerInit) return;
  window.__ledgerInit = true;

  renderLedgerTableHead(visibleFields);

  setupToggleSection(
    "toggleFilterBtn",
    "filterCollapse",
    "filterChevron",
    "ledgerFilterVisible"
  );

  try {
    const orgs = await loadOrganizationsLite();
    const facilities = await loadFacilitiesLite();
    const accounts = await loadAccountsLite();

    setupSelectOptions(filterOrg, orgs, "id", "name");
    setupSelectOptions(filterFacility, facilities, "id", "name");
    setupSelectOptions(filterAccount, accounts, "id", "name");
  } catch (err) {
    console.error("❌ preload failed:", err);
  }

  await loadEntries(1);
}

/* ============================================================ */
/* 🚀 BOOT */
function boot() {
  initLedgerModule().catch(console.error);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot);
} else {
  boot();
}