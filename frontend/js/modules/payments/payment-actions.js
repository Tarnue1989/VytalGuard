// 📦 payment-actions.js – Enterprise MASTER–ALIGNED (Deposit Parity)
// ============================================================================
// 🔹 Pattern Source: deposit-actions.js (Enterprise Master)
// 🔹 Permission-driven + superadmin-aware (role + roleNames)
// 🔹 Unified lifecycle dispatcher (view / edit / delete / toggle / cancel / verify / reverse / void / restore / complete)
// 🔹 Safe fallback fetch preserved
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
import { renderCard, renderPaymentDetail } from "./payment-render.js";
import { printPaymentReceipt } from "./payment-receipt.js";

/**
 * Unified permission-aware action handler for Payment module
 */
export function setupActionHandlers({
  entries,
  token,
  currentPage,
  loadEntries,
  visibleFields,
  sharedState,
  user, // { role, roleNames, permissions }
}) {
  const { currentEditIdRef } = sharedState || {};
  const tableBody = document.getElementById("paymentTableBody");
  const cardContainer = document.getElementById("paymentList");
  const modalBody = document.getElementById("viewModalBody");

  // 🗂️ Cache latest entries (MASTER PATTERN)
  window.latestPaymentEntries = entries;

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

  // 🧠 Superadmin bypass (role OR roleNames)
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
      (window.latestPaymentEntries || entries || []).find(
        (x) => String(x.id) === String(id)
      ) || null;

    // 🩹 Fallback fetch (MASTER SAFETY)
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

    if (cls.contains("view-btn")) {
      if (!hasPerm("payments:view"))
        return showToast("⛔ No permission to view payments");
      return handleView(entry);
    }

    if (cls.contains("edit-btn")) {
      if (!hasPerm("payments:edit") && !hasPerm("payments:create"))
        return showToast("⛔ No permission to edit payments");
      return handleEdit(entry);
    }

    if (cls.contains("delete-btn")) {
      if (!hasPerm("payments:delete"))
        return showToast("⛔ No permission to delete payments");
      return await handleDelete(id);
    }

    // 🔄 Lifecycle map (MASTER STYLE)
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
        return await handleLifecycle(id, action);
      }
    }

    if (cls.contains("print-btn")) {
      if (!hasPerm("payments:view"))
        return showToast("⛔ No permission to print payments");
      return handlePrint(entry);
    }
  }

  /* ============================================================
     ⚙️ Action Handlers
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
      const res = await authFetch(`/api/payments/${id}`, {
        method: "DELETE",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok)
        throw new Error(data.message || "❌ Failed to delete payment");

      showToast("✅ Payment deleted successfully");
      window.latestPaymentEntries = [];
      await loadEntries(currentPage);
    } catch (err) {
      showToast(err.message || "❌ Failed to delete payment");
    } finally {
      hideLoading();
    }
  }

  async function handleLifecycle(id, action) {
    const confirmed = await showConfirm(
      `Proceed to ${action} this payment?`
    );
    if (!confirmed) return;

    const url =
      action === "toggle-status"
        ? `/api/payments/${id}/toggle-status`
        : `/api/payments/${id}/${action}`;

    try {
      showLoading();
      const res = await authFetch(url, { method: "PATCH" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok)
        throw new Error(data.message || `❌ Failed to ${action} payment`);

      showToast(`✅ Payment ${action} successful`);
      window.latestPaymentEntries = [];
      await loadEntries(currentPage);
    } catch (err) {
      showToast(err.message || `❌ Failed to ${action} payment`);
    } finally {
      hideLoading();
    }
  }

  /* ============================================================
     🖨️ Print
  ============================================================ */
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
  function openModal(id) {
    const m = document.getElementById(id);
    if (m) m.classList.remove("hidden");
  }

  function closeModal(id) {
    const m = document.getElementById(id);
    if (m) {
      m.classList.add("hidden");
      const f = m.querySelector("form");
      if (f) f.reset();
    }
  }

  /* ============================================================
     🌍 Global Helpers (MASTER + Backward Compatible)
  ============================================================ */
  const findEntry = (id) =>
    (window.latestPaymentEntries || entries || []).find(
      (x) => String(x.id) === String(id)
    );

  window.viewPayment = (id) => {
    if (!hasPerm("payments:view"))
      return showToast("⛔ No permission to view payments");
    const entry = findEntry(id);
    if (entry) handleView(entry);
  };

  window.editPayment = (id) => {
    if (!hasPerm("payments:edit") && !hasPerm("payments:create"))
      return showToast("⛔ No permission to edit payments");
    const entry = findEntry(id);
    if (entry) handleEdit(entry);
  };

  window.deletePayment = async (id) => {
    if (!hasPerm("payments:delete"))
      return showToast("⛔ No permission to delete payments");
    await handleDelete(id);
  };

  [
    "toggle-status",
    "complete",
    "cancel",
    "verify",
    "reverse",
    "void",
    "restore",
  ].forEach((action) => {
    window[`${action}Payment`] = async (id) => {
      if (!hasPerm(`payments:${action}`) && !hasPerm("payments:edit"))
        return showToast(`⛔ No permission to ${action} payments`);
      await handleLifecycle(id, action);
    };
  });

  window.printPayment = (id) => {
    if (!hasPerm("payments:view"))
      return showToast("⛔ No permission to print payments");
    const entry = findEntry(id);
    if (entry) handlePrint(entry);
  };

  // 🔹 Backward compatibility
  window.viewEntry = window.viewPayment;
  window.editEntry = window.editPayment;
  window.deleteEntry = window.deletePayment;

  // 🔹 Close modal buttons
  document.querySelectorAll("[data-close]").forEach((btn) => {
    btn.addEventListener("click", () => closeModal(btn.dataset.close));
  });
}
