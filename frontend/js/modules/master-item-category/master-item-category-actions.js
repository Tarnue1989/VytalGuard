// 📁 master-item-category-actions.js – Full Permission-Driven Action Handlers (Upgraded)
// ============================================================================
// 🧭 Master Pattern: role-actions.js / vital-actions.js
// 🔹 Enterprise-aligned permission scheme (master_item_categories:view, edit...)
// 🔹 Includes Superadmin bypass + unified permission normalization
// 🔹 Consistent UX: toasts, confirms, redirects, loading overlays
// 🔹 100% ID retention for HTML + linked JS modules
// ============================================================================

import {
  showToast,
  showConfirm,
  openViewModal,
  showLoading,
  hideLoading,
} from "../../utils/index.js";
import { authFetch } from "../../authSession.js";
import { renderCard } from "./master-item-category-render.js";

export function setupActionHandlers({
  entries,
  token,
  currentPage,
  loadEntries,
  visibleFields,
  sharedState,
  user, // { role, permissions, roleNames }
}) {
  const tableBody = document.getElementById("masterItemCategoryTableBody");
  const cardContainer = document.getElementById("masterItemCategoryList");

  // Cache current entries
  window.latestMasterItemCategoryEntries = entries;

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
      (window.latestMasterItemCategoryEntries || entries || []).find(
        (x) => String(x.id) === String(id)
      ) || null;

    // 🔄 Fallback: fetch full record if not cached
    if (!entry) {
      try {
        showLoading();
        const res = await authFetch(`/api/master-item-categories/${id}`);
        const data = await res.json().catch(() => ({}));
        entry = data?.data;
      } catch {
        return showToast("❌ Category not found");
      } finally {
        hideLoading();
      }
    }

    if (!entry) return showToast("❌ Category data missing");

    const cls = btn.classList;

    // --- View ---
    if (cls.contains("view-btn")) {
      if (!hasPerm("master_item_categories:view"))
        return showToast("⛔ You don't have permission to view categories");
      return handleView(entry);
    }

    // --- Edit ---
    if (cls.contains("edit-btn")) {
      if (!hasPerm("master_item_categories:edit"))
        return showToast("⛔ You don't have permission to edit categories");
      return handleEdit(entry);
    }

    // --- Toggle Status ---
    if (cls.contains("toggle-status-btn")) {
      if (!hasPerm("master_item_categories:toggle"))
        return showToast("⛔ You don't have permission to toggle category status");
      return await handleToggleStatus(id, entry);
    }

    // --- Delete ---
    if (cls.contains("delete-btn")) {
      if (!hasPerm("master_item_categories:delete"))
        return showToast("⛔ You don't have permission to delete categories");
      return await handleDelete(id, entry);
    }
  }

  /* ---------------------- Handlers ---------------------- */

  function handleView(entry) {
    const html = renderCard(entry, visibleFields, user);
    openViewModal("Category Info", html);
  }

  function handleEdit(entry) {
    if (sharedState?.currentEditIdRef)
      sharedState.currentEditIdRef.value = entry.id;

    sessionStorage.setItem("masterItemCategoryEditId", entry.id);
    sessionStorage.setItem(
      "masterItemCategoryEditPayload",
      JSON.stringify(entry)
    );
    window.location.href = `add-master-item-category.html`;
  }

  async function handleToggleStatus(id, entry) {
    const isActive = (entry.status || "").toLowerCase() === "active";
    const confirmed = await showConfirm(
      isActive
        ? `Deactivate category "${entry.name}"?`
        : `Activate category "${entry.name}"?`
    );
    if (!confirmed) return;

    try {
      showLoading();
      const res = await authFetch(`/api/master-item-categories/${id}/toggle-status`, {
        method: "PATCH",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok)
        throw new Error(data.message || "❌ Failed to toggle category status");

      const newStatus =
        data?.data?.status || (isActive ? "inactive" : "active");
      const categoryName = entry?.name || data?.data?.name || "Category";

      if (newStatus.toLowerCase() === "active") {
        showToast(`✅ Category "${categoryName}" has been activated`);
      } else if (newStatus.toLowerCase() === "inactive") {
        showToast(`✅ Category "${categoryName}" has been deactivated`);
      } else {
        showToast(
          `✅ Category "${categoryName}" status updated to ${newStatus}`
        );
      }

      window.latestMasterItemCategoryEntries = [];
      await loadEntries(currentPage);
    } catch (err) {
      console.error(err);
      showToast(err.message || "❌ Failed to update category status");
    } finally {
      hideLoading();
    }
  }

  async function handleDelete(id, entry) {
    const confirmed = await showConfirm(`Delete category "${entry.name}"?`);
    if (!confirmed) return;

    try {
      showLoading();
      const res = await authFetch(`/api/master-item-categories/${id}`, {
        method: "DELETE",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok)
        throw new Error(data.message || "❌ Failed to delete category");

      const categoryName = entry?.name || data?.data?.name || "Category";
      showToast(`✅ Category "${categoryName}" deleted successfully`);

      window.latestMasterItemCategoryEntries = [];
      await loadEntries(currentPage);
    } catch (err) {
      console.error(err);
      showToast(err.message || "❌ Failed to delete category");
    } finally {
      hideLoading();
    }
  }

  /* ---------------------- Global Helpers ---------------------- */
  const findEntry = (id) =>
    (window.latestMasterItemCategoryEntries || entries || []).find(
      (x) => String(x.id) === String(id)
    );

  window.viewEntry = (id) => {
    if (!hasPerm("master_item_categories:view"))
      return showToast("⛔ No permission to view categories");
    const entry = findEntry(id);
    if (entry) handleView(entry);
    else showToast("❌ Category not found for viewing");
  };

  window.editEntry = (id) => {
    if (!hasPerm("master_item_categories:edit"))
      return showToast("⛔ No permission to edit categories");
    const entry = findEntry(id);
    if (entry) handleEdit(entry);
    else showToast("❌ Category not found for editing");
  };

  window.toggleStatusEntry = async (id) => {
    if (!hasPerm("master_item_categories:toggle"))
      return showToast("⛔ No permission to toggle category status");
    const entry = findEntry(id);
    await handleToggleStatus(id, entry);
  };

  window.deleteEntry = async (id) => {
    if (!hasPerm("master_item_categories:delete"))
      return showToast("⛔ No permission to delete categories");
    const entry = findEntry(id);
    await handleDelete(id, entry);
  };
}
