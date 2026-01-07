// 📦 pharmacy-transaction-render.js – Enterprise Master Pattern Aligned
// ============================================================================
// 🔹 Mirrors payment-render.js for unified structure & enterprise behavior
// 🔹 Preserves all existing IDs, event logic, and API calls
// 🔹 Adds #moduleSummary, export handlers, pagination, role-aware field visibility
// 🔹 Integrates STATUS_ACTION_MATRIX and tooltip initialization
// ============================================================================

import { FIELD_LABELS_PHARMACY_TRANSACTION } from "./pharmacy-transaction-constants.js";
import { formatDate, initTooltips } from "../../utils/ui-utils.js";
import { buildActionButtons } from "../../utils/status-action-matrix.js";
import { exportData } from "../../utils/export-utils.js";
import {
  FIELD_LABELS_PHARMACY_SUMMARY,
  FIELD_ORDER_PHARMACY_SUMMARY,
  FIELD_DEFAULTS_PHARMACY_SUMMARY,
} from "./pharmacy-transaction-constants.js";

// 💊 Summary field visibility (will be managed by filter-main.js or default)
export let visibleSummaryFields = [...FIELD_DEFAULTS_PHARMACY_SUMMARY];

export function setVisibleSummaryFields(fields) {
  visibleSummaryFields = fields;
}

/* ============================================================================
   🎛️ Action Buttons (centralized + permission-driven)
============================================================================ */
function getPharmacyTransactionActionButtons(entry, user) {
  return buildActionButtons({
    module: "pharmacy_transaction",
    status: (entry.status || "").toLowerCase(),
    entry,
    entryId: entry.id,
    user,
    permissionPrefix: "pharmacy_transactions",
  });
}

/* ============================================================================
   🧱 Dynamic Table Head Renderer
============================================================================ */
export function renderDynamicTableHead(visibleFields) {
  const thead = document.getElementById("dynamicTableHead");
  if (!thead) return;
  thead.innerHTML = "";
  const tr = document.createElement("tr");
  visibleFields.forEach((field) => {
    const th = document.createElement("th");
    th.textContent =
      FIELD_LABELS_PHARMACY_TRANSACTION[field] || field.replace(/_/g, " ");
    if (field === "actions") th.classList.add("actions-cell");
    tr.appendChild(th);
  });
  thead.appendChild(tr);
}

/* ============================================================================
   🔠 Field Render Helpers
============================================================================ */
function renderUserName(user) {
  if (!user) return "—";
  const parts = [user.first_name, user.middle_name, user.last_name].filter(Boolean);
  return parts.length ? parts.join(" ") : user.full_name || "—";
}

function renderBoolean(val) {
  if (val === true) return `<span class="text-success">Yes</span>`;
  if (val === false) return `<span class="text-danger">No</span>`;
  return "—";
}

