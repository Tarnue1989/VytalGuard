// 📦 invoice-render.js – Enterprise Master Pattern (PART 1 STRUCTURE UPGRADE)
// ============================================================================
// 🔹 Adds sorting system (MASTER)
// 🔹 Adds column resize + drag
// 🔹 Upgrades table head to sortable
// 🔹 Adds safe rendering protection
// 🔹 Keeps ALL existing logic intact (NO BREAKS)
// ============================================================================

import { FIELD_LABELS_INVOICE } from "./invoice-constants.js";
import { formatDate, formatDateTime, initTooltips } from "../../../utils/ui-utils.js";
import { buildActionButtons } from "../../../utils/status-action-matrix.js";
import { exportData } from "../../../utils/export-utils.js";
import { enableColumnResize } from "../../../utils/table-resize.js";
import { enableColumnDrag } from "../../../utils/table-column-drag.js";

/* ============================================================
   🔃 SORTABLE FIELDS (MASTER)
============================================================ */
const SORTABLE_FIELDS = new Set([
  "invoice_number",
  "status",
  "total",
  "balance",
  "total_paid",
  "currency",
  "created_at",
  "updated_at",
]);

let sortBy = localStorage.getItem("invoiceSortBy") || "";
let sortDir = localStorage.getItem("invoiceSortDir") || "asc";

function toggleSort(field) {
  if (sortBy === field) sortDir = sortDir === "asc" ? "desc" : "asc";
  else {
    sortBy = field;
    sortDir = "asc";
  }

  localStorage.setItem("invoiceSortBy", sortBy);
  localStorage.setItem("invoiceSortDir", sortDir);

  window.setInvoiceSort?.(sortBy, sortDir);
  window.loadInvoicePage?.(1);
}

/* ============================================================
   🎛️ ACTION BUTTONS
============================================================ */
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

/* ============================================================
   🧱 DYNAMIC TABLE HEAD (MASTER)
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
      FIELD_LABELS_INVOICE[field] || field.replace(/_/g, " ");

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

  /* ===== COLUMN WIDTH (MASTER) ===== */
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
    onReorder: () => window.loadInvoicePage?.(1),
  });
}

/* ============================================================
   🔠 SAFE HELPERS
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
   🧩 VALUE RENDER (SAFE FIXED)
============================================================ */
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
    case "balance": {
      const currency = entry.currency || "USD";
      return entry[field] != null
        ? `${currency} ${Number(entry[field]).toFixed(2)}`
        : "—";
    }

    case "createdBy":
    case "updatedBy":
    case "deletedBy":
      return renderUserName(entry[field]);

    case "created_at":
    case "updated_at":
    case "deleted_at":
    case "due_date":
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
   📋 LIST RENDER (STRUCTURE UPGRADED)
