// 📁 centralstock-actions.js – Enterprise Master Pattern (Central Stock)
// ============================================================================
// 🧭 FULL PARITY WITH billableitem-actions.js / department-actions.js
// 🔹 Permission-driven (superadmin-aware)
// 🔹 Unified lifecycle: view / edit / toggle-status / lock / delete / restore
// 🔹 Keeps all DOM IDs, routes, API calls, and UI behavior intact
// ============================================================================

import {
  showToast,
  showConfirm,
  openViewModal,
  showLoading,
  hideLoading,
} from "../../utils/index.js";
import { authFetch } from "../../authSession.js";
import { renderCard } from "./centralstock-render.js";

/**
 * Unified permission-aware action handler for Central Stock module
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
  const tableBody = document.getElementById("centralStockTableBody");
  const cardContainer = document.getElementById("centralStockList");

  // 🗂️ Cache latest entries (Enterprise Pattern)
  window.latestCentralStockEntries = entries;

  if (tableBody) tableBody.addEventListener("click", handleActions);
  if (cardContainer) cardContainer.addEventListener("click", handleActions);

  /* ============================================================
     🔑 Normalize Permissions (MASTER LOGIC)
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

  // ✅ Unified permission checker
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
      (window.latestCentralStockEntries || entries || []).find(
        (x) => String(x.id) === String(id)
      ) || null;

    // 🩹 Fallback fetch (MASTER PATTERN)
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

    if (cls.contains("view-btn")) {
      if (!hasPerm("central_stocks:view"))
        return showToast("⛔ You don't have permission to view stock");
      return handleView(entry);
    }

    if (cls.contains("edit-btn")) {
      if (!hasPerm("central_stocks:edit"))
        return showToast("⛔ You don't have permission to edit stock");
      return handleEdit(entry);
    }

    if (cls.contains("toggle-status-btn")) {
      if (!hasPerm("central_stocks:toggle-status"))
        return showToast("⛔ You don't have permission to change status");
      return await handleToggleStatus(id, entry);
    }

    if (cls.contains("lock-btn")) {
      if (!hasPerm("central_stocks:lock"))
        return showToast("⛔ You don't have permission to lock/unlock");
      return await handleLockUnlock(id, entry);
    }

    if (cls.contains("delete-btn")) {
      if (!hasPerm("central_stocks:delete"))
        return showToast("⛔ You don't have permission to delete stock");
      return await handleDelete(id, entry);
    }

    if (cls.contains("restore-btn")) {
      if (!hasPerm("central_stocks:restore"))
        return showToast("⛔ You don't have permission to restore stock");
      return await handleRestore(id, entry);
    }
  }

  /* ============================================================
     ⚙️ Action Handlers
  ============================================================ */

  // 🔍 View
  function handleView(entry) {
    const html = renderCard(entry, visibleFields, user);
    openViewModal("Central Stock Info", html);
  }

  // ✏️ Edit
  function handleEdit(entry) {
    if (currentEditIdRef) currentEditIdRef.value = entry.id;
    sessionStorage.setItem("centralStockEditId", entry.id);
    sessionStorage.setItem(
      "centralStockEditPayload",
      JSON.stringify(entry)
    );
    window.location.href = "add-central-stock.html";
  }

  // 🔄 Toggle Status
  async function handleToggleStatus(id, entry) {
    const isActive = (entry.status || "").toLowerCase() === "active";
    const confirmed = await showConfirm(
      isActive
        ? `Deactivate stock for "${entry.masterItem?.name || "Item"}"?`
        : `Activate stock for "${entry.masterItem?.name || "Item"}"?`
    );
    if (!confirmed) return;

    try {
      showLoading();
      const res = await authFetch(`/api/central-stocks/${id}/toggle-status`, {
        method: "PATCH",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok)
        throw new Error(data.message || "❌ Failed to toggle stock status");

      const newStatus =
        (data?.data?.status ||
          (isActive ? "inactive" : "active")).toLowerCase();

      showToast(
        newStatus === "active"
          ? `✅ Stock "${entry.masterItem?.name || "Item"}" activated`
          : `✅ Stock "${entry.masterItem?.name || "Item"}" deactivated`
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

  // 🔒 Lock / Unlock
  async function handleLockUnlock(id, entry) {
    const locked = !!entry.is_locked;
    const confirmed = await showConfirm(
      locked
        ? `Unlock stock for "${entry.masterItem?.name || "Item"}"?`
        : `Lock stock for "${entry.masterItem?.name || "Item"}"?`
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

      showToast(
        data?.data?.is_locked
          ? `🔒 Stock "${entry.masterItem?.name || "Item"}" locked`
          : `🔓 Stock "${entry.masterItem?.name || "Item"}" unlocked`
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

  // 🗑️ Delete
  async function handleDelete(id, entry) {
    const confirmed = await showConfirm(
      `Delete stock entry for "${entry.masterItem?.name || "Item"}"?`
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
        `✅ Stock entry for "${entry.masterItem?.name || "Item"}" deleted`
      );
      window.latestCentralStockEntries = [];
      await loadEntries(currentPage);
    } catch (err) {
      console.error(err);
      showToast(err.message || "❌ Failed to delete stock entry");
    } finally {
      hideLoading();
    }
  }

  // ♻️ Restore
  async function handleRestore(id, entry) {
    const confirmed = await showConfirm(
      `Restore stock entry for "${entry.masterItem?.name || "Item"}"?`
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
        `✅ Stock entry for "${entry.masterItem?.name || "Item"}" restored`
      );
      window.latestCentralStockEntries = [];
      await loadEntries(currentPage);
    } catch (err) {
      console.error(err);
      showToast(err.message || "❌ Failed to restore stock entry");
    } finally {
      hideLoading();
    }
  }

  /* ============================================================
     🌍 Global Helpers (Inline Triggers – MASTER PATTERN)
  ============================================================ */
  const findEntry = (id) =>
    (window.latestCentralStockEntries || entries || []).find(
      (x) => String(x.id) === String(id)
    );

  window.viewCentralStock = (id) => {
    if (!hasPerm("central_stocks:view"))
      return showToast("⛔ No permission to view stock");
    const entry = findEntry(id);
    if (entry) handleView(entry);
  };

  window.editCentralStock = (id) => {
    if (!hasPerm("central_stocks:edit"))
      return showToast("⛔ No permission to edit stock");
    const entry = findEntry(id);
    if (entry) handleEdit(entry);
  };

  window.toggleCentralStockStatus = async (id) => {
    if (!hasPerm("central_stocks:toggle-status"))
      return showToast("⛔ No permission to toggle status");
    const entry = findEntry(id);
    await handleToggleStatus(id, entry);
  };

  window.lockUnlockCentralStock = async (id) => {
    if (!hasPerm("central_stocks:lock"))
      return showToast("⛔ No permission to lock/unlock");
    const entry = findEntry(id);
    await handleLockUnlock(id, entry);
  };

  window.deleteCentralStock = async (id) => {
    if (!hasPerm("central_stocks:delete"))
      return showToast("⛔ No permission to delete stock");
    const entry = findEntry(id);
    await handleDelete(id, entry);
  };

  window.restoreCentralStock = async (id) => {
    if (!hasPerm("central_stocks:restore"))
      return showToast("⛔ No permission to restore stock");
    const entry = findEntry(id);
    await handleRestore(id, entry);
  };
}
