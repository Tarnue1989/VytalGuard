// 📁 ledger-render.js

import { FIELD_LABELS_LEDGER } from "./ledger-constants.js";
import { formatDate } from "../../../utils/ui-utils.js";
import { exportData } from "../../../utils/export-utils.js";

/* ----------------------------- helpers ----------------------------- */

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

function getLedgerActionButtons(entry) {
  return `
    <div class="d-inline-flex gap-1 flex-wrap">
      <button class="btn btn-outline-primary btn-sm view-btn"
        data-id="${entry.id}"
        data-bs-toggle="tooltip"
        title="View Ledger">
        <i class="fas fa-eye"></i>
      </button>
    </div>
  `;
}

/* ------------------------- dynamic table head ------------------------- */

export function renderLedgerTableHead(visibleFields) {
  const thead = document.getElementById("ledgerTableHead");
  if (!thead) return;

  thead.innerHTML = "";
  const tr = document.createElement("tr");

  visibleFields.forEach((field) => {
    const th = document.createElement("th");
    th.textContent = FIELD_LABELS_LEDGER[field] || field.replace(/_/g, " ");
    if (field === "actions") th.classList.add("actions-cell");
    tr.appendChild(th);
  });

  thead.appendChild(tr);
}

/* ---------------------------- field render ---------------------------- */

function renderValue(entry, field) {
  switch (field) {
    case "organization": return entry.organization?.name || "—";
    case "facility": return entry.facility?.name || "—";
    case "account": return entry.account?.name || "—";

    case "patient":
      return entry.patient
        ? `${entry.patient.pat_no} - ${entry.patient.first_name} ${entry.patient.last_name}`
        : "—";

    case "invoice":
      return entry.invoice
        ? `#${entry.invoice.invoice_number}`
        : "—";

    case "transaction_type": {
      const raw = (entry.transaction_type || "").toLowerCase();
      const badge =
        raw === "credit" ? "bg-success" :
        raw === "debit" ? "bg-danger" :
        "bg-secondary";
      return `<span class="badge ${badge}">${raw.toUpperCase()}</span>`;
    }

    case "amount":
      return entry.amount != null
        ? `$${Number(entry.amount).toFixed(2)}`
        : "—";

    case "method": return entry.method || "—";

    case "status": {
      const raw = (entry.status || "").toLowerCase();
      const badge =
        raw === "posted" ? "bg-success" :
        raw === "pending" ? "bg-warning" :
        "bg-secondary";
      return `<span class="badge ${badge}">${raw}</span>`;
    }

    case "note": return entry.note || "—";

    case "created_at": return entry.created_at ? formatDate(entry.created_at) : "—";
    case "updated_at": return entry.updated_at ? formatDate(entry.updated_at) : "—";

    case "createdBy":
      return entry.createdBy
        ? `${entry.createdBy.first_name} ${entry.createdBy.last_name}`
        : "—";

    case "updatedBy":
      return entry.updatedBy
        ? `${entry.updatedBy.first_name} ${entry.updatedBy.last_name}`
        : "—";

    default:
      return entry[field] ?? "—";
  }
}

/* ---------------------------- detail modal ---------------------------- */

export function renderLedgerDetail(entry) {
  return `
    <div class="row g-3">
      <div class="col-md-6"><strong>Account:</strong> ${renderValue(entry, "account")}</div>
      <div class="col-md-6"><strong>Type:</strong> ${renderValue(entry, "transaction_type")}</div>
      <div class="col-md-6"><strong>Amount:</strong> ${renderValue(entry, "amount")}</div>
      <div class="col-md-6"><strong>Status:</strong> ${renderValue(entry, "status")}</div>
      <div class="col-md-6"><strong>Method:</strong> ${renderValue(entry, "method")}</div>
      <div class="col-md-6"><strong>Note:</strong> ${renderValue(entry, "note")}</div>
      <div class="col-md-6"><strong>Patient:</strong> ${renderValue(entry, "patient")}</div>
      <div class="col-md-6"><strong>Invoice:</strong> ${renderValue(entry, "invoice")}</div>
    </div>
  `;
}

/* ---------------------------- card renderer --------------------------- */

export function renderLedgerCard(entry, visibleFields) {
  let html = "";

  visibleFields.forEach((field) => {
    if (field === "actions") return;
    const label = FIELD_LABELS_LEDGER[field] || field;
    const value = renderValue(entry, field);
    html += `<p><strong>${label}:</strong> ${value}</p>`;
  });

  return `
    <div class="record-card card shadow-sm h-100">
      <div class="card-body">${html}</div>
      <div class="card-footer text-end">
        ${getLedgerActionButtons(entry)}
      </div>
    </div>
  `;
}

/* ----------------------------- list render ---------------------------- */

export function renderLedgerList({ entries, visibleFields, viewMode }) {
  const tableBody = document.getElementById("ledgerTableBody");
  const cardContainer = document.getElementById("ledgerList");
  const tableContainer = document.querySelector(".ledger-table-container");

  if (!tableBody || !cardContainer || !tableContainer) return;

  tableBody.innerHTML = "";
  cardContainer.innerHTML = "";

  if (viewMode === "table") {
    cardContainer.classList.remove("active");
    tableContainer.classList.add("active");

    renderLedgerTableHead(visibleFields);

    if (!entries.length) {
      tableBody.innerHTML = `<tr><td colspan="${visibleFields.length}">No records found.</td></tr>`;
      initTooltips(tableBody);
      return;
    }

    entries.forEach((entry) => {
      const row = document.createElement("tr");
      let rowHTML = "";

      visibleFields.forEach((field) => {
        const value =
          field === "actions"
            ? `<div class="table-actions">${getLedgerActionButtons(entry)}</div>`
            : renderValue(entry, field);

        rowHTML += `<td>${value}</td>`;
      });

      row.innerHTML = rowHTML;
      tableBody.appendChild(row);
    });

    initTooltips(tableBody);

  } else {
    tableContainer.classList.remove("active");
    cardContainer.classList.add("active");

    cardContainer.innerHTML = entries.length
      ? entries.map((e) =>
          renderLedgerCard(e, visibleFields)
        ).join("")
      : `<p class="text-muted">No records found.</p>`;

    initTooltips(cardContainer);
  }

  setupExportHandlers(entries, visibleFields);
}

/* -------------------------- export handlers --------------------------- */

let exportHandlersBound = false;

function setupExportHandlers(entries) {
  if (exportHandlersBound) return;
  exportHandlersBound = true;

  const title = "Ledger Report";

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
      selector: ".ledger-table-container",
      orientation: "landscape",
    });
  });
}