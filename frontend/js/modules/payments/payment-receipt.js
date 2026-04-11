// 📁 frontend/js/modules/payments/payment-receipt.js
// ============================================================================
// 💳 Payment Receipt (INVOICE-STYLE PARITY — CLEAN CURRENCY)
// 🔹 Currency shown ONCE only
// 🔹 Clean grid + totals layout
// 🔹 Uses unified printTemplate (logo + branding + watermark)
// 🔹 UUID REMOVED (ONLY uses payment_number)
// ============================================================================

import { printDocument } from "../../templates/printTemplate.js";

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
   👤 Resolve Printed By
============================================================ */
function getPrintedBy(payment) {
  try {
    const authSession = JSON.parse(localStorage.getItem("authSession") || "{}");

    return (
      authSession?.name ||
      (payment?.createdBy
        ? `${payment.createdBy.first_name} ${payment.createdBy.last_name}`
        : null) ||
      localStorage.getItem("userName") ||
      "Unknown User"
    );
  } catch {
    return "Unknown User";
  }
}

/* ============================================================
   💱 MONEY FORMATTER (NO CURRENCY)
============================================================ */
function money(value) {
  return Number(value || 0).toFixed(2);
}

/* ============================================================
   🧾 BUILD RECEIPT HTML (INVOICE STYLE)
============================================================ */
function buildPaymentReceiptHTML(payment) {
  const printedBy = getPrintedBy(payment);
  const printedAt = new Date().toLocaleString();

  const invoiceLabel = payment.invoice
    ? `${payment.invoice.invoice_number || "—"}`
    : payment.invoice_id || "—";

  const paidToDateValue = Number(payment.invoice?.total_paid || 0);
  const paidToDateHTML =
    paidToDateValue > 0
      ? `<div><span>Paid:</span><span>${money(paidToDateValue)}</span></div>`
      : "";

  return `
    <!-- 🏢 Facility -->
    <div style="margin-bottom:10px; font-size:13px;">
      <strong>Facility:</strong> ${payment.facility?.name || "—"}
    </div>

    <!-- 🔥 GRID HEADER -->
    <div class="grid-2">

      <div>
        <div><strong>Patient:</strong> ${
          payment.patient?.first_name || ""
        } ${payment.patient?.last_name || ""}</div>

        <div><strong>Patient ID:</strong> ${
          payment.patient?.pat_no || ""
        }</div>
      </div>

      <div>
        <div><strong>Payment #:</strong> ${
          payment.payment_number || "—"
        }</div>

        <div><strong>Date:</strong> ${formatDate(
          payment.created_at
        )}</div>

        <div><strong>Status:</strong> ${payment.status || ""}</div>

        <div><strong>Currency:</strong> ${
          payment.currency || "—"
        }</div>
      </div>

    </div>

    <!-- 📦 DETAILS -->
    <h4 style="margin-top:15px;">Payment Details</h4>

    <table>
      <thead>
        <tr>
          <th>Description</th>
          <th>Value</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>Invoice</td>
          <td>${invoiceLabel}</td>
        </tr>
        <tr>
          <td>Payment Method</td>
          <td>${payment.method || "—"}</td>
        </tr>
        <tr>
          <td>Transaction Ref</td>
          <td>${payment.transaction_ref || "—"}</td>
        </tr>
        <tr>
          <td>Reason</td>
          <td>${payment.reason || "—"}</td>
        </tr>
        <tr>
          <td>Notes</td>
          <td>${payment.notes || "—"}</td>
        </tr>
      </tbody>
    </table>

    <!-- 💵 TOTALS -->
    <div class="totals">

      <div><span>Payment Amount:</span><span>${money(
        payment.amount
      )}</span></div>

      <div><span>Invoice Total:</span><span>${money(
        payment.invoice?.total
      )}</span></div>

      ${paidToDateHTML}

      <div class="final">
        <span>Balance:</span>
        <span>${money(payment.invoice?.balance)}</span>
      </div>

    </div>

    <!-- 🕓 AUDIT -->
    <div style="margin-top:20px; font-size:11px;">
      Printed by: <strong>${printedBy}</strong><br/>
      Printed at: ${printedAt}
    </div>

    <!-- 🧾 FOOTER -->
    <div style="margin-top:15px; font-size:12px;">
      Thank you for your business.
    </div>
  `;
}

/* ============================================================
   🖨️ PRINT
============================================================ */
export function printPaymentReceipt(payment) {
  const html = buildPaymentReceiptHTML(payment);

  printDocument(html, {
    title: "Payment Receipt",

    invoice: {
      organization: payment.organization,
      status: payment.status,
    },

    branding: JSON.parse(localStorage.getItem("branding") || "{}"),
  });
}