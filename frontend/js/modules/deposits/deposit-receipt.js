// 📁 frontend/js/modules/deposits/deposit-receipt.js
// ============================================================================
// 🧾 Deposit Receipt Printer (Enterprise Final)
// 🔹 Audit-first user resolution
// 🔹 Auth-user fallback
// 🔹 Silent + print-safe
// 🔹 Footer + branding handled ONLY by receipt-utils
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

function resolvePrintedBy(deposit) {
  if (deposit?.createdBy?.first_name || deposit?.createdBy?.last_name) {
    return [deposit.createdBy.first_name, deposit.createdBy.last_name]
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
export function printDepositReceipt(deposit) {
  const printedBy = resolvePrintedBy(deposit);
  const printedAt = new Date().toLocaleString();

  const appliedInvoice = deposit.appliedInvoice
    ? `${deposit.appliedInvoice.invoice_number} (Bal: $${Number(
        deposit.appliedInvoice.balance ?? 0
      ).toFixed(2)})`
    : deposit.applied_invoice_id
    ? `Invoice ID: ${deposit.applied_invoice_id}`
    : "—";

  const bodyHTML = `
    <div class="facility-info">
      <p><strong>Facility:</strong> ${deposit.facility?.name || "—"}</p>
    </div>

    <div class="invoice-meta">
      <div><strong>Deposit ID:</strong> ${deposit.deposit_ref || deposit.id || "—"}</div>
      <div><strong>Patient:</strong> ${deposit.patient?.pat_no || "—"} -
        ${deposit.patient?.first_name || ""} ${deposit.patient?.last_name || ""}</div>
      <div><strong>Applied Invoice:</strong> ${appliedInvoice}</div>
      <div><strong>Method:</strong> ${deposit.method || "—"}</div>
      <div><strong>Reference:</strong> ${deposit.transaction_ref || "—"}</div>
      <div><strong>Status:</strong> ${deposit.status || "—"}</div>
      <div><strong>Date:</strong> ${formatDate(deposit.created_at)}</div>
      <div><strong>Received By:</strong> ${printedBy}</div>
      <div style="grid-column: 1 / -1;">
        <strong>Notes:</strong> ${deposit.notes || "—"}
      </div>
    </div>

    <h5>Amount Summary</h5>
    <div class="invoice-meta">
      <div><strong>Deposit Amount:</strong> $${Number(deposit.amount || 0).toFixed(2)}</div>
      <div><strong>Applied to Invoices:</strong> $${Number(deposit.applied_amount || 0).toFixed(2)}</div>
      <div><strong>Remaining Balance:</strong>
        <strong>$${Number(deposit.remaining_balance || 0).toFixed(2)}</strong>
      </div>
    </div>

    <div class="print-meta">
      Printed by: <strong>${printedBy}</strong><br/>
      Printed at: ${printedAt}
    </div>
  `;

  printReceipt("Deposit Receipt", bodyHTML, deposit.organization_id);
}
