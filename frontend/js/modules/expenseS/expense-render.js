// 📦 expense-render.js – Entity Card System (EXPENSE | ENTERPRISE FINAL)
// ============================================================================
// 🔹 FULL MASTER PARITY WITH deposit-render.js
// 🔹 Table + Card (RICH)
// 🔹 Expense-safe (no deposit/patient logic)
// 🔹 Controller-aligned
// ============================================================================

import { FIELD_LABELS_EXPENSE } from "./expense-constants.js";
import { getCurrencySymbol } from "../../utils/currency-utils.js";
import { formatDateTime, formatDate, initTooltips } from "../../utils/ui-utils.js";
import { buildActionButtons } from "../../utils/status-action-matrix.js";
import { exportData } from "../../utils/export-utils.js";
import { enableColumnResize } from "../../utils/table-resize.js";
import { enableColumnDrag } from "../../utils/table-column-drag.js";

/* ============================================================ */
const SORTABLE_FIELDS = new Set([
  "organization_id",
  "facility_id",
  "account_id",
  "amount",
  "currency",
  "category",
  "payment_method",
  "status",
  "date",
  "created_at",
  "updated_at",
]);

let sortBy = localStorage.getItem("expenseSortBy") || "";
let sortDir = localStorage.getItem("expenseSortDir") || "asc";

function toggleSort(field) {
  if (sortBy === field) sortDir = sortDir === "asc" ? "desc" : "asc";
  else {
    sortBy = field;
    sortDir = "asc";
  }
  localStorage.setItem("expenseSortBy", sortBy);
  localStorage.setItem("expenseSortDir", sortDir);
  window.setExpenseSort?.(sortBy, sortDir);
  window.loadExpensePage?.(1);
}

/* ============================================================ */
function getExpenseActionButtons(entry, user) {
  return buildActionButtons({
    module: "expense",
    status: (entry.status || "").toLowerCase(),
    entry,
    entryId: entry.id,
    user,
    permissionPrefix: "expenses",
  });
}

/* ============================================================ */
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
      FIELD_LABELS_EXPENSE[field] || field.replace(/_/g, " ");

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
    onReorder: () => window.loadExpensePage?.(1),
  });
}

/* ============================================================ */
const safe = (v) => (v !== null && v !== undefined && v !== "" ? v : "—");

function renderUserName(u) {
  if (!u) return "—";
  return [u.first_name, u.middle_name, u.last_name]
    .filter(Boolean)
    .join(" ") || u.full_name || "—";
}

