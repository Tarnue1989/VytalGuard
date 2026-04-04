// 📁 frontend/js/modules/discount-waivers/discount-waiver-summary.js
// ============================================================================
// 🧾 Discount Waiver Receipt (MASTER PARITY — EXACT 1:1)
// 🔹 SAME structure as discount-summary.js
// 🔹 NO receipt-utils
// 🔹 NO org-config
// 🔹 Uses printDocument ONLY
// 🔹 Multi-currency safe
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
   👤 Resolve Current User (MASTER EXACT)
============================================================ */
function getPrintedBy(waiver) {
  try {
    const authSession = JSON.parse(localStorage.getItem("authSession") || "{}");

    return (
      authSession?.name ||
      (waiver?.createdBy
        ? `${waiver.createdBy.first_name} ${waiver.createdBy.last_name}`
        : null) ||
      localStorage.getItem("userName") ||
      "Unknown User"
    );
  } catch {
    return "Unknown User";
  }
}

/* ============================================================
   🧾 BUILD RECEIPT HTML (MASTER STRUCTURE)
============================================================ */
function buildWaiverReceiptHTML(waiver) {
  const printedBy = getPrintedBy(waiver);
  const printedAt = new Date().toLocaleString();

  const currency = waiver?.currency || "USD";

  const money = (v) =>
    `${getCurrencySymbol(currency)} ${Number(v || 0).toFixed(2)}`;

  const invoiceNumber = waiver.invoice
    ? waiver.invoice.invoice_number
    : waiver.invoice_id || "—";

  const valueDisplay =
    waiver.type === "percentage"
      ? `${Number(waiver.percentage || 0)}%`
      : money(waiver.amount);

  const appliedDisplay =
    waiver.applied_total != null
      ? money(waiver.applied_total)
      : "—";

  return `
    <!-- 🏢 Facility -->
    <div style="margin-bottom:12px; font-size:13px;">
      <strong>Facility:</strong> ${waiver.facility?.name || "—"}
    </div>

    <!-- 🔥 GRID HEADER -->
    <div class="grid-2">

      <div>
        <div><strong>Invoice:</strong> ${invoiceNumber}</div>

        <div><strong>Patient:</strong> ${
          waiver.patient
            ? `${waiver.patient.pat_no || "—"} - ${
                waiver.patient.first_name || ""
              } ${waiver.patient.last_name || ""}`
            : "—"
        }</div>
      </div>

      <div>
        <div><strong>Waiver #:</strong> ${
          waiver.waiver_number || "—"
        }</div>

        <div><strong>Date:</strong> ${formatDate(
          waiver.created_at
        )}</div>

        <div><strong>Status:</strong> ${waiver.status || ""}</div>
      </div>

    </div>

    <!-- 📦 DETAILS -->
    <h4 style="margin-top:18px;">Waiver Details</h4>

    <table>
      <thead>
        <tr>
          <th>Description</th>
          <th>Value</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>Type</td>
          <td>${waiver.type || "—"}</td>
        </tr>
        <tr>
          <td>Waiver Value</td>
          <td>${valueDisplay}</td>
        </tr>
        <tr>
          <td>Applied Total</td>
          <td>${appliedDisplay}</td>
        </tr>
        <tr>
          <td>Reason</td>
          <td>${waiver.reason || "—"}</td>
        </tr>
      </tbody>
    </table>

    <!-- 💵 TOTAL (MASTER STYLE) -->
    <div class="totals">

      <div><span>Waiver Value:</span><span>${valueDisplay}</span></div>

      <div class="final">
        <span>Applied Waiver:</span>
        <span>${appliedDisplay}</span>
      </div>

    </div>

    <!-- 🕓 PRINT INFO -->
    <div style="margin-top:20px; font-size:11px;">
      Printed by: <strong>${printedBy}</strong><br/>
      Printed at: ${printedAt}
    </div>

    <!-- 🧾 FOOTER -->
    <div style="margin-top:15px; font-size:12px;">
      Discount waiver processed successfully.
    </div>
  `;
}

/* ============================================================
   🖨️ PRINT (MASTER EXACT)
============================================================ */
export function printDiscountWaiverSummary(waiver) {
  if (!waiver) {
    console.error("❌ No waiver provided for printing");
    return;
  }

  const html = buildWaiverReceiptHTML(waiver);

  printDocument(html, {
    title: "Discount Waiver Receipt",

    invoice: {
      organization: waiver.organization,
      status: waiver.status,
    },

    branding: JSON.parse(localStorage.getItem("branding") || "{}"),
  });
}