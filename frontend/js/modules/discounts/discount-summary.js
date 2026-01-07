// 📁 frontend/js/modules/discounts/discount-summary.js
// ============================================================================
// 🧾 Discount Summary Slip (Printable PDF-ready version)
// 🔹 Mirrors deposit-receipt.js layout, adapted for non-cash discount events
// 🔹 Uses org info + discount details + audit metadata
// 🔹 Fully compatible with printReceipt() utility
// ============================================================================

import { printReceipt } from "../../utils/receipt-utils.js";
import { getOrgInfo } from "../shared/org-config.js";

/* ============================================================
   🧩 Helpers
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
   🧾 Print Discount Summary Slip
============================================================ */
export function printDiscountSummary(discount) {
  const orgInfo = getOrgInfo();
  const printedBy = localStorage.getItem("userName") || "Unknown User";
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

  /* ============================================================
     🧱 HTML Template
  ============================================================ */
  const bodyHTML = `
    <!-- Org / Facility Info -->
    <div class="mb-3">
      <h5 class="fw-bold">${orgInfo?.name || "Organization"}</h5>
      <div class="small text-muted">
        ${discount.facility?.name || "—"}<br/>
        ${orgInfo?.address || ""}
      </div>
    </div>

    <!-- Discount Details -->
    <h6 class="border-bottom pb-1 mt-3">Discount Information</h6>
    <div class="invoice-meta">
      <div><strong>Invoice:</strong> ${invoiceLabel}</div>
      <div><strong>Invoice Item:</strong> ${itemLabel}</div>
      <div><strong>Type:</strong> ${discount.type || "—"}</div>
      <div><strong>Value:</strong> ${valueDisplay}</div>
      <div><strong>Reason:</strong> ${discount.reason || "—"}</div>
      <div><strong>Status:</strong> ${discount.status || "—"}</div>
    </div>

    <!-- Audit Section -->
    <h6 class="border-bottom pb-1 mt-3">Audit Trail</h6>
    <div class="invoice-meta">
      <div><strong>Created By:</strong> ${
        discount.createdBy
          ? `${discount.createdBy.first_name} ${discount.createdBy.last_name}`
          : "—"
      }</div>
      <div><strong>Created At:</strong> ${formatDate(discount.created_at)}</div>
      ${
        discount.finalizedBy
          ? `<div><strong>Finalized By:</strong> ${discount.finalizedBy.first_name} ${discount.finalizedBy.last_name}</div>
             <div><strong>Finalized At:</strong> ${formatDate(discount.finalized_at)}</div>`
          : ""
      }
      ${
        discount.voidedBy
          ? `<div><strong>Voided By:</strong> ${discount.voidedBy.first_name} ${discount.voidedBy.last_name}</div>
             <div><strong>Voided At:</strong> ${formatDate(discount.voided_at)}</div>
             <div><strong>Void Reason:</strong> ${discount.void_reason || "—"}</div>`
          : ""
      }
    </div>

    <!-- Print Info -->
    <div class="mt-3 border-top pt-2 small text-muted">
      Printed by: <strong>${printedBy}</strong><br/>
      Printed at: ${printedAt}
    </div>

    <!-- Footer -->
    <div class="mt-3 text-center small">
      <em>Discount summary slip — non-cash adjustment.</em>
    </div>
  `;

  /* ============================================================
     🖨️ Print using existing utils
  ============================================================ */
  printReceipt("Discount Summary Slip", bodyHTML, discount.organization_id);
}
