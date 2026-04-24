// 📦 insurance-claim-actions.js – FINAL (PRINT FIXED)

import {
  showToast,
  showConfirm,
  openViewModal,
  showLoading,
  hideLoading,
} from "../../utils/index.js";

import { authFetch } from "../../authSession.js";
import { renderCard } from "./insurance-claims-render.js";

/* 🔥 INVOICE SYSTEM */
import { buildInvoiceReceiptHTML } from "../financial/invoices/invoice-receipt.js";
import { renderCard as renderInvoiceCard } from "../financial/invoices/invoice-render.js";
import { printDocument } from "../../templates/printTemplate.js";

/* ============================================================ */

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

  const tableBody = document.getElementById("insuranceClaimTableBody");
  const cardContainer = document.getElementById("insuranceClaimList");
  const modalBody = document.getElementById("viewModalBody");

  window.latestInsuranceClaimEntries = entries;

  tableBody?.addEventListener("click", handleActions);
  cardContainer?.addEventListener("click", handleActions);
  modalBody?.addEventListener("click", handleActions);

  /* ================= PERMISSIONS ================= */
  function normalizePermissions(perms) {
    if (!perms) return [];
    if (typeof perms === "string") {
      try { return JSON.parse(perms); }
      catch { return perms.split(",").map((p) => p.trim()); }
    }
    return Array.isArray(perms) ? perms : [];
  }

  const userPerms = new Set(
    normalizePermissions(user?.permissions || []).map((p) =>
      String(p).toLowerCase().trim()
    )
  );

  const isSuperAdmin =
    user?.role?.toLowerCase() === "superadmin" ||
    user?.roleNames?.some((r) => r.toLowerCase() === "superadmin");

  const hasPerm = (key) =>
    isSuperAdmin || userPerms.has(String(key).toLowerCase());

  /* ================= APPROVE ================= */
  async function handleApprove(entry) {
    const idInput = document.getElementById("approveClaimId");
    const amountInput = document.getElementById("approveAmount");

    idInput.value = entry.id;

    const claimed = Number(entry.amount_claimed || 0);
    const coverage = Number(entry.coverage_amount_at_claim || 0);

    const suggested = coverage > 0
      ? Math.min(claimed, coverage)
      : claimed;

    amountInput.value = suggested;
    amountInput.max = claimed;

    openModal("claimApproveModal");

    document.getElementById("claimApproveForm").onsubmit = async (e) => {
      e.preventDefault();

      const amount = parseFloat(amountInput.value);

      if (!amount || amount <= 0)
        return showToast("❌ Amount must be greater than 0");

      if (amount > claimed)
        return showToast("❌ Cannot approve more than claimed");

      try {
        showLoading();

        const res = await authFetch(
          `/api/insurance-claims/${entry.id}/approve`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              amount_approved: amount,
              notes: document.getElementById("approveNotes").value,
            }),
          }
        );

        const data = await res.json();
        if (!res.ok) throw new Error(data.message);

        showToast("✅ Claim approved");
        closeModal("claimApproveModal");

        window.latestInsuranceClaimEntries = [];
        await loadEntries(currentPage);

      } catch (err) {
        showToast(err.message || "❌ Failed to approve");
      } finally {
        hideLoading();
      }
    };
  }

  async function handleMarkPaid(entry) {
    const idInput = document.getElementById("markPaidClaimId");
    const select = document.getElementById("markPaidAccountSelect");

    idInput.value = entry.id;

    try {
      showLoading();

      // 🔥 load accounts by currency
      const res = await authFetch(
        `/api/lite/accounts?currency=${entry.currency}`
      );

      const data = await res.json();
      const accounts = data?.data?.records || [];

      if (!accounts.length) {
        showToast("❌ No accounts available for this currency");
        return;
      }

      // 🔥 populate dropdown
      select.innerHTML = accounts.map(acc => `
        <option value="${acc.id}">
          ${acc.name} (${acc.currency})
        </option>
      `).join("");

      // 🔥 auto select first
      select.value = accounts[0].id;

      // 🔥 open modal
      openModal("claimMarkPaidModal");

      // 🔥 submit handler
      document.getElementById("claimMarkPaidForm").onsubmit = async (e) => {
        e.preventDefault();

        const account_id = select.value;

        try {
          showLoading();

          const res = await authFetch(
            `/api/insurance-claims/${entry.id}/mark-paid`,
            {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ account_id }),
            }
          );

          const result = await res.json();
          if (!res.ok) throw new Error(result.message);

          showToast("✅ Claim marked as paid");

          closeModal("claimMarkPaidModal");

          window.latestInsuranceClaimEntries = [];
          await loadEntries(currentPage);

        } catch (err) {
          showToast(err.message || "❌ Failed to mark paid");
        } finally {
          hideLoading();
        }
      };

    } catch (err) {
      showToast("❌ Failed to load accounts");
    } finally {
      hideLoading();
    }
  }

  /* ================= ACTION HANDLER ================= */
  async function handleActions(e) {

    // ✅ FIXED (IMPORTANT)
    const btn = e.target.closest("button");
    if (!btn || !btn.dataset.id) return;

    const id = btn.dataset.id;

    let entry =
      (window.latestInsuranceClaimEntries || entries || []).find(
        (x) => String(x.id) === String(id)
      ) || null;

    if (!entry) {
      try {
        showLoading();
        const res = await authFetch(`/api/insurance-claims/${id}`);
        const data = await res.json().catch(() => ({}));
        entry = data?.data;
      } finally {
        hideLoading();
      }
    }

    if (!entry) return showToast("❌ Claim missing");

    const cls = btn.classList;

    /* ================= PRINT ================= */
    if (cls.contains("print-btn") || btn.dataset.action === "print-invoice") {
      if (!hasPerm("insurance_claims:print"))
        return showToast("⛔ No permission");

      if (!entry.invoice?.id)
        return showToast("❌ No invoice");

      try {
        showLoading();

        const res = await authFetch(
          `/api/invoices/${entry.invoice.id}?print=true`
        );

        const data = await res.json();
        if (!data?.data) throw new Error("Invoice not found");

        const html = buildInvoiceReceiptHTML(data.data);

        await printDocument(html, {
          title: "Invoice Receipt",
          invoice: data.data,
          branding: JSON.parse(localStorage.getItem("branding") || "{}"),
        });

      } catch (err) {
        console.error(err);
        showToast(err.message || "❌ Failed to print invoice");
      } finally {
        hideLoading();
      }

      return;
    }
    /* ================= DOWNLOAD PDF ================= */
    if (btn.dataset.action === "download-invoice") {
      if (!hasPerm("insurance_claims:print"))
        return showToast("⛔ No permission");

      if (!entry.invoice?.id)
        return showToast("❌ No invoice");

      try {
        showLoading();

        const res = await authFetch(
          `/api/invoices/${entry.invoice.id}?print=true`
        );

        const data = await res.json();
        if (!data?.data) throw new Error("Invoice not found");

        const html = buildInvoiceReceiptHTML(data.data);

        const win = window.open("", "_blank");

        win.document.write(`
          <html>
            <head>
              <title>${data.data.invoice_number}</title>
            </head>
            <body>
              ${html}
              <script>
                window.onload = function(){
                  window.print();
                }
              <\/script>
            </body>
          </html>
        `);

        win.document.close();

      } catch (err) {
        console.error(err);
        showToast(err.message || "❌ Failed to download invoice");
      } finally {
        hideLoading();
      }

      return;
    }
    /* ================= VIEW ================= */
    if (cls.contains("view-btn")) {
      if (!hasPerm("insurance_claims:view"))
        return showToast("⛔ No permission");

      return openViewModal(
        "Insurance Claim",
        renderCard(entry, visibleFields, user)
      );
    }

    /* ================= EDIT ================= */
    if (cls.contains("edit-btn")) {
      if (!hasPerm("insurance_claims:edit"))
        return showToast("⛔ No permission");

      if (currentEditIdRef) currentEditIdRef.value = entry.id;
      sessionStorage.setItem("insuranceClaimEditId", entry.id);
      window.location.href = "add-insurance-claims.html";
    }

    /* ================= DELETE ================= */
    if (cls.contains("delete-btn")) {
      if (!hasPerm("insurance_claims:delete"))
        return showToast("⛔ No permission");

      const confirmed = await showConfirm("Delete this claim?");
      if (!confirmed) return;

      try {
        showLoading();

        const res = await authFetch(`/api/insurance-claims/${id}`, {
          method: "DELETE",
        });

        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.message);

        showToast("✅ Deleted");
        window.latestInsuranceClaimEntries = [];
        await loadEntries(currentPage);

      } catch (err) {
        showToast(err.message);
      } finally {
        hideLoading();
      }
    }

    /* ================= APPROVE ================= */
    if (cls.contains("approve-btn")) {
      if (!hasPerm("insurance_claims:approve"))
        return showToast("⛔ No permission");

      return handleApprove(entry);
    }

    /* ================= LIFECYCLE ================= */
    const lifecycleMap = {
      "submit-btn": "submit",
      "review-btn": "review",
      "partial-btn": "partial-approve",
      "reject-btn": "reject",
      "process-payment-btn": "process-payment",
      "mark-paid-btn": "mark-paid",
      "reverse-btn": "reverse-payment",
    };

    for (const [clsName, action] of Object.entries(lifecycleMap)) {
      if (cls.contains(clsName)) {

        // 🔥 INTERCEPT MARK PAID
        if (action === "mark-paid") {
          return handleMarkPaid(entry);
        }

        return handleLifecycle(id, action);
      }
    }
  }

  /* ================= LIFECYCLE ================= */
  async function handleLifecycle(id, action) {
    const confirmed = await showConfirm(`Proceed to ${action}?`);
    if (!confirmed) return;

    try {
      showLoading();

      const res = await authFetch(`/api/insurance-claims/${id}/${action}`, {
        method: "PATCH",
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message);

      showToast(`✅ ${action} successful`);
      window.latestInsuranceClaimEntries = [];
      await loadEntries(currentPage);

    } catch (err) {
      showToast(err.message);
    } finally {
      hideLoading();
    }
  }

  /* ================= MODAL ================= */
  function openModal(id) {
    document.getElementById(id)?.classList.remove("hidden");
  }

  function closeModal(id) {
    document.getElementById(id)?.classList.add("hidden");
  }

  /* ================= CLOSE HANDLER ================= */
  document.addEventListener("click", (e) => {
    const target = e.target.closest("[data-close]");
    if (!target) return;

    const modalId = target.getAttribute("data-close");
    const modal = document.getElementById(modalId);

    if (modal) modal.classList.add("hidden");
  });
}