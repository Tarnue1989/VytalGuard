// 📁 frontend/js/modules/patient-insurance/patient-insurance-receipt.js
// ============================================================================
// 🧾 Patient Insurance Receipt (POLICY-STYLE PARITY)
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
function getPrintedBy(record) {
  try {
    const authSession = JSON.parse(localStorage.getItem("authSession") || "{}");

    return (
      authSession?.name ||
      (record?.createdBy
        ? `${record.createdBy.first_name} ${record.createdBy.last_name}`
        : null) ||
      localStorage.getItem("userName") ||
      "Unknown User"
    );
  } catch {
    return "Unknown User";
  }
}

/* ============================================================
   🧾 BUILD RECEIPT HTML
============================================================ */
function buildPatientInsuranceReceiptHTML(record) {
  const printedBy = getPrintedBy(record);
  const printedAt = new Date().toLocaleString();

  const money = (v) =>
    v != null
      ? `${getCurrencySymbol(record.currency || "USD")} ${Number(v).toFixed(2)}`
      : "—";

  return `
    <!-- 🏢 Facility -->
    <div style="margin-bottom:10px; font-size:13px;">
      <strong>Facility:</strong> ${record.facility?.name || "—"}
    </div>

    <!-- 🔥 GRID HEADER -->
    <div class="grid-2">

      <div>
        <div><strong>Patient:</strong> ${
          record.patient?.pat_no || "—"
        } - ${
          [record.patient?.first_name, record.patient?.last_name]
            .filter(Boolean)
            .join(" ")
        }</div>
      </div>

      <div>
        <div><strong>Policy #:</strong> ${
          record.policy_number || "—"
        }</div>

        <div><strong>Status:</strong> ${record.status || ""}</div>

        <div><strong>Primary:</strong> ${
          record.is_primary ? "YES" : "NO"
        }</div>
      </div>

    </div>

    <!-- 📦 DETAILS -->
    <h4 style="margin-top:15px;">Policy Details</h4>

    <table>
      <thead>
        <tr>
          <th>Description</th>
          <th>Value</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>Provider</td>
          <td>${record.provider?.name || "—"}</td>
        </tr>
        <tr>
          <td>Plan Name</td>
          <td>${record.plan_name || "—"}</td>
        </tr>
        <tr>
          <td>Coverage Limit</td>
          <td>${money(record.coverage_limit)}</td>
        </tr>
        <tr>
          <td>Currency</td>
          <td>${record.currency || "—"}</td>
        </tr>
        <tr>
          <td>Valid From</td>
          <td>${formatDate(record.valid_from)}</td>
        </tr>
        <tr>
          <td>Valid To</td>
          <td>${formatDate(record.valid_to)}</td>
        </tr>
        <tr>
          <td>Notes</td>
          <td>${record.notes || "—"}</td>
        </tr>
      </tbody>
    </table>

    <!-- 🕓 AUDIT -->
    <div style="margin-top:20px; font-size:11px;">
      Printed by: <strong>${printedBy}</strong><br/>
      Printed at: ${printedAt}
    </div>

    <!-- 🧾 FOOTER -->
    <div style="margin-top:15px; font-size:12px;">
      Patient insurance record summary generated.
    </div>
  `;
}

/* ============================================================
   🖨️ PRINT
============================================================ */
export function printPatientInsuranceReceipt(record) {
  const html = buildPatientInsuranceReceiptHTML(record);

  printDocument(html, {
    title: "Patient Insurance",

    invoice: {
      organization: record.organization,
      status: record.status,
    },

    branding: JSON.parse(localStorage.getItem("branding") || "{}"),
  });
}