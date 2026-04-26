// 📁 currency-rate-render.js – Entity Card System (CURRENCY RATE | ENTERPRISE FINAL)
// ============================================================================
// 🧭 FULL MASTER PARITY WITH role-render.js
// 🔹 Table = flat | Card = structured
// 🔹 Field-selector safe
// 🔹 Backend sorting bridge
// 🔹 Column resize enabled
// 🔹 Column drag reorder enabled
// 🔹 Full audit section (created / updated / deleted)
// 🔹 Permission-driven actions
// 🔹 Export-safe
// ============================================================================

import { FIELD_LABELS_CURRENCY_RATE } from "./currency-rate-constants.js";

import {
  formatDate,
  formatDateTime,
  initTooltips,
} from "../../utils/ui-utils.js";

import { buildActionButtons } from "../../utils/status-action-matrix.js";
import { exportData } from "../../utils/export-utils.js";
import { enableColumnResize } from "../../utils/table-resize.js";
import { enableColumnDrag } from "../../utils/table-column-drag.js";
import { exportExcelReport } from "../../utils/exportExcelReport.js";
import { exportCsvReport } from "../../utils/exportCsvReport.js";
import { printReport } from "../../utils/printBuilder.js";
import { authFetch } from "../../authSession.js";
import { formatFilters } from "../../utils/filterFormatter.js";

/* ============================================================
   🔃 SORTABLE FIELDS
============================================================ */
const SORTABLE_FIELDS = new Set([
  "organization_id",
  "facility_id",
  "from_currency",
  "to_currency",
  "rate",
  "effective_date",
  "status",
  "created_at",
  "updated_at",
]);

/* ============================================================
   🔃 SORT STATE
============================================================ */
let sortBy = localStorage.getItem("currencyRateSortBy") || "";
let sortDir = localStorage.getItem("currencyRateSortDir") || "asc";

function toggleSort(field) {
  if (sortBy === field) {
    sortDir = sortDir === "asc" ? "desc" : "asc";
  } else {
    sortBy = field;
    sortDir = "asc";
  }

  localStorage.setItem("currencyRateSortBy", sortBy);
  localStorage.setItem("currencyRateSortDir", sortDir);

  window.setCurrencyRateSort?.(sortBy, sortDir);
  window.loadCurrencyRatePage?.(1);
}

/* ============================================================
   🎛️ ACTION BUTTONS
============================================================ */
function getCurrencyRateActionButtons(entry, user) {
  return buildActionButtons({
    module: "currency_rate",
    status: (entry.status || "").toLowerCase(),
    entryId: entry.id,
    user,
    permissionPrefix: "currency_rates",
  });
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
    const label = FIELD_LABELS_CURRENCY_RATE[field] || field.replace(/_/g, " ");

    if (field === "actions") {
      th.textContent = "Actions";
      th.classList.add("actions-cell");
      tr.appendChild(th);
      return;
    }

    th.dataset.key = field;

    if (SORTABLE_FIELDS.has(field)) {
      th.classList.add("sortable");

      let icon = "ri-arrow-up-down-line";
      if (sortBy === field) {
        icon =
          sortDir === "asc"
            ? "ri-arrow-up-line"
            : "ri-arrow-down-line";
      }

      th.innerHTML = `
        <span>${label}</span>
        <i class="${icon} sort-icon"></i>
      `;
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
    onReorder: () => {
      renderDynamicTableHead(visibleFields);
      window.loadCurrencyRatePage?.(1);
    },
  });
}

/* ============================================================
   🔠 HELPERS
============================================================ */
function renderUserName(user) {
  if (!user) return "—";
  const parts = [user.first_name, user.middle_name, user.last_name].filter(Boolean);
  return parts.length ? parts.join(" ") : user.username || user.email || "—";
}

/* ============================================================
   🧩 FIELD VALUE RENDERER
============================================================ */
function renderValue(entry, field) {
  switch (field) {
    case "status": {
      const raw = (entry.status || "").toLowerCase();
      let cls = "bg-secondary";
      if (raw === "active") cls = "bg-success";
      if (raw === "inactive") cls = "bg-warning text-dark";
      if (raw === "deleted") cls = "bg-danger";

      return `<span class="badge ${cls}">
        ${raw.toUpperCase()}
      </span>`;
    }

    case "organization":
    case "organization_id":
      return entry.organization?.name || "—";

    case "facility":
    case "facility_id":
      return entry.facility?.name || "—";

    case "from_currency":
      return `<strong>${entry.from_currency || "—"}</strong>`;

    case "to_currency":
      return `<strong>${entry.to_currency || "—"}</strong>`;

    case "rate":
      return entry.rate != null ? Number(entry.rate).toFixed(4) : "—";

    case "effective_date":
      return entry.effective_date
        ? formatDate(entry.effective_date)
        : "—";

    case "createdBy":
    case "updatedBy":
    case "deletedBy":
      return renderUserName(entry[field]);

    case "created_at":
    case "updated_at":
    case "deleted_at":
      return entry[field] ? formatDateTime(entry[field]) : "—";

    default:
      return entry[field] ?? "—";
  }
}

