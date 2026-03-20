// 📁 frontend/js/modules/financial/invoices/invoice-receipt.js
// ============================================================================
// 🧾 Invoice Receipt – Enterprise Master Pattern Aligned
// ----------------------------------------------------------------------------
// 🔹 Mirrors payment-receipt.js for unified tenant-aware receipt structure
// 🔹 Uses authSession for Printed By (single source of truth)
// 🔹 Includes org/facility info, itemized summary, and dynamic “Paid To Date”
// 🔹 Currency-safe, localized printing with full audit footer
// ============================================================================

import { printReceipt } from "../../../utils/receipt-utils.js";
import { getOrgInfo } from "../../shared/org-config.js";

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
   👤 Resolve Current User (MASTER PATTERN)
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
  } catch (e) {
    console.warn("⚠️ Failed to parse authSession:", e);
    return "Unknown User";
  }
}

/* ============================================================
   🧾 Print Invoice Receipt
============================================================ */
export function printInvoiceReceipt(invoice) {
  const orgInfo = getOrgInfo();
  const printedBy = getPrintedBy(invoice);
  const printedAt = new Date().toLocaleString();

  /* ------------------------------------------------------------
     🧮 Optional “Paid To Date” line (only if > 0)
  ------------------------------------------------------------ */
  const paidToDateValue = Number(invoice.total_paid || 0);
  const paidToDateHTML =
    paidToDateValue > 0
      ? `<div><strong>Paid To Date:</strong> $${paidToDateValue.toFixed(2)}</div>`
      : "";

  /* ------------------------------------------------------------
     📋 Itemized Table
  ------------------------------------------------------------ */
  const itemsHTML =
    (invoice.items || [])
      .map(
        (i) => `
        <tr>
          <td>${i.description || "—"}</td>
          <td>${i.quantity ?? "—"}</td>
          <td>$${Number(i.unit_price || 0).toFixed(2)}</td>
          <td>$${Number(i.discount_amount || 0).toFixed(2)}</td>
          <td>$${Number(i.tax_amount || 0).toFixed(2)}</td>
          <td>$${Number(i.total_price || 0).toFixed(2)}</td>
        </tr>`
      )
      .join("") || `<tr><td colspan="6">No items</td></tr>`;

  /* ------------------------------------------------------------
     🧱 Body Content
  ------------------------------------------------------------ */
  const bodyHTML = `
    <!-- 🏢 Organization & Facility -->
    <div class="facility-info mb-3">
      <p><strong>Organization:</strong> ${orgInfo?.name || invoice.organization?.name || "—"}</p>
      <p><strong>Facility:</strong> ${invoice.facility?.name || "—"}</p>
    </div>

    <!-- 📄 Invoice Meta -->
    <div class="invoice-meta">
      <div><strong>Invoice #:</strong> ${invoice.invoice_number || "—"}</div>
      <div><strong>Patient:</strong> ${invoice.patient?.pat_no || ""} – ${invoice.patient?.first_name || ""} ${invoice.patient?.last_name || ""}</div>
      <div><strong>Status:</strong> ${invoice.status || "—"}</div>
      <div><strong>Due Date:</strong> ${formatDate(invoice.due_date)}</div>
      <div><strong>Date:</strong> ${formatDate(invoice.created_at)}</div>
      <div><strong>Created By:</strong> ${
        invoice.createdBy
          ? `${invoice.createdBy.first_name} ${invoice.createdBy.last_name}`
          : "—"
      }</div>
      <div style="grid-column:1 / -1;"><strong>Notes:</strong> ${invoice.notes || "—"}</div>
    </div>

    <!-- 💼 Items -->
    <h5 class="border-bottom pb-1 mt-3">Items</h5>
    <table class="table table-sm items">
      <thead>
        <tr>
          <th>Description</th><th>Qty</th><th>Unit</th>
          <th>Discount</th><th>Tax</th><th>Total</th>
        </tr>
      </thead>
      <tbody>${itemsHTML}</tbody>
    </table>

    <!-- 💵 Totals -->
    <h5 class="border-bottom pb-1 mt-3">Totals</h5>
    <div class="invoice-meta">
      <div><strong>Subtotal:</strong> $${Number(invoice.subtotal || 0).toFixed(2)}</div>
      <div><strong>Discount:</strong> $${Number(invoice.total_discount || 0).toFixed(2)}</div>
      <div><strong>Tax:</strong> $${Number(invoice.total_tax || 0).toFixed(2)}</div>
      <div><strong>Total:</strong> <span class="fw-bold">$${Number(invoice.total || 0).toFixed(2)}</span></div>
      ${paidToDateHTML}
      <div><strong>Refunded:</strong> $${Number(invoice.refunded_amount || 0).toFixed(2)}</div>
      <div><strong>Applied Deposits:</strong> $${Number(invoice.applied_deposits || 0).toFixed(2)}</div>
      <div><strong>Balance:</strong> <span class="fw-bold">$${Number(invoice.balance || 0).toFixed(2)}</span></div>
    </div>

    <!-- 🕓 Print Audit -->
    <div class="mt-3 border-top pt-2 small text-muted">
      Printed by: <strong>${printedBy}</strong><br/>
      Printed at: ${printedAt}
    </div>

    <!-- 🧾 Footer -->
    <div id="receiptFooter" class="mt-3">
      <p class="mb-0">Invoice generated successfully. Thank you for your business.</p>
    </div>
  `;

  /* ------------------------------------------------------------
     🖨️ Dispatch to Printer
  ------------------------------------------------------------ */
  printReceipt("Invoice Receipt", bodyHTML, invoice.organization_id);
}