// 📦 payment-render.js – Entity Card System (PAYMENT | ENTERPRISE FINAL)
// ============================================================================
// 🧭 FULL MASTER PARITY WITH deposit-render.js
// 🔹 Table = flat | Card = RICH + structured
// 🔹 Field-selector safe
// 🔹 Backend sorting bridge
// 🔹 Column resize + drag enabled
// 🔹 Full audit section
// 🔹 Permission-driven actions
// 🔹 Export-safe (no object leaks)
// 🔹 ADDED payment_number (safe display, no break)
// ============================================================================

import { FIELD_LABELS_PAYMENT } from "./payment-constants.js";

import { formatDateTime, initTooltips } from "../../utils/ui-utils.js";
import { buildActionButtons } from "../../utils/status-action-matrix.js";
import { exportData } from "../../utils/export-utils.js";
import { enableColumnResize } from "../../utils/table-resize.js";
import { enableColumnDrag } from "../../utils/table-column-drag.js";

/* ============================================================
   🔃 SORTABLE FIELDS (MASTER PARITY)
============================================================ */
const SORTABLE_FIELDS = new Set([
  "organization_id",
  "facility_id",
  "patient_id",
  "invoice_id",
  "amount",
  "method",
  "status",
  "created_at",
  "updated_at",
]);

let sortBy = localStorage.getItem("paymentSortBy") || "";
let sortDir = localStorage.getItem("paymentSortDir") || "asc";

function toggleSort(field) {
  if (sortBy === field) sortDir = sortDir === "asc" ? "desc" : "asc";
  else {
    sortBy = field;
    sortDir = "asc";
  }
  localStorage.setItem("paymentSortBy", sortBy);
  localStorage.setItem("paymentSortDir", sortDir);
  window.setPaymentSort?.(sortBy, sortDir);
  window.loadPaymentPage?.(1);
}

/* ============================================================
   🎛️ ACTIONS
============================================================ */
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

/* ============================================================
   🧱 TABLE HEAD
============================================================ */
export function renderDynamicTableHead(visibleFields) {
  const thead = document.getElementById("dynamicTableHead");
  const table = thead?.closest("table");
  if (!thead || !table) return;

  thead.innerHTML = "";
  const tr = document.createElement("tr");

  visibleFields.forEach((field) => {
    const th = document.createElement("th");
    th.dataset.key = field;

    const label =
      FIELD_LABELS_PAYMENT[field] || field.replace(/_/g, " ");

    if (field === "actions") {
      th.textContent = "Actions";
      th.classList.add("actions-cell");
      tr.appendChild(th);
      return;
    }

    if (SORTABLE_FIELDS.has(field)) {
      let icon = "ri-arrow-up-down-line";
      if (sortBy === field)
        icon = sortDir === "asc" ? "ri-arrow-up-line" : "ri-arrow-down-line";

      th.classList.add("sortable");
      th.innerHTML = `<span>${label}</span><i class="${icon} sort-icon"></i>`;
      th.onclick = () => toggleSort(field);
    } else {
      th.innerHTML = `<span>${label}</span>`;
    }

    tr.appendChild(th);
  });

  thead.appendChild(tr);

  let colgroup = table.querySelector("colgroup");
  if (colgroup) colgroup.remove();

  colgroup = document.createElement("colgroup");
  visibleFields.forEach(() => {
    const col = document.createElement("col");
    col.style.width = "160px";
    colgroup.appendChild(col);
  });
  table.prepend(colgroup);

  enableColumnResize(table);
  enableColumnDrag({
    table,
    visibleFields,
    onReorder: () => window.loadPaymentPage?.(1),
  });
}

/* ============================================================
   🔠 HELPERS
============================================================ */
const safe = (v) => (v !== null && v !== undefined && v !== "" ? v : "—");

function renderUserName(u) {
  if (!u) return "—";
  return [u.first_name, u.middle_name, u.last_name]
    .filter(Boolean)
    .join(" ") || u.full_name || "—";
}

function renderPatient(entry) {
  if (!entry.patient) return "—";
  const p = entry.patient;
  return `${p.pat_no || "—"} - ${[p.first_name, p.middle_name, p.last_name]
    .filter(Boolean)
    .join(" ")}`;
}

