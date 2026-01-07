// 📁 add-role-permissions.js – Add/Edit Role Permission (Module + Suggestion + Pills)

import {
  setupPermissionFormSubmission,
  getPermissionFormState,
} from "./role-permissions-form.js";

import {
  showToast,
  showLoading,
  hideLoading,
  initPageGuard,
  initLogoutWatcher,
} from "../../utils/index.js";

import { authFetch } from "../../authSession.js";

import {
  loadOrganizationsLite,
  loadFacilitiesLite,
  loadRolesLite,
  loadPermissionsLite,
  setupSelectOptions,
  setupSuggestionInputDynamic,
} from "../../utils/data-loaders.js";

// 🔐 Auth Guard
const token = initPageGuard("role_permissions");
initLogoutWatcher();

const sharedState = {
  currentEditIdRef: { value: null },
};

/* ============================================================
   🧹 Reset Form Helper (Back to Add Mode)
============================================================ */
function resetForm() {
  const form = document.getElementById("rolePermissionForm");
  if (!form) return;

  form.reset();
  sharedState.currentEditIdRef.value = null;

  const permissionInput = document.getElementById("permissionSearch");
  const permissionHidden = document.getElementById("permission_id");
  const pillsContainer = document.getElementById("permissionPillsContainer");

  if (permissionInput) permissionInput.value = "";
  if (permissionHidden) permissionHidden.value = "";
  if (pillsContainer)
    pillsContainer.innerHTML = `<p class="text-muted">No permissions added yet.</p>`;

  ["organizationSelect", "facilitySelect", "roleSelect", "permissionModuleSelect"].forEach(
    (id) => {
      const el = document.getElementById(id);
      if (el) el.value = "";
    }
  );

  const titleEl = document.querySelector(".card-title");
  if (titleEl) titleEl.textContent = "Add Role Permission";

  const submitBtn = form.querySelector("button[type=submit]");
  if (submitBtn)
    submitBtn.innerHTML = `<i class="ri-add-line me-1"></i> Submit Permissions`;
}

