// 📁 frontend/js/modules/deposits/deposit-receipt.js
// ============================================================================
// 🧾 Deposit Receipt (INVOICE-STYLE PARITY — FINAL FIXED)
// 🔹 FIXED printedBy (uses userSession correctly)
// 🔹 Multi-tenant safe
// 🔹 Audit-safe fallback chain
// 🔹 Clean enterprise output
// 🔹 UUID REMOVED (ONLY uses deposit_number)
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
function getPrintedBy(deposit) {
  try {
    const authSession = JSON.parse(localStorage.getItem("authSession") || "{}");

    return (
      authSession?.name ||
      (deposit?.createdBy
        ? `${deposit.createdBy.first_name} ${deposit.createdBy.last_name}`
        : null) ||
      localStorage.getItem("userName") ||
      "Unknown User"
    );
  } catch {
    return "Unknown User";
  }
}

/* ============================================================
   🧾 BUILD RECEIPT HTML
============================================================ */
function buildDepositReceiptHTML(deposit) {
  const printedBy = getPrintedBy(deposit);
  const printedAt = new Date().toLocaleString();

  const money = (v) => `$${Number(v || 0).toFixed(2)}`;

  const appliedInvoice = deposit.appliedInvoice
    ? `${deposit.appliedInvoice.invoice_number}`
    : deposit.applied_invoice_id || "—";

  return `
    <!-- 🏢 Facility -->
    <div style="margin-bottom:12px; font-size:13px;">
      <strong>Facility:</strong> ${deposit.facility?.name || "—"}
    </div>

    <!-- 🔥 GRID HEADER -->
    <div class="grid-2">

      <div>
        <div><strong>Patient:</strong> ${
          deposit.patient?.first_name || ""
        } ${deposit.patient?.last_name || ""}</div>

        <div><strong>Patient ID:</strong> ${
          deposit.patient?.pat_no || ""
        }</div>
      </div>

      <div>
        <div><strong>Deposit #:</strong> ${
          deposit.deposit_number || "—"
        }</div>

        <div><strong>Date:</strong> ${formatDate(
          deposit.created_at
        )}</div>

        <div><strong>Status:</strong> ${deposit.status || ""}</div>
      </div>

    </div>

    <!-- 📦 DETAILS -->
    <h4 style="margin-top:18px;">Deposit Details</h4>

    <table>
      <thead>
        <tr>
          <th>Description</th>
          <th>Amount</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>Payment Method</td>
          <td>${deposit.method || "—"}</td>
        </tr>
        <tr>
          <td>Transaction Ref</td>
          <td>${deposit.transaction_ref || "—"}</td>
        </tr>
        <tr>
          <td>Applied Invoice</td>
          <td>${appliedInvoice}</td>
        </tr>
        <tr>
          <td>Notes</td>
          <td>${deposit.notes || "—"}</td>
        </tr>
      </tbody>
    </table>

    <!-- 💵 TOTALS -->
    <div class="totals">

      <div><span>Deposit Amount:</span><span>${money(
        deposit.amount
      )}</span></div>

      <div><span>Applied:</span><span>${money(
        deposit.applied_amount
      )}</span></div>

      <div class="final">
        <span>Balance:</span>
        <span>${money(deposit.remaining_balance)}</span>
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
export function printDepositReceipt(deposit) {
  const html = buildDepositReceiptHTML(deposit);

  printDocument(html, {
    title: "Deposit Receipt",

    invoice: {
      organization: deposit.organization,
      status: deposit.status,
    },

    branding: JSON.parse(localStorage.getItem("branding") || "{}"),
  });
}