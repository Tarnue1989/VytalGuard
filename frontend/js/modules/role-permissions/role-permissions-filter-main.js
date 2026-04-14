// 📦 role-permissions-filter-main.js – Filters + Table/Card (Enterprise-Parity)

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
  loadRolesLite,
  loadPermissionsLite,
  setupSelectOptions,
} from "../../utils/data-loaders.js";

import { renderFieldSelector } from "../../utils/ui-utils.js";
import { exportToExcel, exportToPDF } from "../../utils/export-utils.js";

import { renderList, renderDynamicTableHead } from "./role-permissions-render.js";
import { setupRolePermissionActionHandlers } from "./role-permissions-actions.js";

import {
  FIELD_ORDER_ROLE_PERMISSION,
  FIELD_DEFAULTS_ROLE_PERMISSION,
} from "./role-permissions-constants.js";

import { setupVisibleFields } from "../../utils/field-visibility.js";
import { initPaginationControl } from "../../utils/pagination-control.js";

/* ============================================================
   🔐 Auth
============================================================ */
const token = initPageGuard(autoPagePermissionKey());
initLogoutWatcher();

/* ============================================================
   🌐 Role + Permissions
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

// ✅ Superadmin override
if (userRole.includes("super")) {
  user.permissions = [
    "role_permissions:view",
    "role_permissions:create",
    "role_permissions:edit",
    "role_permissions:delete",
  ];
}

/* ============================================================
   🧠 Shared State
============================================================ */
const sharedState = { currentEditIdRef: { value: null } };
window.showForm = () => {};
window.resetForm = () => {};

/* ============================================================
   🧩 Field Visibility
============================================================ */
window.entries = [];
let visibleFields = setupVisibleFields({
  moduleKey: "rolePermission",
  userRole,
  defaultFields: FIELD_DEFAULTS_ROLE_PERMISSION,
  allowedFields: FIELD_ORDER_ROLE_PERMISSION,
});

/* ============================================================
   🧩 Field Selector
============================================================ */
renderFieldSelector(
  {},
  visibleFields,
  (newFields) => {
    visibleFields = newFields;
    renderDynamicTableHead(visibleFields);
    renderList({ entries, visibleFields, viewMode, user, currentPage });
  },
  FIELD_ORDER_ROLE_PERMISSION
);

/* ============================================================
   🔎 Filter DOM Refs
============================================================ */
const filterOrg = document.getElementById("filterOrganizationSelect");
const filterFacility = document.getElementById("filterFacilitySelect");
const filterRole = document.getElementById("filterRoleSelect");
const filterPermission = document.getElementById("filterPermissionSelect");
const filterCreatedFrom = document.getElementById("filterCreatedFrom");
const filterCreatedTo = document.getElementById("filterCreatedTo");

/* ============================================================
   ⬇️ Export Buttons
============================================================ */
const exportCSVBtn = document.getElementById("exportCSVBtn");
const exportPDFBtn = document.getElementById("exportPDFBtn");

/* ============================================================
   🌍 View + Paging
============================================================ */
let currentPage = 1;
let totalPages = 1;
let viewMode = localStorage.getItem("rolePermissionView") || "table";

/* ============================================================
   🔁 Pagination Control (MATCHES ULTRASOUND / MATERNITY)
============================================================ */
const getPagination = initPaginationControl(
  "rolePermission",
  loadEntries,
  25
);

/* ============================================================
   📋 Build Filters
============================================================ */
function getFilters() {
  return {
    organization_id: filterOrg?.value || "",
    facility_id: filterFacility?.value || "",
    role_id: filterRole?.value || "",
    permission_id: filterPermission?.value || "",
    created_from: filterCreatedFrom?.value || "",
    created_to: filterCreatedTo?.value || "",
  };
}

