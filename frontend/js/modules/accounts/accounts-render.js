// 📦 accounts-render.js – Entity Card + Table (LIGHT MASTER)

import { FIELD_LABELS_ACCOUNT } from "./accounts-constants.js";
import { formatDate, formatDateTime, initTooltips } from "../../utils/ui-utils.js";
import { enableColumnResize } from "../../utils/table-resize.js";
import { enableColumnDrag } from "../../utils/table-column-drag.js";
import { exportData } from "../../utils/export-utils.js";
/* ============================================================
   🔃 SORTABLE FIELDS
============================================================ */
const SORTABLE_FIELDS = new Set([
  "name",
  "type",
  "currency",
  "balance",
  "is_active",
  "created_at",
]);

let sortBy = localStorage.getItem("accountSortBy") || "";
let sortDir = localStorage.getItem("accountSortDir") || "asc";

function toggleSort(field) {
  if (sortBy === field) sortDir = sortDir === "asc" ? "desc" : "asc";
  else {
    sortBy = field;
    sortDir = "asc";
  }

  localStorage.setItem("accountSortBy", sortBy);
  localStorage.setItem("accountSortDir", sortDir);

  window.setAccountSort?.(sortBy, sortDir);
  window.loadAccountPage?.(1);
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
      FIELD_LABELS_ACCOUNT[field] || field.replace(/_/g, " ");

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

  // column sizing
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
    onReorder: () => window.loadAccountPage?.(1),
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

/* ============================================================
   🧩 VALUE RENDERER (FULL + CORRECT AUDIT MAPPING)
============================================================ */
function renderValue(entry, field) {
  switch (field) {

    case "account_number":
      return safe(entry.account_number);

    case "name":
      return safe(entry.name);

    case "type":
      return safe(entry.type);

    case "currency":
      return safe(entry.currency);

    case "balance":
      return entry.balance != null
        ? Number(entry.balance).toFixed(2)
        : "—";

    case "is_active":
      return entry.is_active
        ? `<span class="badge bg-success">ACTIVE</span>`
        : `<span class="badge bg-secondary">INACTIVE</span>`;

    case "organization":
      return entry.organization?.name || "—";

    case "facility":
      return entry.facility?.name || "—";

    /* ================= AUDIT (FIXED) ================= */

    case "createdBy":
      return renderUserName(entry.createdBy);

    case "updatedBy":
      return renderUserName(entry.updatedBy);

    case "deletedBy":
      return renderUserName(entry.deletedBy);

    case "created_at":
      return entry.createdAt
        ? formatDate(entry.createdAt)
        : "—";

    case "updated_at":
      return entry.updatedAt
        ? formatDate(entry.updatedAt)
        : "—";

    case "deleted_at":
      return entry.deletedAt
        ? formatDate(entry.deletedAt)
        : "—";

    default:
      return safe(entry[field]);
  }
}

/* ============================================================
   🗂️ CARD RENDERER (FULL + ICON ACTIONS – DEPOSIT STYLE)
============================================================ */
export function renderCard(entry, visibleFields, user) {
  const has = (f) => visibleFields.includes(f);

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
    <div class="entity-card account-card">

      <!-- HEADER -->
      <div class="entity-card-header">
        <div>
          <div class="entity-primary">${safe(entry.name)}</div>
          <div class="entity-secondary">${safe(entry.account_number)}</div>
        </div>
        ${
          has("is_active")
            ? entry.is_active
              ? `<span class="entity-status active">ACTIVE</span>`
              : `<span class="entity-status inactive">INACTIVE</span>`
            : ""
        }
      </div>

      <!-- BODY -->
      <div class="entity-card-body">
        ${row("Account Number", entry.account_number)}
        ${row("Currency", entry.currency)}
        ${row("Balance", entry.balance != null ? Number(entry.balance).toFixed(2) : "—")}
        ${row("Type", entry.type)}
      </div>

      <!-- DETAILS -->
      <details class="entity-section">
        <summary><strong>Details</strong></summary>
        <div class="entity-card-body">
          ${row("Organization", entry.organization?.name)}
          ${row("Facility", entry.facility?.name)}
        </div>
      </details>

      <!-- AUDIT -->
      <details class="entity-section">
        <summary><strong>Audit Info</strong></summary>
        <div class="entity-card-body">

          ${row("Created By", renderUserName(entry.createdBy))}
          ${row("Created At", entry.createdAt ? formatDateTime(entry.createdAt) : "—")}

          ${row("Updated By", renderUserName(entry.updatedBy))}
          ${row("Updated At", entry.updatedAt ? formatDateTime(entry.updatedAt) : "—")}

          ${row("Deleted By", renderUserName(entry.deletedBy))}
          ${row("Deleted At", entry.deletedAt ? formatDateTime(entry.deletedAt) : "—")}

        </div>
      </details>

      <!-- ACTIONS (ICON ONLY – SAME STYLE AS DEPOSIT) -->
      ${
        has("actions")
          ? `<div class="entity-card-footer">
               <button class="btn btn-sm btn-outline-primary view-btn" data-id="${entry.id}" title="View">
                 <i class="ri-eye-line"></i>
               </button>
               <button class="btn btn-sm btn-outline-warning edit-btn" data-id="${entry.id}" title="Edit">
                 <i class="ri-pencil-line"></i>
               </button>
               <button class="btn btn-sm btn-outline-danger delete-btn" data-id="${entry.id}" title="Delete">
                 <i class="ri-delete-bin-line"></i>
               </button>
             </div>`
          : ""
      }

    </div>
  `;
}

/* ============================================================
   📋 LIST RENDERER (TABLE ICON ACTIONS – DEPOSIT STYLE)
============================================================ */
export function renderList({ entries, visibleFields, viewMode, user }) {
  const tableBody = document.getElementById("accountTableBody");
  const cardContainer = document.getElementById("accountList");
  const tableContainer = document.querySelector(".table-container");

  if (!tableBody || !cardContainer || !tableContainer) return;

  tableBody.innerHTML = "";
  cardContainer.innerHTML = "";

  if (viewMode === "table") {
    tableContainer.classList.add("active");
    cardContainer.classList.remove("active");

    renderDynamicTableHead(visibleFields);

    if (!entries.length) {
      tableBody.innerHTML = `
        <tr>
          <td colspan="${visibleFields.length}" class="text-center text-muted">
            No accounts found.
          </td>
        </tr>`;
      return;
    }

    entries.forEach((e) => {
      const tr = document.createElement("tr");

      tr.innerHTML = visibleFields
        .map((f) => {

          if (f === "actions") {
            return `
              <td class="actions-cell">
                <button class="btn btn-sm btn-outline-primary view-btn" data-id="${e.id}" title="View">
                  <i class="ri-eye-line"></i>
                </button>
                <button class="btn btn-sm btn-outline-warning edit-btn" data-id="${e.id}" title="Edit">
                  <i class="ri-pencil-line"></i>
                </button>
                <button class="btn btn-sm btn-outline-danger delete-btn" data-id="${e.id}" title="Delete">
                  <i class="ri-delete-bin-line"></i>
                </button>
              </td>`;
          }

          if (f === "created_at") {
            return `<td>${e.createdAt ? formatDate(e.createdAt) : "—"}</td>`;
          }

          if (f === "updated_at") {
            return `<td>${e.updatedAt ? formatDate(e.updatedAt) : "—"}</td>`;
          }

          if (f === "deleted_at") {
            return `<td>${e.deletedAt ? formatDate(e.deletedAt) : "—"}</td>`;
          }

          if (f === "createdBy") {
            return `<td>${renderUserName(e.createdBy)}</td>`;
          }

          if (f === "updatedBy") {
            return `<td>${renderUserName(e.updatedBy)}</td>`;
          }

          if (f === "deletedBy") {
            return `<td>${renderUserName(e.deletedBy)}</td>`;
          }

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
      : `<p class="text-center text-muted">No accounts found.</p>`;

    initTooltips(cardContainer);
  }
  setupExportHandlers(entries);
}
/* ============================================================
   📤 EXPORT (FINAL – ALWAYS USE LATEST DATA)
============================================================ */
function setupExportHandlers(entries) {
  const title = "Accounts Report";

  const csvBtn = document.getElementById("exportCSVBtn");
  const excelBtn = document.getElementById("exportExcelBtn");
  const pdfBtn = document.getElementById("exportPDFBtn");

  if (csvBtn) {
    csvBtn.onclick = () =>
      exportData({ type: "csv", data: entries, title });
  }

  if (excelBtn) {
    excelBtn.onclick = () =>
      exportData({ type: "xlsx", data: entries, title });
  }

  if (pdfBtn) {
    pdfBtn.onclick = () =>
      exportData({
        type: "pdf",
        title,
        selector: ".table-container.active, #accountList.active",
        orientation: "landscape",
      });
  }
}