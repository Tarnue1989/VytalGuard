// 📁 expenses-render.js

import { FIELD_LABELS_EXPENSE } from "./expenses-constants.js";
import { formatDate } from "../../../utils/ui-utils.js";
import { exportData } from "../../../utils/export-utils.js";

import { exportExcelReport } from "../../utils/exportExcelReport.js";
import { exportCsvReport } from "../../utils/exportCsvReport.js";
import { printReport } from "../../utils/printBuilder.js";
import { authFetch } from "../../authSession.js";
import { formatFilters } from "../../utils/filterFormatter.js";

/* ----------------------------- helpers ----------------------------- */

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

function getExpenseActionButtons(entry, userRole) {
  let role = (userRole || "").trim().toLowerCase();
  if (role.includes("super") && role.includes("admin")) role = "superadmin";
  else if (role.includes("admin")) role = "admin";
  else role = "staff";

  const canDelete = ["admin", "superadmin"].includes(role);

  const id = entry.id;

  let coreBtns = `
    <button class="btn btn-outline-primary btn-sm view-btn"
      data-id="${id}" data-bs-toggle="tooltip" title="View">
      <i class="fas fa-eye"></i>
    </button>
  `;

  let actionBtns = "";

  if (canDelete) {
    actionBtns += `
      <button class="btn btn-outline-danger btn-sm delete-btn"
        data-id="${id}" data-bs-toggle="tooltip" title="Delete">
        <i class="fas fa-trash"></i>
      </button>
    `;
  }

  return `<div class="d-inline-flex gap-1 flex-wrap">${coreBtns}${actionBtns}</div>`;
}

/* ------------------------- table head ------------------------- */

export function renderExpenseTableHead(visibleFields) {
  const thead = document.getElementById("expenseTableHead");
  if (!thead) return;

  thead.innerHTML = "";
  const tr = document.createElement("tr");

  visibleFields.forEach((field) => {
    const th = document.createElement("th");
    th.textContent = FIELD_LABELS_EXPENSE[field] || field;
    if (field === "actions") th.classList.add("actions-cell");
    tr.appendChild(th);
  });

  thead.appendChild(tr);
}

/* ---------------------------- value render ---------------------------- */

function renderValue(entry, field) {
  switch (field) {
    case "organization": return entry.organization?.name || "—";
    case "facility": return entry.facility?.name || "—";
    case "account": return entry.account?.name || "—";

    case "category": return entry.category || "—";
    case "currency": return entry.currency || "—";

    case "amount":
      return entry.amount != null
        ? `$${Number(entry.amount).toFixed(2)}`
        : "—";

    case "description": return entry.description || "—";
    case "date": return entry.date ? formatDate(entry.date) : "—";

    case "created_at": return entry.created_at ? formatDate(entry.created_at) : "—";
    case "updated_at": return entry.updated_at ? formatDate(entry.updated_at) : "—";
    case "deleted_at": return entry.deleted_at ? formatDate(entry.deleted_at) : "—";

    case "createdBy":
      return entry.createdBy
        ? `${entry.createdBy.first_name} ${entry.createdBy.last_name}`
        : "—";

    case "updatedBy":
      return entry.updatedBy
        ? `${entry.updatedBy.first_name} ${entry.updatedBy.last_name}`
        : "—";

    case "deletedBy":
      return entry.deletedBy
        ? `${entry.deletedBy.first_name} ${entry.deletedBy.last_name}`
        : "—";

    default:
      return entry[field] ?? "—";
  }
}

/* ---------------------------- detail modal ---------------------------- */

export function renderExpenseDetail(entry) {
  return `
    <div class="row g-3">
      <div class="col-md-6"><strong>Amount:</strong> ${renderValue(entry, "amount")}</div>
      <div class="col-md-6"><strong>Category:</strong> ${renderValue(entry, "category")}</div>
      <div class="col-md-6"><strong>Account:</strong> ${renderValue(entry, "account")}</div>
      <div class="col-md-6"><strong>Currency:</strong> ${renderValue(entry, "currency")}</div>
      <div class="col-md-6"><strong>Date:</strong> ${renderValue(entry, "date")}</div>
      <div class="col-md-6"><strong>Description:</strong> ${renderValue(entry, "description")}</div>
    </div>
  `;
}

/* ---------------------------- card renderer --------------------------- */

export function renderExpenseCard(entry, visibleFields, userRole) {
  let html = "";

  visibleFields.forEach((field) => {
    if (field === "actions") return;
    const label = FIELD_LABELS_EXPENSE[field] || field;
    const value = renderValue(entry, field);
    html += `<p><strong>${label}:</strong> ${value}</p>`;
  });

  return `
    <div class="record-card card shadow-sm h-100">
      <div class="card-body">${html}</div>
      <div class="card-footer text-end">
        ${getExpenseActionButtons(entry, userRole)}
      </div>
    </div>
  `;
}

/* ----------------------------- list render ---------------------------- */

