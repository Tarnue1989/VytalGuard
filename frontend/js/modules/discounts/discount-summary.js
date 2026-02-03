// 📁 frontend/js/modules/discounts/discount-summary.js
// ============================================================================
// 🧾 Discount Summary Slip – ENTERPRISE MASTER PARITY
// ----------------------------------------------------------------------------
// 🔹 FULL parity with deposit-receipt.js printing pattern
// 🔹 Audit-first printedBy resolution with auth-user fallback
// 🔹 Silent + print-safe (no UI side effects)
// 🔹 Footer + branding handled ONLY by receipt-utils
// 🔹 ALL existing imports + API calls PRESERVED
// ============================================================================

import { printReceipt } from "../../utils/receipt-utils.js";
import { getOrgInfo } from "../shared/org-config.js";

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
 * Mirrors deposit-receipt.js EXACTLY
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
   Receipt Printer (MASTER PARITY)
-------------------------------------------------- */
export function printDiscountSummary(discount) {
  const orgInfo = getOrgInfo(); // ✅ preserved
  const printedBy = resolvePrintedBy(discount);
  const printedAt = new Date().toLocaleString();

  const invoiceLabel = discount.invoice
    ? `${discount.invoice.invoice_number || "Invoice"}`
    : discount.invoice_id
    ? `Invoice ID: ${discount.invoice_id}`
    : "—";

  const itemLabel = discount.invoiceItem
    ? `${discount.invoiceItem.description || "Item"} · Qty ${
        discount.invoiceItem.quantity || 1
      }`
    : "—";

  const valueDisplay =
    discount.type === "percentage"
      ? `${parseFloat(discount.value || 0).toFixed(2)}%`
      : `$${parseFloat(discount.value || 0).toFixed(2)}`;

  const bodyHTML = `
    <div class="facility-info">
      <p><strong>Facility:</strong> ${discount.facility?.name || "—"}</p>
    </div>

    <div class="invoice-meta">
      <div><strong>Discount ID:</strong> ${discount.id || "—"}</div>
      <div><strong>Invoice:</strong> ${invoiceLabel}</div>
      <div><strong>Invoice Item:</strong> ${itemLabel}</div>
      <div><strong>Type:</strong> ${discount.type || "—"}</div>
      <div><strong>Value:</strong> ${valueDisplay}</div>
      <div><strong>Reason:</strong> ${discount.reason || "—"}</div>
      <div><strong>Status:</strong> ${discount.status || "—"}</div>
      <div><strong>Created At:</strong> ${formatDate(discount.created_at)}</div>
      <div><strong>Created By:</strong> ${printedBy}</div>
    </div>

    <h5>Audit Trail</h5>
    <div class="invoice-meta">
      ${
        discount.finalizedBy
          ? `
            <div><strong>Finalized By:</strong> ${
              discount.finalizedBy.first_name || ""
            } ${discount.finalizedBy.last_name || ""}</div>
            <div><strong>Finalized At:</strong> ${formatDate(
              discount.finalized_at
            )}</div>
          `
          : ""
      }

      ${
        discount.voidedBy
          ? `
            <div><strong>Voided By:</strong> ${
              discount.voidedBy.first_name || ""
            } ${discount.voidedBy.last_name || ""}</div>
            <div><strong>Voided At:</strong> ${formatDate(
              discount.voided_at
            )}</div>
            <div><strong>Void Reason:</strong> ${
              discount.void_reason || "—"
            }</div>
          `
          : ""
      }
    </div>

    <div class="print-meta">
      Printed by: <strong>${printedBy}</strong><br/>
      Printed at: ${printedAt}
    </div>
  `;

  // ✅ MASTER parity: branding + footer handled ONLY by receipt-utils
  printReceipt("Discount Summary Slip", bodyHTML, discount.organization_id);
}
