// 📁 refundDeposit-receipt.js – Enterprise Master Pattern Aligned
// ============================================================================
// 🔹 Mirrors deposit-receipt.js for unified receipt format
// 🔹 Designed ONLY for DEPOSIT REFUNDS (RefundDeposit entity)
// 🔹 Includes org/facility info, patient info, audit info, and balance summary
// 🔹 Fully compatible with printReceipt() + getOrgInfo()
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
   🧾 Print Deposit Refund Receipt
============================================================ */
export function printRefundDepositReceipt(refund) {
  const orgInfo = getOrgInfo();
  const printedBy = localStorage.getItem("userName") || "Unknown User";
  const printedAt = new Date().toLocaleString();

  // 🔗 DEPOSIT REF ID
  const refundRef = refund.refund_ref || refund.refund_no || refund.id || "—";

  // 🔗 Deposit Info
  const depositNo =
    refund.deposit?.deposit_no || refund.deposit_id || "—";

  // 🔗 Patient Display
  const patient = refund.patient
    ? `${refund.patient.pat_no || ""} - ${refund.patient.first_name || ""} ${
        refund.patient.last_name || ""
      }`
    : "—";

  // 💰 Amounts
  const refundAmount = Number(refund.refund_amount || 0);
  const openingBalance = Number(refund.deposit?.balance_before || 0);
  const closingBalance = Number(refund.deposit?.balance_after || 0);
  const method = refund.method || "—";

  const bodyHTML = `
    <!-- 🏥 Facility / Org Info -->
    <div class="facility-info mb-3">
      <p><strong>Facility:</strong> ${refund.facility?.name || orgInfo?.facilityName || "—"}</p>
      <p><strong>Organization:</strong> ${refund.organization?.name || orgInfo?.orgName || "—"}</p>
    </div>

    <!-- 🧾 Refund Details -->
    <div class="invoice-meta">
      <div><strong>Refund ID:</strong> ${refundRef}</div>
      <div><strong>Deposit No:</strong> ${depositNo}</div>
      <div><strong>Patient:</strong> ${patient}</div>
      <div><strong>Method:</strong> ${method}</div>
      <div><strong>Status:</strong> ${refund.status || "processed"}</div>
      <div><strong>Reason:</strong> ${refund.reason || "—"}</div>
      <div><strong>Date:</strong> ${formatDate(refund.created_at)}</div>
      <div><strong>Processed By:</strong> ${
        refund.createdBy
          ? `${refund.createdBy.first_name} ${refund.createdBy.last_name}`
          : "—"
      }</div>
    </div>

    <!-- 💵 Amount Summary -->
    <h5 class="border-bottom pb-1 mt-3">Amount Summary</h5>
    <div class="invoice-meta">
      <div><strong>Opening Balance:</strong> $${openingBalance.toFixed(2)}</div>
      <div><strong>Refund Amount:</strong> $${refundAmount.toFixed(2)}</div>
      <div><strong>Closing Balance:</strong> 
        <span class="fw-bold">$${closingBalance.toFixed(2)}</span>
      </div>
    </div>

    <!-- 🖨️ Print Info -->
    <div class="mt-3 border-top pt-2 small text-muted">
      Printed by: <strong>${printedBy}</strong><br/>
      Printed at: ${printedAt}
    </div>

    <!-- 📌 Footer -->
    <div id="receiptFooter" class="mt-3">
      <p class="mb-0">Deposit refund recorded successfully.</p>
    </div>
  `;

  printReceipt("Deposit Refund Receipt", bodyHTML, refund.organization_id);
}
