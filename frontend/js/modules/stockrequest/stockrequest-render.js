// 📁 stockrequest-render.js – Stock Request table & card renderers (master pattern aligned)

import { FIELD_LABELS_STOCK_REQUEST } from "./stockrequest-constants.js";
import { formatDate, initTooltips } from "../../utils/ui-utils.js";
import { buildActionButtons } from "../../utils/status-action-matrix.js";

/* ============================================================
   🎛️ Action Buttons (centralized, permission-driven)
============================================================ */
function getStockRequestActionButtons(entry, user) {
  return buildActionButtons({
    module: "stock_request", // maps to STATUS_ACTION_MATRIX.stock_request
    status: (entry.status || "").toLowerCase(),
    entryId: entry.id,
    user,
    permissionPrefix: "stock_requests",
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
      FIELD_LABELS_STOCK_REQUEST[field] || field.replace(/_/g, " ");
    if (field === "actions") th.classList.add("actions-cell");
    tr.appendChild(th);
  });

  thead.appendChild(tr);
}

/* ============================================================
   🔠 Field Render Helpers
============================================================ */
function renderUserName(user) {
  if (!user) return "—";
  const parts = [user.first_name, user.middle_name, user.last_name].filter(Boolean);
  return parts.length ? parts.join(" ") : user.full_name || "—";
}

function renderItems(items, maxVisible = 2) {
  if (!items?.length) return "—";

  const visible = items
    .slice(0, maxVisible)
    .map((i) => {
      const requested = i.quantity ?? 0;
      const available = i.available_quantity ?? 0;
      const name = i.masterItem?.name || "—";
      const badgeClass =
        available >= requested
          ? "bg-success"
          : available > 0
          ? "bg-warning text-dark"
          : "bg-danger";

      return `
        <div class="d-inline-block me-2 mb-1">
          ${name}
          <span class="badge ${badgeClass}">
            Req: ${requested} | Avail: ${available}
          </span>
        </div>
      `;
    })
    .join("<br>");

  if (items.length <= maxVisible) return visible;

  const hidden = items
    .slice(maxVisible)
    .map((i) => {
      const requested = i.quantity ?? 0;
      const available = i.available_quantity ?? 0;
      const name = i.masterItem?.name || "—";
      const badgeClass =
        available >= requested
          ? "bg-success"
          : available > 0
          ? "bg-warning text-dark"
          : "bg-danger";

      return `
        <div class="d-inline-block me-2 mb-1">
          ${name}
          <span class="badge ${badgeClass}">
            Req: ${requested} | Avail: ${available}
          </span>
        </div>
      `;
    })
    .join("<br>");

  return `
    <div class="requested-items">
      ${visible}
      <span class="see-more text-primary" style="cursor:pointer;">... See more</span>
      <div class="hidden-items d-none mt-1">${hidden}</div>
    </div>
  `;
}

function renderValue(entry, field) {
  switch (field) {
    case "status": {
      const raw = (entry.status || "").toLowerCase();
      const label = raw.charAt(0).toUpperCase() + raw.slice(1);
      const colorMap = {
        draft: "bg-dark",
        pending: "bg-warning text-dark",
        approved: "bg-success",
        issued: "bg-info",
        fulfilled: "bg-primary",
        cancelled: "bg-danger",
        rejected: "bg-danger",
      };
      return `<span class="badge ${colorMap[raw] || "bg-secondary"}">${label}</span>`;
    }
    case "organization":
      return entry.organization?.name || "—";
    case "facility":
      return entry.facility?.name || "—";
    case "department":
      return entry.department?.name || "—";
    case "items":
      return renderItems(entry.items);
    case "approvedBy":
      return renderUserName(entry.approvedBy);
    case "issuedBy":
      return renderUserName(entry.issuedBy);
    case "fulfilledBy":
      return renderUserName(entry.fulfilledBy);
    case "rejectedBy":
      return renderUserName(entry.rejectedBy);
    case "createdBy":
      return renderUserName(entry.createdBy);
    case "updatedBy":
      return renderUserName(entry.updatedBy);
    case "deletedBy":
      return renderUserName(entry.deletedBy);
    case "created_at":
    case "updated_at":
    case "approved_at":
    case "issued_at":
    case "fulfilled_at":
    case "rejected_at":
    case "deleted_at":
      return entry[field] ? formatDate(entry[field]) : "—";
    default:
      return entry[field] ?? "—";
  }
}

/* ============================================================
   🗂️ Card Renderer
============================================================ */
export function renderCard(entry, visibleFields, user) {
  const details = visibleFields
    .filter((f) => f !== "actions")
    .map(
      (f) => `
        <p><strong>${FIELD_LABELS_STOCK_REQUEST[f] || f}:</strong> 
        ${renderValue(entry, f)}</p>`
    )
    .join("");

  const footer = visibleFields.includes("actions")
    ? `
      <div class="card-footer text-end">
        <div class="table-actions">
          ${getStockRequestActionButtons(entry, user)}
        </div>
      </div>`
    : "";

  return `
    <div class="record-card card shadow-sm h-100">
      <div class="card-body">${details}</div>
      ${footer}
    </div>`;
}

/* ============================================================
   📋 List Renderer (table + card views)
============================================================ */
export function renderList({ entries, visibleFields, viewMode, user }) {
  const tableBody = document.getElementById("stockRequestTableBody");
  const cardContainer = document.getElementById("stockRequestList");
  const tableContainer = document.querySelector(".table-container");
  if (!tableBody || !cardContainer || !tableContainer) return;

  tableBody.innerHTML = "";
  cardContainer.innerHTML = "";

  const noData = `<tr><td colspan="${visibleFields.length}" class="text-center text-muted py-3">No stock requests found.</td></tr>`;

  if (viewMode === "table") {
    cardContainer.classList.remove("active");
    tableContainer.classList.add("active");
    document.getElementById("tableViewBtn")?.classList.add("active");
    document.getElementById("cardViewBtn")?.classList.remove("active");

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
              ? `<div class="table-actions export-ignore">${getStockRequestActionButtons(entry, user)}</div>`
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
    document.getElementById("cardViewBtn")?.classList.add("active");
    document.getElementById("tableViewBtn")?.classList.remove("active");

    cardContainer.innerHTML = entries.length
      ? entries.map((e) => renderCard(e, visibleFields, user)).join("")
      : `<p class="text-muted text-center py-3">No stock requests found.</p>`;

    initTooltips(cardContainer);
  }
}

/* ============================================================
   🔁 Expand/Collapse “See more” toggle for items
============================================================ */
document.addEventListener("click", (e) => {
  if (e.target.classList.contains("see-more")) {
    const container = e.target.closest(".requested-items");
    const hidden = container.querySelector(".hidden-items");
    if (!hidden) return;

    const isHidden = hidden.classList.contains("d-none");
    hidden.classList.toggle("d-none", !isHidden);
    e.target.textContent = isHidden ? "... See less" : "... See more";
  }
});