/* ============================================================================
   🧩 Value Renderer (per field)
============================================================================ */
function renderValue(entry, field) {
  switch (field) {
    case "status": {
      const raw = (entry.status || "").toLowerCase();
      const label = raw.charAt(0).toUpperCase() + raw.slice(1).replace("_", " ");
      const map = {
        pending: "bg-secondary",
        dispensed: "bg-success",
        partially_dispensed: "bg-warning text-dark",
        verified: "bg-primary",
        cancelled: "bg-danger",
        voided: "bg-dark text-light",
      };
      return raw
        ? `<span class="badge ${map[raw] || "bg-secondary"}">${label}</span>`
        : "—";
    }

    case "is_emergency":
      return renderBoolean(entry.is_emergency);

    case "organization_id":
      return entry.organization?.name || "—";
    case "facility_id":
      return entry.facility?.name || "—";
    case "department_id":
      return entry.department?.name || "—";

    case "patient_id":
      return entry.patient
        ? `${entry.patient.pat_no || "—"} - ${entry.patient.first_name || ""} ${
            entry.patient.last_name || ""
          }`
        : "—";

    case "doctor_id":
      return entry.doctor ? renderUserName(entry.doctor) : "—";
    case "fulfilled_by_id":
      return entry.fulfilledBy ? renderUserName(entry.fulfilledBy) : "—";

    case "consultation_id":
      return entry.consultation
        ? `#${entry.consultation.id} (${entry.consultation.status})`
        : "—";

    case "prescription_id":
      return entry.prescription
        ? `#${entry.prescription.id.slice(0, 8)}… (${entry.prescription.status})`
        : "—";

    case "prescription_item_id":
      return entry.prescriptionItem?.billableItem?.name || "—";

    case "department_stock_id":
      return entry.departmentStock
        ? `Batch: ${entry.departmentStock.id.slice(0, 8)}… (Qty: ${
            entry.departmentStock.quantity
          })`
        : "—";

    case "quantity_dispensed":
      return entry.quantity_dispensed ?? "—";

    case "fulfillment_date":
    case "created_at":
    case "updated_at":
    case "deleted_at":
      return entry[field] ? formatDate(entry[field]) : "—";

    case "created_by_id":
      return renderUserName(entry.createdBy);
    case "updated_by_id":
      return renderUserName(entry.updatedBy);
    case "deleted_by_id":
      return renderUserName(entry.deletedBy);

    default:
      return entry[field] != null && entry[field] !== ""
        ? String(entry[field])
        : "—";
  }
}

/* ============================================================================
   🗂️ Card Renderer
============================================================================ */
export function renderCard(entry, visibleFields, user) {
  const body = visibleFields
    .filter((f) => f !== "actions")
    .map(
      (f) =>
        `<p><strong>${
          FIELD_LABELS_PHARMACY_TRANSACTION[f] || f
        }:</strong> ${renderValue(entry, f)}</p>`
    )
    .join("");

  const footer = visibleFields.includes("actions")
    ? `<div class="card-footer text-end">
         <div class="table-actions">
           ${getPharmacyTransactionActionButtons(entry, user)}
         </div>
       </div>`
    : "";

  return `<div class="record-card card shadow-sm h-100">
            <div class="card-body">${body}</div>
            ${footer}
          </div>`;
}

/* ============================================================================
   📋 Main List Renderer
============================================================================ */
export function renderList({ entries, visibleFields, viewMode, user }) {
  const tableBody = document.getElementById("pharmacyTransactionTableBody");
  const cardContainer = document.getElementById("pharmacyTransactionList");
  const tableContainer = document.querySelector(".table-container");
  if (!tableBody || !cardContainer || !tableContainer) return;

  // 🔄 Sync view toggle
  document
    .getElementById("tableViewBtn")
    ?.classList.toggle("active", viewMode === "table");
  document
    .getElementById("cardViewBtn")
    ?.classList.toggle("active", viewMode === "card");

  tableBody.innerHTML = "";
  cardContainer.innerHTML = "";

  const noData = `<tr><td colspan="${visibleFields.length}" class="text-center text-muted py-3">No pharmacy transactions found.</td></tr>`;

  if (viewMode === "table") {
    cardContainer.classList.remove("active");
    tableContainer.classList.add("active");
    renderDynamicTableHead(visibleFields);

    if (!entries.length) {
      tableBody.innerHTML = noData;
      initTooltips(tableBody);
      return;
    }

    entries.forEach((entry) => {
      const tr = document.createElement("tr");
      tr.innerHTML = visibleFields
        .map((f) => {
          const val =
            f === "actions"
              ? `<div class="table-actions export-ignore">${getPharmacyTransactionActionButtons(
                  entry,
                  user
                )}</div>`
              : renderValue(entry, f);
          const cls =
            f === "actions" ? ' class="text-center actions-cell"' : "";
          return `<td${cls}>${val}</td>`;
        })
        .join("");
      tableBody.appendChild(tr);
    });

    initTooltips(tableBody);
  } else {
    tableContainer.classList.remove("active");
    cardContainer.classList.add("active");
    cardContainer.innerHTML = entries.length
      ? entries.map((e) => renderCard(e, visibleFields, user)).join("")
      : `<p class="text-muted text-center py-3">No pharmacy transactions found.</p>`;
    initTooltips(cardContainer);
  }

  setupExportHandlers(entries);
}

