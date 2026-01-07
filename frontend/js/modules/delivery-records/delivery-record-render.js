// 📁 delivery-record-render.js – Delivery Record table & card renderers (permission-driven, unified master pattern)

import { FIELD_LABELS_DELIVERY_RECORD } from "./delivery-record-constants.js";
import { formatDate } from "../../utils/ui-utils.js";
import { buildActionButtons } from "../../utils/status-action-matrix.js"; // ✅ shared button builder
import { initTooltips } from "../../utils/ui-utils.js";


/* ============================================================
   🎛️ Action Buttons (using shared utility)
============================================================ */
function getDeliveryRecordActionButtons(entry, user) {
  return buildActionButtons({
    module: "delivery_record", // 👈 used in STATUS_ACTION_MATRIX
    status: (entry.status || "").toLowerCase(),
    entryId: entry.id,
    user,
    permissionPrefix: "delivery_records", // 👈 matches backend permission keys
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
      FIELD_LABELS_DELIVERY_RECORD[field] || field.replace(/_/g, " ");
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
  return parts.length ? parts.join(" ") : "—";
}

function renderValue(entry, field) {
  switch (field) {
    case "status": {
      const raw = (entry.status || "").toLowerCase();
      const label = raw.charAt(0).toUpperCase() + raw.slice(1);
      let badgeClass = "bg-secondary";
      if (raw === "scheduled") badgeClass = "bg-info";
      if (raw === "in_progress") badgeClass = "bg-warning text-dark";
      if (raw === "completed") badgeClass = "bg-primary";
      if (raw === "verified") badgeClass = "bg-success";
      if (raw === "cancelled") badgeClass = "bg-danger";
      if (raw === "voided") badgeClass = "bg-dark";
      return raw ? `<span class="badge ${badgeClass}">${label}</span>` : "—";
    }
    case "is_emergency":
      return entry.is_emergency
        ? `<span class="badge bg-danger">Emergency</span>`
        : `<span class="badge bg-success">No</span>`;
    case "organization":
      return entry.organization?.name || "—";
    case "facility":
      return entry.facility?.name || "—";
    case "patient":
      return entry.patient
        ? `${entry.patient.pat_no || ""} ${entry.patient.full_name || ""}`.trim() || "—"
        : "—";
    case "doctor":
      return renderUserName(entry.doctor);
    case "midwife":
      return renderUserName(entry.midwife);
    case "consultation":
      if (entry.consultation) {
        const date = formatDate(entry.consultation.consultation_date);
        const status = entry.consultation.status
          ? ` (${entry.consultation.status})`
          : "";
        return `${date}${status}`;
      }
      return "—";
    case "department":
      return entry.department?.name || "—";
    case "billableItem":
      return entry.billableItem?.name || "—";
    case "invoice":
      return entry.invoice
        ? `${entry.invoice.invoice_number} (${entry.invoice.status})`
        : "—";
    case "createdBy":
      return renderUserName(entry.createdBy);
    case "updatedBy":
      return renderUserName(entry.updatedBy);
    case "deletedBy":
      return renderUserName(entry.deletedBy);
    case "delivery_date":
      return entry.delivery_date ? formatDate(entry.delivery_date) : "—";
    case "created_at":
      return entry.created_at ? formatDate(entry.created_at) : "—";
    case "updated_at":
      return entry.updated_at ? formatDate(entry.updated_at) : "—";
    case "deleted_at":
      return entry.deleted_at ? formatDate(entry.deleted_at) : "—";
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
    const label = FIELD_LABELS_DELIVERY_RECORD[field] || field.replace(/_/g, " ");
    const value = renderValue(entry, field);
    html += `<p><strong>${label}:</strong> ${value}</p>`;
  });

  const footer = visibleFields.includes("actions")
    ? `
      <div class="card-footer text-end">
        <div class="table-actions">
          ${getDeliveryRecordActionButtons(entry, user)}
        </div>
      </div>`
    : "";

  return `
    <div class="record-card card shadow-sm h-100">
      <div class="card-body">${html}</div>
      ${footer}
    </div>
  `;
}

/* ============================================================
   📋 List Renderer (Table + Card View)
============================================================ */
export function renderList({ entries, visibleFields, viewMode, user }) {
  const tableBody = document.getElementById("deliveryRecordTableBody");
  const cardContainer = document.getElementById("deliveryRecordList");
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
      tableBody.innerHTML = `<tr><td colspan="${visibleFields.length}">No delivery records found.</td></tr>`;
      initTooltips(cardContainer);
      return;
    }

    entries.forEach((entry) => {
      const row = document.createElement("tr");
      let rowHTML = "";
      visibleFields.forEach((field) => {
        const value =
          field === "actions"
            ? `<div class="table-actions export-ignore">${getDeliveryRecordActionButtons(entry, user)}</div>`
            : renderValue(entry, field);
        const tdClass = field === "actions" ? ' class="actions-cell text-center"' : "";
        rowHTML += `<td${tdClass}>${value}</td>`;
      });
      row.innerHTML = rowHTML;
      tableBody.appendChild(row);
    });

    initTooltips(cardContainer);
  } else {
    tableContainer.classList.remove("active");
    cardContainer.classList.add("active");
    document.getElementById("cardViewBtn")?.classList.add("active");
    document.getElementById("tableViewBtn")?.classList.remove("active");

    cardContainer.innerHTML = entries.length
      ? entries.map((e) => renderCard(e, visibleFields, user)).join("")
      : `<p class="text-muted">No delivery records found.</p>`;

    initTooltips(cardContainer);
  }
}
