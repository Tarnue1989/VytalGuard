// 📁 feature-module-render.js
import { FIELD_LABELS_FEATURE_MODULE } from "./feature-module-constants.js";
import { formatDate } from "../../utils/ui-utils.js";

/* ============================================================
   🔧 HELPERS
============================================================ */

// ▶️ Bootstrap tooltips (safe no-op)
function initTooltips(scope = document) {
  if (!window.bootstrap) return;
  const triggers = [].slice.call(
    scope.querySelectorAll("[data-bs-toggle='tooltip']")
  );
  triggers.forEach(el => {
    if (!bootstrap.Tooltip.getInstance(el)) {
      new bootstrap.Tooltip(el);
    }
  });
}

// 👤 Safe user formatter (NO UUID FALLBACK)
function formatUser(user) {
  if (!user) return "—";
  const fullName = `${user.first_name || ""} ${user.last_name || ""}`.trim();
  return fullName || "—";
}

/* ============================================================
   🎛️ ACTION BUTTONS
============================================================ */
function getFeatureModuleActionButtons(entry, userRole) {
  const role = (userRole || "").toLowerCase();
  const canDelete = role === "admin" || role === "super admin";

  const isActive = (entry.status || "").toLowerCase() === "active";
  const statusBtnClass = isActive ? "btn-outline-success" : "btn-outline-warning";
  const statusIcon = isActive ? "fa-toggle-on" : "fa-toggle-off";
  const statusTitle = isActive ? "Set Inactive" : "Set Active";

  const isEnabled = !!entry.enabled;
  const enabledBtnClass = isEnabled ? "btn-outline-success" : "btn-outline-danger";
  const enabledTitle = isEnabled ? "Disable Module" : "Enable Module";

  return `
    <div class="d-inline-flex gap-1">
      <button class="btn btn-outline-primary btn-sm view-btn"
        data-id="${entry.id}" data-bs-toggle="tooltip"
        data-bs-title="View">
        <i class="fas fa-eye"></i>
      </button>

      <button class="btn btn-outline-success btn-sm edit-btn"
        data-id="${entry.id}" data-bs-toggle="tooltip"
        data-bs-title="Edit">
        <i class="fas fa-pen"></i>
      </button>

      <button class="btn ${statusBtnClass} btn-sm toggle-status-btn"
        data-id="${entry.id}" data-bs-toggle="tooltip"
        data-bs-title="${statusTitle}">
        <i class="fas ${statusIcon}"></i>
      </button>

      <button class="btn ${enabledBtnClass} btn-sm toggle-enabled-btn"
        data-id="${entry.id}" data-bs-toggle="tooltip"
        data-bs-title="${enabledTitle}">
        <i class="fas fa-power-off"></i>
      </button>

      ${canDelete ? `
        <button class="btn btn-outline-danger btn-sm delete-btn"
          data-id="${entry.id}" data-bs-toggle="tooltip"
          data-bs-title="Delete">
          <i class="fas fa-trash"></i>
        </button>
      ` : ""}
    </div>
  `;
}

/* ============================================================
   📋 DYNAMIC TABLE HEAD
============================================================ */
export function renderDynamicTableHead(visibleFields) {
  const thead = document.getElementById("dynamicTableHead");
  if (!thead) return;

  thead.innerHTML = "";
  const tr = document.createElement("tr");

  visibleFields.forEach(field => {
    const th = document.createElement("th");
    th.textContent =
      field === "actions"
        ? "Actions"
        : FIELD_LABELS_FEATURE_MODULE[field] || field.replace(/_/g, " ");
    if (field === "actions") th.classList.add("actions-cell");
    tr.appendChild(th);
  });

  thead.appendChild(tr);
}

