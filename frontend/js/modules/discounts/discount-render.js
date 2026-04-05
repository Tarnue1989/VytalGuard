// 📦 discount-render.js – Entity Card System (DISCOUNT | ENTERPRISE MASTER PARITY)
// ============================================================================
// 🧭 FULL MASTER PARITY WITH deposit-render.js
// 🔹 Table = flat | Card = RICH + structured
// 🔹 Field-selector safe
// 🔹 Backend sorting bridge
// 🔹 Column resize + drag enabled
// 🔹 Full audit section
// 🔹 Permission-driven actions
// 🔹 Export-safe (no object leaks)
// 🔹 Preserves ALL existing discount logic & API contracts
// ============================================================================

import { FIELD_LABELS_DISCOUNT } from "./discount-constants.js";

import { formatDate, formatDateTime, initTooltips } from "../../utils/ui-utils.js";
import { buildActionButtons } from "../../utils/status-action-matrix.js";
import { exportData } from "../../utils/export-utils.js";
import { enableColumnResize } from "../../utils/table-resize.js";
import { enableColumnDrag } from "../../utils/table-column-drag.js";
import { getCurrencySymbol } from "../../utils/currency-utils.js";

/* ============================================================
   🔃 SORTABLE FIELDS (MASTER PARITY)
============================================================ */
const SORTABLE_FIELDS = new Set([
  "organization_id",
  "facility_id",
  "invoice_id",
  "type",
  "value",
  "status",
  "created_at",
  "updated_at",
  "finalized_at",
  "voided_at",
]);

let sortBy = localStorage.getItem("discountSortBy") || "";
let sortDir = localStorage.getItem("discountSortDir") || "asc";

function toggleSort(field) {
  if (sortBy === field) sortDir = sortDir === "asc" ? "desc" : "asc";
  else {
    sortBy = field;
    sortDir = "asc";
  }

  localStorage.setItem("discountSortBy", sortBy);
  localStorage.setItem("discountSortDir", sortDir);
  window.setDiscountSort?.(sortBy, sortDir);
  window.loadDiscountPage?.(1);
}

/* ============================================================
   🎛️ ACTION BUTTONS (MASTER)
============================================================ */
function getDiscountActionButtons(entry, user) {
  return buildActionButtons({
    module: "discount",
    status: (entry.status || "").toLowerCase(),
    entry,
    entryId: entry.id,
    user,
    permissionPrefix: "discounts",
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
      FIELD_LABELS_DISCOUNT[field] || field.replace(/_/g, " ");

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
    onReorder: () => window.loadDiscountPage?.(1),
  });
}

/* ============================================================
   🔠 HELPERS (MASTER-SAFE)
============================================================ */
const safe = (v) => (v !== null && v !== undefined && v !== "" ? v : "—");

function renderUserName(u) {
  if (!u) return "—";
  return [u.first_name, u.middle_name, u.last_name]
    .filter(Boolean)
    .join(" ") || u.full_name || "—";
}

