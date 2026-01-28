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

import { formatDate, initTooltips } from "../../utils/ui-utils.js";
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
   🗂️ CARD RENDERER — RICH (MASTER)
============================================================ */
export function renderCard(entry, visibleFields, user) {
  const has = (f) => visibleFields.includes(f);
  const status = (entry.status || "").toLowerCase();

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
    <div class="entity-card deposit-card">
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
        ${entry.organization ? `<div>🏥 ${entry.organization.name}</div>` : ""}
        ${entry.facility ? `<div>📍 ${entry.facility.name}</div>` : ""}
        ${entry.method ? `<div>💳 ${entry.method}</div>` : ""}
        ${entry.transaction_ref ? `<div>🔗 ${entry.transaction_ref}</div>` : ""}
      </div>

      <div class="entity-card-body">
        ${row("Amount", `$${Number(entry.amount || 0).toFixed(2)}`)}
        ${row("Applied Amount", `$${Number(entry.applied_amount || 0).toFixed(2)}`)}
        ${row(
          "Remaining Balance",
          `$${Number(entry.remaining_balance || 0).toFixed(2)}`
        )}
        ${row("Status", status.toUpperCase())}

        ${row("Reason", entry.reason)}
        ${row("Notes", entry.notes)}
      </div>

      <details class="entity-notes">
        <summary>Audit</summary>
        <div class="entity-card-body">
          ${row("Created By", renderUserName(entry.createdBy))}
          ${row("Created At", formatDate(entry.created_at))}
          ${row("Updated By", renderUserName(entry.updatedBy))}
          ${row("Updated At", formatDate(entry.updated_at))}
        </div>
      </details>

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
