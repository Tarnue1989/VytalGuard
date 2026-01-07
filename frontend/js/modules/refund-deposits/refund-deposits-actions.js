// 📦 refund-deposits-actions.js – Enterprise Master Pattern (v3.2.1)
// ============================================================================
// 🔹 FIXED: Spinner deadlock (dispatcher no longer controls loading)
// 🔹 Matches working refund-actions.js behavior
// ============================================================================

import {
  showToast,
  showConfirm,
  openViewModal,
  showLoading,
  hideLoading,
} from "../../utils/index.js";
import { authFetch } from "../../authSession.js";
import { renderCard } from "./refund-deposits-render.js";

/* ============================================================================
   ⚙️ Main Setup
============================================================================ */
export function setupRefundDepositActionHandlers({
  entries,
  token,
  currentPage,
  loadEntries,
  visibleFields,
  sharedState,
  user,
}) {
  const { currentEditIdRef } = sharedState || {};

  const tableBody = document.getElementById("refundDepositTableBody");
  const cardContainer = document.getElementById("refundDepositList");
  const modalBody = document.getElementById("viewModalBody");

  window.latestRefundDepositEntries = entries;

  [tableBody, cardContainer, modalBody].forEach((el) =>
    el?.addEventListener("click", handleActions)
  );

  /* ============================================================================
     🔐 Permissions
  ============================================================================ */
  const normalizePermissions = (perms) => {
    if (!perms) return [];
    if (typeof perms === "string") {
      try { return JSON.parse(perms); } catch {}
      return perms.split(",").map(p => p.trim());
    }
    return Array.isArray(perms) ? perms : [];
  };

  const userPerms = new Set(
    normalizePermissions(user?.permissions || []).map(p => p.toLowerCase())
  );

  const isSuperAdmin =
    (user?.role || "").toLowerCase().replace(/\s+/g, "") === "superadmin";

  const hasPerm = (key) =>
    isSuperAdmin || userPerms.has(key.toLowerCase());

  /* ============================================================================
     🎛️ Action Dispatcher  (🔥 NO LOADING HERE)
  ============================================================================ */
  async function handleActions(e) {
    const btn = e.target.closest("button");
    if (!btn?.dataset.id) return;

    const id = btn.dataset.id;

    let entry = (window.latestRefundDepositEntries || entries)
      .find(x => String(x.id) === String(id));

    // 🔥 FIX: fallback fetch WITHOUT loader
    if (!entry) {
      try {
        const res = await authFetch(`/api/refund-deposits/${id}`);
        const data = await res.json().catch(() => ({}));
        entry = data?.data;
      } catch {
        return showToast("❌ Failed to load deposit refund");
      }
    }

    if (!entry) return showToast("❌ Deposit refund not found");

    const cls = btn.classList;

    /* VIEW */
    if (cls.contains("view-btn")) {
      if (!hasPerm("refund-deposits:view"))
        return showToast("⛔ No permission to view");
      return handleView(entry);
    }

    /* EDIT */
    if (cls.contains("edit-btn")) {
      if (!hasPerm("refund-deposits:edit") && !hasPerm("refund-deposits:create"))
        return showToast("⛔ No permission to edit");
      return handleEdit(entry);
    }

    /* DELETE */
    if (cls.contains("delete-btn")) {
      if (!hasPerm("refund-deposits:delete"))
        return showToast("⛔ No permission to delete");
      return handleDelete(id);
    }

    /* LIFECYCLE ACTION MAP */
    const actionMap = {
      "review-btn": "review",
      "approve-btn": "approve",
      "process-btn": "process",
      "reverse-btn": "reverse",
      "reject-btn": "reject",
      "cancel-btn": "cancel",
      "void-btn": "void",
      "restore-btn": "restore",
    };

    for (const clsName in actionMap) {
      if (cls.contains(clsName)) {
        const action = actionMap[clsName];

        if (!hasPerm(`refund-deposits:${action}`))
          return showToast(`⛔ No permission to ${action}`);

        if (action === "void") return handleVoid(entry);
        if (action === "reject" || action === "cancel")
          return handleReasonedLifecycle(entry, action);

        return handleLifecycle(id, action);
      }
    }
  }

  /* ============================================================================
     🧩 View
  ============================================================================ */
  function handleView(entry) {
    const html = renderCard(entry, visibleFields, user);
    openViewModal("Deposit Refund Details", html);
  }

  /* ============================================================================
     ✏️ Edit
  ============================================================================ */
  function handleEdit(entry) {
    currentEditIdRef && (currentEditIdRef.value = entry.id);
    sessionStorage.setItem("refundDepositEditId", entry.id);
    sessionStorage.setItem("refundDepositEditPayload", JSON.stringify(entry));
    window.location.href = "add-refund-deposit.html";
  }

  /* ============================================================================
     🗑️ Delete
  ============================================================================ */
  async function handleDelete(id) {
    if (!(await showConfirm("🗑️ Delete this deposit refund?"))) return;

    try {
      showLoading();
      const res = await authFetch(`/api/refund-deposits/${id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message);
      showToast("✅ Deleted");
      await loadEntries(1);
    } catch (err) {
      showToast(err.message || "❌ Delete failed");
    } finally {
      hideLoading();
    }
  }

  /* ============================================================================
     🔄 Simple lifecycle
  ============================================================================ */
  async function handleLifecycle(id, action) {
    if (!(await showConfirm(`Proceed to ${action} this deposit refund?`))) return;

    try {
      showLoading();
      const res = await authFetch(`/api/refund-deposits/${id}/${action}`, {
        method: "PATCH",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message);
      showToast(`✅ ${action} successful`);
      await loadEntries(1);
    } catch (err) {
      showToast(err.message || `❌ ${action} failed`);
    } finally {
      hideLoading();
    }
  }

  /* ============================================================================
     📝 Reject / Cancel
  ============================================================================ */
  async function handleReasonedLifecycle(entry, action) {
    const reason = prompt(`Enter reason to ${action}:`);
    if (!reason) return;

    try {
      showLoading();
      const res = await authFetch(
        `/api/refund-deposits/${entry.id}/${action}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason }),
        }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message);
      showToast(`✅ ${action} successful`);
      await loadEntries(1);
    } catch (err) {
      showToast(err.message || `❌ ${action} failed`);
    } finally {
      hideLoading();
    }
  }

  /* ============================================================================
     🚫 Void
  ============================================================================ */
  async function handleVoid(entry) {
    const reason = prompt("Enter void reason:");
    if (!reason) return;

    try {
      showLoading();
      const res = await authFetch(
        `/api/refund-deposits/${entry.id}/void`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason }),
        }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message);
      showToast("✅ Voided");
      await loadEntries(1);
    } catch (err) {
      showToast(err.message || "❌ Void failed");
    } finally {
      hideLoading();
    }
  }
}