/* ============================================================================
   📊 Summary Renderer (#moduleSummary)
============================================================================ */
export function renderModuleSummary(summaryData = {}) {
  const summaryEl = document.getElementById("moduleSummary");
  if (!summaryEl) return;
  const statuses = [
    "pending",
    "dispensed",
    "partially_dispensed",
    "verified",
    "cancelled",
    "voided",
  ];
  const cards = statuses
    .map((s) => {
      const count = summaryData[s] ?? 0;
      const label = s.replace("_", " ").replace(/\b\w/g, (c) => c.toUpperCase());
      const colorMap = {
        pending: "bg-secondary",
        dispensed: "bg-success",
        partially_dispensed: "bg-warning text-dark",
        verified: "bg-primary",
        cancelled: "bg-danger",
        voided: "bg-dark text-light",
      };
      return `
        <div class="col-md-2 col-6 mb-2">
          <div class="card text-center ${colorMap[s] || "bg-light"} text-white p-2">
            <h6 class="fw-bold">${label}</h6>
            <p class="fs-5 mb-0">${count}</p>
          </div>
        </div>`;
    })
    .join("");
  summaryEl.innerHTML = `<div class="row g-2">${cards}</div>`;
}
/* ============================================================================
   📊 DYNAMIC SUMMARY TABLE RENDERER (for summary view)
============================================================================ */
export function renderPharmacySummaryTable(records = []) {
  const table = document.getElementById("pharmacySummaryTable");
  if (!table) return;

  const thead = table.querySelector("thead");
  const tbody = table.querySelector("tbody");

  // 🧱 Build Header
  thead.innerHTML = `
    <tr>
      ${visibleSummaryFields
        .map((key) => {
          const label =
            FIELD_LABELS_PHARMACY_SUMMARY[key] ||
            key.replace(/_/g, " ").toUpperCase();
          return `<th>${label}</th>`;
        })
        .join("")}
    </tr>
  `;

  // 🧾 No Data Case
  if (!records.length) {
    tbody.innerHTML = `<tr><td colspan="${visibleSummaryFields.length}" class="text-center text-muted py-3">No summary data available</td></tr>`;
    return;
  }

  // 🧮 Body Rows
  tbody.innerHTML = records
    .map((r) => {
      const isTotal = r.medication_name === "GRAND TOTAL";
      const rowClass = isTotal ? "fw-bold bg-light" : "";
      return `
        <tr class="${rowClass}">
          ${visibleSummaryFields
            .map((key) => {
              let val = r[key];
              if (val == null) val = 0;

              if (key === "total_value") {
                return `<td>$${parseFloat(val).toFixed(2)}</td>`;
              }
              if (!isNaN(val)) {
                return `<td>${parseFloat(val).toLocaleString()}</td>`;
              }
              return `<td>${val}</td>`;
            })
            .join("")}
        </tr>`;
    })
    .join("");
}

/* ============================================================================
   📤 Export Handlers
============================================================================ */
let exportHandlersBound = false;
function setupExportHandlers(entries) {
  if (exportHandlersBound) return;
  exportHandlersBound = true;

  const title = "Pharmacy Transactions Report";
  document
    .getElementById("exportCSVBtn")
    ?.addEventListener("click", () =>
      exportData({ type: "csv", data: entries, title })
    );
  document
    .getElementById("exportExcelBtn")
    ?.addEventListener("click", () =>
      exportData({ type: "xlsx", data: entries, title })
    );
  document
    .getElementById("exportPDFBtn")
    ?.addEventListener("click", () =>
      exportData({
        type: "pdf",
        title,
        selector: ".table-container",
        orientation: "landscape",
      })
    );
}
