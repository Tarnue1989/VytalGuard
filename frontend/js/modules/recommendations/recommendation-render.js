// 📁 recommendation-render.js – Recommendation table & card renderers

import { FIELD_LABELS_RECOMMENDATION } from "./recommendation-constants.js";
import { formatDate } from "../../utils/ui-utils.js";
import { exportData } from "../../utils/export-utils.js"; // ⬅️ enterprise export engine

/* ----------------------------- helpers ----------------------------- */

// ▶️ Bootstrap tooltips
function initTooltips(scope = document) {
  if (!window.bootstrap) return;
  const triggers = [].slice.call(scope.querySelectorAll("[data-bs-toggle='tooltip']"));
  triggers.forEach((el) => {
    if (!bootstrap.Tooltip.getInstance(el)) {
      new bootstrap.Tooltip(el);
    }
  });
}

/* --------------------------- action buttons --------------------------- */

function getRecommendationActionButtons(entry, userRole) {
  // 🔑 Normalize role
  let role = (userRole || "").trim().toLowerCase();
  if (role.includes("super") && role.includes("admin")) role = "superadmin";
  else if (role.includes("admin")) role = "admin";
  else role = "staff";

  const canDelete = ["admin", "superadmin"].includes(role);
  const canVoid   = ["admin", "superadmin"].includes(role);

  const status = (entry.status || "").toLowerCase();

  // 🛠 Lifecycle actions
  let lifecycleBtns = "";
  if (status === "pending") {
    lifecycleBtns += lifecycleBtn(entry.id, "confirm", "Confirm Recommendation", "fa-check", "success");
    lifecycleBtns += lifecycleBtn(entry.id, "decline", "Decline Recommendation", "fa-ban", "warning");
  }

  if (canVoid && !["voided", "deleted"].includes(status)) {
    lifecycleBtns += lifecycleBtn(entry.id, "void", "Void Recommendation", "fa-times-circle", "danger");
  }

  // 🧩 Core actions
  return `
    <div class="d-inline-flex gap-1">
      <button class="btn btn-outline-primary btn-sm view-btn" data-id="${entry.id}"
        data-bs-toggle="tooltip" data-bs-title="View" aria-label="View recommendation">
        <i class="fas fa-eye"></i>
      </button>

      <button class="btn btn-outline-success btn-sm edit-btn" data-id="${entry.id}"
        data-bs-toggle="tooltip" data-bs-title="Edit" aria-label="Edit recommendation">
        <i class="fas fa-pen"></i>
      </button>

      ${canDelete ? `
        <button class="btn btn-outline-danger btn-sm delete-btn" data-id="${entry.id}"
          data-bs-toggle="tooltip" data-bs-title="Delete" aria-label="Delete recommendation">
          <i class="fas fa-trash"></i>
        </button>
      ` : ""}

      ${lifecycleBtns}
    </div>
  `;
}

function lifecycleBtn(id, action, title, icon, color) {
  return `
    <button class="btn btn-outline-${color} btn-sm ${action}-btn" data-id="${id}"
      data-bs-toggle="tooltip" data-bs-title="${title}" aria-label="${title}">
      <i class="fas ${icon}"></i>
    </button>
  `;
}

/* ------------------------- dynamic table head ------------------------- */

export function renderDynamicTableHead(visibleFields) {
  const thead = document.getElementById("dynamicTableHead");
  if (!thead) return;

  thead.innerHTML = "";
  const tr = document.createElement("tr");

  visibleFields.forEach((field) => {
    const th = document.createElement("th");
    th.textContent = FIELD_LABELS_RECOMMENDATION[field] || field.replace(/_/g, " ");
    if (field === "actions") th.classList.add("actions-cell");
    tr.appendChild(th);
  });

  thead.appendChild(tr);
}

