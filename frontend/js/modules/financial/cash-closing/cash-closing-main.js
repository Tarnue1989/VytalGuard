// 📦 cash-closing-main.js – Filters + Table/Card + Close Day

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

import {
  renderCashClosingList,
  renderCashClosingTableHead,
} from "./cash-closing-render.js";

import { setupCashClosingActionHandlers } from "./cash-closing-actions.js";

import {
  FIELD_ORDER_CASH_CLOSING,
  FIELD_DEFAULTS_CASH_CLOSING,
} from "./cash-closing-constants.js";

import { setupVisibleFields } from "../../../utils/field-visibility.js";
import { authFetch } from "../../../authSession.js";

/* ============================================================ */
/* 🔐 Auth */
const token = initPageGuard("cash_closing");
initLogoutWatcher();

/* ============================================================ */
/* 📌 Role */
const roleRaw = localStorage.getItem("userRole") || "";
const userRole = roleRaw.trim().toLowerCase();

/* ============================================================ */
/* 📋 State */
window.entries = [];

let visibleFields = setupVisibleFields({
  moduleKey: "cash_closing",
  userRole,
  defaultFields: FIELD_DEFAULTS_CASH_CLOSING,
  allowedFields: FIELD_ORDER_CASH_CLOSING,
});

/* ============================================================ */
/* 🧩 Field selector */
renderFieldSelector(
  {},
  visibleFields,
  (newFields) => {
    visibleFields = newFields;
    renderCashClosingTableHead(visibleFields);
    renderCashClosingList({ entries, visibleFields, viewMode, userRole, currentPage });
  },
  FIELD_ORDER_CASH_CLOSING
);

/* ============================================================ */
/* 🔎 Filters */
const filterOrg = document.getElementById("filterOrganizationSelect");
const filterFacility = document.getElementById("filterFacilitySelect");
const filterAccount = document.getElementById("filterAccount");
const filterDate = document.getElementById("filterDate");

/* ============================================================ */
/* 🌐 View + Paging */
let currentPage = 1;
let totalPages = 1;
let viewMode = localStorage.getItem("cashClosingView") || "table";

/* ============================================================ */
/* 📋 Build filters */
function getFilters() {
  return {
    organization_id: filterOrg?.value || "",
    facility_id: filterFacility?.value || "",
    account_id: filterAccount?.value || "",
    date: filterDate?.value || "",
  };
}

/* ============================================================ */
/* 📦 Load Records */
async function loadEntries(page = 1) {
  try {
    const filters = getFilters();
    const q = new URLSearchParams();

    Object.entries(filters).forEach(([k, v]) => {
      if (!v) return;
      q.append(k, v);
    });

    const res = await fetch(`/api/cash-closing?page=${page}&limit=10&${q}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    const result = await res.json().catch(() => ({}));
    const payload = result?.data || {};

    const records = Array.isArray(payload.records) ? payload.records : [];

    window.entries = records;
    currentPage = Number(payload.pagination?.page) || 1;
    totalPages = Number(payload.pagination?.pageCount) || 1;

    renderCashClosingList({ entries, visibleFields, viewMode, userRole, currentPage });

    setupCashClosingActionHandlers({
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
      showToast("ℹ️ No closing records found");
    }
  } catch (err) {
    console.error(err);
    showToast("❌ Failed to load cash closing");
  }
}

/* ============================================================ */
/* 🔁 CLOSE DAY (IMPORTANT) */
document.getElementById("closeDayBtn")?.addEventListener("click", async () => {
  try {
    const account_id = filterAccount?.value;
    const date = filterDate?.value;

    if (!account_id || !date) {
      return showToast("❌ Account and Date required");
    }

    showLoading();

    const res = await authFetch("/api/cash-closing/close", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ account_id, date }),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) throw new Error(data.message || "❌ Failed to close day");

    showToast("✅ Cash closing completed");

    await loadEntries(1);
  } catch (err) {
    console.error(err);
    showToast(err.message || "❌ Close day failed");
  } finally {
    hideLoading();
  }
});

/* ============================================================ */
/* 🧭 View toggle */
document.getElementById("tableViewBtn").onclick = () => {
  viewMode = "table";
  localStorage.setItem("cashClosingView", "table");
  renderCashClosingList({ entries, visibleFields, viewMode, userRole, currentPage });
};

document.getElementById("cardViewBtn").onclick = () => {
  viewMode = "card";
  localStorage.setItem("cashClosingView", "card");
  renderCashClosingList({ entries, visibleFields, viewMode, userRole, currentPage });
};

/* ============================================================ */
/* 🔎 Filters */
document.getElementById("filterBtn").onclick = async () => {
  showLoading();
  await loadEntries(1);
  hideLoading();
};

document.getElementById("resetFilterBtn").onclick = () => {
  ["filterAccount", "filterDate"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });

  loadEntries(1);
};

/* ============================================================ */
/* ⬇️ Export */
document.getElementById("exportCSVBtn")?.onclick = () => {
  exportToExcel(entries, "cash_closing.xlsx");
};

document.getElementById("exportPDFBtn")?.onclick = () => {
  exportToPDF("Cash Closing", ".cash-closing-table-container");
};

/* ============================================================ */
/* 🚀 INIT */
export async function initCashClosingModule() {
  if (window.__cashClosingInit) return;
  window.__cashClosingInit = true;

  renderCashClosingTableHead(visibleFields);

  setupToggleSection(
    "toggleFilterBtn",
    "filterCollapse",
    "filterChevron",
    "cashClosingFilterVisible"
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
  initCashClosingModule().catch(console.error);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot);
} else {
  boot();
}