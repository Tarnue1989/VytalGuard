// 📦 invoice-actions.js – Enterprise Master Pattern Aligned
// ============================================================================
// 🔹 Mirrors payment-actions.js for unified RBAC, lifecycle, and modal flow
// 🔹 Preserves all invoice-specific actions (payment, refund, deposit, waiver, reverse)
// 🔹 Adds superadmin bypass + permission normalization
// 🔹 Supports: view, toggle, delete, financial modals, print
// ============================================================================

import {
  showToast,
  showConfirm,
  showLoading,
  hideLoading,
  openViewModal,
} from "../../../utils/index.js";
import { authFetch } from "../../../authSession.js";
import { renderCard, renderInvoiceDetail } from "./invoice-render.js";
import { printInvoiceReceipt } from "./invoice-receipt.js";
import {
  PAYMENT_METHODS,
  DISCOUNT_TYPE,
  REVERSE_TYPES,
} from "../../../utils/constants.js";

/* ============================================================
   ⚙️ Unified Action Handler – Invoice Module
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
  const tableBody = document.getElementById("invoiceTableBody");
  const cardContainer = document.getElementById("invoiceList");
  const modalBody = document.getElementById("viewModalBody");
  window.latestInvoiceEntries = entries;

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
    🎛️ Main Action Dispatcher (FIXED – data-action based)
  ============================================================ */
  async function handleActions(e) {
    const btn = e.target.closest("button");
    if (!btn || !btn.dataset.id) return;

    const id = btn.dataset.id;
    const action = btn.dataset.action;

    let entry =
      (window.latestInvoiceEntries || entries || []).find(
        (x) => String(x.id) === String(id) || String(x.invoice_id) === String(id)
      ) || null;

    // 🔹 Fallback fetch
    if (!entry) {
      try {
        showLoading();
        const res = await authFetch(`/api/invoices/${id}`);
        const data = await res.json().catch(() => ({}));
        entry = data?.data;
      } catch {
        return showToast("❌ Invoice not found");
      } finally {
        hideLoading();
      }
    }
    if (!entry) return showToast("❌ Invoice data missing");

    /* =========================
      👁️ View
    ========================= */
    if (action === "view") {
      if (!hasPerm("invoices:view"))
        return showToast("⛔ No permission to view invoices");
      return handleView(entry);
    }

    /* =========================
      🗑️ Delete
    ========================= */
    if (action === "delete") {
      if (!hasPerm("invoices:delete"))
        return showToast("⛔ No permission to delete invoices");
      return await handleDelete(id);
    }

    /* =========================
      🔁 Toggle Status
    ========================= */
    if (action === "toggle-status") {
      if (!hasPerm("invoices:toggle-status") && !hasPerm("invoices:edit"))
        return showToast("⛔ No permission to toggle invoices");
      return await handleToggleStatus(id, entry);
    }

    /* =========================
      💰 Financial Modals
    ========================= */
    const actionModalMap = {
      collect: "paymentModal",   // 👈 COLLECT → PAYMENT
      refund: "refundModal",
      deposit: "depositModal",
      waiver: "waiverModal",
      reverse: "reverseModal",
    };

    if (actionModalMap[action]) {
      if (!hasPerm(`invoices:${action}`))
        return showToast(`⛔ No permission to ${action} invoices`);

      const extra = {
        transId: btn.dataset.transId || "",
        type: btn.dataset.type || "",
      };

      return openModal(actionModalMap[action], id, entry, extra);
    }

    /* =========================
      🖨️ Print
    ========================= */
    if (action === "print") {
      if (!hasPerm("invoices:view"))
        return showToast("⛔ No permission to print invoices");
      return handlePrint(entry);
    }
  }


  /* ============================================================
     🧩 Handlers
  ============================================================ */
  function handleView(entry) {
    const html = renderInvoiceDetail
      ? renderInvoiceDetail(entry, user)
      : renderCard(entry, visibleFields, user);
    openViewModal("Invoice Details", html);
  }

  async function handleToggleStatus(id, entry) {
    const status = (entry.status || "").toLowerCase();
    const confirmed = await showConfirm(
      `Toggle status for this invoice? (Currently: ${status})`
    );
    if (!confirmed) return;
    try {
      showLoading();
      const res = await authFetch(`/api/invoices/${id}/toggle-status`, {
        method: "PATCH",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "❌ Failed to toggle status");
      showToast(`✅ Invoice status updated to ${data?.data?.status || "unknown"}`);
      window.latestInvoiceEntries = [];
      await loadEntries(currentPage);
    } catch (err) {
      showToast(err.message || "❌ Failed to update invoice status");
    } finally {
      hideLoading();
    }
  }

  async function handleDelete(id) {
    const confirmed = await showConfirm("Delete this invoice?");
    if (!confirmed) return;
    try {
      showLoading();
      const res = await authFetch(`/api/invoices/${id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "❌ Failed to delete invoice");
      showToast("✅ Invoice deleted successfully");
      window.latestInvoiceEntries = [];
      await loadEntries(currentPage);
    } catch (err) {
      showToast(err.message || "❌ Failed to delete invoice");
    } finally {
      hideLoading();
    }
  }

  async function handlePrint(entry) {
    if (!entry?.id) return showToast("❌ Invalid invoice");

    try {
      showLoading();

      // 🔥 CRITICAL: fetch full invoice for print (controller fix activates here)
      const res = await authFetch(`/api/invoices/${entry.id}?print=true`);
      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data?.data) {
        throw new Error(data?.message || "❌ Failed to load invoice for print");
      }

      printInvoiceReceipt(data.data);
      showToast("🖨️ Printing invoice receipt...");
    } catch (err) {
      showToast(err.message || "❌ Failed to print receipt");
    } finally {
      hideLoading();
    }
  }


  /* ============================================================
     🪟 Modal Helpers
  ============================================================ */
  async function openModal(modalId, invoiceId, entry, extra = {}) {
    const modal = document.getElementById(modalId);
    if (!modal) return;
    modal.classList.remove("hidden");
    modal.dataset.invoiceId = invoiceId;
    modal.dataset.patientId = entry?.patient_id || entry?.patient?.id || "";
    modal.dataset.organizationId = entry?.organization_id || "";
    modal.dataset.facilityId = entry?.facility_id || "";
    modal.dataset.type = extra.type || "";

    const form = modal.querySelector("form");
    if (form) form.reset();

    /* ============================================================
      💰 PAYMENT MODAL – FULL / PARTIAL CONTROL
    ============================================================ */
    if (modalId === "paymentModal") {
      const amountInput = document.getElementById("paymentAmount");
      const fullCheck   = document.getElementById("payFullBalance");

      const balance =
        Number(
          entry?.balance ??
          entry?.amount_due ??
          entry?.total_due ??
          0
        );

      if (balance <= 0) {
        showToast("⚠️ Invoice has no balance due");
        closeModal("paymentModal");
        return;
      }

      if (amountInput && fullCheck) {
        // defaults
        amountInput.value = balance.toFixed(2);
        amountInput.max = balance.toFixed(2);
        amountInput.min = "0.01";
        amountInput.readOnly = true;
        fullCheck.checked = true;

        // toggle behavior
        fullCheck.onchange = () => {
          if (fullCheck.checked) {
            amountInput.value = balance.toFixed(2);
            amountInput.readOnly = true;
          } else {
            amountInput.readOnly = false;
            amountInput.focus();
            amountInput.select();
          }
        };
      }
    }

    // reverse transId
    if (modalId === "reverseModal" && extra.transId)
      document.getElementById("reverseTransId").value = extra.transId;

    // populate dropdowns
    const dropdownMap = {
      paymentModal: PAYMENT_METHODS,
      depositModal: PAYMENT_METHODS,
      waiverModal: DISCOUNT_TYPE,
      reverseModal: REVERSE_TYPES,
    };

    if (dropdownMap[modalId]) {
      const selectIdMap = {
        paymentModal: "paymentMethod",
        depositModal: "depositMethod",
        waiverModal: "waiverType",
        reverseModal: "reverseType",
      };
      const select = document.getElementById(selectIdMap[modalId]);
      if (select) {
        select.innerHTML = `<option value="">-- Choose --</option>`;
        dropdownMap[modalId].forEach((optVal) => {
          const opt = document.createElement("option");
          opt.value = optVal;
          opt.textContent =
            optVal.charAt(0).toUpperCase() + optVal.slice(1).replace(/_/g, " ");
          select.appendChild(opt);
        });
      }
    }

    // Refund: fetch eligible payments
    if (modalId === "refundModal") {
      const select = document.getElementById("refundPaymentSelect");
      if (!select) return;
      select.innerHTML = `<option value="">-- Choose Payment --</option>`;
      try {
        showLoading();
        const res = await authFetch(`/api/payments?invoice_id=${invoiceId}`);
        const { data } = await res.json();
        const payments = data?.records || [];
        if (payments.length === 0)
          select.innerHTML = `<option value="">No payments found</option>`;
        else
          payments.forEach((p) => {
            const opt = document.createElement("option");
            opt.value = p.id;
            opt.textContent = `${p.method} · $${Number(p.amount).toFixed(
              2
            )} · ${p.status}`;
            select.appendChild(opt);
          });
      } catch {
        showToast("❌ Could not load payments for refund");
      } finally {
        hideLoading();
      }
    }
  }

  function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (!modal) return;
    modal.classList.add("hidden");
    ["invoiceId", "patientId", "organizationId", "facilityId", "type"].forEach(
      (k) => delete modal.dataset[k]
    );
    const form = modal.querySelector("form");
    if (form) form.reset();
  }

  document
    .querySelectorAll("[data-close]")
    .forEach((btn) => btn.addEventListener("click", () => closeModal(btn.dataset.close)));

  /* ============================================================
     🧾 Form Submissions (Preserved + Standardized)
  ============================================================ */
  function bindFormOnce(formId, handler) {
    const form = document.getElementById(formId);
    if (form && !form.dataset.bound) {
      form.dataset.bound = "true";
      form.addEventListener("submit", handler);
    }
  }

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
      window.latestInvoiceEntries = [];
      await loadEntries(currentPage);
    } catch (err) {
      showToast(err.message || "❌ Failed to perform action");
    } finally {
      hideLoading();
    }
  }

  // 🔹 Form bindings (unchanged IDs)
  bindFormOnce("paymentForm", async (e) => {
    e.preventDefault();
    const m = document.getElementById("paymentModal");
    await submitAction("/api/invoices/apply-payment", {
      invoice_id: m.dataset.invoiceId,
      patient_id: m.dataset.patientId,
      amount: Number(document.getElementById("paymentAmount").value),
      method: document.getElementById("paymentMethod").value,
      transaction_ref: document.getElementById("paymentRef").value,
    });
    closeModal("paymentModal");
  });

  bindFormOnce("refundForm", async (e) => {
    e.preventDefault();
    const paymentId = document.getElementById("refundPaymentSelect")?.value;
    if (!paymentId) return showToast("❌ Select a payment to refund");
    await submitAction("/api/invoices/apply-refund", {
      payment_id: paymentId,
      amount: Number(document.getElementById("refundAmount").value),
      reason: document.getElementById("refundReason").value,
    });
    closeModal("refundModal");
  });

  bindFormOnce("depositForm", async (e) => {
    e.preventDefault();
    const m = document.getElementById("depositModal");
    await submitAction("/api/invoices/apply-deposit", {
      invoice_id: m.dataset.invoiceId,
      patient_id: m.dataset.patientId,
      organization_id: m.dataset.organizationId,
      facility_id: m.dataset.facilityId || null,
      amount: Number(document.getElementById("depositAmount").value),
      method: document.getElementById("depositMethod").value,
    });
    closeModal("depositModal");
  });

  bindFormOnce("waiverForm", async (e) => {
    e.preventDefault();
    const m = document.getElementById("waiverModal");
    await submitAction("/api/invoices/apply-waiver", {
      invoice_id: m.dataset.invoiceId,
      patient_id: m.dataset.patientId,
      organization_id: m.dataset.organizationId,
      facility_id: m.dataset.facilityId || null,
      type: document.getElementById("waiverType").value,
      value: Number(document.getElementById("waiverValue").value),
      reason: document.getElementById("waiverReason").value,
    });
    closeModal("waiverModal");
  });

  bindFormOnce("reverseForm", async (e) => {
    e.preventDefault();
    const m = document.getElementById("reverseModal");
    await submitAction("/api/invoices/reverse-transaction", {
      id: document.getElementById("reverseTransId").value,
      type: m.dataset.type || document.getElementById("reverseType").value,
      reason: document.getElementById("reverseReason").value,
    });
    closeModal("reverseModal");
  });

  /* ============================================================
     🌐 Global Helpers
  ============================================================ */
  const findEntry = (id) =>
    (window.latestInvoiceEntries || entries || []).find(
      (x) => String(x.id) === String(id)
    );

  window.viewEntry = (id) => {
    if (!hasPerm("invoices:view"))
      return showToast("⛔ No permission to view invoices");
    const entry = findEntry(id);
    entry ? handleView(entry) : showToast("❌ Invoice not found");
  };

  window.deleteEntry = async (id) => {
    if (!hasPerm("invoices:delete"))
      return showToast("⛔ No permission to delete invoices");
    await handleDelete(id);
  };

  ["toggle-status", "reverse"].forEach((action) => {
    window[`${action}Invoice`] = async (id) => {
      if (!hasPerm(`invoices:${action}`) && !hasPerm("invoices:edit"))
        return showToast(`⛔ No permission to ${action} invoices`);
      const entry = findEntry(id);
      await handleToggleStatus(id, entry);
    };
  });

  window.printInvoice = (id) => {
    if (!hasPerm("invoices:view"))
      return showToast("⛔ No permission to print invoices");
    const entry = findEntry(id);
    entry ? handlePrint(entry) : showToast("❌ Invoice not found");
  };
}
