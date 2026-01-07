// 📁 frontend/js/modules/pharmacy/pharmacy-transaction-receipt.js
// ============================================================================
// 💊 Pharmacy Transaction Receipt – Enterprise Master Pattern Aligned
// ----------------------------------------------------------------------------
// 🔹 Mirrors payment-receipt.js for unified enterprise layout & styling
// 🔹 Displays patient, doctor, medications, quantities, fulfillment, and totals
// 🔹 Fully tenant-aware (organization / facility info included)
// 🔹 Safe currency formatting & localized print output
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
   🧾 Print Pharmacy Transaction Receipt
============================================================ */
export function printPharmacyTransactionReceipt(transaction) {
  const orgInfo = getOrgInfo();
  const printedBy = localStorage.getItem("userName") || "Unknown User";
  const printedAt = new Date().toLocaleString();

  // 🧩 Patient and Doctor Info
  const patientLabel =
    transaction.patient?.pat_no || transaction.patient?.first_name || transaction.patient?.last_name
      ? `${transaction.patient?.pat_no || ""} - ${transaction.patient?.first_name || ""} ${
          transaction.patient?.last_name || ""
        }`
      : "—";

  const doctorLabel =
    transaction.doctor?.full_name ||
    `${transaction.doctor?.first_name || ""} ${transaction.doctor?.last_name || ""}`.trim() ||
    "—";

  const fulfilledByLabel =
    transaction.fulfilledBy?.full_name ||
    `${transaction.fulfilledBy?.first_name || ""} ${transaction.fulfilledBy?.last_name || ""}`.trim() ||
    "—";

  // 🧩 Prescription reference
  const prescriptionRef = transaction.prescription
    ? `${transaction.prescription.prescription_no || "—"}`
    : transaction.prescription_id
    ? `Prescription ID: ${transaction.prescription_id}`
    : "—";

  // 💊 Dispensed Items Table
  const items = Array.isArray(transaction.items) ? transaction.items : [];
  const itemsHTML =
    items.length > 0
      ? `
        <table class="table table-sm mb-3 border">
          <thead class="table-light">
            <tr>
              <th>Medication</th>
              <th class="text-end">Prescribed</th>
              <th class="text-end">Dispensed</th>
              <th class="text-end">Available Stock</th>
              <th class="text-end">Batch</th>
              <th class="text-end">Notes</th>
            </tr>
          </thead>
          <tbody>
            ${items
              .map((i) => {
                return `
                  <tr>
                    <td>${i.medication_name || i.medication?.name || "—"}</td>
                    <td class="text-end">${i.prescribed_qty ?? "—"}</td>
                    <td class="text-end">${i.quantity_dispensed ?? i.dispense_now ?? "—"}</td>
                    <td class="text-end">${i.stock_available ?? "—"}</td>
                    <td class="text-end">${
                      i.department_stock?.batch_no ||
                      i.batch_no ||
                      (i.department_stock_id ? i.department_stock_id.slice(0, 8) : "—")
                    }</td>
                    <td class="text-end">${i.notes || "—"}</td>
                  </tr>`;
              })
              .join("")}
          </tbody>
        </table>
      `
      : `<p class="text-muted small mb-3">No medication items recorded.</p>`;

  // 💰 Summary values
  const totalItems = items.length;
  const totalDispensed = items.reduce((sum, i) => sum + Number(i.quantity_dispensed || 0), 0);
  const emergencyText = transaction.is_emergency ? "Yes (Emergency Case)" : "No";

  /* ============================================================
     🧱 Body Content
  ============================================================ */
  const bodyHTML = `
    <!-- 🏢 Organization & Facility -->
    <div class="facility-info mb-3">
      <p><strong>Organization:</strong> ${orgInfo?.name || transaction.organization?.name || "—"}</p>
      <p><strong>Facility:</strong> ${transaction.facility?.name || "—"}</p>
      <p><strong>Department:</strong> ${transaction.department?.name || "—"}</p>
    </div>

    <!-- 💬 Transaction Meta -->
    <div class="invoice-meta">
      <div><strong>Transaction ID:</strong> ${transaction.transaction_ref || transaction.id || "—"}</div>
      <div><strong>Prescription:</strong> ${prescriptionRef}</div>
      <div><strong>Patient:</strong> ${patientLabel}</div>
      <div><strong>Doctor:</strong> ${doctorLabel}</div>
      <div><strong>Fulfilled By:</strong> ${fulfilledByLabel}</div>
      <div><strong>Type:</strong> ${transaction.type || "—"}</div>
      <div><strong>Emergency:</strong> ${emergencyText}</div>
      <div><strong>Status:</strong> ${transaction.status || "—"}</div>
      <div><strong>Date:</strong> ${formatDate(transaction.fulfillment_date || transaction.created_at)}</div>
      <div style="grid-column: 1 / -1;"><strong>Notes:</strong> ${transaction.notes || "—"}</div>
    </div>

    <!-- 💊 Items -->
    <h5 class="border-bottom pb-1 mt-3">Dispensed Items</h5>
    ${itemsHTML}

    <!-- 📊 Totals -->
    <div class="invoice-meta">
      <div><strong>Total Items:</strong> ${totalItems}</div>
      <div><strong>Total Quantity Dispensed:</strong> ${totalDispensed}</div>
    </div>

    <!-- 🕓 Print Info -->
    <div class="mt-3 border-top pt-2 small text-muted">
      Printed by: <strong>${printedBy}</strong><br/>
      Printed at: ${printedAt}
    </div>

    <!-- 🧾 Footer -->
    <div id="receiptFooter" class="mt-3">
      <p class="mb-0">Pharmacy transaction successfully recorded.</p>
    </div>
  `;

  /* ============================================================
     🖨️ Dispatch to Printer
  ============================================================ */
  printReceipt("Pharmacy Transaction Receipt", bodyHTML, transaction.organization_id);
}
