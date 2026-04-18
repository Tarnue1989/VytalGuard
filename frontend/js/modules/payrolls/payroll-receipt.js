// 📁 payroll-receipt.js – Payroll Receipt (FULLY UPDATED — Controller + Payment Config + Expense)

import { printDocument } from "../../templates/printTemplate.js";

/* ============================================================ */
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

/* ============================================================ */
function getPrintedBy(payroll) {
  try {
    const authSession = JSON.parse(localStorage.getItem("authSession") || "{}");

    return (
      authSession?.name ||
      (payroll?.createdBy
        ? `${payroll.createdBy.first_name} ${payroll.createdBy.last_name}`
        : null) ||
      localStorage.getItem("userName") ||
      "Unknown User"
    );
  } catch {
    return "Unknown User";
  }
}

/* ============================================================ */
function money(value) {
  return Number(value || 0).toFixed(2);
}

/* ============================================================ */
function buildPayrollReceiptHTML(payroll) {
  const printedBy = getPrintedBy(payroll);
  const printedAt = new Date().toLocaleString();

  return `
    <!-- 🏢 Facility -->
    <div style="margin-bottom:12px; font-size:13px;">
      <strong>Organization:</strong> ${payroll.organization?.name || "—"}<br/>
      <strong>Facility:</strong> ${payroll.facility?.name || "—"}
    </div>

    <!-- 🔥 HEADER -->
    <div class="grid-2">

      <div>
        <div><strong>Employee:</strong> ${
          payroll.employee?.first_name || ""
        } ${payroll.employee?.last_name || ""}</div>
      </div>

      <div>
        <div><strong>Payroll #:</strong> ${
          payroll.payroll_number || "—"
        }</div>

        <div><strong>Period:</strong> ${payroll.period || "—"}</div>

        <div><strong>Date:</strong> ${formatDate(
          payroll.created_at
        )}</div>

        <div><strong>Status:</strong> ${payroll.status || ""}</div>

        <div><strong>Currency:</strong> ${
          payroll.currency || "—"
        }</div>
      </div>

    </div>

    <!-- 📦 DETAILS -->
    <h4 style="margin-top:18px;">Payroll Details</h4>

    <table>
      <thead>
        <tr>
          <th>Description</th>
          <th>Amount</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>Basic Salary</td>
          <td>${money(payroll.basic_salary)}</td>
        </tr>
        <tr>
          <td>Allowances</td>
          <td>${money(payroll.allowances)}</td>
        </tr>
        <tr>
          <td>Deductions</td>
          <td>${money(payroll.deductions)}</td>
        </tr>
      </tbody>
    </table>

    <!-- 💵 TOTAL -->
    <div class="totals">
      <div class="final">
        <span>Net Salary:</span>
        <span>${money(payroll.net_salary)}</span>
      </div>
    </div>

    <!-- 💳 PAYMENT CONFIG -->
    <h4 style="margin-top:18px;">Payment Details</h4>

    <table>
      <tbody>
        <tr>
          <td><strong>Account</strong></td>
          <td>${payroll.account?.name || payroll.account_id || "—"}</td>
        </tr>
        <tr>
          <td><strong>Category</strong></td>
          <td>${payroll.category || "—"}</td>
        </tr>
        <tr>
          <td><strong>Payment Method</strong></td>
          <td>${payroll.payment_method || "—"}</td>
        </tr>
        <tr>
          <td><strong>Expense Ref</strong></td>
          <td>${payroll.expense?.expense_number || "—"}</td>
        </tr>
      </tbody>
    </table>

    <!-- 🕓 AUDIT -->
    <div style="margin-top:20px; font-size:11px;">
      Printed by: <strong>${printedBy}</strong><br/>
      Printed at: ${printedAt}
    </div>

    <!-- 🧾 FOOTER -->
    <div style="margin-top:15px; font-size:12px;">
      Payroll processed successfully.
    </div>
  `;
}

/* ============================================================ */
export function printPayrollReceipt(payroll) {
  const html = buildPayrollReceiptHTML(payroll);

  printDocument(html, {
    title: "Payroll Receipt",

    invoice: {
      organization: payroll.organization,
      status: payroll.status,
    },

    branding: JSON.parse(localStorage.getItem("branding") || "{}"),
  });
}