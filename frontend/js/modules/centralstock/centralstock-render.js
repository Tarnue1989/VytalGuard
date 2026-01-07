// 📁 centralstock-render.js – Central Stock Table & Card Renderers (permission-driven, unified master pattern)

import { FIELD_LABELS_CENTRAL_STOCK } from "./centralstock-constants.js";
import { formatDate } from "../../utils/ui-utils.js";
import { buildActionButtons } from "../../utils/status-action-matrix.js"; // ✅ shared centralized logic

/* ============================================================
   🧭 Tooltip Initializer
============================================================ */
function initTooltips(scope = document) {
  if (!window.bootstrap) return;
  const triggers = [].slice.call(scope.querySelectorAll("[data-bs-toggle='tooltip']"));
  triggers.forEach((el) => {
    if (!bootstrap.Tooltip.getInstance(el)) new bootstrap.Tooltip(el);
  });
}

/* ============================================================
   🎛️ Action Buttons (centralized)
============================================================ */
function getCentralStockActionButtons(entry, user) {
  return buildActionButtons({
    module: "central_stock", // 👈 matches STATUS_ACTION_MATRIX.central_stock
    status: (entry.status || "").toLowerCase(),
    entryId: entry.id,
    user,
    permissionPrefix: "central_stocks", // 👈 aligns with backend permission naming
  });
}

/* ============================================================
   🧱 Dynamic Table Head Renderer
============================================================ */
export function renderDynamicTableHead(visibleFields) {
  const thead = document.getElementById("dynamicTableHead");
  if (!thead) return;

  thead.innerHTML = "";
  const tr = document.createElement("tr");

  visibleFields.forEach((field) => {
    const th = document.createElement("th");
    th.textContent =
      FIELD_LABELS_CENTRAL_STOCK[field] || field.replace(/_/g, " ");
    if (field === "actions") th.classList.add("actions-cell");
    tr.appendChild(th);
  });

  thead.appendChild(tr);
}

/* ============================================================
   🧍 Field Helpers
============================================================ */
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
        active: "bg-success",
        inactive: "bg-warning text-dark",
        deleted: "bg-danger",
      };
      return raw
        ? `<span class="badge ${colorMap[raw] || "bg-secondary"}">${label}</span>`
        : "—";
    }
    case "organization":
      return entry.organization?.name || "—";
    case "facility":
      return entry.facility?.name || "—";
    case "masterItem":
      return entry.masterItem?.name || "—";
    case "supplier":
      return entry.supplier?.name || "—";
    case "quantity":
      return entry.quantity ?? "—";
    case "batch_number":
      return entry.batch_number || "—";
    case "received_date":
      return entry.received_date ? formatDate(entry.received_date) : "—";
    case "expiry_date":
      return entry.expiry_date ? formatDate(entry.expiry_date) : "—";
    case "reorder_level":
      return entry.reorder_level ?? "—";
    case "is_locked":
      return entry.is_locked
        ? `<span class="text-danger">🔒 Locked</span>`
        : `<span class="text-success">🔓 Unlocked</span>`;
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
    default:
      return entry[field] != null ? String(entry[field]) : "—";
  }
}

/* ============================================================
   🗂️ Card Renderer
============================================================ */
export function renderCard(entry, visibleFields, user) {
  let html = "";
  visibleFields.forEach((field) => {
    if (field === "actions") return;
    const label =
      FIELD_LABELS_CENTRAL_STOCK[field] || field.replace(/_/g, " ");
    const value = renderValue(entry, field);
    html += `<p><strong>${label}:</strong> ${value}</p>`;
  });

  const footer = visibleFields.includes("actions")
    ? `
      <div class="card-footer text-end">
        <div class="table-actions">
          ${getCentralStockActionButtons(entry, user)}
        </div>
      </div>`
    : "";

  return `
    <div class="record-card card shadow-sm h-100">
      <div class="card-body">${html}</div>
      ${footer}
    </div>`;
}

/* ============================================================
   📋 List Renderer (Table + Card View)
============================================================ */
export function renderList({ entries, visibleFields, viewMode, user }) {
  const tableBody = document.getElementById("centralStockTableBody");
  const cardContainer = document.getElementById("centralStockList");
  const tableContainer = document.querySelector(".table-container");
  if (!tableBody || !cardContainer || !tableContainer) return;

  tableBody.innerHTML = "";
  cardContainer.innerHTML = "";

  if (viewMode === "table") {
    cardContainer.classList.remove("active");
    tableContainer.classList.add("active");
    document.getElementById("tableViewBtn")?.classList.add("active");
    document.getElementById("cardViewBtn")?.classList.remove("active");

    renderDynamicTableHead(visibleFields);

    if (!entries.length) {
      tableBody.innerHTML = `<tr><td colspan="${visibleFields.length}" class="text-center text-muted">No central stock records found.</td></tr>`;
      initTooltips(tableBody);
      return;
    }

    entries.forEach((entry) => {
      const row = document.createElement("tr");
      row.innerHTML = visibleFields
        .map((f) => {
          const val =
            f === "actions"
              ? `<div class="table-actions export-ignore">${getCentralStockActionButtons(entry, user)}</div>`
              : renderValue(entry, f);
          const cls = f === "actions" ? ' class="text-center actions-cell"' : "";
          return `<td${cls}>${val}</td>`;
        })
        .join("");
      tableBody.appendChild(row);
    });

    initTooltips(tableBody);
  } else {
    tableContainer.classList.remove("active");
    cardContainer.classList.add("active");
    document.getElementById("cardViewBtn")?.classList.add("active");
    document.getElementById("tableViewBtn")?.classList.remove("active");

    cardContainer.innerHTML = entries.length
      ? entries.map((e) => renderCard(e, visibleFields, user)).join("")
      : `<p class="text-muted text-center py-3">No central stock records found.</p>`;

    initTooltips(cardContainer);
  }
}
