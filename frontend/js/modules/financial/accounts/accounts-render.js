// 📁 accounts-render.js

import { FIELD_LABELS_ACCOUNT } from "./accounts-constants.js";
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

function getAccountActionButtons(entry, userRole) {
  let role = (userRole || "").trim().toLowerCase();
  if (role.includes("super") && role.includes("admin")) role = "superadmin";
  else if (role.includes("admin")) role = "admin";
  else role = "staff";

  const canDelete = ["admin", "superadmin"].includes(role);

  const id = entry.id;

  let coreBtns = `
    <button class="btn btn-outline-primary btn-sm view-btn"
      data-id="${id}" data-bs-toggle="tooltip" title="View">
      <i class="fas fa-eye"></i>
    </button>
  `;

  let actionBtns = `
    <button class="btn btn-outline-warning btn-sm toggle-btn"
      data-id="${id}" data-bs-toggle="tooltip" title="Toggle Active">
      <i class="fas fa-power-off"></i>
    </button>
  `;

  if (canDelete) {
    actionBtns += `
      <button class="btn btn-outline-danger btn-sm delete-btn"
        data-id="${id}" data-bs-toggle="tooltip" title="Delete">
        <i class="fas fa-trash"></i>
      </button>
    `;
  }

  return `<div class="d-inline-flex gap-1 flex-wrap">${coreBtns}${actionBtns}</div>`;
}

/* ------------------------- dynamic table head ------------------------- */

export function renderAccountTableHead(visibleFields) {
  const thead = document.getElementById("accountTableHead");
  if (!thead) return;

  thead.innerHTML = "";
  const tr = document.createElement("tr");

  visibleFields.forEach((field) => {
    const th = document.createElement("th");
    th.textContent = FIELD_LABELS_ACCOUNT[field] || field;
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

    case "name": return entry.name || "—";
    case "type": return entry.type || "—";
    case "currency": return entry.currency || "—";

    case "balance":
      return entry.balance != null
        ? `$${Number(entry.balance).toFixed(2)}`
        : "—";

    case "is_active":
      return entry.is_active
        ? `<span class="badge bg-success">Active</span>`
        : `<span class="badge bg-secondary">Inactive</span>`;

    case "created_at": return entry.created_at ? formatDate(entry.created_at) : "—";
    case "updated_at": return entry.updated_at ? formatDate(entry.updated_at) : "—";
    case "deleted_at": return entry.deleted_at ? formatDate(entry.deleted_at) : "—";

    case "createdBy":
      return entry.createdBy
        ? `${entry.createdBy.first_name} ${entry.createdBy.last_name}`
        : "—";

    case "updatedBy":
      return entry.updatedBy
        ? `${entry.updatedBy.first_name} ${entry.updatedBy.last_name}`
        : "—";

    case "deletedBy":
      return entry.deletedBy
        ? `${entry.deletedBy.first_name} ${entry.deletedBy.last_name}`
        : "—";

    default:
      return entry[field] ?? "—";
  }
}

/* ---------------------------- detail modal ---------------------------- */

export function renderAccountDetail(entry) {
  return `
    <div class="row g-3">
      <div class="col-md-6"><strong>Name:</strong> ${entry.name}</div>
      <div class="col-md-6"><strong>Type:</strong> ${entry.type}</div>
      <div class="col-md-6"><strong>Currency:</strong> ${entry.currency}</div>
      <div class="col-md-6"><strong>Balance:</strong> $${Number(entry.balance || 0).toFixed(2)}</div>
      <div class="col-md-6"><strong>Status:</strong> ${renderValue(entry, "is_active")}</div>
      <div class="col-md-6"><strong>Organization:</strong> ${renderValue(entry, "organization")}</div>
      <div class="col-md-6"><strong>Facility:</strong> ${renderValue(entry, "facility")}</div>
    </div>
  `;
}

/* ---------------------------- card renderer --------------------------- */

export function renderAccountCard(entry, visibleFields, userRole) {
  let html = "";

  visibleFields.forEach((field) => {
    if (field === "actions") return;
    const label = FIELD_LABELS_ACCOUNT[field] || field;
    const value = renderValue(entry, field);
    html += `<p><strong>${label}:</strong> ${value}</p>`;
  });

  return `
    <div class="record-card card shadow-sm h-100">
      <div class="card-body">${html}</div>
      <div class="card-footer text-end">
        ${getAccountActionButtons(entry, userRole)}
      </div>
    </div>
  `;
}

/* ----------------------------- list render ---------------------------- */

export function renderAccountList({ entries, visibleFields, viewMode, userRole }) {
  const tableBody = document.getElementById("accountTableBody");
  const cardContainer = document.getElementById("accountList");
  const tableContainer = document.querySelector(".account-table-container");

  if (!tableBody || !cardContainer || !tableContainer) return;

  tableBody.innerHTML = "";
  cardContainer.innerHTML = "";

  if (viewMode === "table") {
    cardContainer.classList.remove("active");
    tableContainer.classList.add("active");

    renderAccountTableHead(visibleFields);

    if (!entries.length) {
      tableBody.innerHTML = `<tr><td colspan="${visibleFields.length}">No accounts found.</td></tr>`;
      return;
    }

    entries.forEach((entry) => {
      const row = document.createElement("tr");
      let rowHTML = "";

      visibleFields.forEach((field) => {
        const value =
          field === "actions"
            ? `<div class="table-actions">${getAccountActionButtons(entry, userRole)}</div>`
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
      ? entries.map((e) => renderAccountCard(e, visibleFields, userRole)).join("")
      : `<p class="text-muted">No accounts found.</p>`;

    initTooltips(cardContainer);
  }

  setupExportHandlers(entries, visibleFields);
}

/* -------------------------- export handlers --------------------------- */

let exportHandlersBound = false;

function setupExportHandlers(entries) {
  if (exportHandlersBound) return;
  exportHandlersBound = true;

  const title = "Accounts Report";

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
      selector: ".account-table-container",
      orientation: "landscape",
    });
  });
}