/* ============================================================
   🧩 TABLE VALUE RENDERER (OBJECT-SAFE)
============================================================ */
function renderValue(entry, field) {
  switch (field) {
    case "payment_number":
      return safe(entry.payment_number);

    case "status": {
      const s = (entry.status || "").toLowerCase();
      const cls =
        s === "pending"
          ? "bg-warning text-dark"
          : s === "completed"
          ? "bg-success"
          : s === "cancelled"
          ? "bg-danger"
          : s === "reversed"
          ? "bg-dark text-light"
          : s === "failed"
          ? "bg-secondary"
          : "bg-primary";
      return `<span class="badge ${cls}">${s.toUpperCase()}</span>`;
    }

    case "is_deposit":
      return entry.is_deposit
        ? `<span class="badge bg-info">DEPOSIT</span>`
        : `<span class="badge bg-success">REGULAR</span>`;

    case "organization":
    case "organization_id":
      return entry.organization?.name || "—";

    case "facility":
    case "facility_id":
      return entry.facility?.name || "—";

    case "patient":
    case "patient_id":
      return renderPatient(entry);

    case "invoice":
    case "invoice_id":
      return entry.invoice
        ? `${entry.invoice.invoice_number} (Bal: $${Number(
            entry.invoice.balance ?? 0
          ).toFixed(2)})`
        : "—";

    case "amount":
      return entry.amount != null
        ? `$${Number(entry.amount).toFixed(2)}`
        : "—";

    case "method":
    case "transaction_ref":
    case "reason":
      return safe(entry[field]);

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

    default: {
      const v = entry[field];
      if (v === null || v === undefined || v === "") return "—";
      if (typeof v === "object") return "—";
      return v;
    }
  }
}

/* ============================================================
   🗂️ CARD RENDERER — RICH (MASTER)
============================================================ */
export function renderCard(entry, visibleFields, user) {
  const has = (f) => visibleFields.includes(f);
  const status = (entry.status || "").toLowerCase();

  const row = (label, value) => {
    if (value === undefined || value === null || value === "") return "";
    return `
      <div class="entity-field">
        <span class="entity-label">${label}</span>
        <span class="entity-value">${safe(value)}</span>
      </div>
    `;
  };

  return `
    <div class="entity-card payment-card">

      <!-- ===================================================== -->
      <!-- 🔹 HEADER -->
      <!-- ===================================================== -->
      <div class="entity-card-header">
        <div>
          <div class="entity-secondary">${renderPatient(entry)}</div>
          <div class="entity-primary">$${Number(entry.amount || 0).toFixed(2)}</div>
        </div>
        ${
          has("status")
            ? `<span class="entity-status ${status}">${status.toUpperCase()}</span>`
            : ""
        }
      </div>

      <!-- ===================================================== -->
      <!-- 🔹 QUICK CORE (LIGHT) -->
      <!-- ===================================================== -->
      <div class="entity-card-body">
        ${row("Payment #", entry.payment_number)}
        ${row("Amount", `$${Number(entry.amount || 0).toFixed(2)}`)}
        ${row("Method", entry.method)}
        ${row("Status", status.toUpperCase())}
      </div>

      <!-- ===================================================== -->
      <!-- 📄 DETAILS (replaces context) -->
      <!-- ===================================================== -->
      <details class="entity-section">
        <summary><strong>Details</strong></summary>
        <div class="entity-card-body">
          ${row("Organization", entry.organization?.name)}
          ${row("Facility", entry.facility?.name)}
          ${row("Transaction Ref", entry.transaction_ref)}
          ${row("Invoice", renderValue(entry, "invoice"))}
        </div>
      </details>

      <!-- ===================================================== -->
      <!-- 📝 REASON (if exists) -->
      <!-- ===================================================== -->
      ${
        entry.reason
          ? `<details class="entity-section">
               <summary><strong>Reason</strong></summary>
               <div class="entity-card-body">
                 ${entry.reason}
               </div>
             </details>`
          : ""
      }

      <!-- ===================================================== -->
      <!-- 🔍 AUDIT -->
      <!-- ===================================================== -->
      <details class="entity-section">
        <summary><strong>Audit</strong></summary>
        <div class="entity-card-body">
          ${row("Created By", renderUserName(entry.createdBy))}
          ${row("Created At", formatDateTime(entry.created_at))}
          ${row("Updated By", renderUserName(entry.updatedBy))}
          ${row("Updated At", formatDateTime(entry.updated_at))}
        </div>
      </details>

      <!-- ===================================================== -->
      <!-- ⚙️ ACTIONS -->
      <!-- ===================================================== -->
      ${
        has("actions")
          ? `<div class="entity-card-footer export-ignore">
               ${getPaymentActionButtons(entry, user)}
             </div>`
          : ""
      }

    </div>
  `;
}
/* ============================================================
   📋 LIST RENDERER
============================================================ */
export function renderList({ entries, visibleFields, viewMode, user }) {
  const tableBody = document.getElementById("paymentTableBody");
  const cardContainer = document.getElementById("paymentList");
  const tableContainer = document.querySelector(".table-container");
  if (!tableBody || !cardContainer || !tableContainer) return;

  tableBody.innerHTML = "";
  cardContainer.innerHTML = "";

  if (viewMode === "table") {
    tableContainer.classList.add("active");
    cardContainer.classList.remove("active");
    renderDynamicTableHead(visibleFields);

    if (!entries.length) {
      tableBody.innerHTML = `<tr><td colspan="${visibleFields.length}" class="text-center text-muted">No payments found.</td></tr>`;
      return;
    }

    entries.forEach((e) => {
      const tr = document.createElement("tr");
      tr.innerHTML = visibleFields
        .map((f) =>
          f === "actions"
            ? `<td class="actions-cell export-ignore">${getPaymentActionButtons(
                e,
                user
              )}</td>`
            : `<td>${renderValue(e, f)}</td>`
        )
        .join("");
      tableBody.appendChild(tr);
    });

    initTooltips(tableBody);
  } else {
    tableContainer.classList.remove("active");
    cardContainer.classList.add("active");
    cardContainer.innerHTML = entries.length
      ? entries.map((e) => renderCard(e, visibleFields, user)).join("")
      : `<p class="text-center text-muted">No payments found.</p>`;
    initTooltips(cardContainer);
  }

  setupExportHandlers(entries);
}

