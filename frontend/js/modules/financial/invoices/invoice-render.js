// 📦 invoice-render.js – Enterprise Master Pattern Aligned (FIXED VERSION)
// ============================================================================
// 🔹 Fixes deposit rendering (correct key: appliedDeposits)
// 🔹 Fixes visibleFields support for applied_deposits, refunded, waiver
// 🔹 Maintains ALL IDs, DOM structure, RBAC, exports, and action-matrix logic
// 🔹 Fully backward-compatible and enterprise consistent
// ============================================================================

import { FIELD_LABELS_INVOICE } from "./invoice-constants.js";
import { formatDate, initTooltips } from "../../../utils/ui-utils.js";
import { buildActionButtons } from "../../../utils/status-action-matrix.js";
import { exportData } from "../../../utils/export-utils.js";

/* ============================================================================
   🎛️ Action Buttons (RBAC + centralized)
============================================================================ */
function getInvoiceActionButtons(entry, user) {
  return buildActionButtons({
    module: "invoice",
    status: (entry.status || "").toLowerCase(),
    entry,
    entryId: entry.id || entry.invoice_id,
    user,
    permissionPrefix: "invoices",
  });
}

/* ============================================================================
   🧱 Dynamic Table Head Renderer
============================================================================ */
export function renderDynamicTableHead(visibleFields) {
  const thead = document.getElementById("dynamicTableHead");
  if (!thead) return;
  thead.innerHTML = "";
  const tr = document.createElement("tr");

  visibleFields.forEach((field) => {
    const th = document.createElement("th");
    th.textContent = FIELD_LABELS_INVOICE[field] || field.replace(/_/g, " ");
    if (field === "actions") th.classList.add("actions-cell");
    tr.appendChild(th);
  });

  thead.appendChild(tr);
}

/* ============================================================================
   🔠 Field Render Helpers
============================================================================ */
function renderUserName(u) {
  if (!u) return "—";
  const parts = [u.first_name, u.middle_name, u.last_name].filter(Boolean);
  return parts.length ? parts.join(" ") : u.full_name || "—";
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
        draft: "bg-info",
        issued: "bg-warning text-dark",
        unpaid: "bg-danger",
        partial: "bg-primary text-light",
        paid: "bg-success",
        cancelled: "bg-dark text-light",
        voided: "bg-secondary",
      };
      return raw
        ? `<span class="badge ${colorMap[raw] || "bg-primary"}">${label}</span>`
        : "—";
    }

    case "organization":
      return entry.organization?.name || "—";
    case "facility":
      return entry.facility?.name || "—";
    case "patient":
      return renderPatient(entry);

    case "subtotal":
    case "total":
    case "total_discount":
    case "total_tax":
    case "total_paid":
    case "refunded_amount":
    case "balance":
    case "applied_deposits":
      return entry[field] != null ? `$${Number(entry[field]).toFixed(2)}` : "—";

    case "createdBy":
    case "updatedBy":
    case "deletedBy":
      return renderUserName(entry[field]);

    case "created_at":
    case "updated_at":
    case "deleted_at":
    case "due_date":
      return entry[field] ? formatDate(entry[field]) : "—";

    default:
      return entry[field] ?? "—";
  }
}

