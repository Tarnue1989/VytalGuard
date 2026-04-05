// 📁 frontend/js/modules/refundDeposits/refundDeposit-receipt.js
// ============================================================================
// 🧾 Deposit Refund Receipt (ENTERPRISE MASTER PARITY — FINAL FIXED)
// 🔹 FULL parity with refund-receipt.js + payment-receipt.js
// 🔹 Currency-safe (NO HARDCODED $)
// 🔹 Audit-first printedBy
// 🔹 Clean + deterministic output
// 🔹 ADDED refund_deposit_number (NO UUID)
// ============================================================================

import { printDocument } from "../../templates/printTemplate.js";
import { getCurrencySymbol } from "../../utils/currency-utils.js";

/* ============================================================
   📅 Date Formatter (MASTER)
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
   👤 Resolve Printed By (AUDIT-FIRST — MASTER EXACT)
============================================================ */
function getPrintedBy(refund) {
  try {
    if (refund?.processedBy) {
      return `${refund.processedBy.first_name} ${refund.processedBy.last_name}`;
    }

    if (refund?.approvedBy) {
      return `${refund.approvedBy.first_name} ${refund.approvedBy.last_name}`;
    }

    if (refund?.createdBy) {
      return `${refund.createdBy.first_name} ${refund.createdBy.last_name}`;
    }

    const authSession = JSON.parse(localStorage.getItem("authSession") || "{}");
    return authSession?.name || "System";
  } catch {
    return "System";
  }
}

/* ============================================================
   🧾 BUILD RECEIPT HTML (CURRENCY SAFE)
============================================================ */
function buildRefundDepositReceiptHTML(refund) {
  const printedBy = getPrintedBy(refund);
  const printedAt = new Date().toLocaleString();

  const money = (v) =>
    `${getCurrencySymbol(refund.currency)} ${Number(v || 0).toFixed(2)}`;

  const refundRef = refund.refund_deposit_number || "—";

  const depositRef =
    refund.deposit?.transaction_ref ||
    refund.deposit?.deposit_ref ||
    "—";

  const openingBalance = Number(refund.deposit?.balance_before ?? 0);
  const refundAmount = Number(refund.refund_amount ?? 0);
  const closingBalance = Number(
    refund.deposit?.balance_after ??
      refund.deposit?.remaining_balance ??
      0
  );

  return `
    <!-- 🏢 Facility -->
    <div style="margin-bottom:12px; font-size:13px;">
      <strong>Facility:</strong> ${refund.facility?.name || "—"}
    </div>

    <!-- 🔥 GRID HEADER -->
    <div class="grid-2">

      <div>
        <div><strong>Patient:</strong> ${
          refund.patient?.first_name || ""
        } ${refund.patient?.last_name || ""}</div>

        <div><strong>Patient ID:</strong> ${
          refund.patient?.pat_no || ""
        }</div>
      </div>

      <div>
        <div><strong>Refund #:</strong> ${refundRef}</div>

        <div><strong>Deposit Ref:</strong> ${depositRef}</div>

        <div><strong>Date:</strong> ${formatDate(
          refund.created_at
        )}</div>

        <div><strong>Status:</strong> ${refund.status || "—"}</div>
      </div>

    </div>

    <!-- 📦 DETAILS -->
    <h4 style="margin-top:18px;">Refund Details</h4>

    <table>
      <thead>
        <tr>
          <th>Method</th>
          <th>Reason</th>
          <th>Processed By</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>${refund.method || "—"}</td>
          <td>${refund.reason || "—"}</td>
          <td>${printedBy}</td>
        </tr>
      </tbody>
    </table>

    <!-- 💵 TOTALS -->
    <div class="totals">

      <div>
        <span>Opening Balance:</span>
        <span>${money(openingBalance)}</span>
      </div>

      <div>
        <span>Refund Amount:</span>
        <span>${money(refundAmount)}</span>
      </div>

      <div class="final">
        <span>Closing Balance:</span>
        <span>${money(closingBalance)}</span>
      </div>

    </div>

    <!-- 🕓 AUDIT -->
    <div style="margin-top:20px; font-size:11px;">
      Printed by: <strong>${printedBy}</strong><br/>
      Printed at: ${printedAt}
    </div>

    <!-- 🧾 FOOTER -->
    <div style="margin-top:15px; font-size:12px;">
      Deposit refund processed successfully.
    </div>
  `;
}

/* ============================================================
   🖨️ PRINT (MASTER EXACT)
============================================================ */
export function printRefundDepositReceipt(refund) {
  const html = buildRefundDepositReceiptHTML(refund);

  printDocument(html, {
    title: "Deposit Refund Receipt",

    invoice: {
      organization: refund.organization,
      status: refund.status,
    },

    branding: JSON.parse(localStorage.getItem("branding") || "{}"),
  });
}