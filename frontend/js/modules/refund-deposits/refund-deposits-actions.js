// 📦 refund-deposits-actions.js – Enterprise MASTER–ALIGNED (Consultation Parity)
// ============================================================================
// 🔹 Pattern Source: deposit-actions.js / refund-actions.js (Enterprise MASTER)
// 🔹 Permission-driven + superadmin-aware (role + roleNames)
// 🔹 Unified lifecycle dispatcher (view / edit / delete / review / approve / process / reject / cancel / reverse / void / restore)
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
import { renderCard } from "./refund-deposits-render.js";
import { printRefundDepositReceipt } from "./refund-deposits-receipt.js";

/* ============================================================
   🛡️ EVENT BIND GUARD (CRITICAL FIX)
============================================================ */
let refundDepositHandlersBound = false;

/**
 * Unified permission-aware action handler for Refund Deposit module
 */
export function setupRefundDepositActionHandlers({
  entries,
  token,
  currentPage,
  loadEntries,
  visibleFields,
  sharedState,
  user,
}) {
  if (refundDepositHandlersBound) return;
  refundDepositHandlersBound = true;

  const { currentEditIdRef } = sharedState || {};
  const tableBody = document.getElementById("refundDepositTableBody");
  const cardContainer = document.getElementById("refundDepositList");
  const modalBody = document.getElementById("viewModalBody");

  window.latestRefundDepositEntries = entries;

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
     🎯 Main Dispatcher
  ============================================================ */
  async function handleActions(e) {
    const btn = e.target.closest("button");
    if (!btn || !btn.dataset.id) return;

    const id = btn.dataset.id;
    let entry =
      (window.latestRefundDepositEntries || entries || []).find(
        (x) => String(x.id) === String(id)
      ) || null;

    if (!entry) {
      try {
        showLoading();
        const res = await authFetch(`/api/refund-deposits/${id}`);
        const data = await res.json().catch(() => ({}));
        entry = data?.data;
      } catch {
        return showToast("❌ Deposit refund not found");
      } finally {
        hideLoading();
      }
    }

    if (!entry) return showToast("❌ Deposit refund data missing");

    const cls = btn.classList;

    if (cls.contains("print-btn")) {
      if (!hasPerm("refund-deposits:print"))
        return showToast("⛔ No permission to print refund deposits");
      return handlePrint(entry);
    }

    if (cls.contains("view-btn")) {
      if (!hasPerm("refund-deposits:view"))
        return showToast("⛔ No permission to view refund deposits");
      return handleView(entry);
    }

    if (cls.contains("edit-btn")) {
      if (
        !hasPerm("refund-deposits:edit") &&
        !hasPerm("refund-deposits:create")
      )
        return showToast("⛔ No permission to edit refund deposits");
      return handleEdit(entry);
    }

    if (cls.contains("delete-btn")) {
      if (!hasPerm("refund-deposits:delete"))
        return showToast("⛔ No permission to delete refund deposits");
      return await handleDelete(id);
    }

    const lifecycleMap = {
      "review-btn": "review",
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
        if (!hasPerm(`refund-deposits:${action}`))
          return showToast(`⛔ No permission to ${action} refund deposits`);

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
    const html = renderCard(entry, visibleFields, user);
    openViewModal("Deposit Refund Info", html);
  }

  function handleEdit(entry) {
    if (currentEditIdRef) currentEditIdRef.value = entry.id;
    sessionStorage.setItem("refundDepositEditId", entry.id);
    sessionStorage.setItem(
      "refundDepositEditPayload",
      JSON.stringify(entry)
    );
    window.location.href = "add-refund-deposit.html";
  }

  async function handleDelete(id) {
    const confirmed = await showConfirm("Delete this deposit refund?");
    if (!confirmed) return;

    try {
      showLoading();
      const res = await authFetch(`/api/refund-deposits/${id}`, {
        method: "DELETE",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok)
        throw new Error(data.message || "❌ Failed to delete deposit refund");

      showToast("✅ Deposit refund deleted successfully");
      window.latestRefundDepositEntries = [];
      await loadEntries(currentPage || 1);
    } catch (err) {
      showToast(err.message || "❌ Failed to delete deposit refund");
    } finally {
      hideLoading();
    }
  }
  
  if (cls.contains("print-btn")) {
    if (!hasPerm("refund-deposits:print"))
      return showToast("⛔ No permission to print refund deposits");
    return handlePrint(entry);
  }
  async function handleLifecycle(id, action) {
    const confirmed = await showConfirm(
      `Proceed to ${action} this deposit refund?`
    );
    if (!confirmed) return;

    try {
      showLoading();
      const res = await authFetch(
        `/api/refund-deposits/${id}/${action}`,
        { method: "PATCH" }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok)
        throw new Error(
          data.message || `❌ Failed to ${action} deposit refund`
        );

      showToast(`✅ Deposit refund ${action} successful`);
      window.latestRefundDepositEntries = [];
      await loadEntries(currentPage || 1);
    } catch (err) {
      showToast(err.message || `❌ Failed to ${action} deposit refund`);
    } finally {
      hideLoading();
    }
  }

  /* ============================================================
    🚫 REJECT / CANCEL / VOID — MODAL ONLY (FIX)
  ============================================================ */
  function openReasonModal(entry, action) {
    openViewModal(
      `${action.toUpperCase()} Deposit Refund`,
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

    // Cancel → just close modal
    document
      .getElementById("cancelReasonBtn")
      ?.addEventListener("click", () => {
        document.getElementById("viewModal")?.classList.add("hidden");
      });

    // Confirm → validate reason, call API, close modal
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
            `/api/refund-deposits/${entry.id}/${action}`,
            {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ reason }),
            }
          );

          const data = await res.json().catch(() => ({}));
          if (!res.ok)
            throw new Error(
              data.message || `❌ Failed to ${action} deposit refund`
            );

          document.getElementById("viewModal")?.classList.add("hidden");
          showToast(`✅ Deposit refund ${action} successful`);
          window.latestRefundDepositEntries = [];
          await loadEntries(currentPage || 1);
        } catch (err) {
          showToast(err.message || `❌ Failed to ${action} deposit refund`);
        } finally {
          hideLoading();
        }
      });
  }

  /* ============================================================
     🌍 Global Helpers (MASTER + Backward Compatible)
  ============================================================ */
  const findEntry = (id) =>
    (window.latestRefundDepositEntries || entries || []).find(
      (x) => String(x.id) === String(id)
    );

  window.viewRefundDeposit = (id) => {
    if (!hasPerm("refund-deposits:view"))
      return showToast("⛔ No permission to view refund deposits");
    const entry = findEntry(id);
    if (entry) handleView(entry);
  };

  window.editRefundDeposit = (id) => {
    if (
      !hasPerm("refund-deposits:edit") &&
      !hasPerm("refund-deposits:create")
    )
      return showToast("⛔ No permission to edit refund deposits");
    const entry = findEntry(id);
    if (entry) handleEdit(entry);
  };

  window.deleteRefundDeposit = async (id) => {
    if (!hasPerm("refund-deposits:delete"))
      return showToast("⛔ No permission to delete refund deposits");
    await handleDelete(id);
  };
  window.printRefundDeposit = (id) => {
    if (!hasPerm("refund-deposits:print"))
      return showToast("⛔ No permission to print refund deposits");

    const entry = findEntry(id);
    if (entry) handlePrint(entry);
  }; 

  [
    "review",
    "approve",
    "process",
    "reject",
    "cancel",
    "reverse",
    "void",
    "restore",
  ].forEach((action) => {
    window[`${action}RefundDeposit`] = async (id) => {
      if (!hasPerm(`refund-deposits:${action}`))
        return showToast(`⛔ No permission to ${action} refund deposits`);
      const entry = findEntry(id);
      if (!entry) return;
      if (["reject", "cancel", "void"].includes(action))
        return openReasonModal(entry, action);
      await handleLifecycle(id, action);
    };
  });

  window.viewEntry = window.viewRefundDeposit;
  window.editEntry = window.editRefundDeposit;
  window.deleteEntry = window.deleteRefundDeposit;
}
