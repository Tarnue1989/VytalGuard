// 📁 billableitem-actions.js – Full Permission-Driven Action Handlers for Billable Items

import {
  showToast,
  showConfirm,
  openViewModal,
  showLoading,
  hideLoading,
} from "../../utils/index.js";
import { authFetch } from "../../authSession.js";
import { renderCard } from "./billableitem-render.js";
import { syncRefsToState } from "./billableitem-main.js";

/**
 * Unified, permission-driven action handler
 * Mirrors the Central Stock pattern — no hardcoded roles
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

  const tableBody = document.getElementById("billableItemTableBody");
  const cardContainer = document.getElementById("billableItemList");

  // cache latest list
  window.latestBillableItemEntries = entries;

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

  const userPerms = new Set(normalizePermissions(user?.permissions || []));
  const isSuperAdmin =
    (user?.role &&
      user.role.toLowerCase().replace(/\s+/g, "") === "superadmin") ||
    (Array.isArray(user?.roleNames) &&
      user.roleNames.some(
        (r) => r.toLowerCase().replace(/\s+/g, "") === "superadmin"
      ));

  // ✅ Permission helper
  const hasPerm = (key) => {
    const normalizedKey = key
      .replace(/billableitems/gi, "billable_items") // normalize naming
      .trim()
      .toLowerCase();
    return isSuperAdmin || userPerms.has(normalizedKey);
  };

  /* ---------------------- Action Dispatcher ---------------------- */
  async function handleActions(e) {
    const btn = e.target.closest("button");
    if (!btn || !btn.dataset.id) return;

    const id = btn.dataset.id;
    let entry =
      (window.latestBillableItemEntries || entries || []).find(
        (x) => String(x.id) === String(id)
      ) || null;

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

    if (!entry) return showToast("❌ Billable Item data missing");
    const cls = btn.classList;

    // View — always allowed
    if (cls.contains("view-btn")) return handleView(entry);

    // Restricted actions below
    if (cls.contains("edit-btn")) {
      if (!hasPerm("billable_items:edit"))
        return showToast("⛔ You don't have permission to edit");
      return handleEdit(entry);
    }

    if (cls.contains("toggle-btn")) {
      if (!hasPerm("billable_items:toggle-status") && !hasPerm("billable_items:edit"))
        return showToast("⛔ No permission to toggle status");
      return await handleToggleStatus(id, entry);
    }

    if (cls.contains("restore-btn")) {
      if (!hasPerm("billable_items:restore") && !hasPerm("billable_items:edit"))
        return showToast("⛔ No permission to restore");
      return await handleRestore(id, entry);
    }

    if (cls.contains("delete-btn")) {
      if (!hasPerm("billable_items:delete"))
        return showToast("⛔ No permission to delete");
      return await handleDelete(id, entry);
    }

    if (cls.contains("history-btn")) {
      if (!hasPerm("billable_items:view") && !hasPerm("billable_items:history"))
        return showToast("⛔ No permission to view history");
      return await handleHistory(id, entry);
    }
  }

  /* ---------------------- Handlers ---------------------- */
  function handleView(entry) {
    const html = renderCard(entry, visibleFields, user);
    openViewModal("Billable Item Info", html);
  }

  function handleEdit(entry) {
    currentEditIdRef.value = entry.id;
    window.location.href = `add-billableitem.html?id=${entry.id}`;
  }

  async function handleToggleStatus(id, entry) {
    const isActive = (entry.status || "").toLowerCase() === "active";
    const confirmed = await showConfirm(
      isActive
        ? `Deactivate billable item "${entry.name || "Unknown"}"?`
        : `Activate billable item "${entry.name || "Unknown"}"?`
    );
    if (!confirmed) return;

    try {
      showLoading();
      const res = await authFetch(`/api/billable-items/${id}/toggle-status`, {
        method: "PATCH",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok)
        throw new Error(data.message || "❌ Failed to toggle status");

      const newStatus = (
        data?.data?.status || (isActive ? "inactive" : "active")
      ).toLowerCase();
      const itemName = entry?.name || data?.data?.name || "Billable Item";

      showToast(
        newStatus === "active"
          ? `✅ "${itemName}" has been activated`
          : `✅ "${itemName}" has been deactivated`
      );

      window.latestBillableItemEntries = [];
      await loadEntries(currentPage);
    } catch (err) {
      console.error(err);
      showToast(err.message || "❌ Failed to update status");
    } finally {
      hideLoading();
    }
  }

  async function handleRestore(id, entry) {
    const confirmed = await showConfirm(
      `Restore deleted billable item "${entry.name || "Unknown"}"?`
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

      showToast(`✅ "${entry.name || "Unknown"}" restored successfully`);
      await loadEntries(currentPage);
    } catch (err) {
      console.error(err);
      showToast(err.message || "❌ Failed to restore");
    } finally {
      hideLoading();
    }
  }

  async function handleDelete(id, entry) {
    const confirmed = await showConfirm(
      `Delete billable item "${entry.name || "Unknown"}"?`
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

      showToast(`✅ "${entry.name || "Unknown"}" deleted successfully`);
      await loadEntries(currentPage);
    } catch (err) {
      console.error(err);
      showToast(err.message || "❌ Failed to delete");
    } finally {
      hideLoading();
    }
  }

  async function handleHistory(id, entry) {
    try {
      showLoading();
      const res = await authFetch(`/api/billable-items/${id}/history`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "❌ Failed to load history");

      const records = Array.isArray(data?.data) ? data.data : [];
      if (!records.length) {
        showToast("ℹ️ No price history available");
        return;
      }

      const rows = records
        .map((r) => {
          const changedBy = r.createdBy
            ? `${r.createdBy.first_name || ""} ${r.createdBy.last_name || ""}`.trim() || "—"
            : "—";
          return `
            <tr>
              <td>${r.old_price ?? "—"}</td>
              <td>${r.new_price ?? "—"}</td>
              <td>${r.effective_date?.split("T")[0] ?? "—"}</td>
              <td>${changedBy}</td>
            </tr>`;
        })
        .join("");

      const html = `
        <div class="table-responsive">
          <table class="table table-sm table-bordered">
            <thead>
              <tr>
                <th>Old Price</th>
                <th>New Price</th>
                <th>Effective Date</th>
                <th>Changed By</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </div>`;

      openViewModal(`Price History – ${entry.name || "Billable Item"}`, html);
    } catch (err) {
      console.error(err);
      showToast(err.message || "❌ Failed to load history");
    } finally {
      hideLoading();
    }
  }

  /* ---------------------- Global Helpers ---------------------- */
  const findEntry = (id) =>
    (window.latestBillableItemEntries || entries || []).find(
      (x) => String(x.id) === String(id)
    );

  window.viewBillableEntry = (id) => {
    const entry = findEntry(id);
    if (entry) handleView(entry);
    else showToast("❌ Billable item not found");
  };

  window.editBillableEntry = (id) => {
    if (!hasPerm("billable_items:edit"))
      return showToast("⛔ No permission to edit");
    const entry = findEntry(id);
    if (entry) handleEdit(entry);
    else showToast("❌ Item not found");
  };

  window.deleteBillableEntry = async (id) => {
    if (!hasPerm("billable_items:delete"))
      return showToast("⛔ No permission to delete");
    const entry = findEntry(id);
    await handleDelete(id, entry);
  };

  window.toggleBillableStatusEntry = async (id) => {
    if (!hasPerm("billable_items:toggle-status") && !hasPerm("billable_items:edit"))
      return showToast("⛔ No permission to toggle status");
    const entry = findEntry(id);
    await handleToggleStatus(id, entry);
  };

  window.restoreBillableEntry = async (id) => {
    if (!hasPerm("billable_items:restore") && !hasPerm("billable_items:edit"))
      return showToast("⛔ No permission to restore");
    const entry = findEntry(id);
    await handleRestore(id, entry);
  };

  window.viewBillableHistory = async (id) => {
    if (!hasPerm("billable_items:view") && !hasPerm("billable_items:history"))
      return showToast("⛔ No permission to view history");
    const entry = findEntry(id);
    await handleHistory(id, entry);
  };
}
