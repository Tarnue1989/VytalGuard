// 📦 refund-render.js – Entity Card System (REFUND | ENTERPRISE FINAL)
// ============================================================================
// 🧭 FULL MASTER PARITY WITH payment-render.js (FRONTEND ONLY)
// 🔹 Table = flat | Card = RICH + structured
// 🔹 Field-selector safe
// 🔹 Backend sorting bridge
// 🔹 Column resize + drag enabled
// 🔹 Status-action-matrix driven actions
// 🔹 Full lifecycle + audit visibility (DATE + TIME)
// 🔹 Export-safe (no object leaks)
// 🔹 ALL existing refund logic & DOM IDs preserved
// 🔹 ADDED refund_number (safe display)
// ============================================================================

import { FIELD_LABELS_REFUND } from "./refund-constants.js";
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
  "invoice_id",
  "payment_id",
  "amount",
  "method",
  "status",
  "created_at",
  "updated_at",
]);

let sortBy = localStorage.getItem("refundSortBy") || "";
let sortDir = localStorage.getItem("refundSortDir") || "asc";

function toggleSort(field) {
  if (sortBy === field) sortDir = sortDir === "asc" ? "desc" : "asc";
  else {
    sortBy = field;
    sortDir = "asc";
  }

  localStorage.setItem("refundSortBy", sortBy);
  localStorage.setItem("refundSortDir", sortDir);

  window.setRefundSort?.(sortBy, sortDir);
  window.loadRefundPage?.(1);
}

/* ============================================================
   🎛️ ACTIONS
============================================================ */
function getRefundActionButtons(entry, user) {
  return buildActionButtons({
    module: "refund",
    status: (entry.status || "").toLowerCase(),
    entry,
    entryId: entry.id,
    user,
    permissionPrefix: "refunds",
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

    const label = FIELD_LABELS_REFUND[field] || field.replace(/_/g, " ");

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
    onReorder: () => window.loadRefundPage?.(1),
  });
}

/* ============================================================
   🔠 HELPERS
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

function renderInvoice(entry) {
  const i = entry.invoice;
  if (!i) return "—";
  if (typeof i === "string") return i;
  return `${i.invoice_number || "—"} | Bal: $${Number(i.balance ?? 0).toFixed(2)}`;
}

function renderPayment(entry) {
  const p = entry.payment;
  if (!p) return "—";
  if (typeof p === "string") return p;
  return p.transaction_ref || p.id || "—";
}

/* ============================================================
   🧩 VALUE RENDERER
============================================================ */
function renderValue(entry, field) {
  switch (field) {
    case "refund_number":
      return safe(entry.refund_number);

    case "status": {
      const s = (entry.status || "").toLowerCase();
      const map = {
        pending: "bg-warning text-dark",
        approved: "bg-primary",
        processed: "bg-success",
        rejected: "bg-danger text-white",
        cancelled: "bg-secondary",
        reversed: "bg-danger text-white",
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

    case "invoice":
    case "invoice_id":
      return renderInvoice(entry);

    case "payment":
    case "payment_id":
      return renderPayment(entry);

    case "method":
      return safe(entry.method || entry.payment?.method);

    case "amount":
      return `$${Number(entry.amount || 0).toFixed(2)}`;

    case "reason":
      return safe(entry.reason);

    case "createdBy":
    case "updatedBy":
    case "deletedBy":
    case "approvedBy":
    case "rejectedBy":
    case "processedBy":
    case "cancelledBy":
      return renderUserName(entry[field]);

    case "created_at":
    case "updated_at":
    case "deleted_at":
    case "approved_at":
    case "rejected_at":
    case "processed_at":
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
   🗂️ CARD RENDERER
============================================================ */
export function renderCard(entry, visibleFields, user) {
  const has = (f) => visibleFields.includes(f);
  const status = (entry.status || "").toLowerCase();

  const row = (label, value) =>
    value
      ? `<div class="entity-field">
           <span class="entity-label">${label}</span>
           <span class="entity-value">${value}</span>
         </div>`
      : "";

  return `
    <div class="entity-card refund-card">
      <div class="entity-card-header">
        <div>
          <div class="entity-secondary">${renderPatient(entry)}</div>
          <div class="entity-primary">$${Number(entry.amount || 0).toFixed(2)}</div>
        </div>
        ${
          has("status")
            ? `<span class="entity-status ${status}">${status.toUpperCase()}</span>`
            : ""
        }
      </div>

      <div class="entity-card-context">
        ${entry.refund_number ? `<div>🆔 ${entry.refund_number}</div>` : ""}
        ${entry.organization ? `<div>🏥 ${entry.organization.name}</div>` : ""}
        ${entry.facility ? `<div>📍 ${entry.facility.name}</div>` : ""}
        ${entry.method ? `<div>💳 ${entry.method}</div>` : ""}
      </div>

      <div class="entity-card-body">
        ${visibleFields
          .filter(
            (f) =>
              ![
                "actions",
                "createdBy",
                "created_at",
                "updatedBy",
                "updated_at",
                "deletedBy",
                "deleted_at",
              ].includes(f)
          )
          .map((f) =>
            row(FIELD_LABELS_REFUND[f] || f, renderValue(entry, f))
          )
          .join("")}
      </div>

      <details class="entity-notes">
        <summary>Audit</summary>
        <div class="entity-card-body">
          ${row("Created By", renderUserName(entry.createdBy))}
          ${row("Created At", formatDateTime(entry.created_at))}
          ${row("Updated By", renderUserName(entry.updatedBy))}
          ${row("Updated At", formatDateTime(entry.updated_at))}
        </div>
      </details>

      ${
        has("actions")
          ? `<div class="entity-card-footer export-ignore">
               ${getRefundActionButtons(entry, user)}
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
  const tableBody = document.getElementById("refundTableBody");
  const cardContainer = document.getElementById("refundList");
  const tableContainer = document.querySelector(".table-container");
  if (!tableBody || !cardContainer || !tableContainer) return;

  tableBody.innerHTML = "";
  cardContainer.innerHTML = "";

  if (viewMode === "table") {
    tableContainer.classList.add("active");
    cardContainer.classList.remove("active");
    renderDynamicTableHead(visibleFields);

    if (!entries.length) {
      tableBody.innerHTML = `<tr><td colspan="${visibleFields.length}" class="text-center text-muted">No refunds found.</td></tr>`;
      return;
    }

    entries.forEach((e) => {
      const tr = document.createElement("tr");
      tr.innerHTML = visibleFields
        .map((f) =>
          f === "actions"
            ? `<td class="actions-cell export-ignore">${getRefundActionButtons(e, user)}</td>`
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
      : `<p class="text-center text-muted">No refunds found.</p>`;
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

  const title = "Refunds Report";
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
      selector: ".table-container.active, #refundList.active",
      orientation: "landscape",
    })
  );
}