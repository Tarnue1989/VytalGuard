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
   🧾 BUILD PRINT HTML (FINAL — CARD + FULL DETAIL)
============================================================ */
function buildFinanceReceiptHTML(data = {}) {
  const printedAt = new Date().toLocaleString();

  const summary = data.summary || [];
  const deposits = data.deposits || {};
  const expenses = data.expenses || [];

  const services = window.financeServicesData || [];
  const payments = window.financePaymentsData || [];

  /* =========================
     💰 FORMATTER
  ========================= */
  const money = (val, cur) => {
    const sym = { USD: "$", LRD: "L$" }[cur] || "";
    return `${sym}${Number(val || 0).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  /* =========================
     🔥 LABELED ROWS (KEY FIX)
  ========================= */
  const labeledLines = (arr, fields) => {
    if (!Array.isArray(arr)) return "";

    return arr.map(r => {
      return fields.map(f => `
        <div class="row-line">
          <span>${f.label} (${r.currency})</span>
          <span>${money(r[f.key], r.currency)}</span>
        </div>
      `).join("");
    }).join("");
  };

  /* =========================
     💰 PROFIT
  ========================= */
  const profitLines = summary.map(s => {
    const exp = expenses.find(e => e.currency === s.currency);
    const profit = Number(s.net_cash || 0) - Number(exp?.total || 0);

    return `
      <div class="row-line">
        <span>Profit (${s.currency})</span>
        <span>${money(profit, s.currency)}</span>
      </div>
    `;
  }).join("");

  return `
    <style>
      body {
        font-family: Arial, sans-serif;
        font-size: 11px;
        margin: 10px;
      }

      .title {
        text-align: center;
        font-size: 16px;
        font-weight: bold;
        margin-bottom: 10px;
      }

      .grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 12px;
      }

      .card {
        border: 1px solid #ddd;
        border-radius: 6px;
        padding: 8px;
      }

      .card h4 {
        margin: 0 0 6px;
        font-size: 12px;
        border-bottom: 1px solid #eee;
        padding-bottom: 3px;
      }

      .row-line {
        display: flex;
        justify-content: space-between;
        padding: 2px 0;
      }

      .row-line span:last-child {
        font-weight: 600;
        font-variant-numeric: tabular-nums;
      }

      .section-title {
        margin-top: 10px;
        font-weight: bold;
      }

      table {
        width: 100%;
        border-collapse: collapse;
        margin-top: 6px;
        font-size: 10.5px;
      }

      th, td {
        padding: 3px;
        border-bottom: 1px solid #ddd;
      }

      th {
        text-align: left;
      }

      td:last-child {
        text-align: right;
      }

      .footer {
        margin-top: 12px;
        font-size: 10px;
        color: #555;
      }
    </style>

    <!-- HEADER -->
    <div class="title">Finance Report</div>

    <!-- ================= CARDS ================= -->
    <div class="grid">

      <!-- REVENUE -->
      <div class="card">
        <h4>Revenue</h4>
        ${labeledLines(summary, [
          { key: "subtotal", label: "Gross" },
          { key: "discounts", label: "Discount" },
          { key: "waivers", label: "Waivers" },
          { key: "gross_total", label: "Net" },
        ])}
      </div>

      <!-- CASH FLOW -->
      <div class="card">
        <h4>Cash Flow</h4>
        ${labeledLines(summary, [
          { key: "paid", label: "Collected" },
          { key: "payment_refunded", label: "Refunded" },
          { key: "net_cash", label: "Net Cash" },
        ])}
      </div>

      <!-- DEPOSITS -->
      <div class="card">
        <h4>Deposits</h4>
        ${labeledLines(deposits.collected, [{ key: "collected", label: "Collected" }])}
        ${labeledLines(deposits.applied, [{ key: "applied", label: "Used" }])}
        ${labeledLines(deposits.deposit_refunded, [{ key: "refunded", label: "Refunded" }])}
        ${labeledLines(deposits.remaining, [{ key: "remaining", label: "Balance" }])}
      </div>

      <!-- EXPENSES -->
      <div class="card">
        <h4>Expenses</h4>
        ${labeledLines(expenses, [{ key: "total", label: "Total" }])}
      </div>

      <!-- OUTSTANDING -->
      <div class="card">
        <h4>Outstanding</h4>
        ${labeledLines(summary, [{ key: "outstanding", label: "Total" }])}
      </div>

      <!-- PROFIT -->
      <div class="card">
        <h4>Profit</h4>
        ${profitLines}
      </div>

    </div>

    <!-- ================= SERVICES ================= -->
    <div class="section-title">Revenue by Service</div>
    <table>
      <tr>
        <th>Service</th>
        <th>Items</th>
        <th>Gross</th>
        <th>Net</th>
      </tr>
      ${services.map(r => `
        <tr>
          <td>${formatLabel(r.module)}</td>
          <td>${r.items}</td>
          <td>L$${Number(r.gross).toLocaleString()}</td>
          <td>L$${Number(r.revenue).toLocaleString()}</td>
        </tr>
      `).join("")}
    </table>

    <!-- ================= PAYMENTS ================= -->
    <div class="section-title">Payments</div>
    <table>
      <tr>
        <th>Method</th>
        <th>Currency</th>
        <th>Amount</th>
      </tr>
      ${payments.map(r => `
        <tr>
          <td>${formatLabel(r.method)}</td>
          <td>${r.currency}</td>
          <td>${money(r.amount, r.currency)}</td>
        </tr>
      `).join("")}
    </table>

    <!-- FOOTER -->
    <div class="footer">
      Printed by: ${getPrintedBy()}<br/>
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