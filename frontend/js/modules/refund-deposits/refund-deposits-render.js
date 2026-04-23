// 📦 refund-deposits-render.js – Entity Card System (FINAL MASTER PARITY)
// ============================================================================
// 🔹 STRICT parity with refund-render.js
// 🔹 Table + Card dual system
// 🔹 Sorting + resize + drag
// 🔹 Status-action-matrix driven
// 🔹 Export safe
// 🔹 ALL DOM + API preserved
// 🔹 ADDED refund_deposit_number (safe display)
// ============================================================================

import { FIELD_LABELS_REFUND_DEPOSIT } from "./refund-deposits-constants.js";
import { formatDateTime, initTooltips } from "../../utils/ui-utils.js";
import { buildActionButtons } from "../../utils/status-action-matrix.js";
import { exportData } from "../../utils/export-utils.js";
import { enableColumnResize } from "../../utils/table-resize.js";
import { enableColumnDrag } from "../../utils/table-column-drag.js";
import { getCurrencySymbol } from "../../utils/currency-utils.js";
import { initTimelines } from "../../utils/timeline/timeline-init.js";


import { exportExcelReport } from "../../utils/exportExcelReport.js";
import { exportCsvReport } from "../../utils/exportCsvReport.js";
import { printReport } from "../../utils/printBuilder.js";
import { authFetch } from "../../authSession.js";
import { formatFilters } from "../../utils/filterFormatter.js";


/* ============================================================
   🔃 SORTABLE FIELDS (MASTER)
============================================================ */
const SORTABLE_FIELDS = new Set([
  "organization_id",
  "facility_id",
  "patient_id",
  "deposit_id",
  "refund_amount",
  "method",
  "status",
  "created_at",
  "updated_at",
]);

let sortBy = localStorage.getItem("refundDepositSortBy") || "";
let sortDir = localStorage.getItem("refundDepositSortDir") || "asc";

function toggleSort(field) {
  if (sortBy === field) sortDir = sortDir === "asc" ? "desc" : "asc";
  else {
    sortBy = field;
    sortDir = "asc";
  }

  localStorage.setItem("refundDepositSortBy", sortBy);
  localStorage.setItem("refundDepositSortDir", sortDir);

  window.setRefundDepositSort?.(sortBy, sortDir);
  window.loadRefundDepositPage?.(1);
}

/* ============================================================
   🎛️ ACTIONS (MASTER)
============================================================ */
function getRefundDepositActionButtons(entry, user) {
  return buildActionButtons({
    module: "refund_deposits",
    status: (entry.status || "").toLowerCase(),
    entry,
    entryId: entry.id,
    user,
    permissionPrefix: "refund_deposits",
  });
}

/* ============================================================
   🧱 TABLE HEAD (MASTER)
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
      FIELD_LABELS_REFUND_DEPOSIT[field] || field.replace(/_/g, " ");

    if (field === "actions") {
      th.textContent = "Actions";
      th.classList.add("actions-cell");
      tr.appendChild(th);
      return;
    }

    if (SORTABLE_FIELDS.has(field)) {
      let icon = "ri-arrow-up-down-line";
      if (sortBy === field) {
        icon = sortDir === "asc" ? "ri-arrow-up-line" : "ri-arrow-down-line";
      }

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
    onReorder: () => window.loadRefundDepositPage?.(1),
  });
}

/* ============================================================
   🔠 HELPERS (MASTER)
============================================================ */
const safe = (v) => (v !== null && v !== undefined && v !== "" ? v : "—");

function renderUserName(u) {
  if (!u) return "—";
  if (typeof u === "string") return u;
  return (
    [u.first_name, u.middle_name, u.last_name].filter(Boolean).join(" ") ||
    u.full_name ||
    "—"
  );
}

function renderPatient(entry) {
  const p = entry.patient;
  if (!p) return "—";
  if (typeof p === "string") return p;
  return `${p.pat_no || "—"} - ${[p.first_name, p.middle_name, p.last_name]
    .filter(Boolean)
    .join(" ")}`;
}

function renderDeposit(entry) {
  const d = entry.deposit;
  if (!d) return "—";
  if (typeof d === "string") return d;

  const ref = d.transaction_ref || d.id || "—";
  const amt = Number(d.amount || 0).toFixed(2);
  const bal = Number(d.remaining_balance ?? d.balance ?? 0).toFixed(2);

  const symbol = getCurrencySymbol(entry.currency);
  return `${ref} | ${symbol}${amt} | Bal: ${symbol}${bal}`;
}

