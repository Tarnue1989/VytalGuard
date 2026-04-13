// 📦 accounts-main.js – Filters + Table/Card (Enterprise Pattern)

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
  setupSelectOptions,
} from "../../../utils/data-loaders.js";

import { renderFieldSelector } from "../../../utils/ui-utils.js";
import { exportToExcel, exportToPDF } from "../../../utils/export-utils.js";

import { renderAccountList, renderAccountTableHead } from "./accounts-render.js";
import { setupAccountActionHandlers } from "./accounts-actions.js";

import {
  FIELD_ORDER_ACCOUNT,
  FIELD_DEFAULTS_ACCOUNT,
} from "./accounts-constants.js";

import { setupVisibleFields } from "../../../utils/field-visibility.js";

/* ============================================================ */
/* 🔐 Auth */
const token = initPageGuard("accounts");
initLogoutWatcher();

/* ============================================================ */
/* 📌 Role */
const roleRaw = localStorage.getItem("userRole") || "";
const userRole = roleRaw.trim().toLowerCase();

/* ============================================================ */
/* 📋 Field Visibility */
window.entries = [];

let visibleFields = setupVisibleFields({
  moduleKey: "account",
  userRole,
  defaultFields: FIELD_DEFAULTS_ACCOUNT,
  allowedFields: FIELD_ORDER_ACCOUNT,
});

/* ============================================================ */
/* 🧩 Field Selector */
renderFieldSelector(
  {},
  visibleFields,
  (newFields) => {
    visibleFields = newFields;
    renderAccountTableHead(visibleFields);
    renderAccountList({ entries, visibleFields, viewMode, userRole, currentPage });
  },
  FIELD_ORDER_ACCOUNT
);

/* ============================================================ */
/* 🔎 Filters */
const filterOrg = document.getElementById("filterOrganizationSelect");
const filterFacility = document.getElementById("filterFacilitySelect");
const filterType = document.getElementById("filterType");
const filterActive = document.getElementById("filterActive");
const filterSearch = document.getElementById("filterSearch");

/* ============================================================ */
/* 🌐 View + Pagination */
let currentPage = 1;
let totalPages = 1;
let viewMode = localStorage.getItem("accountView") || "table";

/* ============================================================ */
/* 📋 Build Filters */
function getFilters() {
  return {
    organization_id: filterOrg?.value || "",
    facility_id: filterFacility?.value || "",
    type: filterType?.value || "",
    is_active: filterActive?.value || "",
    q: filterSearch?.value || "",
  };
}

/* ============================================================ */
/* 📦 Load Accounts */
async function loadEntries(page = 1) {
  try {
    const filters = getFilters();
    const q = new URLSearchParams();

    Object.entries(filters).forEach(([k, v]) => {
      if (!v) return;
      q.append(k, v);
    });

    const safeFields = visibleFields.filter((f) =>
      FIELD_ORDER_ACCOUNT.includes(f)
    );
    if (safeFields.length) {
      q.append("fields", safeFields.join(","));
    }

    const res = await fetch(`/api/accounts?page=${page}&limit=10&${q}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    const result = await res.json().catch(() => ({}));
    const payload = result?.data || {};

    const records = Array.isArray(payload.records) ? payload.records : [];

    window.entries = records;
    currentPage = Number(payload.pagination?.page) || 1;
    totalPages = Number(payload.pagination?.pageCount) || 1;

    renderAccountList({ entries, visibleFields, viewMode, userRole, currentPage });

    setupAccountActionHandlers({
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
      showToast("ℹ️ No accounts found");
    }
  } catch (err) {
    console.error("❌ loadEntries failed:", err);
    showToast("❌ Failed to load accounts");
  }
}

/* ============================================================ */
/* 🧭 View Toggle */
document.getElementById("tableViewBtn").onclick = () => {
  viewMode = "table";
  localStorage.setItem("accountView", "table");
  renderAccountList({ entries, visibleFields, viewMode, userRole, currentPage });
};

document.getElementById("cardViewBtn").onclick = () => {
  viewMode = "card";
  localStorage.setItem("accountView", "card");
  renderAccountList({ entries, visibleFields, viewMode, userRole, currentPage });
};

/* ============================================================ */
/* 🔎 Filter Actions */
document.getElementById("filterBtn").onclick = async () => {
  try {
    showLoading();
    await loadEntries(1);
  } finally {
    hideLoading();
  }
};

document.getElementById("resetFilterBtn").onclick = () => {
  ["filterType", "filterActive", "filterSearch"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });

  loadEntries(1);
};

/* ============================================================ */
/* ⬇️ Export */
document.getElementById("exportCSVBtn")?.addEventListener("click", () => {
  exportToExcel(
    entries,
    `accounts_${new Date().toISOString().slice(0, 10)}.xlsx`
  );
});

document.getElementById("exportPDFBtn")?.addEventListener("click", () => {
  const target =
    viewMode === "table" ? ".account-table-container" : "#accountList";
  exportToPDF("Accounts List", target, "portrait", true);
});

/* ============================================================ */
/* 🚀 INIT */
export async function initAccountModule() {
  if (window.__accountInit) return;
  window.__accountInit = true;

  renderAccountTableHead(visibleFields);

  setupToggleSection(
    "toggleFilterBtn",
    "filterCollapse",
    "filterChevron",
    "accountFilterVisible"
  );

  try {
    const orgs = await loadOrganizationsLite();

    if (userRole.includes("super")) {
      orgs.unshift({ id: "", name: "-- All Organizations --" });
      setupSelectOptions(filterOrg, orgs, "id", "name");

      let facilities = await loadFacilitiesLite();
      facilities.unshift({ id: "", name: "-- All Facilities --" });
      setupSelectOptions(filterFacility, facilities, "id", "name");
    }
  } catch (err) {
    console.error("❌ preload failed:", err);
  }

  await loadEntries(1);
}

/* ============================================================ */
/* 🔄 Boot */
function boot() {
  initAccountModule().catch(console.error);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot);
} else {
  boot();
}