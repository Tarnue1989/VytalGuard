// 📦 payroll-render.js – FULLY UPDATED (Controller-Aligned + Payment Fields + Expense Link)

import { FIELD_LABELS_PAYROLL } from "./payroll-constants.js";
import { getCurrencySymbol } from "../../utils/currency-utils.js";
import { formatDateTime, formatDate, initTooltips } from "../../utils/ui-utils.js";
import { buildActionButtons } from "../../utils/status-action-matrix.js";
import { exportData } from "../../utils/export-utils.js";
import { enableColumnResize } from "../../utils/table-resize.js";
import { enableColumnDrag } from "../../utils/table-column-drag.js";
import { initTimelines } from "../../utils/timeline/timeline-init.js";

/* ============================================================ */
const SORTABLE_FIELDS = new Set([
  "organization_id",
  "facility_id",
  "employee_id",
  "net_salary",
  "currency",
  "status",
  "created_at",
  "updated_at",
]);

let sortBy = localStorage.getItem("payrollSortBy") || "";
let sortDir = localStorage.getItem("payrollSortDir") || "asc";

function toggleSort(field) {
  if (sortBy === field) sortDir = sortDir === "asc" ? "desc" : "asc";
  else {
    sortBy = field;
    sortDir = "asc";
  }
  localStorage.setItem("payrollSortBy", sortBy);
  localStorage.setItem("payrollSortDir", sortDir);
  window.setPayrollSort?.(sortBy, sortDir);
  window.loadPayrollPage?.(1);
}

/* ============================================================ */
function getPayrollActionButtons(entry, user) {
  return buildActionButtons({
    module: "payroll",
    status: (entry.status || "").toLowerCase(),
    entry,
    entryId: entry.id,
    user,
    permissionPrefix: "payrolls",
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
      FIELD_LABELS_PAYROLL[field] || field.replace(/_/g, " ");

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
    onReorder: () => window.loadPayrollPage?.(1),
  });
}

/* ============================================================ */
const safe = (v) => (v !== null && v !== undefined && v !== "" ? v : "—");

function renderUserName(u) {
  if (!u) return "—";
  return [u.first_name, u.middle_name, u.last_name]
    .filter(Boolean)
    .join(" ") || "—";
}

function renderEmployee(entry) {
  if (!entry.employee) return "—";
  const e = entry.employee;
  return `${[e.first_name, e.last_name].filter(Boolean).join(" ")}`;
}

