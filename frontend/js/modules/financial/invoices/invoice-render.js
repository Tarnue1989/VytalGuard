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

import { exportExcelReport } from "../../../utils/exportExcelReport.js";
import { exportCsvReport } from "../../../utils/exportCsvReport.js";
import { printReport } from "../../../utils/printBuilder.js";
import { authFetch } from "../../../authSession.js";
import { formatFilters } from "../../../utils/filterFormatter.js";

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
    case "is_locked":
        return entry.is_locked ? "Yes" : "No";
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

  setupExportHandlers(entries, visibleFields);
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
   🗂️ CARD RENDERER (ENTERPRISE FINAL — FIXED CORRECTLY)
============================================================ */
export function renderCard(entry, visibleFields, user) {
  const has = (f) => visibleFields.includes(f);
  const status = (entry.status || "").toLowerCase();

  const safe = (v) =>
    v !== null && v !== undefined && v !== "" ? v : "—";

  /* ============================================================
     🔥 CORRECT FINANCIAL LOGIC
  ============================================================ */
  const insurance = Number(entry.insurance_amount || 0);

  // ✅ FIX: DO NOT subtract again
  const patientPortion = Number(entry.total || 0);

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

        ${row("Insurance", money(entry.insurance_amount, entry.currency))}

        <!-- ✅ FIXED -->
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
   📤 EXPORT (MASTER – EXACT DEPOSIT PATTERN)
============================================================ */
function setupExportHandlers(entries, visibleFields) {
  const title = "Invoices Report";

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
      search: val("globalSearch")?.trim(),
      organization_id: val("filterOrganizationSelect"),
      facility_id: val("filterFacilitySelect"),
      status: val("filterStatus"),
      patient_id: document.getElementById("filterPatientId")?.value,
      currency: val("filterCurrency"),
      payer_type: val("filterPayerType"),
      dateRange: val("dateRange"),
    };
  }

  /* ================= CSV ================= */
  newCsvBtn.addEventListener("click", () => {
    exportCsvReport({
      title,
      data: entries,
      visibleFields,
      fieldLabels: FIELD_LABELS_INVOICE,

      mapRow: (e, fields) => {
        const row = {};

        fields.forEach((f) => {
          switch (f) {

            case "is_locked":
              row[f] = e.is_locked ? "Yes" : "No";
              break;

            case "organization":
              row[f] = e.organization?.name || "";
              break;

            case "facility":
              row[f] = e.facility?.name || "";
              break;

            case "patient":
              row[f] = e.patient
                ? `${e.patient.first_name || ""} ${e.patient.last_name || ""}`.trim()
                : "";
              break;

            case "status":
              row[f] = (e.status || "").toUpperCase();
              break;

            case "total":
            case "balance":
            case "total_paid":
              row[f] = e[f] != null
                ? `${e.currency || ""} ${Number(e[f]).toFixed(2)}`
                : "";
              break;

            case "created_at":
            case "updated_at":
              row[f] = e[f] ? new Date(e[f]).toLocaleDateString() : "";
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
      endpoint: "/api/invoices",
      title,
      filters: getFiltersFromDOM(),
      visibleFields,
      fieldLabels: FIELD_LABELS_INVOICE,

      mapRow: (e, fields) => {
        const row = {};

        fields.forEach((f) => {
          switch (f) {

            case "is_locked":
              row[f] = e.is_locked ? "Yes" : "No";
              break;

            case "organization":
              row[f] = e.organization?.name || "";
              break;

            case "facility":
              row[f] = e.facility?.name || "";
              break;

            case "patient":
              row[f] = e.patient
                ? `${e.patient.first_name || ""} ${e.patient.last_name || ""}`.trim()
                : "";
              break;

            case "status":
              row[f] = (e.status || "").toUpperCase();
              break;

            case "total":
            case "balance":
            case "total_paid":
              row[f] = e[f] != null
                ? `${e.currency || ""} ${Number(e[f]).toFixed(2)}`
                : "";
              break;

            case "created_at":
            case "updated_at":
              row[f] = e[f] ? new Date(e[f]).toLocaleDateString() : "";
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

        if (k === "dateRange") {
          const [from, to] = v.split(" - ");
          if (from) params.set("date_from", from.trim());
          if (to) params.set("date_to", to.trim());
        } else {
          params.set(k, v);
        }
      });

      const res = await authFetch(`/api/invoices?${params.toString()}`);
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
          label: FIELD_LABELS_INVOICE[f] || f,
        })),

        rows: allEntries.map((e) => {
          const row = {};

          cleanFields.forEach((f) => {
            switch (f) {

              case "is_locked":
                row[f] = e.is_locked ? "Yes" : "No";
                break;

              case "organization":
                row[f] = e.organization?.name || "";
                break;

              case "facility":
                row[f] = e.facility?.name || "";
                break;

              case "patient":
                row[f] = e.patient
                  ? `${e.patient.first_name || ""} ${e.patient.last_name || ""}`.trim()
                  : "";
                break;

              case "status":
                row[f] = (e.status || "").toUpperCase();
                break;

              case "total":
              case "balance":
              case "total_paid":
                row[f] = e[f] != null
                  ? `${e.currency || ""} ${Number(e[f]).toFixed(2)}`
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