/* ============================================================
   🧩 FIELD VALUE RENDERER (NO UUIDS)
============================================================ */
function renderValue(entry, field) {
  switch (field) {
    case "status": {
      const raw = (entry.status || "").toLowerCase();
      if (raw === "active") return `<span class="badge bg-success">Active</span>`;
      if (raw === "inactive") return `<span class="badge bg-warning">Inactive</span>`;
      return "—";
    }

    case "enabled":
      return entry.enabled
        ? `<span class="badge bg-success">Enabled</span>`
        : `<span class="badge bg-danger">Disabled</span>`;

    case "visibility":
      return entry.visibility
        ? `<span class="badge bg-info">${entry.visibility}</span>`
        : "—";

    case "tags":
      return Array.isArray(entry.tags) && entry.tags.length
        ? entry.tags.map(t =>
            `<span class="badge bg-light text-dark me-1">#${t}</span>`
          ).join("")
        : "—";

    case "route":
      return entry.route || "—";

    case "roles":
      return Array.isArray(entry.roles) && entry.roles.length
        ? entry.roles.map(r => r.name).join(", ")
        : "—";

    case "parent_id":
      return entry.parent?.name || "—";

    case "children":
      return Array.isArray(entry.children) && entry.children.length
        ? entry.children.map(c => c.name).join(", ")
        : "—";

    // 👤 Audit users (NAME ONLY)
    case "createdBy": return formatUser(entry.createdBy);
    case "updatedBy": return formatUser(entry.updatedBy);
    case "deletedBy": return formatUser(entry.deletedBy);

    // Dates
    case "created_at":
    case "updated_at":
    case "deleted_at":
      return entry[field] ? formatDate(entry[field]) : "—";

    default:
      return entry[field] ?? "—";
  }
}

/* ============================================================
   🃏 CARD RENDERER
============================================================ */
export function renderCard(entry, visibleFields, userRole) {
  const body = visibleFields
    .filter(f => f !== "actions")
    .map(f => `
      <p>
        <strong>${FIELD_LABELS_FEATURE_MODULE[f] || f}:</strong>
        ${renderValue(entry, f)}
      </p>
    `)
    .join("");

  return `
    <div class="record-card card shadow-sm h-100">
      <div class="card-body">${body}</div>
      <div class="card-footer text-end">
        <div class="table-actions">
          ${getFeatureModuleActionButtons(entry, userRole)}
        </div>
      </div>
    </div>
  `;
}

/* ============================================================
   📑 LIST RENDERER (TABLE + CARD)
============================================================ */
export function renderList({ entries, visibleFields, viewMode, userRole }) {
  const tableBody = document.getElementById("featureModuleTableBody");
  const cardContainer = document.getElementById("featureModuleList");
  const tableContainer = document.querySelector(".table-container");
  if (!tableBody || !cardContainer || !tableContainer) return;

  tableBody.innerHTML = "";
  cardContainer.innerHTML = "";

  if (viewMode === "table") {
    cardContainer.classList.remove("active");
    tableContainer.classList.add("active");

    renderDynamicTableHead(visibleFields);

    if (!entries.length) {
      tableBody.innerHTML = `
        <tr>
          <td colspan="${visibleFields.length}" class="text-center text-muted">
            No modules found.
          </td>
        </tr>`;
      return;
    }

    entries.forEach(entry => {
      const tr = document.createElement("tr");
      tr.innerHTML = visibleFields.map(field => {
        const value =
          field === "actions"
            ? `<div class="table-actions export-ignore">
                 ${getFeatureModuleActionButtons(entry, userRole)}
               </div>`
            : renderValue(entry, field);

        const cls = field === "actions"
          ? ' class="actions-cell text-center"'
          : "";

        return `<td${cls}>${value}</td>`;
      }).join("");
      tableBody.appendChild(tr);
    });

    initTooltips(tableBody);

  } else {
    tableContainer.classList.remove("active");
    cardContainer.classList.add("active");

    cardContainer.innerHTML = entries.length
      ? entries.map(e => renderCard(e, visibleFields, userRole)).join("")
      : `<p class="text-muted text-center">No modules found.</p>`;

    initTooltips(cardContainer);
  }
}