/* ============================================================ */
function renderValue(entry, field) {
  switch (field) {
    case "payroll_number":
      return safe(entry.payroll_number);

    case "status": {
      const s = (entry.status || "").toLowerCase();
      const cls =
        s === "draft"
          ? "bg-secondary"
          : s === "approved"
          ? "bg-primary"
          : s === "paid"
          ? "bg-success"
          : s === "voided"
          ? "bg-danger"
          : "bg-warning text-dark";
      return `<span class="badge ${cls}">${s.toUpperCase()}</span>`;
    }

    case "organization":
      return entry.organization?.name || "—";

    case "facility":
      return entry.facility?.name || "—";

    case "employee":
      return renderEmployee(entry);

    case "account":
      return entry.account?.name || entry.account_id || "—";

    case "category":
      return safe(entry.category);

    case "payment_method":
      return safe(entry.payment_method);

    case "expense":
      return entry.expense?.expense_number || "—";

    case "currency":
      return safe(entry.currency);

    case "net_salary":
    case "basic_salary":
    case "allowances":
    case "deductions":
      return entry[field] != null
        ? `${getCurrencySymbol(entry.currency)} ${Number(entry[field]).toFixed(2)}`
        : "—";

    case "createdBy":
      return renderUserName(entry.createdBy);
    case "updatedBy":
      return renderUserName(entry.updatedBy);
    case "approvedBy":
      return renderUserName(entry.approvedBy);
    case "paidBy":
      return renderUserName(entry.paidBy);
    case "voidedBy":
      return renderUserName(entry.voidedBy);

    case "created_at":
    case "updated_at":
    case "approved_at":
    case "paid_at":
    case "voided_at":
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

  const row = (label, value) =>
    value
      ? `<div class="entity-field">
           <span class="entity-label">${label}</span>
           <span class="entity-value">${value}</span>
         </div>`
      : "";

  /* ===================================================== */
  /* 🔥 TIMELINE */
  /* ===================================================== */
  const timeline = `
    <div
      class="card-timeline"
      data-module="payroll"
      data-status="${status}">
    </div>
  `;

  return `
    <div class="entity-card payroll-card">

      <!-- ===================================================== -->
      <!-- 🔹 HEADER -->
      <!-- ===================================================== -->
      <div class="entity-card-header">
        <div>
          <div class="entity-secondary">${renderEmployee(entry)}</div>
          <div class="entity-primary">${money(entry.net_salary)}</div>
        </div>
        ${
          has("status")
            ? `<span class="entity-status ${status}">
                 ${status.toUpperCase()}
               </span>`
            : ""
        }
      </div>

      ${timeline}

      <!-- ===================================================== -->
      <!-- 🔹 QUICK CORE -->
      <!-- ===================================================== -->
      <div class="entity-card-body">
        ${row("Payroll #", entry.payroll_number)}
        ${row("Period", entry.period)}
        ${row("Net Salary", money(entry.net_salary))}
        ${row("Currency", entry.currency)}
      </div>

      <!-- ===================================================== -->
      <!-- 📄 FINANCIAL -->
      <!-- ===================================================== -->
      <details class="entity-section">
        <summary><strong>Financial</strong></summary>
        <div class="entity-card-body">
          ${row("Basic Salary", money(entry.basic_salary))}
          ${row("Allowances", money(entry.allowances))}
          ${row("Deductions", money(entry.deductions))}
        </div>
      </details>

      <!-- ===================================================== -->
      <!-- 💳 PAYMENT -->
      <!-- ===================================================== -->
      <details class="entity-section">
        <summary><strong>Payment</strong></summary>
        <div class="entity-card-body">
          ${row("Account", entry.account?.name)}
          ${row("Category", entry.category)}
          ${row("Method", entry.payment_method)}
          ${row("Expense", entry.expense?.expense_number)}
        </div>
      </details>

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
          ${row("Approved By", renderUserName(entry.approvedBy))}
          ${row("Paid By", renderUserName(entry.paidBy))}
        </div>
      </details>

      <!-- ===================================================== -->
      <!-- ⚙️ ACTIONS -->
      ${
        has("actions")
          ? `<div class="entity-card-footer export-ignore">
               ${getPayrollActionButtons(entry, user)}
             </div>`
          : ""
      }

    </div>
  `;
}

/* ============================================================ */
export function renderList({ entries, visibleFields, viewMode, user }) {
  const tableBody = document.getElementById("payrollTableBody");
  const cardContainer = document.getElementById("payrollList");
  const tableContainer = document.querySelector(".table-container");
  if (!tableBody || !cardContainer || !tableContainer) return;

  tableBody.innerHTML = "";
  cardContainer.innerHTML = "";

  if (viewMode === "table") {
    tableContainer.classList.add("active");
    cardContainer.classList.remove("active");

    renderDynamicTableHead(visibleFields);

    if (!entries.length) {
      tableBody.innerHTML = `<tr>
        <td colspan="${visibleFields.length}" class="text-center text-muted">
          No payrolls found.
        </td>
      </tr>`;
      return;
    }

    entries.forEach((e) => {
      const tr = document.createElement("tr");
      tr.innerHTML = visibleFields
        .map((f) =>
          f === "actions"
            ? `<td class="actions-cell export-ignore">
                 ${getPayrollActionButtons(e, user)}
               </td>`
            : `<td>${renderValue(e, f)}</td>`
        )
        .join("");
      tableBody.appendChild(tr);
    });

    initTooltips(tableBody);

  } else {
    tableContainer.classList.remove("active");
    cardContainer.classList.add("active");

    const fragment = document.createDocumentFragment();

    if (!entries.length) {
      cardContainer.innerHTML = `
        <p class="text-center text-muted">No payrolls found.</p>
      `;
      return;
    }

    entries.forEach((entry) => {
      const wrapper = document.createElement("div");
      wrapper.innerHTML = renderCard(entry, visibleFields, user);

      const card = wrapper.firstElementChild;
      const timelineEl = card.querySelector(".card-timeline");

      if (timelineEl) {
        timelineEl.__entry = entry;
      }

      fragment.appendChild(card);
    });

    cardContainer.appendChild(fragment);

    // 🔥 INIT TIMELINE
    initTimelines(cardContainer);

    initTooltips(cardContainer);
  }

  setupExportHandlers(entries);
}

/* ============================================================ */
let exportHandlersBound = false;
function setupExportHandlers(entries) {
  if (exportHandlersBound) return;
  exportHandlersBound = true;

  const title = "Payroll Report";
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
      selector: ".table-container.active, #payrollList.active",
      orientation: "landscape",
    })
  );
}