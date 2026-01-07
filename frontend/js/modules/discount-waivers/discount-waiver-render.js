// 📦 discount-waiver-render.js – Enterprise Master Pattern Aligned
// ============================================================================
// 🔹 Mirrors discount-render.js for unified structure & enterprise behavior
// 🔹 Supports role-based visibility, tooltips, exports, and STATUS_ACTION_MATRIX
// 🔹 Preserves all discount-waiver-specific logic and DOM IDs
// ============================================================================

import { FIELD_LABELS_DISCOUNT_WAIVER } from "./discount-waiver-constants.js";
import { formatDate, initTooltips } from "../../utils/ui-utils.js";
import { buildActionButtons } from "../../utils/status-action-matrix.js";
import { exportData } from "../../utils/export-utils.js";

/* ============================================================================
   🎛️ Action Buttons (centralized + permission-driven)
============================================================================ */
function getDiscountWaiverActionButtons(entry, user) {
  return buildActionButtons({
    module: "discount_waiver", // maps to STATUS_ACTION_MATRIX.discount_waiver
    status: (entry.status || "").toLowerCase(),
    entry,
    entryId: entry.id,
    user,
    permissionPrefix: "discount-waivers",
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
      FIELD_LABELS_DISCOUNT_WAIVER[field] || field.replace(/_/g, " ");
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

function renderValue(entry, field) {
  switch (field) {
    case "status": {
      const raw = (entry.status || "").toLowerCase();
      const label = raw.charAt(0).toUpperCase() + raw.slice(1);
      const colorMap = {
        pending: "bg-warning text-dark",
        approved: "bg-success",
        rejected: "bg-danger",
        voided: "bg-dark text-light",
        finalized: "bg-info text-dark",
        applied: "bg-primary text-light",
      };
      return raw
        ? `<span class="badge ${colorMap[raw] || "bg-secondary"}">${label}</span>`
        : "—";
    }

    case "organization":
      return entry.organization?.name || "—";
    case "facility":
      return entry.facility?.name || "—";
    case "invoice":
      return entry.invoice?.invoice_number || "—";
    case "patient":
      return entry.patient
        ? `${entry.patient.pat_no} – ${entry.patient.first_name} ${entry.patient.last_name}`
        : "—";

    case "type":
      return entry.type || "—";
    case "reason":
      return entry.reason || "—";
    case "percentage":
      return entry.percentage != null ? `${entry.percentage}%` : "—";
    case "amount":
    case "applied_total": {
      const val = entry[field];
      return val != null
        ? `$${Number(val).toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}`
        : "—";
    }

    // 🛡️ Audit fields
    case "approvedBy":
    case "rejectedBy":
    case "voidedBy":
    case "finalizedBy":
    case "createdBy":
    case "updatedBy":
    case "deletedBy":
      return renderUserName(entry[field]);

    // 🕑 Timestamps
    case "approved_at":
    case "rejected_at":
    case "voided_at":
    case "finalized_at":
    case "created_at":
    case "updated_at":
    case "deleted_at":
      return entry[field] ? formatDate(entry[field]) : "—";

    default:
      return entry[field] ?? "—";
  }
}

/* ============================================================================
   🗂️ Card Renderer
============================================================================ */
export function renderCard(entry, visibleFields, user) {
  const details = visibleFields
    .filter((f) => f !== "actions")
    .map(
      (f) => `
        <p><strong>${FIELD_LABELS_DISCOUNT_WAIVER[f] || f}:</strong>
        ${renderValue(entry, f)}</p>`
    )
    .join("");

  const footer = visibleFields.includes("actions")
    ? `
      <div class="card-footer text-end">
        <div class="table-actions">
          ${getDiscountWaiverActionButtons(entry, user)}
        </div>
      </div>`
    : "";

  return `
    <div class="record-card card shadow-sm h-100">
      <div class="card-body">${details}</div>
      ${footer}
    </div>`;
}

/* ============================================================================
   📋 Main List Renderer
============================================================================ */
export function renderList({ entries, visibleFields, viewMode, user }) {
  const tableBody = document.getElementById("discountWaiverTableBody");
  const cardContainer = document.getElementById("discountWaiverList");
  const tableContainer = document.querySelector(".table-container");
  if (!tableBody || !cardContainer || !tableContainer) return;

  document.getElementById("tableViewBtn")?.classList.toggle("active", viewMode === "table");
  document.getElementById("cardViewBtn")?.classList.toggle("active", viewMode === "card");

  tableBody.innerHTML = "";
  cardContainer.innerHTML = "";

  const noData = `<tr><td colspan="${visibleFields.length}" class="text-center text-muted py-3">No discount waivers found.</td></tr>`;

  if (viewMode === "table") {
    cardContainer.classList.remove("active");
    tableContainer.classList.add("active");

    renderDynamicTableHead(visibleFields);

    if (!entries.length) {
      tableBody.innerHTML = noData;
      return;
    }

    entries.forEach((entry) => {
      const tr = document.createElement("tr");
      tr.innerHTML = visibleFields
        .map((f) => {
          const val =
            f === "actions"
              ? `<div class="table-actions export-ignore">${getDiscountWaiverActionButtons(
                  entry,
                  user
                )}</div>`
              : renderValue(entry, f);
          const cls = f === "actions" ? ' class="text-center actions-cell"' : "";
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
      : `<p class="text-muted text-center py-3">No discount waivers found.</p>`;

    initTooltips(cardContainer);
  }

  setupExportHandlers(entries);
}

/* ============================================================================
   📤 Export Handlers
============================================================================ */
let exportHandlersBound = false;
function setupExportHandlers(entries) {
  if (exportHandlersBound) return;
  exportHandlersBound = true;

  const title = "Discount Waivers Report";

  document.getElementById("exportCSVBtn")?.addEventListener("click", () => {
    exportData({ type: "csv", data: entries, title });
  });

  document.getElementById("exportExcelBtn")?.addEventListener("click", () => {
    exportData({ type: "xlsx", data: entries, title });
  });

  document.getElementById("exportPDFBtn")?.addEventListener("click", () => {
    exportData({
      type: "pdf",
      title,
      selector: ".table-container",
      orientation: "landscape",
    });
  });
}