/* ---------------------------- field render ---------------------------- */

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
      if (raw === "pending") badgeClass = "bg-info";
      if (raw === "confirmed") badgeClass = "bg-success";
      if (raw === "declined") badgeClass = "bg-danger";
      if (raw === "voided") badgeClass = "bg-dark";
      return raw ? `<span class="badge ${badgeClass}">${label}</span>` : "—";
    }

    case "organization": return entry.organization?.name || "—";
    case "facility": return entry.facility?.name || "—";
    case "patient": return entry.patient ? `${entry.patient.pat_no} - ${entry.patient.first_name} ${entry.patient.last_name}` : "—";
    case "doctor": return renderUserName(entry.doctor);
    case "department": return entry.department?.name || "—";
    case "consultation": return entry.consultation ? `${entry.consultation.id} (${entry.consultation.status})` : "—";
    case "linkedConsultation": return entry.linkedConsultation ? `${entry.linkedConsultation.id} (${entry.linkedConsultation.status})` : "—";

    case "createdBy": return renderUserName(entry.createdBy);
    case "updatedBy": return renderUserName(entry.updatedBy);
    case "deletedBy": return renderUserName(entry.deletedBy);

    case "recommendation_date": return entry.recommendation_date ? formatDate(entry.recommendation_date) : "—";
    case "created_at": return entry.created_at ? formatDate(entry.created_at) : "—";
    case "updated_at": return entry.updated_at ? formatDate(entry.updated_at) : "—";
    case "deleted_at": return entry.deleted_at ? formatDate(entry.deleted_at) : "—";

    default:
      return entry[field] != null ? String(entry[field]) : "—";
  }
}

/* ---------------------------- card renderer --------------------------- */

export function renderCard(entry, visibleFields, userRole) {
  let html = "";

  visibleFields.forEach((field) => {
    if (field === "actions") return;
    const label = FIELD_LABELS_RECOMMENDATION[field] || field.replace(/_/g, " ");
    const value = renderValue(entry, field);
    html += `<p><strong>${label}:</strong> ${value}</p>`;
  });

  return `
    <div class="record-card card shadow-sm h-100">
      <div class="card-body">${html}</div>
      <div class="card-footer text-end">
        <div class="table-actions">
          ${getRecommendationActionButtons(entry, userRole)}
        </div>
      </div>
    </div>
  `;
}

/* ----------------------------- list render ---------------------------- */

export function renderList({ entries, visibleFields, viewMode, userRole }) {
  const tableBody = document.getElementById("recommendationTableBody");
  const cardContainer = document.getElementById("recommendationList");
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
      tableBody.innerHTML = `<tr><td colspan="${visibleFields.length}">No recommendations found.</td></tr>`;
      initTooltips(tableBody);
      return;
    }

    entries.forEach((entry) => {
      const row = document.createElement("tr");
      let rowHTML = "";
      visibleFields.forEach((field) => {
        const value =
          field === "actions"
            ? `<div class="table-actions export-ignore">${getRecommendationActionButtons(entry, userRole)}</div>`
            : renderValue(entry, field);

        const tdClass = field === "actions"
          ? ' class="actions-cell text-center"'
          : "";

        rowHTML += `<td${tdClass}>${value}</td>`;
      });
      row.innerHTML = rowHTML;
      tableBody.appendChild(row);
    });

    initTooltips(tableBody);

  } else {
    tableContainer.classList.remove("active");
    cardContainer.classList.add("active");
    document.getElementById("cardViewBtn")?.classList.add("active");
    document.getElementById("tableViewBtn")?.classList.remove("active");

    cardContainer.innerHTML = entries.length
      ? entries.map((e) => renderCard(e, visibleFields, userRole)).join("")
      : `<p class="text-muted">No recommendations found.</p>`;

    initTooltips(cardContainer);
  }

  // ⚡ bind export
  setupExportHandlers(entries, visibleFields);
}

/* -------------------------- export handlers --------------------------- */
let exportHandlersBound = false;

function setupExportHandlers(entries) {
  if (exportHandlersBound) return;
  exportHandlersBound = true;

  const title = "Recommendations Report";

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
