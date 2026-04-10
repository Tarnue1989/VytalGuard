// 📁 frontend/js/modules/insurance-claims/insurance-claim-receipt.js
// ============================================================================
// 🧾 Insurance Claim Receipt (INVOICE-STYLE PARITY)
// 🔹 Adapted from payment-receipt.js
// 🔹 Supports claimed / approved / paid amounts
// 🔹 Uses unified printTemplate (logo + branding + watermark)
// ============================================================================

import { printDocument } from "../../templates/printTemplate.js";
import { getCurrencySymbol } from "../../utils/currency-utils.js";

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
   👤 Resolve Printed By
============================================================ */
function getPrintedBy(claim) {
  try {
    const authSession = JSON.parse(localStorage.getItem("authSession") || "{}");

    return (
      authSession?.name ||
      (claim?.createdBy
        ? `${claim.createdBy.first_name} ${claim.createdBy.last_name}`
        : null) ||
      localStorage.getItem("userName") ||
      "Unknown User"
    );
  } catch {
    return "Unknown User";
  }
}

/* ============================================================
   🧾 BUILD CLAIM HTML
============================================================ */
function buildClaimReceiptHTML(claim) {
  const printedBy = getPrintedBy(claim);
  const printedAt = new Date().toLocaleString();

  const money = (v) =>
    `${getCurrencySymbol(claim.currency)} ${Number(v || 0).toFixed(2)}`;

  const invoiceLabel = claim.invoice
    ? `${claim.invoice.invoice_number || "—"}`
    : claim.invoice_id || "—";

  return `
    <!-- 🏢 Facility -->
    <div style="margin-bottom:10px; font-size:13px;">
      <strong>Facility:</strong> ${claim.facility?.name || "—"}
    </div>

    <!-- 🔥 GRID HEADER -->
    <div class="grid-2">

      <div>
        <div><strong>Patient:</strong> ${
          claim.patient?.first_name || ""
        } ${claim.patient?.last_name || ""}</div>

        <div><strong>Patient ID:</strong> ${
          claim.patient?.pat_no || ""
        }</div>
      </div>

      <div>
        <div><strong>Claim #:</strong> ${
          claim.claim_number || "—"
        }</div>

        <div><strong>Status:</strong> ${claim.status || ""}</div>

        <div><strong>Claim Date:</strong> ${formatDate(
          claim.claim_date
        )}</div>

        <div><strong>Response Date:</strong> ${formatDate(
          claim.response_date
        )}</div>
      </div>

    </div>

    <!-- 📦 DETAILS -->
    <h4 style="margin-top:15px;">Claim Details</h4>

    <table>
      <thead>
        <tr>
          <th>Description</th>
          <th>Value</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>Invoice</td>
          <td>${invoiceLabel}</td>
        </tr>
        <tr>
          <td>Provider</td>
          <td>${claim.provider?.name || "—"}</td>
        </tr>
        <tr>
          <td>Payment Ref</td>
          <td>${claim.payment_reference || "—"}</td>
        </tr>
        <tr>
          <td>Rejection Reason</td>
          <td>${claim.rejection_reason || "—"}</td>
        </tr>
        <tr>
          <td>Notes</td>
          <td>${claim.notes || "—"}</td>
        </tr>
      </tbody>
    </table>

    <!-- 💵 TOTALS -->
    <div class="totals">

      <div><span>Amount Claimed:</span><span>${money(
        claim.amount_claimed
      )}</span></div>

      <div><span>Amount Approved:</span><span>${money(
        claim.amount_approved
      )}</span></div>

      <div class="final">
        <span>Amount Paid:</span>
        <span>${money(claim.amount_paid)}</span>
      </div>

    </div>

    <!-- 🕓 AUDIT -->
    <div style="margin-top:20px; font-size:11px;">
      Printed by: <strong>${printedBy}</strong><br/>
      Printed at: ${printedAt}
    </div>

    <!-- 🧾 FOOTER -->
    <div style="margin-top:15px; font-size:12px;">
      Insurance claim summary generated.
    </div>
  `;
}

/* ============================================================
   🖨️ PRINT
============================================================ */
export function printInsuranceClaimReceipt(claim) {
  const html = buildClaimReceiptHTML(claim);

  printDocument(html, {
    title: "Insurance Claim",

    invoice: {
      organization: claim.organization,
      status: claim.status,
    },

    branding: JSON.parse(localStorage.getItem("branding") || "{}"),
  });
}