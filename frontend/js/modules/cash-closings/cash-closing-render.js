// 📦 cash-closing-render.js – Entity Card System (CASH CLOSING | ENTERPRISE FINAL)

import { FIELD_LABELS_CASH_CLOSING } from "./cash-closing-constants.js";
import { getCurrencySymbol } from "../../utils/currency-utils.js";
import { formatDateTime, formatDate, initTooltips } from "../../utils/ui-utils.js";
import { buildActionButtons } from "../../utils/status-action-matrix.js";
import { exportData } from "../../utils/export-utils.js";
import { enableColumnResize } from "../../utils/table-resize.js";
import { enableColumnDrag } from "../../utils/table-column-drag.js";


import { exportExcelReport } from "../../utils/exportExcelReport.js";
import { exportCsvReport } from "../../utils/exportCsvReport.js";
import { printReport } from "../../utils/printBuilder.js";
import { authFetch } from "../../authSession.js";
import { formatFilters } from "../../utils/filterFormatter.js";

/* ============================================================ */
const SORTABLE_FIELDS = new Set([
  "date",
  "opening_balance",
  "closing_balance",
  "total_in",
  "total_out",
  "created_at",
  "updated_at",
]);

let sortBy = localStorage.getItem("cashClosingSortBy") || "date";
let sortDir = localStorage.getItem("cashClosingSortDir") || "desc";

function toggleSort(field) {
  if (sortBy === field) sortDir = sortDir === "asc" ? "desc" : "asc";
  else {
    sortBy = field;
    sortDir = "asc";
  }

  localStorage.setItem("cashClosingSortBy", sortBy);
  localStorage.setItem("cashClosingSortDir", sortDir);

  window.setCashClosingSort?.(sortBy, sortDir);
  window.loadCashClosingPage?.(1);
}

