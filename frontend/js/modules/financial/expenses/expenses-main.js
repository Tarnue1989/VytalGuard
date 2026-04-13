// 📦 expenses-main.js – Filters + Table/Card

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

import { renderExpenseList, renderExpenseTableHead } from "./expenses-render.js";
import { setupExpenseActionHandlers } from "./expenses-actions.js";

import {
  FIELD_ORDER_EXPENSE,
  FIELD_DEFAULTS_EXPENSE,
} from "./expenses-constants.js";

import { setupVisibleFields } from "../../../utils/field-visibility.js";

/* ============================================================ */
/* 🔐 Auth */
const token = initPageGuard("expenses");
initLogoutWatcher();

/* ============================================================ */
/* 📌 Role */
const roleRaw = localStorage.getItem("userRole") || "";
const userRole = roleRaw.trim().toLowerCase();

/* ============================================================ */
/* 📋 State */
window.entries = [];

let visibleFields = setupVisibleFields({
  moduleKey: "expense",
  userRole,
  defaultFields: FIELD_DEFAULTS_EXPENSE,
  allowedFields: FIELD_ORDER_EXPENSE,
});

/* ============================================================ */
/* 🧩 Field selector */
renderFieldSelector(
  {},
  visibleFields,
  (newFields) => {
    visibleFields = newFields;
    renderExpenseTableHead(visibleFields);
    renderExpenseList({ entries, visibleFields, viewMode, userRole, currentPage });
  },
  FIELD_ORDER_EXPENSE
);

/* ============================================================ */
/* 🔎 Filters */
const filterOrg = document.getElementById("filterOrganizationSelect");
const filterFacility = document.getElementById("filterFacilitySelect");
const filterAccount = document.getElementById("filterAccount");
const filterCategory = document.getElementById("filterCategory");
const filterDate = document.getElementById("filterDate");
const filterSearch = document.getElementById("filterSearch");

/* ============================================================ */
/* 🌐 View + Paging */
let currentPage = 1;
let totalPages = 1;
let viewMode = localStorage.getItem("expenseView") || "table";

/* ============================================================ */
/* 📋 Build filters */
function getFilters() {
  return {
    organization_id: filterOrg?.value || "",
    facility_id: filterFacility?.value || "",
    account_id: filterAccount?.value || "",
    category: filterCategory?.value || "",
    date: filterDate?.value || "",
    q: filterSearch?.value || "",
  };
}

/* ============================================================ */
/* 📦 Load Expenses */
async function loadEntries(page = 1) {
  try {
    const filters = getFilters();
    const q = new URLSearchParams();

    Object.entries(filters).forEach(([k, v]) => {
      if (!v) return;
      q.append(k, v);
    });

    const safeFields = visibleFields.filter((f) =>
      FIELD_ORDER_EXPENSE.includes(f)
    );
    if (safeFields.length) {
      q.append("fields", safeFields.join(","));
    }

    const res = await fetch(`/api/expenses?page=${page}&limit=10&${q}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    const result = await res.json().catch(() => ({}));
    const payload = result?.data || {};

    const records = Array.isArray(payload.records) ? payload.records : [];

    window.entries = records;
    currentPage = Number(payload.pagination?.page) || 1;
    totalPages = Number(payload.pagination?.pageCount) || 1;

    renderExpenseList({ entries, visibleFields, viewMode, userRole, currentPage });

    setupExpenseActionHandlers({
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
      showToast("ℹ️ No expenses found");
    }
  } catch (err) {
    console.error(err);
    showToast("❌ Failed to load expenses");
  }
}

/* ============================================================ */
/* 🧭 View toggle */
document.getElementById("tableViewBtn").onclick = () => {
  viewMode = "table";
  localStorage.setItem("expenseView", "table");
  renderExpenseList({ entries, visibleFields, viewMode, userRole, currentPage });
};

document.getElementById("cardViewBtn").onclick = () => {
  viewMode = "card";
  localStorage.setItem("expenseView", "card");
  renderExpenseList({ entries, visibleFields, viewMode, userRole, currentPage });
};

/* ============================================================ */
/* 🔎 Filters */
document.getElementById("filterBtn").onclick = async () => {
  showLoading();
  await loadEntries(1);
  hideLoading();
};

document.getElementById("resetFilterBtn").onclick = () => {
  ["filterAccount", "filterCategory", "filterDate", "filterSearch"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });

  loadEntries(1);
};

/* ============================================================ */
/* ⬇️ Export */
document.getElementById("exportCSVBtn")?.onclick = () => {
  exportToExcel(entries, "expenses.xlsx");
};

document.getElementById("exportPDFBtn")?.onclick = () => {
  exportToPDF("Expenses", ".expense-table-container");
};

/* ============================================================ */
/* 🚀 INIT */
export async function initExpenseModule() {
  if (window.__expenseInit) return;
  window.__expenseInit = true;

  renderExpenseTableHead(visibleFields);

  setupToggleSection(
    "toggleFilterBtn",
    "filterCollapse",
    "filterChevron",
    "expenseFilterVisible"
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
  initExpenseModule().catch(console.error);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot);
} else {
  boot();
}