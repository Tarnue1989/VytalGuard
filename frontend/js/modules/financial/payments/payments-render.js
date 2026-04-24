// 📦 payments-render.js – Enterprise Master Pattern Aligned (Full Upgrade)
// ============================================================================
// 🔹 Mirrors deposit-render.js for unified enterprise behavior
// 🔹 Keeps all payment-specific DOM IDs, logic, and actions intact
// 🔹 Adds enterprise structure: RBAC, STATUS_ACTION_MATRIX, tooltips, exports
// 🔹 Fully compatible with table/card view + modal rendering
// ============================================================================

import { FIELD_LABELS_PAYMENT } from "./payments-constants.js";
import { formatDate, initTooltips } from "../../../utils/ui-utils.js";
import { buildActionButtons } from "../../../utils/status-action-matrix.js";
import { exportData } from "../../../utils/export-utils.js";

/* ============================================================================
   🎛️ Action Buttons (enterprise unified)
============================================================================ */
function getPaymentActionButtons(entry, user) {
  return buildActionButtons({
    module: "payment",
    status: (entry.status || "").toLowerCase(),
    entry,
    entryId: entry.id,
    user,
    permissionPrefix: "payments",
  });
}

/* ============================================================================
   🧱 Dynamic Table Head Renderer
============================================================================ */
export function renderDynamicPaymentHead(visibleFields) {
  const thead = document.getElementById("paymentTableHead");
  if (!thead) return;

  thead.innerHTML = "";
  const tr = document.createElement("tr");
  visibleFields.forEach((field) => {
    const th = document.createElement("th");
    th.textContent = FIELD_LABELS_PAYMENT[field] || field.replace(/_/g, " ");
    if (field === "actions") th.classList.add("actions-cell");
    tr.appendChild(th);
  });
  thead.appendChild(tr);
}

/* ============================================================================
   🔠 Field Render Helpers
============================================================================ */
function renderUserName(user) {
  if (!user) return "—";
  const parts = [user.first_name, user.middle_name, user.last_name].filter(Boolean);
  return parts.length ? parts.join(" ") : user.full_name || "—";
}

function renderPatient(entry) {
  const p = entry.patient;
  if (!p) return "—";
  const patNo = p.pat_no || "—";
  const name = [p.first_name, p.middle_name, p.last_name].filter(Boolean).join(" ");
  return `${patNo} - ${name || "Unnamed"}`;
}

function renderValue(entry, field) {
  switch (field) {
    case "status": {
      const raw = (entry.status || "").toLowerCase();
      const label = raw.charAt(0).toUpperCase() + raw.slice(1);
      const colorMap = {
        pending: "bg-warning text-dark",
        completed: "bg-success",
        reversed: "bg-dark text-light",
        cancelled: "bg-danger",
        failed: "bg-secondary",
      };
      return raw
        ? `<span class="badge ${colorMap[raw] || "bg-primary"}">${label}</span>`
        : "—";
    }

    case "is_deposit":
      return entry.is_deposit
        ? `<span class="badge bg-info">Deposit</span>`
        : `<span class="badge bg-success">Regular</span>`;

    case "organization":
      return entry.organization?.name || "—";
    case "facility":
      return entry.facility?.name || "—";
    case "patient":
      return renderPatient(entry);
    case "invoice":
      return entry.invoice
        ? `${entry.invoice.invoice_number} (Bal: $${Number(entry.invoice.balance).toFixed(2)})`
        : "—";
    case "amount":
      return entry.amount != null ? `$${Number(entry.amount).toFixed(2)}` : "—";
    case "method":
      return entry.method || "—";
    case "transaction_ref":
      return entry.transaction_ref || "—";
    case "reason":
      return entry.reason || "—";

    case "createdBy":
      return renderUserName(entry.createdBy);
    case "updatedBy":
      return renderUserName(entry.updatedBy);
    case "deletedBy":
      return renderUserName(entry.deletedBy);

    case "created_at":
    case "updated_at":
    case "deleted_at":
      return entry[field] ? formatDate(entry[field]) : "—";

    default:
      return entry[field] ?? "—";
  }
}

/* ============================================================================
   🗂️ Card Renderer
============================================================================ */
export function renderPaymentCard(entry, visibleFields, user) {
  const details = visibleFields
    .filter((f) => f !== "actions")
    .map(
      (f) =>
        `<p><strong>${FIELD_LABELS_PAYMENT[f] || f}:</strong> ${renderValue(entry, f)}</p>`
    )
    .join("");

  const footer = visibleFields.includes("actions")
    ? `<div class="card-footer text-end">
         <div class="table-actions">
           ${getPaymentActionButtons(entry, user)}
         </div>
       </div>`
    : "";

  return `<div class="record-card card shadow-sm h-100">
            <div class="card-body">${details}</div>
            ${footer}
          </div>`;
}

