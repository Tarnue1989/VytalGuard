// 📁 frontend/js/modules/deposits/deposit-receipt.js
import { printReceipt } from "../../utils/receipt-utils.js";
import { getOrgInfo } from "../shared/org-config.js";

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

export function printDepositReceipt(deposit) {
  const orgInfo = getOrgInfo();
  const printedBy = localStorage.getItem("userName") || "Unknown User";
  const printedAt = new Date().toLocaleString();

  const appliedInvoice = deposit.appliedInvoice
    ? `${deposit.appliedInvoice.invoice_number} (Bal: $${Number(
        deposit.appliedInvoice.balance ?? 0
      ).toFixed(2)})`
    : deposit.applied_invoice_id
    ? `Invoice ID: ${deposit.applied_invoice_id}`
    : "—";

  const bodyHTML = `
    <!-- Facility -->
    <div class="facility-info mb-3">
      <p><strong>Facility:</strong> ${deposit.facility?.name || "—"}</p>
    </div>

    <!-- Deposit Meta -->
    <div class="invoice-meta">
      <div><strong>Deposit ID:</strong> ${deposit.deposit_ref || deposit.id || "—"}</div>
      <div><strong>Patient:</strong> ${deposit.patient?.pat_no || ""} - 
        ${deposit.patient?.first_name || ""} ${deposit.patient?.last_name || ""}</div>
      <div><strong>Applied Invoice:</strong> ${appliedInvoice}</div>
      <div><strong>Method:</strong> ${deposit.method || "—"}</div>
      <div><strong>Reference:</strong> ${deposit.transaction_ref || "—"}</div>
      <div><strong>Status:</strong> ${deposit.status || "—"}</div>
      <div><strong>Date:</strong> ${formatDate(deposit.created_at)}</div>
      <div><strong>Received By:</strong> ${
        deposit.createdBy
          ? `${deposit.createdBy.first_name} ${deposit.createdBy.last_name}`
          : "—"
      }</div>
      <div style="grid-column: 1 / -1;"><strong>Notes:</strong> ${deposit.notes || "—"}</div>
    </div>

    <!-- Amount Summary -->
    <h5 class="border-bottom pb-1 mt-3">Amount Summary</h5>
    <div class="invoice-meta">
      <div><strong>Deposit Amount:</strong> $${Number(deposit.amount || 0).toFixed(2)}</div>
      <div><strong>Applied to Invoices:</strong> $${Number(deposit.applied_amount || 0).toFixed(2)}</div>
      <div><strong>Remaining Balance:</strong> 
        <span class="fw-bold">$${Number(deposit.remaining_balance || 0).toFixed(2)}</span>
      </div>
    </div>

    <!-- Print Info -->
    <div class="mt-3 border-top pt-2 small text-muted">
      Printed by: <strong>${printedBy}</strong><br/>
      Printed at: ${printedAt}
    </div>

    <!-- Footer -->
    <div id="receiptFooter" class="mt-3">
      <p class="mb-0">Deposit successfully recorded.</p>
    </div>
  `;

  printReceipt("Deposit Receipt", bodyHTML, deposit.organization_id);
}
