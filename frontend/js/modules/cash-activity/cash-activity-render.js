// 📦 cash-activity-render.js – Entity Renderer (Ledger | MASTER UPGRADE)
// ============================================================================
// 🔹 READ ONLY (no actions)
// 🔹 FULL: sorting + column resize + drag + export-safe
// ============================================================================

import { FIELD_LABELS_CASH_ACTIVITY } from "./cash-activity-constants.js";
import { formatDateTime, initTooltips } from "../../utils/ui-utils.js";
import { enableColumnResize } from "../../utils/table-resize.js";
import { enableColumnDrag } from "../../utils/table-column-drag.js";

import { exportExcelReport } from "../../utils/exportExcelReport.js";
import { exportCsvReport } from "../../utils/exportCsvReport.js";
import { printReport } from "../../utils/printBuilder.js";
import { authFetch } from "../../authSession.js";
import { formatFilters } from "../../utils/filterFormatter.js";

/* ============================================================
   🔃 SORT
============================================================ */
const SORTABLE_FIELDS = new Set([
  "date",
  "type",
  "direction",
  "account_id",
  "amount",
  "currency",
  "reference_type",
  "created_at",
]);

let sortBy = localStorage.getItem("cashSortBy") || "";
let sortDir = localStorage.getItem("cashSortDir") || "asc";

function toggleSort(field) {
  if (sortBy === field) sortDir = sortDir === "asc" ? "desc" : "asc";
  else {
    sortBy = field;
    sortDir = "asc";
  }

  localStorage.setItem("cashSortBy", sortBy);
  localStorage.setItem("cashSortDir", sortDir);

  window.setCashActivitySort?.(sortBy, sortDir);
  window.loadCashActivityPage?.(1);
}

/* ============================================================
   🔠 HELPERS
============================================================ */
const safe = (v) =>
  v !== null && v !== undefined && v !== "" ? v : "—";

function renderUserName(u) {
  if (!u) return "—";
  return [u.first_name, u.last_name].filter(Boolean).join(" ") || "—";
}

/* ============================================================
   🎨 DIRECTION BADGE
============================================================ */
function renderDirection(direction) {
  if (direction === "in") {
    return `<span class="badge bg-success">IN</span>`;
  }
  if (direction === "out") {
    return `<span class="badge bg-danger">OUT</span>`;
  }
  return "—";
}

/* ============================================================
   💰 AMOUNT DISPLAY
============================================================ */
function renderAmount(entry) {
  const amt = Number(entry.amount || 0).toFixed(2);

  if (entry.direction === "in") {
    return `<span class="text-success fw-bold">+${amt}</span>`;
  }
  if (entry.direction === "out") {
    return `<span class="text-danger fw-bold">-${amt}</span>`;
  }
  return amt;
}

/* ============================================================
   🧩 VALUE RENDERER (EXPORT SAFE)
============================================================ */
function renderValue(entry, field) {
  switch (field) {
    case "date":
    const d = entry.date || entry.createdAt;
    return d
        ? new Date(d).toLocaleDateString("en-US", {
            year: "numeric",
            month: "long",
            day: "numeric",
        })
        : "—";

    case "type":
      if (entry.reference_type === "payment") return "Payment";
      if (entry.reference_type === "deposit") return "Deposit";
      if (entry.reference_type === "expense") return "Expense";
      if (entry.reference_type === "refund") return "Refund";
      return entry.type || "—";

    case "direction":
      return renderDirection(entry.direction);

    case "account":
    case "account_id":
      return entry.account?.name || "—";

    case "amount":
      return renderAmount(entry);

    case "currency":
      return entry.currency || "—";

    case "reference_type":
      return safe(entry.reference_type);

    case "description":
      return safe(entry.description);

    case "createdBy":
      return renderUserName(entry.createdBy);

    case "created_at":
      return entry.createdAt
        ? formatDateTime(entry.createdAt)
        : "—";

    default: {
      const v = entry[field];
      if (v === null || v === undefined || v === "") return "—";
      if (typeof v === "object") return "—";
      return v;
    }
  }
}

