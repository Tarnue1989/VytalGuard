// 📁 frontend/js/modules/discount-waivers/discount-waiver-summary.js
// ============================================================================
// 🧾 Discount Waiver Summary Slip – Enterprise Master Pattern Aligned
// ----------------------------------------------------------------------------
// 🔹 Mirrors invoice-receipt.js structure for consistency
// 🔹 Uses authSession for Printed By (single source of truth)
// 🔹 Includes org/facility info, waiver details, and full audit trail
// 🔹 Clean, resilient, and print-ready
// ============================================================================

import { printReceipt } from "../../utils/receipt-utils.js";
import { getOrgInfo } from "../shared/org-config.js";

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
   👤 Resolve Current User (MASTER PATTERN)
============================================================ */
function getPrintedBy(waiver) {
  try {
    const authSession = JSON.parse(localStorage.getItem("authSession") || "{}");

    return (
      authSession?.name ||
      (authSession?.first_name && authSession?.last_name
        ? `${authSession.first_name} ${authSession.last_name}`
        : null) ||
      (waiver?.createdBy
        ? `${waiver.createdBy.first_name} ${waiver.createdBy.last_name}`
        : null) ||
      localStorage.getItem("userName") ||
      "Unknown User"
    );
  } catch (e) {
    console.warn("⚠️ Failed to parse authSession:", e);
    return "Unknown User";
  }
}

/* ============================================================
   🧾 Print Discount Waiver Summary Slip
============================================================ */
export function printDiscountWaiverSummary(waiver) {
  const orgInfo = getOrgInfo();
  const printedBy = getPrintedBy(waiver);
  const printedAt = new Date().toLocaleString();

  /* ------------------------------------------------------------
     🧾 Invoice Label
  ------------------------------------------------------------ */
  const invoiceLabel = waiver.invoice
    ? `${waiver.invoice.invoice_number || "Invoice"}`
    : waiver.invoice_id
    ? `Invoice ID: ${waiver.invoice_id}`
    : "—";

  /* ------------------------------------------------------------
     🧍 Patient Label
  ------------------------------------------------------------ */
  const patientLabel =
    waiver.patient?.full_name ||
    waiver.patient_name ||
    waiver.patient_id ||
    "—";

  /* ------------------------------------------------------------
     💲 Value Display
  ------------------------------------------------------------ */
  const valueDisplay =
    waiver.type === "percentage"
      ? `${parseFloat(waiver.percentage || 0).toFixed(2)}%`
      : `$${parseFloat(waiver.amount || 0).toFixed(2)}`;

  /* ------------------------------------------------------------
     🧱 Body Content (MATCHES INVOICE STYLE)
  ------------------------------------------------------------ */
  const bodyHTML = `
    <!-- 🏢 Organization & Facility -->
    <div class="facility-info mb-3">
      <p><strong>Organization:</strong> ${orgInfo?.name || "—"}</p>
      <p><strong>Facility:</strong> ${waiver.facility?.name || "—"}</p>
    </div>

    <!-- 📄 Waiver Meta -->
    <div class="invoice-meta">
      <div><strong>Invoice:</strong> ${invoiceLabel}</div>
      <div><strong>Patient:</strong> ${patientLabel}</div>
      <div><strong>Type:</strong> ${waiver.type || "—"}</div>
      <div><strong>Value:</strong> ${valueDisplay}</div>
      <div><strong>Applied Total:</strong> $${Number(waiver.applied_total || 0).toFixed(2)}</div>
      <div><strong>Status:</strong> ${waiver.status || "—"}</div>
      <div style="grid-column:1 / -1;"><strong>Reason:</strong> ${waiver.reason || "—"}</div>
    </div>

    <!-- 🧾 Audit Trail -->
    <h5 class="border-bottom pb-1 mt-3">Audit Trail</h5>
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

    <!-- 🕓 Print Audit -->
    <div class="mt-3 border-top pt-2 small text-muted">
      Printed by: <strong>${printedBy}</strong><br/>
      Printed at: ${printedAt}
    </div>

    <!-- 🧾 Footer -->
    <div id="receiptFooter" class="mt-3">
      <p class="mb-0">Discount waiver processed successfully.</p>
    </div>
  `;

  /* ------------------------------------------------------------
     🖨️ Dispatch to Printer
  ------------------------------------------------------------ */
  printReceipt(
    "Discount Waiver Summary Slip",
    bodyHTML,
    waiver.organization_id
  );
}