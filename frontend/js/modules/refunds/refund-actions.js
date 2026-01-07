// 📦 refund-actions.js – Enterprise Master Pattern (v2.4 Modal Void Reason)
// ============================================================================
// 🔹 Mirrors deposit-actions.js & discount-actions.js for unified flow
// 🔹 Adds modal-based void reason (no browser prompt)
// 🔹 Handles lifecycle: approve, reject, process, cancel, reverse, void, restore
// 🔹 Includes full permission checks, superadmin bypass, and live refresh
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

/* ============================================================
   ⚙️ Unified Action Handler – Refund Module
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
  const tableBody = document.getElementById("refundTableBody");
  const cardContainer = document.getElementById("refundList");
  const modalBody = document.getElementById("viewModalBody");

  // 🗂️ Cache latest entries
  window.latestRefundEntries = entries;
  [tableBody, cardContainer, modalBody].forEach((el) =>
    el?.addEventListener("click", handleActions)
  );

  /* ============================================================
     🔐 Permission Normalization
  ============================================================ */
  const normalizePermissions = (perms) => {
    if (!perms) return [];
    if (typeof perms === "string") {
      try {
        return JSON.parse(perms);
      } catch {
        return perms.split(",").map((p) => p.trim());
      }
    }
    return Array.isArray(perms) ? perms : [];
  };

  const userPerms = new Set(normalizePermissions(user?.permissions || []));
  const isSuperAdmin =
    (user?.role || "").toLowerCase().replace(/\s+/g, "") === "superadmin";
  const hasPerm = (key) =>
    isSuperAdmin || userPerms.has(key.trim().toLowerCase());

  /* ============================================================
     🎛️ Main Action Dispatcher
  ============================================================ */
  async function handleActions(e) {
    const btn = e.target.closest("button");
    if (!btn?.dataset.id) return;
    const id = btn.dataset.id;

    let entry =
      (window.latestRefundEntries || entries || []).find(
        (x) => String(x.id) === String(id)
      ) || null;

    // 🔄 fallback fetch
    if (!entry) {
      try {
        showLoading();
        const res = await authFetch(`/api/refunds/${id}`);
        const data = await res.json().catch(() => ({}));
        entry = data?.data;
      } finally {
        hideLoading();
      }
    }

    if (!entry) return showToast("❌ Refund not found");
    const cls = btn.classList;

    // --- View ---
    if (cls.contains("view-btn")) {
      if (!hasPerm("refunds:view"))
        return showToast("⛔ No permission to view refunds");
      return handleView(entry);
    }

    // --- Edit ---
    if (cls.contains("edit-btn")) {
      if (!hasPerm("refunds:edit") && !hasPerm("refunds:create"))
        return showToast("⛔ No permission to edit refunds");
      return handleEdit(entry);
    }

    // --- Delete ---
    if (cls.contains("delete-btn")) {
      if (!hasPerm("refunds:delete"))
        return showToast("⛔ No permission to delete refunds");
      return await handleDelete(id);
    }

    // --- Lifecycle Actions ---
    const lifecycleMap = {
      "approve-btn": "approve",
      "reject-btn": "reject",
      "cancel-btn": "cancel",
      "process-btn": "process",
      "reverse-btn": "reverse",
      "void-btn": "void",
      "restore-btn": "restore",
    };

    for (const [clsName, action] of Object.entries(lifecycleMap)) {
      if (cls.contains(clsName)) {
        if (!hasPerm(`refunds:${action}`) && !hasPerm("refunds:edit"))
          return showToast(`⛔ No permission to ${action} refunds`);
        if (action === "void") return await handleVoid(entry);
        return await handleLifecycle(id, entry, action);
      }
    }
  }

  /* ============================================================
     🧩 Core Action Handlers
  ============================================================ */
  function handleView(entry) {
    const html = renderCard(entry, visibleFields, user);
    openViewModal("Refund Info", html);
  }

  function handleEdit(entry) {
    if (currentEditIdRef) currentEditIdRef.value = entry.id;
    sessionStorage.setItem("refundEditId", entry.id);
    sessionStorage.setItem("refundEditPayload", JSON.stringify(entry));
    window.location.href = "add-refund.html";
  }

  async function handleDelete(id) {
    const confirmed = await showConfirm("🗑️ Delete this refund?");
    if (!confirmed) return;
    try {
      showLoading();
      const res = await authFetch(`/api/refunds/${id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok)
        throw new Error(data.message || "❌ Failed to delete refund");
      showToast("✅ Refund deleted successfully");
      await loadEntries(1);
    } catch (err) {
      showToast(err.message || "❌ Failed to delete refund");
    } finally {
      hideLoading();
    }
  }

  /* ============================================================
     🔄 Lifecycle Handler (approve/reject/process/cancel/reverse/restore)
  ============================================================ */
  async function handleLifecycle(id, entry, action) {
    const confirmMsg =
      action === "restore"
        ? "♻️ Restore this refund?"
        : `Proceed to ${action} this refund?`;
    const confirmed = await showConfirm(confirmMsg);
    if (!confirmed) return;

    const url = `/api/refunds/${id}/${action}`;
    try {
      showLoading();
      const res = await authFetch(url, { method: "PATCH" });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) throw new Error(data.message || `❌ Failed to ${action}`);
      showToast(`✅ Refund ${action} successful`);
      await loadEntries(1);
    } catch (err) {
      showToast(err.message || `❌ Failed to ${action} refund`);
    } finally {
      hideLoading();
    }
  }

  /* ============================================================
     🚫 Void Handler (Modal-Based)
  ============================================================ */
  async function handleVoid(entry) {
    const id = entry.id;
    const status = (entry?.status || "").toLowerCase();
    if (status === "voided") return showToast("❌ Already voided");

    const modal = document.getElementById("refundVoidModal");
    const reasonInput = document.getElementById("refundVoidReasonInput");
    const confirmBtn = document.getElementById("confirmRefundVoidBtn");

    reasonInput.value = "";
    modal.classList.remove("hidden");

    confirmBtn.onclick = async () => {
      const reason = reasonInput.value.trim();
      if (!reason) return showToast("❌ Reason is required to void refund");

      const confirmed = await showConfirm("⚠️ Confirm voiding this refund?");
      if (!confirmed) return;

      try {
        showLoading();
        const res = await authFetch(`/api/refunds/${id}/void`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok)
          throw new Error(data.message || "❌ Failed to void refund");

        showToast("✅ Refund voided successfully");
        modal.classList.add("hidden");
        await loadEntries(1);
      } catch (err) {
        showToast(err.message || "❌ Failed to void refund");
      } finally {
        hideLoading();
      }
    };
  }

  /* ============================================================
     🌐 Global Helpers
  ============================================================ */
  const findEntry = (id) =>
    (window.latestRefundEntries || entries || []).find(
      (x) => String(x.id) === String(id)
    );

  ["approve", "reject", "cancel", "process", "reverse", "void", "restore"].forEach(
    (action) => {
      window[`${action}Refund`] = async (id) => {
        if (!hasPerm(`refunds:${action}`) && !hasPerm("refunds:edit"))
          return showToast(`⛔ No permission to ${action} refunds`);
        const entry = findEntry(id);
        if (action === "void") return await handleVoid(entry);
        await handleLifecycle(id, entry, action);
      };
    }
  );

  // 🔹 Universal modal close
  document.querySelectorAll("[data-close]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.close;
      document.getElementById(id)?.classList.add("hidden");
    });
  });
}