/* ============================================================
   🧩 TABLE VALUE RENDERER (OBJECT-SAFE)
============================================================ */
function renderValue(entry, field) {
  switch (field) {
    case "status": {
      const s = (entry.status || "").toLowerCase();
      const cls =
        s === "draft"
          ? "bg-warning text-dark"
          : s === "active"
          ? "bg-primary"
          : s === "inactive"
          ? "bg-secondary"
          : s === "finalized"
          ? "bg-success"
          : s === "voided"
          ? "bg-danger"
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
    case "invoice":
    case "invoice_id":
      return entry.invoice
        ? `${entry.invoice.invoice_number} (Bal: ${getCurrencySymbol(entry.currency)} ${Number(
            entry.invoice.balance || 0
          ).toFixed(2)})`
        : "—";
    case "currency":
      return entry.currency || "—";

    case "applied_amount":
      return entry.applied_amount != null
        ? `${getCurrencySymbol(entry.currency)} ${Number(entry.applied_amount).toFixed(2)}`
        : "—";
    case "invoiceItem":
      return entry.invoiceItem
        ? `${entry.invoiceItem.description} · Qty ${entry.invoiceItem.quantity}`
        : "—";

    case "type":
      return safe(entry.type);

    case "value":
      if (entry.type === "percentage")
        return `${Number(entry.value || 0)}%`;

      return entry.value != null
        ? `${getCurrencySymbol(entry.currency)} ${Number(entry.value).toFixed(2)}`
        : "—";

    case "reason":
    case "void_reason":
      return safe(entry[field]);

    case "createdBy":
      return renderUserName(entry.createdBy);
    case "updatedBy":
      return renderUserName(entry.updatedBy);
    case "deletedBy":
      return renderUserName(entry.deletedBy);
    case "finalizedBy":
      return renderUserName(entry.finalizedBy);
    case "voidedBy":
      return renderUserName(entry.voidedBy);

    case "created_at":
    case "updated_at":
    case "deleted_at":
    case "finalized_at":
    case "voided_at":
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
    <div class="entity-card discount-card">
      <!-- =========================
           HEADER
      ========================== -->
      <div class="entity-card-header">
        <div>
          <div class="entity-secondary">
            ${entry.invoice?.invoice_number || "—"}
          </div>
          <div class="entity-primary">
            ${
              entry.type === "percentage"
                ? `${Number(entry.value || 0)}%`
                : `${getCurrencySymbol(entry.currency)} ${Number(entry.value || 0).toFixed(2)}`
            }
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

      <!-- =========================
           CONTEXT
      ========================== -->
      <div class="entity-card-context">
        ${entry.organization ? `<div>🏥 ${entry.organization.name}</div>` : ""}
        ${entry.facility ? `<div>📍 ${entry.facility.name}</div>` : ""}
        ${entry.type ? `<div>🏷️ ${entry.type}</div>` : ""}
      </div>

      <!-- =========================
          MAIN DETAILS
      ========================== -->
      <div class="entity-card-body">
        ${row("Reason", entry.reason)}

        ${row(
          "Applied Amount",
          entry.applied_amount != null
            ? `${getCurrencySymbol(entry.currency)} ${Number(entry.applied_amount).toFixed(2)}`
            : "—"
        )}
      </div>

      <!-- =========================
           LIFECYCLE (AUTO)
      ========================== -->
      <details class="entity-notes entity-lifecycle">
        <summary>Lifecycle</summary>
        <div class="entity-card-body">
          ${row("Status", status.toUpperCase())}

          ${row("Finalized By", renderUserName(entry.finalizedBy))}
          ${row(
            "Finalized At",
            entry.finalized_at ? formatDateTime(entry.finalized_at) : "—"
          )}

          ${row("Void Reason", entry.void_reason)}
          ${row("Voided By", renderUserName(entry.voidedBy))}
          ${row(
            "Voided At",
            entry.voided_at ? formatDateTime(entry.voided_at) : "—"
          )}
        </div>
      </details>

      <!-- =========================
           AUDIT (FULL)
      ========================== -->
      <details class="entity-notes">
        <summary>Audit</summary>
        <div class="entity-card-body">
          ${row("Created By", renderUserName(entry.createdBy))}
          ${row(
            "Created At",
            entry.created_at ? formatDateTime(entry.created_at) : "—"
          )}
          ${row("Updated By", renderUserName(entry.updatedBy))}
          ${row(
            "Updated At",
            entry.updated_at ? formatDateTime(entry.updated_at) : "—"
          )}
        </div>
      </details>

      <!-- =========================
           ACTIONS
      ========================== -->
      ${
        has("actions")
          ? `<div class="entity-card-footer export-ignore">
               ${getDiscountActionButtons(entry, user)}
             </div>`
          : ""
      }
    </div>
  `;
}

/* ============================================================
   📋 LIST RENDERER (MASTER)
============================================================ */
export function renderList({ entries, visibleFields, viewMode, user }) {
  const tableBody = document.getElementById("discountTableBody");
  const cardContainer = document.getElementById("discountList");
  const tableContainer = document.querySelector(".table-container");
  if (!tableBody || !cardContainer || !tableContainer) return;

  tableBody.innerHTML = "";
  cardContainer.innerHTML = "";

  if (viewMode === "table") {
    tableContainer.classList.add("active");
    cardContainer.classList.remove("active");
    renderDynamicTableHead(visibleFields);

    if (!entries.length) {
      tableBody.innerHTML = `<tr><td colspan="${visibleFields.length}" class="text-center text-muted">No discounts found.</td></tr>`;
      return;
    }

    entries.forEach((e) => {
      const tr = document.createElement("tr");
      tr.innerHTML = visibleFields
        .map((f) =>
          f === "actions"
            ? `<td class="actions-cell export-ignore">${getDiscountActionButtons(
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
      : `<p class="text-muted text-center py-3">No discounts found.</p>`;
    initTooltips(cardContainer);
  }
}
