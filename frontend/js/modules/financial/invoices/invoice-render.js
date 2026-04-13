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
   🧩 VALUE RENDER (ENTERPRISE FINAL FIXED)
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

    /* ============================================================
       💰 FINANCIAL FIELDS (COMMA FIX + CONSISTENT)
    ============================================================ */
    case "subtotal":
    case "total":
    case "total_discount":
    case "total_tax":
    case "total_paid":
    case "refunded_amount":
    case "balance":
    case "coverage_amount": {
      const currency = entry.currency || "USD";

      return entry[field] != null
        ? `${currency} ${Number(entry[field]).toLocaleString("en-US", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}`
        : "—";
    }

    /* ============================================================
       👤 USERS
    ============================================================ */
    case "createdBy":
    case "updatedBy":
    case "deletedBy":
      return renderUserName(entry[field]);

    /* ============================================================
       📅 DATES
    ============================================================ */
    case "created_at":
    case "updated_at":
    case "deleted_at":
    case "due_date":
      return entry[field] ? formatDate(entry[field]) : "—";

    /* ============================================================
       🔐 DEFAULT SAFE
    ============================================================ */
    default: {
      const v = entry[field];

      if (v === null || v === undefined || v === "") return "—";
      if (typeof v === "object") return "—";

      return v;
    }
  }
}

/* ============================================================
   📋 LIST RENDER (ENTERPRISE FINAL — INSURANCE FIXED)
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

      /* ============================================================
         🔥 FIXED FINANCIAL LOGIC
      ============================================================ */
      const insurance = Number(e.insurance_amount || 0);
      const patientPortion =
        Number(e.total || 0) - insurance;

      tr.innerHTML = visibleFields
        .map((f) => {
          if (f === "actions") {
            return `<td class="actions-cell export-ignore">${getInvoiceActionButtons(e, user)}</td>`;
          }

          /* ============================================================
             💰 CUSTOM FINANCIAL DISPLAY (FIXED)
          ============================================================ */
          if (f === "total")
            return `<td>${money(e.total, e.currency)}</td>`;

          if (f === "coverage_amount") // keep field key for compatibility
            return `<td>${money(e.insurance_amount, e.currency)}</td>`;

          if (f === "patient_amount")
            return `<td>${money(patientPortion, e.currency)}</td>`;

          if (f === "total_paid")
            return `<td>${money(e.total_paid, e.currency)}</td>`;

          if (f === "balance")
            return `<td>${money(e.balance, e.currency)}</td>`;

          return `<td>${renderValue(e, f)}</td>`;
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
      : `<p class="text-center text-muted">No invoices found.</p>`;

    initTooltips(cardContainer);
  }

  setupExportHandlers(entries);
}

/* ============================================================
   💱 MONEY FORMATTER (COMMA FIX)
============================================================ */
function money(value, currency) {
  const symbol =
    currency === "USD" ? "$" : currency === "LRD" ? "L$" : currency || "";

  return `${symbol} ${Number(value || 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/* ============================================================
   🗂️ CARD RENDERER (ENTERPRISE FINAL — INSURANCE FIXED)
============================================================ */
export function renderCard(entry, visibleFields, user) {
  const has = (f) => visibleFields.includes(f);
  const status = (entry.status || "").toLowerCase();

  const safe = (v) =>
    v !== null && v !== undefined && v !== "" ? v : "—";

  /* ============================================================
     🔥 FIXED FINANCIAL LOGIC
  ============================================================ */
  const insurance = Number(entry.insurance_amount || 0);
  const patientPortion =
    Number(entry.total || 0) - insurance;

  const row = (label, value) => {
    if (!value && value !== 0) return "";
    return `
      <div class="entity-field">
        <span class="entity-label">${label}</span>
        <span class="entity-value">${value}</span>
      </div>
    `;
  };

  const lifecycle =
    status === "paid"
      ? "Paid"
      : status === "partial"
      ? "Partially Paid"
      : "";

  return `
    <div class="entity-card invoice-card">

      <!-- HEADER -->
      <div class="entity-card-header">
        <div>
          <div class="entity-secondary">${renderPatient(entry)}</div>
          <div class="entity-primary">${money(entry.total, entry.currency)}</div>
        </div>

        ${
          has("status")
            ? `<span class="entity-status ${status}">
                 ${status.toUpperCase()}
               </span>`
            : ""
        }
      </div>

      <!-- CORE -->
      <div class="entity-card-body">

        ${row("Invoice #", entry.invoice_number)}

        ${row("Total", money(entry.total, entry.currency))}

        <!-- 🔥 FIXED -->
        ${row("Insurance", money(entry.insurance_amount, entry.currency))}

        ${row("Patient Portion", money(patientPortion, entry.currency))}

        ${row("Paid", money(entry.total_paid, entry.currency))}

        ${row("Balance", money(entry.balance, entry.currency))}

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

      <!-- ITEMS -->
      <details class="entity-section">
        <summary><strong>Items</strong></summary>
        <div class="entity-card-body">
          ${
            entry.items?.length
              ? `
            <ul class="mb-0 ps-3">
              ${entry.items
                .map(
                  (i) => `
                <li>
                  <strong>${i.description}</strong><br/>
                  <small>
                    Qty: ${i.quantity} |
                    Total: ${money(i.total_price, entry.currency)} |
                    <span style="color:#0d6efd;">Ins: ${money(i.insurance_amount, entry.currency)}</span> |
                    <span style="color:#dc3545;">Pt: ${money(i.patient_amount, entry.currency)}</span>
                  </small>
                </li>`
                )
                .join("")}
            </ul>`
              : "—"
          }
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