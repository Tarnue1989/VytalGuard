// 📁 invoice-receipt.js – FINAL (A4 + ORG-SAFE + NO GLOBAL OVERRIDE)

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
   👤 Resolve Current User
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
   🧾 BUILD RECEIPT HTML
============================================================ */
export function buildInvoiceReceiptHTML(invoice) {
  const printedBy = getPrintedBy(invoice);
  const printedAt = new Date().toLocaleString();

  const paidToDateValue = Number(invoice.total_paid ?? 0);
  const paidToDateHTML =
    paidToDateValue > 0
      ? `<div><span>Paid:</span><span>$${paidToDateValue.toFixed(2)}</span></div>`
      : "";

  /* ================= ITEMS ================= */
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

  return `
    <!-- 🏢 Org -->
    <div style="margin-bottom:10px; font-size:13px;">
      <strong>Facility:</strong> ${invoice.facility?.name || "—"}
    </div>

    <!-- 🔥 GRID HEADER -->
    <div class="grid-2">

      <div>
        <div><strong>Patient:</strong> ${
          invoice.patient?.first_name || ""
        } ${invoice.patient?.last_name || ""}</div>

        <div><strong>Patient ID:</strong> ${
          invoice.patient?.pat_no || ""
        }</div>
      </div>

      <div>
        <div><strong>Invoice #:</strong> ${
          invoice.invoice_number || ""
        }</div>

        <div><strong>Date:</strong> ${formatDate(
          invoice.created_at
        )}</div>

        <div><strong>Status:</strong> ${invoice.status || ""}</div>
      </div>

    </div>

    <!-- 📦 ITEMS -->
    <h4 style="margin-top:15px;">Items</h4>

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

      <div><span>Subtotal:</span><span>$${Number(
        invoice.subtotal || 0
      ).toFixed(2)}</span></div>

      <div><span>Discount:</span><span>$${Number(
        invoice.total_discount || 0
      ).toFixed(2)}</span></div>

      <div><span>Tax:</span><span>$${Number(
        invoice.total_tax || 0
      ).toFixed(2)}</span></div>

      ${paidToDateHTML}

      <div><span>Deposits:</span><span>$${Number(
        invoice.applied_deposits || 0
      ).toFixed(2)}</span></div>

      <div><span>Refunded:</span><span>$${Number(
        invoice.refunded_amount || 0
      ).toFixed(2)}</span></div>

      <div class="final">
        <span>Balance:</span>
        <span>$${Number(invoice.balance || 0).toFixed(2)}</span>
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