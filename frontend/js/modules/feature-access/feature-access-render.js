// 📁 feature-access-render.js
// ============================================================================
// 🧭 Enterprise Renderer – Feature Access
// 🔹 Table + Card parity
// 🔹 Organization-aware (ORG / FACILITY scope)
// 🔹 Tooltip-safe, export-safe
// ============================================================================

import { FIELD_LABELS_FEATURE_ACCESS } from "./feature-access-constants.js";
import { formatDate } from "../../utils/ui-utils.js";

/* ----------------------------- helpers ----------------------------- */

// ▶️ Bootstrap tooltips (safe no-op if bootstrap not loaded)
function initTooltips(scope = document) {
  if (!window.bootstrap) return;
  const triggers = [].slice.call(
    scope.querySelectorAll("[data-bs-toggle='tooltip']")
  );
  triggers.forEach((el) => {
    if (!bootstrap.Tooltip.getInstance(el)) {
      new bootstrap.Tooltip(el);
    }
  });
}

function formatUser(user) {
  if (!user) return "—";
  const fullName = `${user.first_name || ""} ${user.last_name || ""}`.trim();
  return fullName || "—";
}

/* --------------------------- action buttons --------------------------- */

function getFeatureAccessActionButtons(entry, userRole) {
  const role = (userRole || "").toLowerCase();
  const canDelete = role === "admin" || role === "super admin";

  const isActive = (entry.status || "").toLowerCase() === "active";
  const statusBtnClass = isActive
    ? "btn-outline-success"
    : "btn-outline-warning";
  const statusIcon = isActive ? "fa-toggle-on" : "fa-toggle-off";
  const statusTitle = isActive ? "Set Inactive" : "Set Active";

  return `
    <div class="d-inline-flex gap-1">
      <button
        class="btn btn-outline-primary btn-sm view-btn"
        data-id="${entry.id}"
        data-bs-toggle="tooltip"
        data-bs-title="View"
        aria-label="View feature access"
      >
        <i class="fas fa-eye"></i>
      </button>

      <button
        class="btn btn-outline-success btn-sm edit-btn"
        data-id="${entry.id}"
        data-bs-toggle="tooltip"
        data-bs-title="Edit"
        aria-label="Edit feature access"
      >
        <i class="fas fa-pen"></i>
      </button>

      <button
        class="btn ${statusBtnClass} btn-sm toggle-status-btn"
        data-id="${entry.id}"
        data-bs-toggle="tooltip"
        data-bs-title="${statusTitle}"
        aria-label="Toggle feature access status"
      >
        <i class="fas ${statusIcon}"></i>
      </button>

      ${
        canDelete
          ? `
        <button
          class="btn btn-outline-danger btn-sm delete-btn"
          data-id="${entry.id}"
          data-bs-toggle="tooltip"
          data-bs-title="Delete"
          aria-label="Delete feature access"
        >
          <i class="fas fa-trash"></i>
        </button>
      `
          : ""
      }
    </div>
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
    th.textContent =
      field === "actions"
        ? "Actions"
        : FIELD_LABELS_FEATURE_ACCESS[field] ||
          field.replace(/_/g, " ");
    if (field === "actions") th.classList.add("actions-cell");
    tr.appendChild(th);
  });

  thead.appendChild(tr);
}

/* ---------------------------- field render ---------------------------- */

function renderValue(entry, field) {
  switch (field) {
    /* -------- Status -------- */
    case "status": {
      const raw = (entry.status || "").toLowerCase();
      const label = raw.charAt(0).toUpperCase() + raw.slice(1);
      let badgeClass = "bg-secondary";
      if (raw === "active") badgeClass = "bg-success";
      if (raw === "inactive") badgeClass = "bg-warning text-dark";
      return raw
        ? `<span class="badge ${badgeClass}">${label}</span>`
        : "—";
    }

    /* -------- Organization -------- */
    case "organization_id":
      if (entry.organization) {
        return entry.organization.code
          ? `${entry.organization.name} (${entry.organization.code})`
          : entry.organization.name;
      }
      return entry.organization_id
        ? `<code>${entry.organization_id}</code>`
        : "—";

    /* -------- Module / Role -------- */
    case "module_id":
      return (
        entry.module?.name ||
        (entry.module_id ? `<code>${entry.module_id}</code>` : "—")
      );

    case "role_id":
      return (
        entry.role?.name ||
        (entry.role_id ? `<code>${entry.role_id}</code>` : "—")
      );

    /* -------- Facility / Scope -------- */
    case "facility_id":
      if (entry.facility) return entry.facility.name;
      return `<span class="badge bg-info">Organization-wide</span>`;

    /* -------- Audit Users -------- */
    case "createdBy":
      return formatUser(entry.createdBy);
    case "updatedBy":
      return formatUser(entry.updatedBy);
    case "deletedBy":
      return formatUser(entry.deletedBy);

    /* -------- Raw IDs (fallback) -------- */
    case "created_by_id":
      return entry.created_by_id
        ? `<code>${entry.created_by_id}</code>`
        : "—";
    case "updated_by_id":
      return entry.updated_by_id
        ? `<code>${entry.updated_by_id}</code>`
        : "—";
    case "deleted_by_id":
      return entry.deleted_by_id
        ? `<code>${entry.deleted_by_id}</code>`
        : "—";

    /* -------- Dates -------- */
    case "created_at":
    case "updated_at":
    case "deleted_at":
      return entry[field] ? formatDate(entry[field]) : "—";

    default:
      return entry[field] != null ? String(entry[field]) : "—";
  }
}

/* ---------------------------- card renderer --------------------------- */

export function renderCard(entry, visibleFields, userRole) {
  let html = "";

  visibleFields.forEach((field) => {
    if (field === "actions") return;
    const label =
      FIELD_LABELS_FEATURE_ACCESS[field] ||
      field.replace(/_/g, " ");
    const value = renderValue(entry, field);
    html += `<p><strong>${label}:</strong> ${value}</p>`;
  });

  return `
    <div class="record-card card shadow-sm h-100">
      <div class="card-body">${html}</div>
      <div class="card-footer text-end">
        <div class="table-actions">
          ${getFeatureAccessActionButtons(entry, userRole)}
        </div>
      </div>
    </div>
  `;
}

/* ----------------------------- list render ---------------------------- */

export function renderList({ entries, visibleFields, viewMode, userRole }) {
  const tableBody = document.getElementById("featureAccessTableBody");
  const cardContainer = document.getElementById("featureAccessList");
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
      tableBody.innerHTML = `
        <tr>
          <td colspan="${visibleFields.length}" class="text-center text-muted">
            No records found.
          </td>
        </tr>`;
      initTooltips(tableBody);
      return;
    }

    entries.forEach((entry) => {
      const row = document.createElement("tr");
      row.innerHTML = visibleFields
        .map((field) => {
          const value =
            field === "actions"
              ? `<div class="table-actions export-ignore">
                   ${getFeatureAccessActionButtons(entry, userRole)}
                 </div>`
              : renderValue(entry, field);

          const cls =
            field === "actions"
              ? ' class="actions-cell text-center"'
              : "";

          return `<td${cls}>${value}</td>`;
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
      ? entries.map((e) => renderCard(e, visibleFields, userRole)).join("")
      : `<p class="text-muted">No records found.</p>`;

    initTooltips(cardContainer);
  }
}
