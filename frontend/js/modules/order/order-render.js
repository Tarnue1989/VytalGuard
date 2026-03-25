 // 📁 order-render.js – Entity Card System (ORDER | ENTERPRISE MASTER FINAL)
// ============================================================================
// 🔹 FULL MASTER PARITY (Prescription style)
// 🔹 Table = flat | Card = FULL RICH DETAILS
// 🔹 Items include qty + price + totals
// 🔹 Audit + Billing + Context added
// 🔹 Backend-aligned fields FIXED
// ============================================================================

import { FIELD_LABELS_ORDER } from "./order-constants.js";

import {
  formatDateTime,
  initTooltips,
  formatClinicalDate,
} from "../../utils/ui-utils.js";

import { buildActionButtons } from "../../utils/status-action-matrix.js";
import { exportData } from "../../utils/export-utils.js";
import { enableColumnResize } from "../../utils/table-resize.js";
import { enableColumnDrag } from "../../utils/table-column-drag.js";

/* ============================================================
   🔃 SORTABLE (MASTER)
============================================================ */
const SORTABLE_FIELDS = new Set([
  "organization_id",
  "facility_id",
  "patient_id",
  "provider_id",
  "department_id",
  "order_date",
  "status",
  "created_at",
  "updated_at",
]);

/* ============================================================
   🎛 ACTIONS
============================================================ */
function getOrderActionButtons(entry, user) {
  return buildActionButtons({
    module: "order",
    status: (entry.status || "").toLowerCase(),
    entry,
    entryId: entry.id,
    user,
    permissionPrefix: "orders",
  });
}

/* ============================================================
   🔠 HELPERS
============================================================ */
const safe = (v) =>
  v !== null && v !== undefined && v !== "" ? v : "—";

function renderUserName(u) {
  if (!u) return "—";
  return (
    [u.first_name, u.middle_name, u.last_name].filter(Boolean).join(" ") || "—"
  );
}

function renderPatient(entry) {
  const p = entry.patient;
  if (!p) return "—";
  return `${p.pat_no || "—"} - ${[p.first_name, p.last_name]
    .filter(Boolean)
    .join(" ")}`;
}

/* ✅ FIXED ITEMS (qty + price + total) */
function renderItems(entry) {
  if (!Array.isArray(entry.items) || !entry.items.length) return "—";

  return `
    <ul class="mb-0 ps-3">
      ${entry.items
        .map((i) => {
          const name = i.billableItem?.name || "—";
          const qty = i.quantity || 0;
          const price =
            i.unit_price || i.billableItem?.price || 0;
          const total =
            i.total_price || qty * price;

          return `
            <li>
              <strong>${name}</strong>
              <div class="text-muted small">
                Qty: ${qty} |
                Unit: ${price} |
                Total: ${total}
              </div>
            </li>
          `;
        })
        .join("")}
    </ul>
  `;
}

/* ============================================================
   🧩 VALUE RENDERER (FIXED KEYS)
============================================================ */
function renderValue(entry, field) {
  switch (field) {
    case "status":
      return `<span class="badge bg-secondary">${(entry.status || "").toUpperCase()}</span>`;

    case "organization":
    case "organization_id":
      return entry.organization?.name || "—";

    case "facility":
    case "facility_id":
      return entry.facility?.name || "—";

    case "patient":
    case "patient_id":
      return renderPatient(entry);

    case "provider":
    case "provider_id":
      return renderUserName(entry.provider);

    case "department":
    case "department_id":
      return entry.department?.name || "—";

    case "items":
      return renderItems(entry);

    case "order_date":
      return formatClinicalDate(entry.order_date);

    case "created_at":
    case "updated_at":
      return entry[field] ? formatDateTime(entry[field]) : "—";

    case "total_amount":
      return entry.total_amount || "0.00";

    case "billing_status":
      return entry.billing_status || "—";

    default:
      return safe(entry[field]);
  }
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

    const label =
      FIELD_LABELS_ORDER[field] || field.replace(/_/g, " ");

    if (field === "actions") {
      th.textContent = "Actions";
      th.classList.add("actions-cell");
    } else {
      th.innerHTML = `<span>${label}</span>`;
    }

    tr.appendChild(th);
  });

  thead.appendChild(tr);

  enableColumnResize(table);
  enableColumnDrag({
    table,
    visibleFields,
  });
}

