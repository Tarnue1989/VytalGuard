// 📁 order-actions.js
// ============================================================================
// 📦 Enterprise MASTER–ALIGNED Action Handlers (Orders)
// ----------------------------------------------------------------------------
// 🔹 Lab Request → Order Adaptation
// 🔹 Permission-driven (superadmin-aware)
// 🔹 Full lifecycle: view / edit / delete / submit / activate / complete / verify / cancel / void
// 🔹 API: /api/orders (UNCHANGED PATTERN)
// ============================================================================

import {
  showToast,
  showConfirm,
  openViewModal,
  showLoading,
  hideLoading,
} from "../../utils/index.js";
import { authFetch } from "../../authSession.js";
import { renderCard } from "./order-render.js";

/* ============================================================
   🎯 MAIN SETUP
============================================================ */
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
  const tableBody = document.getElementById("orderTableBody");
  const cardContainer = document.getElementById("orderList");

  window.latestOrderEntries = entries;

  tableBody?.addEventListener("click", handleActions);
  cardContainer?.addEventListener("click", handleActions);

  /* ============================================================
     🔐 PERMISSIONS
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
    (user?.role || "").toLowerCase().replace(/\s+/g, "") === "superadmin" ||
    (user?.roleNames || []).some(
      (r) => r.toLowerCase().replace(/\s+/g, "") === "superadmin"
    );

  const hasPerm = (key) =>
    isSuperAdmin || userPerms.has(String(key).toLowerCase().trim());

  /* ============================================================
     🧭 ACTION DISPATCH
  ============================================================ */
  async function handleActions(e) {
    const btn = e.target.closest("button");
    if (!btn || !btn.dataset.id) return;

    const id = btn.dataset.id;

    let entry =
      (window.latestOrderEntries || entries || []).find(
        (x) => String(x.id) === String(id)
      ) || null;

    if (!entry) {
      try {
        showLoading();
        const res = await authFetch(`/api/orders/${id}`);
        const data = await res.json().catch(() => ({}));
        entry = data?.data;
      } catch {
        return showToast("❌ Order not found");
      } finally {
        hideLoading();
      }
    }

    if (!entry) return showToast("❌ Order data missing");

    const cls = btn.classList;

    if (cls.contains("view-btn")) {
      if (!hasPerm("orders:view"))
        return showToast("⛔ No permission to view orders");
      return handleView(entry);
    }

    if (cls.contains("edit-btn")) {
      if (!hasPerm("orders:edit"))
        return showToast("⛔ No permission to edit orders");
      return handleEdit(entry);
    }

    if (cls.contains("delete-btn")) {
      if (!hasPerm("orders:delete"))
        return showToast("⛔ No permission to delete orders");
      return await handleDelete(id, entry);
    }

    if (cls.contains("submit-btn")) {
      if (!hasPerm("orders:submit"))
        return showToast("⛔ No permission to submit order");
      return await handleLifecycle(id, "submit", "Submit this order?");
    }

    if (cls.contains("activate-btn")) {
      if (!hasPerm("orders:activate"))
        return showToast("⛔ No permission to activate order");
      return await handleLifecycle(id, "activate", "Activate this order?");
    }

    if (cls.contains("complete-btn")) {
      if (!hasPerm("orders:complete"))
        return showToast("⛔ No permission to complete order");
      return await handleLifecycle(id, "complete", "Complete this order?");
    }

    if (cls.contains("verify-btn")) {
      if (!hasPerm("orders:verify"))
        return showToast("⛔ No permission to verify order");
      return await handleLifecycle(id, "verify", "Verify this order?");
    }

    if (cls.contains("cancel-btn")) {
      if (!hasPerm("orders:cancel"))
        return showToast("⛔ No permission to cancel order");
      return await handleLifecycle(id, "cancel", "Cancel this order?");
    }

    if (cls.contains("void-btn")) {
      if (!hasPerm("orders:void"))
        return showToast("⛔ No permission to void order");
      return await handleLifecycle(id, "void", "Void this order?");
    }
  }

  /* ============================================================
     ⚙️ HANDLERS
  ============================================================ */
  function handleView(entry) {
    const html = renderCard(entry, visibleFields, user);
    openViewModal("Order Info", html);
  }

  function handleEdit(entry) {
    if (currentEditIdRef) currentEditIdRef.value = entry.id;
    sessionStorage.setItem("orderEditId", entry.id);
    sessionStorage.setItem("orderEditPayload", JSON.stringify(entry));
    window.location.href = "add-order.html";
  }

  async function handleDelete(id, entry) {
    const confirmed = await showConfirm(
      `Delete order for patient "${entry?.patient?.first_name || ""}"?`
    );
    if (!confirmed) return;

    try {
      showLoading();
      const res = await authFetch(`/api/orders/${id}`, {
        method: "DELETE",
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok)
        throw new Error(data.message || "❌ Failed to delete order");

      showToast("✅ Order deleted");
      window.latestOrderEntries = [];
      await loadEntries(currentPage);
    } catch (err) {
      showToast(err.message || "❌ Failed to delete order");
    } finally {
      hideLoading();
    }
  }

  async function handleLifecycle(id, action, confirmMsg) {
    const confirmed = await showConfirm(confirmMsg);
    if (!confirmed) return;

    try {
      showLoading();
      const res = await authFetch(`/api/orders/${id}/${action}`, {
        method: "PATCH",
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok)
        throw new Error(data.message || `❌ Failed to ${action} order`);

      showToast(`✅ Order ${action} successful`);
      window.latestOrderEntries = [];
      await loadEntries(currentPage);
    } catch (err) {
      showToast(err.message || `❌ Failed to ${action} order`);
    } finally {
      hideLoading();
    }
  }

  /* ============================================================
     🌍 GLOBAL HELPERS
  ============================================================ */
  const findEntry = (id) =>
    (window.latestOrderEntries || entries || []).find(
      (x) => String(x.id) === String(id)
    );

  window.viewOrder = (id) => {
    if (!hasPerm("orders:view"))
      return showToast("⛔ No permission");
    const entry = findEntry(id);
    if (entry) handleView(entry);
  };

  window.editOrder = (id) => {
    if (!hasPerm("orders:edit"))
      return showToast("⛔ No permission");
    const entry = findEntry(id);
    if (entry) handleEdit(entry);
  };

  window.deleteOrder = async (id) => {
    if (!hasPerm("orders:delete"))
      return showToast("⛔ No permission");
    const entry = findEntry(id);
    await handleDelete(id, entry);
  };

  ["submit", "activate", "complete", "verify", "cancel", "void"].forEach(
    (action) => {
      window[`${action}Order`] = async (id) => {
        if (!hasPerm(`orders:${action}`))
          return showToast(`⛔ No permission`);
        await handleLifecycle(id, action, `Proceed to ${action} this order?`);
      };
    }
  );

  // Backward compatibility
  window.viewEntry = window.viewOrder;
  window.editEntry = window.editOrder;
  window.deleteEntry = window.deleteOrder;
}