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

import { formatDateTime, initTooltips } from "../../utils/ui-utils.js";
import { buildActionButtons } from "../../utils/status-action-matrix.js";
import { exportData } from "../../utils/export-utils.js";
import { enableColumnResize } from "../../utils/table-resize.js";
import { enableColumnDrag } from "../../utils/table-column-drag.js";

/* ============================================================
   🔃 SORTABLE FIELDS (MASTER PARITY)
============================================================ */
const SORTABLE_FIELDS = new Set([
  "organization_id",
  "facility_id",
  "patient_id",
  "amount",
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

    case "facility":
    case "facility_id":
      return entry.facility?.name || "—";

    case "patient":
    case "patient_id":
      return renderPatient(entry);

    case "appliedInvoice":
      return entry.appliedInvoice
        ? `${entry.appliedInvoice.invoice_number} (Bal: $${Number(
            entry.appliedInvoice.balance
          ).toFixed(2)})`
        : "—";

    case "amount":
    case "applied_amount":
    case "remaining_balance":
      return entry[field] != null
        ? `$${Number(entry[field]).toFixed(2)}`
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
   🗂️ CARD RENDERER — RICH (DEPOSIT | MASTER PARITY)
============================================================ */
export function renderCard(entry, visibleFields, user) {
  const has = (f) => visibleFields.includes(f);
  const status = (entry.status || "").toLowerCase();

  const safe = (v) =>
    v !== null && v !== undefined && v !== "" ? v : "—";

  const money = (v) => `$${Number(v || 0).toFixed(2)}`;

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

      <!-- ===================================================== -->
      <!-- 🔹 QUICK CORE (LIGHT — MASTER PARITY) -->
      <!-- ===================================================== -->
      <div class="entity-card-body">
        ${row("Deposit #", entry.deposit_number)}
        ${row("Amount", money(entry.amount))}
        ${row("Available", money(entry.remaining_balance))}
        ${hasRefund ? row("Refunded", money(refundedAmount)) : ""}
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
   📋 LIST RENDERER
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
            ? `<td class="actions-cell export-ignore">${getDepositActionButtons(
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
      : `<p class="text-center text-muted">No deposits found.</p>`;
    initTooltips(cardContainer);
  }

  setupExportHandlers(entries);
}

/* ============================================================
   📤 EXPORT
============================================================ */
let exportHandlersBound = false;
function setupExportHandlers(entries) {
  if (exportHandlersBound) return;
  exportHandlersBound = true;

  const title = "Deposits Report";
  document.getElementById("exportCSVBtn")?.addEventListener("click", () =>
    exportData({ type: "csv", data: entries, title })
  );
  document.getElementById("exportExcelBtn")?.addEventListener("click", () =>
    exportData({ type: "xlsx", data: entries, title })
  );
  document.getElementById("exportPDFBtn")?.addEventListener("click", () =>
    exportData({
      type: "pdf",
      title,
      selector: ".table-container.active, #depositList.active",
      orientation: "landscape",
    })
  );
}