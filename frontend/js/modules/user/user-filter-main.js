// 📦 user-filter-main.js – Filters + Table/Card (Enterprise-Aligned, No Form)
// ============================================================================
// 🧭 Master Pattern: role-filter-main.js
// 🔹 Permissions, pagination, field selector, exports, toggle sections
// 🔹 All HTML IDs preserved exactly
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
import { fetchGenericList } from "../../utils/data-loaders.js";
import { renderFieldSelector } from "../../utils/ui-utils.js";
import { exportToExcel, exportToPDF } from "../../utils/export-utils.js";

import { renderList, renderDynamicTableHead } from "./user-render.js";
import { setupActionHandlers } from "./user-actions.js";

import {
  FIELD_ORDER_USER,
  FIELD_DEFAULTS_USER,
} from "./user-constants.js";

import { setupVisibleFields } from "../../utils/field-visibility.js";
import { initPaginationControl } from "../../utils/pagination-control.js";

/* ============================================================
   🔐 Auth Guard
============================================================ */
const token = initPageGuard(autoPagePermissionKey());
initLogoutWatcher();

/* ============================================================
   🌐 User Role + Permissions
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
  moduleKey: "user",
  userRole,
  defaultFields: FIELD_DEFAULTS_USER,
  allowedFields: FIELD_ORDER_USER,
});

// ❌ exclude virtual fields from API (?fields=)
const API_FIELD_WHITELIST = [
  "id",
  "username",
  "email",
  "first_name",
  "last_name",
  "status",
  "last_login_at",
  "locked_until",
  "organization_id",
  "created_at",
  "updated_at",
  "deleted_at",
  "created_by_id",
  "updated_by_id",
  "deleted_by_id",
];

renderFieldSelector(
  {},
  visibleFields,
  (newFields) => {
    visibleFields = newFields;
    renderDynamicTableHead(visibleFields);
    renderList({ entries, visibleFields, viewMode, user, currentPage });
  },
  FIELD_ORDER_USER
);

/* ============================================================
   🔎 Filter DOM Refs
============================================================ */
const filterUsername = document.getElementById("filterUsername");
const filterEmail = document.getElementById("filterEmail");
const filterStatus = document.getElementById("filterStatus");
const filterCreatedFrom = document.getElementById("filterCreatedFrom");
const filterCreatedTo = document.getElementById("filterCreatedTo");
const filterLockedFrom = document.getElementById("filterLockedFrom");
const filterLockedTo = document.getElementById("filterLockedTo");
const filterLastLoginFrom = document.getElementById("filterLastLoginFrom");
const filterLastLoginTo = document.getElementById("filterLastLoginTo");
const filterOrg = document.getElementById("filterOrganization");
const filterFacility = document.getElementById("filterFacility");
const filterRole = document.getElementById("filterRole");

const exportCSVBtn = document.getElementById("exportCSVBtn");
const exportPDFBtn = document.getElementById("exportPDFBtn");

/* ============================================================
   🌍 View + Paging
============================================================ */
let currentPage = 1;
let totalPages = 1;
let viewMode = localStorage.getItem("userView") || "table";

// org map for render
window.orgMap = {};

/* ============================================================
   📋 Build Filter Object
============================================================ */
function getFilters() {
  return {
    username: filterUsername?.value || "",
    email: filterEmail?.value || "",
    status: filterStatus?.value || "",
    created_from: filterCreatedFrom?.value || "",
    created_to: filterCreatedTo?.value || "",
    locked_from: filterLockedFrom?.value || "",
    locked_to: filterLockedTo?.value || "",
    last_login_from: filterLastLoginFrom?.value || "",
    last_login_to: filterLastLoginTo?.value || "",
    organization_id: filterOrg?.value || "",
    facility_id: filterFacility?.value || "",
    role_id: filterRole?.value || "",
  };
}

/* ============================================================
   🔁 Pagination Control
============================================================ */
const getPagination = initPaginationControl("user", loadEntries, 10);

/* ============================================================
   📦 Load Users
============================================================ */
async function loadEntries(page = 1) {
  try {
    showLoading();

    const filters = getFilters();
    const q = new URLSearchParams();
    const { page: safePage, limit: safeLimit } = getPagination(page);

    q.append("page", safePage);
    q.append("limit", safeLimit);

    if (filters.created_from) q.append("created_at[gte]", filters.created_from);
    if (filters.created_to) q.append("created_at[lte]", filters.created_to);

    Object.entries(filters).forEach(([k, v]) => {
      if (!v || ["created_from", "created_to"].includes(k)) return;
      q.append(k, v);
    });

    const safeFields = visibleFields.filter((f) =>
      API_FIELD_WHITELIST.includes(f)
    );
    if (safeFields.length) q.append("fields", safeFields.join(","));

    const res = await authFetch(`/api/users?${q.toString()}`);
    const json = await res.json().catch(() => ({}));

    const payload = json?.data || {};
    const records = Array.isArray(payload.records) ? payload.records : [];

    window.entries = records;
    currentPage = Number(payload.pagination?.page) || safePage;
    totalPages = Number(payload.pagination?.pageCount) || 1;

    renderList({ entries, visibleFields, viewMode, user, currentPage });

    setupActionHandlers({
      entries,
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

    if (!records.length) showToast("ℹ️ No users found for current filters");
  } catch (err) {
    console.error("❌ loadEntries failed:", err);
    showToast("❌ Failed to load users");
  } finally {
    hideLoading();
  }
}

/* ============================================================
   🧭 View Toggle
============================================================ */
document.getElementById("tableViewBtn").onclick = () => {
  viewMode = "table";
  localStorage.setItem("userView", "table");
  renderList({ entries, visibleFields, viewMode, user, currentPage });
};

document.getElementById("cardViewBtn").onclick = () => {
  viewMode = "card";
  localStorage.setItem("userView", "card");
  renderList({ entries, visibleFields, viewMode, user, currentPage });
};

/* ============================================================
   🔍 Filter Actions
============================================================ */
document.getElementById("filterBtn").onclick = async () => await loadEntries(1);

document.getElementById("resetFilterBtn").onclick = () => {
  [
    filterUsername,
    filterEmail,
    filterStatus,
    filterCreatedFrom,
    filterCreatedTo,
    filterLockedFrom,
    filterLockedTo,
    filterLastLoginFrom,
    filterLastLoginTo,
    filterOrg,
    filterFacility,
    filterRole,
  ].forEach((el) => {
    if (el) el.value = "";
  });
  loadEntries(1);
};

/* ============================================================
   ⬇️ Export
============================================================ */
if (exportCSVBtn)
  exportCSVBtn.onclick = () =>
    exportToExcel(entries, `users_${new Date().toISOString().slice(0, 10)}.xlsx`);

if (exportPDFBtn)
  exportPDFBtn.onclick = () => {
    const target = viewMode === "table" ? ".table-container" : "#userList";
    exportToPDF("User List", target, "portrait", true);
  };

/* ============================================================
   🚀 Init Module
============================================================ */
export async function initUserModule() {
  renderDynamicTableHead(visibleFields);

  const filterCollapse = document.getElementById("filterCollapse");
  const filterChevron = document.getElementById("filterChevron");
  const filterVisible = localStorage.getItem("userFilterVisible") === "true";

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
    "userFilterVisible"
  );

  await fetchGenericList("/api/users/lite/all");
  await loadEntries(1);
}

/* ============================================================
   🏁 Boot
============================================================ */
function boot() {
  initUserModule().catch((err) => console.error("initUserModule failed:", err));
}
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
else boot();
