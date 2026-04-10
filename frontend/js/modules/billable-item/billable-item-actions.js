// 📁 billable-item-actions.js – ENTERPRISE MASTER FINAL
// ============================================================================
// 🔹 Granular permissions (billable_items:*)
// 🔹 Event guard added (prevents duplicate handlers)
// 🔹 Fully aligned with matrix + DB
// 🔹 NO refactor (structure preserved)
// ============================================================================

import {
  showToast,
  showConfirm,
  openViewModal,
  showLoading,
  hideLoading,
} from "../../utils/index.js";

import { authFetch } from "../../authSession.js";
import { renderCard } from "./billable-item-render.js";

/* ============================================================
   🛡️ EVENT GUARD
============================================================ */
let billableItemHandlersBound = false;

/**
 * Unified permission-aware action handler for BillableItem module
 */
export function setupActionHandlers({
  entries,
  token,
  currentPage,
  loadEntries,
  visibleFields,
  sharedState,
  user,
}) {
  if (billableItemHandlersBound) return;
  billableItemHandlersBound = true;

  const { currentEditIdRef } = sharedState || {};
  const tableBody = document.getElementById("billableItemTableBody");
  const cardContainer = document.getElementById("billableItemList");

  window.latestBillableItemEntries = entries;

  tableBody?.addEventListener("click", handleActions);
  cardContainer?.addEventListener("click", handleActions);

  /* ================= PERMISSIONS ================= */
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

  /* ================= DISPATCHER ================= */
  async function handleActions(e) {
    const btn = e.target.closest("button");
    if (!btn || !btn.dataset.id) return;

    const id = btn.dataset.id;

    let entry =
      (window.latestBillableItemEntries || entries || []).find(
        (x) => String(x.id) === String(id)
      ) || null;

    /* ===== fallback fetch ===== */
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
        return showToast("⛔ No permission to view");
      return handleView(entry);
    }

    if (cls.contains("edit-btn")) {
      if (!hasPerm("billable_items:edit"))
        return showToast("⛔ No permission to edit");
      return handleEdit(entry);
    }

    if (cls.contains("delete-btn")) {
      if (!hasPerm("billable_items:delete"))
        return showToast("⛔ No permission to delete");
      return handleDelete(id, entry);
    }

    if (cls.contains("toggle-status-btn")) {
      if (!hasPerm("billable_items:toggle_status"))
        return showToast("⛔ No permission to change status");
      return handleToggleStatus(id);
    }
  }

  /* ================= HANDLERS ================= */

  function handleView(entry) {
    const html = renderCard(entry, visibleFields, user);
    openViewModal("Billable Item Info", html);
  }

  function handleEdit(entry) {
    if (currentEditIdRef) currentEditIdRef.value = entry.id;

    sessionStorage.setItem("billableItemEditId", entry.id);
    sessionStorage.setItem(
      "billableItemEditPayload",
      JSON.stringify(entry)
    );

    window.location.href = "add-billable-item.html";
  }

  async function handleDelete(id, entry) {
    const confirmed = await showConfirm(
      `Delete item "${entry?.name || ""}"?`
    );
    if (!confirmed) return;

    try {
      showLoading();

      const res = await authFetch(`/api/billable-items/${id}`, {
        method: "DELETE",
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok)
        throw new Error(data.message || "❌ Failed to delete");

      showToast("✅ Deleted successfully");

      window.latestBillableItemEntries = [];
      await loadEntries(currentPage);
    } catch (err) {
      console.error(err);
      showToast(err.message || "❌ Delete failed");
    } finally {
      hideLoading();
    }
  }

  async function handleToggleStatus(id) {
    try {
      showLoading();

      const res = await authFetch(
        `/api/billable-items/${id}/toggle-status`,
        { method: "PATCH" }
      );

      const data = await res.json().catch(() => ({}));
      if (!res.ok)
        throw new Error(data.message || "❌ Failed to toggle status");

      showToast("✅ Status updated");

      window.latestBillableItemEntries = [];
      await loadEntries(currentPage);
    } catch (err) {
      console.error(err);
      showToast(err.message || "❌ Failed to toggle status");
    } finally {
      hideLoading();
    }
  }

  /* ================= GLOBAL HELPERS ================= */

  const findEntry = (id) =>
    (window.latestBillableItemEntries || entries || []).find(
      (x) => String(x.id) === String(id)
    );

  window.viewBillableItem = (id) => {
    if (!hasPerm("billable_items:view"))
      return showToast("⛔ No permission");
    const entry = findEntry(id);
    if (entry) handleView(entry);
  };

  window.editBillableItem = (id) => {
    if (!hasPerm("billable_items:edit"))
      return showToast("⛔ No permission");
    const entry = findEntry(id);
    if (entry) handleEdit(entry);
  };

  window.deleteBillableItem = async (id) => {
    if (!hasPerm("billable_items:delete"))
      return showToast("⛔ No permission");
    const entry = findEntry(id);
    await handleDelete(id, entry);
  };

  window.toggleBillableItemStatus = async (id) => {
    if (!hasPerm("billable_items:toggle_status"))
      return showToast("⛔ No permission");
    await handleToggleStatus(id);
  };

  // backward compatibility
  window.viewEntry = window.viewBillableItem;
  window.editEntry = window.editBillableItem;
  window.deleteEntry = window.deleteBillableItem;
}