export function renderExpenseList({ entries, visibleFields, viewMode, userRole }) {
  const tableBody = document.getElementById("expenseTableBody");
  const cardContainer = document.getElementById("expenseList");
  const tableContainer = document.querySelector(".expense-table-container");

  if (!tableBody || !cardContainer || !tableContainer) return;

  tableBody.innerHTML = "";
  cardContainer.innerHTML = "";

  if (viewMode === "table") {
    cardContainer.classList.remove("active");
    tableContainer.classList.add("active");

    renderExpenseTableHead(visibleFields);

    if (!entries.length) {
      tableBody.innerHTML = `<tr><td colspan="${visibleFields.length}">No expenses found.</td></tr>`;
      return;
    }

    entries.forEach((entry) => {
      const row = document.createElement("tr");
      let rowHTML = "";

      visibleFields.forEach((field) => {
        const value =
          field === "actions"
            ? `<div class="table-actions">${getExpenseActionButtons(entry, userRole)}</div>`
            : renderValue(entry, field);

        rowHTML += `<td>${value}</td>`;
      });

      row.innerHTML = rowHTML;
      tableBody.appendChild(row);
    });

    initTooltips(tableBody);

  } else {
    tableContainer.classList.remove("active");
    cardContainer.classList.add("active");

    cardContainer.innerHTML = entries.length
      ? entries.map((e) =>
          renderExpenseCard(e, visibleFields, userRole)
        ).join("")
      : `<p class="text-muted">No expenses found.</p>`;

    initTooltips(cardContainer);
  }

  setupExportHandlers(entries, visibleFields);
}

/* -------------------------- export handlers --------------------------- */

/* ============================================================
   📤 EXPORT (MASTER – EXACT DEPOSIT PATTERN)
============================================================ */
function setupExportHandlers(entries, visibleFields) {
  const title = "Expenses Report";

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

  function getFiltersFromDOM() {
    const val = (id) => document.getElementById(id)?.value;

    return {
      organization_id: val("filterOrganizationSelect"),
      facility_id: val("filterFacilitySelect"),
      account_id: val("filterAccount"),
      category: val("filterCategory"),
      date: val("filterDate"),
      search: val("filterSearch"),
    };
  }

  /* ================= CSV ================= */
  newCsvBtn.addEventListener("click", () => {
    exportCsvReport({
      title,
      data: entries,
      visibleFields,
      fieldLabels: FIELD_LABELS_EXPENSE,

      mapRow: (e, fields) => {
        const row = {};

        fields.forEach((f) => {
          switch (f) {
            case "organization":
              row[f] = e.organization?.name || "";
              break;

            case "facility":
              row[f] = e.facility?.name || "";
              break;

            case "account":
              row[f] = e.account?.name || "";
              break;

            case "amount":
              row[f] =
                e.amount != null
                  ? `$${Number(e.amount).toFixed(2)}`
                  : "";
              break;

            case "date":
              row[f] = e.date
                ? new Date(e.date).toLocaleDateString()
                : "";
              break;

            case "created_at":
            case "updated_at":
              row[f] = e[f]
                ? new Date(e[f]).toLocaleDateString()
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
      endpoint: "/api/expenses",
      title,
      filters: getFiltersFromDOM(),
      visibleFields,
      fieldLabels: FIELD_LABELS_EXPENSE,

      mapRow: (e, fields) => {
        const row = {};

        fields.forEach((f) => {
          switch (f) {
            case "organization":
              row[f] = e.organization?.name || "";
              break;

            case "facility":
              row[f] = e.facility?.name || "";
              break;

            case "account":
              row[f] = e.account?.name || "";
              break;

            case "amount":
              row[f] =
                e.amount != null
                  ? `$${Number(e.amount).toFixed(2)}`
                  : "";
              break;

            case "date":
              row[f] = e.date
                ? new Date(e.date).toLocaleDateString()
                : "";
              break;

            case "created_at":
            case "updated_at":
              row[f] = e[f]
                ? new Date(e[f]).toLocaleDateString()
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

      computeTotals: (records) => ({
        "Total Records": records.length,
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
        if (!v || String(v).trim() === "" || v === "null") return;
        params.set(k, v);
      });

      const res = await authFetch(`/api/expenses?${params.toString()}`);
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
          label: FIELD_LABELS_EXPENSE[f] || f,
        })),

        rows: allEntries.map((e) => {
          const row = {};

          cleanFields.forEach((f) => {
            switch (f) {
              case "organization":
                row[f] = e.organization?.name || "";
                break;

              case "facility":
                row[f] = e.facility?.name || "";
                break;

              case "account":
                row[f] = e.account?.name || "";
                break;

              case "amount":
                row[f] =
                  e.amount != null
                    ? `$${Number(e.amount).toFixed(2)}`
                    : "";
                break;

              case "date":
                row[f] = e.date
                  ? new Date(e.date).toLocaleDateString()
                  : "";
                break;

              case "created_at":
              case "updated_at":
                row[f] = e[f]
                  ? new Date(e[f]).toLocaleDateString()
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

        meta: {
          Records: allEntries.length,
        },

        totals: [
          {
            label: "Total Records",
            value: allEntries.length,
            final: true,
          },
        ],

        context: {
          filters: formatFilters(filters, {
            sample: allEntries[0],
          }),
          printedBy: "System",
          printedAt: new Date().toLocaleString(),
        },
      });

    } catch (err) {
      console.error(err);
      alert("❌ Failed to export report");
    }
  });
}