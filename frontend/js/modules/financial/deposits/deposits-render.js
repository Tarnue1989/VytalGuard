// 📁 assets/js/modules/financial/invoices/deposits/deposits-render.js

import { FIELD_LABELS_DEPOSIT } from "./deposits-constants.js";
import { formatDate } from "../../../utils/ui-utils.js";
import { exportData } from "../../../utils/export-utils.js";

/* ----------------------------- helpers ----------------------------- */

// ▶️ Bootstrap tooltips
function initTooltips(scope = document) {
  if (!window.bootstrap) return;
  const triggers = [].slice.call(scope.querySelectorAll("[data-bs-toggle='tooltip']"));
  triggers.forEach((el) => {
    if (!bootstrap.Tooltip.getInstance(el)) {
      new bootstrap.Tooltip(el);
    }
  });
}

/* --------------------------- action buttons --------------------------- */

function getDepositActionButtons(entry, userRole) {
  let role = (userRole || "").trim().toLowerCase();
  if (role.includes("super") && role.includes("admin")) role = "superadmin";
  else if (role.includes("admin")) role = "admin";
  else role = "staff";

  const canDelete = ["admin", "superadmin"].includes(role);

  const depositId = entry.id;

  let coreBtns = `
    <button class="btn btn-outline-primary btn-sm view-btn"
      data-id="${depositId}"
      data-bs-toggle="tooltip" data-bs-title="View" aria-label="View Deposit">
      <i class="fas fa-eye"></i>
    </button>
  `;

  let actionBtns = `
    <button class="btn btn-outline-danger btn-sm reverse-btn" data-id="${depositId}"
      data-bs-toggle="tooltip" data-bs-title="Reverse Deposit" aria-label="Reverse Deposit">
      <i class="fas fa-history"></i>
    </button>
  `;

  if (canDelete && entry.status === "pending") {
    actionBtns += `
      <button class="btn btn-outline-danger btn-sm delete-btn" data-id="${depositId}"
        data-bs-toggle="tooltip" data-bs-title="Delete" aria-label="Delete Deposit">
        <i class="fas fa-trash"></i>
      </button>
    `;
  }

  return `
    <div class="d-inline-flex gap-1 flex-wrap">
      ${coreBtns}
      ${actionBtns}
    </div>
  `;
}

/* ------------------------- dynamic table head ------------------------- */

export function renderDepositTableHead(visibleFields) {
  const thead = document.getElementById("depositTableHead");
  if (!thead) return;

  thead.innerHTML = "";
  const tr = document.createElement("tr");

  visibleFields.forEach((field) => {
    const th = document.createElement("th");
    th.textContent = FIELD_LABELS_DEPOSIT[field] || field.replace(/_/g, " ");
    if (field === "actions") th.classList.add("actions-cell");
    tr.appendChild(th);
  });

  thead.appendChild(tr);
}

/* ---------------------------- field render ---------------------------- */

function renderValue(entry, field) {
  switch (field) {
    case "status": {
      const raw = (entry.status || "").toLowerCase();
      const label = raw.charAt(0).toUpperCase() + raw.slice(1);
      let badgeClass = "bg-secondary";
      if (raw === "pending") badgeClass = "bg-warning";
      if (raw === "applied") badgeClass = "bg-success";
      if (raw === "refunded") badgeClass = "bg-info";
      if (raw === "cancelled") badgeClass = "bg-dark";
      return raw ? `<span class="badge ${badgeClass}">${label}</span>` : "—";
    }

    case "organization": return entry.organization?.name || "—";
    case "facility": return entry.facility?.name || "—";
    case "patient":
      return entry.patient
        ? `${entry.patient.pat_no} - ${entry.patient.first_name} ${entry.patient.last_name}`
        : "—";

    case "appliedInvoice":
      return entry.appliedInvoice
        ? `#${entry.appliedInvoice.invoice_number} (${entry.appliedInvoice.status})`
        : "—";

    case "amount":
      return entry.amount != null ? `$${Number(entry.amount).toFixed(2)}` : "—";

    case "method":
      return entry.method || "—";

    case "transaction_ref":
      return entry.transaction_ref || "—";

    case "created_at": return entry.created_at ? formatDate(entry.created_at) : "—";
    case "updated_at": return entry.updated_at ? formatDate(entry.updated_at) : "—";
    case "deleted_at": return entry.deleted_at ? formatDate(entry.deleted_at) : "—";

    case "createdBy": return entry.createdBy ? `${entry.createdBy.first_name} ${entry.createdBy.last_name}` : "—";
    case "updatedBy": return entry.updatedBy ? `${entry.updatedBy.first_name} ${entry.updatedBy.last_name}` : "—";
    case "deletedBy": return entry.deletedBy ? `${entry.deletedBy.first_name} ${entry.deletedBy.last_name}` : "—";

    default:
      return entry[field] != null ? String(entry[field]) : "—";
  }
}