/* ============================================================================
   📋 Main List Renderer
============================================================================ */
export function renderPaymentList({ entries, visibleFields, viewMode, user }) {
  const tableBody = document.getElementById("paymentTableBody");
  const cardContainer = document.getElementById("paymentList");
  const tableContainer = document.querySelector(".payment-table-container");
  if (!tableBody || !cardContainer || !tableContainer) return;

  // 🔄 Sync view toggle
  document.getElementById("tableViewBtn")?.classList.toggle("active", viewMode === "table");
  document.getElementById("cardViewBtn")?.classList.toggle("active", viewMode === "card");

  tableBody.innerHTML = "";
  cardContainer.innerHTML = "";

  const noData = `<tr><td colspan="${visibleFields.length}" class="text-center text-muted py-3">No payments found.</td></tr>`;

  if (viewMode === "table") {
    cardContainer.classList.remove("active");
    tableContainer.classList.add("active");
    renderDynamicPaymentHead(visibleFields);

    if (!entries.length) {
      tableBody.innerHTML = noData;
      initTooltips(tableBody);
      return;
    }

    entries.forEach((entry) => {
      const tr = document.createElement("tr");
      tr.innerHTML = visibleFields
        .map((f) => {
          const val =
            f === "actions"
              ? `<div class="table-actions export-ignore">${getPaymentActionButtons(entry, user)}</div>`
              : renderValue(entry, f);
          const cls = f === "actions" ? ' class="text-center actions-cell"' : "";
          return `<td${cls}>${val}</td>`;
        })
        .join("");
      tableBody.appendChild(tr);
    });

    initTooltips(tableBody);
  } else {
    tableContainer.classList.remove("active");
    cardContainer.classList.add("active");
    cardContainer.innerHTML = entries.length
      ? entries.map((e) => renderPaymentCard(e, visibleFields, user)).join("")
      : `<p class="text-muted text-center py-3">No payments found.</p>`;
    initTooltips(cardContainer);
  }

  setupExportHandlers(entries, visibleFields);
}

/* ============================================================================
   📤 Export Handlers (Enterprise Standard)
============================================================================ */
let exportHandlersBound = false;
function setupExportHandlers(entries) {
  if (exportHandlersBound) return;
  exportHandlersBound = true;

  const title = "Payments Report";
  document.getElementById("exportCSVBtn")?.addEventListener("click", () =>
    exportData({ type: "csv", data: entries, title })
  );
  document.getElementById("exportExcelBtn")?.addEventListener("click", () =>
    exportData({ type: "xlsx", data: entries, title })
  );
  document.getElementById("exportPDFBtn")?.addEventListener("click", () =>
    exportData({
      type: "pdf",
      title,
      selector: ".payment-table-container",
      orientation: "landscape",
    })
  );
}

/* ============================================================================
   🧾 Detail Modal Renderer
============================================================================ */
export function renderPaymentDetail(entry, user) {
  const summary = `
    <div class="row g-3">
      <div class="col-md-6"><strong>Payment ID:</strong> ${entry.id || "—"}</div>
      <div class="col-md-6"><strong>Status:</strong> ${renderValue(entry, "status")}</div>
      <div class="col-md-6"><strong>Patient:</strong> ${renderValue(entry, "patient")}</div>
      <div class="col-md-6"><strong>Invoice:</strong> ${renderValue(entry, "invoice")}</div>
      <div class="col-md-6"><strong>Organization:</strong> ${renderValue(entry, "organization")}</div>
      <div class="col-md-6"><strong>Facility:</strong> ${renderValue(entry, "facility")}</div>
      <div class="col-md-6"><strong>Method:</strong> ${entry.method || "—"}</div>
      <div class="col-md-6"><strong>Reference:</strong> ${entry.transaction_ref || "—"}</div>
      <div class="col-md-6"><strong>Received By:</strong> ${renderUserName(entry.createdBy)}</div>
      <div class="col-md-6"><strong>Date:</strong> ${renderValue(entry, "created_at")}</div>
      <div class="col-md-12"><strong>Notes:</strong> ${entry.reason || "—"}</div>
    </div>`;

  const financial = `
    <hr>
    <div class="row g-3">
      <div class="col-12"><h6 class="text-primary">Financial Summary</h6></div>
      <div class="col-md-4"><strong>Payment Amount:</strong> $${Number(entry.amount || 0).toFixed(2)}</div>
      ${
        entry.invoice
          ? `<div class="col-md-4"><strong>Invoice Total:</strong> $${Number(entry.invoice.total || 0).toFixed(2)}</div>
             <div class="col-md-4"><strong>Invoice Paid:</strong> $${Number(entry.invoice.total_paid || 0).toFixed(2)}</div>
             <div class="col-md-4"><strong>Invoice Balance:</strong> $${Number(entry.invoice.balance || 0).toFixed(2)}</div>`
          : ""
      }
    </div>`;

  return `
    <div class="d-flex justify-content-end mb-3">
      <button class="btn btn-sm btn-outline-secondary print-btn" data-id="${entry.id}">
        <i class="fas fa-print"></i> Print Payment
      </button>
    </div>
    ${summary}
    ${financial}`;
}