/* ============================================================
   🚀 Main Init
============================================================ */
document.addEventListener("DOMContentLoaded", async () => {
  const form = document.getElementById("rolePermissionForm");
  if (!form) return;

  const orgSelect = document.getElementById("organizationSelect");
  const facSelect = document.getElementById("facilitySelect");
  const roleSelect = document.getElementById("roleSelect");
  const moduleSelect = document.getElementById("permissionModuleSelect");

  const permissionInput = document.getElementById("permissionSearch");
  const permissionSuggestions = document.getElementById("permissionSearchSuggestions");
  const addAllModuleBtn = document.getElementById("addAllModulePermissionsBtn");

  // ⭐ NEW: Grant FULL Access button
  const addAllPermissionsBtn = document.getElementById("addAllPermissionsBtn");

  const userRole = (localStorage.getItem("userRole") || "").toLowerCase();

  const { selectedPermissions, renderPermissionPills, addPermissionPill } =
    getPermissionFormState();

  let allPermissionsCache = [];

  /* ============================================================
     🔽 Load Organizations / Facilities / Roles
  ============================================================ */
  try {
    if (userRole.includes("super")) {
      const orgs = await loadOrganizationsLite();
      setupSelectOptions(orgSelect, orgs, "id", "name", "-- Select Organization --");

      orgSelect?.addEventListener("change", async () => {
        const facs = await loadFacilitiesLite(
          orgSelect.value ? { organization_id: orgSelect.value } : {},
          true
        );
        setupSelectOptions(facSelect, facs, "id", "name", "-- Select Facility --");
      });

      const facs = await loadFacilitiesLite({}, true);
      setupSelectOptions(facSelect, facs, "id", "name", "-- Select Facility --");
    } else if (userRole.includes("admin")) {
      orgSelect?.closest(".form-group")?.classList.add("hidden");
      const facs = await loadFacilitiesLite({}, true);
      setupSelectOptions(facSelect, facs, "id", "name", "-- Select Facility --");
    } else {
      orgSelect?.closest(".form-group")?.classList.add("hidden");
      facSelect?.closest(".form-group")?.classList.add("hidden");
    }

    const roles = await loadRolesLite({}, true);
    setupSelectOptions(roleSelect, roles, "id", "name", "-- Select Role --");
  } catch (err) {
    console.error("❌ Org/Facility/Role preload failed:", err);
    showToast("❌ Failed to load dropdowns");
  }

  /* ============================================================
     🔽 Load Permissions → Modules
  ============================================================ */
  try {
    allPermissionsCache = await loadPermissionsLite({}, true);

    const modules = [
      ...new Set(allPermissionsCache.map((p) => p.module).filter(Boolean)),
    ];

    setupSelectOptions(
      moduleSelect,
      modules.map((m) => ({ id: m, name: m })),
      "id",
      "name",
      "-- Select Module --"
    );
  } catch (err) {
    console.error("❌ Permission preload failed:", err);
    showToast("❌ Failed to load permission modules");
  }

  /* ============================================================
     🔎 Permission Search (MODULE-AWARE)
  ============================================================ */
  setupSuggestionInputDynamic(
    permissionInput,
    permissionSuggestions,
    "/api/lite/permissions",
    (permission) => {
      if (!permission) return;
      addPermissionPill({
        permission_id: permission.id,
        permissionName: permission.key || permission.name,
      });
    },
    "key",
    {
      extraParams: () => {
        const module = moduleSelect?.value;
        return module ? { module } : {};
      },
    }
  );

  /* ============================================================
     ➕ Add ALL Permissions in Selected Module
  ============================================================ */
  if (addAllModuleBtn && moduleSelect) {
    addAllModuleBtn.disabled = true;

    moduleSelect.addEventListener("change", () => {
      addAllModuleBtn.disabled = !moduleSelect.value;
    });

    addAllModuleBtn.addEventListener("click", () => {
      const module = moduleSelect.value;
      if (!module) return;

      allPermissionsCache
        .filter((p) => p.module === module)
        .forEach((p) =>
          addPermissionPill({
            permission_id: p.id,
            permissionName: p.key || p.name,
          })
        );
    });
  }

  /* ============================================================
     ⭐ Grant FULL Access (ALL modules, SuperAdmin only)
  ============================================================ */
  if (addAllPermissionsBtn) {
    if (!userRole.includes("super")) {
      addAllPermissionsBtn.classList.add("hidden");
    } else {
      addAllPermissionsBtn.addEventListener("click", () => {
        selectedPermissions.length = 0;

        allPermissionsCache.forEach((p) =>
          selectedPermissions.push({
            permission_id: p.id,
            permissionName: p.key || p.name,
          })
        );

        renderPermissionPills();
        showToast("✅ Full access granted (all modules)");
      });
    }
  }

  /* ============================================================
     🧾 Form submission
  ============================================================ */
  setupPermissionFormSubmission({
    form,
    token,
    sharedState,
    resetForm,
    loadEntries: null,
  });

  /* ============================================================
     ✏️ Edit Mode (unchanged)
  ============================================================ */
  const editId =
    sessionStorage.getItem("rolePermissionEditId") ||
    new URLSearchParams(window.location.search).get("id");

  const rawPayload = sessionStorage.getItem("rolePermissionEditPayload");

  async function applyPrefill(entry) {
    if (entry.organization_id) orgSelect.value = entry.organization_id;
    if (entry.facility_id) facSelect.value = entry.facility_id;
    if (entry.role_id) roleSelect.value = entry.role_id;

    selectedPermissions.length = 0;

    if (Array.isArray(entry.permissions)) {
      entry.permissions.forEach((p) =>
        selectedPermissions.push({
          permission_id: p.id || p.permission_id,
          permissionName: p.key || p.name,
        })
      );
    } else if (entry.permission) {
      selectedPermissions.push({
        permission_id: entry.permission.id,
        permissionName: entry.permission.key || entry.permission.name,
      });
    }

    renderPermissionPills();
  }

  if (editId) {
    try {
      const entry = rawPayload
        ? JSON.parse(rawPayload)
        : (await (await authFetch(`/api/role-permissions/${editId}`)).json())
            ?.data;

      if (entry) {
        sharedState.currentEditIdRef.value = editId;
        await applyPrefill(entry);
      }
    } catch (err) {
      console.error("❌ Edit load failed:", err);
      showToast("❌ Failed to load role permission for editing");
    }
  }

  /* ============================================================
     🚪 Cancel / Clear
  ============================================================ */
  document.getElementById("cancelBtn")?.addEventListener("click", () => {
    sessionStorage.clear();
    window.location.href = "/role-permissions-list.html";
  });

  document.getElementById("clearBtn")?.addEventListener("click", resetForm);
});
