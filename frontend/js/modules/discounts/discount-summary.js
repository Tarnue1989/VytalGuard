// 📁 frontend/js/modules/discounts/discount-summary.js
// ============================================================================
// 🧾 Discount Receipt (INVOICE-STYLE PARITY — FINAL)
// 🔹 Payment-aligned currency handling (NO $ HARDCODE)
// 🔹 Multi-currency safe (USD / LRD / etc.)
// 🔹 SAME structure as Deposit / Payment
// 🔹 Enterprise safe
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
   👤 Resolve Current User
============================================================ */
function getPrintedBy(discount) {
  try {
    const authSession = JSON.parse(localStorage.getItem("authSession") || "{}");

    return (
      authSession?.name ||
      (discount?.createdBy
        ? `${discount.createdBy.first_name} ${discount.createdBy.last_name}`
        : null) ||
      localStorage.getItem("userName") ||
      "Unknown User"
    );
  } catch {
    return "Unknown User";
  }
}

/* ============================================================
   👤 Resolve Patient (MASTER SAFE)
============================================================ */
function resolvePatient(discount) {
  const p = discount.patient || discount.invoice?.patient;
  if (!p) return "—";

  const name = [p.first_name, p.middle_name, p.last_name]
    .filter(Boolean)
    .join(" ");

  return `${p.pat_no || "—"} - ${name || "—"}`;
}

/* ============================================================
   🧾 BUILD RECEIPT HTML
============================================================ */
function buildDiscountReceiptHTML(discount) {
  const printedBy = getPrintedBy(discount);
  const printedAt = new Date().toLocaleString();

  const money = (v) =>
    `${getCurrencySymbol(discount.currency)} ${Number(v || 0).toFixed(2)}`;

  const invoiceNumber = discount.invoice
    ? discount.invoice.invoice_number
    : discount.invoice_id || "—";

  const valueDisplay =
    discount.type === "percentage"
      ? `${Number(discount.value || 0)}%`
      : money(discount.value);

  const appliedDisplay =
    discount.applied_amount != null
      ? money(discount.applied_amount)
      : "—";

  return `
    <!-- 🏢 Facility -->
    <div style="margin-bottom:12px; font-size:13px;">
      <strong>Facility:</strong> ${discount.facility?.name || "—"}
    </div>

    <!-- 🔥 GRID HEADER -->
    <div class="grid-2">

      <div>
        <div><strong>Invoice:</strong> ${invoiceNumber}</div>

        <div><strong>Patient:</strong> ${resolvePatient(discount)}</div>

        <div><strong>Item:</strong> ${
          discount.invoiceItem?.description || "—"
        }</div>
      </div>

      <div>
        <div><strong>Discount #:</strong> ${
          discount.discount_number || "—"
        }</div>

        <div><strong>Date:</strong> ${formatDate(discount.created_at)}</div>

        <div><strong>Status:</strong> ${discount.status || ""}</div>
      </div>

    </div>

    <!-- 📦 DETAILS -->
    <h4 style="margin-top:18px;">Discount Details</h4>

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
          <td>${discount.type || "—"}</td>
        </tr>
        <tr>
          <td>Discount Value</td>
          <td>${valueDisplay}</td>
        </tr>
        <tr>
          <td>Applied Amount</td>
          <td>${appliedDisplay}</td>
        </tr>
        <tr>
          <td>Reason</td>
          <td>${discount.reason || "—"}</td>
        </tr>
      </tbody>
    </table>

    <!-- 💵 TOTAL -->
    <div class="totals">
      <div><span>Discount Value:</span><span>${valueDisplay}</span></div>

      <div class="final">
        <span>Applied Discount:</span>
        <span>${appliedDisplay}</span>
      </div>
    </div>

    <!-- 🕓 AUDIT -->
    <div style="margin-top:20px; font-size:11px;">
      Printed by: <strong>${printedBy}</strong><br/>
      Printed at: ${printedAt}
    </div>

    <!-- 🧾 FOOTER -->
    <div style="margin-top:15px; font-size:12px;">
      Discount processed successfully.
    </div>
  `;
}

/* ============================================================
   🖨️ PRINT
============================================================ */
export function printDiscountSummary(discount) {
  const html = buildDiscountReceiptHTML(discount);

  printDocument(html, {
    title: "Discount Receipt",
    invoice: {
      organization: discount.organization,
      status: discount.status,
    },
    branding: JSON.parse(localStorage.getItem("branding") || "{}"),
  });
}