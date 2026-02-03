// 📦 refund-actions.js – Enterprise MASTER–ALIGNED (Refund Module)
// ============================================================================
// 🔹 Parity Source: refund-deposits-actions.js (Enterprise MASTER)
// 🔹 Permission-driven + superadmin-aware (role + roleNames)
// 🔹 Unified lifecycle dispatcher (view / edit / delete / approve / process / reject / cancel / reverse / void / restore)
// 🔹 Safe fallback fetch (MASTER safety)
// 🔹 100% API preservation (NO endpoint changes)
// ============================================================================

import {
  showToast,
  showConfirm,
  openViewModal,
  showLoading,
  hideLoading,
} from "../../utils/index.js";
import { authFetch } from "../../authSession.js";
import { renderCard } from "./refund-render.js";

/**
 * Unified permission-aware action handler for Refund module
 */
export function setupRefundActionHandlers({
  entries,
  token,
  currentPage,
  loadEntries,
  visibleFields,
  sharedState,
  user,
}) {
  const { currentEditIdRef } = sharedState || {};
  const tableBody = document.getElementById("refundTableBody");
  const cardContainer = document.getElementById("refundList");
  const modalBody = document.getElementById("viewModalBody");

  // 🗂️ Cache latest entries (MASTER PATTERN)
  window.latestRefundEntries = entries;

  if (tableBody) tableBody.addEventListener("click", handleActions);
  if (cardContainer) cardContainer.addEventListener("click", handleActions);
  if (modalBody) modalBody.addEventListener("click", handleActions);

  /* ============================================================
     🔑 Normalize Permissions (MASTER PATTERN)
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
     🎯 Main Dispatcher (MASTER)
  ============================================================ */
  async function handleActions(e) {
    const btn = e.target.closest("button");
    if (!btn || !btn.dataset.id) return;

    const id = btn.dataset.id;
    let entry =
      (window.latestRefundEntries || entries || []).find(
        (x) => String(x.id) === String(id)
      ) || null;

    // 🩹 Fallback fetch (MASTER SAFETY)
    if (!entry) {
      try {
        showLoading();
        const res = await authFetch(`/api/refunds/${id}`);
        const data = await res.json().catch(() => ({}));
        entry = data?.data;
      } catch {
        return showToast("❌ Refund not found");
      } finally {
        hideLoading();
      }
    }

    if (!entry) return showToast("❌ Refund data missing");

    const cls = btn.classList;

    if (cls.contains("view-btn")) {
      if (!hasPerm("refunds:view"))
        return showToast("⛔ No permission to view refunds");
      return handleView(entry);
    }

    if (cls.contains("edit-btn")) {
      if (!hasPerm("refunds:edit") && !hasPerm("refunds:create"))
        return showToast("⛔ No permission to edit refunds");
      return handleEdit(entry);
    }

    if (cls.contains("delete-btn")) {
      if (!hasPerm("refunds:delete"))
        return showToast("⛔ No permission to delete refunds");
      return await handleDelete(id);
    }

    const lifecycleMap = {
      "approve-btn": "approve",
      "process-btn": "process",
      "reject-btn": "reject",
      "cancel-btn": "cancel",
      "reverse-btn": "reverse",
      "void-btn": "void",
      "restore-btn": "restore",
    };

    for (const [clsName, action] of Object.entries(lifecycleMap)) {
      if (cls.contains(clsName)) {
        if (!hasPerm(`refunds:${action}`))
          return showToast(`⛔ No permission to ${action} refunds`);

        if (["reject", "cancel", "void"].includes(action)) {
          return openReasonModal(entry, action);
        }

        return await handleLifecycle(id, action);
      }
    }
  }

  /* ============================================================
     ⚙️ Action Handlers
  ============================================================ */
  function handleView(entry) {
    openViewModal("Refund Info", renderCard(entry, visibleFields, user));
  }

  function handleEdit(entry) {
    if (currentEditIdRef) currentEditIdRef.value = entry.id;
    sessionStorage.setItem("refundEditId", entry.id);
    sessionStorage.setItem("refundEditPayload", JSON.stringify(entry));
    window.location.href = "add-refund.html";
  }

  async function handleDelete(id) {
    const confirmed = await showConfirm("Delete this refund?");
    if (!confirmed) return;

    try {
      showLoading();
      const res = await authFetch(`/api/refunds/${id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message);

      showToast("✅ Refund deleted successfully");
      window.latestRefundEntries = [];
      await loadEntries(currentPage || 1);
    } catch (err) {
      showToast(err.message || "❌ Failed to delete refund");
    } finally {
      hideLoading();
    }
  }

  async function handleLifecycle(id, action) {
    const confirmed = await showConfirm(`Proceed to ${action} this refund?`);
    if (!confirmed) return;

    try {
      showLoading();
      const res = await authFetch(`/api/refunds/${id}/${action}`, {
        method: "PATCH",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message);

      showToast(`✅ Refund ${action} successful`);
      window.latestRefundEntries = [];
      await loadEntries(currentPage || 1);
    } catch (err) {
      showToast(err.message || `❌ Failed to ${action} refund`);
    } finally {
      hideLoading();
    }
  }

  /* ============================================================
     🚫 REJECT / CANCEL / VOID — MODAL ONLY (FIX)
  ============================================================ */
  function openReasonModal(entry, action) {
    openViewModal(
      `${action.toUpperCase()} Refund`,
      `
        <div class="mb-3">
          <label class="form-label">Reason</label>
          <textarea
            id="refundReasonInput"
            class="form-control"
            rows="3"
            placeholder="Enter reason..."></textarea>
        </div>

        <div class="alert alert-danger small">
          This action cannot be undone.
        </div>

        <div class="d-flex justify-content-end gap-2 mt-3">
          <button class="btn btn-outline-secondary" id="cancelReasonBtn">
            Cancel
          </button>
          <button class="btn btn-danger" id="confirmReasonBtn">
            ${action.toUpperCase()}
          </button>
        </div>
      `
    );

    document
      .getElementById("cancelReasonBtn")
      ?.addEventListener("click", () => {
        document.getElementById("viewModal")?.classList.add("hidden");
      });

    document
      .getElementById("confirmReasonBtn")
      ?.addEventListener("click", async () => {
        const reason = document
          .getElementById("refundReasonInput")
          ?.value?.trim();

        if (!reason) return showToast("❌ Reason is required");

        try {
          showLoading();
          const res = await authFetch(
            `/api/refunds/${entry.id}/${action}`,
            {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ reason }),
            }
          );
          const data = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(data.message);

          document.getElementById("viewModal")?.classList.add("hidden");
          showToast(`✅ Refund ${action} successful`);
          window.latestRefundEntries = [];
          await loadEntries(currentPage || 1);
        } catch (err) {
          showToast(err.message || `❌ Failed to ${action} refund`);
        } finally {
          hideLoading();
        }
      });
  }

  /* ============================================================
     🌍 Global Helpers (MASTER + Backward Compatible)
  ============================================================ */
  const findEntry = (id) =>
    (window.latestRefundEntries || entries || []).find(
      (x) => String(x.id) === String(id)
    );

  window.viewRefund = (id) => {
    if (!hasPerm("refunds:view"))
      return showToast("⛔ No permission to view refunds");
    const entry = findEntry(id);
    if (entry) handleView(entry);
  };

  window.editRefund = (id) => {
    if (!hasPerm("refunds:edit") && !hasPerm("refunds:create"))
      return showToast("⛔ No permission to edit refunds");
    const entry = findEntry(id);
    if (entry) handleEdit(entry);
  };

  window.deleteRefund = async (id) => {
    if (!hasPerm("refunds:delete"))
      return showToast("⛔ No permission to delete refunds");
    await handleDelete(id);
  };

  ["approve", "process", "reject", "cancel", "reverse", "void", "restore"].forEach(
    (action) => {
      window[`${action}Refund`] = async (id) => {
        if (!hasPerm(`refunds:${action}`))
          return showToast(`⛔ No permission to ${action} refunds`);
        const entry = findEntry(id);
        if (!entry) return;
        if (["reject", "cancel", "void"].includes(action))
          return openReasonModal(entry, action);
        await handleLifecycle(id, action);
      };
    }
  );

  window.viewEntry = window.viewRefund;
  window.editEntry = window.editRefund;
  window.deleteEntry = window.deleteRefund;
}