/* ============================================================
   🧱 TABLE HEAD (SORT + RESIZE + DRAG)
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
      FIELD_LABELS_CASH_ACTIVITY[field] ||
      field.replace(/_/g, " ");

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

  /* 🔥 COLUMN WIDTH */
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
    onReorder: () => window.loadCashActivityPage?.(1),
  });
}

/* ============================================================
   🗂️ CARD RENDER (FIXED – FIELD SELECTOR SAFE)
============================================================ */
function renderCard(entry, visibleFields) {
  const has = (f) => visibleFields.includes(f);

  const row = (label, value) => {
    if (!value || value === "—") return "";
    return `
      <div class="entity-field">
        <span class="entity-label">${label}</span>
        <span class="entity-value">${value}</span>
      </div>
    `;
  };

  const typeLabel =
    entry.reference_type === "payment"
      ? "Payment"
      : entry.reference_type === "deposit"
      ? "Deposit"
      : entry.reference_type === "expense"
      ? "Expense"
      : entry.reference_type === "refund"
      ? "Refund"
      : entry.type;

  return `
    <div class="entity-card">

      <div class="entity-card-header">
        <div>
          <div class="entity-primary">
            ${has("amount") ? renderAmount(entry) : ""}
          </div>
          <div class="entity-secondary">
            ${has("account") || has("account_id") ? (entry.account?.name || "—") : ""}
          </div>
        </div>
        ${has("direction") ? renderDirection(entry.direction) : ""}
      </div>

      <div class="entity-card-body">
        ${has("type") ? row("Type", typeLabel) : ""}
        ${has("reference_type") ? row("Reference", entry.reference_type) : ""}
        ${has("description") ? row("Description", entry.description) : ""}
        ${has("date") ? row(
        "Date",
        (entry.date || entry.createdAt)
            ? new Date(entry.date || entry.createdAt).toLocaleDateString("en-US", {
                year: "numeric",
                month: "long",
                day: "numeric",
            })
            : "—"
        ) : ""}
      </div>

      ${
        has("currency") || has("createdBy") || has("created_at")
          ? `
      <details class="entity-section">
        <summary><strong>Details</strong></summary>
        <div class="entity-card-body">
          ${has("currency") ? row("Currency", entry.currency) : ""}
          ${has("createdBy") ? row("Created By", renderUserName(entry.createdBy)) : ""}
          ${has("created_at")
            ? row(
                "Created At",
                entry.createdAt ? formatDateTime(entry.createdAt) : "—"
              )
            : ""}
        </div>
      </details>`
          : ""
      }

    </div>
  `;
}
/* ============================================================
   📋 LIST RENDER
============================================================ */
export function renderList({ entries, visibleFields, viewMode }) {
  const tableBody = document.getElementById("cashActivityTableBody");
  const cardContainer = document.getElementById("cashActivityList");
  const tableContainer = document.querySelector(".table-container");

  if (!tableBody || !cardContainer || !tableContainer) return;

  tableBody.innerHTML = "";
  cardContainer.innerHTML = "";

  if (viewMode === "table") {
    tableContainer.classList.add("active");
    cardContainer.classList.remove("active");

    renderDynamicTableHead(visibleFields);

    if (!entries.length) {
      tableBody.innerHTML = `<tr><td colspan="${visibleFields.length}" class="text-center text-muted">No records found.</td></tr>`;
      return;
    }

    entries.forEach((e) => {
      const tr = document.createElement("tr");

      tr.innerHTML = visibleFields
        .map((f) => `<td>${renderValue(e, f)}</td>`)
        .join("");

      tableBody.appendChild(tr);
    });

    initTooltips(tableBody);

  } else {
    tableContainer.classList.remove("active");
    cardContainer.classList.add("active");

    if (!entries.length) {
      cardContainer.innerHTML = `<p class="text-center text-muted">No records found.</p>`;
      return;
    }

    entries.forEach((entry) => {
    const wrapper = document.createElement("div");
    wrapper.innerHTML = renderCard(entry, visibleFields);
    cardContainer.appendChild(wrapper.firstElementChild);
    });

    initTooltips(cardContainer);
  }
  setupExportHandlers(entries, visibleFields);
}