/* ============================================================
   📦 Load Role Permissions
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
      if (!v || k === "created_from" || k === "created_to") return;
      q.append(k, v);
    });

    const safeFields = visibleFields.filter((f) =>
      FIELD_ORDER_ROLE_PERMISSION.includes(f)
    );
    if (safeFields.length) q.append("fields", safeFields.join(","));

    const res = await authFetch(`/api/role-permissions?${q.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    const result = await res.json().catch(() => ({}));
    const payload = result?.data || {};
    const records = Array.isArray(payload.records) ? payload.records : [];

    window.entries = records;
    currentPage = Number(payload.pagination?.page) || safePage;
    totalPages = Number(payload.pagination?.pageCount) || 1;

    renderList({ entries, visibleFields, viewMode, user, currentPage });

    setupRolePermissionActionHandlers({
      entries,
      token,
      currentPage,
      loadEntries,
      visibleFields,
      sharedState,
      user,
    });

    const paginationBox = document.getElementById("paginationButtons");

    // 🔥 CRITICAL FIX (ONLY THIS LINE NEEDED)
    paginationBox.innerHTML = "";

    renderPaginationControls(
      paginationBox,
      currentPage,
      totalPages,
      loadEntries
    );
  } catch (err) {
    console.error("❌ loadEntries failed:", err);
    showToast("❌ Failed to load role permissions");
  } finally {
    hideLoading();
  }
}

/* ============================================================
   🧭 View Toggle
============================================================ */
document.getElementById("tableViewBtn").onclick = () => {
  viewMode = "table";
  localStorage.setItem("rolePermissionView", "table");
  renderList({ entries, visibleFields, viewMode, user, currentPage });
};

document.getElementById("cardViewBtn").onclick = () => {
  viewMode = "card";
  localStorage.setItem("rolePermissionView", "card");
  renderList({ entries, visibleFields, viewMode, user, currentPage });
};

/* ============================================================
   🔎 Filter Actions
============================================================ */
document.getElementById("filterBtn").onclick = async () => {
  await loadEntries(1);
};

document.getElementById("resetFilterBtn").onclick = () => {
  [
    filterRole,
    filterPermission,
    filterCreatedFrom,
    filterCreatedTo,
  ].forEach((el) => el && (el.value = ""));

  if (filterOrg) filterOrg.value = "";
  if (filterFacility) filterFacility.value = "";

  loadEntries(1);
};

/* ============================================================
   ⬇️ Export
============================================================ */
if (exportCSVBtn)
  exportCSVBtn.onclick = () =>
    exportToExcel(
      entries,
      `role_permissions_${new Date().toISOString().slice(0, 10)}.xlsx`
    );

if (exportPDFBtn)
  exportPDFBtn.onclick = () => {
    const target =
      viewMode === "table" ? ".table-container" : "#rolePermissionList";
    exportToPDF("Role Permission List", target, "portrait", true);
  };

/* ============================================================
   🚀 Init
============================================================ */
export async function initRolePermissionModule() {
  renderDynamicTableHead(visibleFields);

  setupToggleSection(
    "toggleFilterBtn",
    "filterCollapse",
    "filterChevron",
    "rolePermissionFilterVisible"
  );

  try {
    const orgs = await loadOrganizationsLite();

    if (userRole.includes("super")) {
      orgs.unshift({ id: "", name: "-- All Organizations --" });
      setupSelectOptions(filterOrg, orgs, "id", "name");

      let facs = await loadFacilitiesLite();
      facs.unshift({ id: "", name: "-- All Facilities --" });
      setupSelectOptions(filterFacility, facs, "id", "name");

      filterOrg?.addEventListener("change", async () => {
        const id = filterOrg.value;
        let nextFacs = id
          ? await loadFacilitiesLite({ organization_id: id })
          : await loadFacilitiesLite();
        nextFacs.unshift({ id: "", name: "-- All Facilities --" });
        setupSelectOptions(filterFacility, nextFacs, "id", "name");
      });
    } else {
      const orgId = localStorage.getItem("organizationId");
      const facId = localStorage.getItem("facilityId");

      const scopedOrg = orgs.find((o) => o.id === orgId);
      setupSelectOptions(filterOrg, scopedOrg ? [scopedOrg] : [], "id", "name");
      filterOrg.disabled = true;
      filterOrg.value = orgId || "";

      const facs = orgId
        ? await loadFacilitiesLite({ organization_id: orgId })
        : [];
      setupSelectOptions(filterFacility, facs, "id", "name", "-- All Facilities --");
      if (facId) filterFacility.value = facId;
    }

    const roles = await loadRolesLite({}, true);
    roles.unshift({ id: "", name: "-- All Roles --" });
    setupSelectOptions(filterRole, roles, "id", "name");

    const permissions = await loadPermissionsLite({}, true);
    permissions.unshift({ id: "", key: "-- All Permissions --" });
    setupSelectOptions(filterPermission, permissions, "id", "key");
  } catch (err) {
    console.error("❌ preload filters failed:", err);
    showToast("⚠️ Could not load filters");
  }

  await loadEntries(1);
}

/* ============================================================
   🏁 Boot
============================================================ */
function boot() {
  initRolePermissionModule().catch((err) =>
    console.error("initRolePermissionModule failed:", err)
  );
}

if (document.readyState === "loading")
  document.addEventListener("DOMContentLoaded", boot);
else boot();
