// 📁 role-actions.js – Full Permission-Driven Action Handlers for Roles
// ============================================================================
// 🧭 Master Pattern: vital-actions.js
// 🔹 Action routing via data-action (DYNAMIC, enterprise-safe)
// 🔹 Superadmin bypass + normalized permissions
// 🔹 Unified lifecycle (view, edit, toggle-status, delete)
// 🔹 All DOM IDs preserved exactly
// ============================================================================

import {
  showToast,
  showConfirm,
  openViewModal,
  showLoading,
  hideLoading,
} from "../../utils/index.js";
import { authFetch } from "../../authSession.js";
import { renderCard } from "./role-render.js";

export function setupActionHandlers({
  entries,
  token,
  currentPage,
  loadEntries,
  visibleFields,
  sharedState,
  user, // { role, permissions, roleNames }
}) {
  const tableBody = document.getElementById("roleTableBody");
  const cardContainer = document.getElementById("roleList");

  // cache last entries
  window.latestRoleEntries = entries;

  if (tableBody) tableBody.addEventListener("click", handleActions);
  if (cardContainer) cardContainer.addEventListener("click", handleActions);

  /* ===================== PERMISSIONS ===================== */
  function normalizePermissions(perms) {
    if (!perms) return [];
    if (typeof perms === "string") {
      try {
        return JSON.parse(perms);
      } catch {
        return perms.split(",").map((p) => p.trim());
      }
    }
    return Array.isArray(perms) ? perms : [];
  }

  const userPerms = new Set(
    normalizePermissions(user?.permissions || []).map((p) =>
      String(p).toLowerCase().trim()
    )
  );

  const isSuperAdmin =
    (user?.role && user.role.toLowerCase().replace(/\s+/g, "") === "superadmin") ||
    (Array.isArray(user?.roleNames) &&
      user.roleNames.some(
        (r) => r.toLowerCase().replace(/\s+/g, "") === "superadmin"
      ));

  const hasPerm = (key) =>
    isSuperAdmin || userPerms.has(key.toLowerCase().trim());

  /* ===================== DISPATCHER ===================== */
  async function handleActions(e) {
    const btn = e.target.closest("[data-action]");
    if (!btn) return;

    const { id, action } = btn.dataset;
    if (!id || !action) return;

    let entry =
      (window.latestRoleEntries || entries || []).find(
        (x) => String(x.id) === String(id)
      ) || null;

    // fallback fetch
    if (!entry) {
      try {
        showLoading();
        const res = await authFetch(`/api/roles/${id}`);
        const json = await res.json().catch(() => ({}));
        entry = json?.data || null;
      } catch {
        showToast("❌ Role not found");
        return;
      } finally {
        hideLoading();
      }
    }

    if (!entry) return showToast("❌ Role data missing");

    /* ===================== ACTION ROUTES ===================== */

    // VIEW
    if (action === "view") {
      if (!hasPerm("roles:view"))
        return showToast("⛔ You don't have permission to view roles");
      return handleView(entry);
    }

    // EDIT
    if (action === "edit") {
      if (!hasPerm("roles:edit"))
        return showToast("⛔ You don't have permission to edit roles");
      return handleEdit(entry);
    }

    // TOGGLE STATUS
    if (action === "toggle-status") {
      if (!hasPerm("roles:update"))
        return showToast("⛔ You don't have permission to toggle roles");
      return await handleToggleStatus(id, entry);
    }


    // DELETE
    if (action === "delete") {
      if (!hasPerm("roles:delete"))
        return showToast("⛔ You don't have permission to delete roles");
      return await handleDelete(id, entry);
    }

    // Unknown action → safely ignore
  }

  /* ===================== HANDLERS ===================== */

  function handleView(entry) {
    const html = renderCard(entry, visibleFields, user);
    openViewModal("Role Info", html);
  }

  function handleEdit(entry) {
    if (sharedState?.currentEditIdRef)
      sharedState.currentEditIdRef.value = entry.id;

    sessionStorage.setItem("roleEditId", entry.id);
    sessionStorage.setItem("roleEditPayload", JSON.stringify(entry));
    window.location.href = "add-role.html";
  }

  async function handleToggleStatus(id, entry) {
    const isActive =
      entry.is_active === true ||
      (entry.status || "").toLowerCase() === "active";

    const confirmed = await showConfirm(
      isActive
        ? `Deactivate role "${entry.name}"?`
        : `Activate role "${entry.name}"?`
    );
    if (!confirmed) return;

    try {
      showLoading();
      const res = await authFetch(`/api/roles/${id}/toggle-status`, {
        method: "PATCH",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok)
        throw new Error(data.message || "❌ Failed to toggle role status");

      const newStatus =
        (data?.data?.status ||
          (isActive ? "inactive" : "active")).toLowerCase();

      showToast(
        newStatus === "active"
          ? `✅ Role "${entry.name}" activated`
          : `✅ Role "${entry.name}" deactivated`
      );

      window.latestRoleEntries = [];
      await loadEntries(currentPage);
    } catch (err) {
      console.error(err);
      showToast(err.message || "❌ Failed to update role status");
    } finally {
      hideLoading();
    }
  }

  async function handleDelete(id, entry) {
    const confirmed = await showConfirm(`Delete role "${entry.name}"?`);
    if (!confirmed) return;

    try {
      showLoading();
      const res = await authFetch(`/api/roles/${id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok)
        throw new Error(data.message || "❌ Failed to delete role");

      showToast(`✅ Role "${entry.name}" deleted`);
      window.latestRoleEntries = [];
      await loadEntries(currentPage);
    } catch (err) {
      console.error(err);
      showToast(err.message || "❌ Failed to delete role");
    } finally {
      hideLoading();
    }
  }

  /* ===================== GLOBAL HELPERS ===================== */

  const findEntry = (id) =>
    (window.latestRoleEntries || entries || []).find(
      (x) => String(x.id) === String(id)
    );

  window.viewEntry = (id) => {
    if (!hasPerm("roles:view"))
      return showToast("⛔ No permission to view roles");
    const entry = findEntry(id);
    if (entry) handleView(entry);
  };

  window.editEntry = (id) => {
    if (!hasPerm("roles:edit"))
      return showToast("⛔ No permission to edit roles");
    const entry = findEntry(id);
    if (entry) handleEdit(entry);
  };

  window.toggleStatusEntry = async (id) => {
    if (!hasPerm("roles:update"))
      return showToast("⛔ No permission to toggle roles");
    const entry = findEntry(id);
    if (entry) await handleToggleStatus(id, entry);
  };

  window.deleteEntry = async (id) => {
    if (!hasPerm("roles:delete"))
      return showToast("⛔ No permission to delete roles");
    const entry = findEntry(id);
    if (entry) await handleDelete(id, entry);
  };
}