/* ============================================================ */
function renderValue(entry, field) {
  switch (field) {
    case "expense_number":
      return safe(entry.expense_number);

    case "status": {
      const s = (entry.status || "").toLowerCase();
      const cls =
        s === "draft"
          ? "bg-secondary"
          : s === "pending"
          ? "bg-warning text-dark"
          : s === "approved"
          ? "bg-primary"
          : s === "rejected"
            ? "bg-danger"
          : s === "posted"
          ? "bg-success"
          : s === "cancelled"
          ? "bg-secondary text-light"
          : s === "voided"
          ? "bg-danger"
          : s === "reversed"
          ? "bg-info text-dark"
          : "bg-dark text-light";
      return `<span class="badge ${cls}">${s.toUpperCase()}</span>`;
    }

    case "organization":
    case "organization_id":
      return entry.organization?.name || "—";

    case "facility":
    case "facility_id":
      return entry.facility?.name || "—";

    case "account":
    case "account_id":
      return entry.account?.name || "—";

    case "currency":
      return safe(entry.currency);

    case "amount":
      return entry.amount != null
        ? `${getCurrencySymbol(entry.currency)} ${Number(entry.amount).toFixed(2)}`
        : "—";

    case "category":
    case "payment_method":
    case "description":
      return safe(entry[field]);

    case "date":
      return entry.date ? formatDate(entry.date) : "—";

    /* 🔥 FULL AUDIT SUPPORT */
    case "approvedBy":
      return renderUserName(entry.approvedBy);
    case "postedBy":
      return renderUserName(entry.postedBy);
    case "reversedBy":
      return renderUserName(entry.reversedBy);
    case "voidedBy":
      return renderUserName(entry.voidedBy);

    case "createdBy":
      return renderUserName(entry.createdBy);
    case "updatedBy":
      return renderUserName(entry.updatedBy);
    case "deletedBy":
      return renderUserName(entry.deletedBy);

    case "approved_at":
    case "posted_at":
    case "reversed_at":
    case "voided_at":
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

/* ============================================================ */
export function renderCard(entry, visibleFields, user) {
  const has = (f) => visibleFields.includes(f);
  const status = (entry.status || "").toLowerCase();

  const money = (v) =>
    `${getCurrencySymbol(entry.currency)} ${Number(v || 0).toFixed(2)}`;

  const row = (label, value) => {
    if (!value) return "";
    return `
      <div class="entity-field">
        <span class="entity-label">${label}</span>
        <span class="entity-value">${value}</span>
      </div>
    `;
  };

  return `
    <div class="entity-card expense-card">

      <div class="entity-card-header">
        <div>
          <div class="entity-secondary">${entry.account?.name || "—"}</div>
          <div class="entity-primary">${money(entry.amount)}</div>
        </div>
        ${
          has("status")
            ? `<span class="entity-status ${status}">
                 ${status.toUpperCase()}
               </span>`
            : ""
        }
      </div>

      <div class="entity-card-body">
        ${row("Expense #", entry.expense_number)}
        ${row("Amount", money(entry.amount))}
        ${row("Category", entry.category)}
        ${row("Payment", entry.payment_method)}
        ${row("Date", entry.date ? formatDate(entry.date) : "—")}
      </div>

      <details class="entity-section">
        <summary><strong>Details</strong></summary>
        <div class="entity-card-body">
          ${row("Organization", entry.organization?.name)}
          ${row("Facility", entry.facility?.name)}
          ${row("Description", entry.description)}
        </div>
      </details>

      <details class="entity-section">
        <summary><strong>Lifecycle</strong></summary>
        <div class="entity-card-body">
          ${row("Approved By", renderUserName(entry.approvedBy))}
          ${row("Approved At", entry.approved_at ? formatDateTime(entry.approved_at) : "—")}
          ${row("Posted By", renderUserName(entry.postedBy))}
          ${row("Posted At", entry.posted_at ? formatDateTime(entry.posted_at) : "—")}
          ${row("Reversed By", renderUserName(entry.reversedBy))}
          ${row("Reversed At", entry.reversed_at ? formatDateTime(entry.reversed_at) : "—")}
          ${row("Voided By", renderUserName(entry.voidedBy))}
          ${row("Voided At", entry.voided_at ? formatDateTime(entry.voided_at) : "—")}
        </div>
      </details>

      <details class="entity-section">
        <summary><strong>Audit</strong></summary>
        <div class="entity-card-body">
          ${row("Created By", renderUserName(entry.createdBy))}
          ${row("Created At", entry.createdAt ? formatDateTime(entry.createdAt) : "—")}
          ${row("Updated By", renderUserName(entry.updatedBy))}
          ${row("Updated At", entry.updatedAt ? formatDateTime(entry.updatedAt) : "—")}
          ${row("Deleted By", renderUserName(entry.deletedBy))}
          ${row("Deleted At", entry.deletedAt ? formatDateTime(entry.deletedAt) : "—")}
        </div>
      </details>

      ${
        has("actions")
          ? `<div class="entity-card-footer export-ignore">
               ${getExpenseActionButtons(entry, user)}
             </div>`
          : ""
      }

    </div>
  `;
}



/* ============================================================ */
export function renderList({ entries, visibleFields, viewMode, user }) {
  const tableBody = document.getElementById("expenseTableBody");
  const cardContainer = document.getElementById("expenseList");
  const tableContainer = document.querySelector(".table-container");
  if (!tableBody || !cardContainer || !tableContainer) return;

  tableBody.innerHTML = "";
  cardContainer.innerHTML = "";

  if (viewMode === "table") {
    tableContainer.classList.add("active");
    cardContainer.classList.remove("active");
    renderDynamicTableHead(visibleFields);

    if (!entries.length) {
      tableBody.innerHTML = `<tr><td colspan="${visibleFields.length}" class="text-center text-muted">No expenses found.</td></tr>`;
      return;
    }

    entries.forEach((e) => {
      const tr = document.createElement("tr");
      tr.innerHTML = visibleFields
        .map((f) =>
          f === "actions"
            ? `<td class="actions-cell export-ignore">${getExpenseActionButtons(
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
      : `<p class="text-center text-muted">No expenses found.</p>`;
    initTooltips(cardContainer);
  }

  setupExportHandlers(entries, visibleFields);
}

/* ============================================================ */
let exportHandlersBound = false;
function setupExportHandlers(entries) {
  if (exportHandlersBound) return;
  exportHandlersBound = true;

  const title = "Expenses Report";
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
      selector: ".table-container.active, #expenseList.active",
      orientation: "landscape",
    })
  );
}