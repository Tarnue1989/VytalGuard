// 📁 invoice-receipt.js – ENTERPRISE FINAL (FINAL STRUCTURE)
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

  if (s === "paid") return { label: "PAID", watermark: "PAID" };
  if (s === "partial") return { label: "PARTIAL PAYMENT", watermark: "PARTIAL" };

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

  /* ================= FINANCIAL ================= */
  const total = Number(invoice.total || 0);
  const insurance = Number(invoice.insurance_amount || 0);
  const patientPortion = total - insurance;

  const deposits = Number(invoice.applied_deposits || 0);
  const paid = Number(invoice.total_paid || 0);

  const paymentRefund = Number(invoice.refunded_amount || 0);

  const depositRefund =
    Number(
      invoice.appliedDeposits?.reduce(
        (sum, d) => sum + Number(d.refund_amount || 0),
        0
      ) || 0
    );

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
    <div style="position:relative; font-size:12px; line-height:1.3;">

      <!-- WATERMARK -->
      <div style="
        position:absolute;
        top:45%;
        left:50%;
        transform:translate(-50%, -50%) rotate(-25deg);
        font-size:80px;
        color:rgba(0,0,0,0.04);
        font-weight:bold;
        pointer-events:none;
        z-index:0;
      ">
        ${watermark}
      </div>

      <div style="position:relative; z-index:1;">

        <!-- HEADER -->
        <div style="display:flex; justify-content:space-between; margin-bottom:10px;">
          <div>
            <div><strong>Facility:</strong> ${safe(invoice.facility?.name)}</div>
            <div><strong>Patient:</strong> ${patientName}</div>
            <div><strong>ID:</strong> ${patientId}</div>
          </div>

          <div style="text-align:right;">
            <div><strong>Invoice:</strong> ${safe(invoice.invoice_number)}</div>
            <div><strong>Date:</strong> ${formatDate(invoice.created_at)}</div>
            <div><strong>Status:</strong> ${label}</div>
            <div><strong>Curr:</strong> ${safe(invoice.currency)}</div>
            <div><strong>Claim:</strong> ${
              invoice.insuranceClaim?.claim_number || "—"
            }</div>
          </div>
        </div>

        <!-- ITEMS -->
        <table style="margin-top:8px;">
          <thead>
            <tr>
              <th>Item</th>
              <th>Qty</th>
              <th>Rate</th>
              <th>Disc</th>
              <th>Tax</th>
              <th>Total</th>
              <th>Ins</th>
              <th>Pt</th>
            </tr>
          </thead>
          <tbody>${itemsHTML}</tbody>
        </table>

        <!-- 🔥 SUMMARY FINAL STRUCTURE -->
        <div style="margin-top:12px; display:flex; justify-content:flex-end;">
          <div style="width:520px; font-size:12px;">

            <!-- SUBTOTAL -->
            <div style="display:flex; justify-content:space-between; font-weight:600;">
              <span>Subtotal</span>
              <span>${money(invoice.subtotal)}</span>
            </div>

            <div style="border-top:1px dashed #bbb; margin:6px 0;"></div>

            <!-- 3 COLUMN BREAKDOWN -->
            <div style="display:flex; gap:20px;">

              <!-- COL 1 -->
              <div style="flex:1;">
                <div style="display:flex; justify-content:space-between;">
                  <span>Discount</span>
                  <span>${money(invoice.total_discount)}</span>
                </div>

                <div style="display:flex; justify-content:space-between;">
                  <span>Tax</span>
                  <span>${money(invoice.total_tax)}</span>
                </div>
              </div>

              <!-- COL 2 -->
              <div style="flex:1;">
                <div style="display:flex; justify-content:space-between;">
                  <span>Deposits</span>
                  <span>${money(deposits)}</span>
                </div>

                <div style="display:flex; justify-content:space-between;">
                  <span>Dep Refund</span>
                  <span>${money(depositRefund)}</span>
                </div>
              </div>

              <!-- COL 3 -->
              <div style="flex:1;">
                <div style="display:flex; justify-content:space-between;">
                  <span>Insurance</span>
                  <span>${money(insurance)}</span>
                </div>

                <div style="display:flex; justify-content:space-between;">
                  <span>Patient</span>
                  <span>${money(patientPortion)}</span>
                </div>

                <div style="display:flex; justify-content:space-between;">
                  <span>Payments</span>
                  <span>${money(paid)}</span>
                </div>

                <div style="display:flex; justify-content:space-between;">
                  <span>Pay Refund</span>
                  <span>${money(paymentRefund)}</span>
                </div>
              </div>

            </div>

            <div style="border-top:2px solid #000; margin:8px 0;"></div>

            <!-- BALANCE -->
            <div style="
              display:flex;
              justify-content:space-between;
              font-weight:700;
              font-size:16px;
            ">
              <span>Balance</span>
              <span>${money(invoice.balance)}</span>
            </div>

          </div>
        </div>

        <!-- FOOTER -->
        <div style="margin-top:12px; font-size:11px;">
          Printed by: <strong>${printedBy}</strong> | ${printedAt}
        </div>

        <div style="margin-top:6px; font-size:11px;">
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