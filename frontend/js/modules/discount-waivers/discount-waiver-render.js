// 📦 discount-waiver-render.js – Enterprise MASTER–ALIGNED (Deposit Render Parity)
// ============================================================================
// 🧭 FULL MASTER PARITY WITH deposit-render.js
// 🔹 Table = flat | Card = RICH + structured
// 🔹 Field-selector safe
// 🔹 Backend sorting bridge
// 🔹 Column resize + drag enabled
// 🔹 Full audit section
// 🔹 Permission-driven actions
// 🔹 Export-safe (no object leaks)
// ============================================================================

import { FIELD_LABELS_DISCOUNT_WAIVER } from "./discount-waiver-constants.js";

import { formatDateTime, initTooltips } from "../../utils/ui-utils.js";
import { buildActionButtons } from "../../utils/status-action-matrix.js";
import { exportData } from "../../utils/export-utils.js";
import { enableColumnResize } from "../../utils/table-resize.js";
import { enableColumnDrag } from "../../utils/table-column-drag.js";
import { getCurrencySymbol } from "../../utils/currency-utils.js";

import { exportExcelReport } from "../../utils/exportExcelReport.js";
import { exportCsvReport } from "../../utils/exportCsvReport.js";
import { printReport } from "../../utils/printBuilder.js";
import { authFetch } from "../../authSession.js";
import { formatFilters } from "../../utils/filterFormatter.js";


/* ============================================================
   🔃 SORTABLE FIELDS (MASTER PARITY)
============================================================ */
const SORTABLE_FIELDS = new Set([
  "organization_id",
  "facility_id",
  "invoice_id",
  "patient_id",
  "type",
  "percentage",
  "amount",
  "applied_total",
  "status",
  "created_at",
  "updated_at",
]);

let sortBy = localStorage.getItem("discountWaiverSortBy") || "";
let sortDir = localStorage.getItem("discountWaiverSortDir") || "asc";

function toggleSort(field) {
  if (sortBy === field) sortDir = sortDir === "asc" ? "desc" : "asc";
  else {
    sortBy = field;
    sortDir = "asc";
  }
  localStorage.setItem("discountWaiverSortBy", sortBy);
  localStorage.setItem("discountWaiverSortDir", sortDir);
  window.setDiscountWaiverSort?.(sortBy, sortDir);
  window.loadDiscountWaiverPage?.(1);
}

