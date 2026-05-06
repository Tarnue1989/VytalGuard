// 📦 deposit-render.js – Entity Card System (DEPOSIT | ENTERPRISE FINAL)
// ============================================================================
// 🧭 FULL MASTER PARITY WITH consultation-render.js
// 🔹 Table = flat | Card = RICH + structured
// 🔹 Field-selector safe
// 🔹 Backend sorting bridge
// 🔹 Column resize + drag enabled
// 🔹 Full audit section
// 🔹 Permission-driven actions
// 🔹 Export-safe (no object leaks)
// ============================================================================

import { FIELD_LABELS_DEPOSIT } from "./deposit-constants.js";
import { getCurrencySymbol } from "../../utils/currency-utils.js";
import { formatDateTime, formatDate, initTooltips } from "../../utils/ui-utils.js";
import { buildActionButtons } from "../../utils/status-action-matrix.js";
import { exportData } from "../../utils/export-utils.js";
import { enableColumnResize } from "../../utils/table-resize.js";
import { enableColumnDrag } from "../../utils/table-column-drag.js";
import { initTimelines } from "../../utils/timeline/timeline-init.js";

import { printReport } from "../../utils/printBuilder.js";
import { authFetch } from "../../authSession.js";
import { formatFilters } from "../../utils/filterFormatter.js";
import { exportExcelReport } from "../../utils/exportExcelReport.js";
import { exportCsvReport } from "../../utils/exportCsvReport.js";

/* ============================================================
   🔃 SORTABLE FIELDS (MASTER PARITY)
============================================================ */
const SORTABLE_FIELDS = new Set([
  "organization_id",
  "facility_id",
  "patient_id",
  "amount",
  "currency",
  "applied_amount",
  "remaining_balance",
  "method",
  "status",
  "created_at",
  "updated_at",
]);

let sortBy = localStorage.getItem("depositSortBy") || "";
let sortDir = localStorage.getItem("depositSortDir") || "asc";

function toggleSort(field) {
  if (sortBy === field) sortDir = sortDir === "asc" ? "desc" : "asc";
  else {
    sortBy = field;
    sortDir = "asc";
  }
  localStorage.setItem("depositSortBy", sortBy);
  localStorage.setItem("depositSortDir", sortDir);
  window.setDepositSort?.(sortBy, sortDir);
  window.loadDepositPage?.(1);
}

