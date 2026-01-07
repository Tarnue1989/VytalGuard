// 📁 stockrequest-actions.js – Full Permission-Driven Action Handlers for Stock Requests
// ⛓️ Matches master pattern (consultation-actions.js / centralstock-actions.js)

import {
  showToast,
  showConfirm,
  openViewModal,
  showLoading,
  hideLoading,
} from "../../utils/index.js";
import { authFetch } from "../../authSession.js";
import { renderCard } from "./stockrequest-render.js";

/* ============================================================
   ⚙️ MAIN INITIALIZER
============================================================ */
export function setupActionHandlers({
  entries,
  token,
  currentPage,
  loadEntries,
  visibleFields,
  sharedState,
  user, // ✅ { role, permissions }
}) {
  const { currentEditIdRef } = sharedState || {};
  const tableBody = document.getElementById("stockRequestTableBody");
  const cardContainer = document.getElementById("stockRequestList");

  // Cache entries globally
  window.latestStockRequestEntries = entries;

  if (tableBody) tableBody.addEventListener("click", handleActions);
  if (cardContainer) cardContainer.addEventListener("click", handleActions);

  /* ============================================================
     🔐 PERMISSION NORMALIZATION
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

  // ✅ Super Admin bypass
  const isSuperAdmin =
    (user?.role && user.role.toLowerCase().replace(/\s+/g, "") === "superadmin") ||
    (Array.isArray(user?.roleNames) &&
      user.roleNames.some(
        (r) => r.toLowerCase().replace(/\s+/g, "") === "superadmin"
      ));

  const hasPerm = (key) => {
    const normalized = key.trim().toLowerCase();
    return isSuperAdmin || userPerms.has(normalized);
  };

  /* ============================================================
     🧭 ACTION DISPATCHER
  ============================================================ */
  async function handleActions(e) {
    const btn = e.target.closest("button");
    if (!btn || !btn.dataset.id) return;
    const id = btn.dataset.id;

    let entry =
      (window.latestStockRequestEntries || entries || []).find(
        (x) => String(x.id) === String(id)
      ) || null;

    if (!entry) {
      try {
        showLoading();
        const res = await authFetch(`/api/stock-requests/${id}`);
        const data = await res.json().catch(() => ({}));
        entry = data?.data;
      } catch {
        return showToast("❌ Stock Request not found");
      } finally {
        hideLoading();
      }
    }

    if (!entry) return showToast("❌ Stock Request data missing");
    const cls = btn.classList;

    // --- View ---
    if (cls.contains("view-btn")) {
      if (!hasPerm("stock_requests:view"))
        return showToast("⛔ You don't have permission to view");
      return handleView(entry);
    }

    // --- Edit ---
    if (cls.contains("edit-btn")) {
      if (!hasPerm("stock_requests:edit"))
        return showToast("⛔ You don't have permission to edit");
      return handleEdit(entry);
    }

    // --- Delete ---
    if (cls.contains("delete-btn")) {
      if (!hasPerm("stock_requests:delete"))
        return showToast("⛔ You don't have permission to delete");
      return await handleDelete(id, entry);
    }

    // --- Restore ---
    if (cls.contains("restore-btn")) {
      if (!hasPerm("stock_requests:restore"))
        return showToast("⛔ No permission to restore request");
      return await handleRestore(id, entry);
    }

    // --- Lifecycle Actions ---
    const lifecycleMap = {
      submit: "Submit this stock request?",
      approve: "Approve this stock request?",
      reject: "Reject this stock request?",
      issue: "Issue this stock request?",
      fulfill: "Mark this stock request as fulfilled?",
      cancel: "Cancel this stock request?",
    };

    for (const [action, message] of Object.entries(lifecycleMap)) {
      if (cls.contains(`${action}-btn`)) {
        if (!hasPerm(`stock_requests:${action}`))
          return showToast(`⛔ No permission to ${action} stock request`);
        return await handleLifecycle(id, action, message);
      }
    }
  }

  /* ============================================================
     👁️ VIEW + ✏️ EDIT HANDLERS
  ============================================================ */
  function handleView(entry) {
    const html = renderCard(entry, visibleFields, user);
    openViewModal("Stock Request Info", html);
  }

  function handleEdit(entry) {
    if (currentEditIdRef) currentEditIdRef.value = entry.id;
    sessionStorage.setItem("stockRequestEditId", entry.id);
    sessionStorage.setItem("stockRequestEditPayload", JSON.stringify(entry));
    window.location.href = `add-stock-request.html`;
  }

  /* ============================================================
     🔄 LIFECYCLE HANDLER
  ============================================================ */
  async function handleLifecycle(id, action, confirmMsg) {
    const confirmed = await showConfirm(confirmMsg);
    if (!confirmed) return;

    try {
      showLoading();
      const res = await authFetch(`/api/stock-requests/${id}/${action}`, {
        method: "PATCH",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || `❌ Failed to ${action} request`);

      showToast(`✅ Stock Request ${action} successful`);
      window.latestStockRequestEntries = [];
      await loadEntries(currentPage);
    } catch (err) {
      console.error(err);
      showToast(err.message || `❌ Failed to ${action} request`);
    } finally {
      hideLoading();
    }
  }

  /* ============================================================
     🗑️ DELETE + RESTORE
  ============================================================ */
  async function handleDelete(id, entry) {
    const confirmed = await showConfirm(
      `Delete stock request "${entry.reference_number || id}"?`
    );
    if (!confirmed) return;

    try {
      showLoading();
      const res = await authFetch(`/api/stock-requests/${id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "❌ Failed to delete request");

      showToast("✅ Stock Request deleted successfully");
      window.latestStockRequestEntries = [];
      await loadEntries(currentPage);
    } catch (err) {
      console.error(err);
      showToast(err.message || "❌ Failed to delete request");
    } finally {
      hideLoading();
    }
  }

  async function handleRestore(id, entry) {
    const confirmed = await showConfirm(
      `Restore stock request "${entry.reference_number || id}"?`
    );
    if (!confirmed) return;

    try {
      showLoading();
      const res = await authFetch(`/api/stock-requests/${id}/restore`, {
        method: "PATCH",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "❌ Failed to restore request");

      showToast("✅ Stock Request restored successfully");
      window.latestStockRequestEntries = [];
      await loadEntries(currentPage);
    } catch (err) {
      console.error(err);
      showToast(err.message || "❌ Failed to restore request");
    } finally {
      hideLoading();
    }
  }

  /* ============================================================
     🌍 GLOBAL HELPERS
  ============================================================ */
  const findEntry = (id) =>
    (window.latestStockRequestEntries || entries || []).find(
      (x) => String(x.id) === String(id)
    );

  window.viewStockRequestEntry = (id) => {
    if (!hasPerm("stock_requests:view"))
      return showToast("⛔ No permission to view");
    const entry = findEntry(id);
    if (entry) handleView(entry);
    else showToast("❌ Record not found for viewing");
  };

  window.editStockRequestEntry = (id) => {
    if (!hasPerm("stock_requests:edit"))
      return showToast("⛔ No permission to edit");
    const entry = findEntry(id);
    if (entry) handleEdit(entry);
    else showToast("❌ Record not found for editing");
  };

  window.deleteStockRequestEntry = async (id) => {
    if (!hasPerm("stock_requests:delete"))
      return showToast("⛔ No permission to delete");
    const entry = findEntry(id);
    await handleDelete(id, entry);
  };

  // Lifecycle global triggers
  ["submit", "approve", "reject", "issue", "fulfill", "cancel"].forEach(
    (action) => {
      window[`${action}StockRequestEntry`] = async (id) => {
        if (!hasPerm(`stock_requests:${action}`))
          return showToast(`⛔ No permission to ${action} request`);
        const entry = findEntry(id);
        await handleLifecycle(id, action, `Proceed to ${action} this request?`);
      };
    }
  );
}