/* ============================================================ */
function getActionButtons(entry, user) {
  return buildActionButtons({
    module: "cash_closing",
    status: entry.is_locked ? "locked" : "open",
    entry,
    entryId: entry.id,
    user,
    permissionPrefix: "cash_closings",
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
      FIELD_LABELS_CASH_CLOSING[field] || field.replace(/_/g, " ");

    if (field === "actions") {
      th.textContent = "Actions";
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
    onReorder: () => window.loadCashClosingPage?.(1),
  });
}

/* ============================================================ */
const safe = (v) =>
  v !== null && v !== undefined && v !== "" ? v : "—";

function renderUserName(u) {
  if (!u) return "—";
  return [u.first_name, u.last_name].filter(Boolean).join(" ");
}

/* ============================================================ */
function renderValue(entry, field) {
  const currency = entry.currency || "USD";

  switch (field) {
    case "date":
      return entry.date ? formatDate(entry.date) : "—";

    case "organization":
      return entry.organization?.name || "—";

    case "facility":
      return entry.facility?.name || "—";

    case "account":
      return entry.account?.name || "—";

    case "opening_balance":
    case "closing_balance":
    case "total_in":
    case "total_out":
      return `${getCurrencySymbol(currency)} ${Number(entry[field] || 0).toFixed(2)}`;

    case "is_locked":
      return `<span class="entity-status ${entry.is_locked ? "locked" : "open"}">
        ${entry.is_locked ? "LOCKED" : "OPEN"}
      </span>`;

    case "closedBy":
      return renderUserName(entry.closedBy);

    case "closed_at":
      return entry.closed_at ? formatDateTime(entry.closed_at) : "—";

    case "created_at":
    case "updated_at":
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
  const currency = entry.currency || "USD";

  const money = (v) =>
    `${getCurrencySymbol(currency)} ${Number(v || 0).toFixed(2)}`;

  const row = (label, value) =>
    value
      ? `<div class="entity-field">
           <span class="entity-label">${label}</span>
           <span class="entity-value">${value}</span>
         </div>`
      : "";

  return `
    <div class="entity-card cash-closing-card"> <!-- ✅ FIX HERE -->

      <div class="entity-card-header">
        <div>
          <div class="entity-secondary">${entry.account?.name || "—"}</div>
          <div class="entity-primary">${formatDate(entry.date)}</div>
        </div>
        <span class="entity-status ${entry.is_locked ? "locked" : "open"}">
          ${entry.is_locked ? "LOCKED" : "OPEN"}
        </span>
      </div>

      <div class="entity-card-body">
        ${row("Opening", money(entry.opening_balance))}
        ${row("Closing", money(entry.closing_balance))}
        ${row("Total In", money(entry.total_in))}
        ${row("Total Out", money(entry.total_out))}
      </div>

      <details class="entity-section">
        <summary><strong>Details</strong></summary>
        <div class="entity-card-body">
          ${row("Organization", entry.organization?.name)}
          ${row("Facility", entry.facility?.name)}
          ${row("Closed By", renderUserName(entry.closedBy))}
          ${row("Closed At", formatDateTime(entry.closed_at))}
        </div>
      </details>

      ${
        visibleFields.includes("actions")
          ? `<div class="entity-card-footer">
               ${getActionButtons(entry, user)}
             </div>`
          : ""
      }

    </div>
  `;
}

/* ============================================================ */
export function renderList({ entries, visibleFields, viewMode, user }) {
  const tableBody = document.getElementById("cashClosingTableBody");
  const cardContainer = document.getElementById("cashClosingList");
  const tableContainer = document.querySelector(".table-container");

  if (!tableBody || !cardContainer || !tableContainer) return;

  tableBody.innerHTML = "";
  cardContainer.innerHTML = "";

  if (viewMode === "table") {
    tableContainer.classList.add("active");
    cardContainer.classList.remove("active");

    renderDynamicTableHead(visibleFields);

    if (!entries.length) {
      tableBody.innerHTML = `<tr><td colspan="${visibleFields.length}" class="text-center">No records</td></tr>`;
      return;
    }

    entries.forEach((e) => {
      const tr = document.createElement("tr");
      tr.innerHTML = visibleFields
        .map((f) =>
          f === "actions"
            ? `<td>${getActionButtons(e, user)}</td>`
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
      : `<p class="text-center">No records</p>`;

    initTooltips(cardContainer);
  }

  setupExportHandlers(entries, visibleFields);
}

/* ============================================================
   📤 EXPORT (MASTER – CASH CLOSING FULL)
============================================================ */
function getFiltersFromDOM() {
  const val = (id) => document.getElementById(id)?.value;

  return {
    search: val("globalSearch")?.trim(),
    account_id: val("filterAccountSelect"),
    organization_id: val("filterOrganizationSelect"),
    facility_id: val("filterFacilitySelect"),
    dateRange: val("dateRange"),
  };
}

function setupExportHandlers(entries, visibleFields) {
  const title = "Cash Closing Report";

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

  /* ================= CSV ================= */
  newCsvBtn.addEventListener("click", () => {
    exportCsvReport({
      title,
      data: entries,
      visibleFields,
      fieldLabels: FIELD_LABELS_CASH_CLOSING,
      mapRow: (e, fields) => {
        const row = {};
        fields.forEach((f) => {
          switch (f) {
            case "account":
              row[f] = e.account?.name || "";
              break;

            case "organization":
              row[f] = e.organization?.name || "";
              break;

            case "facility":
              row[f] = e.facility?.name || "";
              break;

            case "opening_balance":
            case "closing_balance":
            case "total_in":
            case "total_out":
              row[f] = Number(e[f] || 0).toFixed(2);
              break;

            case "is_locked":
              row[f] = e.is_locked ? "LOCKED" : "OPEN";
              break;

            case "closedBy":
              row[f] =
                `${e.closedBy?.first_name || ""} ${e.closedBy?.last_name || ""}`.trim();
              break;

            case "closed_at":
              row[f] = e.closed_at
                ? new Date(e.closed_at).toLocaleString()
                : "";
              break;

            case "created_at":
              row[f] = e.created_at
                ? new Date(e.created_at).toLocaleString()
                : "";
              break;

            default:
              row[f] =
                typeof e[f] === "object"
                  ? ""
                  : String(e[f] ?? "");
          }
        });
        return row;
      },
    });
  });

  /* ================= EXCEL ================= */
  newExcelBtn.addEventListener("click", () => {
    exportExcelReport({
      endpoint: "/api/cash-closings",
      title,
      filters: getFiltersFromDOM(),
      visibleFields,
      fieldLabels: FIELD_LABELS_CASH_CLOSING,

      mapRow: (e, fields) => {
        const row = {};
        fields.forEach((f) => {
          switch (f) {
            case "account":
              row[f] = e.account?.name || "";
              break;

            case "organization":
              row[f] = e.organization?.name || "";
              break;

            case "facility":
              row[f] = e.facility?.name || "";
              break;

            case "opening_balance":
            case "closing_balance":
            case "total_in":
            case "total_out":
              row[f] = Number(e[f] || 0).toFixed(2);
              break;

            case "is_locked":
              row[f] = e.is_locked ? "LOCKED" : "OPEN";
              break;

            default:
              row[f] =
                typeof e[f] === "object"
                  ? ""
                  : String(e[f] ?? "");
          }
        });
        return row;
      },

      computeTotals: (records) => ({
        "Total In": records.reduce((s, e) => s + Number(e.total_in || 0), 0),
        "Total Out": records.reduce((s, e) => s + Number(e.total_out || 0), 0),
      }),
    });
  });

  /* ================= PDF ================= */
  newPdfBtn.addEventListener("click", async () => {
    try {
      const filters = getFiltersFromDOM();

      const params = new URLSearchParams();
      params.set("limit", 10000);
      params.set("page", 1);

      Object.entries(filters).forEach(([k, v]) => {
        if (!v || String(v).trim() === "") return;

        if (k === "dateRange") {
          const [from, to] = v.split(" - ");
          if (from) params.set("date_from", from.trim());
          if (to) params.set("date_to", to.trim());
        } else {
          params.set(k, v);
        }
      });

      const res = await authFetch(`/api/cash-closings?${params.toString()}`);
      const json = await res.json();
      const allEntries = json?.data?.records || [];

      printReport({
        title,

        columns: visibleFields.map((f) => ({
          key: f,
          label: FIELD_LABELS_CASH_CLOSING[f] || f,
        })),

        rows: allEntries.map((e) => {
          const row = {};

          visibleFields.forEach((f) => {
            switch (f) {
              case "account":
                row[f] = e.account?.name || "";
                break;

              case "organization":
                row[f] = e.organization?.name || "";
                break;

              case "facility":
                row[f] = e.facility?.name || "";
                break;

              case "opening_balance":
              case "closing_balance":
              case "total_in":
              case "total_out":
                row[f] = Number(e[f] || 0).toFixed(2);
                break;

              case "is_locked":
                row[f] = e.is_locked ? "LOCKED" : "OPEN";
                break;

              case "closedBy":
                row[f] =
                  `${e.closedBy?.first_name || ""} ${e.closedBy?.last_name || ""}`.trim();
                break;

              case "closed_at":
                row[f] = e.closed_at
                  ? new Date(e.closed_at).toLocaleString()
                  : "";
                break;

              case "created_at":
                row[f] = e.created_at
                  ? new Date(e.created_at).toLocaleString()
                  : "";
                break;

              default:
                row[f] =
                  typeof e[f] === "object"
                    ? ""
                    : String(e[f] ?? "");
            }
          });

          return row;
        }),

        totals: [
          {
            label: "Total In",
            value: allEntries
              .reduce((s, e) => s + Number(e.total_in || 0), 0)
              .toFixed(2),
          },
          {
            label: "Total Out",
            value: allEntries
              .reduce((s, e) => s + Number(e.total_out || 0), 0)
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