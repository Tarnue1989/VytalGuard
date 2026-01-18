// 📁 master-item-category-actions.js – Enterprise Master Parity (FINAL / LOCKED)
// ============================================================================
// 🧭 Parity Source: department-actions.js (Gold Standard)
// 🔹 Permission-driven (superadmin-aware)
// 🔹 Unified lifecycle: view / edit / toggle-status / delete
// 🔹 Consistent UX: toasts, confirms, redirects, loading overlays
// 🔹 100% DOM ID + route retention
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

/**
 * Unified permission-aware action handler for Master Item Category module
 */
export function setupActionHandlers({
  entries,
  token,
  currentPage,
  loadEntries,
  visibleFields,
  sharedState,
  user, // { role, permissions, roleNames }
}) {
  const { currentEditIdRef } = sharedState || {};
  const tableBody = document.getElementById("masterItemCategoryTableBody");
  const cardContainer = document.getElementById("masterItemCategoryList");

  // 🗂️ Cache latest entries
  window.latestMasterItemCategoryEntries = entries;

  if (tableBody) tableBody.addEventListener("click", handleActions);
  if (cardContainer) cardContainer.addEventListener("click", handleActions);

  /* ============================================================
     🔑 Normalize Permissions (MASTER PARITY)
  ============================================================ */
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

  // 🧠 Superadmin bypass
  const isSuperAdmin =
    (user?.role &&
      user.role.toLowerCase().replace(/\s+/g, "") === "superadmin") ||
    (Array.isArray(user?.roleNames) &&
      user.roleNames.some(
        (r) => r.toLowerCase().replace(/\s+/g, "") === "superadmin"
      ));

  // ✅ Permission checker (MASTER)
  const hasPerm = (key) =>
    isSuperAdmin || userPerms.has(String(key).toLowerCase().trim());

  /* ============================================================
     🎯 Main Dispatcher
  ============================================================ */
  async function handleActions(e) {
    const btn = e.target.closest("button");
    if (!btn || !btn.dataset.id) return;

    const id = btn.dataset.id;
    let entry =
      (window.latestMasterItemCategoryEntries || entries || []).find(
        (x) => String(x.id) === String(id)
      ) || null;

    // 🩹 Fallback fetch
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

    if (cls.contains("view-btn")) {
      if (!hasPerm("master_item_categories:view"))
        return showToast("⛔ You don't have permission to view categories");
      return handleView(entry);
    }

    if (cls.contains("edit-btn")) {
      if (!hasPerm("master_item_categories:edit"))
        return showToast("⛔ You don't have permission to edit categories");
      return handleEdit(entry);
    }

    if (cls.contains("toggle-status-btn")) {
      if (!hasPerm("master_item_categories:toggle-status"))
        return showToast("⛔ You don't have permission to change status");
      return await handleToggleStatus(id, entry);
    }

    if (cls.contains("delete-btn")) {
      if (!hasPerm("master_item_categories:delete"))
        return showToast("⛔ You don't have permission to delete categories");
      return await handleDelete(id, entry);
    }
  }

  /* ============================================================
     ⚙️ Action Handlers
  ============================================================ */

  // 🔍 View
  function handleView(entry) {
    const html = renderCard(entry, visibleFields, user);
    openViewModal("Category Info", html);
  }

  // ✏️ Edit
  function handleEdit(entry) {
    if (currentEditIdRef) currentEditIdRef.value = entry.id;
    sessionStorage.setItem("masterItemCategoryEditId", entry.id);
    sessionStorage.setItem(
      "masterItemCategoryEditPayload",
      JSON.stringify(entry)
    );
    window.location.href = "add-master-item-category.html";
  }

  // 🔄 Toggle Status
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
      const res = await authFetch(
        `/api/master-item-categories/${id}/toggle-status`,
        { method: "PATCH" }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok)
        throw new Error(data.message || "❌ Failed to toggle category status");

      const newStatus =
        (data?.data?.status ||
          (isActive ? "inactive" : "active")).toLowerCase();

      showToast(
        newStatus === "active"
          ? `✅ Category "${entry.name}" activated`
          : `✅ Category "${entry.name}" deactivated`
      );

      window.latestMasterItemCategoryEntries = [];
      await loadEntries(currentPage);
    } catch (err) {
      console.error(err);
      showToast(err.message || "❌ Failed to update category status");
    } finally {
      hideLoading();
    }
  }

  // 🗑️ Delete
  async function handleDelete(id, entry) {
    const confirmed = await showConfirm(
      `Delete category "${entry.name}" permanently?`
    );
    if (!confirmed) return;

    try {
      showLoading();
      const res = await authFetch(`/api/master-item-categories/${id}`, {
        method: "DELETE",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok)
        throw new Error(data.message || "❌ Failed to delete category");

      showToast(`✅ Category "${entry.name}" deleted successfully`);
      window.latestMasterItemCategoryEntries = [];
      await loadEntries(currentPage);
    } catch (err) {
      console.error(err);
      showToast(err.message || "❌ Failed to delete category");
    } finally {
      hideLoading();
    }
  }

  /* ============================================================
     🌍 Global Helpers (Inline Triggers)
  ============================================================ */
  const findEntry = (id) =>
    (window.latestMasterItemCategoryEntries || entries || []).find(
      (x) => String(x.id) === String(id)
    );

  window.viewCategory = (id) => {
    if (!hasPerm("master_item_categories:view"))
      return showToast("⛔ No permission to view categories");
    const entry = findEntry(id);
    if (entry) handleView(entry);
  };

  window.editCategory = (id) => {
    if (!hasPerm("master_item_categories:edit"))
      return showToast("⛔ No permission to edit categories");
    const entry = findEntry(id);
    if (entry) handleEdit(entry);
  };

  window.toggleCategoryStatus = async (id) => {
    if (!hasPerm("master_item_categories:toggle-status"))
      return showToast("⛔ No permission to toggle categories");
    const entry = findEntry(id);
    await handleToggleStatus(id, entry);
  };

  window.deleteCategory = async (id) => {
    if (!hasPerm("master_item_categories:delete"))
      return showToast("⛔ No permission to delete categories");
    const entry = findEntry(id);
    await handleDelete(id, entry);
  };
}
