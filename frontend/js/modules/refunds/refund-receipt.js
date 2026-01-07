// 📁 frontend/js/modules/refunds/refund-receipt.js
// ============================================================================
// 🔹 Mirrors deposit-receipt.js for unified receipt style and enterprise standard
// 🔹 Includes org/facility info, formatted meta fields, and amount summary
// 🔹 Fully compatible with printReceipt + org-config utilities
// ============================================================================

import { printReceipt } from "../../utils/receipt-utils.js";
import { getOrgInfo } from "../shared/org-config.js";

/* ============================================================
   🗓️ Date Formatter
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
   🧾 Print Refund Receipt
============================================================ */
export function printRefundReceipt(refund) {
  const orgInfo = getOrgInfo();
  const printedBy = localStorage.getItem("userName") || "Unknown User";
  const printedAt = new Date().toLocaleString();

  const linkedInvoice = refund.invoice
    ? `${refund.invoice.invoice_number} (Amt: $${Number(
        refund.invoice.total_amount ?? 0
      ).toFixed(2)})`
    : refund.invoice_id
    ? `Invoice ID: ${refund.invoice_id}`
    : "—";

  const linkedPayment = refund.payment
    ? `${refund.payment.label || refund.payment.id} ($${Number(
        refund.payment.amount ?? 0
      ).toFixed(2)})`
    : "—";

  const bodyHTML = `
    <!-- 🏥 Facility / Org Info -->
    <div class="facility-info mb-3">
      <p><strong>Facility:</strong> ${refund.facility?.name || orgInfo?.facilityName || "—"}</p>
      <p><strong>Organization:</strong> ${refund.organization?.name || orgInfo?.orgName || "—"}</p>
    </div>

    <!-- 🧾 Refund Meta -->
    <div class="invoice-meta">
      <div><strong>Refund ID:</strong> ${refund.refund_ref || refund.id || "—"}</div>
      <div><strong>Patient:</strong> ${
        refund.patient?.pat_no || ""
      } - ${refund.patient?.first_name || ""} ${refund.patient?.last_name || ""}</div>
      <div><strong>Linked Invoice:</strong> ${linkedInvoice}</div>
      <div><strong>Linked Payment:</strong> ${linkedPayment}</div>
      <div><strong>Method:</strong> ${refund.method || "—"}</div>
      <div><strong>Status:</strong> ${refund.status || "—"}</div>
      <div><strong>Reason:</strong> ${refund.reason || "—"}</div>
      <div><strong>Date:</strong> ${formatDate(refund.created_at)}</div>
      <div><strong>Processed By:</strong> ${
        refund.processedBy
          ? `${refund.processedBy.first_name} ${refund.processedBy.last_name}`
          : refund.createdBy
          ? `${refund.createdBy.first_name} ${refund.createdBy.last_name}`
          : "—"
      }</div>
    </div>

    <!-- 💵 Amount Summary -->
    <h5 class="border-bottom pb-1 mt-3">Amount Summary</h5>
    <div class="invoice-meta">
      <div><strong>Refund Amount:</strong> $${Number(refund.amount || 0).toFixed(2)}</div>
      <div><strong>Original Payment:</strong> $${Number(
        refund.payment?.amount || 0
      ).toFixed(2)}</div>
      <div><strong>Remaining Balance:</strong> 
        <span class="fw-bold">$${Number(
          refund.payment?.refundable_balance || 0
        ).toFixed(2)}</span>
      </div>
    </div>

    <!-- 🖨️ Print Info -->
    <div class="mt-3 border-top pt-2 small text-muted">
      Printed by: <strong>${printedBy}</strong><br/>
      Printed at: ${printedAt}
    </div>

    <!-- ✅ Footer -->
    <div id="receiptFooter" class="mt-3">
      <p class="mb-0">Refund transaction recorded successfully.</p>
    </div>
  `;

  printReceipt("Refund Receipt", bodyHTML, refund.organization_id);
}