/* ============================================================
   🗂️ CARD RENDERER — CURRENCY RATE
============================================================ */
export function renderCard(entry, visibleFields, user) {
  const has = f => visibleFields.includes(f);
  const safe = v => (v !== null && v !== undefined && v !== "" ? v : "—");

  const fieldRow = (label, value) => `
    <div class="entity-field">
      <span class="entity-label">${label}</span>
      <span class="entity-value">${safe(value)}</span>
    </div>
  `;

  const status = (entry.status || "").toLowerCase();

  const header = `
    <div class="entity-card-header">
      <div>
        <div class="entity-secondary">
          ${safe(entry.from_currency)} → ${safe(entry.to_currency)}
        </div>
        <div class="entity-primary">
          Rate: ${entry.rate != null ? Number(entry.rate).toFixed(4) : "—"}
        </div>
      </div>
      ${
        has("status")
          ? `<span class="entity-status ${status}">
               ${status.toUpperCase()}
             </span>`
          : ""
      }
    </div>
  `;

  const contextItems = [];
  if (has("organization")) contextItems.push(`🏥 ${safe(entry.organization?.name)}`);
  if (has("facility")) contextItems.push(`📍 ${safe(entry.facility?.name)}`);

  const context = contextItems.length
    ? `<div class="entity-card-context">
         ${contextItems.map(v => `<div>${v}</div>`).join("")}
       </div>`
    : "";

  const body = `
    <div class="entity-card-body">
      <div>
        ${
          has("effective_date")
            ? fieldRow("Effective Date", formatDate(entry.effective_date))
            : ""
        }
      </div>
      <div></div>
    </div>
  `;

  const audit =
    has("created_at") || has("updated_at") || has("deleted_at")
      ? `
        <details class="entity-notes">
          <summary>Audit</summary>
          <div class="entity-card-body">
            <div>
              ${
                has("createdBy")
                  ? fieldRow("Created By", renderUserName(entry.createdBy))
                  : ""
              }
              ${
                has("created_at")
                  ? fieldRow("Created At", formatDateTime(entry.created_at))
                  : ""
              }
            </div>
            <div>
              ${
                has("updatedBy")
                  ? fieldRow("Updated By", renderUserName(entry.updatedBy))
                  : ""
              }
              ${
                has("updated_at")
                  ? fieldRow("Updated At", formatDateTime(entry.updated_at))
                  : ""
              }
            </div>
          </div>
        </details>
      `
      : "";

  const actions = has("actions")
    ? `<div class="entity-card-footer export-ignore">
         ${getCurrencyRateActionButtons(entry, user)}
       </div>`
    : "";

  return `
    <div class="entity-card currency-rate-card">
      ${header}
      ${context}
      ${body}
      ${audit}
      ${actions}
    </div>
  `;
}

/* ============================================================
   📋 LIST RENDERER (MASTER 1:1 PARITY)
============================================================ */
export function renderList({ entries, visibleFields, viewMode, user }) {
  const tableBody = document.getElementById("currencyRateTableBody");
  const cardContainer = document.getElementById("currencyRateList");
  const tableContainer = document.querySelector(".table-container");

  if (!tableBody || !cardContainer || !tableContainer) return;

  tableBody.innerHTML = "";
  cardContainer.innerHTML = "";

  /* ============================================================
     🔲 TABLE VIEW
  ============================================================ */
  if (viewMode === "table") {
    tableContainer.classList.add("active");
    cardContainer.classList.remove("active");

    renderDynamicTableHead(visibleFields);

    if (!entries.length) {
      tableBody.innerHTML = `
        <tr>
          <td colspan="${visibleFields.length}" class="text-center text-muted">
            No records found
          </td>
        </tr>
      `;
      return;
    }

    entries.forEach((entry) => {
      const tr = document.createElement("tr");

      tr.innerHTML = visibleFields
        .map((field) =>
          field === "actions"
            ? `<td class="actions-cell export-ignore">
                 ${getCurrencyRateActionButtons(entry, user)}
               </td>`
            : `<td>${renderValue(entry, field)}</td>`
        )
        .join("");

      tableBody.appendChild(tr);
    });

    initTooltips(tableBody);

  /* ============================================================
     🧱 CARD VIEW
  ============================================================ */
  } else {
    tableContainer.classList.remove("active");
    cardContainer.classList.add("active");

    const fragment = document.createDocumentFragment();

    if (!entries.length) {
      cardContainer.innerHTML = `
        <p class="text-center text-muted">No records found.</p>
      `;
      return;
    }

    entries.forEach((entry) => {
      const wrapper = document.createElement("div");
      wrapper.innerHTML = renderCard(entry, visibleFields, user);

      fragment.appendChild(wrapper.firstElementChild);
    });

    cardContainer.appendChild(fragment);

    initTooltips(cardContainer);
  }

  /* ============================================================
     📤 EXPORT HANDLERS (MANDATORY MASTER)
  ============================================================ */
  setupExportHandlers(entries, visibleFields);
}

