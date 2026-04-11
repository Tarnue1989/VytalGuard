// 📁 invoice-receipt.js – ENTERPRISE FINAL (NO BADGE)
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
   💱 MONEY FORMATTER
============================================================ */
function money(value) {
  return Number(value || 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/* ============================================================
   🎯 STATUS META
============================================================ */
function getStatusMeta(status) {
  const s = (status || "").toLowerCase();

  if (s === "paid")
    return { label: "PAID", watermark: "PAID" };

  if (s === "partial")
    return { label: "PARTIAL PAYMENT", watermark: "PARTIAL" };

  return { label: "UNPAID", watermark: "UNPAID" };
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

  const { label, watermark } = getStatusMeta(invoice.status);

  /* ================= ITEMS ================= */
  const itemsHTML =
    (invoice.items || [])
      .map(
        (i) => `
        <tr>
          <td>${safe(i.description)}</td>
          <td>${safe(i.quantity)}</td>
          <td>${money(i.unit_price)}</td>
          <td>${money(i.discount_amount)}</td>
          <td>${money(i.tax_amount)}</td>
          <td>${money(i.total_price)}</td>
          <td>${money(i.insurance_amount)}</td>
          <td>${money(i.patient_amount)}</td>
        </tr>`
      )
      .join("") || `<tr><td colspan="8">No items</td></tr>`;

  return `
    <div style="position:relative;">

      <!-- 🔥 WATERMARK -->
      <div style="
        position:absolute;
        top:40%;
        left:50%;
        transform:translate(-50%, -50%) rotate(-25deg);
        font-size:90px;
        color:rgba(0,0,0,0.05);
        font-weight:bold;
        pointer-events:none;
        z-index:0;
      ">
        ${watermark}
      </div>

      <!-- CONTENT -->
      <div style="position:relative; z-index:1;">

        <div style="margin-bottom:12px; font-size:13px;">
          <strong>Facility:</strong> ${safe(invoice.facility?.name)}
        </div>

        <div class="grid-2">

          <div>
            <div><strong>Patient:</strong> ${patientName}</div>
            <div><strong>Patient ID:</strong> ${patientId}</div>
          </div>

          <div>
            <div><strong>Invoice #:</strong> ${safe(invoice.invoice_number)}</div>
            <div><strong>Date:</strong> ${formatDate(invoice.created_at)}</div>

            <!-- ✅ CLEAN STATUS (NO BADGE) -->
            <div>
              <strong>Status:</strong> ${label}
            </div>

            <div><strong>Currency:</strong> ${safe(invoice.currency)}</div>
            <div><strong>Claim No:</strong> ${
              invoice.insuranceClaim?.claim_number || "—"
            }</div>
          </div>

        </div>

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
              <th>Insurance</th>
              <th>Patient</th>
            </tr>
          </thead>
          <tbody>${itemsHTML}</tbody>
        </table>

        <!-- TOTALS -->
        <div style="
          margin-top:20px;
          display:flex;
          justify-content:flex-end;
        ">
          <div style="width:300px;">

            <div style="display:flex; justify-content:space-between;">
              <span>Subtotal:</span>
              <span>${money(invoice.subtotal)}</span>
            </div>

            <div style="display:flex; justify-content:space-between;">
              <span>Discount:</span>
              <span>${money(invoice.total_discount)}</span>
            </div>

            <div style="display:flex; justify-content:space-between;">
              <span>Tax:</span>
              <span>${money(invoice.total_tax)}</span>
            </div>

            <div style="display:flex; justify-content:space-between;">
              <span>Deposits:</span>
              <span>${money(invoice.applied_deposits)}</span>
            </div>

            <div style="display:flex; justify-content:space-between;">
              <span>Insurance:</span>
              <span>${money(invoice.coverage_amount)}</span>
            </div>

            <div style="display:flex; justify-content:space-between;">
              <span>Paid:</span>
              <span>${money(invoice.total_paid)}</span>
            </div>

            <div style="display:flex; justify-content:space-between;">
              <span>Refunded:</span>
              <span>${money(invoice.refunded_amount)}</span>
            </div>

            <div style="border-top:2px solid #000; margin:8px 0;"></div>

            <div style="
              display:flex;
              justify-content:space-between;
              font-size:16px;
              font-weight:bold;
            ">
              <span>Balance:</span>
              <span>${money(invoice.balance)}</span>
            </div>

          </div>
        </div>

        <div style="margin-top:20px; font-size:11px;">
          Printed by: <strong>${printedBy}</strong><br/>
          Printed at: ${printedAt}
        </div>

        <div style="margin-top:15px; font-size:12px;">
          Thank you for your business.
        </div>

      </div>
    </div>
  `;
}

/* ============================================================
   🖨️ PRINT
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