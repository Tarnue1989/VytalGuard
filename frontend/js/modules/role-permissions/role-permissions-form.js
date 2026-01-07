// 📦 permission-form.js – Pill-based Role Permission Form (secure + role-aware + module-aware)

import {
  showToast,
  showLoading,
  hideLoading,
  initPageGuard,
  autoPagePermissionKey,
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

/* ============================================================
   🔧 Helpers
============================================================ */
function getQueryParam(key) {
  return new URLSearchParams(window.location.search).get(key);
}

function normalizeMessage(result, fallback) {
  if (!result) return fallback;
  const msg = result.message ?? result.error ?? result.msg;
  if (typeof msg === "string") return msg;
  if (msg?.detail) return msg.detail;
  try {
    return JSON.stringify(msg);
  } catch {
    return fallback;
  }
}

/* ============================================================
   🧠 Pill State
============================================================ */
let selectedPermissions = [];
let pillsContainer = null;
let allPermissionsCache = [];

function renderPermissionPills(isEdit = false) {
  if (!pillsContainer) return;
  pillsContainer.innerHTML = "";

  if (!selectedPermissions.length) {
    pillsContainer.innerHTML = `<p class="text-muted">No permissions added yet.</p>`;
  } else {
    selectedPermissions.forEach((item, idx) => {
      const pill = document.createElement("div");
      pill.className = "pill";
      pill.innerHTML = `
        ${item.permissionName || "—"}
        <button
          type="button"
          class="btn btn-sm btn-link text-danger pill-remove"
          data-idx="${idx}"
          title="Remove"
        >
          <i class="ri-close-line"></i>
        </button>
      `;
      pillsContainer.appendChild(pill);
    });

    pillsContainer.querySelectorAll(".pill-remove").forEach((btn) => {
      btn.addEventListener("click", () => {
        const idx = parseInt(btn.dataset.idx, 10);
        selectedPermissions.splice(idx, 1);
        renderPermissionPills(isEdit);
      });
    });
  }

  const submitBtn = document.querySelector("button[type=submit]");
  if (submitBtn) {
    if (isEdit) {
      submitBtn.innerHTML = `<i class="ri-save-3-line me-1"></i> Update Permissions`;
    } else {
      submitBtn.innerHTML =
        selectedPermissions.length > 1
          ? `<i class="ri-save-3-line me-1"></i> Submit All`
          : `<i class="ri-add-line me-1"></i> Submit`;
    }
  }
}

export function getPermissionFormState() {
  return { selectedPermissions, renderPermissionPills };
}

/* ============================================================
   🚀 Form Initialization
============================================================ */
export async function setupPermissionFormSubmission({ form }) {
  // 🔐 Auth
  const token = initPageGuard(autoPagePermissionKey());
  initLogoutWatcher();

  let requestId = getQueryParam("id");
  let isEdit = !!requestId;

  if (!isEdit) {
    const sessionId = sessionStorage.getItem("rolePermissionEditId");
    if (sessionId) {
      requestId = sessionId;
      isEdit = true;
    }
  }

  const titleEl = document.querySelector(".card-title");
  const submitBtn = form?.querySelector("button[type=submit]");
  titleEl && (titleEl.textContent = isEdit ? "Edit Role Permission" : "Add Role Permission");
  submitBtn &&
    (submitBtn.innerHTML = isEdit
      ? `<i class="ri-save-3-line me-1"></i> Update Permissions`
      : `<i class="ri-add-line me-1"></i> Submit All`);

  /* ------------------------- DOM Refs ------------------------- */
  const orgSelect = document.getElementById("organizationSelect");
  const facSelect = document.getElementById("facilitySelect");
  const roleSelect = document.getElementById("roleSelect");

  const moduleSelect = document.getElementById("permissionModuleSelect");
  const addAllModuleBtn = document.getElementById("addAllModulePermissionsBtn");

  // ⭐ NEW: Full Access button (ALL modules)
  const addAllPermissionsBtn = document.getElementById("addAllPermissionsBtn");

  const permInput = document.getElementById("permissionSearch");
  const permSuggestions = document.getElementById("permissionSearchSuggestions");
  pillsContainer = document.getElementById("permissionPillsContainer");

  /* ------------------------- Load Orgs / Facs / Roles ------------------------- */
  let reloadFacilities = null;

  try {
    const userRole = (localStorage.getItem("userRole") || "").toLowerCase();

    if (userRole.includes("super")) {
      const orgs = await loadOrganizationsLite();
      setupSelectOptions(orgSelect, orgs, "id", "name", "-- Select Organization --");

      reloadFacilities = async (orgId = null) => {
        const facs = await loadFacilitiesLite(
          orgId ? { organization_id: orgId } : {},
          true
        );
        setupSelectOptions(facSelect, facs, "id", "name", "-- Select Facility --");
      };

      await reloadFacilities();
      orgSelect?.addEventListener("change", async () => {
        await reloadFacilities(orgSelect.value || null);
      });
    } else {
      orgSelect?.closest(".form-group")?.classList.add("hidden");
      const facs = await loadFacilitiesLite({}, true);
      setupSelectOptions(facSelect, facs, "id", "name", "-- Select Facility --");
    }

    const roles = await loadRolesLite({}, true);
    setupSelectOptions(roleSelect, roles, "id", "name", "-- Select Role --");
  } catch (err) {
    console.error("❌ Dropdown preload failed:", err);
    showToast("❌ Failed to load reference lists");
  }

  /* ------------------------- Load Permissions → Modules ------------------------- */
  try {
    allPermissionsCache = await loadPermissionsLite({}, true);

    const modules = [
      ...new Set(allPermissionsCache.map((p) => p.module).filter(Boolean)),
    ];

    if (moduleSelect) {
      setupSelectOptions(
        moduleSelect,
        modules.map((m) => ({ id: m, name: m })),
        "id",
        "name",
        "-- Select Module --"
      );
    }
  } catch (err) {
    console.error("❌ Permission preload failed:", err);
    showToast("❌ Failed to load permissions");
  }

  /* ------------------------- Permission Search (MODULE AWARE) ------------------------- */
  setupSuggestionInputDynamic(
    permInput,
    permSuggestions,
    "/api/lite/permissions",
    (selected) => {
      if (!selected) return;

      const id = selected.id;
      const name = selected.key || selected.name || "(Unknown)";

      const exists = selectedPermissions.some(
        (p) =>
          p.permission_id === id ||
          p.permissionName.toLowerCase() === name.toLowerCase()
      );

      if (exists) {
        showToast("⚠️ This permission is already added");
        permInput.value = "";
        return;
      }

      selectedPermissions.push({ permission_id: id, permissionName: name });
      renderPermissionPills(isEdit);
      permInput.value = "";
    },
    "key",
    {
      extraParams: () => {
        const module = moduleSelect?.value;
        return module ? { module } : {};
      },
    }
  );

  /* ------------------------- Add ALL permissions in selected module ------------------------- */
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
        .forEach((p) => {
          if (!selectedPermissions.some((sp) => sp.permission_id === p.id)) {
            selectedPermissions.push({
              permission_id: p.id,
              permissionName: p.key || p.name,
            });
          }
        });

      renderPermissionPills(isEdit);
    });
  }

  /* ============================================================
     ⭐ Grant FULL Access (ALL modules, SuperAdmin only)
  ============================================================ */
  const userRole = (localStorage.getItem("userRole") || "").toLowerCase();
  if (addAllPermissionsBtn) {
    if (!userRole.includes("super")) {
      addAllPermissionsBtn.classList.add("hidden");
    } else {
      addAllPermissionsBtn.addEventListener("click", () => {
        if (!allPermissionsCache.length) return;

        selectedPermissions = allPermissionsCache.map((p) => ({
          permission_id: p.id,
          permissionName: p.key || p.name,
        }));

        renderPermissionPills(isEdit);
        showToast("✅ Full access granted (all modules)");
      });
    }
  }

  /* ------------------------- Prefill if Editing ------------------------- */
  if (isEdit && requestId) {
    try {
      showLoading();
      const res = await authFetch(`/api/role-permissions/${requestId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const result = await res.json().catch(() => ({}));
      hideLoading();

      let entry = result.record || result.data || null;
      if (entry?.record) entry = entry.record;
      if (!entry) return showToast("⚠️ No record found");

      await new Promise((r) => setTimeout(r, 200));

      const orgId = entry.organization_id || entry.organization?.id || null;
      const facId = entry.facility_id || entry.facility?.id || null;
      const roleId = entry.role_id || entry.role?.id || null;

      if (orgId && orgSelect) {
        orgSelect.value = orgId;
        if (reloadFacilities) await reloadFacilities(orgId);
      }
      if (facId && facSelect) facSelect.value = facId;
      if (roleId && roleSelect) roleSelect.value = roleId;

      selectedPermissions = [];

      if (entry.permission) {
        selectedPermissions.push({
          permission_id: entry.permission.id,
          permissionName: entry.permission.key || entry.permission.name,
        });
      } else if (Array.isArray(entry.permissions)) {
        entry.permissions.forEach((p) =>
          selectedPermissions.push({
            permission_id: p.id || p.permission_id,
            permissionName: p.key || p.name,
          })
        );
      }

      renderPermissionPills(true);
    } catch (err) {
      hideLoading();
      console.error("❌ Prefill error:", err);
      showToast("❌ Could not load permission entry");
    }
  } else {
    renderPermissionPills(false);
  }

  /* ------------------------- Submit ------------------------- */
  form.onsubmit = async (e) => {
    e.preventDefault();
    try {
      showLoading();

      const payload = {
        organization_id: orgSelect?.value || undefined,
        facility_id: facSelect?.value || undefined,
        role_id: roleSelect?.value || null,
        permission_ids: selectedPermissions.map((p) => p.permission_id),
      };

      if (!payload.role_id)
        return showToast("❌ Role is required"), hideLoading();
      if (!payload.permission_ids.length)
        return showToast("❌ Please add at least one permission"), hideLoading();

      let url = "/api/role-permissions";
      let method = "POST";
      if (isEdit) {
        url = `/api/role-permissions/by-role/${payload.role_id}`;
        method = "PUT";
      }

      const res = await authFetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const result = await res.json().catch(() => ({}));
      if (!res.ok)
        throw new Error(normalizeMessage(result, `❌ Server error (${res.status})`));

      showToast(
        isEdit
          ? "✅ Permissions updated successfully"
          : "✅ Permissions assigned successfully"
      );

      sessionStorage.removeItem("rolePermissionEditId");
      sessionStorage.removeItem("rolePermissionEditPayload");

      if (isEdit) {
        window.location.href = "/role-permissions-list.html";
        return;
      }

      selectedPermissions = [];
      renderPermissionPills(false);
      form.reset();
    } catch (err) {
      console.error("❌ [Submit Error]", err);
      showToast(err.message || "❌ Submission error");
    } finally {
      hideLoading();
    }
  };

  /* ------------------------- Cancel / Clear ------------------------- */
  document.getElementById("cancelBtn")?.addEventListener("click", () => {
    sessionStorage.removeItem("rolePermissionEditId");
    sessionStorage.removeItem("rolePermissionEditPayload");
    window.location.href = "/role-permissions-list.html";
  });

  document.getElementById("clearBtn")?.addEventListener("click", () => {
    form.reset();
    selectedPermissions = [];
    renderPermissionPills(false);
  });
}
