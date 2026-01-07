// 📦 payments-actions.js – Enterprise Master Pattern Aligned (Full Upgrade)
// ============================================================================
// 🔹 Unified with enterprise action handler (Deposit / Discount parity)
// 🔹 Preserves all working IDs, classNames, API endpoints, and DOM references
// 🔹 Adds RBAC, lifecycle actions, print support, modal helpers, and globals
// 🔹 Maintains superadmin → admin → staff visibility logic
// ============================================================================

import {
  showToast,
  showConfirm,
  showLoading,
  hideLoading,
  openViewModal,
} from "../../../utils/index.js";
import { authFetch } from "../../../authSession.js";
import { renderPaymentCard, renderPaymentDetail } from "./payments-render.js";
import { printPaymentReceipt } from "./payments-receipt.js"; // ✅ added enterprise print support
import { PAYMENT_METHODS } from "../../../utils/constants.js";

/* ============================================================
   ⚙️ Unified Payment Action Handler
============================================================ */
export function setupPaymentActionHandlers({
  entries,
  token,
  currentPage,
  loadEntries,
  visibleFields,
  sharedState,
  user,
}) {
  const tableBody = document.getElementById("paymentTableBody");
  const cardContainer = document.getElementById("paymentList");
  window.latestPaymentEntries = entries;

  if (tableBody) tableBody.addEventListener("click", handleActions);
  if (cardContainer) cardContainer.addEventListener("click", handleActions);

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

    // --- Toggle Status ---
    if (cls.contains("toggle-status-btn")) {
      if (!hasPerm("payments:toggle-status"))
        return showToast("⛔ No permission to toggle payments");
      return await handleLifecycle(id, entry, "toggle-status");
    }

    // --- Delete ---
    if (cls.contains("delete-btn")) {
      if (!hasPerm("payments:delete"))
        return showToast("⛔ No permission to delete payments");
      return await handleDelete(id);
    }

    // --- Reverse ---
    if (cls.contains("reverse-btn")) {
      if (!hasPerm("payments:reverse"))
        return showToast("⛔ No permission to reverse payments");
      return openModal("reverseModal", id, entry);
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
      : renderPaymentCard(entry, visibleFields, user);
    openViewModal("Payment Details", html);
  }
  /* ============================================================
     🔒 UI Guard: Prevent Overpayment via Status Toggle
     ------------------------------------------------------------
     - Blocks toggle-status when invoice balance is exhausted
     - Prevents unnecessary backend errors
     - Backend still enforces final safety
  ============================================================ */
  function canFinalizePayment(entry) {
    if (!entry?.invoice) return true;

    const invoiceBalance = Number(entry.invoice.balance ?? 0);
    const paymentAmount = Number(entry.amount ?? 0);

    // 🚫 No remaining balance
    if (invoiceBalance <= 0) {
      showToast("⚠️ Invoice is already fully paid");
      return false;
    }

    // 🚫 Would exceed remaining balance
    if (paymentAmount > invoiceBalance) {
      showToast(
        `⚠️ Payment (${paymentAmount}) exceeds remaining balance (${invoiceBalance})`
      );
      return false;
    }

    return true;
  }

  async function handleLifecycle(id, entry, action) {
    /* ------------------------------------------------------------
       🔒 UI Guard before lifecycle action
       Only applies to toggle-status (finalizing money)
    ------------------------------------------------------------ */
    if (action === "toggle-status") {
      if (!canFinalizePayment(entry)) return;
    }

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

  async function handleDelete(id) {
    const confirmed = await showConfirm("Delete this payment? (Admin only)");
    if (!confirmed) return;
    try {
      showLoading();
      const res = await authFetch(`/api/payments/${id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "❌ Failed to delete payment");
      showToast("✅ Payment deleted successfully");
      window.latestPaymentEntries = [];
      await loadEntries(currentPage);
    } catch (err) {
      showToast(err.message || "❌ Failed to delete payment");
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
  async function openModal(modalId, paymentId, entry) {
    const modal = document.getElementById(modalId);
    if (!modal) return;
    modal.classList.remove("hidden");
    modal.dataset.paymentId = paymentId;

    const form = modal.querySelector("form");
    if (form) form.reset();

    if (modalId === "paymentModal") {
      const select = document.getElementById("paymentMethod");
      if (select) {
        select.innerHTML = `<option value="">-- Choose Method --</option>`;
        PAYMENT_METHODS.forEach((m) => {
          const opt = document.createElement("option");
          opt.value = m;
          opt.textContent = m
            .replace(/_/g, " ")
            .replace(/\b\w/g, (c) => c.toUpperCase());
          select.appendChild(opt);
        });
      }
    }
  }

  function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (!modal) return;
    modal.classList.add("hidden");
    delete modal.dataset.paymentId;
    const form = modal.querySelector("form");
    if (form) form.reset();
  }

  document.querySelectorAll("[data-close]").forEach((btn) =>
    btn.addEventListener("click", () => closeModal(btn.dataset.close))
  );

  /* ============================================================
     🧾 Form Submissions (Enterprise Standard)
  ============================================================ */
  function bindFormOnce(formId, handler) {
    const form = document.getElementById(formId);
    if (form && !form.dataset.bound) {
      form.dataset.bound = "true";
      form.addEventListener("submit", handler);
    }
  }

  bindFormOnce("paymentForm", async (e) => {
    e.preventDefault();
    const modal = document.getElementById("paymentModal");
    const invoiceId = modal.dataset.invoiceId;
    const patientId = modal.dataset.patientId;
    const amount = document.getElementById("paymentAmount").value;
    const method = document.getElementById("paymentMethod").value;
    const ref = document.getElementById("paymentRef").value;

    await submitAction("/api/payments", {
      invoice_id: invoiceId,
      patient_id: patientId,
      amount: Number(amount),
      method,
      transaction_ref: ref,
    });
    closeModal("paymentModal");
  });

  bindFormOnce("reverseForm", async (e) => {
    e.preventDefault();
    const modal = document.getElementById("reverseModal");
    const id = modal.dataset.paymentId;
    const reason = document.getElementById("reverseReason").value;

    if (!id) return showToast("❌ Missing payment ID for reversal");
    await submitAction(`/api/payments/${id}/reverse`, { reason });
    closeModal("reverseModal");
  });

  async function submitAction(endpoint, payload) {
    try {
      showLoading();
      const res = await authFetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "❌ Failed");

      showToast(`✅ ${data.message || "Action successful"}`);
      window.latestPaymentEntries = [];
      await loadEntries(currentPage);
    } catch (err) {
      showToast(err.message || "❌ Failed to perform action");
    } finally {
      hideLoading();
    }
  }

  /* ============================================================
     🌐 Global Helpers (Enterprise Standard)
  ============================================================ */
  const findEntry = (id) =>
    (window.latestPaymentEntries || entries || []).find(
      (x) => String(x.id) === String(id)
    );

  window.viewPayment = (id) => {
    if (!hasPerm("payments:view"))
      return showToast("⛔ No permission to view payments");
    const entry = findEntry(id);
    entry ? handleView(entry) : showToast("❌ Payment not found");
  };

  window.togglePaymentStatus = (id) => {
    if (!hasPerm("payments:toggle-status"))
      return showToast("⛔ No permission to toggle payments");
    const entry = findEntry(id);
    entry ? handleLifecycle(id, entry, "toggle-status") : showToast("❌ Payment not found");
  };

  window.deletePayment = async (id) => {
    if (!hasPerm("payments:delete"))
      return showToast("⛔ No permission to delete payments");
    await handleDelete(id);
  };

  window.reversePayment = (id) => {
    if (!hasPerm("payments:reverse"))
      return showToast("⛔ No permission to reverse payments");
    openModal("reverseModal", id);
  };

  window.printPayment = (id) => {
    if (!hasPerm("payments:view"))
      return showToast("⛔ No permission to print payments");
    const entry = findEntry(id);
    entry ? handlePrint(entry) : showToast("❌ Payment not found");
  };
}