/* ============================================================
   📤 EXPORT HANDLERS (ROLE 1:1)
============================================================ */
function setupExportHandlers(entries, visibleFields) {
  const title = "Currency Rates Report";

  const pdfBtn = document.getElementById("exportPDFBtn");
  const csvBtn = document.getElementById("exportCSVBtn");
  const excelBtn = document.getElementById("exportExcelBtn");

  if (!pdfBtn || !csvBtn || !excelBtn) return;

  /* ============================================================
     🔁 RESET BUTTONS (MASTER)
  ============================================================ */
  pdfBtn.replaceWith(pdfBtn.cloneNode(true));
  csvBtn.replaceWith(csvBtn.cloneNode(true));
  excelBtn.replaceWith(excelBtn.cloneNode(true));

  const newPdfBtn = document.getElementById("exportPDFBtn");
  const newCsvBtn = document.getElementById("exportCSVBtn");
  const newExcelBtn = document.getElementById("exportExcelBtn");

  /* ============================================================
     📥 FILTERS (MASTER)
  ============================================================ */
  function getFiltersFromDOM() {
    const val = (id) => document.getElementById(id)?.value;

    return {
      search: val("globalSearch")?.trim(),
      organization_id: val("filterOrganizationSelect"),
      facility_id: val("filterFacilitySelect"),
      from_currency: val("filterFromCurrencySelect"),
      to_currency: val("filterToCurrencySelect"),
      status: val("filterStatusSelect"),
      dateRange: val("dateRange"),
    };
  }

  /* ============================================================
     🔁 MAP ROW (MASTER SAFE)
  ============================================================ */
  const mapRow = (e, fields) => {
    const row = {};

    fields.forEach((f) => {
      switch (f) {
        case "organization":
        case "organization_id":
          row[f] = e.organization?.name || "";
          break;

        case "facility":
        case "facility_id":
          row[f] = e.facility?.name || "";
          break;

        case "status":
          row[f] = (e.status || "").toUpperCase();
          break;

        case "rate":
          row[f] = e.rate != null ? Number(e.rate).toFixed(4) : "";
          break;

        case "createdBy":
          row[f] = e.createdBy
            ? `${e.createdBy.first_name || ""} ${e.createdBy.last_name || ""}`.trim()
            : "";
          break;

        case "updatedBy":
          row[f] = e.updatedBy
            ? `${e.updatedBy.first_name || ""} ${e.updatedBy.last_name || ""}`.trim()
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
  };

  /* ============================================================
     ✅ CSV (MASTER)
  ============================================================ */
  newCsvBtn.addEventListener("click", () => {
    exportCsvReport({
      title,
      data: entries,
      visibleFields,
      fieldLabels: FIELD_LABELS_CURRENCY_RATE,
      mapRow,
    });
  });

  /* ============================================================
     ✅ EXCEL (MASTER WITH TOTALS)
  ============================================================ */
  newExcelBtn.addEventListener("click", () => {
    exportExcelReport({
      endpoint: "/api/currency-rates",
      title,
      filters: getFiltersFromDOM(),
      visibleFields,
      fieldLabels: FIELD_LABELS_CURRENCY_RATE,
      mapRow,

      /* 🔥 MASTER ADD */
      computeTotals: (records) => ({
        "Average Rate":
          records.length
            ? (
                records.reduce((s, e) => s + Number(e.rate || 0), 0) /
                records.length
              ).toFixed(4)
            : "0.0000",
      }),
    });
  });

  /* ============================================================
     ✅ PDF (FULL MASTER REPORT)
  ============================================================ */
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

      const res = await authFetch(`/api/currency-rates?${params.toString()}`);
      const json = await res.json();
      const allEntries = json?.data?.records || [];

      const cleanFields = visibleFields.filter(
        (f) => f !== "actions"
      );

      printReport({
        title,

        columns: cleanFields.map((f) => ({
          key: f,
          label: FIELD_LABELS_CURRENCY_RATE[f] || f,
        })),

        rows: allEntries.map((e) => mapRow(e, cleanFields)),

        meta: {
          Organization: allEntries[0]?.organization?.name || "",
          Facility: allEntries[0]?.facility?.name || "",
          Records: allEntries.length,
        },

        /* 🔥 MASTER CONTEXT */
        context: {
          filters: formatFilters(filters, {
            sample: allEntries[0],
          }),
          printedBy: "System",
          printedAt: new Date().toLocaleString(),
        },

        /* 🔥 MASTER TOTALS */
        totals: [
          {
            label: "Average Rate",
            value: allEntries.length
              ? (
                  allEntries.reduce((s, e) => s + Number(e.rate || 0), 0) /
                  allEntries.length
                ).toFixed(4)
              : "0.0000",
            final: true,
          },
        ],
      });
    } catch (err) {
      console.error(err);
      alert("❌ Failed to export report");
    }
  });
}