// 📦 payment-actions.js – Enterprise Master Pattern Aligned
// ============================================================================
// 🔹 Mirrors deposit-actions.js for unified permission-driven flow
// 🔹 Preserves all payment-specific lifecycle & print logic
// 🔹 Adds RBAC, superadmin bypass, global helpers, modal utilities
// 🔹 Supports: toggle, cancel, verify, reverse, void, restore, complete
// ============================================================================

import {
  showToast,
  showConfirm,
  openViewModal,
  showLoading,
  hideLoading,
} from "../../utils/index.js";
import { authFetch } from "../../authSession.js";
import { renderCard, renderPaymentDetail } from "./payment-render.js";
import { printPaymentReceipt } from "./payment-receipt.js";

/* ============================================================
   ⚙️ Unified Action Handler – Payment Module
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
  const tableBody = document.getElementById("paymentTableBody");
  const cardContainer = document.getElementById("paymentList");
  const modalBody = document.getElementById("viewModalBody");
  window.latestPaymentEntries = entries;

  if (tableBody) tableBody.addEventListener("click", handleActions);
  if (cardContainer) cardContainer.addEventListener("click", handleActions);
  if (modalBody) modalBody.addEventListener("click", handleActions);

  /* ============================================================
     🔐 Permission + Role Normalization
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
  const isSuperAdmin =
    (user?.role || "").toLowerCase().replace(/\s+/g, "") === "superadmin";
  const hasPerm = (key) =>
    isSuperAdmin || userPerms.has(key.trim().toLowerCase());

  /* ============================================================
     🎛️ Main Action Dispatcher
  ============================================================ */
  async function handleActions(e) {
    const btn = e.target.closest("button");
    if (!btn || !btn.dataset.id) return;
    const id = btn.dataset.id;

    let entry =
      (window.latestPaymentEntries || entries || []).find(
        (x) => String(x.id) === String(id)
      ) || null;
    if (!entry) {
      try {
        showLoading();
        const res = await authFetch(`/api/payments/${id}`);
        const data = await res.json().catch(() => ({}));
        entry = data?.data;
      } catch {
        return showToast("❌ Payment not found");
      } finally {
        hideLoading();
      }
    }
    if (!entry) return showToast("❌ Payment data missing");
    const cls = btn.classList;

    // --- View ---
    if (cls.contains("view-btn")) {
      if (!hasPerm("payments:view"))
        return showToast("⛔ No permission to view payments");
      return handleView(entry);
    }

    // --- Edit ---
    if (cls.contains("edit-btn")) {
      if (!hasPerm("payments:edit") && !hasPerm("payments:create"))
        return showToast("⛔ No permission to edit payments");
      return handleEdit(entry);
    }

    // --- Delete ---
    if (cls.contains("delete-btn")) {
      if (!hasPerm("payments:delete"))
        return showToast("⛔ No permission to delete payments");
      return await handleDelete(id);
    }

    // --- Lifecycle ---
    const lifecycleMap = {
      "toggle-status-btn": "toggle-status",
      "complete-btn": "complete",
      "cancel-btn": "cancel",
      "verify-btn": "verify",
      "reverse-btn": "reverse",
      "void-btn": "void",
      "restore-btn": "restore",
    };
    for (const [clsName, action] of Object.entries(lifecycleMap)) {
      if (cls.contains(clsName)) {
        if (!hasPerm(`payments:${action}`) && !hasPerm("payments:edit"))
          return showToast(`⛔ No permission to ${action} payments`);
        return await handleLifecycle(id, entry, action);
      }
    }

    // --- Print ---
    if (cls.contains("print-btn")) {
      if (!hasPerm("payments:view"))
        return showToast("⛔ No permission to print payments");
      return handlePrint(entry);
    }
  }

  /* ============================================================
     🧩 Handlers
  ============================================================ */
  function handleView(entry) {
    const html = renderPaymentDetail
      ? renderPaymentDetail(entry, user)
      : renderCard(entry, visibleFields, user);
    openViewModal("Payment Info", html);
  }

  function handleEdit(entry) {
    if (currentEditIdRef) currentEditIdRef.value = entry.id;
    sessionStorage.setItem("paymentEditId", entry.id);
    sessionStorage.setItem("paymentEditPayload", JSON.stringify(entry));
    window.location.href = "add-payment.html";
  }

  async function handleDelete(id) {
    const confirmed = await showConfirm("Delete this payment?");
    if (!confirmed) return;
    try {
      showLoading();
      const res = await authFetch(`/api/payments/${id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "❌ Failed to delete");
      showToast("✅ Payment deleted successfully");
      window.latestPaymentEntries = [];
      await loadEntries(currentPage);
    } catch (err) {
      showToast(err.message || "❌ Failed to delete payment");
    } finally {
      hideLoading();
    }
  }

  async function handleLifecycle(id, entry, action) {
    const confirmed = await showConfirm(`Proceed to ${action} this payment?`);
    if (!confirmed) return;
    const url =
      action === "toggle-status"
        ? `/api/payments/${id}/toggle-status`
        : `/api/payments/${id}/${action}`;
    try {
      showLoading();
      const res = await authFetch(url, { method: "PATCH" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || `❌ Failed to ${action}`);
      showToast(`✅ Payment ${action} successful`);
      window.latestPaymentEntries = [];
      await loadEntries(currentPage);
    } catch (err) {
      showToast(err.message || `❌ Failed to ${action}`);
    } finally {
      hideLoading();
    }
  }

  function handlePrint(entry) {
    try {
      printPaymentReceipt(entry);
      showToast("🖨️ Printing payment receipt...");
    } catch {
      showToast("❌ Failed to print payment receipt");
    }
  }

  /* ============================================================
     🪟 Modal Helpers
  ============================================================ */
  function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.remove("hidden");
  }
  function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.classList.add("hidden");
      const form = modal.querySelector("form");
      if (form) form.reset();
    }
  }

  /* ============================================================
     🌐 Global Helpers (Enterprise Standard)
  ============================================================ */
  const findEntry = (id) =>
    (window.latestPaymentEntries || entries || []).find(
      (x) => String(x.id) === String(id)
    );

  window.viewEntry = (id) => {
    if (!hasPerm("payments:view"))
      return showToast("⛔ No permission to view payments");
    const entry = findEntry(id);
    entry ? handleView(entry) : showToast("❌ Payment not found");
  };

  window.editEntry = (id) => {
    if (!hasPerm("payments:edit") && !hasPerm("payments:create"))
      return showToast("⛔ No permission to edit payments");
    const entry = findEntry(id);
    entry ? handleEdit(entry) : showToast("❌ Payment not found");
  };

  window.deleteEntry = async (id) => {
    if (!hasPerm("payments:delete"))
      return showToast("⛔ No permission to delete payments");
    await handleDelete(id);
  };

  ["toggle-status", "complete", "cancel", "verify", "reverse", "void", "restore"].forEach(
    (action) => {
      window[`${action}Payment`] = async (id) => {
        if (!hasPerm(`payments:${action}`) && !hasPerm("payments:edit"))
          return showToast(`⛔ No permission to ${action} payments`);
        const entry = findEntry(id);
        await handleLifecycle(id, entry, action);
      };
    }
  );

  window.printPayment = (id) => {
    if (!hasPerm("payments:view"))
      return showToast("⛔ No permission to print payments");
    const entry = findEntry(id);
    entry ? handlePrint(entry) : showToast("❌ Payment not found");
  };

  document.querySelectorAll("[data-close]").forEach((btn) =>
    btn.addEventListener("click", () => closeModal(btn.dataset.close))
  );
}