/* ============================================================================
   🧾 Detail Modal Renderer
============================================================================ */
export function renderInvoiceDetail(entry, user) {
  const actionBar = `
    <div class="d-flex justify-content-end mb-3">
      <button class="btn btn-sm btn-outline-secondary print-btn" data-id="${entry.id}">
        <i class="fas fa-print"></i> Print Invoice
      </button>
    </div>`;

  const summaryHTML = `
    <div class="row g-3">
      <div class="col-md-6"><strong>Invoice #:</strong> ${entry.invoice_number}</div>
      <div class="col-md-6"><strong>Status:</strong> ${renderValue(entry, "status")}</div>
      <div class="col-md-6"><strong>Patient:</strong> ${renderValue(entry, "patient")}</div>
      <div class="col-md-6"><strong>Organization:</strong> ${renderValue(entry, "organization")}</div>
      <div class="col-md-6"><strong>Facility:</strong> ${renderValue(entry, "facility")}</div>
      <div class="col-md-6"><strong>Date:</strong> ${renderValue(entry, "created_at")}</div>
    </div>
    <hr>
    <div class="row g-3">
      <div class="col-12"><h6 class="text-primary">Financial Summary</h6></div>
      <div class="col-md-4"><strong>Subtotal:</strong> ${renderValue(entry, "subtotal")}</div>
      <div class="col-md-4"><strong>Discount:</strong> ${renderValue(entry, "total_discount")}</div>
      <div class="col-md-4"><strong>Tax:</strong> ${renderValue(entry, "total_tax")}</div>
      <div class="col-md-4"><strong>Total:</strong> ${renderValue(entry, "total")}</div>
      <div class="col-md-4"><strong>Paid:</strong> ${renderValue(entry, "total_paid")}</div>
      <div class="col-md-4"><strong>Refunded:</strong> ${renderValue(entry, "refunded_amount")}</div>
      <div class="col-md-4"><strong>Applied Deposits:</strong> ${renderValue(entry, "applied_deposits")}</div>
      <div class="col-md-4"><strong>Balance:</strong> ${renderValue(entry, "balance")}</div>
    </div>`;

  const itemsHTML = `
    <table class="table table-sm">
      <thead>
        <tr><th>Description</th><th>Qty</th><th>Unit</th><th>Discount</th><th>Tax</th><th>Total</th></tr>
      </thead>
      <tbody>
        ${(entry.items || [])
          .map(
            (i) => `
              <tr>
                <td>${i.description || "—"}</td>
                <td>${i.quantity}</td>
                <td>$${Number(i.unit_price || 0).toFixed(2)}</td>
                <td>$${Number(i.discount_amount || 0).toFixed(2)}</td>
                <td>$${Number(i.tax_amount || 0).toFixed(2)}</td>
                <td>$${Number(i.total_price || 0).toFixed(2)}</td>
              </tr>`
          )
          .join("") || `<tr><td colspan="6">No items</td></tr>`}
      </tbody>
    </table>`;

  const paymentsHTML =
    (entry.payments || [])
      .map(
        (p) =>
          `<p>
            <strong>${p.method}</strong> - $${Number(p.amount).toFixed(2)} (${p.status})
          </p>`
      )
      .join("") || `<p class="text-muted">No payments</p>`;

  /* ✅ FIXED: Deposits use correct key = appliedDeposits */
  const depositsHTML =
    (entry.appliedDeposits || [])
      .map(
        (d) => `
          <p>
            <strong>Amount:</strong> $${Number(d.amount).toFixed(2)}<br>
            <strong>Applied:</strong> $${Number(d.applied_amount).toFixed(2)}<br>
            <strong>Remaining:</strong> $${Number(d.remaining_balance).toFixed(2)}<br>
            <strong>Method:</strong> ${d.method || "—"}<br>
            <strong>Status:</strong> ${d.status || "—"}<br>
            <strong>Ref:</strong> ${d.transaction_ref || "—"}
          </p>
        `
      )
      .join("") || `<p class="text-muted">No deposits</p>`;

  const refundsHTML =
    (entry.refunds || []).map(
      (r) =>
        `<p>$${Number(r.amount).toFixed(2)} - ${r.reason || "—"}</p>`
    ).join("") || `<p class="text-muted">No refunds</p>`;

  const waiversHTML =
    (entry.waivers || [])
      .map(
        (w) =>
          `<p>$${Number(w.amount).toFixed(2)} (${w.type}) - ${w.reason || "—"}</p>`
      )
      .join("") || `<p class="text-muted">No waivers</p>`;

  return `
    ${actionBar}
    <ul class="nav nav-tabs" id="invoiceTabs" role="tablist">
      <li class="nav-item"><button class="nav-link active" data-bs-toggle="tab" data-bs-target="#summaryTab">Summary</button></li>
      <li class="nav-item"><button class="nav-link" data-bs-toggle="tab" data-bs-target="#itemsTab">Items</button></li>
      <li class="nav-item"><button class="nav-link" data-bs-toggle="tab" data-bs-target="#paymentsTab">Payments</button></li>
      <li class="nav-item"><button class="nav-link" data-bs-toggle="tab" data-bs-target="#depositsTab">Deposits</button></li>
      <li class="nav-item"><button class="nav-link" data-bs-toggle="tab" data-bs-target="#refundsTab">Refunds</button></li>
      <li class="nav-item"><button class="nav-link" data-bs-toggle="tab" data-bs-target="#waiversTab">Waivers</button></li>
    </ul>

    <div class="tab-content mt-3">
      <div class="tab-pane fade show active" id="summaryTab">${summaryHTML}</div>
      <div class="tab-pane fade" id="itemsTab">${itemsHTML}</div>
      <div class="tab-pane fade" id="paymentsTab">${paymentsHTML}</div>
      <div class="tab-pane fade" id="depositsTab">${depositsHTML}</div>
      <div class="tab-pane fade" id="refundsTab">${refundsHTML}</div>
      <div class="tab-pane fade" id="waiversTab">${waiversHTML}</div>
    </div>`;
}

