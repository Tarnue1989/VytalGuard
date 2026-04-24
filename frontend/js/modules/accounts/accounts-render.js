// 📦 accounts-render.js – Entity Card + Table (LIGHT MASTER)

import { FIELD_LABELS_ACCOUNT } from "./accounts-constants.js";
import { formatDate, formatDateTime, initTooltips } from "../../utils/ui-utils.js";
import { enableColumnResize } from "../../utils/table-resize.js";
import { enableColumnDrag } from "../../utils/table-column-drag.js";
import { exportData } from "../../utils/export-utils.js";

import { exportExcelReport } from "../../utils/exportExcelReport.js";
import { exportCsvReport } from "../../utils/exportCsvReport.js";
import { printReport } from "../../utils/printBuilder.js";
import { authFetch } from "../../authSession.js";
import { formatFilters } from "../../utils/filterFormatter.js";

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
      return entry.created_at
        ? formatDateTime(entry.created_at)
        : "—";

    case "updated_at":
      return entry.updated_at
        ? formatDateTime(entry.updated_at)
        : "—";

    case "deleted_at":
      return entry.deleted_at
        ? formatDateTime(entry.deleted_at)
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
          ${row("Created At", entry.created_at ? formatDateTime(entry.created_at) : "—")}

          ${row("Updated By", renderUserName(entry.updatedBy))}
          ${row("Updated At", entry.updated_at ? formatDateTime(entry.updated_at) : "—")}

          ${row("Deleted By", renderUserName(entry.deletedBy))}
          ${row("Deleted At", entry.deleted_at ? formatDateTime(entry.deleted_at) : "—")}

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
          if (f === "created_at" || f === "createdAt") {
            const val = e.created_at || e.createdAt;
            return `<td>${val ? formatDateTime(val) : "—"}</td>`;
          }

          if (f === "updated_at" || f === "updatedAt") {
            const val = e.updated_at || e.updatedAt;
            return `<td>${val ? formatDateTime(val) : "—"}</td>`;
          }

          if (f === "deleted_at" || f === "deletedAt") {
            const val = e.deleted_at || e.deletedAt;
            return `<td>${val ? formatDateTime(val) : "—"}</td>`;
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
  setupExportHandlers(entries, visibleFields);
}
/* ============================================================
   📤 EXPORT (MASTER – ACCOUNTS FULL + PRETTY DATE)
============================================================ */
function getFiltersFromDOM() {
  const val = (id) => document.getElementById(id)?.value;

  return {
    search: val("globalSearch")?.trim(),
    type: val("filterType"),
    is_active: val("filterStatus"),
  };
}

function setupExportHandlers(entries, visibleFields) {
  const title = "Accounts Report";

  const pdfBtn = document.getElementById("exportPDFBtn");
  const csvBtn = document.getElementById("exportCSVBtn");
  const excelBtn = document.getElementById("exportExcelBtn");

  if (!pdfBtn || !csvBtn || !excelBtn) return;

  pdfBtn.replaceWith(pdfBtn.cloneNode(true));
  csvBtn.replaceWith(csvBtn.cloneNode(true));
  excelBtn.replaceWith(excelBtn.cloneNode(true));

  const newPdfBtn = document.getElementById("exportPDFBtn");
  const newCsvBtn = document.getElementById("exportCSVBtn");
  const newExcelBtn = document.getElementById("exportExcelBtn");

  /* ============================================================
     🔁 DATE FORMAT (MATCH DEPARTMENT)
  ============================================================ */
  const formatDate = (d) =>
    d
      ? new Date(d).toLocaleDateString("en-US", {
          year: "numeric",
          month: "long",
          day: "numeric",
        })
      : "";

  /* ============================================================
     🔁 MAP ROW
  ============================================================ */
  const mapRow = (e, fields) => {
    const row = {};

    fields.forEach((f) => {
      switch (f) {
        case "organization":
          row[f] = e.organization?.name || "";
          break;

        case "facility":
          row[f] = e.facility?.name || "";
          break;

        case "balance":
          row[f] = Number(e.balance || 0).toFixed(2);
          break;

        case "is_active":
          row[f] = e.is_active ? "ACTIVE" : "INACTIVE";
          break;

        case "createdBy":
          row[f] =
            `${e.createdBy?.first_name || ""} ${e.createdBy?.last_name || ""}`.trim();
          break;

        case "updatedBy":
          row[f] =
            `${e.updatedBy?.first_name || ""} ${e.updatedBy?.last_name || ""}`.trim();
          break;

        case "created_at":
        case "updated_at":
          row[f] = formatDate(e[f]);
          break;

        default:
          row[f] =
            typeof e[f] === "object"
              ? ""
              : String(e[f] ?? "");
      }
    });

    return row;
  };

  /* ============================================================
     ✅ CSV
  ============================================================ */
  newCsvBtn.addEventListener("click", () => {
    exportCsvReport({
      title,
      data: entries,
      visibleFields,
      fieldLabels: FIELD_LABELS_ACCOUNT,
      mapRow,
    });
  });

  /* ============================================================
     ✅ EXCEL
  ============================================================ */
  newExcelBtn.addEventListener("click", () => {
    exportExcelReport({
      endpoint: "/api/accounts",
      title,
      filters: getFiltersFromDOM(),
      visibleFields,
      fieldLabels: FIELD_LABELS_ACCOUNT,
      mapRow,

      computeTotals: (records) => ({
        "Total Balance": records.reduce(
          (s, e) => s + Number(e.balance || 0),
          0
        ),
      }),
    });
  });

  /* ============================================================
     ✅ PDF
  ============================================================ */
  newPdfBtn.addEventListener("click", async () => {
    try {
      const filters = getFiltersFromDOM();

      const params = new URLSearchParams();
      params.set("limit", 10000);
      params.set("page", 1);

      Object.entries(filters).forEach(([k, v]) => {
        if (!v || String(v).trim() === "") return;
        params.set(k, v);
      });

      const res = await authFetch(`/api/accounts?${params.toString()}`);
      const json = await res.json();
      const allEntries = json?.data?.records || [];

      const cleanFields = visibleFields.filter(
        (f) =>
          f !== "actions" &&
          !["deletedBy", "deleted_at"].includes(f)
      );

      printReport({
        title,

        columns: cleanFields.map((f) => ({
          key: f,
          label: FIELD_LABELS_ACCOUNT[f] || f,
        })),

        rows: allEntries.map((e) => mapRow(e, cleanFields)),

        totals: [
          {
            label: "Total Balance",
            value: allEntries
              .reduce((s, e) => s + Number(e.balance || 0), 0)
              .toFixed(2),
            final: true,
          },
        ],

        context: {
          filters: formatFilters(filters, { sample: allEntries[0] }),
          printedAt: new Date().toLocaleString(),
        },
      });

    } catch (err) {
      console.error(err);
      alert("❌ Failed to export report");
    }
  });
}