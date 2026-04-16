// 📁 frontend/js/modules/cash-closing/cash-closing-receipt.js
// ============================================================================
// 🧾 Cash Closing Receipt (ENTERPRISE FINAL — AUDIT IMPROVED)
// 🔹 Clear separation: Closing Audit vs Print Audit
// 🔹 Currency fallback fixed
// 🔹 Ledger-safe totals
// 🔹 Multi-tenant safe
// 🔹 Clean enterprise output
// ============================================================================

import { printDocument } from "../../templates/printTemplate.js";

/* ============================================================
   📅 DATE FORMAT
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
   👤 PRINTED BY (MASTER PARITY)
============================================================ */
function getPrintedBy(entry) {
  try {
    const authSession = JSON.parse(localStorage.getItem("authSession") || "{}");

    return (
      authSession?.name ||
      (entry?.closedBy
        ? `${entry.closedBy.first_name || ""} ${entry.closedBy.last_name || ""}`.trim()
        : null) ||
      localStorage.getItem("userName") ||
      "Unknown User"
    );
  } catch {
    return "Unknown User";
  }
}

/* ============================================================
   💱 MONEY FORMAT (NO SYMBOL HERE)
============================================================ */
function money(v) {
  return Number(v || 0).toFixed(2);
}

/* ============================================================
   🧾 BUILD HTML
============================================================ */
function buildClosingReceiptHTML(entry) {
  const printedBy = getPrintedBy(entry);
  const printedAt = new Date().toLocaleString();

  const closedBy = entry.closedBy
    ? `${entry.closedBy.first_name || ""} ${entry.closedBy.last_name || ""}`.trim()
    : "—";

  const closedAt = entry.closed_at
    ? new Date(entry.closed_at).toLocaleString()
    : "—";

  return `
    <!-- 🏢 FACILITY -->
    <div style="margin-bottom:12px; font-size:13px;">
      <strong>Facility:</strong> ${entry.facility?.name || "—"}
    </div>

    <!-- 🔥 HEADER GRID -->
    <div class="grid-2">

      <div>
        <div><strong>Account:</strong> ${entry.account?.name || "—"}</div>
        <div><strong>Organization:</strong> ${entry.organization?.name || "—"}</div>
      </div>

      <div>
        <div><strong>Date:</strong> ${formatDate(entry.date)}</div>
        <div><strong>Status:</strong> ${
          entry.is_locked ? "LOCKED" : "OPEN"
        }</div>
        <div><strong>Currency:</strong> ${entry.currency || "USD"}</div>
      </div>

    </div>

    <!-- 📊 DETAILS -->
    <h4 style="margin-top:18px;">Closing Summary</h4>

    <table>
      <thead>
        <tr>
          <th>Description</th>
          <th>Amount</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>Opening Balance</td>
          <td>${money(entry.opening_balance)}</td>
        </tr>
        <tr>
          <td>Total In</td>
          <td>${money(entry.total_in)}</td>
        </tr>
        <tr>
          <td>Total Out</td>
          <td>${money(entry.total_out)}</td>
        </tr>
        <tr>
          <td>Closing Balance</td>
          <td>${money(entry.closing_balance)}</td>
        </tr>
      </tbody>
    </table>

    <!-- 🔒 STATUS -->
    <div class="totals">
      <div class="final">
        <span>Final Status:</span>
        <span>${entry.is_locked ? "LOCKED" : "OPEN"}</span>
      </div>
    </div>

    <!-- 🕓 AUDIT (IMPROVED) -->
    <div style="margin-top:20px; font-size:11px;">

      <!-- 🔒 Closing Audit -->
      <div style="margin-bottom:8px;">
        <strong>Closing Audit</strong><br/>
        Closed by: <strong>${closedBy}</strong><br/>
        Closed at: ${closedAt}
      </div>

      <!-- 🖨 Print Audit -->
      <div>
        <strong>Print Audit</strong><br/>
        Printed by: <strong>${printedBy}</strong><br/>
        Printed at: ${printedAt}
      </div>

    </div>

    <!-- 🧾 FOOTER -->
    <div style="margin-top:15px; font-size:12px;">
      End of day cash reconciliation report.
    </div>
  `;
}

/* ============================================================
   🖨️ PRINT
============================================================ */
export function printCashClosingReceipt(entry) {
  const html = buildClosingReceiptHTML(entry);

  printDocument(html, {
    title: "Cash Closing Report",

    invoice: {
      organization: entry.organization,
      status: entry.is_locked ? "LOCKED" : "OPEN",
    },

    branding: JSON.parse(localStorage.getItem("branding") || "{}"),
  });
}