/* ============================================================
   📤 EXPORT
============================================================ */
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
      selector: ".table-container.active, #paymentList.active",
      orientation: "landscape",
    })
  );
}

/* ============================================================
   🧾 DETAIL MODAL RENDERER
============================================================ */
export function renderPaymentDetail(entry, user) {
  return `
    <div class="d-flex justify-content-end mb-3">
      <button class="btn btn-sm btn-outline-secondary print-btn" data-id="${entry.id}">
        <i class="fas fa-print"></i> Print Payment
      </button>
    </div>

    <div class="row g-3">
      <div class="col-md-6"><strong>Payment #:</strong> ${entry.payment_number || "—"}</div>
      <div class="col-md-6"><strong>Status:</strong> ${renderValue(entry, "status")}</div>
      <div class="col-md-6"><strong>Patient:</strong> ${renderValue(entry, "patient")}</div>
      <div class="col-md-6"><strong>Invoice:</strong> ${renderValue(entry, "invoice")}</div>
      <div class="col-md-6"><strong>Organization:</strong> ${renderValue(entry, "organization")}</div>
      <div class="col-md-6"><strong>Facility:</strong> ${renderValue(entry, "facility")}</div>
      <div class="col-md-6"><strong>Method:</strong> ${safe(entry.method)}</div>
      <div class="col-md-6"><strong>Reference:</strong> ${safe(entry.transaction_ref)}</div>
      <div class="col-md-6"><strong>Received By:</strong> ${renderUserName(entry.createdBy)}</div>
      <div class="col-md-6"><strong>Date:</strong> ${renderValue(entry, "created_at")}</div>
      <div class="col-md-12"><strong>Reason:</strong> ${safe(entry.reason)}</div>
    </div>

    <hr/>

    <div class="row g-3">
      <div class="col-12"><h6 class="text-primary">Financial Summary</h6></div>
      <div class="col-md-4"><strong>Payment Amount:</strong> $${Number(entry.amount || 0).toFixed(2)}</div>
      ${
        entry.invoice
          ? `
            <div class="col-md-4"><strong>Invoice Total:</strong> $${Number(entry.invoice.total || 0).toFixed(2)}</div>
            <div class="col-md-4"><strong>Invoice Paid:</strong> $${Number(entry.invoice.total_paid || 0).toFixed(2)}</div>
            <div class="col-md-4"><strong>Invoice Balance:</strong> $${Number(entry.invoice.balance || 0).toFixed(2)}</div>
          `
          : ""
      }
    </div>
  `;
}