// 📁 cash-closing-render.js

import { FIELD_LABELS_CASH_CLOSING } from "./cash-closing-constants.js";
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

function getCashClosingActionButtons(entry, userRole) {
  let role = (userRole || "").trim().toLowerCase();
  if (role.includes("super") && role.includes("admin")) role = "superadmin";
  else if (role.includes("admin")) role = "admin";
  else role = "staff";

  const canReopen = ["admin", "superadmin"].includes(role);

  const id = entry.id;

  let coreBtns = `
    <button class="btn btn-outline-primary btn-sm view-btn"
      data-id="${id}" data-bs-toggle="tooltip" title="View">
      <i class="fas fa-eye"></i>
    </button>
  `;

  let actionBtns = "";

  if (canReopen && entry.status === "closed") {
    actionBtns += `
      <button class="btn btn-outline-warning btn-sm reopen-btn"
        data-id="${id}" data-bs-toggle="tooltip" title="Reopen">
        <i class="fas fa-undo"></i>
      </button>
    `;
  }

  return `<div class="d-inline-flex gap-1 flex-wrap">${coreBtns}${actionBtns}</div>`;
}

/* ------------------------- table head ------------------------- */

export function renderCashClosingTableHead(visibleFields) {
  const thead = document.getElementById("cashClosingTableHead");
  if (!thead) return;

  thead.innerHTML = "";
  const tr = document.createElement("tr");

  visibleFields.forEach((field) => {
    const th = document.createElement("th");
    th.textContent = FIELD_LABELS_CASH_CLOSING[field] || field;
    if (field === "actions") th.classList.add("actions-cell");
    tr.appendChild(th);
  });

  thead.appendChild(tr);
}

/* ---------------------------- value render ---------------------------- */

function renderValue(entry, field) {
  switch (field) {
    case "organization": return entry.organization?.name || "—";
    case "facility": return entry.facility?.name || "—";
    case "account": return entry.account?.name || "—";

    case "date":
      return entry.date ? formatDate(entry.date) : "—";

    case "opening_balance":
    case "total_in":
    case "total_out":
    case "closing_balance":
      return entry[field] != null
        ? `$${Number(entry[field]).toFixed(2)}`
        : "—";

    case "status": {
      const raw = (entry.status || "").toLowerCase();
      const label = raw.charAt(0).toUpperCase() + raw.slice(1);
      const badge =
        raw === "closed"
          ? "bg-success"
          : raw === "reopened"
          ? "bg-warning"
          : "bg-secondary";
      return `<span class="badge ${badge}">${label}</span>`;
    }

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

export function renderCashClosingDetail(entry) {
  return `
    <div class="row g-3">
      <div class="col-md-6"><strong>Account:</strong> ${renderValue(entry, "account")}</div>
      <div class="col-md-6"><strong>Date:</strong> ${renderValue(entry, "date")}</div>
      <div class="col-md-6"><strong>Opening:</strong> ${renderValue(entry, "opening_balance")}</div>
      <div class="col-md-6"><strong>Total In:</strong> ${renderValue(entry, "total_in")}</div>
      <div class="col-md-6"><strong>Total Out:</strong> ${renderValue(entry, "total_out")}</div>
      <div class="col-md-6"><strong>Closing:</strong> ${renderValue(entry, "closing_balance")}</div>
      <div class="col-md-6"><strong>Status:</strong> ${renderValue(entry, "status")}</div>
    </div>
  `;
}

/* ---------------------------- card renderer --------------------------- */

export function renderCashClosingCard(entry, visibleFields, userRole) {
  let html = "";

  visibleFields.forEach((field) => {
    if (field === "actions") return;
    const label = FIELD_LABELS_CASH_CLOSING[field] || field;
    const value = renderValue(entry, field);
    html += `<p><strong>${label}:</strong> ${value}</p>`;
  });

  return `
    <div class="record-card card shadow-sm h-100">
      <div class="card-body">${html}</div>
      <div class="card-footer text-end">
        ${getCashClosingActionButtons(entry, userRole)}
      </div>
    </div>
  `;
}

/* ----------------------------- list render ---------------------------- */

export function renderCashClosingList({ entries, visibleFields, viewMode, userRole }) {
  const tableBody = document.getElementById("cashClosingTableBody");
  const cardContainer = document.getElementById("cashClosingList");
  const tableContainer = document.querySelector(".cash-closing-table-container");

  if (!tableBody || !cardContainer || !tableContainer) return;

  tableBody.innerHTML = "";
  cardContainer.innerHTML = "";

  if (viewMode === "table") {
    cardContainer.classList.remove("active");
    tableContainer.classList.add("active");

    renderCashClosingTableHead(visibleFields);

    if (!entries.length) {
      tableBody.innerHTML = `<tr><td colspan="${visibleFields.length}">No records found.</td></tr>`;
      return;
    }

    entries.forEach((entry) => {
      const row = document.createElement("tr");
      let rowHTML = "";

      visibleFields.forEach((field) => {
        const value =
          field === "actions"
            ? `<div class="table-actions">${getCashClosingActionButtons(entry, userRole)}</div>`
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
          renderCashClosingCard(e, visibleFields, userRole)
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

  const title = "Cash Closing Report";

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
      selector: ".cash-closing-table-container",
      orientation: "landscape",
    });
  });
}