/* ============================================================
   🧠 VALUE ENGINE (MASTER)
============================================================ */
function renderValue(entry, field) {
  switch (field) {
    case "refund_deposit_number":
      return safe(entry.refund_deposit_number);

    case "status": {
      const s = (entry.status || "").toLowerCase();
      const map = {
        pending: "bg-warning text-dark",
        review: "bg-info text-dark",
        approved: "bg-primary",
        processed: "bg-success",
        rejected: "bg-danger text-white",
        cancelled: "bg-secondary",
        reversed: "bg-danger text-white",
        voided: "bg-dark text-light",
        restored: "bg-secondary",
      };
      return `<span class="badge ${map[s] || "bg-secondary"}">${s.toUpperCase()}</span>`;
    }

    case "organization":
    case "organization_id":
      return entry.organization?.name || "—";

    case "facility":
    case "facility_id":
      return entry.facility?.name || "—";

    case "patient":
    case "patient_id":
      return renderPatient(entry);

    case "deposit":
    case "deposit_id":
      return renderDeposit(entry);

    case "refund_amount":
      return `${getCurrencySymbol(entry.currency)} ${Number(entry.refund_amount || 0).toFixed(2)}`;

    case "method":
    case "reason":
      return safe(entry[field]);

    case "createdBy":
    case "updatedBy":
    case "deletedBy":
    case "approvedBy":
    case "processedBy":
    case "reversedBy":
    case "voidedBy":
    case "restoredBy":
    case "reviewedBy":
    case "rejectedBy":
    case "cancelledBy":
      return renderUserName(entry[field]);

    case "created_at":
    case "updated_at":
    case "deleted_at":
    case "approved_at":
    case "processed_at":
    case "reversed_at":
    case "voided_at":
    case "restored_at":
    case "reviewed_at":
    case "rejected_at":
    case "cancelled_at":
      return entry[field] ? formatDateTime(entry[field]) : "—";

    default: {
      const v = entry[field];
      if (v == null || typeof v === "object") return "—";
      return v;
    }
  }
}

/* ============================================================
   🗂️ CARD (MASTER + TIMELINE)
============================================================ */
export function renderCard(entry, visibleFields, user) {
  const has = (f) => visibleFields.includes(f);
  const status = (entry.status || "").toLowerCase();

  const safe = (v) =>
    v !== null && v !== undefined && v !== "" ? v : "—";

  const row = (label, value) =>
    value
      ? `<div class="entity-field">
           <span class="entity-label">${label}</span>
           <span class="entity-value">${safe(value)}</span>
         </div>`
      : "";

  const amount = Number(entry.refund_amount || 0).toFixed(2);

  /* ===================================================== */
  /* 🔥 TIMELINE */
  /* ===================================================== */
  const timeline = `
    <div
      class="card-timeline"
      data-module="refund_deposits"
      data-status="${status}">
    </div>
  `;

  const AUDIT_FIELDS = [
    "createdBy","updatedBy","deletedBy","approvedBy","processedBy",
    "reversedBy","voidedBy","restoredBy","reviewedBy","rejectedBy","cancelledBy",
    "created_at","updated_at","deleted_at","approved_at","processed_at",
    "reversed_at","voided_at","restored_at","reviewed_at","rejected_at","cancelled_at"
  ];

  return `
    <div class="entity-card refund-deposit-card">

      <!-- ===================================================== -->
      <!-- 🔹 HEADER -->
      <!-- ===================================================== -->
      <div class="entity-card-header">
        <div>
          <div class="entity-secondary">${renderPatient(entry)}</div>
          <div class="entity-primary">
            ${getCurrencySymbol(entry.currency)} ${amount}
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

      ${timeline}

      <!-- ===================================================== -->
      <!-- 🔹 QUICK CORE -->
      <!-- ===================================================== -->
      <div class="entity-card-body">
        ${row("Refund #", entry.refund_deposit_number)}
        ${row("Amount", `${getCurrencySymbol(entry.currency)} ${amount}`)}
        ${row("Method", entry.method)}
        ${row("Status", status.toUpperCase())}
      </div>

      <!-- ===================================================== -->
      <!-- 📄 DETAILS -->
      <!-- ===================================================== -->
      <details class="entity-section">
        <summary><strong>Details</strong></summary>
        <div class="entity-card-body">

          ${row("Organization", entry.organization?.name)}
          ${row("Facility", entry.facility?.name)}

          ${visibleFields
            .filter((f) =>
              ![
                "actions",
                "refund_deposit_number",
                "refund_amount",
                "method",
                "status",
                "organization",
                "facility",
                ...AUDIT_FIELDS
              ].includes(f)
            )
            .map((f) =>
              row(
                FIELD_LABELS_REFUND_DEPOSIT[f] || f,
                renderValue(entry, f)
              )
            )
            .join("")}

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
          ${row("Processed By", renderUserName(entry.processedBy))}
          ${row("Processed At", formatDateTime(entry.processed_at))}
          ${row("Cancelled By", renderUserName(entry.cancelledBy))}
          ${row("Cancelled At", formatDateTime(entry.cancelled_at))}
          ${row("Voided By", renderUserName(entry.voidedBy))}
          ${row("Voided At", formatDateTime(entry.voided_at))}
        </div>
      </details>

      <!-- ===================================================== -->
      <!-- ⚙️ ACTIONS -->
      ${
        has("actions")
          ? `<div class="entity-card-footer export-ignore">
               ${getRefundDepositActionButtons(entry, user)}
             </div>`
          : ""
      }

    </div>
  `;
}

