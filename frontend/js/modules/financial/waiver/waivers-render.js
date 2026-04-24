// 📁 assets/js/modules/waivers/waivers-render.js

import { FIELD_LABELS_DISCOUNT_WAIVER } from "./waivers-constants.js";
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

function getWaiverActionButtons(entry, userRole) {
  let role = (userRole || "").trim().toLowerCase();
  if (role.includes("super") && role.includes("admin")) role = "superadmin";
  else if (role.includes("admin")) role = "admin";
  else role = "staff";

  const canDelete = ["admin", "superadmin"].includes(role);
  const canApprove = ["admin", "superadmin", "manager"].includes(role);

  const status = (entry.status || "").toLowerCase();
  const waiverId = entry.id;

  // 🧩 Core actions
  let coreBtns = `
    <button class="btn btn-outline-primary btn-sm view-btn" 
      data-id="${waiverId}"
      data-bs-toggle="tooltip" data-bs-title="View" aria-label="View Waiver">
      <i class="fas fa-eye"></i>
    </button>
  `;

  // 🔹 Approve / Reject
  if (status === "pending" && canApprove) {
    coreBtns += `
      <button class="btn btn-outline-success btn-sm approve-btn" data-id="${waiverId}"
        data-bs-toggle="tooltip" data-bs-title="Approve" aria-label="Approve">
        <i class="fas fa-check"></i>
      </button>
      <button class="btn btn-outline-warning btn-sm reject-btn" data-id="${waiverId}"
        data-bs-toggle="tooltip" data-bs-title="Reject" aria-label="Reject">
        <i class="fas fa-times"></i>
      </button>
    `;
  }

  // 🔹 Reverse (if approved/rejected)
  let extraBtns = "";
  if (["approved", "rejected"].includes(status)) {
    extraBtns += `
      <button class="btn btn-outline-danger btn-sm reverse-btn" data-id="${waiverId}"
        data-bs-toggle="tooltip" data-bs-title="Reverse" aria-label="Reverse">
        <i class="fas fa-history"></i>
      </button>
    `;
  }

  // 🔹 Delete (admin only)
  if (canDelete && status === "pending") {
    extraBtns += `
      <button class="btn btn-outline-danger btn-sm delete-btn" data-id="${waiverId}"
        data-bs-toggle="tooltip" data-bs-title="Delete" aria-label="Delete">
        <i class="fas fa-trash"></i>
      </button>
    `;
  }

  return `
    <div class="d-inline-flex gap-1 flex-wrap">
      ${coreBtns}
      ${extraBtns}
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
    th.textContent = FIELD_LABELS_DISCOUNT_WAIVER[field] || field.replace(/_/g, " ");
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
      if (raw === "approved") badgeClass = "bg-success";
      if (raw === "rejected") badgeClass = "bg-danger";
      if (raw === "reversed") badgeClass = "bg-dark";
      return raw ? `<span class="badge ${badgeClass}">${label}</span>` : "—";
    }

    case "organization": return entry.organization?.name || "—";
    case "facility": return entry.facility?.name || "—";
    case "invoice": return entry.invoice ? entry.invoice.invoice_number : "—";
    case "patient":
      return entry.patient
        ? `${entry.patient.pat_no} - ${entry.patient.first_name} ${entry.patient.last_name}`
        : "—";

    case "amount":
    case "applied_total":
      return entry[field] != null ? `$${Number(entry[field]).toFixed(2)}` : "—";

    case "percentage":
      return entry.percentage != null ? `${entry.percentage}%` : "—";

    case "approved_at":
    case "created_at":
    case "updated_at":
    case "deleted_at":
      return entry[field] ? formatDate(entry[field]) : "—";

    case "approver": return entry.approver ? `${entry.approver.first_name} ${entry.approver.last_name}` : "—";
    case "createdBy": return entry.createdBy ? `${entry.createdBy.first_name} ${entry.createdBy.last_name}` : "—";
    case "updatedBy": return entry.updatedBy ? `${entry.updatedBy.first_name} ${entry.updatedBy.last_name}` : "—";
    case "deletedBy": return entry.deletedBy ? `${entry.deletedBy.first_name} ${entry.deletedBy.last_name}` : "—";

    default:
      return entry[field] != null ? String(entry[field]) : "—";
  }
}

/* ---------------------------- detail modal ---------------------------- */

export function renderWaiverDetail(entry, userRole) {
  return `
    <div class="row g-3">
      <div class="col-md-6"><strong>Invoice:</strong> ${renderValue(entry, "invoice")}</div>
      <div class="col-md-6"><strong>Patient:</strong> ${renderValue(entry, "patient")}</div>
      <div class="col-md-6"><strong>Organization:</strong> ${renderValue(entry, "organization")}</div>
      <div class="col-md-6"><strong>Facility:</strong> ${renderValue(entry, "facility")}</div>
      <div class="col-md-6"><strong>Reason:</strong> ${entry.reason || "—"}</div>
      <div class="col-md-6"><strong>Type:</strong> ${entry.percentage != null ? "Percentage" : "Fixed"}</div>
      <div class="col-md-6"><strong>Value:</strong> ${
        entry.percentage != null ? `${entry.percentage}%` : `$${Number(entry.amount).toFixed(2)}`
      }</div>
      <div class="col-md-6"><strong>Applied Total:</strong> ${renderValue(entry, "applied_total")}</div>
      <div class="col-md-6"><strong>Status:</strong> ${renderValue(entry, "status")}</div>
      <div class="col-md-6"><strong>Approved By:</strong> ${renderValue(entry, "approver")}</div>
      <div class="col-md-6"><strong>Approved At:</strong> ${renderValue(entry, "approved_at")}</div>
    </div>
  `;
}

/* ---------------------------- card renderer --------------------------- */

export function renderCard(entry, visibleFields, userRole) {
  let html = "";

  visibleFields.forEach((field) => {
    if (field === "actions") return;
    const label = FIELD_LABELS_DISCOUNT_WAIVER[field] || field.replace(/_/g, " ");
    const value = renderValue(entry, field);
    html += `<p><strong>${label}:</strong> ${value}</p>`;
  });

  return `
    <div class="record-card card shadow-sm h-100">
      <div class="card-body">${html}</div>
      <div class="card-footer text-end">
        <div class="table-actions">
          ${getWaiverActionButtons(entry, userRole)}
        </div>
      </div>
    </div>
  `;
}

/* ----------------------------- list render ---------------------------- */

export function renderList({ entries, visibleFields, viewMode, userRole }) {
  const tableBody = document.getElementById("waiverTableBody");
  const cardContainer = document.getElementById("waiverList");
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
      tableBody.innerHTML = `<tr><td colspan="${visibleFields.length}">No waivers found.</td></tr>`;
      initTooltips(tableBody);
      return;
    }

    entries.forEach((entry) => {
      const row = document.createElement("tr");
      let rowHTML = "";
      visibleFields.forEach((field) => {
        const value =
          field === "actions"
            ? `<div class="table-actions export-ignore">${getWaiverActionButtons(entry, userRole)}</div>`
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
      : `<p class="text-muted">No waivers found.</p>`;

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

  const title = "Waivers Report";

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
