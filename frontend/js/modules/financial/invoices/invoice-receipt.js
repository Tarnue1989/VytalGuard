// 📁 invoice-receipt.js – Enterprise MASTER (FINAL FIXED)
// ============================================================================
// ✔ Deposit parity structure
// ✔ Safe user resolution (exact match)
// ✔ Currency-safe formatting
// ✔ Items + totals (invoice-specific)
// ✔ Applied deposits aligned (appliedDeposits)
// ✔ Multi-tenant safe
// ✔ Clean enterprise output (NO internal IDs)
// ============================================================================

import { printDocument } from "../../../templates/printTemplate.js";

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
   👤 Resolve Current User (EXACT DEPOSIT PARITY)
============================================================ */
function getPrintedBy(invoice) {
  try {
    const authSession = JSON.parse(localStorage.getItem("authSession") || "{}");

    return (
      authSession?.name ||
      (invoice?.createdBy
        ? `${invoice.createdBy.first_name} ${invoice.createdBy.last_name}`
        : null) ||
      localStorage.getItem("userName") ||
      "Unknown User"
    );
  } catch {
    return "Unknown User";
  }
}

/* ============================================================
   💱 MONEY FORMATTER (SAFE)
============================================================ */
function money(invoice, value) {
  const currency = invoice?.currency || "USD";
  return `${currency} ${Number(value || 0).toFixed(2)}`;
}

/* ============================================================
   🧾 BUILD RECEIPT HTML
============================================================ */
export function buildInvoiceReceiptHTML(invoice) {
  const printedBy = getPrintedBy(invoice);
  const printedAt = new Date().toLocaleString();

  const safe = (v) =>
    v !== null && v !== undefined && v !== "" ? v : "—";

  const patientName = invoice.patient
    ? `${invoice.patient.first_name || ""} ${
        invoice.patient.last_name || ""
      }`
    : "—";

  const patientId = invoice.patient?.pat_no || "—";

  /* ================= ITEMS ================= */
  const itemsHTML =
    (invoice.items || [])
      .map(
        (i) => `
        <tr>
          <td>${safe(i.description)}</td>
          <td>${safe(i.quantity)}</td>
          <td>${money(invoice, i.unit_price)}</td>
          <td>${money(invoice, i.discount_amount)}</td>
          <td>${money(invoice, i.tax_amount)}</td>
          <td>${money(invoice, i.total_price)}</td>
        </tr>`
      )
      .join("") || `<tr><td colspan="6">No items</td></tr>`;

  /* ================= DEPOSITS ================= */
  const appliedDepositsTotal = Array.isArray(invoice.appliedDeposits)
    ? invoice.appliedDeposits.reduce(
        (sum, d) => sum + Number(d.applied_amount || 0),
        0
      )
    : Number(invoice.applied_deposits || 0);

  /* ================= PAID ================= */
  const paidToDateValue = Number(invoice.total_paid ?? 0);
  const paidToDateHTML =
    paidToDateValue > 0
      ? `<div><span>Paid:</span><span>${money(
          invoice,
          paidToDateValue
        )}</span></div>`
      : "";

  return `
    <!-- 🏢 Facility -->
    <div style="margin-bottom:12px; font-size:13px;">
      <strong>Facility:</strong> ${safe(invoice.facility?.name)}
    </div>

    <!-- 🔥 GRID HEADER -->
    <div class="grid-2">

      <div>
        <div><strong>Patient:</strong> ${patientName}</div>
        <div><strong>Patient ID:</strong> ${patientId}</div>
      </div>

      <div>
        <div><strong>Invoice #:</strong> ${safe(
          invoice.invoice_number
        )}</div>

        <div><strong>Date:</strong> ${formatDate(
          invoice.created_at
        )}</div>

        <div><strong>Status:</strong> ${safe(invoice.status)}</div>

        <div><strong>Currency:</strong> ${safe(
          invoice.currency
        )}</div>
      </div>

    </div>

    <!-- 📦 ITEMS -->
    <h4 style="margin-top:18px;">Items</h4>

    <table>
      <thead>
        <tr>
          <th>Description</th>
          <th>Qty</th>
          <th>Unit</th>
          <th>Discount</th>
          <th>Tax</th>
          <th>Total</th>
        </tr>
      </thead>
      <tbody>${itemsHTML}</tbody>
    </table>

    <!-- 💵 TOTALS -->
    <div class="totals">

      <div><span>Subtotal:</span><span>${money(
        invoice,
        invoice.subtotal
      )}</span></div>

      <div><span>Discount:</span><span>${money(
        invoice,
        invoice.total_discount
      )}</span></div>

      <div><span>Tax:</span><span>${money(
        invoice,
        invoice.total_tax
      )}</span></div>

      ${paidToDateHTML}

      <div><span>Deposits:</span><span>${money(
        invoice,
        appliedDepositsTotal
      )}</span></div>

      <div><span>Refunded:</span><span>${money(
        invoice,
        invoice.refunded_amount
      )}</span></div>

      <div class="final">
        <span>Balance:</span>
        <span>${money(invoice, invoice.balance)}</span>
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
   🖨️ PRINT (MASTER)
============================================================ */
export function printInvoiceReceipt(invoice) {
  const html = buildInvoiceReceiptHTML(invoice);

  printDocument(html, {
    title: "Invoice Receipt",

    invoice: {
      organization: invoice.organization,
      status: invoice.status,
    },

    branding: JSON.parse(localStorage.getItem("branding") || "{}"),
  });
}