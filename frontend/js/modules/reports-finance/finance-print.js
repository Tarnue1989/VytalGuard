// 📦 finance-print.js – FINAL CLEAN (FULL STATEMENT + COMMENTS)
// ============================================================
// 🔥 Includes:
//   - Summary (Revenue + Cash + Deposits + Outstanding)
//   - Revenue Table
//   - Payments Table
//   - Clean Audit (Printed by)
// 🔥 Fully structured, no broken HTML, audit-ready
// ============================================================

import { printDocument } from "../../templates/printTemplate.js";

/* ============================================================
   📅 DATE FORMATTER
   → Converts date to readable format (Apr 13, 2026)
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
   💰 MONEY FORMATTER
   → Adds L$ + commas + 2 decimal places
============================================================ */
function money(val) {
  const num = Number(val || 0);
  return "L$" + num.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/* ============================================================
   👤 PRINT AUDIT (SIMPLE + CLEAN)
   → Gets current user from localStorage
============================================================ */
function getPrintedBy() {
  try {
    const user = JSON.parse(localStorage.getItem("user") || "{}");
    return user?.full_name || user?.name || user?.email || "System User";
  } catch {
    return "System User";
  }
}

/* ============================================================
   🏷 LABEL FORMATTER
   → orders → Orders
============================================================ */
function formatLabel(str) {
  return (str || "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/* ============================================================
   🧾 BUILD PRINT HTML
============================================================ */
function buildFinanceReceiptHTML(data = {}) {
  const printedAt = new Date().toLocaleString();

  const services = window.financeServicesData || [];
  const payments = window.financePaymentsData || [];

  /* =========================
     📊 TABLE TOTALS
  ========================= */
  const totalItems = services.reduce((s, r) => s + Number(r.items || 0), 0);
  const totalGross = services.reduce((s, r) => s + Number(r.gross || 0), 0);
  const totalDiscount = services.reduce((s, r) => s + Number(r.discount || 0), 0);
  const totalNet = services.reduce((s, r) => s + Number(r.revenue || 0), 0);

  const totalPayments = payments.reduce((s, r) => s + Number(r.amount || 0), 0);

  return `
    <style>
      /* ===== Layout ===== */
      .grid-2 {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 30px;
      }

      .header-grid {
        display: flex;
        justify-content: space-between;
        margin-bottom: 12px;
      }

      .header-grid .right {
        text-align: right;
      }

      /* ===== Typography ===== */
      h4 {
        margin: 8px 0 4px;
        font-size: 13px;
      }

      .title {
        text-align: center;
        font-weight: bold;
        font-size: 16px;
        margin: 10px 0;
      }

      .section {
        margin-bottom: 16px;
      }

      .muted {
        font-size: 11px;
        color: #555;
      }

      /* ===== Tables ===== */
      table {
        width: 100%;
        border-collapse: collapse;
        font-size: 12px;
      }

      th {
        border-bottom: 2px solid #000;
        font-weight: bold;
      }

      td, th {
        padding: 4px 6px;
        border-bottom: 1px solid #ddd;
      }

      td:last-child, th:last-child {
        text-align: right;
      }

      .final-row td {
        border-top: 1px solid #000;
        font-weight: bold;
      }
    </style>

    <!-- ===================================================== -->
    <!-- 🧾 HEADER -->
    <!-- ===================================================== -->
    <div class="header-grid">
      <div>
        <div><strong>Report:</strong> Finance Summary</div>
        <div><strong>Date:</strong> ${formatDate(new Date())}</div>
      </div>
      <div class="right">
        <div><strong>Status:</strong> Generated</div>
        <div><strong>Currency:</strong> LRD</div>
      </div>
    </div>


    <!-- ===================================================== -->
    <!-- 📊 SUMMARY SECTION (2-COLUMN) -->
    <!-- ===================================================== -->
    <div class="grid-2">

      <!-- 🔹 LEFT: REVENUE -->
      <div class="section">
        <h4>Revenue</h4>
        <table>
          <tr><td>Gross</td><td>${money(data.subtotal)}</td></tr>
          <tr><td>Discount</td><td>${money(data.discounts)}</td></tr>
          <tr><td>Waivers</td><td>${money(data.waivers)}</td></tr>
          <tr class="final-row">
            <td>Net Revenue</td>
            <td>${money(data.gross_total)}</td>
          </tr>
        </table>
      </div>

      <!-- 🔹 RIGHT: CASH + DEPOSITS + OUTSTANDING -->
      <div class="section">

        <!-- 💰 CASH FLOW -->
        <h4>Cash Flow</h4>
        <table>
          <tr><td>Collected</td><td>${money(data.paid)}</td></tr>
          <tr><td>Refunded</td><td>${money(data.payment_refunded)}</td></tr>
          <tr class="final-row">
            <td>Net Cash</td>
            <td>${money(data.net_cash)}</td>
          </tr>
        </table>

        <!-- 🏦 DEPOSITS -->
        <h4 style="margin-top:12px;">Deposits</h4>
        <table>
          <tr><td>Collected</td><td>${money(data.deposit_collected)}</td></tr>
          <tr><td>Used</td><td>${money(data.applied_deposits)}</td></tr>
          <tr><td>Refunded</td><td>${money(data.deposit_refunded)}</td></tr>
          <tr class="final-row">
            <td>Balance</td>
            <td>${money(data.deposit_balance)}</td>
          </tr>
        </table>

        <!-- ⚠️ OUTSTANDING -->
        <h4 style="margin-top:12px;">Outstanding</h4>
        <table>
          <tr class="final-row">
            <td>Total Outstanding</td>
            <td>${money(data.outstanding)}</td>
          </tr>
        </table>

      </div>
    </div>

    <!-- ===================================================== -->
    <!-- 📊 REVENUE BY SERVICE TABLE -->
    <!-- ===================================================== -->
    <h4>Revenue by Service</h4>
    <table>
      <thead>
        <tr>
          <th>Service</th>
          <th>Items</th>
          <th>Gross</th>
          <th>Discount</th>
          <th>Net</th>
        </tr>
      </thead>
      <tbody>
        ${services.map(r => `
          <tr>
            <td>${formatLabel(r.module)}</td>
            <td>${r.items}</td>
            <td>${money(r.gross)}</td>
            <td>${money(r.discount)}</td>
            <td>${money(r.revenue)}</td>
          </tr>
        `).join("")}
        <tr class="final-row">
          <td>TOTAL</td>
          <td>${totalItems}</td>
          <td>${money(totalGross)}</td>
          <td>${money(totalDiscount)}</td>
          <td>${money(totalNet)}</td>
        </tr>
      </tbody>
    </table>

    <!-- ===================================================== -->
    <!-- 💳 PAYMENTS TABLE -->
    <!-- ===================================================== -->
    <h4>Payments by Method</h4>
    <table>
      <thead>
        <tr>
          <th>Method</th>
          <th>Amount</th>
          <th>%</th>
        </tr>
      </thead>
      <tbody>
        ${payments.map(r => `
          <tr>
            <td>${formatLabel(r.method)}</td>
            <td>${money(r.amount)}</td>
            <td>${totalPayments ? ((r.amount / totalPayments) * 100).toFixed(1) : 0}%</td>
          </tr>
        `).join("")}
        <tr class="final-row">
          <td>TOTAL</td>
          <td>${money(totalPayments)}</td>
          <td>100%</td>
        </tr>
      </tbody>
    </table>

    <!-- ===================================================== -->
    <!-- 🧾 AUDIT FOOTER -->
    <!-- ===================================================== -->
    <div class="muted" style="margin-top:14px;">
      Printed by: ${getPrintedBy()} <br/>
      Printed at: ${printedAt}
    </div>
  `;
}

/* ============================================================
   🖨️ PRINT ENTRY POINT
============================================================ */
export function printFinanceSummary(summaryData = {}) {
  const html = buildFinanceReceiptHTML(summaryData);

  printDocument(html, {
    title: "Finance Report",
    invoice: {
      organization: summaryData.organization,
      status: "generated",
    },
    branding: JSON.parse(localStorage.getItem("branding") || "{}"),
  });
}