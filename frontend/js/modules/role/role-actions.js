// 📁 role-actions.js – Full Permission-Driven Action Handlers for Roles
// ============================================================================
// 🧭 Master Pattern: vital-actions.js
// 🔹 Follows enterprise-aligned permission scheme (roles:view, roles:edit...)
// 🔹 Includes Superadmin bypass, normalized permissions
// 🔹 Unified lifecycle (toggle-status, delete) + consistent UX/UI behavior
// 🔹 All DOM IDs preserved exactly as in your HTML
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

  /* ---------------------- Normalize Permissions ---------------------- */
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

  const userPerms = new Set(normalizePermissions(user?.permissions || []));

  // ✅ Superadmin bypass
  const isSuperAdmin =
    (user?.role && user.role.toLowerCase().replace(/\s+/g, "") === "superadmin") ||
    (Array.isArray(user?.roleNames) &&
      user.roleNames.some(
        (r) => r.toLowerCase().replace(/\s+/g, "") === "superadmin"
      ));

  // ✅ Unified permission checker
  const hasPerm = (key) => {
    const normalizedKey = key.trim().toLowerCase();
    return isSuperAdmin || userPerms.has(normalizedKey);
  };

  /* ---------------------- Handler Dispatcher ---------------------- */
  async function handleActions(e) {
    const btn = e.target.closest("button");
    if (!btn || !btn.dataset.id) return;

    const id = btn.dataset.id;
    let entry =
      (window.latestRoleEntries || entries || []).find(
        (x) => String(x.id) === String(id)
      ) || null;

    // fallback: fetch full record if not cached
    if (!entry) {
      try {
        showLoading();
        const res = await authFetch(`/api/roles/${id}`);
        const data = await res.json().catch(() => ({}));
        entry = data?.data;
      } catch {
        return showToast("❌ Role not found");
      } finally {
        hideLoading();
      }
    }

    if (!entry) return showToast("❌ Role data missing");

    const cls = btn.classList;

    // --- View ---
    if (cls.contains("view-btn")) {
      if (!hasPerm("roles:view"))
        return showToast("⛔ You don't have permission to view roles");
      return handleView(entry);
    }

    // --- Edit ---
    if (cls.contains("edit-btn")) {
      if (!hasPerm("roles:edit"))
        return showToast("⛔ You don't have permission to edit roles");
      return handleEdit(entry);
    }

    // --- Toggle Status (Activate/Deactivate) ---
    if (cls.contains("toggle-status-btn")) {
      if (!hasPerm("roles:toggle"))
        return showToast("⛔ You don't have permission to toggle roles");
      return await handleToggleStatus(id, entry);
    }

    // --- Delete ---
    if (cls.contains("delete-btn")) {
      if (!hasPerm("roles:delete"))
        return showToast("⛔ You don't have permission to delete roles");
      return await handleDelete(id, entry);
    }
  }

  /* ---------------------- Handlers ---------------------- */

  function handleView(entry) {
    const html = renderCard(entry, visibleFields, user);
    openViewModal("Role Info", html);
  }

  function handleEdit(entry) {
    if (sharedState?.currentEditIdRef)
      sharedState.currentEditIdRef.value = entry.id;

    sessionStorage.setItem("roleEditId", entry.id);
    sessionStorage.setItem("roleEditPayload", JSON.stringify(entry));
    window.location.href = `add-role.html`;
  }

  async function handleToggleStatus(id, entry) {
    const isActive = (entry.status || "").toLowerCase() === "active";
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

      const newStatus = (
        data?.data?.status || (isActive ? "inactive" : "active")
      ).toLowerCase();
      const roleName = entry?.name || data?.data?.name || "Role";

      if (newStatus === "active") {
        showToast(`✅ Role "${roleName}" has been activated`);
      } else if (newStatus === "inactive") {
        showToast(`✅ Role "${roleName}" has been deactivated`);
      } else {
        showToast(`✅ Role "${roleName}" status updated to ${newStatus}`);
      }

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
      if (!res.ok) throw new Error(data.message || "❌ Failed to delete role");

      showToast(`✅ Role "${entry.name}" deleted successfully`);
      window.latestRoleEntries = [];
      await loadEntries(currentPage);
    } catch (err) {
      console.error(err);
      showToast(err.message || "❌ Failed to delete role");
    } finally {
      hideLoading();
    }
  }

  /* ---------------------- Global Helpers ---------------------- */

  const findEntry = (id) =>
    (window.latestRoleEntries || entries || []).find(
      (x) => String(x.id) === String(id)
    );

  window.viewEntry = (id) => {
    if (!hasPerm("roles:view"))
      return showToast("⛔ No permission to view roles");
    const entry = findEntry(id);
    if (entry) handleView(entry);
    else showToast("❌ Role not found for viewing");
  };

  window.editEntry = (id) => {
    if (!hasPerm("roles:edit"))
      return showToast("⛔ No permission to edit roles");
    const entry = findEntry(id);
    if (entry) handleEdit(entry);
    else showToast("❌ Role not found for editing");
  };

  window.toggleStatusEntry = async (id) => {
    if (!hasPerm("roles:toggle"))
      return showToast("⛔ No permission to toggle roles");
    const entry = findEntry(id);
    await handleToggleStatus(id, entry);
  };

  window.deleteEntry = async (id) => {
    if (!hasPerm("roles:delete"))
      return showToast("⛔ No permission to delete roles");
    const entry = findEntry(id);
    await handleDelete(id, entry);
  };
}
