// 📦 discount-render.js – Enterprise Master Pattern Aligned
// ============================================================================
// 🔹 Mirrors deposit-render.js for unified structure & enterprise behavior
// 🔹 Supports role-based visibility, tooltips, exports, and STATUS_ACTION_MATRIX
// 🔹 Preserves all discount-specific logic and DOM IDs
// ============================================================================

import { FIELD_LABELS_DISCOUNT } from "./discount-constants.js";
import { formatDate, initTooltips } from "../../utils/ui-utils.js";
import { buildActionButtons } from "../../utils/status-action-matrix.js";
import { exportData } from "../../utils/export-utils.js";

/* ============================================================================
   🎛️ Action Buttons (centralized + permission-driven)
============================================================================ */
function getDiscountActionButtons(entry, user) {
  return buildActionButtons({
    module: "discount", // maps to STATUS_ACTION_MATRIX.discount
    status: (entry.status || "").toLowerCase(),
    entry,
    entryId: entry.id,
    user,
    permissionPrefix: "discounts",
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
      FIELD_LABELS_DISCOUNT[field] || field.replace(/_/g, " ");
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
        draft: "bg-warning text-dark",
        active: "bg-success",
        inactive: "bg-secondary text-light",
        finalized: "bg-info text-dark",
        voided: "bg-danger text-light",
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
      return entry.invoice
        ? `${entry.invoice.invoice_number} (Bal: $${Number(
            entry.invoice.balance || 0
          ).toFixed(2)})`
        : "—";
    case "invoiceItem":
      return entry.invoiceItem
        ? `${entry.invoiceItem.description} · Qty ${entry.invoiceItem.quantity}`
        : "—";
    case "type":
      return entry.type || "—";
    case "value":
      if (entry.type === "percentage") return `${parseFloat(entry.value) || 0}%`;
      if (entry.type === "fixed")
        return `$${Number(entry.value || 0).toFixed(2)}`;
      return entry.value ?? "—";
    case "reason":
      return entry.reason || "—";

    // 🛡️ Audit fields
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

    // 🕑 Timestamps
    case "created_at":
    case "updated_at":
    case "deleted_at":
    case "finalized_at":
    case "voided_at":
      return entry[field] ? formatDate(entry[field]) : "—";

    // 📝 Special
    case "void_reason":
      return entry.void_reason || "—";

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
        <p><strong>${FIELD_LABELS_DISCOUNT[f] || f}:</strong>
        ${renderValue(entry, f)}</p>`
    )
    .join("");

  const footer = visibleFields.includes("actions")
    ? `
      <div class="card-footer text-end">
        <div class="table-actions">
          ${getDiscountActionButtons(entry, user)}
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
  const tableBody = document.getElementById("discountTableBody");
  const cardContainer = document.getElementById("discountList");
  const tableContainer = document.querySelector(".table-container");
  if (!tableBody || !cardContainer || !tableContainer) return;

  document.getElementById("tableViewBtn")?.classList.toggle("active", viewMode === "table");
  document.getElementById("cardViewBtn")?.classList.toggle("active", viewMode === "card");

  tableBody.innerHTML = "";
  cardContainer.innerHTML = "";

  const noData = `<tr><td colspan="${visibleFields.length}" class="text-center text-muted py-3">No discounts found.</td></tr>`;

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
              ? `<div class="table-actions export-ignore">${getDiscountActionButtons(
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
      : `<p class="text-muted text-center py-3">No discounts found.</p>`;

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

  const title = "Discounts Report";

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