/* ============================================================
   📋 LIST (WITH TIMELINE INIT)
============================================================ */
export function renderList({ entries, visibleFields, viewMode, user }) {
  const tableBody = document.getElementById("refundDepositTableBody");
  const cardContainer = document.getElementById("refundDepositList");
  const tableContainer = document.querySelector(".table-container");
  if (!tableBody || !cardContainer || !tableContainer) return;

  tableBody.innerHTML = "";
  cardContainer.innerHTML = "";

  if (viewMode === "table") {
    tableContainer.classList.add("active");
    cardContainer.classList.remove("active");

    renderDynamicTableHead(visibleFields);

    if (!entries.length) {
      tableBody.innerHTML = `<tr><td colspan="${visibleFields.length}" class="text-center text-muted">No deposit refunds found.</td></tr>`;
      return;
    }

    entries.forEach((e) => {
      const tr = document.createElement("tr");
      tr.innerHTML = visibleFields
        .map((f) =>
          f === "actions"
            ? `<td class="actions-cell export-ignore">
                 ${getRefundDepositActionButtons(e, user)}
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
      cardContainer.innerHTML = `<p class="text-center text-muted">No deposit refunds found.</p>`;
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

  setupExportHandlers(entries, visibleFields);
}
/* ============================================================
   📤 EXPORT (MASTER – FULL PARITY)
============================================================ */
function getFiltersFromDOM() {
  const val = (id) => document.getElementById(id)?.value;

  return {
    search: val("globalSearch")?.trim(),
    organization_id: val("filterOrganizationSelect"),
    facility_id: val("filterFacilitySelect"),
    status: val("filterStatus"),
    method: val("filterMethodSelect"),
    patient_id: document.getElementById("filterPatientId")?.value,
    deposit_id: document.getElementById("filterDepositId")?.value,
    dateRange: val("dateRange"),
    currency: val("filterCurrency"),
  };
}

function setupExportHandlers(entries, visibleFields) {
  const title = "Deposit Refunds Report";

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
      fieldLabels: FIELD_LABELS_REFUND_DEPOSIT,

      mapRow: (e, fields) => {
        const row = {};

        fields.forEach((f) => {
          switch (f) {
            case "patient":
            case "patient_id":
              row[f] =
                `${e.patient?.first_name || ""} ${e.patient?.last_name || ""}`.trim();
              break;

            case "organization":
            case "organization_id":
              row[f] = e.organization?.name || "";
              break;

            case "facility":
            case "facility_id":
              row[f] = e.facility?.name || "";
              break;

            case "deposit":
            case "deposit_id":
              row[f] = e.deposit?.transaction_ref || "";
              break;

            case "status":
              row[f] = (e.status || "").toUpperCase();
              break;

            case "refund_amount":
              row[f] = `${getCurrencySymbol(e.currency)} ${Number(e.refund_amount || 0).toFixed(2)}`;
              break;

            case "created_at":
              row[f] = e.created_at
                ? new Date(e.created_at).toLocaleDateString()
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
      endpoint: "/api/refund-deposits",
      title,
      filters: getFiltersFromDOM(),
      visibleFields,
      fieldLabels: FIELD_LABELS_REFUND_DEPOSIT,

      mapRow: (e, fields) => {
        const row = {};

        fields.forEach((f) => {
          switch (f) {
            case "patient":
            case "patient_id":
              row[f] =
                `${e.patient?.first_name || ""} ${e.patient?.last_name || ""}`.trim();
              break;

            case "organization":
              row[f] = e.organization?.name || "";
              break;

            case "facility":
              row[f] = e.facility?.name || "";
              break;

            case "deposit":
              row[f] = e.deposit?.transaction_ref || "";
              break;

            case "status":
              row[f] = (e.status || "").toUpperCase();
              break;

            case "refund_amount":
              row[f] = `${getCurrencySymbol(e.currency)} ${Number(e.refund_amount || 0).toFixed(2)}`;
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
        "Total Refund": records.reduce(
          (s, e) => s + Number(e.refund_amount || 0),
          0
        ),
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
        if (!v) return;

        if (k === "dateRange") {
          const [from, to] = v.split(" - ");
          if (from) params.set("date_from", from);
          if (to) params.set("date_to", to);
        } else {
          params.set(k, v);
        }
      });

      const res = await authFetch(`/api/refund-deposits?${params}`);
      const json = await res.json();
      const allEntries = json?.data?.records || [];

      const currency = allEntries[0]?.currency || "USD";

      printReport({
        title,

        columns: visibleFields.map((f) => ({
          key: f,
          label: FIELD_LABELS_REFUND_DEPOSIT[f] || f,
        })),

        rows: allEntries.map((e) => ({
          refund: e.refund_deposit_number,
          amount: `${getCurrencySymbol(e.currency)} ${Number(e.refund_amount || 0).toFixed(2)}`,
          status: (e.status || "").toUpperCase(),
        })),

        totals: [
          {
            label: "Total Refund",
            value: `${getCurrencySymbol(currency)} ${allEntries
              .reduce((s, e) => s + Number(e.refund_amount || 0), 0)
              .toFixed(2)}`,
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