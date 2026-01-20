// 📁 billableitem-actions.js – Enterprise Master Pattern (Billable Items)
// ============================================================================
// 🧭 FULL PARITY WITH department-actions.js
// 🔹 Permission-driven (superadmin-aware)
// 🔹 Unified lifecycle: view / edit / toggle-status / delete / restore
// 🔹 Keeps all DOM IDs, routes, and UI behavior intact
// ============================================================================

import {
  showToast,
  showConfirm,
  openViewModal,
  showLoading,
  hideLoading,
} from "../../utils/index.js";
import { authFetch } from "../../authSession.js";
import { renderCard } from "./billableitem-render.js";

/**
 * Unified permission-aware action handler for Billable Item module
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
  const tableBody = document.getElementById("billableItemTableBody");
  const cardContainer = document.getElementById("billableItemList");

  // 🗂️ Cache latest entries
  window.latestBillableItemEntries = entries;

  if (tableBody) tableBody.addEventListener("click", handleActions);
  if (cardContainer) cardContainer.addEventListener("click", handleActions);

  /* ============================================================
     🔑 Normalize Permissions
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

  // 🧠 Superadmin bypass (EXACT MASTER LOGIC)
  const isSuperAdmin =
    (user?.role &&
      user.role.toLowerCase().replace(/\s+/g, "") === "superadmin") ||
    (Array.isArray(user?.roleNames) &&
      user.roleNames.some(
        (r) => r.toLowerCase().replace(/\s+/g, "") === "superadmin"
      ));

  // ✅ Permission checker
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
      (window.latestBillableItemEntries || entries || []).find(
        (x) => String(x.id) === String(id)
      ) || null;

    // 🩹 Fallback fetch
    if (!entry) {
      try {
        showLoading();
        const res = await authFetch(`/api/billable-items/${id}`);
        const data = await res.json().catch(() => ({}));
        entry = data?.data;
      } catch {
        return showToast("❌ Billable item not found");
      } finally {
        hideLoading();
      }
    }

    if (!entry) return showToast("❌ Billable item data missing");

    const cls = btn.classList;

    if (cls.contains("view-btn")) {
      if (!hasPerm("billable_items:view"))
        return showToast("⛔ You don't have permission to view billable items");
      return handleView(entry);
    }

    if (cls.contains("edit-btn")) {
      if (!hasPerm("billable_items:edit"))
        return showToast("⛔ You don't have permission to edit billable items");
      return handleEdit(entry);
    }

    if (cls.contains("toggle-status-btn")) {
      if (!hasPerm("billable_items:toggle-status"))
        return showToast("⛔ You don't have permission to change status");
      return await handleToggleStatus(id, entry);
    }

    if (cls.contains("delete-btn")) {
      if (!hasPerm("billable_items:delete"))
        return showToast("⛔ You don't have permission to delete billable items");
      return await handleDelete(id, entry);
    }

    if (cls.contains("restore-btn")) {
      if (!hasPerm("billable_items:restore"))
        return showToast("⛔ You don't have permission to restore billable items");
      return await handleRestore(id, entry);
    }
  }

  /* ============================================================
     ⚙️ Action Handlers
  ============================================================ */

  // 🔍 View
  function handleView(entry) {
    const html = renderCard(entry, visibleFields, user);
    openViewModal("Billable Item Info", html);
  }

  // ✏️ Edit
  function handleEdit(entry) {
    if (currentEditIdRef) currentEditIdRef.value = entry.id;
    sessionStorage.setItem("billableItemEditId", entry.id);
    sessionStorage.setItem(
      "billableItemEditPayload",
      JSON.stringify(entry)
    );
    window.location.href = "add-billableitem.html";
  }

  // 🔄 Toggle Status
  async function handleToggleStatus(id, entry) {
    const isActive = (entry.status || "").toLowerCase() === "active";
    const confirmed = await showConfirm(
      isActive
        ? `Deactivate billable item "${entry.name}"?`
        : `Activate billable item "${entry.name}"?`
    );
    if (!confirmed) return;

    try {
      showLoading();
      const res = await authFetch(`/api/billable-items/${id}/toggle-status`, {
        method: "PATCH",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok)
        throw new Error(
          data.message || "❌ Failed to toggle billable item status"
        );

      const newStatus =
        (data?.data?.status ||
          (isActive ? "inactive" : "active")).toLowerCase();

      showToast(
        newStatus === "active"
          ? `✅ Billable item "${entry.name}" activated`
          : `✅ Billable item "${entry.name}" deactivated`
      );

      window.latestBillableItemEntries = [];
      await loadEntries(currentPage);
    } catch (err) {
      console.error(err);
      showToast(err.message || "❌ Failed to update billable item status");
    } finally {
      hideLoading();
    }
  }

  // 🗑️ Delete
  async function handleDelete(id, entry) {
    const confirmed = await showConfirm(
      `Delete billable item "${entry.name}" permanently?`
    );
    if (!confirmed) return;

    try {
      showLoading();
      const res = await authFetch(`/api/billable-items/${id}`, {
        method: "DELETE",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok)
        throw new Error(data.message || "❌ Failed to delete billable item");

      showToast(`✅ Billable item "${entry.name}" deleted successfully`);
      window.latestBillableItemEntries = [];
      await loadEntries(currentPage);
    } catch (err) {
      console.error(err);
      showToast(err.message || "❌ Failed to delete billable item");
    } finally {
      hideLoading();
    }
  }

  // ♻️ Restore
  async function handleRestore(id, entry) {
    const confirmed = await showConfirm(
      `Restore billable item "${entry.name}" record?`
    );
    if (!confirmed) return;

    try {
      showLoading();
      const res = await authFetch(`/api/billable-items/${id}/restore`, {
        method: "PATCH",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok)
        throw new Error(data.message || "❌ Failed to restore billable item");

      showToast(`✅ Billable item "${entry.name}" restored successfully`);
      window.latestBillableItemEntries = [];
      await loadEntries(currentPage);
    } catch (err) {
      console.error(err);
      showToast(err.message || "❌ Failed to restore billable item");
    } finally {
      hideLoading();
    }
  }

  /* ============================================================
     🌍 Global Helpers (Inline Triggers)
  ============================================================ */
  const findEntry = (id) =>
    (window.latestBillableItemEntries || entries || []).find(
      (x) => String(x.id) === String(id)
    );

  window.viewBillableItem = (id) => {
    if (!hasPerm("billable_items:view"))
      return showToast("⛔ No permission to view billable items");
    const entry = findEntry(id);
    if (entry) handleView(entry);
  };

  window.editBillableItem = (id) => {
    if (!hasPerm("billable_items:edit"))
      return showToast("⛔ No permission to edit billable items");
    const entry = findEntry(id);
    if (entry) handleEdit(entry);
  };

  window.toggleBillableItemStatus = async (id) => {
    if (!hasPerm("billable_items:toggle-status"))
      return showToast("⛔ No permission to toggle status");
    const entry = findEntry(id);
    await handleToggleStatus(id, entry);
  };

  window.deleteBillableItem = async (id) => {
    if (!hasPerm("billable_items:delete"))
      return showToast("⛔ No permission to delete billable items");
    const entry = findEntry(id);
    await handleDelete(id, entry);
  };

  window.restoreBillableItem = async (id) => {
    if (!hasPerm("billable_items:restore"))
      return showToast("⛔ No permission to restore billable items");
    const entry = findEntry(id);
    await handleRestore(id, entry);
  };
}