/* ---------------------------- detail modal ---------------------------- */
export function renderDepositDetail(entry, userRole) {
  return `
    <div class="row g-3">
      <div class="col-md-6"><strong>Amount:</strong> $${Number(entry.amount).toFixed(2)}</div>
      <div class="col-md-6"><strong>Status:</strong> ${renderValue(entry, "status")}</div>
      <div class="col-md-6"><strong>Method:</strong> ${renderValue(entry, "method")}</div>
      <div class="col-md-6"><strong>Reference:</strong> ${renderValue(entry, "transaction_ref")}</div>
      <div class="col-md-6"><strong>Patient:</strong> ${renderValue(entry, "patient")}</div>
      <div class="col-md-6"><strong>Organization:</strong> ${renderValue(entry, "organization")}</div>
      <div class="col-md-6"><strong>Facility:</strong> ${renderValue(entry, "facility")}</div>
      <div class="col-md-6"><strong>Applied Invoice:</strong> ${renderValue(entry, "appliedInvoice")}</div>
    </div>
  `;
}

/* ---------------------------- card renderer --------------------------- */

export function renderDepositCard(entry, visibleFields, userRole) {
  let html = "";

  visibleFields.forEach((field) => {
    if (field === "actions") return;
    const label = FIELD_LABELS_DEPOSIT[field] || field.replace(/_/g, " ");
    const value = renderValue(entry, field);
    html += `<p><strong>${label}:</strong> ${value}</p>`;
  });

  return `
    <div class="record-card card shadow-sm h-100">
      <div class="card-body">${html}</div>
      <div class="card-footer text-end">
        <div class="table-actions">
          ${getDepositActionButtons(entry, userRole)}
        </div>
      </div>
    </div>
  `;
}

/* ----------------------------- list render ---------------------------- */

export function renderDepositList({ entries, visibleFields, viewMode, userRole }) {
  const tableBody = document.getElementById("depositTableBody");
  const cardContainer = document.getElementById("depositList");
  const tableContainer = document.querySelector(".deposit-table-container");
  if (!tableBody || !cardContainer || !tableContainer) return;

  tableBody.innerHTML = "";
  cardContainer.innerHTML = "";

  if (viewMode === "table") {
    cardContainer.classList.remove("active");
    tableContainer.classList.add("active");

    renderDepositTableHead(visibleFields);

    if (!entries.length) {
      tableBody.innerHTML = `<tr><td colspan="${visibleFields.length}">No deposits found.</td></tr>`;
      initTooltips(tableBody);
      return;
    }

    entries.forEach((entry) => {
      const row = document.createElement("tr");
      let rowHTML = "";
      visibleFields.forEach((field) => {
        const value =
          field === "actions"
            ? `<div class="table-actions export-ignore">${getDepositActionButtons(entry, userRole)}</div>`
            : renderValue(entry, field);

        const tdClass = field === "actions"
          ? ' class="actions-cell text-center"'
          : "";

        rowHTML += `<td${tdClass}>${value}</td>`;
      });
      row.innerHTML = rowHTML;
      tableBody.appendChild(row);
    });

    initTooltips(tableBody);

  } else {
    tableContainer.classList.remove("active");
    cardContainer.classList.add("active");

    cardContainer.innerHTML = entries.length
      ? entries.map((e) => renderDepositCard(e, visibleFields, userRole)).join("")
      : `<p class="text-muted">No deposits found.</p>`;

    initTooltips(cardContainer);
  }

  // ⚡ bind export
  setupExportHandlers(entries, visibleFields);
}

/* -------------------------- export handlers --------------------------- */
let exportHandlersBound = false;

function setupExportHandlers(entries) {
  if (exportHandlersBound) return;
  exportHandlersBound = true;

  const title = "Deposits Report";

  document.getElementById("exportCSVBtn")?.addEventListener("click", () => {
    exportData({ type: "csv", data: entries, title });
  });

  document.getElementById("exportExcelBtn")?.addEventListener("click", () => {
    exportData({ type: "xlsx", data: entries, title });
  });

  document.getElementById("exportPDFBtn")?.addEventListener("click", () => {
    exportData({
      type: "pdf",
      title,
      selector: ".deposit-table-container",
      orientation: "landscape",
    });
  });
}
