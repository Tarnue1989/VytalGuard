// 📁 master-item-category-actions.js – Enterprise MASTER (ROLE PATTERN)
// ============================================================================
// 🔥 FIXED:
// ✔ data-action based routing (NO classList)
// ✔ strict permission enforcement (no UI leaks)
// ✔ correct toggle_status permission
// ✔ fully aligned with role-actions.js
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
  user,
}) {
  const { currentEditIdRef } = sharedState || {};
  const tableBody = document.getElementById("masterItemCategoryTableBody");
  const cardContainer = document.getElementById("masterItemCategoryList");

  window.latestMasterItemCategoryEntries = entries;

  if (tableBody) tableBody.addEventListener("click", handleActions);
  if (cardContainer) cardContainer.addEventListener("click", handleActions);

  /* ============================================================
     🔑 PERMISSIONS
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

  const isSuperAdmin =
    (user?.role &&
      user.role.toLowerCase().replace(/\s+/g, "") === "superadmin") ||
    (Array.isArray(user?.roleNames) &&
      user.roleNames.some(
        (r) => r.toLowerCase().replace(/\s+/g, "") === "superadmin"
      ));

  const hasPerm = (key) =>
    isSuperAdmin || userPerms.has(String(key).toLowerCase().trim());

  /* ============================================================
     🎯 DISPATCHER (ROLE PATTERN)
  ============================================================ */
  async function handleActions(e) {
    const btn = e.target.closest("[data-action]");
    if (!btn) return;

    const { id, action } = btn.dataset;
    if (!id || !action) return;

    let entry =
      (window.latestMasterItemCategoryEntries || entries || []).find(
        (x) => String(x.id) === String(id)
      ) || null;

    // fallback fetch
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

    /* ================= ACTION ROUTES ================= */

    if (action === "view") {
      if (!hasPerm("master_item_categories:view"))
        return showToast("⛔ No permission to view categories");
      return handleView(entry);
    }

    if (action === "edit") {
      if (!hasPerm("master_item_categories:edit"))
        return showToast("⛔ No permission to edit categories");
      return handleEdit(entry);
    }

    if (action === "toggle-status") {
      if (!hasPerm("master_item_categories:toggle_status"))
        return showToast("⛔ No permission to toggle status");
      return await handleToggleStatus(id, entry);
    }

    if (action === "delete") {
      if (!hasPerm("master_item_categories:delete"))
        return showToast("⛔ No permission to delete categories");
      return await handleDelete(id, entry);
    }
  }

  /* ============================================================
     ⚙️ HANDLERS
  ============================================================ */

  function handleView(entry) {
    const html = renderCard(entry, visibleFields, user);
    openViewModal("Category Info", html);
  }

  function handleEdit(entry) {
    if (currentEditIdRef) currentEditIdRef.value = entry.id;
    sessionStorage.setItem("masterItemCategoryEditId", entry.id);
    sessionStorage.setItem(
      "masterItemCategoryEditPayload",
      JSON.stringify(entry)
    );
    window.location.href = "add-master-item-category.html";
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

      const res = await authFetch(
        `/api/master-item-categories/${id}/toggle-status`,
        { method: "PATCH" }
      );

      const data = await res.json().catch(() => ({}));
      if (!res.ok)
        throw new Error(data.message || "❌ Failed to toggle status");

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
      showToast(err.message || "❌ Failed to update status");
    } finally {
      hideLoading();
    }
  }

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
        throw new Error(data.message || "❌ Failed to delete");

      showToast(`✅ Category "${entry.name}" deleted`);

      window.latestMasterItemCategoryEntries = [];
      await loadEntries(currentPage);
    } catch (err) {
      console.error(err);
      showToast(err.message || "❌ Failed to delete");
    } finally {
      hideLoading();
    }
  }

  /* ============================================================
     🌍 GLOBAL HELPERS
  ============================================================ */

  const findEntry = (id) =>
    (window.latestMasterItemCategoryEntries || entries || []).find(
      (x) => String(x.id) === String(id)
    );

  window.viewCategory = (id) => {
    if (!hasPerm("master_item_categories:view"))
      return showToast("⛔ No permission to view");
    const entry = findEntry(id);
    if (entry) handleView(entry);
  };

  window.editCategory = (id) => {
    if (!hasPerm("master_item_categories:edit"))
      return showToast("⛔ No permission to edit");
    const entry = findEntry(id);
    if (entry) handleEdit(entry);
  };

  window.toggleCategoryStatus = async (id) => {
    if (!hasPerm("master_item_categories:toggle_status"))
      return showToast("⛔ No permission to toggle");
    const entry = findEntry(id);
    if (entry) await handleToggleStatus(id, entry);
  };

  window.deleteCategory = async (id) => {
    if (!hasPerm("master_item_categories:delete"))
      return showToast("⛔ No permission to delete");
    const entry = findEntry(id);
    if (entry) await handleDelete(id, entry);
  };
}