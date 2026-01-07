// 📁 assets/js/modules/refund/refunds-render.js
import { FIELD_LABELS_REFUND } from "./refunds-constants.js";
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

function getRefundActionButtons(entry, userRole) {
  let role = (userRole || "").trim().toLowerCase();
  if (role.includes("super") && role.includes("admin")) role = "superadmin";
  else if (role.includes("admin")) role = "admin";
  else role = "staff";

  const canDelete = ["admin", "superadmin"].includes(role);

  const refundId = entry.id || entry.refund_id;

  // 🧩 Core actions
  let coreBtns = `
    <button class="btn btn-outline-primary btn-sm view-btn" 
      data-id="${refundId}"
      data-bs-toggle="tooltip" data-bs-title="View" aria-label="View Refund">
      <i class="fas fa-eye"></i>
    </button>
  `;

  // 🔹 Reverse
  let financeBtns = `
    <button class="btn btn-outline-danger btn-sm reverse-btn" data-id="${refundId}"
      data-bs-toggle="tooltip" data-bs-title="Reverse Refund" aria-label="Reverse Refund">
      <i class="fas fa-history"></i>
    </button>
  `;

  // 🔹 Delete
  if (canDelete) {
    financeBtns += `
      <button class="btn btn-outline-danger btn-sm delete-btn" data-id="${refundId}"
        data-bs-toggle="tooltip" data-bs-title="Delete" aria-label="Delete Refund">
        <i class="fas fa-trash"></i>
      </button>
    `;
  }

  return `
    <div class="d-inline-flex gap-1 flex-wrap">
      ${coreBtns}
      ${financeBtns}
    </div>
  `;
}

/* ------------------------- dynamic table head ------------------------- */

export function renderDynamicTableHead(visibleFields) {
  const thead = document.getElementById("dynamicTableHead");
  if (!thead) return;

  thead.innerHTML = "";
  const tr = document.createElement("tr");

  visibleFields.forEach((field) => {
    const th = document.createElement("th");
    th.textContent = FIELD_LABELS_REFUND[field] || field.replace(/_/g, " ");
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
      if (raw === "completed") badgeClass = "bg-success";
      if (raw === "cancelled") badgeClass = "bg-dark";
      return raw ? `<span class="badge ${badgeClass}">${label}</span>` : "—";
    }

    case "invoice": return entry.invoice?.invoice_number || "—";
    case "payment": return entry.payment ? `$${Number(entry.payment.amount).toFixed(2)}` : "—";
    case "patient": return entry.patient ? `${entry.patient.pat_no} - ${entry.patient.full_name}` : "—";

    case "amount": return entry.amount != null ? `$${Number(entry.amount).toFixed(2)}` : "—";
    case "reason": return entry.reason || "—";

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
export function renderRefundDetail(entry) {
  return `
    <div class="row g-3">
      <div class="col-md-6"><strong>Invoice:</strong> ${renderValue(entry, "invoice")}</div>
      <div class="col-md-6"><strong>Payment:</strong> ${renderValue(entry, "payment")}</div>
      <div class="col-md-6"><strong>Amount:</strong> ${renderValue(entry, "amount")}</div>
      <div class="col-md-6"><strong>Status:</strong> ${renderValue(entry, "status")}</div>
      <div class="col-md-6"><strong>Reason:</strong> ${renderValue(entry, "reason")}</div>
      <div class="col-md-6"><strong>Created:</strong> ${renderValue(entry, "created_at")}</div>
      <div class="col-md-6"><strong>Updated:</strong> ${renderValue(entry, "updated_at")}</div>
    </div>
  `;
}

/* ---------------------------- card renderer --------------------------- */

export function renderCard(entry, visibleFields, userRole) {
  let html = "";

  visibleFields.forEach((field) => {
    if (field === "actions") return;
    const label = FIELD_LABELS_REFUND[field] || field.replace(/_/g, " ");
    const value = renderValue(entry, field);
    html += `<p><strong>${label}:</strong> ${value}</p>`;
  });

  return `
    <div class="record-card card shadow-sm h-100">
      <div class="card-body">${html}</div>
      <div class="card-footer text-end">
        <div class="table-actions">
          ${getRefundActionButtons(entry, userRole)}
        </div>
      </div>
    </div>
  `;
}

/* ----------------------------- list render ---------------------------- */

export function renderList({ entries, visibleFields, viewMode, userRole }) {
  const tableBody = document.getElementById("refundTableBody");
  const cardContainer = document.getElementById("refundList");
  const tableContainer = document.querySelector(".table-container");
  if (!tableBody || !cardContainer || !tableContainer) return;

  tableBody.innerHTML = "";
  cardContainer.innerHTML = "";

  if (viewMode === "table") {
    cardContainer.classList.remove("active");
    tableContainer.classList.add("active");
    document.getElementById("tableViewBtn")?.classList.add("active");
    document.getElementById("cardViewBtn")?.classList.remove("active");

    renderDynamicTableHead(visibleFields);

    if (!entries.length) {
      tableBody.innerHTML = `<tr><td colspan="${visibleFields.length}">No refunds found.</td></tr>`;
      initTooltips(tableBody);
      return;
    }

    entries.forEach((entry) => {
      const row = document.createElement("tr");
      let rowHTML = "";
      visibleFields.forEach((field) => {
        const value =
          field === "actions"
            ? `<div class="table-actions export-ignore">${getRefundActionButtons(entry, userRole)}</div>`
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
    document.getElementById("cardViewBtn")?.classList.add("active");
    document.getElementById("tableViewBtn")?.classList.remove("active");

    cardContainer.innerHTML = entries.length
      ? entries.map((e) => renderCard(e, visibleFields, userRole)).join("")
      : `<p class="text-muted">No refunds found.</p>`;

    initTooltips(cardContainer);
  }

  // ⚡ bind export
  setupExportHandlers(entries);
}

/* -------------------------- export handlers --------------------------- */
let exportHandlersBound = false;

function setupExportHandlers(entries) {
  if (exportHandlersBound) return;
  exportHandlersBound = true;

  const title = "Refunds Report";

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
      selector: ".table-container",
      orientation: "landscape",
    });
  });
}