/* ============================================================
   🗂 CARD (FINAL FIXED – ENTERPRISE)
============================================================ */
export function renderCard(entry, visibleFields, user) {
  const status = (entry.status || "").toLowerCase();

  const safe = (v) =>
    v !== null && v !== undefined && v !== "" ? v : "—";

  const row = (label, value) => `
    <div class="entity-field">
      <span class="entity-label">${label}</span>
      <span class="entity-value">${safe(value)}</span>
    </div>
  `;

  /* ✅ SAFE DATE FIX */
  const formatSafeDate = (d) => {
    if (!d) return "—";
    const date = new Date(d);
    if (isNaN(date.getTime())) return "—";
    return date.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "2-digit",
    });
  };

  /* ✅ TOTAL FALLBACK */
  const calculateTotal = () => {
    if (!Array.isArray(entry.items)) return 0;

    return entry.items.reduce((sum, i) => {
      const price =
        Number(i.unit_price) ||
        Number(i.billableItem?.price) ||
        0;
      const qty = Number(i.quantity) || 0;
      return sum + price * qty;
    }, 0);
  };

  const total =
    entry.total_amount && Number(entry.total_amount) > 0
      ? Number(entry.total_amount)
      : calculateTotal();

  return `
    <div class="entity-card order-card">

      <!-- HEADER -->
      <div class="entity-card-header">
        <div>
          <div class="entity-secondary">${renderPatient(entry)}</div>
          <div class="entity-primary">Order</div>
        </div>
        <span class="entity-status ${status}">
          ${status.toUpperCase()}
        </span>
      </div>

      <!-- CONTEXT -->
      <div class="entity-card-context">
        <div>🏥 ${safe(entry.organization?.name)}</div>
        <div>📍 ${safe(entry.facility?.name)}</div>
        <div>👨‍⚕️ ${renderUserName(entry.provider)}</div>
        <div>🏬 ${safe(entry.department?.name || "No Department")}</div>
      </div>

      <!-- CORE -->
      <div class="entity-card-body">
        ${row("Order Date", formatSafeDate(entry.order_date))}
        ${row("Type", entry.type)}
        ${row("Priority", entry.priority)}
        ${row("Billing Status", entry.billing_status)}
        ${row("Total Amount", `LRD ${total}`)}
      </div>

      <!-- ITEMS -->
      <div class="entity-section">
        <div class="entity-section-title">Items</div>
        <div class="entity-card-body">
          ${renderItems(entry)}
        </div>
      </div>

      <!-- NOTES -->
      ${
        entry.notes
          ? `<div class="entity-card-body">${row("Notes", entry.notes)}</div>`
          : ""
      }

      <!-- AUDIT -->
      <details class="entity-section">
        <summary>Audit</summary>
        <div class="entity-card-body">
          ${row("Created By", renderUserName(entry.createdBy))}
          ${row("Created At", formatSafeDate(entry.created_at))}
          ${row("Updated By", renderUserName(entry.updatedBy))}
          ${row("Updated At", formatSafeDate(entry.updated_at))}
        </div>
      </details>

      <!-- ACTIONS -->
      ${
        visibleFields.includes("actions")
          ? `<div class="entity-card-footer export-ignore">
               ${getOrderActionButtons(entry, user)}
             </div>`
          : ""
      }
    </div>
  `;
}
/* ============================================================
   📋 LIST (MASTER FIXED)
============================================================ */
export function renderList({ entries, visibleFields, viewMode, user }) {
  const tableBody = document.getElementById("orderTableBody");
  const cardContainer = document.getElementById("orderList");
  const tableContainer = document.querySelector(".table-container");

  if (!tableBody || !cardContainer || !tableContainer) return;

  tableBody.innerHTML = "";
  cardContainer.innerHTML = "";

  if (viewMode === "table") {
    tableContainer.classList.add("active");
    cardContainer.classList.remove("active"); // ✅ ensure card hides

    renderDynamicTableHead(visibleFields);

    if (!entries || !entries.length) {
      tableBody.innerHTML = `
        <tr>
          <td colspan="${visibleFields.length}" class="text-center text-muted">
            No orders found.
          </td>
        </tr>`;
      return;
    }

    entries.forEach((e) => {
      const tr = document.createElement("tr");

      tr.innerHTML = visibleFields
        .map((f) =>
          f === "actions"
            ? `<td class="actions-cell">${getOrderActionButtons(e, user)}</td>`
            : `<td>${renderValue(e, f)}</td>`
        )
        .join("");

      tableBody.appendChild(tr);
    });

    initTooltips(tableBody);

  } else {
    tableContainer.classList.remove("active");
    cardContainer.classList.add("active"); // ✅ THIS FIXES YOUR ISSUE

    if (!entries || !entries.length) {
      cardContainer.innerHTML = `
        <p class="text-center text-muted">No orders found.</p>
      `;
      return;
    }

    try {
      cardContainer.innerHTML = entries
        .map((e) => renderCard(e, visibleFields, user))
        .join("");
    } catch (err) {
      console.error("Card render error:", err);
      cardContainer.innerHTML = `
        <p class="text-danger text-center">Failed to render cards</p>
      `;
    }

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

  document.getElementById("exportCSVBtn")?.addEventListener("click", () =>
    exportData({ type: "csv", data: entries, title: "Orders Report" })
  );

  document.getElementById("exportExcelBtn")?.addEventListener("click", () =>
    exportData({ type: "xlsx", data: entries, title: "Orders Report" })
  );

  document.getElementById("exportPDFBtn")?.addEventListener("click", () =>
    exportData({
      type: "pdf",
      title: "Orders Report",
      selector: ".table-container.active, #orderList.active",
    })
  );
}