/* ============================================================
   🎛️ ACTIONS (MASTER MATRIX)
============================================================ */
function getDiscountWaiverActionButtons(entry, user) {
  return buildActionButtons({
    module: "discount_waiver",
    status: (entry.status || "").toLowerCase(),
    entryId: entry.id,
    user,
    permissionPrefix: "discount_waivers",
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
    th.dataset.key = field;

    const label =
      FIELD_LABELS_DISCOUNT_WAIVER[field] || field.replace(/_/g, " ");

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
    onReorder: () => window.loadDiscountWaiverPage?.(1),
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

function renderPatient(entry) {
  if (!entry.patient) return "—";
  const p = entry.patient;
  return `${p.pat_no || "—"} - ${[p.first_name, p.middle_name, p.last_name]
    .filter(Boolean)
    .join(" ")}`;
}

/* ============================================================
   🧩 TABLE VALUE RENDERER (OBJECT-SAFE)
============================================================ */
function renderValue(entry, field) {
  switch (field) {
    case "status": {
      const s = (entry.status || "").toLowerCase();
      const cls =
        s === "pending"
          ? "bg-warning text-dark"
          : s === "approved"
          ? "bg-success"
          : s === "rejected"
          ? "bg-danger"
          : s === "voided"
          ? "bg-dark text-light"
          : s === "finalized"
          ? "bg-info text-dark"
          : "bg-secondary";
      return `<span class="badge ${cls}">${s.toUpperCase()}</span>`;
    }

    case "organization":
    case "organization_id":
      return entry.organization?.name || "—";

    case "facility":
    case "facility_id":
      return entry.facility?.name || "—";

    case "invoice":
    case "invoice_id":
      return entry.invoice?.invoice_number || "—";

    case "currency":
      return entry.currency || "—";
    case "patient":
    case "patient_id":
      return renderPatient(entry);

    case "type":
      return safe(entry.type);

    case "percentage":
      return entry.percentage != null ? `${entry.percentage}%` : "—";

    case "amount":
    case "applied_total":
      return entry[field] != null
        ? `${getCurrencySymbol(entry.currency)} ${Number(entry[field]).toFixed(2)}`
        : "—";

    case "reason":
      return safe(entry.reason);

    case "approvedBy":
    case "rejectedBy":
    case "voidedBy":
    case "finalizedBy":
    case "createdBy":
    case "updatedBy":
    case "deletedBy":
      return renderUserName(entry[field]);

    case "approved_at":
    case "rejected_at":
    case "voided_at":
    case "finalized_at":
    case "created_at":
    case "updated_at":
    case "deleted_at":
      return entry[field] ? formatDateTime(entry[field]) : "—";

    default: {
      const v = entry[field];
      if (v === null || v === undefined || v === "") return "—";
      if (typeof v === "object") return "—";
      return v;
    }
  }
}

/* ============================================================
   🗂️ CARD RENDERER — RICH (MASTER)
============================================================ */
export function renderCard(entry, visibleFields, user) {
  const has = (f) => visibleFields.includes(f);
  const status = (entry.status || "").toLowerCase();

  const money = (v) =>
    v !== null && v !== undefined
      ? `${getCurrencySymbol(entry.currency)} ${Number(v).toFixed(2)}`
      : "—";

  const row = (label, value) => {
    if (value === undefined || value === null || value === "") return "";
    return `
      <div class="entity-field">
        <span class="entity-label">${label}</span>
        <span class="entity-value">${safe(value)}</span>
      </div>
    `;
  };

  return `
    <div class="entity-card discount-waiver-card">
      <div class="entity-card-header">
        <div>
          <div class="entity-secondary">${renderPatient(entry)}</div>
          <div class="entity-primary">${money(entry.applied_total)}</div>
        </div>
        ${
          has("status")
            ? `<span class="entity-status ${status}">
                 ${status.toUpperCase()}
               </span>`
            : ""
        }
      </div>

      <div class="entity-card-context">
        ${entry.organization ? `<div>🏥 ${entry.organization.name}</div>` : ""}
        ${entry.facility ? `<div>📍 ${entry.facility.name}</div>` : ""}
        ${entry.invoice ? `<div>🧾 ${entry.invoice.invoice_number}</div>` : ""}
        ${entry.currency ? `<div>💱 ${entry.currency}</div>` : ""}
      </div>

      <div class="entity-card-body">
        ${row("Type", entry.type)}
        ${row("Percentage", entry.percentage != null ? `${entry.percentage}%` : "")}
        ${row("Amount", money(entry.amount))}
        ${row("Applied Total", money(entry.applied_total))}
        ${row("Reason", entry.reason)}
      </div>

      ${
        entry.approvedBy ||
        entry.approved_at ||
        entry.rejectedBy ||
        entry.rejected_at ||
        entry.voidedBy ||
        entry.voided_at ||
        entry.createdBy ||
        entry.created_at ||
        entry.updatedBy ||
        entry.updated_at
          ? `
      <details class="entity-notes">
        <summary>Audit</summary>
        <div class="entity-card-body">
          ${entry.approvedBy ? row("Approved By", renderUserName(entry.approvedBy)) : ""}
          ${entry.approved_at ? row("Approved At", formatDateTime(entry.approved_at)) : ""}
          ${entry.rejectedBy ? row("Rejected By", renderUserName(entry.rejectedBy)) : ""}
          ${entry.rejected_at ? row("Rejected At", formatDateTime(entry.rejected_at)) : ""}
          ${entry.voidedBy ? row("Voided By", renderUserName(entry.voidedBy)) : ""}
          ${entry.voided_at ? row("Voided At", formatDateTime(entry.voided_at)) : ""}
          ${entry.createdBy ? row("Created By", renderUserName(entry.createdBy)) : ""}
          ${entry.created_at ? row("Created At", formatDateTime(entry.created_at)) : ""}
          ${entry.updatedBy ? row("Updated By", renderUserName(entry.updatedBy)) : ""}
          ${entry.updated_at ? row("Updated At", formatDateTime(entry.updated_at)) : ""}
        </div>
      </details>
      `
          : ""
      }

      ${
        has("actions")
          ? `<div class="entity-card-footer export-ignore">
               ${getDiscountWaiverActionButtons(entry, user)}
             </div>`
          : ""
      }
    </div>
  `;
}

/* ============================================================
   📋 LIST RENDERER
============================================================ */
export function renderList({ entries, visibleFields, viewMode, user }) {
  const tableBody = document.getElementById("discountWaiverTableBody");
  const cardContainer = document.getElementById("discountWaiverList");
  const tableContainer = document.querySelector(".table-container");
  if (!tableBody || !cardContainer || !tableContainer) return;

  tableBody.innerHTML = "";
  cardContainer.innerHTML = "";

  if (viewMode === "table") {
    tableContainer.classList.add("active");
    cardContainer.classList.remove("active");
    renderDynamicTableHead(visibleFields);

    if (!entries.length) {
      tableBody.innerHTML = `<tr><td colspan="${visibleFields.length}" class="text-center text-muted">No discount waivers found.</td></tr>`;
      return;
    }

    entries.forEach((e) => {
      const tr = document.createElement("tr");
      tr.innerHTML = visibleFields
        .map((f) =>
          f === "actions"
            ? `<td class="actions-cell export-ignore">${getDiscountWaiverActionButtons(
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
      : `<p class="text-center text-muted">No discount waivers found.</p>`;
    initTooltips(cardContainer);
  }

  setupExportHandlers(entries, visibleFields);
}

/* ============================================================
   📤 EXPORT (MASTER – EXACT DEPOSIT PATTERN)
============================================================ */
function setupExportHandlers(entries, visibleFields) {
  const title = "Discount Waivers Report";

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
      currency: val("filterCurrency"),
      invoice_id: document.getElementById("filterInvoiceId")?.value,
      patient_id: document.getElementById("filterPatientId")?.value,
      dateRange: val("dateRange"),
    };
  }

  /* ================= CSV ================= */
  newCsvBtn.addEventListener("click", () => {
    exportCsvReport({
      title,
      data: entries,
      visibleFields,
      fieldLabels: FIELD_LABELS_DISCOUNT_WAIVER,

      mapRow: (e, fields) => {
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

            case "invoice":
            case "invoice_id":
              row[f] = e.invoice?.invoice_number || "";
              break;

            case "patient":
            case "patient_id":
              row[f] = e.patient
                ? `${e.patient.first_name || ""} ${e.patient.last_name || ""}`.trim()
                : "";
              break;

            case "status":
              row[f] = (e.status || "").toUpperCase();
              break;

            case "amount":
            case "applied_total":
              row[f] = e[f] != null
                ? `${getCurrencySymbol(e.currency)} ${Number(e[f]).toFixed(2)}`
                : "";
              break;

            case "percentage":
              row[f] = e.percentage != null ? `${e.percentage}%` : "";
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
      endpoint: "/api/discount-waivers",
      title,
      filters: getFiltersFromDOM(),
      visibleFields,
      fieldLabels: FIELD_LABELS_DISCOUNT_WAIVER,

      mapRow: (e, fields) => {
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

            case "invoice":
            case "invoice_id":
              row[f] = e.invoice?.invoice_number || "";
              break;

            case "patient":
            case "patient_id":
              row[f] = e.patient
                ? `${e.patient.first_name || ""} ${e.patient.last_name || ""}`.trim()
                : "";
              break;

            case "status":
              row[f] = (e.status || "").toUpperCase();
              break;

            case "amount":
            case "applied_total":
              row[f] = e[f] != null
                ? `${getCurrencySymbol(e.currency)} ${Number(e[f]).toFixed(2)}`
                : "";
              break;

            case "percentage":
              row[f] = e.percentage != null ? `${e.percentage}%` : "";
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

      const res = await authFetch(
        `/api/discount-waivers?${params.toString()}`
      );
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
          label: FIELD_LABELS_DISCOUNT_WAIVER[f] || f,
        })),

        rows: allEntries.map((e) => {
          const row = {};

          cleanFields.forEach((f) => {
            switch (f) {
              case "organization":
              case "organization_id":
                row[f] = e.organization?.name || "";
                break;

              case "facility":
              case "facility_id":
                row[f] = e.facility?.name || "";
                break;

              case "invoice":
              case "invoice_id":
                row[f] = e.invoice?.invoice_number || "";
                break;

              case "patient":
              case "patient_id":
                row[f] = e.patient
                  ? `${e.patient.first_name || ""} ${e.patient.last_name || ""}`.trim()
                  : "";
                break;

              case "status":
                row[f] = (e.status || "").toUpperCase();
                break;

              case "amount":
              case "applied_total":
                row[f] = e[f] != null
                  ? `${getCurrencySymbol(e.currency)} ${Number(e[f]).toFixed(2)}`
                  : "";
                break;

              case "percentage":
                row[f] = e.percentage != null ? `${e.percentage}%` : "";
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