/* ============================================================================
   🗂️ Card Renderer
============================================================================ */
export function renderCard(entry, visibleFields, user) {
  const details = visibleFields
    .filter((f) => f !== "actions")
    .map(
      (f) =>
        `<p><strong>${FIELD_LABELS_INVOICE[f] || f}:</strong> ${renderValue(
          entry,
          f
        )}</p>`
    )
    .join("");

  const footer = visibleFields.includes("actions")
    ? `<div class="card-footer text-end">
         <div class="table-actions">${getInvoiceActionButtons(entry, user)}</div>
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
export function renderList({ entries, visibleFields, viewMode, user }) {
  const tableBody = document.getElementById("invoiceTableBody");
  const cardContainer = document.getElementById("invoiceList");
  const tableContainer = document.querySelector(".table-container");
  if (!tableBody || !cardContainer || !tableContainer) return;

  document
    .getElementById("tableViewBtn")
    ?.classList.toggle("active", viewMode === "table");
  document
    .getElementById("cardViewBtn")
    ?.classList.toggle("active", viewMode === "card");

  tableBody.innerHTML = "";
  cardContainer.innerHTML = "";

  const noData = `<tr><td colspan="${visibleFields.length}" class="text-center text-muted py-3">No invoices found.</td></tr>`;

  if (viewMode === "table") {
    cardContainer.classList.remove("active");
    tableContainer.classList.add("active");

    renderDynamicTableHead(visibleFields);

    if (!entries.length) {
      tableBody.innerHTML = noData;
      return;
    }

    entries.forEach((entry) => {
      const tr = document.createElement("tr");
      tr.innerHTML = visibleFields
        .map((f) => {
          const val =
            f === "actions"
              ? `<div class="table-actions export-ignore">${getInvoiceActionButtons(
                  entry,
                  user
                )}</div>`
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
      ? entries.map((e) => renderCard(e, visibleFields, user)).join("")
      : `<p class="text-muted text-center py-3">No invoices found.</p>`;

    initTooltips(cardContainer);
  }

  setupExportHandlers(entries);
}

/* ============================================================================
   📤 Export Handlers
============================================================================ */
let exportHandlersBound = false;
function setupExportHandlers(entries) {
  if (exportHandlersBound) return;
  exportHandlersBound = true;

  const title = "Invoices Report";

  document
    .getElementById("exportCSVBtn")
    ?.addEventListener("click", () =>
      exportData({ type: "csv", data: entries, title })
    );

  document
    .getElementById("exportExcelBtn")
    ?.addEventListener("click", () =>
      exportData({ type: "xlsx", data: entries, title })
    );

  document.getElementById("exportPDFBtn")?.addEventListener("click", () =>
    exportData({
      type: "pdf",
      title,
      selector: ".table-container",
      orientation: "landscape",
    })
  );
}
