// 📁 master-item-actions.js – Full Permission-Driven Action Handlers (Upgraded)
// ============================================================================
// 🧭 Master Pattern: master-item-category-actions.js / vital-actions.js
// 🔹 Enterprise-aligned permission scheme (master_items:view, edit, toggle, delete)
// 🔹 Includes SuperAdmin bypass + unified permission normalization
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
import { renderCard } from "./master-item-render.js";

/* ============================================================
   ⚙️ Main Action Handler Setup
============================================================ */
export function setupActionHandlers({
  entries,
  token,
  currentPage,
  loadEntries,
  visibleFields,
  sharedState,
  user, // { role, permissions, roleNames }
}) {
  const tableBody = document.getElementById("masterItemTableBody");
  const cardContainer = document.getElementById("masterItemList");

  // Cache current entries globally
  window.latestMasterItemEntries = entries;

  if (tableBody) tableBody.addEventListener("click", handleActions);
  if (cardContainer) cardContainer.addEventListener("click", handleActions);

  /* ============================================================
     🔐 Normalize & Verify Permissions
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

  const userPerms = new Set(normalizePermissions(user?.permissions || []));

  // ✅ SuperAdmin bypass logic
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

  /* ============================================================
     🧩 Handler Dispatcher
  ============================================================ */
  async function handleActions(e) {
    const btn = e.target.closest("button");
    if (!btn || !btn.dataset.id) return;

    const id = btn.dataset.id;
    let entry =
      (window.latestMasterItemEntries || entries || []).find(
        (x) => String(x.id) === String(id)
      ) || null;

    // 🔄 Fetch full record if not cached
    if (!entry) {
      try {
        showLoading();
        const res = await authFetch(`/api/master-items/${id}`);
        const data = await res.json().catch(() => ({}));
        entry = data?.data;
      } catch {
        return showToast("❌ Master Item not found");
      } finally {
        hideLoading();
      }
    }

    if (!entry) return showToast("❌ Master Item data missing");

    const cls = btn.classList;

    // --- View ---
    if (cls.contains("view-btn")) {
      if (!hasPerm("master_items:view"))
        return showToast("⛔ You don't have permission to view items");
      return handleView(entry);
    }

    // --- Edit ---
    if (cls.contains("edit-btn")) {
      if (!hasPerm("master_items:edit"))
        return showToast("⛔ You don't have permission to edit items");
      return handleEdit(entry);
    }

    // --- Toggle Status ---
    if (cls.contains("toggle-status-btn")) {
      if (!hasPerm("master_items:toggle"))
        return showToast("⛔ You don't have permission to toggle item status");
      return await handleToggleStatus(id, entry);
    }

    // --- Delete ---
    if (cls.contains("delete-btn")) {
      if (!hasPerm("master_items:delete"))
        return showToast("⛔ You don't have permission to delete items");
      return await handleDelete(id, entry);
    }
  }

  /* ============================================================
     🧠 Handlers
  ============================================================ */
  function handleView(entry) {
    const html = renderCard(entry, visibleFields, user);
    openViewModal("Master Item Info", html);
  }

  function handleEdit(entry) {
    if (sharedState?.currentEditIdRef)
      sharedState.currentEditIdRef.value = entry.id;

    sessionStorage.setItem("masterItemEditId", entry.id);
    sessionStorage.setItem("masterItemEditPayload", JSON.stringify(entry));
    window.location.href = `add-master-item.html`;
  }

  async function handleToggleStatus(id, entry) {
    const isActive = (entry.status || "").toLowerCase() === "active";
    const confirmed = await showConfirm(
      isActive
        ? `Deactivate item "${entry.name}"?`
        : `Activate item "${entry.name}"?`
    );
    if (!confirmed) return;

    try {
      showLoading();
      const res = await authFetch(`/api/master-items/${id}/toggle-status`, {
        method: "PATCH",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok)
        throw new Error(data.message || "❌ Failed to toggle item status");

      const newStatus =
        data?.data?.status || (isActive ? "inactive" : "active");
      const itemName = entry?.name || data?.data?.name || "Item";

      if (newStatus.toLowerCase() === "active") {
        showToast(`✅ Item "${itemName}" has been activated`);
      } else if (newStatus.toLowerCase() === "inactive") {
        showToast(`✅ Item "${itemName}" has been deactivated`);
      } else {
        showToast(`✅ Item "${itemName}" status updated to ${newStatus}`);
      }

      window.latestMasterItemEntries = [];
      await loadEntries(currentPage);
    } catch (err) {
      console.error(err);
      showToast(err.message || "❌ Failed to update item status");
    } finally {
      hideLoading();
    }
  }

  async function handleDelete(id, entry) {
    const confirmed = await showConfirm(`Delete item "${entry.name}"?`);
    if (!confirmed) return;

    try {
      showLoading();
      const res = await authFetch(`/api/master-items/${id}`, {
        method: "DELETE",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok)
        throw new Error(data.message || "❌ Failed to delete item");

      const itemName = entry?.name || data?.data?.name || "Item";
      showToast(`✅ Item "${itemName}" deleted successfully`);

      window.latestMasterItemEntries = [];
      await loadEntries(currentPage);
    } catch (err) {
      console.error(err);
      showToast(err.message || "❌ Failed to delete item");
    } finally {
      hideLoading();
    }
  }

  /* ============================================================
     🌐 Global Helpers
  ============================================================ */
  const findEntry = (id) =>
    (window.latestMasterItemEntries || entries || []).find(
      (x) => String(x.id) === String(id)
    );

  window.viewEntry = (id) => {
    if (!hasPerm("master_items:view"))
      return showToast("⛔ No permission to view items");
    const entry = findEntry(id);
    if (entry) handleView(entry);
    else showToast("❌ Item not found for viewing");
  };

  window.editEntry = (id) => {
    if (!hasPerm("master_items:edit"))
      return showToast("⛔ No permission to edit items");
    const entry = findEntry(id);
    if (entry) handleEdit(entry);
    else showToast("❌ Item not found for editing");
  };

  window.toggleStatusEntry = async (id) => {
    if (!hasPerm("master_items:toggle"))
      return showToast("⛔ No permission to toggle item status");
    const entry = findEntry(id);
    await handleToggleStatus(id, entry);
  };

  window.deleteEntry = async (id) => {
    if (!hasPerm("master_items:delete"))
      return showToast("⛔ No permission to delete items");
    const entry = findEntry(id);
    await handleDelete(id, entry);
  };
}
