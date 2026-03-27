// 📁 frontend/js/modules/discounts/discount-summary.js
// ============================================================================
// 🧾 Discount Summary Slip – ENTERPRISE PREMIUM (MASTER PARITY++)
// ----------------------------------------------------------------------------
// 🔹 FULL parity with deposit-receipt.js
// 🔹 XSS-safe rendering (enterprise security)
// 🔹 Global money formatter (consistent financial output)
// 🔹 Audit logging (enterprise traceability)
// 🔹 Silent + print-safe
// 🔹 Footer + branding handled ONLY by receipt-utils
// 🔹 ALL existing imports + API calls PRESERVED
// ============================================================================

import { printReceipt } from "../../utils/receipt-utils.js";
import { getOrgInfo } from "../shared/org-config.js";

/* --------------------------------------------------
   🔒 Enterprise Helpers (INLINE SAFE)
-------------------------------------------------- */
function safeText(value) {
  if (value === null || value === undefined) return "—";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function formatMoney(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(Number(value || 0));
}

function logAction(action, payload = {}) {
  console.debug(`[discount-summary] ${action}`, payload);
}

/* --------------------------------------------------
   Utilities (MASTER PARITY)
-------------------------------------------------- */
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

/**
 * Resolve Printed By (Audit-first → Auth-user → System)
 */
function resolvePrintedBy(discount) {
  if (
    discount?.createdBy?.first_name ||
    discount?.createdBy?.last_name
  ) {
    return [
      discount.createdBy.first_name,
      discount.createdBy.last_name,
    ]
      .filter(Boolean)
      .join(" ");
  }

  const authUser =
    JSON.parse(localStorage.getItem("auth_user") || "null") ||
    JSON.parse(localStorage.getItem("currentUser") || "null");

  if (!authUser) return "System";

  if (authUser.first_name || authUser.last_name) {
    return [authUser.first_name, authUser.last_name]
      .filter(Boolean)
      .join(" ");
  }

  return authUser.name || "System";
}

/* --------------------------------------------------
   Receipt Printer (PREMIUM)
-------------------------------------------------- */
export function printDiscountSummary(discount) {
  const orgInfo = getOrgInfo(); // ✅ preserved
  const printedBy = resolvePrintedBy(discount);
  const printedAt = new Date().toLocaleString();

  // 🔥 Audit log (enterprise traceability)
  logAction("PRINT", {
    id: discount.id,
    invoice_id: discount.invoice_id,
    value: discount.value,
  });

  const invoiceLabel = discount.invoice
    ? `${safeText(discount.invoice.invoice_number || "Invoice")}`
    : discount.invoice_id
    ? `Invoice ID: ${safeText(discount.invoice_id)}`
    : "—";

  const itemLabel = discount.invoiceItem
    ? `${safeText(discount.invoiceItem.description || "Item")} · Qty ${
        discount.invoiceItem.quantity || 1
      }`
    : "—";

  const valueDisplay =
    discount.type === "percentage"
      ? `${Number(discount.value || 0).toFixed(2)}%`
      : formatMoney(discount.value);

  const bodyHTML = `
    <div class="facility-info">
      <p><strong>Facility:</strong> ${safeText(
        discount.facility?.name
      )}</p>
    </div>

    <div class="invoice-meta">
      <div><strong>Discount ID:</strong> ${safeText(discount.id)}</div>
      <div><strong>Invoice:</strong> ${invoiceLabel}</div>
      <div><strong>Invoice Item:</strong> ${itemLabel}</div>
      <div><strong>Type:</strong> ${safeText(discount.type)}</div>
      <div><strong>Value:</strong> ${valueDisplay}</div>
      <div><strong>Reason:</strong> ${safeText(discount.reason)}</div>
      <div><strong>Status:</strong> ${safeText(discount.status)}</div>
      <div><strong>Created At:</strong> ${formatDate(
        discount.created_at
      )}</div>
      <div><strong>Created By:</strong> ${safeText(printedBy)}</div>
    </div>

    <h5>Audit Trail</h5>
    <div class="invoice-meta">
      ${
        discount.finalizedBy
          ? `
            <div><strong>Finalized By:</strong> ${safeText(
              discount.finalizedBy.first_name
            )} ${safeText(discount.finalizedBy.last_name)}</div>
            <div><strong>Finalized At:</strong> ${formatDate(
              discount.finalized_at
            )}</div>
          `
          : ""
      }

      ${
        discount.voidedBy
          ? `
            <div><strong>Voided By:</strong> ${safeText(
              discount.voidedBy.first_name
            )} ${safeText(discount.voidedBy.last_name)}</div>
            <div><strong>Voided At:</strong> ${formatDate(
              discount.voided_at
            )}</div>
            <div><strong>Void Reason:</strong> ${safeText(
              discount.void_reason
            )}</div>
          `
          : ""
      }
    </div>

    <div class="print-meta">
      Printed by: <strong>${safeText(printedBy)}</strong><br/>
      Printed at: ${printedAt}
    </div>
  `;

  // ✅ MASTER: branding handled ONLY by receipt-utils
  printReceipt("Discount Summary Slip", bodyHTML, discount.organization_id);
}