============================================================ */
export function renderList({ entries, visibleFields, viewMode, user }) {
  const tableBody = document.getElementById("invoiceTableBody");
  const cardContainer = document.getElementById("invoiceList");
  const tableContainer = document.querySelector(".table-container");

  if (!tableBody || !cardContainer || !tableContainer) return;

  tableBody.innerHTML = "";
  cardContainer.innerHTML = "";

  if (viewMode === "table") {
    tableContainer.classList.add("active");
    cardContainer.classList.remove("active");

    renderDynamicTableHead(visibleFields);

    if (!entries.length) {
      tableBody.innerHTML = `<tr><td colspan="${visibleFields.length}" class="text-center text-muted">No invoices found.</td></tr>`;
      return;
    }

    entries.forEach((e) => {
      const tr = document.createElement("tr");
      tr.innerHTML = visibleFields
        .map((f) =>
          f === "actions"
            ? `<td class="actions-cell export-ignore">${getInvoiceActionButtons(
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
      : `<p class="text-center text-muted">No invoices found.</p>`;

    initTooltips(cardContainer);
  }

  setupExportHandlers(entries);
}

/* ============================================================
   💱 CURRENCY HELPER (MASTER)
============================================================ */
function getCurrencySymbol(currency) {
  if (!currency) return "";
  return currency === "USD" ? "$" : currency === "LRD" ? "L$" : currency;
}

/* ============================================================
   🗂️ CARD RENDERER (MASTER UPGRADE)
============================================================ */
export function renderCard(entry, visibleFields, user) {
  const has = (f) => visibleFields.includes(f);
  const status = (entry.status || "").toLowerCase();

  const safe = (v) =>
    v !== null && v !== undefined && v !== "" ? v : "—";

  const money = (v) =>
    `${getCurrencySymbol(entry.currency)} ${Number(v || 0).toFixed(2)}`;

  const row = (label, value) => {
    if (value === undefined || value === null || value === "") return "";
    return `
      <div class="entity-field">
        <span class="entity-label">${label}</span>
        <span class="entity-value">${safe(value)}</span>
      </div>
    `;
  };

  const lifecycle =
    status === "paid"
      ? "Paid"
      : status === "partial"
      ? "Partially Paid"
      : status === "voided"
      ? "Voided"
      : "";

  const AUDIT_FIELDS = [
    "createdBy",
    "updatedBy",
    "deletedBy",
    "created_at",
    "updated_at",
    "deleted_at",
  ];

  const filteredFields = visibleFields.filter(
    (f) =>
      ![
        "actions",
        "status",
        "invoice_number",
        "total",
        "balance",
        "total_paid",
        "items",
        ...AUDIT_FIELDS,
      ].includes(f)
  );

  const renderItems = () => {
    if (!Array.isArray(entry.items) || !entry.items.length) return "—";

    return `
      <ul class="mb-0 ps-3">
        ${entry.items
          .map((i) => {
            const qty = Number(i.quantity || 1);
            const unit = Number(i.unit_price || 0);
            const total = qty * unit;

            return `
              <li>
                <strong>${i.description || "Item"}</strong><br/>
                <small>
                  Qty: ${qty} | Unit: ${money(unit)} | Total: ${money(total)}
                </small>
              </li>
            `;
          })
          .join("")}
      </ul>
    `;
  };

  return `
    <div class="entity-card invoice-card">

      <!-- HEADER -->
      <div class="entity-card-header">
        <div>
          <div class="entity-secondary">${renderPatient(entry)}</div>
          <div class="entity-primary">${money(entry.total)}</div>
        </div>
        ${
          has("status")
            ? `<span class="entity-status ${status}">
                 ${status.toUpperCase()}
               </span>`
            : ""
        }
      </div>

      <!-- CORE (MATCH DEPOSIT STYLE) -->
      <div class="entity-card-body">
        ${row("Invoice #", entry.invoice_number)}
        ${row("Total", money(entry.total))}
        ${row("Balance", money(entry.balance))}
        ${row("Paid", money(entry.total_paid))}
        ${row("Status", status.toUpperCase())}
        ${
          lifecycle
            ? row(
                "Lifecycle",
                `<span class="text-muted">${lifecycle}</span>`
              )
            : ""
        }
      </div>

      <!-- DETAILS -->
      <details class="entity-section">
        <summary><strong>Details</strong></summary>
        <div class="entity-card-body">
          ${row("Organization", entry.organization?.name)}
          ${row("Facility", entry.facility?.name)}
          ${row("Date", formatDate(entry.created_at))}

          ${filteredFields
            .map((f) =>
              row(
                FIELD_LABELS_INVOICE[f] || f,
                renderValue(entry, f)
              )
            )
            .join("")}
        </div>
      </details>

      <!-- ITEMS -->
      <details class="entity-section">
        <summary><strong>Items</strong></summary>
        <div class="entity-card-body">
          ${renderItems()}
        </div>
      </details>

      <!-- AUDIT (FIXED: DATE + TIME) -->
      <details class="entity-section">
        <summary><strong>Audit</strong></summary>
        <div class="entity-card-body">
          ${row("Created By", renderUserName(entry.createdBy))}
          ${row("Created At", formatDateTime(entry.created_at))}
          ${row("Updated By", renderUserName(entry.updatedBy))}
          ${row("Updated At", formatDateTime(entry.updated_at))}
        </div>
      </details>

      <!-- ACTIONS -->
      ${
        has("actions")
          ? `<div class="entity-card-footer export-ignore">
               ${getInvoiceActionButtons(entry, user)}
             </div>`
          : ""
      }

    </div>
  `;
}

/* ============================================================
   📤 EXPORT FIX (MASTER)
============================================================ */
function setupExportHandlers(entries) {
  const title = "Invoices Report";

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
      selector: ".table-container.active, #invoiceList.active",
      orientation: "landscape",
    })
  );
}