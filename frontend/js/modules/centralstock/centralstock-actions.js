// 📁 centralstock-actions.js – Full Permission-Driven Action Handlers for Central Stock

import {
  showToast,
  showConfirm,
  openViewModal,
  showLoading,
  hideLoading,
} from "../../utils/index.js";
import { authFetch } from "../../authSession.js";
import { renderCard } from "./centralstock-render.js";
import { syncRefsToState } from "./centralstock-main.js";

/**
 * Unified, permission-driven action handler
 * Mirrors the appointments pattern (no hardcoded roles)
 */
export function setupActionHandlers({
  entries,
  token,
  currentPage,
  loadEntries,
  visibleFields,
  sharedState,
  user, // ✅ { role, permissions }
}) {
  const { currentEditIdRef } = sharedState;
  const tableBody = document.getElementById("centralStockTableBody");
  const cardContainer = document.getElementById("centralStockList");

  // Cache globally
  window.latestCentralStockEntries = entries;

  if (tableBody) tableBody.addEventListener("click", handleActions);
  if (cardContainer) cardContainer.addEventListener("click", handleActions);

  /* ---------------------- Normalize permissions ---------------------- */
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

  // ✅ Super Admin bypass
  const isSuperAdmin =
    (user?.role && user.role.toLowerCase().replace(/\s+/g, "") === "superadmin") ||
    (Array.isArray(user?.roleNames) &&
      user.roleNames.some(
        (r) => r.toLowerCase().replace(/\s+/g, "") === "superadmin"
      ));

  // ✅ Unified permission checker (normalize underscoring)
  const hasPerm = (key) => {
    const normalizedKey = key
      .replace(/centralstocks/gi, "central_stocks") // 🔧 fix mismatch
      .trim()
      .toLowerCase();
    return isSuperAdmin || userPerms.has(normalizedKey);
  };

  /* ---------------------- Handler dispatcher ---------------------- */
  async function handleActions(e) {
    const btn = e.target.closest("button");
    if (!btn || !btn.dataset.id) return;

    const id = btn.dataset.id;
    let entry =
      (window.latestCentralStockEntries || entries || []).find(
        (x) => String(x.id) === String(id)
      ) || null;

    // fallback fetch if missing
    if (!entry) {
      try {
        showLoading();
        const res = await authFetch(`/api/central-stocks/${id}`);
        const data = await res.json().catch(() => ({}));
        entry = data?.data;
      } catch {
        return showToast("❌ Central stock not found");
      } finally {
        hideLoading();
      }
    }

    if (!entry) return showToast("❌ Central stock data missing");
    const cls = btn.classList;

    // --- Basic view ---
    if (cls.contains("view-btn")) return handleView(entry);

    // --- Restricted actions ---
    if (cls.contains("edit-btn")) {
      if (!hasPerm("central_stocks:edit"))
        return showToast("⛔ You don't have permission to edit");
      return handleEdit(entry);
    }

    if (cls.contains("toggle-status-btn")) {
      if (!hasPerm("central_stocks:toggle-status") && !hasPerm("central_stocks:edit"))
        return showToast("⛔ You don't have permission to toggle status");
      return await handleToggleStatus(id, entry);
    }

    if (cls.contains("lock-btn")) {
      if (!hasPerm("central_stocks:lock") && !hasPerm("central_stocks:edit"))
        return showToast("⛔ You don't have permission to lock/unlock");
      return await handleLockUnlock(id, entry);
    }

    if (cls.contains("restore-btn")) {
      if (!hasPerm("central_stocks:restore") && !hasPerm("central_stocks:edit"))
        return showToast("⛔ You don't have permission to restore");
      return await handleRestore(id, entry);
    }

    if (cls.contains("delete-btn")) {
      if (!hasPerm("central_stocks:delete"))
        return showToast("⛔ You don't have permission to delete");
      return await handleDelete(id, entry);
    }
  }

  /* ---------------------- Handlers ---------------------- */
  function handleView(entry) {
    const html = renderCard(entry, visibleFields, user);
    openViewModal("Central Stock Info", html);
  }

  function handleEdit(entry) {
    currentEditIdRef.value = entry.id;
    window.location.href = `add-central-stock.html?id=${entry.id}`;
  }

  async function handleToggleStatus(id, entry) {
    const isActive = (entry.status || "").toLowerCase() === "active";
    const confirmed = await showConfirm(
      isActive
        ? `Deactivate stock for item "${entry.masterItem?.name || "Unknown"}"?`
        : `Activate stock for item "${entry.masterItem?.name || "Unknown"}"?`
    );
    if (!confirmed) return;

    try {
      showLoading();
      const res = await authFetch(`/api/central-stocks/${id}/toggle-status`, {
        method: "PATCH",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok)
        throw new Error(data.message || "❌ Failed to toggle status");

      const newStatus =
        data?.data?.status || (isActive ? "inactive" : "active");
      const itemName =
        entry?.masterItem?.name || data?.data?.masterItem?.name || "Stock";

      showToast(
        newStatus === "active"
          ? `✅ Stock "${itemName}" has been activated`
          : `✅ Stock "${itemName}" has been deactivated`
      );

      window.latestCentralStockEntries = [];
      await loadEntries(currentPage);
    } catch (err) {
      console.error(err);
      showToast(err.message || "❌ Failed to update stock status");
    } finally {
      hideLoading();
    }
  }

  async function handleLockUnlock(id, entry) {
    const locked = !!entry.is_locked;
    const confirmed = await showConfirm(
      locked
        ? `Unlock stock for "${entry.masterItem?.name || "Unknown"}"?`
        : `Lock stock for "${entry.masterItem?.name || "Unknown"}"?`
    );
    if (!confirmed) return;

    try {
      showLoading();
      const res = await authFetch(
        `/api/central-stocks/${id}/${locked ? "unlock" : "lock"}`,
        { method: "POST" }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok)
        throw new Error(data.message || "❌ Failed to update lock state");

      const itemName =
        entry?.masterItem?.name || data?.data?.masterItem?.name || "Stock";
      showToast(
        data?.data?.is_locked
          ? `🔒 Stock "${itemName}" locked`
          : `🔓 Stock "${itemName}" unlocked`
      );

      window.latestCentralStockEntries = [];
      await loadEntries(currentPage);
    } catch (err) {
      console.error(err);
      showToast(err.message || "❌ Failed to update lock state");
    } finally {
      hideLoading();
    }
  }

  async function handleRestore(id, entry) {
    const confirmed = await showConfirm(
      `Restore deleted stock entry for "${entry.masterItem?.name || "Unknown"}"?`
    );
    if (!confirmed) return;

    try {
      showLoading();
      const res = await authFetch(`/api/central-stocks/${id}/restore`, {
        method: "PATCH",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok)
        throw new Error(data.message || "❌ Failed to restore stock entry");

      showToast(
        `✅ Stock entry for "${entry.masterItem?.name || "Unknown"}" restored successfully`
      );
      await loadEntries(currentPage);
    } catch (err) {
      console.error(err);
      showToast(err.message || "❌ Failed to restore stock entry");
    } finally {
      hideLoading();
    }
  }

  async function handleDelete(id, entry) {
    const confirmed = await showConfirm(
      `Delete stock entry for "${entry.masterItem?.name || "Unknown"}"?`
    );
    if (!confirmed) return;

    try {
      showLoading();
      const res = await authFetch(`/api/central-stocks/${id}`, {
        method: "DELETE",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok)
        throw new Error(data.message || "❌ Failed to delete stock entry");

      showToast(
        `✅ Stock entry for "${entry.masterItem?.name || "Unknown"}" deleted successfully`
      );
      await loadEntries(currentPage);
    } catch (err) {
      console.error(err);
      showToast(err.message || "❌ Failed to delete stock entry");
    } finally {
      hideLoading();
    }
  }

  /* ---------------------- Global helpers ---------------------- */
  const findEntry = (id) =>
    (window.latestCentralStockEntries || entries || []).find(
      (x) => String(x.id) === String(id)
    );

  window.viewEntry = (id) => {
    const entry = findEntry(id);
    if (entry) handleView(entry);
    else showToast("❌ Stock not found for viewing");
  };

  window.editEntry = (id) => {
    if (!hasPerm("central_stocks:edit"))
      return showToast("⛔ No permission to edit");
    const entry = findEntry(id);
    if (entry) handleEdit(entry);
    else showToast("❌ Stock not found for editing");
  };

  window.deleteEntry = async (id) => {
    if (!hasPerm("central_stocks:delete"))
      return showToast("⛔ No permission to delete");
    const entry = findEntry(id);
    await handleDelete(id, entry);
  };

  window.toggleStatusEntry = async (id) => {
    if (!hasPerm("central_stocks:toggle-status") && !hasPerm("central_stocks:edit"))
      return showToast("⛔ No permission to toggle status");
    const entry = findEntry(id);
    await handleToggleStatus(id, entry);
  };

  window.lockUnlockEntry = async (id) => {
    if (!hasPerm("central_stocks:lock") && !hasPerm("central_stocks:edit"))
      return showToast("⛔ No permission to lock/unlock");
    const entry = findEntry(id);
    await handleLockUnlock(id, entry);
  };

  window.restoreEntry = async (id) => {
    if (!hasPerm("central_stocks:restore") && !hasPerm("central_stocks:edit"))
      return showToast("⛔ No permission to restore");
    const entry = findEntry(id);
    await handleRestore(id, entry);
  };
}