/* ============================================================
   📤 EXPORT (MASTER – CASH ACTIVITY FULL)
============================================================ */
function getFiltersFromDOM() {
  const val = (id) => document.getElementById(id)?.value;

  return {
    search: val("globalSearch")?.trim(),
    organization_id: val("filterOrganizationSelect"),
    facility_id: val("filterFacilitySelect"),
    account_id: val("filterAccountSelect"),
    direction: val("filterDirection"),
    currency: val("filterCurrency"),
    dateRange: val("dateRange"),
  };
}

function setupExportHandlers(entries, visibleFields) {
  const title = "Cash Activity Report";

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
      fieldLabels: FIELD_LABELS_CASH_ACTIVITY,
      mapRow: (e, fields) => {
        const row = {};
        fields.forEach((f) => {
          switch (f) {
            case "account":
            case "account_id":
              row[f] = e.account?.name || "";
              break;

            case "organization":
            case "organization_id":
              row[f] = e.organization?.name || "";
              break;

            case "facility":
            case "facility_id":
              row[f] = e.facility?.name || "";
              break;

            case "direction":
              row[f] = (e.direction || "").toUpperCase();
              break;

            case "amount":
              row[f] = Number(e.amount || 0).toFixed(2);
              break;

            case "createdBy":
              row[f] =
                `${e.createdBy?.first_name || ""} ${e.createdBy?.last_name || ""}`.trim();
              break;

            case "created_at":
              row[f] = e.createdAt
                ? new Date(e.createdAt).toLocaleString()
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
      endpoint: "/api/cash-ledger",
      title,
      filters: getFiltersFromDOM(),
      visibleFields,
      fieldLabels: FIELD_LABELS_CASH_ACTIVITY,

      mapRow: (e, fields) => {
        const row = {};
        fields.forEach((f) => {
          switch (f) {
            case "account":
            case "account_id":
              row[f] = e.account?.name || "";
              break;

            case "organization":
              row[f] = e.organization?.name || "";
              break;

            case "facility":
              row[f] = e.facility?.name || "";
              break;

            case "direction":
              row[f] = (e.direction || "").toUpperCase();
              break;

            case "amount":
              row[f] = Number(e.amount || 0).toFixed(2);
              break;

            case "createdBy":
              row[f] =
                `${e.createdBy?.first_name || ""} ${e.createdBy?.last_name || ""}`.trim();
              break;

            case "created_at":
              row[f] = e.createdAt
                ? new Date(e.createdAt).toLocaleString()
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
        "Total In": records
          .filter((e) => e.direction === "in")
          .reduce((s, e) => s + Number(e.amount || 0), 0),

        "Total Out": records
          .filter((e) => e.direction === "out")
          .reduce((s, e) => s + Number(e.amount || 0), 0),
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

      const res = await authFetch(`/api/cash-ledger?${params.toString()}`);
      const json = await res.json();
      const allEntries = json?.data?.records || [];

      printReport({
        title,

        columns: visibleFields.map((f) => ({
          key: f,
          label: FIELD_LABELS_CASH_ACTIVITY[f] || f,
        })),

        rows: allEntries.map((e) => {
          const row = {};

          visibleFields.forEach((f) => {
            switch (f) {
              case "account":
              case "account_id":
                row[f] = e.account?.name || "";
                break;

              case "organization":
              case "organization_id":
                row[f] = e.organization?.name || "";
                break;

              case "facility":
              case "facility_id":
                row[f] = e.facility?.name || "";
                break;

              case "direction":
                row[f] = (e.direction || "").toUpperCase();
                break;

              case "amount":
                row[f] = Number(e.amount || 0).toFixed(2);
                break;

              case "createdBy":
                row[f] =
                  `${e.createdBy?.first_name || ""} ${e.createdBy?.last_name || ""}`.trim();
                break;

              case "created_at":
                row[f] = e.createdAt
                  ? new Date(e.createdAt).toLocaleString()
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
              .filter((e) => e.direction === "in")
              .reduce((s, e) => s + Number(e.amount || 0), 0)
              .toFixed(2),
          },
          {
            label: "Total Out",
            value: allEntries
              .filter((e) => e.direction === "out")
              .reduce((s, e) => s + Number(e.amount || 0), 0)
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