/* ============================================================
   🎛️ ACTIONS
============================================================ */
function getDepositActionButtons(entry, user) {
  return buildActionButtons({
    module: "deposit",
    status: (entry.status || "").toLowerCase(),
    entry,
    entryId: entry.id,
    user,
    permissionPrefix: "deposits",
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
      FIELD_LABELS_DEPOSIT[field] || field.replace(/_/g, " ");

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
    onReorder: () => window.loadDepositPage?.(1),
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
    case "deposit_number":
      return safe(entry.deposit_number);

    case "status": {
      const s = (entry.status || "").toLowerCase();
      const cls =
        s === "pending"
          ? "bg-warning text-dark"
          : s === "cleared"
          ? "bg-primary"
          : s === "applied"
          ? "bg-success"
          : s === "cancelled"
          ? "bg-danger"
          : s === "reversed"
          ? "bg-dark text-light"
          : "bg-secondary";
      return `<span class="badge ${cls}">${s.toUpperCase()}</span>`;
    }

    case "organization":
    case "organization_id":
      return entry.organization?.name || "—";
    case "account":
    case "account_id":
      return entry.account?.name || "—";

    case "facility":
    case "facility_id":
      return entry.facility?.name || "—";

    case "patient":
    case "patient_id":
      return renderPatient(entry);

    case "appliedInvoice":
      return entry.appliedInvoice
        ? `${entry.appliedInvoice.invoice_number} (Bal: ${getCurrencySymbol(entry.currency)} ${Number(
            entry.appliedInvoice.balance
          ).toFixed(2)})`
        : "—";
    case "currency":
      return safe(entry.currency);
    case "amount":
    case "applied_amount":
    case "remaining_balance":
      return entry[field] != null
        ? `${getCurrencySymbol(entry.currency)} ${Number(entry[field]).toFixed(2)}`
        : "—";

    case "method":
    case "transaction_ref":
    case "notes":
    case "reason":
      return safe(entry[field]);

    case "createdBy":
      return renderUserName(entry.createdBy);
    case "updatedBy":
      return renderUserName(entry.updatedBy);
    case "deletedBy":
      return renderUserName(entry.deletedBy);

    case "created_at":
    case "updated_at":
    case "deleted_at":
      return entry[field] ? formatDate(entry[field]) : "—";

    default: {
      const v = entry[field];
      if (v === null || v === undefined || v === "") return "—";
      if (typeof v === "object") return "—";
      return v;
    }
  }
}

/* ============================================================
   🗂️ CARD RENDERER — RICH (DEPOSIT | MASTER PARITY + TIMELINE)
============================================================ */
export function renderCard(entry, visibleFields, user) {
  const has = (f) => visibleFields.includes(f);
  const status = (entry.status || "").toLowerCase();

  const safe = (v) =>
    v !== null && v !== undefined && v !== "" ? v : "—";

  const money = (v) =>
    `${getCurrencySymbol(entry.currency)} ${Number(v || 0).toFixed(2)}`;

  const row = (label, value) => {
    if (value === undefined || value === null || value === "") return "";
    return `
      <div class="entity-field">
        <span class="entity-label">${label}</span>
        <span class="entity-value">${safe(value)}</span>
      </div>
    `;
  };

  const refundedAmount = Number(entry.refund_amount || 0);
  const hasRefund = refundedAmount > 0;

  const lifecycleHint =
    status === "applied" && hasRefund
      ? "Applied → Refunded"
      : status === "applied"
      ? "Applied"
      : status === "voided"
      ? "Voided"
      : "";

  /* ===================================================== */
  /* 🔥 TIMELINE BLOCK */
  /* ===================================================== */
  const timeline = `
    <div
      class="card-timeline"
      data-module="deposit"
      data-status="${status}">
    </div>
  `;

  /* ===================== AUDIT FIELDS ===================== */
  const AUDIT_FIELDS = [
    "createdBy",
    "updatedBy",
    "deletedBy",
    "created_at",
    "updated_at",
    "deleted_at",
  ];

  return `
    <div class="entity-card deposit-card">

      <!-- ===================================================== -->
      <!-- 🔹 HEADER -->
      <!-- ===================================================== -->
      <div class="entity-card-header">
        <div>
          <div class="entity-secondary">${renderPatient(entry)}</div>
          <div class="entity-primary">${money(entry.amount)}</div>
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
        ${row("Deposit #", entry.deposit_number)}
        ${row("Amount", money(entry.amount))}
        ${row("Available", money(entry.remaining_balance))}
        ${hasRefund ? row("Refunded", money(refundedAmount)) : ""}
        ${row("Currency", entry.currency)}
        ${row("Account", entry.account?.name)}
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
          ${row("Transaction Ref", entry.transaction_ref)}

          ${row("Applied Amount", money(entry.applied_amount))}

          ${
            lifecycleHint
              ? row(
                  "Lifecycle",
                  `<span class="text-muted">${lifecycleHint}</span>`
                )
              : ""
          }

          ${visibleFields
            .filter(
              (f) =>
                ![
                  "actions",
                  "amount",
                  "remaining_balance",
                  "refund_amount",
                  "status",
                  "deposit_number",
                  "method",
                  "transaction_ref",
                  "applied_amount",
                  "reason",
                  "notes",
                  ...AUDIT_FIELDS,
                ].includes(f)
            )
            .map((f) =>
              row(
                FIELD_LABELS_DEPOSIT?.[f] || f,
                renderValue(entry, f)
              )
            )
            .join("")}

        </div>
      </details>

      <!-- ===================================================== -->
      <!-- 📝 REASON -->
      <!-- ===================================================== -->
      ${
        entry.reason
          ? `<details class="entity-section">
               <summary><strong>Reason</strong></summary>
               <div class="entity-card-body">
                 ${entry.reason}
               </div>
             </details>`
          : ""
      }

      <!-- ===================================================== -->
      <!-- 📝 NOTES -->
      <!-- ===================================================== -->
      ${
        entry.notes
          ? `<details class="entity-section">
               <summary><strong>Notes</strong></summary>
               <div class="entity-card-body">
                 ${entry.notes}
               </div>
             </details>`
          : ""
      }

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
        </div>
      </details>

      <!-- ===================================================== -->
      <!-- ⚙️ ACTIONS -->
      <!-- ===================================================== -->
      ${
        has("actions")
          ? `<div class="entity-card-footer export-ignore">
               ${getDepositActionButtons(entry, user)}
             </div>`
          : ""
      }

    </div>
  `;
}

  /* ============================================================
    📋 LIST RENDERER (WITH TIMELINE INIT)
  ============================================================ */
  export function renderList({ entries, visibleFields, viewMode, user }) {
    const tableBody = document.getElementById("depositTableBody");
    const cardContainer = document.getElementById("depositList");
    const tableContainer = document.querySelector(".table-container");
    if (!tableBody || !cardContainer || !tableContainer) return;

    tableBody.innerHTML = "";
    cardContainer.innerHTML = "";

    if (viewMode === "table") {
      tableContainer.classList.add("active");
      cardContainer.classList.remove("active");

      renderDynamicTableHead(visibleFields);

      if (!entries.length) {
        tableBody.innerHTML = `<tr><td colspan="${visibleFields.length}" class="text-center text-muted">No deposits found.</td></tr>`;
        return;
      }

      entries.forEach((e) => {
        const tr = document.createElement("tr");
        tr.innerHTML = visibleFields
          .map((f) =>
            f === "actions"
              ? `<td class="actions-cell export-ignore">${getDepositActionButtons(e, user)}</td>`
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
        cardContainer.innerHTML = `<p class="text-center text-muted">No deposits found.</p>`;
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


  function getFiltersFromDOM() {
    const val = (id) => document.getElementById(id)?.value;

    return {
      search: val("globalSearch")?.trim(),
      organization_id: val("filterOrganizationSelect"),
      facility_id: val("filterFacilitySelect"),
      status: val("filterStatus"),
      method: val("filterMethodSelect"),
      transaction_ref: val("filterTransactionRef"),
      patient_id: document.getElementById("filterPatientId")?.value,
      dateRange: val("dateRange"),
      currency: val("filterCurrencySelect"),
    };
  }
/* ============================================================
   📤 EXPORT (UNIVERSAL TEMPLATE ENABLED)
============================================================ */
function setupExportHandlers(entries, visibleFields) {
  const title = "Deposits Report";

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

  /* =========================================================
     🔥 SHARED MAPPER
  ========================================================= */
  const mapDepositRow = (e, fields) => {
    const row = {};

    fields.forEach((f) => {
      switch (f) {

        case "deposit_number":
          row[f] = e.deposit_number || "";
          break;

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

        case "account":
        case "account_id":
          row[f] = e.account?.name || "";
          break;

        case "appliedInvoice":
        case "applied_invoice_id":
          row[f] = e.appliedInvoice?.invoice_number || "";
          break;

        case "currency":
          row[f] = e.currency || "";
          break;

        case "status":
          row[f] = (e.status || "").toUpperCase();
          break;

        case "method":
          row[f] = e.method || "";
          break;

        case "transaction_ref":
          row[f] = e.transaction_ref || "";
          break;

        case "reason":
          row[f] = e.reason || "";
          break;

        case "notes":
          row[f] = e.notes || "";
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

        case "deletedBy":
          row[f] = e.deletedBy
            ? `${e.deletedBy.first_name || ""} ${e.deletedBy.last_name || ""}`.trim()
            : "";
          break;

        case "amount":
        case "applied_amount":
        case "remaining_balance":
        case "refund_amount":
        case "balance":
        case "unapplied_amount":
          row[f] =
            `${getCurrencySymbol(e.currency)} ${Number(e[f] || 0).toFixed(2)}`;
          break;

        case "created_at":
          row[f] = e.created_at
            ? new Date(e.created_at).toLocaleString("en-US", {
                year: "numeric",
                month: "long",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit",
                hour12: true,
              })
            : "";
          break;

        case "updated_at":
          row[f] = e.updated_at
            ? new Date(e.updated_at).toLocaleString("en-US", {
                year: "numeric",
                month: "long",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit",
                hour12: true,
              })
            : "";
          break;

        case "deleted_at":
          row[f] = e.deleted_at
            ? new Date(e.deleted_at).toLocaleString("en-US", {
                year: "numeric",
                month: "long",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit",
                hour12: true,
              })
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

  /* =========================================================
     🔥 GROUP TOTALS BY CURRENCY
  ========================================================= */
  const groupTotalsByCurrency = (records, field) => {
    const totals = {};

    records.forEach((r) => {
      const currency = r.currency || "USD";

      if (!totals[currency]) {
        totals[currency] = 0;
      }

      totals[currency] += Number(r[field] || 0);
    });

    return totals;
  };

  /* =========================================================
     ✅ CSV
  ========================================================= */
  newCsvBtn.addEventListener("click", () => {
    exportCsvReport({
      title,
      data: entries,
      visibleFields,
      fieldLabels: FIELD_LABELS_DEPOSIT,

      mapRow: (e, fields) => mapDepositRow(e, fields),
    });
  });

  /* =========================================================
     ✅ EXCEL
  ========================================================= */
  newExcelBtn.addEventListener("click", () => {
    exportExcelReport({
      endpoint: "/api/deposits",
      title,
      filters: getFiltersFromDOM(),
      visibleFields,
      fieldLabels: FIELD_LABELS_DEPOSIT,

      mapRow: (e, fields) => mapDepositRow(e, fields),

      computeTotals: (records) => {
        const result = {};

        const amountTotals =
          groupTotalsByCurrency(records, "amount");

        const appliedTotals =
          groupTotalsByCurrency(records, "applied_amount");

        const balanceTotals =
          groupTotalsByCurrency(records, "remaining_balance");

        Object.entries(amountTotals).forEach(([currency, total]) => {
          result[`Total Amount (${currency})`] = total;
        });

        Object.entries(appliedTotals).forEach(([currency, total]) => {
          result[`Total Applied (${currency})`] = total;
        });

        Object.entries(balanceTotals).forEach(([currency, total]) => {
          result[`Remaining Balance (${currency})`] = total;
        });

        return result;
      },
    });
  });

  /* =========================================================
     ✅ PDF
  ========================================================= */
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

      const res = await authFetch(`/api/deposits?${params.toString()}`);
      const json = await res.json();

      const allEntries = json?.data?.records || [];

      const amountTotals =
        groupTotalsByCurrency(allEntries, "amount");

      const appliedTotals =
        groupTotalsByCurrency(allEntries, "applied_amount");

      const balanceTotals =
        groupTotalsByCurrency(allEntries, "remaining_balance");

      const cleanFields = visibleFields.filter(
        (f) =>
          f !== "actions" &&
          !["deletedBy", "deleted_at"].includes(f)
      );

      const totals = [];

      Object.entries(amountTotals).forEach(([currency, total]) => {
        totals.push({
          label: `Total Amount (${currency})`,
          value: `${getCurrencySymbol(currency)} ${total.toFixed(2)}`,
        });
      });

      Object.entries(appliedTotals).forEach(([currency, total]) => {
        totals.push({
          label: `Total Applied (${currency})`,
          value: `${getCurrencySymbol(currency)} ${total.toFixed(2)}`,
        });
      });

      Object.entries(balanceTotals).forEach(([currency, total], index, arr) => {
        totals.push({
          label: `Remaining Balance (${currency})`,
          value: `${getCurrencySymbol(currency)} ${total.toFixed(2)}`,
          final: index === arr.length - 1,
        });
      });

      printReport({
        title,

        columns: cleanFields.map((f) => ({
          key: f,
          label: FIELD_LABELS_DEPOSIT[f] || f,
        })),

        rows: allEntries.map((e) =>
          mapDepositRow(e, cleanFields)
        ),

        meta: {
          Organization: allEntries[0]?.organization?.name || "",
          Facility: allEntries[0]?.facility?.name || "",
          Records: allEntries.length,
        },

        totals,

        context: {
          filters: formatFilters(filters, {
            sample: allEntries[0],
          }),

          printedBy: "System",

          printedAt: new Date().toLocaleString("en-US", {
            year: "numeric",
            month: "long",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit",
            hour12: true,
          }),
        },
      });

    } catch (err) {
      console.error(err);
      alert("❌ Failed to export full report");
    }
  });
}