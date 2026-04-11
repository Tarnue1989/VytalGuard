// 📁 frontend/js/modules/refunds/refund-receipt.js
// ============================================================================
// 🧾 Refund Receipt (INVOICE-STYLE PARITY — CLEAN CURRENCY)
// 🔹 Currency shown ONCE only
// 🔹 SAME printedBy logic
// 🔹 Multi-tenant safe
// 🔹 Clean enterprise output
// 🔹 refund_number only (NO UUID)
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
   👤 Resolve Current User (INVOICE PARITY — EXACT)
============================================================ */
function getPrintedBy(refund) {
  try {
    const authSession = JSON.parse(localStorage.getItem("authSession") || "{}");

    return (
      authSession?.name ||
      (refund?.createdBy
        ? `${refund.createdBy.first_name} ${refund.createdBy.last_name}`
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
   🧾 BUILD RECEIPT HTML
============================================================ */
function buildRefundReceiptHTML(refund) {
  const printedBy = getPrintedBy(refund);
  const printedAt = new Date().toLocaleString();

  const refundRef = refund.refund_number || "—";

  const linkedInvoice =
    refund.invoice?.invoice_number ||
    refund.invoice_id ||
    "—";

  const linkedPayment =
    refund.payment?.transaction_ref ||
    refund.payment?.id ||
    "—";

  const refundAmount = Number(refund.amount ?? 0);

  return `
    <!-- 🏢 Facility -->
    <div style="margin-bottom:12px; font-size:13px;">
      <strong>Facility:</strong> ${refund.facility?.name || "—"}
    </div>

    <!-- 🔥 GRID HEADER -->
    <div class="grid-2">

      <div>
        <div><strong>Patient:</strong> ${
          refund.patient?.first_name || ""
        } ${refund.patient?.last_name || ""}</div>

        <div><strong>Patient ID:</strong> ${
          refund.patient?.pat_no || ""
        }</div>
      </div>

      <div>
        <div><strong>Refund #:</strong> ${refundRef}</div>

        <div><strong>Date:</strong> ${formatDate(
          refund.created_at
        )}</div>

        <div><strong>Status:</strong> ${refund.status || "—"}</div>

        <div><strong>Currency:</strong> ${
          refund.currency || "—"
        }</div>
      </div>

    </div>

    <!-- 📦 DETAILS -->
    <h4 style="margin-top:18px;">Refund Details</h4>

    <table>
      <thead>
        <tr>
          <th>Invoice</th>
          <th>Payment</th>
          <th>Method</th>
          <th>Reason</th>
          <th>Processed By</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>${linkedInvoice}</td>
          <td>${linkedPayment}</td>
          <td>${refund.method || "—"}</td>
          <td>${refund.reason || "—"}</td>
          <td>${printedBy}</td>
        </tr>
      </tbody>
    </table>

    <!-- 💵 TOTALS -->
    <div class="totals">

      <div class="final">
        <span>Refund Amount:</span>
        <span>${money(refundAmount)}</span>
      </div>

    </div>

    <!-- 🕓 AUDIT -->
    <div style="margin-top:20px; font-size:11px;">
      Printed by: <strong>${printedBy}</strong><br/>
      Printed at: ${printedAt}
    </div>

    <!-- 🧾 FOOTER -->
    <div style="margin-top:15px; font-size:12px;">
      Refund processed successfully.
    </div>
  `;
}

/* ============================================================
   🖨️ PRINT
============================================================ */
export function printRefundReceipt(refund) {
  const html = buildRefundReceiptHTML(refund);

  printDocument(html, {
    title: "Refund Receipt",

    invoice: {
      organization: refund.organization,
      status: refund.status,
    },

    branding: JSON.parse(localStorage.getItem("branding") || "{}"),
  });
}