// 📁 frontend/js/modules/refunds/refund-receipt.js – Enterprise FINAL (MASTER–ALIGNED)
// ============================================================================
// 🧾 Refund Receipt Printer (Enterprise Final)
// 🔹 FULL parity with refundDeposit-receipt.js MASTER
// 🔹 Audit-first user resolution
// 🔹 Auth-user fallback
// 🔹 Silent + print-safe
// 🔹 Footer + branding handled ONLY by receipt-utils
// 🔹 NO org-config, NO inline footer, NO UI bleed
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

function resolvePrintedBy(refund) {
  if (
    refund?.createdBy?.first_name ||
    refund?.createdBy?.last_name
  ) {
    return [
      refund.createdBy.first_name,
      refund.createdBy.last_name,
    ]
      .filter(Boolean)
      .join(" ");
  }

  const authUser =
    JSON.parse(localStorage.getItem("auth_user") || "null") ||
    JSON.parse(localStorage.getItem("currentUser") || "null");

  if (!authUser) return "System";

  if (authUser.first_name || authUser.last_name) {
    return [
      authUser.first_name,
      authUser.last_name,
    ]
      .filter(Boolean)
      .join(" ");
  }

  return authUser.name || "System";
}

/* --------------------------------------------------
   Receipt Printer
-------------------------------------------------- */
export function printRefundReceipt(refund) {
  const printedBy = resolvePrintedBy(refund);
  const printedAt = new Date().toLocaleString();

  const refundRef =
    refund.refund_ref ||
    refund.refund_no ||
    refund.id ||
    "—";

  const patient = refund.patient
    ? `${refund.patient.pat_no || "—"} - ${
        refund.patient.first_name || ""
      } ${refund.patient.last_name || ""}`.trim()
    : "—";

  const linkedInvoice =
    refund.invoice?.invoice_number ||
    refund.invoice_id ||
    "—";

  const linkedPayment =
    refund.payment?.transaction_ref ||
    refund.payment?.id ||
    "—";

  const refundAmount = Number(refund.amount ?? 0);

  const bodyHTML = `
    <div class="facility-info">
      <p><strong>Facility:</strong> ${refund.facility?.name || "—"}</p>
    </div>

    <div class="invoice-meta">
      <div><strong>Refund ID:</strong> ${refundRef}</div>
      <div><strong>Patient:</strong> ${patient}</div>
      <div><strong>Invoice:</strong> ${linkedInvoice}</div>
      <div><strong>Payment:</strong> ${linkedPayment}</div>
      <div><strong>Method:</strong> ${refund.method || "—"}</div>
      <div><strong>Status:</strong> ${refund.status || "—"}</div>
      <div><strong>Reason:</strong> ${refund.reason || "—"}</div>
      <div><strong>Date:</strong> ${formatDate(refund.created_at)}</div>
      <div><strong>Processed By:</strong> ${printedBy}</div>
    </div>

    <h5>Amount Summary</h5>
    <div class="invoice-meta">
      <div>
        <strong>Refund Amount:</strong>
        <strong>$${refundAmount.toFixed(2)}</strong>
      </div>
    </div>

    <div class="print-meta">
      Printed by: <strong>${printedBy}</strong><br/>
      Printed at: ${printedAt}
    </div>
  `;

  printReceipt(
    "Refund Receipt",
    bodyHTML,
    refund.organization_id
  );
}
