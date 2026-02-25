// 📁 frontend/js/modules/payments/payment-receipt.js
// ============================================================================
// 💳 Payment Receipt Printer (Enterprise FINAL – Deposit Parity)
// 🔹 Audit-first user resolution (createdBy → auth_user → currentUser → System)
// 🔹 Auth-user fallback (NO UI globals)
// 🔹 Silent + print-safe
// 🔹 Footer + branding handled ONLY by receipt-utils
// 🔹 Structure & formatting MATCH deposit-receipt.js
// ============================================================================

import { printReceipt } from "../../utils/receipt-utils.js";

/* --------------------------------------------------
   Utilities
-------------------------------------------------- */
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

function resolvePrintedBy(payment) {
  if (payment?.createdBy?.first_name || payment?.createdBy?.last_name) {
    return [payment.createdBy.first_name, payment.createdBy.last_name]
      .filter(Boolean)
      .join(" ");
  }

  const authUser =
    JSON.parse(localStorage.getItem("auth_user") || "null") ||
    JSON.parse(localStorage.getItem("currentUser") || "null");

  if (!authUser) return "System";

  if (authUser.first_name || authUser.last_name) {
    return [authUser.first_name, authUser.last_name]
      .filter(Boolean)
      .join(" ");
  }

  return authUser.name || "System";
}

/* --------------------------------------------------
   Receipt Printer
-------------------------------------------------- */
export function printPaymentReceipt(payment) {
  const printedBy = resolvePrintedBy(payment);
  const printedAt = new Date().toLocaleString();

  /* ---------------- Invoice Resolution ---------------- */
  const invoiceLabel = payment.invoice
    ? `${payment.invoice.invoice_number || "—"} (Bal: $${Number(
        payment.invoice.balance ?? 0
      ).toFixed(2)})`
    : payment.invoice_id
    ? `Invoice ID: ${payment.invoice_id}`
    : "—";

  /* ---------------- Patient Resolution ---------------- */
  const patientLabel =
    payment.patient?.pat_no ||
    payment.patient?.first_name ||
    payment.patient?.last_name
      ? `${payment.patient?.pat_no || "—"} - ${payment.patient?.first_name || ""} ${
          payment.patient?.last_name || ""
        }`
      : "—";

  /* ---------------- Optional Paid-To-Date ---------------- */
  const paidToDate = Number(payment.invoice?.total_paid || 0);
  const paidToDateHTML =
    paidToDate > 0
      ? `<div><strong>Paid To Date:</strong> $${paidToDate.toFixed(2)}</div>`
      : "";

  /* --------------------------------------------------
     Body Content (Deposit Parity Structure)
  -------------------------------------------------- */
  const bodyHTML = `
    <div class="facility-info">
      <p><strong>Facility:</strong> ${payment.facility?.name || "—"}</p>
    </div>

    <div class="invoice-meta">
      <div><strong>Payment ID:</strong> ${payment.payment_ref || payment.id || "—"}</div>
      <div><strong>Invoice:</strong> ${invoiceLabel}</div>
      <div><strong>Patient:</strong> ${patientLabel}</div>
      <div><strong>Method:</strong> ${payment.method || "—"}</div>
      <div><strong>Reference:</strong> ${payment.transaction_ref || "—"}</div>
      <div><strong>Status:</strong> ${payment.status || "—"}</div>
      <div><strong>Date:</strong> ${formatDate(payment.created_at)}</div>
      <div><strong>Received By:</strong> ${printedBy}</div>
      <div style="grid-column: 1 / -1;">
        <strong>Reason:</strong> ${payment.reason || "—"}
      </div>
      <div style="grid-column: 1 / -1;">
        <strong>Notes:</strong> ${payment.notes || "—"}
      </div>
    </div>

    <h5>Amount Summary</h5>
    <div class="invoice-meta">
      <div><strong>Payment Amount:</strong> $${Number(payment.amount || 0).toFixed(2)}</div>
      <div><strong>Invoice Total:</strong> $${Number(payment.invoice?.total || 0).toFixed(2)}</div>
      ${paidToDateHTML}
      <div>
        <strong>Invoice Balance:</strong>
        <strong>$${Number(payment.invoice?.balance || 0).toFixed(2)}</strong>
      </div>
    </div>

    <div class="print-meta">
      Printed by: <strong>${printedBy}</strong><br/>
      Printed at: ${printedAt}
    </div>
  `;

  /* --------------------------------------------------
     Print Dispatch (Branding via receipt-utils ONLY)
  -------------------------------------------------- */
  printReceipt("Payment Receipt", bodyHTML, payment.organization_id);
}
