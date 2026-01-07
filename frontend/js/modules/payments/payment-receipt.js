// 📁 frontend/js/modules/payments/payment-receipt.js
// ============================================================================
// 💳 Payment Receipt – Enterprise Master Pattern Aligned (Deposit Receipt Mirror)
// ----------------------------------------------------------------------------
// 🔹 Unified styling & structure (org/facility/meta/summary/footer)
// 🔹 Auto-hides “Paid To Date” when zero
// 🔹 Fully tenant-aware (organization & facility labels)
// 🔹 Currency-safe & localized printing
// ============================================================================

import { printReceipt } from "../../utils/receipt-utils.js";
import { getOrgInfo } from "../shared/org-config.js";

/* ============================================================
   📅 Date Formatter
============================================================ */
function formatDate(dateStr) {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  if (isNaN(d)) return dateStr;
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
}

/* ============================================================
   🧾 Print Payment Receipt
============================================================ */
export function printPaymentReceipt(payment) {
  const orgInfo = getOrgInfo();
  const printedBy = localStorage.getItem("userName") || "Unknown User";
  const printedAt = new Date().toLocaleString();

  // 🧩 Safe invoice & patient labels
  const invoiceInfo = payment.invoice
    ? `${payment.invoice.invoice_number || "—"} (Bal: $${Number(
        payment.invoice.balance ?? 0
      ).toFixed(2)})`
    : payment.invoice_id
    ? `Invoice ID: ${payment.invoice_id}`
    : "—";

  const patientLabel =
    payment.patient?.pat_no || payment.patient?.first_name || payment.patient?.last_name
      ? `${payment.patient?.pat_no || ""} - ${payment.patient?.first_name || ""} ${
          payment.patient?.last_name || ""
        }`
      : "—";

  // 💵 Optional “Paid To Date” line (only if > 0)
  const paidToDateValue = Number(payment.invoice?.total_paid || 0);
  const paidToDateHTML =
    paidToDateValue > 0
      ? `<div><strong>Paid To Date:</strong> $${paidToDateValue.toFixed(2)}</div>`
      : "";

  /* ============================================================
     🧱 Body Content
  ============================================================ */
  const bodyHTML = `
    <!-- 🏢 Organization & Facility -->
    <div class="facility-info mb-3">
      <p><strong>Organization:</strong> ${orgInfo?.name || payment.organization?.name || "—"}</p>
      <p><strong>Facility:</strong> ${payment.facility?.name || "—"}</p>
    </div>

    <!-- 💬 Payment Meta -->
    <div class="invoice-meta">
      <div><strong>Payment ID:</strong> ${payment.payment_ref || payment.id || "—"}</div>
      <div><strong>Invoice:</strong> ${invoiceInfo}</div>
      <div><strong>Patient:</strong> ${patientLabel}</div>
      <div><strong>Method:</strong> ${payment.method || "—"}</div>
      <div><strong>Reference:</strong> ${payment.transaction_ref || "—"}</div>
      <div><strong>Status:</strong> ${payment.status || "—"}</div>
      <div><strong>Date:</strong> ${formatDate(payment.created_at)}</div>
      <div><strong>Received By:</strong> ${
        payment.createdBy
          ? `${payment.createdBy.first_name} ${payment.createdBy.last_name}`
          : "—"
      }</div>
      <div style="grid-column: 1 / -1;"><strong>Reason:</strong> ${payment.reason || "—"}</div>
      <div style="grid-column: 1 / -1;"><strong>Notes:</strong> ${payment.notes || "—"}</div>
    </div>

    <!-- 💵 Amount Summary -->
    <h5 class="border-bottom pb-1 mt-3">Amount Summary</h5>
    <div class="invoice-meta">
      <div><strong>Payment Amount:</strong> $${Number(payment.amount || 0).toFixed(2)}</div>
      <div><strong>Invoice Total:</strong> $${Number(payment.invoice?.total || 0).toFixed(2)}</div>
      ${paidToDateHTML}
      <div><strong>Invoice Balance:</strong>
        <span class="fw-bold">$${Number(payment.invoice?.balance || 0).toFixed(2)}</span>
      </div>
    </div>

    <!-- 🕓 Print Info -->
    <div class="mt-3 border-top pt-2 small text-muted">
      Printed by: <strong>${printedBy}</strong><br/>
      Printed at: ${printedAt}
    </div>

    <!-- 🧾 Footer -->
    <div id="receiptFooter" class="mt-3">
      <p class="mb-0">Payment successfully recorded.</p>
    </div>
  `;

  /* ============================================================
     🖨️ Dispatch to Printer
  ============================================================ */
  printReceipt("Payment Receipt", bodyHTML, payment.organization_id);
}
