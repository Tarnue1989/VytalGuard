// 📁 role-permissions-actions.js
import {
  showToast,
  showConfirm,
  openViewModal,
  showLoading,
  hideLoading,
} from "../../utils/index.js";
import { authFetch } from "../../authSession.js";
import { renderCard } from "./role-permissions-render.js";

/* ============================================================
   ⚙️ Unified RolePermission Action Handlers
   Fully permission-aware + backend aligned
============================================================ */
export function setupRolePermissionActionHandlers({
  entries,
  token,
  currentPage,
  loadEntries,
  visibleFields,
  sharedState,
  user, // { role, permissions }
}) {
  const tableBody = document.getElementById("rolePermissionTableBody");
  const cardContainer = document.getElementById("rolePermissionList");

  // Cache entries globally
  window.latestRolePermissionEntries = entries || [];

  // Attach event listeners
  if (tableBody) tableBody.addEventListener("click", handleActions);
  if (cardContainer) cardContainer.addEventListener("click", handleActions);

  /* ---------------------- Permission Normalization ---------------------- */
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

  const userPerms = normalizePermissions(user?.permissions || []);
  const hasPerm = (key) => userPerms.includes(key);
  const hasCreateOrEdit = () =>
    hasPerm("role_permissions:create") || hasPerm("role_permissions:edit");

  /* ---------------------- Core Action Dispatcher ---------------------- */
  async function handleActions(e) {
    const btn = e.target.closest("button");
    if (!btn || !btn.dataset.id) return;

    const id = btn.dataset.id;
    let entry =
      (window.latestRolePermissionEntries || []).find(
        (x) => String(x.id) === String(id)
      ) || null;

    // 🧭 Fallback: fetch fresh record if not cached
    if (!entry) {
      try {
        showLoading();
        const res = await authFetch(`/api/role-permissions/${id}`);
        const data = await res.json().catch(() => ({}));
        entry = data?.data?.record || data?.data;
      } catch (err) {
        console.error("❌ Fetch error:", err);
        return showToast("❌ Role permission not found");
      } finally {
        hideLoading();
      }
    }

    if (!entry) return showToast("❌ Role permission data missing");

    const cls = btn.classList;

    // --- Basic Actions ---
    if (cls.contains("view-btn")) return handleView(entry);
    if (cls.contains("edit-btn")) return handleEdit(entry);
    if (cls.contains("delete-btn")) return handleDelete(id);
  }

  /* ---------------------- Action Handlers ---------------------- */

  function handleView(entry) {
    const html = renderCard(entry, visibleFields, user);
    openViewModal("Role Permission Info", html);
  }

  function handleEdit(entry) {
    if (!hasCreateOrEdit()) {
      return showToast("⛔ You don't have permission to edit role permissions");
    }

    // 🧠 Store payload for edit-prefill
    sessionStorage.setItem("rolePermissionEditId", entry.id);
    sessionStorage.setItem("rolePermissionEditPayload", JSON.stringify(entry));

    // ✅ FIX: use plural file name (matches actual page)
    window.location.href = "add-role-permission.html";
  }

  async function handleDelete(id) {
    if (!hasPerm("role_permissions:delete")) {
      return showToast("⛔ You don't have permission to delete role permissions");
    }

    const confirmed = await showConfirm("🗑️ Delete this role permission?");
    if (!confirmed) return;

    try {
      showLoading();
      const res = await authFetch(`/api/role-permissions/${id}`, {
        method: "DELETE",
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        console.error("❌ Delete failed:", data);
        showToast(data.message || "❌ Failed to delete role permission");
        return;
      }

      showToast("✅ Role permission deleted successfully");
      window.latestRolePermissionEntries = [];
      await loadEntries(currentPage);
    } catch (err) {
      console.error("❌ Delete error:", err);
      showToast("❌ Failed to delete role permission");
    } finally {
      hideLoading();
    }
  }

  /* ---------------------- Global Shortcuts ---------------------- */
  const findEntry = (id) =>
    (window.latestRolePermissionEntries || []).find(
      (x) => String(x.id) === String(id)
    );

  window.viewRolePermission = (id) => {
    const entry = findEntry(id);
    if (entry) handleView(entry);
    else showToast("❌ Role permission not found for viewing");
  };

  window.editRolePermission = (id) => {
    if (!hasCreateOrEdit()) {
      return showToast("⛔ You don't have permission to edit role permissions");
    }
    const entry = findEntry(id);
    if (entry) handleEdit(entry);
    else showToast("❌ Role permission not found for editing");
  };

  window.deleteRolePermission = async (id) => {
    if (!hasPerm("role_permissions:delete")) {
      return showToast("⛔ You don't have permission to delete role permissions");
    }
    await handleDelete(id);
  };
}
