// 📁 frontend/js/modules/discount-waivers/discount-waiver-summary.js
// ============================================================================
// 🧾 Discount Waiver Summary Slip (Printable PDF-ready version)
// 🔹 Mirrors discount-summary.js enterprise pattern
// 🔹 Tailored for waiver lifecycle: approved, rejected, voided
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
   🧾 Print Discount Waiver Summary Slip
============================================================ */
export function printDiscountWaiverSummary(waiver) {
  const orgInfo = getOrgInfo();
  const printedBy = localStorage.getItem("userName") || "Unknown User";
  const printedAt = new Date().toLocaleString();

  // ✅ Invoice display
  const invoiceLabel = waiver.invoice
    ? `${waiver.invoice.invoice_number || "Invoice"}`
    : waiver.invoice_id
    ? `Invoice ID: ${waiver.invoice_id}`
    : "—";

  // ✅ Patient display
  const patientLabel =
    waiver.patient?.full_name ||
    waiver.patient_name ||
    waiver.patient_id ||
    "—";

  // ✅ Type & value display
  const valueDisplay =
    waiver.type === "percentage"
      ? `${parseFloat(waiver.percentage || 0).toFixed(2)}%`
      : `$${parseFloat(waiver.amount || 0).toFixed(2)}`;

  /* ============================================================
     🧱 HTML Template
  ============================================================ */
  const bodyHTML = `
    <!-- Org / Facility Info -->
    <div class="mb-3">
      <h5 class="fw-bold">${orgInfo?.name || "Organization"}</h5>
      <div class="small text-muted">
        ${waiver.facility?.name || "—"}<br/>
        ${orgInfo?.address || ""}
      </div>
    </div>

    <!-- Waiver Details -->
    <h6 class="border-bottom pb-1 mt-3">Discount Waiver Information</h6>
    <div class="invoice-meta">
      <div><strong>Invoice:</strong> ${invoiceLabel}</div>
      <div><strong>Patient:</strong> ${patientLabel}</div>
      <div><strong>Type:</strong> ${waiver.type || "—"}</div>
      <div><strong>Value:</strong> ${valueDisplay}</div>
      <div><strong>Applied Total:</strong> $${parseFloat(waiver.applied_total || 0).toFixed(2)}</div>
      <div><strong>Reason:</strong> ${waiver.reason || "—"}</div>
      <div><strong>Status:</strong> ${waiver.status || "—"}</div>
    </div>

    <!-- Audit Trail -->
    <h6 class="border-bottom pb-1 mt-3">Audit Trail</h6>
    <div class="invoice-meta">
      <div><strong>Created By:</strong> ${
        waiver.createdBy
          ? `${waiver.createdBy.first_name} ${waiver.createdBy.last_name}`
          : "—"
      }</div>
      <div><strong>Created At:</strong> ${formatDate(waiver.created_at)}</div>

      ${
        waiver.approvedBy
          ? `<div><strong>Approved By:</strong> ${waiver.approvedBy.first_name} ${waiver.approvedBy.last_name}</div>
             <div><strong>Approved At:</strong> ${formatDate(waiver.approved_at)}</div>`
          : ""
      }

      ${
        waiver.rejectedBy
          ? `<div><strong>Rejected By:</strong> ${waiver.rejectedBy.first_name} ${waiver.rejectedBy.last_name}</div>
             <div><strong>Rejected At:</strong> ${formatDate(waiver.rejected_at)}</div>`
          : ""
      }

      ${
        waiver.voidedBy
          ? `<div><strong>Voided By:</strong> ${waiver.voidedBy.first_name} ${waiver.voidedBy.last_name}</div>
             <div><strong>Voided At:</strong> ${formatDate(waiver.voided_at)}</div>`
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
      <em>Discount waiver summary slip — non-cash adjustment.</em>
    </div>
  `;

  /* ============================================================
     🖨️ Print using enterprise utils
  ============================================================ */
  printReceipt("Discount Waiver Summary Slip", bodyHTML, waiver.organization_id);
}
