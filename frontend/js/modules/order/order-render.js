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
import { getCurrencySymbol } from "../../utils/currency-utils.js";

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

/* ✅ FIXED ITEMS (qty + price + total + currency SAFE) */
function renderItems(entry) {
  if (!Array.isArray(entry.items) || !entry.items.length) return "—";

  const count = entry.items.length;

  // ✅ GET CURRENCY SYMBOL ONCE
  const symbol = getCurrencySymbol(entry.currency);

  return `
    <div class="order-items-wrapper">

      <!-- 🔹 SUMMARY (CLICKABLE) -->
      <div class="order-items-toggle" onclick="this.nextElementSibling.classList.toggle('d-none')">
        📦 ${count} item${count > 1 ? "s" : ""} (Click to view)
      </div>

      <!-- 🔹 HIDDEN LIST -->
      <ul class="order-items-list d-none mt-1 ps-3">
        ${entry.items
          .map((i) => {
            const name = i.billableItem?.name || "—";
            const qty = Number(i.quantity || 0);

            const price =
              Number(i.unit_price) ||
              Number(i.billableItem?.price) ||
              0;

            const total =
              Number(i.total_price) ||
              qty * price;

            return `
              <li>
                <strong>${name}</strong>
                <div class="text-muted small">
                  Qty: ${qty} |
                  Unit: ${symbol}${price.toFixed(2)} |
                  Total: ${symbol}${total.toFixed(2)}
                </div>
              </li>
            `;
          })
          .join("")}
      </ul>

    </div>
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
      return entry[field]
        ? formatClinicalDate(
            entry[field].includes("T")
              ? entry[field].split("T")[0]
              : entry[field]
          )
        : "—";

    /* ✅ FIX START (OBJECT → VALUE) */
    case "consultation":
    case "consultation_id":
      return entry.consultation?.consultation_date
        ? formatClinicalDate(
            entry.consultation.consultation_date.includes("T")
              ? entry.consultation.consultation_date.split("T")[0]
              : entry.consultation.consultation_date
          )
        : "—";
    case "registrationLog":
    case "registration_log_id":
      return entry.registrationLog?.registration_time
        ? formatClinicalDate(entry.registrationLog.registration_time.split("T")[0])
        : "—";
    case "createdBy":
      return renderUserName(entry.createdBy);

    case "updatedBy":
      return renderUserName(entry.updatedBy);
    /* ✅ FIX END */

    case "created_at":
    case "updated_at":
      return entry[field] ? formatDateTime(entry[field]) : "—";

    case "total_amount": {
      const symbol = getCurrencySymbol(entry.currency);
      return `${symbol}${Number(entry.total_amount || 0).toFixed(2)}`;
    }
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
   🗂 CARD (FINAL FIXED – ENTERPRISE | DATE ONLY + LR$ FORMAT)
============================================================ */
export function renderCard(entry, visibleFields, user) {
  const has = (f) => visibleFields.includes(f);
  const status = (entry.status || "").toLowerCase();

  const safe = (v) =>
    v !== null && v !== undefined && v !== "" ? v : "—";

  /* ===================== 💰 MONEY FORMAT ===================== */
  const money = (v) => {
    const symbol = getCurrencySymbol(entry.currency);
    return `${symbol}${Number(v || 0).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };
  const row = (label, value) => {
    if (value === undefined || value === null || value === "") return "";
    return `
      <div class="entity-field">
        <span class="entity-label">${label}</span>
        <span class="entity-value">${safe(value)}</span>
      </div>
    `;
  };

  /* ===================== TOTAL ===================== */
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

  /* ===================== DATE ONLY ===================== */
  const orderDate = entry.order_date
    ? formatClinicalDate(
        entry.order_date.includes("T")
          ? entry.order_date.split("T")[0]
          : entry.order_date
      )
    : "—";

  return `
    <div class="entity-card order-card">

      <!-- ===================================================== -->
      <!-- 🔹 HEADER -->
      <!-- ===================================================== -->
      <div class="entity-card-header">
        <div>
          <div class="entity-secondary">${renderPatient(entry)}</div>
          <div class="entity-primary">Order</div>
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
      <!-- 🔹 QUICK CORE -->
      <!-- ===================================================== -->
      <div class="entity-card-body">
        ${row("Order Date", orderDate)}
        ${row("Type", entry.type)}
        ${row("Priority", entry.priority)}
        ${row("Billing Status", entry.billing_status)}
        ${row("Total Amount", money(total))}
      </div>

      <!-- ===================================================== -->
      <!-- 📄 DETAILS -->
      <!-- ===================================================== -->
      <details class="entity-section">
        <summary><strong>Details</strong></summary>
        <div class="entity-card-body">

          ${row("Organization", entry.organization?.name)}
          ${row("Facility", entry.facility?.name)}
          ${row("Provider", renderUserName(entry.provider))}
          ${row("Department", entry.department?.name || "No Department")}

          ${visibleFields
            .filter(
              (f) =>
                ![
                  "actions",
                  "order_date",
                  "type",
                  "priority",
                  "billing_status",
                  "organization",
                  "facility",
                  "provider",
                  "department",
                  "patient",
                  "patient_id",
                  "items",
                  "notes",

                  /* 🔒 AUDIT REMOVED FROM DETAILS */
                  "createdBy","updatedBy","deletedBy",
                  "approvedBy","processedBy","reversedBy","voidedBy",
                  "restoredBy","reviewedBy","rejectedBy","cancelledBy",

                  "created_at","updated_at","deleted_at",
                  "approved_at","processed_at","reversed_at","voided_at",
                  "restored_at","reviewed_at","rejected_at","cancelled_at",
                ].includes(f)
            )
            .map((f) =>
              row(
                FIELD_LABELS_ORDER?.[f] || f,
                renderValue(entry, f)
              )
            )
            .join("")}

        </div>
      </details>

      <!-- ===================================================== -->
      <!-- 📦 ITEMS -->
      <!-- ===================================================== -->
      <details class="entity-section">
        <summary><strong>Items</strong></summary>
        <div class="entity-card-body">
          ${renderItems(entry)}
        </div>
      </details>

      <!-- ===================================================== -->
      <!-- 📝 NOTES -->
      <!-- ===================================================== -->
      ${
        entry.notes
          ? `<details class="entity-section">
               <summary><strong>Notes</strong></summary>
               <div class="entity-card-body">
                 ${safe(entry.notes)}
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

          ${row("Approved By", renderUserName(entry.approvedBy))}
          ${row("Approved At", formatDateTime(entry.approved_at))}

          ${row("Processed By", renderUserName(entry.processedBy))}
          ${row("Processed At", formatDateTime(entry.processed_at))}

          ${row("Reviewed By", renderUserName(entry.reviewedBy))}
          ${row("Reviewed At", formatDateTime(entry.reviewed_at))}

          ${row("Rejected By", renderUserName(entry.rejectedBy))}
          ${row("Rejected At", formatDateTime(entry.rejected_at))}

          ${row("Cancelled By", renderUserName(entry.cancelledBy))}
          ${row("Cancelled At", formatDateTime(entry.cancelled_at))}

          ${row("Reversed By", renderUserName(entry.reversedBy))}
          ${row("Reversed At", formatDateTime(entry.reversed_at))}

          ${row("Voided By", renderUserName(entry.voidedBy))}
          ${row("Voided At", formatDateTime(entry.voided_at))}

          ${row("Restored By", renderUserName(entry.restoredBy))}
          ${row("Restored At", formatDateTime(entry.restored_at))}

          ${row("Deleted By", renderUserName(entry.deletedBy))}
          ${row("Deleted At", formatDateTime(entry.deleted_at))}

        </div>
      </details>

      <!-- ===================================================== -->
      <!-- ⚙️ ACTIONS -->
      <!-- ===================================================== -->
      ${
        has("actions")
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